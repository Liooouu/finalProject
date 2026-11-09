const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const Event = require('../models/Event');
const User = require('../models/User');
const Request = require('../models/ManualAttendanceRequest');
const Deleted = require('../models/DeletedAttendance');
const Station = require('../models/CheckInSession');
const { sessionEditLocks, lockedSessionChange } = require('../services/sessionEditing');
const service = require('../services/sessionAttendance');
const manual = require('../services/manualAttendance');
const uri = process.env.TRACKED_TEST_MONGO_URI;
// Keep integration mail entirely inside the fixture process.
require('../services/notify').notifyUsers = async () => {};
describe('real MongoDB session attendance integration', { skip: !uri }, () => {
  let event, student, organizer, admin;
  const at = clock => new Date(`2026-11-08T${clock}+08:00`);
  before(async () => {
    if (!/^mongodb:\/\/127\.0\.0\.1:27029\/tracked_session_test(?:\?|$)/.test(uri)) throw Error('Only the isolated localhost test database is allowed.');
    await mongoose.connect(uri);
    await Promise.all([Attendance.init(), Event.init(), User.init(), Request.init(), Deleted.init()]);
  });
  after(async () => { await mongoose.disconnect(); });
  beforeEach(async () => {
    await Promise.all([Attendance.deleteMany({}), Event.deleteMany({}), User.deleteMany({}), Request.deleteMany({}), Deleted.deleteMany({}), Station.deleteMany({})]);
    student = { _id: new mongoose.Types.ObjectId(), role: 'student', emailVerified: true, name: 'Student', email: 'student@test.invalid', createdAt: at('07:00:00') };
    organizer = { _id: new mongoose.Types.ObjectId(), role: 'organizer', name: 'Organizer', email: 'organizer@test.invalid', createdAt: at('07:00:00') };
    admin = { _id: new mongoose.Types.ObjectId(), role: 'admin', name: 'Administrator', email: 'admin@test.invalid', createdAt: at('07:00:00') };
    await User.collection.insertMany([student, organizer, admin]);
    event = await Event.create({ title: 'Session test', date: '2026-11-08', time: '08:00', endDate: '2026-11-08', endTime: '17:00', attendanceStartTime: '08:00', attendanceEndTime: '08:30', organizer: organizer._id, status: 'live', attendanceSessions: [{ name: 'Morning', timeInOpen: at('08:00:00'), onTimeDeadline: at('08:30:00'), timeInCutoff: at('09:00:00'), timeOutOpen: at('11:00:00'), timeOutClose: at('12:00:00') }, { name: 'Afternoon', timeInOpen: at('13:00:00'), onTimeDeadline: at('13:30:00'), timeInCutoff: at('14:00:00'), timeOutOpen: at('16:00:00'), timeOutClose: at('17:00:00') }] });
  });
  const mark = (action, clock, extra = {}) => service.apply({ event, session: event.attendanceSessions[0], student, action, now: at(clock), ...extra });
  test('concurrent scans produce one entry, one exit and no duplicate hours', async () => {
    const entries = await Promise.all(Array.from({ length: 8 }, () => mark('time_in', '08:10:00')));
    assert.equal(entries.filter(x => x.ok).length, 1);
    assert.equal(await Attendance.countDocuments({}), 1);
    const exits = await Promise.all(Array.from({ length: 8 }, () => mark('time_out', '11:30:00')));
    assert.equal(exits.filter(x => x.ok).length, 1);
    const row = await Attendance.findOne().lean();
    assert.equal(row.completionStatus, 'completed'); assert.equal(row.communityServiceHours, 0);
  });
  test('completion matrix and finalization are idempotent; no early incomplete charge', async () => {
    for (const [clock, complete, hours] of [['08:10:00', true, 0], ['08:45:00', true, 4], ['08:10:00', false, 2], ['08:45:00', false, 6], [null, false, 8]]) {
      await Attendance.deleteMany({});
      if (clock) await mark('time_in', clock);
      if (complete) await mark('time_out', '11:30:00');
      await service.finalize(event, at('11:59:00'));
      const early = await Attendance.findOne({ session: event.attendanceSessions[0]._id }).lean();
      if (clock && !complete) assert.equal(early.completionStatus, 'pending');
      if (!clock) assert.equal(early, null, 'no absence record while Time Out is still open');
      await service.finalize(event, at('12:01:00')); await service.finalize(event, at('12:02:00'));
      const row = await Attendance.findOne({ session: event.attendanceSessions[0]._id }).lean();
      assert.equal(row.communityServiceHours, hours);
      assert.equal(row.sessionPenaltyHours, hours);
    }
  });
  test('premature automatic absence is reversed while exit is open, then finalized once at exit close', async () => {
    const session = event.attendanceSessions[0];
    await Attendance.create({ event: event._id, session: session._id, student: student._id, method: 'auto', status: 'absent', completionStatus: 'absent', sessionPenaltyHours: 8, communityServiceHours: 8 });
    await service.finalize(event, at('11:30:00'));
    let row = await Attendance.findOne().lean();
    assert.equal(row.status, 'pending'); assert.equal(row.communityServiceHours, 0);
    assert.match(row.communityServiceLog.at(-1).note, /Premature/);
    await service.finalize(event, at('11:31:00'));
    assert.equal((await Attendance.findOne()).communityServiceLog.length, row.communityServiceLog.length);
    await service.finalize(event, at('12:01:00'));
    row = await Attendance.findOne().lean(); assert.equal(row.status, 'absent'); assert.equal(row.communityServiceHours, 8);
  });
  test('early absence reconciliation does not overwrite a staff-adjusted balance', async () => {
    await Attendance.create({ event: event._id, session: event.attendanceSessions[0]._id, student: student._id, method: 'auto', status: 'absent', completionStatus: 'absent', sessionPenaltyHours: 8, communityServiceHours: 5 });
    await service.finalize(event, at('11:30:00'));
    assert.equal((await Attendance.findOne()).communityServiceHours, 5);
  });
  test('staff hour reductions survive repeat finalization and delayed exit review', async () => {
    await mark('time_in', '08:45:00'); await service.finalize(event, at('12:01:00'));
    await Attendance.updateOne({}, { $set: { communityServiceHours: 3 } });
    await service.finalize(event, at('12:02:00'));
    assert.equal((await Attendance.findOne()).communityServiceHours, 3);
    const reviewed = await mark('time_out', '11:30:00', { method: 'id_photo', review: { request: new mongoose.Types.ObjectId(), reviewedAt: at('23:00:00'), mode: 'checkin' } });
    assert.equal(reviewed.hours, 1); assert.equal(reviewed.attendance.completionStatus, 'completed');
    assert.equal(+reviewed.attendance.timeInAt, +at('08:45:00'));
  });
  test('an offline exit stays pending until its entry is confirmed, including next-day review', async () => {
    const base = { event: event._id, session: event.attendanceSessions[0]._id, sessionName: 'Morning', student: student._id, requestedBy: organizer._id, source: 'id_photo', mode: 'checkin', reason: 'Offline ID capture', identityChecked: true, captureBasis: 'device', submittedAt: at('12:10:00'), proposedHours: 0, status: 'pending', schedule: { start: at('08:00:00'), deadline: at('08:30:00'), cutoff: at('12:00:00') } };
    const exit = await Request.create({ ...base, action: 'time_out', proposedStatus: 'time_out', effectiveAt: at('11:30:00') });
    const later = new Date('2026-11-09T20:00:00+08:00');
    const review = manual.createService({ Request, Attendance, Event, User, notifyUsers: async () => {} });
    const listedExit = async () => (await review.list(admin, { limit: 1 })).requests[0];
    assert.equal((await listedExit()).timeInReviewState, 'missing');
    await assert.rejects(review.reviewOne(admin, String(exit._id), 'approved', '', later), /no confirmed Time In or pending Time In/);
    const entry = await Request.create({ ...base, submittedAt: at('12:09:00'), action: 'time_in', proposedStatus: 'present', effectiveAt: at('08:10:00') });
    assert.equal((await listedExit()).timeInReviewState, 'pending');
    await assert.rejects(review.reviewOne(admin, String(exit._id), 'approved', '', later), /Time In awaits review/);
    assert.equal((await Request.findById(exit._id)).status, 'pending');
    await review.reviewOne(admin, String(entry._id), 'approved', '', later);
    await review.reviewOne(admin, String(exit._id), 'approved', '', later);
    const row = await Attendance.findOne().lean();
    assert.equal(row.completionStatus, 'completed'); assert.equal(row.communityServiceHours, 0);
    assert.equal(+row.timeInAt, +at('08:10:00')); assert.equal(+row.timeOutAt, +at('11:30:00'));
    await review.reviewOne(admin, String(exit._id), 'approved', '', later);
    assert.equal(await Attendance.countDocuments(), 1);
  });
  test('sessions and legacy rows remain separate; new accounts get no past absence', async () => {
    await Attendance.create({ event: event._id, student: student._id, status: 'late', communityServiceHours: 3 });
    await mark('time_in', '08:10:00');
    await service.apply({ event, session: event.attendanceSessions[1], student, action: 'time_in', now: at('13:10:00') });
    assert.equal(await Attendance.countDocuments(), 3);
    await User.collection.insertOne({ role: 'student', emailVerified: true, email: 'later@test.invalid', createdAt: at('14:30:00') });
    await service.finalize(event, at('18:00:00'));
    assert.equal(await Attendance.countDocuments(), 3);
    assert.equal((await Attendance.findOne({ session: null })).communityServiceHours, 3);
  });
  test('excuses and face records are protected from corrections and finalizer', async () => {
    const result = await mark('time_in', '08:10:00');
    await assert.rejects(mark('absent', '09:00:00', { review: { mode: 'correction', reviewedAt: at('18:00:00') } }), /Face-verified/);
    const exit = await mark('time_out', '11:30:00', { method: 'manual', review: { request: new mongoose.Types.ObjectId(), mode: 'correction', reviewedAt: at('18:00:00'), expectedUpdatedAt: new Date(result.attendance.updatedAt).toISOString() } });
    assert.equal(+exit.attendance.timeInAt, +result.attendance.timeInAt);
    assert.equal(exit.attendance.method, 'face');
    assert.equal(exit.attendance.timeOutMethod, 'manual');
    await Attendance.updateOne({ _id: result.attendance._id }, { $set: { status: 'excused', completionStatus: 'excused', sessionPenaltyHours: 0, communityServiceHours: 0 } });
    await service.finalize(event, at('18:00:00'));
    assert.equal((await Attendance.findById(result.attendance._id)).communityServiceHours, 0);
  });
  test('index migration preserves legacy balances and applies safely twice', async () => {
    const { execFileSync } = require('node:child_process');
    const path = require('node:path');
    await Attendance.create({ event: event._id, student: student._id, status: 'late', communityServiceHours: 3 });
    const before = JSON.stringify(await Attendance.find({}).lean());
    await Attendance.collection.createIndex({ event: 1, student: 1 }, { unique: true, name: 'old_global_attendance' });
    await Request.collection.createIndex({ event: 1, student: 1 }, { unique: true, partialFilterExpression: { status: 'pending' }, name: 'one_pending_manual_request' });
    const command = apply => execFileSync(process.execPath, [path.join(__dirname, '../scripts/migrate-attendance-sessions.js'), ...(apply ? ['--apply'] : [])], { env: { ...process.env, TRACKED_MIGRATION_URI: uri }, encoding: 'utf8' });
    assert.match(command(false), /Dry run complete/);
    assert.ok((await Attendance.collection.indexes()).some(x => x.name === 'old_global_attendance'));
    assert.match(command(true), /Session indexes applied/);
    assert.match(command(true), /Session indexes applied/);
    assert.ok(!(await Attendance.collection.indexes()).some(x => x.name === 'old_global_attendance'));
    assert.equal(JSON.stringify(await Attendance.find({}).lean()), before);
  });
  test('prepared schedules freeze before offline capture without freezing future student eligibility', async () => {
    const stale = await Event.findById(event._id);
    await Promise.all([service.lockSchedule(event, at('07:30:00')), service.lockSchedule(stale, at('07:30:00'))]);
    const saved = await Event.findById(event._id).lean();
    assert.ok(saved.sessionScheduleLockedAt);
    assert.equal(saved.attendanceSessions[0].rosterLockedAt, null);
    assert.equal(saved.attendanceSessions[0].eligibleStudents.length, 0);
    // A stale editor cannot replace the prepared schedule using the old version.
    const result = await Event.updateOne({ _id: event._id, __v: 0 }, { $set: { attendanceSessions: [] } });
    assert.equal(result.modifiedCount, 0);
    await mark('time_in', '08:10:00');
    assert.equal(await Attendance.countDocuments(), 1);
  });
  test('records protect only their own day and leave unused days editable', async () => {
    await mark('time_in', '08:10:00');
    const current = await Event.findById(event._id).lean();
    const locks = await sessionEditLocks(current, at('08:20:00'));
    assert.deepEqual(locks.map(row => row.sessionId), [String(current.attendanceSessions[0]._id)]);
    const next = JSON.parse(JSON.stringify(current.attendanceSessions));
    next[1].timeInOpen = at('12:30:00');
    assert.equal(lockedSessionChange(current.attendanceSessions, next, locks), undefined);
    next[0].timeInOpen = at('07:30:00');
    assert.equal(String(lockedSessionChange(current.attendanceSessions, next, locks)._id), String(current.attendanceSessions[0]._id));
  });
  test('ID preparation protects only its selected session without locking future sessions', async () => {
    const now = at('07:00:00');
    await service.lockSchedule(event, now, event.attendanceSessions[0]._id);
    const current = await Event.findById(event._id).lean();
    assert.equal(current.attendanceSessions[0].capturePreparedUntil.toISOString(), '2026-11-09T23:00:00.000Z');
    assert.equal(current.attendanceSessions[1].capturePreparedUntil, undefined);
    assert.deepEqual((await sessionEditLocks(current, now)).map(row => row.sessionId), [String(current.attendanceSessions[0]._id)]);
    assert.deepEqual(await sessionEditLocks(current, new Date(+now + 49 * 3600000)), []);
  });
  test('stale preparation cannot reserve or capture against an edited unused session', async () => {
    const stale = await Event.findById(event._id);
    await Event.updateOne({ _id: event._id }, { $set: { 'attendanceSessions.1.timeInOpen': at('12:30:00') }, $inc: { __v: 1 } });
    await assert.rejects(service.lockSchedule(stale, at('07:00:00'), stale.attendanceSessions[1]._id), /event changed/);
    assert.equal(await Attendance.countDocuments(), 0);
  });
  test('event API saves unused-day edits, rejects protected-day edits and preserves the attendance row', async () => {
    await mark('time_in', '08:10:00');
    const before = JSON.stringify(await Attendance.find({}).lean());
    const router = require('../routes/eventRoutes');
    const handler = router.stack.find(layer => layer.route?.path === '/:id' && layer.route.methods.put).route.stack.at(-1).handle;
    const put = async body => {
      const result = { status: 200 };
      await handler({ params: { id: String(event._id) }, user: admin, body }, { status(code) { result.status = code; return this; }, json(data) { result.body = data; return this; } });
      return result;
    };
    const rows = JSON.parse(JSON.stringify((await Event.findById(event._id)).attendanceSessions));
    rows[1].timeInOpen = at('12:30:00');
    assert.equal((await put({ attendanceSessions: rows })).status, 200);
    const saved = await Event.findById(event._id);
    assert.equal(+saved.attendanceSessions[1].timeInOpen, +at('12:30:00'));
    rows[0].timeInOpen = at('07:30:00');
    assert.equal((await put({ attendanceSessions: rows })).status, 409);
    assert.equal((await put({ time: '08:15' })).status, 409);
    assert.equal(JSON.stringify(await Attendance.find({}).lean()), before);
  });
});

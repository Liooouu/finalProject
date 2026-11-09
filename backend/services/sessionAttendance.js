// A session's automatic penalty is tracked separately from its adjusted balance.
// Optimistic writes serialize scans, finalization and reviews without requiring
// replica-set transactions on installations using standalone MongoDB.
const Attendance = require('../models/Attendance');
const Event = require('../models/Event');
const User = require('../models/User');
const DeletedAttendance = require('../models/DeletedAttendance');
const ManualAttendanceRequest = require('../models/ManualAttendanceRequest');
const { activeStudentFilter } = require('./studentEligibility');
const { classify } = require('./penaltyCalc');
const { publishRecordChange } = require('./recordUpdates');
const id = value => String(value?._id || value || '');
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };

function sessionFor(event, sessionId, { required = true } = {}) {
  const sessions = event?.attendanceSessions || [];
  const session = sessions.find(row => id(row) === id(sessionId));
  if (sessions.length && !session) fail(400, 'Choose a valid attendance session for this event.');
  if (!sessions.length && sessionId) fail(400, 'This event uses Time In only.');
  if (required && !sessions.length) fail(400, 'This event uses Time In only.');
  return session || null;
}
function modeFor(event, session, now = new Date()) {
  if (!session || event?.status === 'closed') return 'closed';
  if ((event?.status !== 'finished' || session.timeInPolicy === 'window_then_late') && +now >= +new Date(session.timeInOpen) && +now <= +new Date(session.timeInCutoff)) return 'time_in';
  if (+now >= +new Date(session.timeOutOpen) && +now <= +new Date(session.timeOutClose)) return 'time_out';
  return 'closed';
}
function contribution(record) {
  if (Number.isFinite(record?.sessionPenaltyHours)) return record.sessionPenaltyHours;
  if (record?.status === 'excused') return 0;
  if (record?.status === 'absent') return 8;
  return (record?.arrivalStatus === 'late' || record?.status === 'late' ? 4 : 0)
    + (record?.completionStatus === 'incomplete' ? 2 : 0);
}
function penaltyChange(record, result) {
  const delta = result.hours - contribution(record);
  return { delta, hours: Math.max(0, (record?.communityServiceHours || 0) + delta) };
}
function versionFilter(record) {
  return { _id: record._id, communityServiceHours: record.communityServiceHours ?? null,
    ...(record.updatedAt ? { updatedAt: record.updatedAt } : { updatedAt: { $exists: false } }),
    ...(record.__v === undefined ? {} : { __v: record.__v }) };
}
async function lockSchedule(event, now = new Date(), sessionId = null, { prepareForMs = 48 * 60 * 60 * 1000 } = {}) {
  if (event.sessionScheduleLockedAt && !sessionId) return;
  const target = sessionId ? sessionFor(event, sessionId) : null;
  const until = target ? new Date(Math.max(+new Date(target.capturePreparedUntil || 0), +now + prepareForMs)) : null;
  const saved = await Event.findOneAndUpdate({ _id: event._id, __v: event.__v === undefined ? { $exists: false } : event.__v,
    ...(target ? { 'attendanceSessions._id': target._id } : {}) },
    { $set: { sessionScheduleLockedAt: event.sessionScheduleLockedAt || now, ...(target ? { 'attendanceSessions.$.capturePreparedUntil': until } : {}) }, $inc: { __v: 1 } }, { new: true }).lean();
  const current = saved || await Event.findById(event._id).lean();
  const currentTarget = target && current?.attendanceSessions?.find(row => id(row) === id(target));
  const config = require('./sessionSchedule').sessionConfig;
  if (!current?.sessionScheduleLockedAt || (target
    ? !currentTarget || config([currentTarget]) !== config([target]) || +new Date(currentTarget.capturePreparedUntil || 0) < +until
    : config(current.attendanceSessions) !== config(event.attendanceSessions))) fail(409, 'The event changed while preparing attendance. Reload before continuing.');
  event.sessionScheduleLockedAt = current.sessionScheduleLockedAt;
  event.__v = current.__v;
  if (target) target.capturePreparedUntil = currentTarget.capturePreparedUntil;
}
async function lockRoster(event, session, now = new Date()) {
  if (session.rosterLockedAt) return session;
  if (+now < +new Date(session.timeInOpen)) return session;
  await lockSchedule(event, now, session._id, { prepareForMs: 30000 });
  const rows = await User.find({ ...activeStudentFilter(), createdAt: { $lte: new Date(session.timeInOpen) } }).select('_id').lean();
  await Event.updateOne({ _id: event._id, __v: event.__v, attendanceSessions: { $elemMatch: { _id: session._id, rosterLockedAt: null } } },
    { $set: { 'attendanceSessions.$.eligibleStudents': rows.map(row => row._id), 'attendanceSessions.$.rosterLockedAt': now }, $inc: { __v: 1 } });
  const fresh = await Event.findById(event._id).lean();
  const locked = sessionFor(fresh, session._id);
  if (!locked.rosterLockedAt || require('./sessionSchedule').sessionConfig([locked]) !== require('./sessionSchedule').sessionConfig([session])) fail(409, 'This day changed while attendance was starting. Refresh and try again.');
  event.__v = fresh.__v;
  session.eligibleStudents = locked.eligibleStudents;
  session.rosterLockedAt = locked.rosterLockedAt;
  return session;
}
async function notice(event, session, record, action, finalizing, method) {
  // Manual/ID reviews send their own confirmation after the request receipt.
  if (!finalizing && method !== 'face') return;
  if (!finalizing && action === 'time_in' && record.arrivalStatus !== 'late') return;
  if (finalizing && await ManualAttendanceRequest.exists({
    event: event._id, session: session._id, student: record.student, status: 'pending',
    ...(record.completionStatus === 'incomplete' ? { action: 'time_out' } : { action: { $ne: 'time_out' } }),
  })) return;
  const label = finalizing ? record.completionStatus === 'absent' ? 'Absence recorded' : 'Time Out missing' : action === 'time_out' ? 'Time Out recorded' : 'Late Time In recorded';
  await require('./notify').notifyUsers([record.student], { type: 'attendance', title: label,
    message: !finalizing && action === 'time_out' && !record.arrivalStatus
      ? `${event.title} · ${session.name}: Time Out recorded. No Time In on record.`
      : `${event.title} · ${session.name}: ${label}. Automatic session penalty: ${record.sessionPenaltyHours} hours. Your ledger shows any approved adjustments.`,
    relatedEvent: event._id, event, deferEmail: true }).catch(() => {});
}
async function apply({ event, session, student, action, now = new Date(), method = 'face', matchDistance = null,
  checkInSession = null, review = null, finalizing = false }) {
  if (!event || !session || !student) return { ok: false, reason: 'not-found' };
  session = sessionFor(event, session._id);
  if (!review && !finalizing && modeFor(event, session, now) !== action) return { ok: false, reason: 'closed' };
  if (!['time_in', 'time_out', 'absent'].includes(action)) fail(400, 'Invalid attendance action.');
  if (action === 'absent' && !finalizing && !review) fail(403, 'Absence requires finalization or independent review.');
  if (!finalizing) {
    const low = action === 'time_out' ? session.timeOutOpen : session.timeInOpen;
    const high = action === 'time_out' ? session.timeOutClose : session.timeInCutoff;
    if (action !== 'absent' && (+now < +new Date(low) || +now > +new Date(high))) fail(400, 'The effective capture time is outside this session window.');
  }
  // Review time must not replace effective capture time, or decide eligibility.
  const roster = finalizing && event.status === 'closed' && !session.rosterLockedAt
    ? session : await lockRoster(event, session, review?.reviewedAt || now);
  const eligible = roster.rosterLockedAt
    ? (roster.eligibleStudents || []).some(value => id(value) === id(student))
    : !(finalizing && event.status === 'closed');
  const pair = { event: event._id, session: session._id, student: student._id || student };
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await Attendance.findOne(pair).lean();
    // Preserve confirmed evidence even if an older roster omitted the student.
    if (!eligible && !(finalizing && existing?.timeInAt)) {
      return { ok: false, reason: 'ineligible', message: 'This account is not on the session attendance roster.' };
    }
    if (finalizing && +now <= +new Date(session.timeOutClose) &&
        (!existing || existing.method !== 'auto' || existing.timeInAt || existing.status !== 'absent' ||
         existing.communityServiceHours !== contribution(existing) || existing.manualAttendanceAudit?.length)) return { ok: false, reason: 'already', attendance: existing };
    if (finalizing && existing?.status === 'excused') return { ok: false, reason: 'already', attendance: existing };
    if (existing?.status === 'excused') fail(409, 'An approved excuse protects this session. Review the excuse before changing attendance.');
    if (review && existing?.manualAttendanceAudit?.some(item => id(item.request) === id(review.request))) return { ok: true, attendance: existing, status: existing.status, hours: existing.communityServiceHours, action };
    if (finalizing && existing?.timeInAt && (existing.timeOutAt || +now <= +new Date(session.timeOutClose))) return { ok: false, reason: 'already', attendance: existing };
    // A verified exit does not prevent an independent correction for a missing entry.
    const fillsMissingEntry = action === 'time_in' && !existing?.timeInAt && !!existing?.timeOutAt;
    const verifiedExit = existing?.timeOutAt && (existing.timeOutMethod === 'face' || existing.method === 'face');
    const protectedAction = action === 'time_out' ? verifiedExit
      : (existing?.method === 'face' && !fillsMissingEntry) || (action === 'absent' && verifiedExit);
    if (review?.mode === 'correction' && protectedAction) fail(409, 'Face-verified attendance cannot be overwritten by a correction.');
    if (review?.mode === 'correction' && existing && existing.method !== 'auto' && !fillsMissingEntry && review.expectedUpdatedAt !== (existing.updatedAt ? new Date(existing.updatedAt).toISOString() : null)) fail(409, 'Attendance changed after this correction was submitted.');
    const field = action === 'time_out' ? 'timeOutAt' : 'timeInAt';
    if (!finalizing && action !== 'absent' && existing?.[field]) {
      if (!review || review.mode !== 'correction') return { ok: false, reason: 'already', attendance: existing };
      if (review.expectedUpdatedAt !== (existing.updatedAt ? new Date(existing.updatedAt).toISOString() : null)) fail(409, 'Attendance changed after this correction was submitted. Refresh and submit a new correction.');
    }
    const timeInAt = action === 'time_in' && !finalizing ? now : existing?.timeInAt || null;
    const timeOutAt = action === 'time_out' ? now : existing?.timeOutAt || null;
    if (action === 'absent' && existing?.timeInAt && !review && !finalizing) return { ok: false, reason: 'already', attendance: existing };
    const effectiveIn = action === 'absent' && !finalizing ? null : timeInAt;
    const effectiveOut = action === 'absent' && !finalizing ? null : timeOutAt;
    const evaluatedAt = review?.reviewedAt || now;
    const result = classify({ timeInAt: effectiveIn, timeOutAt: effectiveOut, session, now: evaluatedAt });
    const changed = existing ? penaltyChange(existing, result) : { delta: result.hours, hours: result.hours };
    const status = !result.arrivalStatus && result.completionStatus === 'pending' ? 'pending' : result.completionStatus === 'absent' ? 'absent' : result.arrivalStatus === 'late' ? 'late' : 'present';
    const audit = review ? { request: review.request, requestedBy: review.requestedBy, reviewedBy: review.reviewedBy,
      submittedAt: review.submittedAt, effectiveAt: now, reviewedAt: review.reviewedAt, action,
      reason: review.reason, reviewNote: review.note, previousStatus: existing?.status || 'unrecorded', nextStatus: status,
      previousHours: existing?.communityServiceHours || 0, nextHours: changed.hours } : null;
    const changes = { ...pair, sessionName: session.name, timeInAt: effectiveIn, timeOutAt: effectiveOut,
      arrivalStatus: result.arrivalStatus, completionStatus: result.completionStatus, sessionPenaltyHours: result.hours,
      status, communityServiceHours: changed.hours,
      attendedAt: effectiveIn || new Date(session.timeInCutoff) };
    if (!finalizing) Object.assign(changes, { verifiedAt: review?.reviewedAt || now,
      // Preserve the original face entry when a fallback captures only the exit.
      method: existing?.timeInAt && action === 'time_out' ? existing.method : method,
      ...(action === 'time_in' ? { matchDistance, checkInSession } : action === 'time_out' ? { timeOutMethod: method, timeOutStation: checkInSession, timeOutDistance: matchDistance } : {}),
      ...(review ? { manualAttendanceRequest: review.request } : {}) });
    else if (!existing) changes.method = 'auto';
    const log = changed.delta ? { action: changed.delta > 0 ? 'penalty' : 'removed', hours: Math.abs(changed.delta), at: new Date(),
      note: `${finalizing ? result.completionStatus === 'pending' ? 'Premature automatic absence reversed' : 'Session finalized' : action === 'time_out' ? 'Time Out recorded' : 'Time In recorded'} (${session.name})` } : null;
    if (existing) {
      if (finalizing && existing.completionStatus === result.completionStatus && contribution(existing) === result.hours) return { ok: false, reason: 'already', attendance: existing };
      const update = { $set: changes, $inc: { __v: 1 } };
      if (log || audit) update.$push = { ...(log ? { communityServiceLog: log } : {}), ...(audit ? { manualAttendanceAudit: audit } : {}) };
      const saved = await Attendance.findOneAndUpdate(versionFilter(existing), update, { new: true }).lean();
      if (!saved) continue;
      publishRecordChange();
      if (result.arrivalStatus || result.completionStatus !== 'pending') await notice(event, session, saved, action, finalizing, method);
      return { ok: true, attendance: saved, status, hours: saved.communityServiceHours, action, completionStatus: result.completionStatus };
    }
    try {
      const saved = await Attendance.create({ ...changes, communityServiceLog: log ? [log] : [], manualAttendanceAudit: audit ? [audit] : [] });
      publishRecordChange();
      if (result.arrivalStatus || result.completionStatus !== 'pending') await notice(event, session, saved, action, finalizing, method);
      return { ok: true, attendance: saved, status, hours: saved.communityServiceHours, action, completionStatus: result.completionStatus };
    } catch (error) {
      if (error.code !== 11000) throw error;
      if (!await Attendance.exists(pair)) fail(503, 'Session attendance indexes need migration. Your capture has not been discarded; contact the administrator.');
    }
  }
  fail(409, 'Attendance changed concurrently. Retry the same action safely.');
}
async function finalize(event, now = new Date()) {
  for (let session of event.attendanceSessions || []) {
    if (+now < +new Date(session.timeInOpen)) continue;
    const manuallyClosedWithoutRoster = event.status === 'closed' && !session.rosterLockedAt;
    if (!manuallyClosedWithoutRoster) session = await lockRoster(event, session, now);
    if (+now <= +new Date(session.timeInCutoff)) continue;
    const [removed, rows] = await Promise.all([
      DeletedAttendance.find({ event: event._id, $or: [{ session: session._id }, { 'record.session': session._id }] }).distinct('student'),
      Attendance.find({ event: event._id, session: session._id }).select('student status method timeInAt timeOutAt completionStatus sessionPenaltyHours arrivalStatus reportDeletedAt').lean(),
    ]);
    const deleted = new Set(removed.map(id));
    const existing = new Map(rows.map(row => [id(row.student), row]));
    const candidates = new Set((session.eligibleStudents || []).map(id));
    for (const row of rows) if (row.timeInAt) candidates.add(id(row.student));
    for (const student of candidates) {
      const record = existing.get(id(student));
      if (deleted.has(id(student)) || record?.reportDeletedAt || record?.status === 'excused' || (record?.timeInAt && record.timeOutAt)) continue;
      if (+now <= +new Date(session.timeOutClose)) {
        // Reconcile only premature automatic absence from the old cutoff rule.
        // apply() records the delta and preserves existing staff balance changes.
        if (record?.method === 'auto' && record.status === 'absent' && !record.timeInAt) {
          await apply({ event, session, student: { _id: student }, action: 'absent', now, finalizing: true });
        }
        continue;
      }
      if (record && !record.timeInAt && record.status === 'absent' && contribution(record) === 8) continue;
      if (record?.timeInAt && record.completionStatus === 'incomplete' && contribution(record) === (record.arrivalStatus === 'late' ? 6 : 2)) continue;
      await apply({ event, session, student: { _id: student }, action: 'absent', now, finalizing: true });
    }
  }
}
module.exports = { apply, finalize, sessionFor, modeFor, contribution, penaltyChange, versionFilter, lockRoster, lockSchedule };

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const jpeg = require('jpeg-js');
const { isValidObjectId } = require('mongoose');
const Event = require('../models/Event');
const User = require('../models/User');
const Request = require('../models/ManualAttendanceRequest');
const Attendance = require('../models/Attendance');
const fileStore = require('./fileStore');
const manual = require('./manualAttendance');
const { activeStudentFilter, isActiveStudent } = require('./studentEligibility');
const { eventWindow, eventLastCheckInAt, isTerminal } = require('./eventLifecycle');

const id = value => String(value?._id || value || '');
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const sessionAttendance = require('./sessionAttendance');
const RETENTION = 30 * 24 * 60 * 60 * 1000;
function findSession(event, sessionId) { return sessionAttendance.sessionFor(event, sessionId, { required: false }); }
function scheduleFor(event, session = null, action = 'time_in') {
  if (session) {
    if (action === 'time_out') {
      const open = +new Date(session.timeOutOpen), close = +new Date(session.timeOutClose);
      if (!Number.isFinite(open) || !Number.isFinite(close)) fail(400, 'This session has no valid Time Out window.');
      return { start: open, deadline: close, cutoff: close, action: 'time_out', sessionId: String(session._id) };
    }
    const open = +new Date(session.timeInOpen), deadline = +new Date(session.onTimeDeadline), cutoff = +new Date(session.timeInCutoff);
    if (!Number.isFinite(open) || !Number.isFinite(deadline) || !Number.isFinite(cutoff)) fail(400, 'This session has no valid Time In window.');
    return { start: open, deadline, cutoff, action: 'time_in', sessionId: String(session._id) };
  }
  const window = eventWindow(event), cutoff = eventLastCheckInAt(event);
  if (!window || !cutoff) fail(400, 'This event has no valid attendance period.');
  return { start: +window.start, deadline: +window.end, cutoff: +cutoff, action: 'time_in', sessionId: null };
}
function signature(event, session = null, action = 'time_in') {
  return crypto.createHash('sha256').update(JSON.stringify({ ...scheduleFor(event, session, action) })).digest('hex');
}
function organizer(user) {
  if (user?.role !== 'organizer') fail(403, 'Only organizers can capture ID-assisted attendance.');
}
async function loadEvent(eventId) {
  if (!isValidObjectId(eventId)) fail(400, 'Choose a valid event.');
  const event = await Event.findById(eventId);
  if (!event) fail(404, 'Event not found.');
  return event;
}
function ticket(user, event, studentId, now, sessionId = null, action = 'time_in') {
  const session = findSession(event, sessionId);
  const sched = scheduleFor(event, session, action);
  return jwt.sign({ purpose: 'id-attendance', kind: studentId ? 'capture' : 'offline', operator: id(user), eventId: id(event),
    studentId: studentId || null, issuedMs: +now, schedule: sched, signature: signature(event, session, action),
    sessionId: sessionId || null, action, sessionVersion: user.sessionVersion || 0, organizerVersion: user.organizerAccessVersion || 0 },
  process.env.JWT_SECRET, { audience: 'tracked-id-attendance', expiresIn: '48h' });
}
function verifyTicket(token, user, now = new Date()) {
  let data;
  try { data = jwt.verify(token, process.env.JWT_SECRET, { audience: 'tracked-id-attendance', clockTimestamp: Math.floor(+now / 1000) }); }
  catch { fail(409, 'This capture session expired or is invalid. Keep the photo and use a documented correction.'); }
  if (data.purpose !== 'id-attendance' || data.operator !== id(user) || data.sessionVersion !== (user.sessionVersion || 0)
      || data.organizerVersion !== (user.organizerAccessVersion || 0)) fail(403, 'This capture session belongs to a different or revoked organizer session.');
  return data;
}
function proposalFromTicket(data, payload, now = new Date()) {
  const basis = data.kind === 'capture' ? 'server' : 'device';
  const effectiveAt = new Date(basis === 'server' ? data.issuedMs : payload.capturedAt);
  if (!Number.isFinite(+effectiveAt) || +effectiveAt < data.issuedMs || +effectiveAt > +now + 15000) fail(400, 'The capture time is inconsistent. Keep the photo and request a documented correction.');
  if (+effectiveAt < data.schedule.start || +effectiveAt > data.schedule.cutoff) fail(400, 'This capture is outside the event attendance period.');
  const action = data.action || 'time_in';
  if (action === 'time_out') {
    return { captureBasis: basis, effectiveAt, action: 'time_out', sessionId: data.sessionId || null,
      proposedStatus: 'time_out', proposedHours: 0,
      schedule: { start: new Date(data.schedule.start), deadline: new Date(data.schedule.deadline), cutoff: new Date(data.schedule.cutoff) } };
  }
  const status = +effectiveAt <= data.schedule.deadline ? 'present' : 'late';
  return { captureBasis: basis, effectiveAt, action: 'time_in', sessionId: data.sessionId || null, proposedStatus: status, proposedHours: status === 'late' ? 4 : 0,
    schedule: { start: new Date(data.schedule.start), deadline: new Date(data.schedule.deadline), cutoff: new Date(data.schedule.cutoff) } };
}
function safePhoto(file) {
  if (!file?.buffer?.length || file.buffer.length > 3 * 1024 * 1024 || file.mimetype !== 'image/jpeg') fail(400, 'Capture a JPEG ID photo up to 3 MB.');
  try {
    const decoded = jpeg.decode(file.buffer, { useTArray: true, maxResolutionInMP: 6, maxMemoryUsageInMB: 64 });
    if (decoded.width < 200 || decoded.height < 120 || decoded.width > 4000 || decoded.height > 4000) fail(400, 'The ID photo is too small or too large. Retake it closer to the camera.');
    return jpeg.encode(decoded, 85).data; // Re-encode; do not retain EXIF/location metadata.
  } catch (error) { if (error.status) throw error; fail(400, 'The photo is unreadable. Retake a clear JPEG image.'); }
}
function preparationState(event, now = new Date(), session = null) {
  if (session) {
    const mode = sessionAttendance.modeFor(event, session, now);
    const closed = event.status === 'closed' || +now > +new Date(session.timeOutClose);
    return { available: !closed, mode, state: closed ? 'closed' : mode === 'closed' ? 'before' : 'open', schedule: scheduleFor(event, session, mode === 'time_out' ? mode : 'time_in'), message: closed ? 'This attendance session is closed. Corrections remain available from records.' : '' };
  }
  let schedule;
  try { schedule = scheduleFor(event); }
  catch (error) {
    if (error.status !== 400) throw error;
    return { available: false, state: 'invalid_schedule', message: 'This event has no valid attendance period. Ask an administrator or organizer to correct its schedule.' };
  }
  if (isTerminal(event.status) || +now > schedule.cutoff) return { available: false, state: 'closed', schedule,
    message: 'Attendance is closed for this event. View attendance records to request a documented correction, or choose another event.' };
  return { available: true, state: +now < schedule.start ? 'before' : 'open', schedule };
}
async function prepare(user, eventId, now = new Date(), sessionId = null) {
  organizer(user);
  const event = await loadEvent(eventId);
  manual.requireManualAssignment(user, event);
  const session = findSession(event, sessionId);
  const state = preparationState(event, now, session);
  const details = { event: { _id: event._id, title: event.title, date: event.date, status: event.status, time: event.time, attendanceStartTime: event.attendanceStartTime, attendanceEndTime: event.attendanceEndTime },
    ...state, sessionId: session?._id || null, sessionName: session?.name || "", serverTime: now.toISOString() };
  // A valid event with a closed/missing schedule is an expected UI state, not a bad request.
  // Keep the offline upload queue usable, but issue no new ticket or student roster.
  if (!state.available) return details;
  if (session) await sessionAttendance.lockSchedule(event, now, session._id);
  const students = await User.find({ ...activeStudentFilter(), ...(session ? { createdAt: { $lte: new Date(session.timeInOpen) } } : {}), _id: { $ne: user._id } }).select('name email program yearLevel section').sort({ name: 1 }).lean();
  return { ...details, students, ticket: ticket(user, event, null, now, session?._id, 'time_in'), ...(session ? { tickets: { time_in: ticket(user, event, null, now, session._id, 'time_in'), time_out: ticket(user, event, null, now, session._id, 'time_out') } } : {}) };
}
async function captureTime(user, payload, now = new Date()) {
  organizer(user);
  const event = await loadEvent(payload.eventId);
  manual.requireManualAssignment(user, event);
  if (!isValidObjectId(payload.studentId) || id(user) === id(payload.studentId)) fail(400, 'Choose another student.');
  const student = await User.findById(payload.studentId).select('role enrollmentStatus emailVerified');
  if (!isActiveStudent(student)) fail(400, 'Choose an active, verified student account.');
  const session = findSession(event, payload.sessionId);
  const action = payload.action || 'time_in';
  if (!['time_in','time_out'].includes(action) || (!session && action !== 'time_in')) fail(400, 'Choose a valid attendance action.');
  const schedule = scheduleFor(event, session, action);
  if ((session ? sessionAttendance.modeFor(event, session, now) !== action : isTerminal(event.status)) || +now < schedule.start || +now > schedule.cutoff) fail(400, 'The attendance period is not open.');
  return { ticket: ticket(user, event, payload.studentId, now, session?._id, action), serverTime: now.toISOString() };
}
function receipt(request) {
  return { requestId: request._id, status: request.status, attendanceStatus: request.proposedStatus, action: request.action || 'time_in', sessionName: request.sessionName,
    effectiveAt: request.effectiveAt, captureBasis: request.captureBasis,
    message: request.status === 'approved' ? 'ID-assisted attendance recorded.' : request.status === 'rejected' ? 'This submission was rejected. No new attendance was recorded.' : request.action === 'time_out' ? 'Time Out photo sent for admin review.' : 'Time In photo sent for admin review.' };
}
async function submit(user, payload, file, now = new Date()) {
  organizer(user);
  if (!/^[0-9a-f-]{36}$/i.test(payload.clientId || '') || !isValidObjectId(payload.studentId)) fail(400, 'A valid capture and student are required.');
  if (id(user) === id(payload.studentId)) fail(403, 'Another organizer must handle your attendance.');
  if (payload.identityChecked !== 'true' && payload.identityChecked !== true) fail(400, 'Confirm you compared the student with their physical school ID.');
  let previousUpload = await Request.findOne({ requestedBy: user._id, clientId: payload.clientId });
  if (previousUpload) {
    if (id(previousUpload.student) !== id(payload.studentId)) fail(409, 'This capture was already used for another student.');
    return receipt(previousUpload);
  }
  const data = verifyTicket(payload.ticket, user, now);
  if (data.kind === 'capture' && data.studentId !== payload.studentId) fail(403, 'The capture belongs to another student.');
  const event = await loadEvent(data.eventId);
  manual.requireManualAssignment(user, event);
  const student = await User.findById(payload.studentId).select('role enrollmentStatus emailVerified');
  if (!isActiveStudent(student)) fail(400, 'This student is no longer eligible for new attendance.');
  const selected = findSession(event, data.sessionId);
  const proposal = proposalFromTicket(data, payload, now);
  if (selected) { proposal.session = selected._id; proposal.sessionName = selected.name; }
  const previous = await Attendance.findOne({ event: event._id, student: student._id, ...(selected ? { session: selected._id } : { session: null }) }).lean();
  if (selected && previous?.status !== 'excused' && previous?.[data.action === 'time_out' ? 'timeOutAt' : 'timeInAt']) {
    if (data.action !== 'time_out' && previous.status !== proposal.proposedStatus) fail(409, 'The existing arrival differs. Use a documented correction.');
    return { status: 'approved', alreadyRecorded: true, action: proposal.action, attendanceStatus: previous.status, effectiveAt: previous[data.action === 'time_out' ? 'timeOutAt' : 'timeInAt'], message: 'This session action is already recorded.' };
  }
  if (selected ? previous?.status === 'excused' : previous?.method === 'face' || ['present', 'late', 'excused'].includes(previous?.status)) fail(409, 'Attendance is already recorded. No photo or duplicate attendance was saved.');
  const pendingKey = { event: event._id, student: student._id, session: selected?._id || null, status: 'pending',
    ...(proposal.action === 'time_out' ? { action: 'time_out' } : { $or: [{ action: 'time_in' }, { action: { $exists: false } }] }) };
  const pendingConflict = () => fail(409, `A ${proposal.action === 'time_out' ? 'Time Out' : 'Time In'} request already awaits review for this student and attendance period.`);
  if (await Request.exists(pendingKey)) {
    previousUpload = await Request.findOne({ requestedBy: user._id, clientId: payload.clientId, student: student._id });
    if (previousUpload) return receipt(previousUpload);
    pendingConflict();
  }
  const buffer = safePhoto(file);
  const digest = crypto.createHash('sha256').update(buffer).digest('hex');
  const reusedPhoto = await Request.exists({ event: event._id, source: 'id_photo', photoDigest: digest, student: { $ne: student._id } });
  const saved = await fileStore.saveBuffer(buffer, { private: true, originalName: 'attendance-id.jpg', contentType: 'image/jpeg' });
  let request;
  try {
    manual.requireManualAssignment(user, await Event.findById(event._id).select('manualAttendanceReviewers'));
    request = await Request.create({ ...proposal, event: event._id, student: student._id, requestedBy: user._id,
      source: 'id_photo', mode: 'checkin', clientId: payload.clientId, idPhotoUrl: saved.url,
      photoDigest: digest, photoScheduleSignature: data.signature,
      photoExpiresAt: new Date(+now + RETENTION), receivedAt: now, submittedAt: now, identityChecked: true,
      reason: reusedPhoto ? 'ID image reused for another student; independent confirmation required.' : proposal.captureBasis === 'device' ? 'Physical school ID checked; offline capture time needs independent confirmation.' : 'Physical school ID checked; face scanner fallback.',
      previousAttendance: manual.fingerprint(previous), status: 'pending' });
  } catch (error) {
    await fileStore.deleteByUrl(saved.url).catch(() => {});
    if (error.code === 11000) {
      previousUpload = await Request.findOne({ requestedBy: user._id, clientId: payload.clientId });
      if (previousUpload) {
        if (id(previousUpload.student) !== id(student)) fail(409, 'This capture was already used for another student.');
        return receipt(previousUpload);
      }
      if (await Request.exists(pendingKey)) pendingConflict();
      if (error.keyPattern?.event && error.keyPattern?.student && !error.keyPattern.session) {
        fail(503, 'An old database index blocks separate Time In and Time Out requests. Contact the administrator to run the session attendance migration.');
      }
    }
    throw error;
  }
  return receipt(request);
}
async function cleanup(now = new Date()) {
  const expired = await Request.find({ idPhotoUrl: { $ne: '' }, photoExpiresAt: { $lte: now } }).select('idPhotoUrl').limit(100).lean();
  for (const row of expired) {
    await fileStore.deleteByUrl(row.idPhotoUrl);
    await Request.updateOne({ _id: row._id, idPhotoUrl: row.idPhotoUrl }, { $set: { idPhotoUrl: '', photoDeletedAt: now } });
  }
}
module.exports = { prepare, captureTime, submit, cleanup, proposalFromTicket, safePhoto, verifyTicket, preparationState };

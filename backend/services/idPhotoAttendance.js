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
const RETENTION = 30 * 24 * 60 * 60 * 1000;
function scheduleFor(event) {
  const window = eventWindow(event), cutoff = eventLastCheckInAt(event);
  if (!window || !cutoff) fail(400, 'This event has no valid attendance period.');
  return { start: +window.start, deadline: +window.end, cutoff: +cutoff };
}
function signature(event) {
  return crypto.createHash('sha256').update(JSON.stringify({ ...scheduleFor(event), status: event.status })).digest('hex');
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
function ticket(user, event, studentId, now) {
  return jwt.sign({ purpose: 'id-attendance', kind: studentId ? 'capture' : 'offline', operator: id(user), eventId: id(event),
    studentId: studentId || null, issuedMs: +now, schedule: scheduleFor(event), signature: signature(event),
    sessionVersion: user.sessionVersion || 0, organizerVersion: user.organizerAccessVersion || 0 },
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
  const status = +effectiveAt <= data.schedule.deadline ? 'present' : 'late';
  return { captureBasis: basis, effectiveAt, proposedStatus: status, proposedHours: status === 'late' ? 4 : 0,
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
function preparationState(event, now = new Date()) {
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
async function prepare(user, eventId, now = new Date()) {
  organizer(user);
  const event = await loadEvent(eventId);
  const state = preparationState(event, now);
  const details = { event: { _id: event._id, title: event.title, date: event.date, status: event.status, time: event.time, attendanceStartTime: event.attendanceStartTime, attendanceEndTime: event.attendanceEndTime },
    ...state, serverTime: now.toISOString() };
  // A valid event with a closed/missing schedule is an expected UI state, not a bad request.
  // Keep the offline upload queue usable, but issue no new ticket or student roster.
  if (!state.available) return details;
  const students = await User.find({ ...activeStudentFilter(), _id: { $ne: user._id } }).select('name email program yearLevel section').sort({ name: 1 }).lean();
  return { ...details, students, ticket: ticket(user, event, null, now) };
}
async function captureTime(user, payload, now = new Date()) {
  organizer(user);
  const event = await loadEvent(payload.eventId);
  if (!isValidObjectId(payload.studentId) || id(user) === id(payload.studentId)) fail(400, 'Choose another student.');
  const student = await User.findById(payload.studentId).select('role enrollmentStatus emailVerified');
  if (!isActiveStudent(student)) fail(400, 'Choose an active, verified student account.');
  const schedule = scheduleFor(event);
  if (isTerminal(event.status) || +now < schedule.start || +now > schedule.cutoff) fail(400, 'The attendance period is not open.');
  return { ticket: ticket(user, event, payload.studentId, now), serverTime: now.toISOString() };
}
async function receipt(request, user, now) {
  // A retry after a successful write must not apply attendance twice.
  if (request.status === 'pending' && request.captureBasis === 'server') {
    const event = await Event.findById(request.event);
    if (event && signature(event) === request.photoScheduleSignature) {
      try { await manual.applyPhoto(user, request._id, now); }
      catch (error) { if (!error.status || error.status >= 500) throw error; }
      request = await Request.findById(request._id);
    }
  }
  return { requestId: request._id, status: request.status, attendanceStatus: request.proposedStatus,
    effectiveAt: request.effectiveAt, captureBasis: request.captureBasis,
    message: request.status === 'approved' ? 'ID-assisted attendance recorded.' : request.status === 'rejected' ? 'This submission was rejected. No new attendance was recorded.' : 'Photo received. Independent review is needed for the capture time, changed event, or conflicting attendance.' };
}
async function submit(user, payload, file, now = new Date()) {
  organizer(user);
  if (!/^[0-9a-f-]{36}$/i.test(payload.clientId || '') || !isValidObjectId(payload.studentId)) fail(400, 'A valid capture and student are required.');
  if (id(user) === id(payload.studentId)) fail(403, 'Another organizer must handle your attendance.');
  if (payload.identityChecked !== 'true' && payload.identityChecked !== true) fail(400, 'Confirm you compared the student with their physical school ID.');
  let previousUpload = await Request.findOne({ requestedBy: user._id, clientId: payload.clientId });
  if (previousUpload) {
    if (id(previousUpload.student) !== id(payload.studentId)) fail(409, 'This capture was already used for another student.');
    return receipt(previousUpload, user, now);
  }
  const data = verifyTicket(payload.ticket, user, now);
  if (data.kind === 'capture' && data.studentId !== payload.studentId) fail(403, 'The capture belongs to another student.');
  const event = await loadEvent(data.eventId);
  const student = await User.findById(payload.studentId).select('role enrollmentStatus emailVerified');
  if (!isActiveStudent(student)) fail(400, 'This student is no longer eligible for new attendance.');
  const proposal = proposalFromTicket(data, payload, now);
  const previous = await Attendance.findOne({ event: event._id, student: student._id }).lean();
  if (previous?.method === 'face' || ['present', 'late', 'excused'].includes(previous?.status)) fail(409, 'Attendance is already recorded. No photo or duplicate attendance was saved.');
  const buffer = safePhoto(file);
  const digest = crypto.createHash('sha256').update(buffer).digest('hex');
  const reusedPhoto = await Request.exists({ event: event._id, source: 'id_photo', photoDigest: digest, student: { $ne: student._id } });
  const saved = await fileStore.saveBuffer(buffer, { private: true, originalName: 'attendance-id.jpg', contentType: 'image/jpeg' });
  let request;
  try {
    request = await Request.create({ ...proposal, event: event._id, student: student._id, requestedBy: user._id,
      source: 'id_photo', mode: 'checkin', clientId: payload.clientId, idPhotoUrl: saved.url,
      photoDigest: digest, photoScheduleSignature: data.signature,
      photoExpiresAt: new Date(+now + RETENTION), receivedAt: now, submittedAt: now, identityChecked: true,
      reason: reusedPhoto ? 'ID image reused for another student; independent confirmation required.' : proposal.captureBasis === 'device' ? 'Physical school ID checked; offline capture time needs independent confirmation.' : 'Physical school ID checked; face scanner fallback.',
      previousAttendance: manual.fingerprint(previous), attestedBy: !reusedPhoto && proposal.captureBasis === 'server' && (!previous || previous.method === 'auto' || previous.status === 'pending') ? user._id : null, status: 'pending' });
  } catch (error) {
    await fileStore.deleteByUrl(saved.url).catch(() => {});
    if (error.code === 11000) {
      previousUpload = await Request.findOne({ requestedBy: user._id, clientId: payload.clientId });
      if (previousUpload) return receipt(previousUpload, user, now);
      fail(409, 'A request already awaits review for this student and event.');
    }
    throw error;
  }
  return receipt(request, user, now);
}
async function cleanup(now = new Date()) {
  const expired = await Request.find({ idPhotoUrl: { $ne: '' }, photoExpiresAt: { $lte: now } }).select('idPhotoUrl').limit(100).lean();
  for (const row of expired) {
    await fileStore.deleteByUrl(row.idPhotoUrl);
    await Request.updateOne({ _id: row._id, idPhotoUrl: row.idPhotoUrl }, { $set: { idPhotoUrl: '', photoDeletedAt: now } });
  }
}
module.exports = { prepare, captureTime, submit, cleanup, proposalFromTicket, safePhoto, verifyTicket, preparationState };

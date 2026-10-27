const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const originalLoad = Module._load;
const studentId = '111111111111111111111111';
const eventId = '222222222222222222222222';
let stored = null;
let identified = null;
let writes = 0;
let enrolledUser;
let session;
let event;
const chain = (value) => ({ select: () => ({ lean: async () => value, then: (ok, bad) => Promise.resolve(value).then(ok, bad) }) });
const users = { find: () => chain([]), findById: () => chain(enrolledUser) };
const attendance = { findOne: async () => stored, create: async (value) => { writes++; stored = value; return value; }, countDocuments: async () => 0 };
const excuses = { findOne: async () => null };
const sessions = { findOne: async () => session, updateOne: async () => {}, findById: async () => session };
const identifyMock = { isValidDescriptor: (d) => Array.isArray(d) && d.length === 128 && d.every(Number.isFinite), identify: async () => identified, remove: () => {} };
Module._load = function(request, parent, ...rest) {
  const mocks = {
    '../models/User': users, '../models/Attendance': attendance, '../models/Excuse': excuses,
    './notify': { notifyUsers: async () => {} }, '../models/Event': { findById: async () => event },
    '../models/CheckInSession': sessions,
    '../middleware/authMiddleware': { protect: (req, res, next) => { req.user = { role: 'student', _id: studentId }; next(); } },
    '../services/faceIdentify': identifyMock,
  };
  if (mocks[request]) return mocks[request];
  return originalLoad.call(this, request, parent, ...rest);
};
const faceIdentify = require(require('node:path').join(__dirname, '../services/faceIdentify.js'));
const marking = require('../services/attendanceMarking');
const router = require('../routes/checkinRoutes');
Module._load = originalLoad;
const vector = (n = 0) => Array(128).fill(n);
const enrolled = (id, descriptor) => ({ _id: id, name: 'Test Student', role: 'student', faceEnrolledAt: new Date(), faceConsentAt: new Date(), faceEnrollmentVersion: 1, faceDescriptor: descriptor });
beforeEach(() => {
  faceIdentify.clear(); stored = null; writes = 0;
  enrolledUser = enrolled(studentId, vector());
  session = { _id: '333333333333333333333333', event: eventId, expiresAt: new Date(Date.now() + 3600000), closedAt: null };
  const day = new Date(Date.now() + 8 * 3600000).toISOString().slice(0,10);
  event = { _id: eventId, title: 'Test event', date: day, attendanceStartTime: '00:00', attendanceEndTime: '23:59', endTime: '23:59', status: 'live', organizer: '444444444444444444444444' };
  identified = { result: 'match', distance: 0.1, student: { id: studentId, enrollmentVersion: 1 } };
});
async function request(path, body, method = 'POST') {
  const route = router.stack.find((layer) => layer.route?.path === (path === 'sessions' ? '/sessions' : '/:token') && layer.route.methods[method.toLowerCase()]).route;
  const req = { body, params: { token: path }, query: {}, user: { _id: studentId, role: 'student' } };
  const result = { status: 200, body: null };
  const res = { status(code) { result.status = code; return this; }, json(value) { result.body = value; return this; } };
  await route.stack.at(-1).handle(req, res);
  return result;
}
test('rejects malformed, non-finite and incorrectly sized descriptors', () => {
  for (const value of [null, [], vector().slice(1), vector().fill(NaN), vector().fill(Infinity), vector().fill('0')]) assert.equal(faceIdentify.isValidDescriptor(value), false);
});
test('matches an enrolled face', async () => { await faceIdentify.refresh(); faceIdentify.upsert(enrolled(studentId, vector())); assert.equal((await faceIdentify.identify(vector(0.01))).student.id, studentId); });
test('unknown faces are not guessed', async () => { await faceIdentify.refresh(); faceIdentify.upsert(enrolled(studentId, vector())); assert.equal((await faceIdentify.identify(vector(0.2))).result, 'unknown'); });
test('similar enrolled faces produce ambiguous rather than a guessed identity', async () => { await faceIdentify.refresh(); faceIdentify.upsert(enrolled(studentId, vector())); faceIdentify.upsert(enrolled('other', vector(0.001))); assert.equal((await faceIdentify.identify(vector())).result, 'ambiguous'); });
test('removed faces cannot be matched', async () => { await faceIdentify.refresh(); faceIdentify.upsert(enrolled(studentId, vector())); faceIdentify.remove(studentId); assert.notEqual((await faceIdentify.identify(vector())).result, 'match'); });
test('attendance enrollment requires consent', async () => { await faceIdentify.refresh(); faceIdentify.upsert({ ...enrolled(studentId, vector()), faceConsentAt: null }); assert.notEqual((await faceIdentify.identify(vector())).result, 'match'); });
test('on-time attendance records face audit details', async () => { const now = new Date('2026-10-27T01:30:00Z'); const e = { ...event, date: '2026-10-27', attendanceStartTime: '09:00', attendanceEndTime: '10:00', endTime: '12:00' }; const result = await marking.recordAttendance({ event: e, student: enrolledUser, now, checkInSession: session._id, matchDistance: 0.1 }); assert.equal(result.status,'present'); assert.equal(result.hours,0); assert.equal(stored.method,'face'); assert.equal(stored.checkInSession,session._id); });
test('late attendance retains the existing four-hour penalty', async () => { const result = await marking.recordAttendance({ event: { ...event, date:'2026-10-27', attendanceStartTime:'09:00',attendanceEndTime:'10:00',endTime:'12:00' }, student: enrolledUser, now: new Date('2026-10-27T03:00:00Z') }); assert.equal(result.status,'late'); assert.equal(result.hours,4); });
test('before-window and finished events reject attendance', () => { const e = {...event,date:'2026-10-27',attendanceStartTime:'09:00',attendanceEndTime:'10:00',endTime:'12:00'}; assert.equal(marking.checkInGate(e,new Date('2026-10-27T00:00:00Z')).reason,'before'); assert.equal(marking.checkInGate(e,new Date('2026-10-27T05:00:00Z')).reason,'closed'); assert.equal(marking.checkInGate({...e,status:'finished'}).reason,'finished'); });
test('duplicate check-in does not write another attendance record', async () => { stored={status:'present'}; const result=await marking.recordAttendance({event,student:enrolledUser}); assert.equal(result.reason,'already'); assert.equal(writes,0); });
test('station rejects an invalid face descriptor', async () => { assert.equal((await request('test-token',{descriptor:[0]})).status,400); assert.equal(writes,0); });
test('unknown and ambiguous faces cannot record attendance', async () => { for(const result of ['unknown','ambiguous']) { identified={result}; assert.equal((await request('test-token',{descriptor:vector()})).body.result,result); } assert.equal(writes,0); });
test('closed and expired stations cannot record attendance', async () => { session.closedAt=new Date(); assert.equal((await request('test-token',{descriptor:vector()})).body.result,'closed'); session.closedAt=null; session.expiresAt=new Date(0); assert.equal((await request('test-token',{descriptor:vector()})).body.result,'expired'); assert.equal(writes,0); });
test('reset or unconsented faces cannot record attendance from stale cache', async () => { enrolledUser.faceConsentAt=null; assert.equal((await request('test-token',{descriptor:vector()})).body.result,'not-enrolled'); assert.equal(writes,0); });
test('old enrollment versions cannot mark a newly enrolled student', async () => { enrolledUser.faceEnrollmentVersion=2; assert.equal((await request('test-token',{descriptor:vector()})).body.result,'not-enrolled'); assert.equal(writes,0); });
test('station records a match then reports repeat attendance without another write', async () => { assert.equal((await request('test-token',{descriptor:vector()})).body.result,'marked'); assert.equal((await request('test-token',{descriptor:vector()})).body.result,'already'); assert.equal(writes,1); });
test('students cannot create stations', async () => { assert.equal((await request('sessions',{eventId})).status,403); });
test('malformed event IDs return a client error', async () => { assert.equal((await request('sessions',{eventId:'wrong'})).status,400); });


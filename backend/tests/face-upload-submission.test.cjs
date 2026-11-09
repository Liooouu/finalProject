const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const originalLoad = Module._load;
let pending, detectionError, created, files;
const User = { findById: () => ({ select: async () => ({ faceEnrollmentVersion: 3 }) }) };
const FaceAppeal = { exists: async () => pending, create: async row => { created = row; return { toObject: () => ({ ...row, _id: 'request', status: 'pending' }) }; } };
Module._load = function(request, parent, main) {
  if (parent?.filename.endsWith('accountRoutes.js')) {
    if (request === '../models/User') return User;
    if (request === '../models/FaceAppeal') return FaceAppeal;
    if (request === '../services/faceMatcher') return { detectFaceDescriptorFromBuffer: async () => { if (detectionError) throw new Error('Face detection rejected'); return { descriptor: Array(128).fill(.3) }; }, qualityMessage: () => "" };
    if (request === '../services/fileStore') return { saveBuffer: async (_buffer, options) => { assert.equal(options.private, true); files++; return { url: '/uploads/private-faces/pending.jpg' }; }, deleteByUrl: async () => { files--; } };
    if (request === '../services/faceIdentify') return { upsert() { throw new Error('Pending uploads must never activate attendance'); } };
    if (request === '../services/notifyAdmins') return { notifyAdmins: async () => {} };
  }
  return originalLoad.apply(this, arguments);
};
const router = require('../routes/accountRoutes');
Module._load = originalLoad;
const route = router.stack.find(layer => layer.route?.path === '/face-enrollment-upload').route;
beforeEach(() => { pending = false; detectionError = false; created = null; files = 0; });
async function submit(body = { consent: 'true' }, file = true) {
  const result = { status: 200 };
  const res = { status(code) { result.status = code; return this; }, json(data) { result.data = data; return this; } };
  await route.stack.at(-1).handle({ user: { _id: 'student', name: 'Sample' }, body, file: file ? { buffer: Buffer.from('image'), originalname: 'photo.jpg', mimetype: 'image/jpeg' } : null }, res);
  return result;
}
test('upload creates private pending evidence, binds consent/version and hides the descriptor', async () => {
  const result = await submit(); assert.equal(result.status, 201); assert.equal(result.data.status, 'pending');
  assert.equal(result.data.enrollmentDescriptor, undefined); assert.equal(created.enrollmentVersion, 3);
  assert.equal(created.enrollmentDescriptor.length, 128); assert.ok(created.consentAt); assert.equal(files, 1);
});
test('missing consent/file, invalid face and an existing pending request never persist photos', async () => {
  assert.equal((await submit({})).status, 400); assert.equal((await submit(undefined, false)).status, 400);
  detectionError = true; assert.equal((await submit()).status, 400);
  detectionError = false; pending = true; assert.equal((await submit()).status, 409);
  assert.equal(created, null); assert.equal(files, 0);
});
test('non-students are rejected; a promoted student can request through the organizer portal', () => {
  let status; let next = false;
  const res = { status(code) { status = code; return this; }, json() {} };
  route.stack[1].handle({ user: { role: 'organizer' } }, res, () => { next = true; });
  assert.equal(status, 403); assert.equal(next, false);
  route.stack[1].handle({ user: { role: 'organizer', accountRole: 'student' } }, res, () => { next = true; });
  assert.equal(next, true);
});
test('onboarding status reads are account-scoped and expose no photo or descriptor', async () => {
  const statusRoute = router.stack.find(layer => layer.route?.path === '/face-enrollment-requests').route;
  let filter, fields;
  FaceAppeal.find = value => { filter = value; return { select(value) { fields = value; return this; }, sort() { return this; }, limit: async () => [{ _id: 'request', status: 'pending', enrollmentUpload: true }] }; };
  let data;
  await statusRoute.stack.at(-1).handle({ user: { _id: 'self', role: 'student' }, query: { studentId: 'other' } }, { json(value) { data = value; } });
  assert.deepEqual(filter, { student: 'self', enrollmentUpload: true, deletedAt: null });
  assert.doesNotMatch(fields, /photo|descriptor/i);
  assert.equal(data[0].status, 'pending');
  let status;
  await statusRoute.stack.at(-1).handle({ user: { _id: 'admin', role: 'admin' } }, { status(value) { status = value; return this; }, json() {} });
  assert.equal(status, 403);
});

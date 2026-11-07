const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createService } = require('../services/uploadedFaceEnrollment');

function fixture() {
  const state = {
    student: { _id: 'student', role: 'student', faceEnrollmentVersion: 2, facePhoto: '/old' },
    appeal: { _id: 'appeal', student: 'student', enrollmentUpload: true, status: 'pending', enrollmentVersion: 2,
      consentAt: new Date(), photoUrl: '/private/new', enrollmentDescriptor: Array(128).fill(.2) },
    indexWrites: 0, enrollmentWrites: 0, failFinalize: false,
  };
  const query = value => ({ select: async () => value, populate: async () => value });
  const FaceAppeal = {
    findOneAndUpdate(filter, update) {
      if (update.$set.reviewClaim) {
        if (state.appeal.status !== 'pending' || state.appeal.reviewClaim) return query(null);
        Object.assign(state.appeal, update.$set); return query({ ...state.appeal });
      }
      return { populate: async () => {
        if (state.failFinalize) { state.failFinalize = false; throw new Error('write unavailable'); }
        if (state.appeal.reviewClaim !== filter.reviewClaim) return null;
        Object.assign(state.appeal, update.$set); delete state.appeal.reviewClaim;
        const result = { ...state.appeal, student: { _id: 'student', name: 'Test' } };
        delete result.enrollmentDescriptor; return result;
      } };
    },
    async updateOne(filter) { if (state.appeal.reviewClaim === filter.reviewClaim) delete state.appeal.reviewClaim; },
  };
  const User = {
    findById: () => query({ ...state.student }),
    async findOneAndUpdate(filter, update) {
      if (state.student.faceEnrollmentVersion !== filter.faceEnrollmentVersion) return null;
      Object.assign(state.student, update.$set);
      state.student.faceEnrollmentVersion += update.$inc.faceEnrollmentVersion;
      state.enrollmentWrites++; return { ...state.student };
    },
  };
  const run = createService({ User, FaceAppeal, faceIdentify: { upsert() { state.indexWrites++; } } });
  const review = changes => run({ id: 'appeal', admin: { _id: 'admin', role: 'admin' }, action: 'approved', identityChecked: true, ...changes });
  return { state, review };
}
test('upload remains inactive until verified administrator approval; approval activates exact stored descriptor', async () => {
  const { state, review } = fixture();
  assert.equal(state.student.facePhoto, '/old');
  await assert.rejects(review({ identityChecked: false }), { status: 400 });
  assert.equal(state.enrollmentWrites, 0);
  const result = await review();
  assert.equal(result.status, 'approved'); assert.equal(result.enrollmentDescriptor, undefined);
  assert.equal(state.student.facePhoto, '/private/new'); assert.equal(state.student.faceEnrollmentVersion, 3);
  assert.deepEqual(state.student.faceDescriptor, Array(128).fill(.2));
  assert.equal(state.indexWrites, 1);
});
test('organizers cannot approve uploaded faces', async () => {
  const { state, review } = fixture();
  await assert.rejects(review({ admin: { _id: 'organizer', role: 'organizer' } }), { status: 403 });
  assert.equal(state.enrollmentWrites, 0);
});
test('self-review, missing consent and invalid descriptors cannot enroll', async () => {
  for (const type of ['self', 'consent', 'descriptor']) {
    const { state, review } = fixture();
    if (type === 'self') state.appeal.student = 'admin';
    if (type === 'consent') state.appeal.consentAt = null;
    if (type === 'descriptor') state.appeal.enrollmentDescriptor[0] = NaN;
    await assert.rejects(review()); assert.equal(state.enrollmentWrites, 0);
  }
});
test('a newer camera enrollment is preserved when an old upload is approved', async () => {
  const { state, review } = fixture(); state.student.faceEnrollmentVersion = 3;
  await assert.rejects(review(), { status: 409 });
  assert.equal(state.student.facePhoto, '/old'); assert.equal(state.appeal.status, 'pending');
});
test('rejection requires a reason and leaves existing enrollment intact', async () => {
  const { state, review } = fixture();
  await assert.rejects(review({ action: 'rejected', note: 'no' }), { status: 400 });
  await review({ action: 'rejected', note: 'Identity not confirmed' });
  assert.equal(state.appeal.status, 'rejected'); assert.equal(state.student.facePhoto, '/old');
  assert.equal(state.enrollmentWrites, 0);
});
test('retry after failed final appeal write never applies enrollment twice', async () => {
  const { state, review } = fixture(); state.failFinalize = true;
  await assert.rejects(review(), /write unavailable/);
  assert.equal(state.enrollmentWrites, 1); assert.equal(state.appeal.status, 'pending');
  await assert.rejects(review({ action: 'rejected', note: 'Wrong person' }), { status: 409 });
  await review(); assert.equal(state.enrollmentWrites, 1); assert.equal(state.appeal.status, 'approved');
});
test('already reviewed and in-flight requests cannot be processed again', async () => {
  const { state, review } = fixture(); state.appeal.reviewClaim = 'other-admin';
  await assert.rejects(review(), { status: 409 });
  delete state.appeal.reviewClaim; await review();
  await assert.rejects(review(), { status: 409 }); assert.equal(state.enrollmentWrites, 1);
});

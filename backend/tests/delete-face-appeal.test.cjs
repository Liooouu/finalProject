const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createService } = require('../services/deleteFaceAppeal');
function fixture(options = {}) {
  const state = { row: { _id: 'appeal', status: options.status || 'pending', photoUrl: '/private/photo' }, removedFiles: [], ...options };
  const FaceAppeal = {
    findOne: () => ({ select: async () => state.row.deletedAt ? null : { ...state.row } }),
    async findOneAndUpdate(filter, update) {
      if (state.inFlight || filter.status !== state.row.status) return null;
      Object.assign(state.row, update.$set); return state.row;
    },
    exists: async () => state.otherEvidence,
    updateOne: async (_filter, update) => Object.assign(state.row, update.$set),
  };
  const User = { exists: async filter => filter.faceEnrollmentAppeal ? state.unfinishedApproval : state.activePhoto };
  const fileStore = { deleteByUrl: async url => { state.removedFiles.push(url); } };
  const remove = createService({ FaceAppeal, User, fileStore });
  return { state, remove: admin => remove({ id: 'appeal', admin: admin || { _id: 'admin', role: 'admin' } }) };
}
test('deleting pending appeal frees pending state and preserves a deletion audit', async () => {
  const { state, remove } = fixture(); await remove();
  assert.equal(state.row.status, 'deleted'); assert.equal(state.row.statusBeforeDeletion, 'pending');
  assert.equal(state.row.deletedBy, 'admin'); assert.ok(state.row.deletedAt);
  assert.equal(state.row.photoUrl, ''); assert.deepEqual(state.removedFiles, ['/private/photo']);
  await assert.rejects(remove(), { status: 404 });
});
test('approved enrollment photo still in use is never removed', async () => {
  const { state, remove } = fixture({ status: 'approved', activePhoto: true });
  await remove(); assert.equal(state.row.status, 'deleted'); assert.deepEqual(state.removedFiles, []);
});
test('shared private evidence is preserved', async () => {
  const { state, remove } = fixture({ otherEvidence: true }); await remove();
  assert.deepEqual(state.removedFiles, []);
});
test('only administrators can delete appeals', async () => {
  const { state, remove } = fixture(); await assert.rejects(remove({ _id: 'student', role: 'student' }), { status: 403 });
  await assert.rejects(remove({ _id: 'organizer', role: 'organizer' }), { status: 403 });
  assert.equal(state.row.status, 'pending');
});
test('concurrent and unfinished approvals cannot be deleted', async () => {
  for (const options of [{ inFlight: true }, { unfinishedApproval: true }]) {
    const { state, remove } = fixture(options); await assert.rejects(remove(), { status: 409 });
    assert.equal(state.row.status, 'pending'); assert.deepEqual(state.removedFiles, []);
  }
});

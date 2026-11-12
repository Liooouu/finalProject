const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
let writes, found;
const load = Module._load;
Module._load = function(name, parent, ...rest) {
  if (name === '../models/User') return { findByIdAndUpdate(id, update, options) {
    writes.push({ id, update, options });
    return { select: async fields => { assert.equal(fields, 'tutorialProgress tutorialPages'); return found ? { tutorialProgress: { student: 1, organizer: 1 }, tutorialPages: { student: ['2:events'] } } : null; } };
  } };
  return load.call(this, name, parent, ...rest);
};
const router = require('../routes/accountRoutes');
Module._load = load;
const route = router.stack.find(layer => layer.route?.path === '/tutorial').route;
beforeEach(() => { writes = []; found = true; });
async function complete(role = 'student', body = { version: 1 }) {
  let status = 200, result;
  await route.stack.at(-1).handle({ user: { _id: 'self', role }, body }, { status(code) { status = code; return this; }, json(value) { result = value; } });
  return { status, result };
}
test('completion changes only the signed-in account and active portal', async () => {
  for (const role of ['student', 'organizer', 'admin']) {
    assert.equal((await complete(role, { version: 1, userId: 'someone-else', role: 'admin' })).status, 200);
    const write = writes.at(-1);
    assert.equal(write.id, 'self');
    assert.deepEqual(write.update, { $max: { [`tutorialProgress.${role}`]: 1 } });
  }
});
test('invalid versions cannot force-skip future tutorials', async () => {
  for (const version of [undefined, '1', 0, 2, -1, {}, null]) assert.equal((await complete('student', { version })).status, 400);
  assert.equal(writes.length, 0);
});
test('page progress is idempotent and limited to the signed-in active portal', async () => {
  for (const role of ['student', 'organizer', 'admin']) {
    assert.equal((await complete(role, { version: 2, page: 'profile:academic', role: 'admin', userId: 'other' })).status, 200);
    assert.deepEqual(writes.at(-1), { id: 'self', update: { $addToSet: { [`tutorialPages.${role}`]: '2:profile:academic' } }, options: { new: true } });
  }
});
test('arbitrary page keys, unknown sections and unsupported roles are rejected', async () => {
  for (const page of [null, {}, 'random', 'users:made-up', 'users:terms:extra', 'profile.$admin', 'events'.repeat(100)]) assert.equal((await complete('student', { version: 2, page })).status, 400);
  assert.equal((await complete('public', { version: 2, page: 'events' })).status, 400);
  assert.equal(writes.length, 0);
});
test('missing accounts receive 404 and the route requires authentication', async () => {
  assert.ok(route.stack.length >= 2);
  found = false;
  assert.equal((await complete()).status, 404);
});

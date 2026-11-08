const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { setTimeout: wait } = require('node:timers/promises');
const { observeRecordWrites, streamRecordUpdates, publishRecordChange, subscribeRecordChanges } = require('../services/recordUpdates');

function response() {
  return Object.assign(new EventEmitter(), {
    statusCode: 200, chunks: [],
    json(body) { this.body = body; return this; },
    set(headers) { this.headers = headers; },
    flushHeaders() {}, flush() {},
    write(chunk) { this.chunks.push(chunk); },
    end() { this.writableEnded = true; this.emit('close'); },
  });
}

test('only successful record writes invalidate; camera retries and reads stay quiet', async () => {
  let count = 0;
  const unsubscribe = subscribeRecordChanges(() => count++);
  const request = async (path, body, status = 200, method = 'POST') => {
    const res = response(); res.statusCode = status;
    observeRecordWrites({ path, method }, res, () => {});
    res.json(body); res.emit('finish');
    await wait(180);
  };
  try {
    await request('/student/community-service', {}, 200, 'GET');
    await request('/notifications/read-all', {});
    await request('/auth/login', {});
    await request('/id-photo-attendance/prepare', {});
    await request('/events/123', {}, 400);
    await request('/events/123', { ok: false });
    await request('/checkin/token', { result: 'unknown' });
    await request('/checkin/token', { result: 'already' });
    assert.equal(count, 0);
    await request('/checkin/token', { ok: true, result: 'marked', student: { name: 'Private student' } });
    assert.equal(count, 1);
    await request('/manual-attendance/requests/123/review', { ok: true });
    assert.equal(count, 2);
    await request('/events/123', {}, 200, 'PATCH');
    assert.equal(count, 3);
  } finally { unsubscribe(); }
});

test('stream coalesces writes, sends no records, and releases disconnected listeners', async () => {
  const res = response();
  streamRecordUpdates({}, res);
  assert.equal(res.headers['X-Accel-Buffering'], 'no');
  assert.equal(res.headers['Content-Type'], 'text/event-stream');
  assert.deepEqual(res.chunks, ['data: ready\n\n']);
  publishRecordChange(); publishRecordChange(); publishRecordChange();
  await wait(180);
  assert.deepEqual(res.chunks, ['data: ready\n\n', 'data: changed\n\n']);
  res.end(); publishRecordChange();
  await wait(180);
  assert.equal(res.chunks.length, 2);
});

test('stream ends at token expiration so reconnect must authenticate again', async () => {
  const res = response();
  streamRecordUpdates({ authExpiresAt: Date.now() + 30 }, res);
  await wait(60);
  assert.equal(res.writableEnded, true);
});

import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const original = Object.fromEntries(['window', 'document', 'localStorage', 'navigator', 'fetch', 'BroadcastChannel'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const replace = (key, value) => Object.defineProperty(globalThis, key, { configurable: true, value });
const streams = [];
let unsubscribeA, unsubscribeB;
try {
  const windowMock = Object.assign(new EventTarget(), { location: { pathname: '/student/dashboard' } });
  const documentMock = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const token = id => `header.${Buffer.from(JSON.stringify({ id, role: 'student', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.signature`;
  const values = new Map([['token_student', token('one')]]);
  replace('window', windowMock); replace('document', documentMock);
  replace('navigator', { onLine: true }); replace('BroadcastChannel', undefined);
  replace('localStorage', { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) });
  replace('fetch', async (url, options) => {
    assert.equal(url, '/api/record-updates');
    assert.ok(options.headers.Authorization.startsWith('Bearer '));
    assert.equal(url.includes('token'), false);
    let controller;
    const body = new ReadableStream({ start(value) { controller = value; } });
    options.signal.addEventListener('abort', () => { try { controller.close(); } catch {} }, { once: true });
    streams.push({ options, controller });
    return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });
  });
  const { createRecordEventParser } = await server.ssrLoadModule('/src/utils/recordUpdates.js');
  let parsed = 0;
  const parse = createRecordEventParser(() => parsed++);
  parse('data: rea'); parse('dy\n\n: heartbeat\n\nda'); parse('ta: changed\r\n\r\ndata: unrelated\n\n');
  assert.equal(parsed, 2, 'split chunks and CRLF handled; unrelated data ignored');

  const { subscribeToDataChanges } = await server.ssrLoadModule('/src/utils/dataSync.js');
  let a = 0, b = 0;
  unsubscribeA = subscribeToDataChanges(() => a++);
  unsubscribeB = subscribeToDataChanges(() => b++);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(streams.length, 1, 'multiple screens share one connection');
  streams[0].controller.enqueue(new TextEncoder().encode('data: ready\n\ndata: changed\n\n'));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(a, 2); assert.equal(b, 2);
  documentMock.visibilityState = 'hidden'; documentMock.dispatchEvent(new Event('visibilitychange'));
  assert.ok(streams[0].options.signal.aborted, 'hidden tabs stop streaming');
  documentMock.visibilityState = 'visible'; documentMock.dispatchEvent(new Event('visibilitychange'));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(streams.length, 2);
  values.set('token_student', token('two')); windowMock.dispatchEvent(new Event('storage'));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.ok(streams[1].options.signal.aborted, 'account switch closes previous connection');
  assert.equal(streams.length, 3);
  assert.notEqual(streams[1].options.headers.Authorization, streams[2].options.headers.Authorization);
  unsubscribeA(); assert.equal(streams[2].options.signal.aborted, false);
  unsubscribeB(); assert.ok(streams[2].options.signal.aborted);
  console.log('Record update parser, shared connection, visibility, account switch and cleanup passed.');
} finally {
  unsubscribeA?.(); unsubscribeB?.();
  await server.close();
  for (const [key, descriptor] of Object.entries(original)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
}

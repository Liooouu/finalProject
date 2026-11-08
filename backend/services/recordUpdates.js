// Invalidation only: clients fetch their own authorized records, never another
// account's payload. A short debounce combines attendance + notification writes.
const { EventEmitter } = require('node:events');
const changes = new EventEmitter();
changes.setMaxListeners(0);
let pending;

function publishRecordChange() {
  if (pending) return;
  pending = setTimeout(() => {
    pending = null;
    changes.emit('change');
  }, 150);
  pending.unref?.();
}

function subscribeRecordChanges(listener) {
  changes.on('change', listener);
  return () => changes.off('change', listener);
}

function observeRecordWrites(req, res, next) {
  const route = req.path;
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) ||
      /^\/(auth|notifications)(\/|$)/.test(route) ||
      route === '/id-photo-attendance/prepare') return next();
  let body;
  const json = res.json;
  res.json = function (value) {
    body = value;
    return json.call(this, value);
  };
  res.once('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300 || body?.ok === false) return;
    // The camera posts repeatedly. Unknown/already/unstable faces are reads,
    // not changes, despite returning HTTP 200.
    if (/^\/checkin\/[^/]+$/.test(route) && route !== '/checkin/sessions' && body?.result !== 'marked') return;
    publishRecordChange();
  });
  next();
}

function streamRecordUpdates(req, res) {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  const send = data => {
    if (res.destroyed || res.writableEnded) return;
    res.write(`data: ${data}\n\n`);
    res.flush?.();
  };
  const unsubscribe = subscribeRecordChanges(() => send('changed'));
  const heartbeat = setInterval(() => {
    if (!res.destroyed && !res.writableEnded) {
      res.write(': heartbeat\n\n');
      res.flush?.();
    }
  }, 15000);
  // Reconnect through protect regularly, including after JWT expiration.
  const lifetimeMs = Math.min(5 * 60 * 1000, req.authExpiresAt ? Math.max(1, req.authExpiresAt - Date.now()) : Infinity);
  const lifetime = setTimeout(() => res.end(), lifetimeMs);
  heartbeat.unref?.();
  lifetime.unref?.();
  res.once('close', () => {
    unsubscribe();
    clearInterval(heartbeat);
    clearTimeout(lifetime);
  });
  send('ready');
}

module.exports = { publishRecordChange, subscribeRecordChanges, observeRecordWrites, streamRecordUpdates };

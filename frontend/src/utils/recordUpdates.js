import { getContextRole, getToken } from './auth';

// Fetch streaming keeps bearer credentials out of URLs/logs. Only generic
// invalidations cross the stream; each screen still uses its protected API.
export const createRecordEventParser = (onChange) => {
  let buffer = '';
  return chunk => {
    buffer += chunk;
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop();
    if (buffer.length > 1024) throw new Error('Invalid record stream');
    for (const event of events) {
      if (/^data: (ready|changed)$/m.test(event)) onChange();
    }
  };
};

export function startRecordUpdates(onChange) {
  let stopped = false;
  let active = null;
  let identity = '';
  let deniedIdentity = '';
  let retryAt = 0;
  let retryDelay = 1000;

  const currentIdentity = () => {
    if (document.visibilityState === 'hidden' || navigator.onLine === false) return '';
    const role = getContextRole();
    const token = role && getToken(role);
    return token ? `${role}:${token}` : '';
  };

  const connect = async (key) => {
    const controller = new AbortController();
    active = controller;
    let watchdog;
    let reader;
    const keepAlive = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => controller.abort(), 45000);
    };
    try {
      keepAlive();
      const response = await fetch('/api/record-updates', {
        headers: { Authorization: `Bearer ${key.slice(key.indexOf(':') + 1)}`, Accept: 'text/event-stream' },
        signal: controller.signal,
        cache: 'no-store',
      });
      if ([401, 403].includes(response.status)) deniedIdentity = key;
      if (!response.ok || !response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
        throw new Error('Record stream unavailable');
      }
      reader = response.body.getReader();
      const decoder = new TextDecoder();
      const parse = createRecordEventParser(() => {
        if (!stopped && !controller.signal.aborted && currentIdentity() === key) onChange();
      });
      while (!controller.signal.aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        keepAlive();
        retryDelay = 1000;
        parse(decoder.decode(value, { stream: true }));
      }
    } catch {
      // Focus/visibility and useAutoRefresh polling remain available offline
      // and on hosts that do not support streaming. Never reload the page.
    } finally {
      clearTimeout(watchdog);
      controller.abort();
      await reader?.cancel().catch(() => {});
      if (active === controller) {
        active = null;
        retryAt = Date.now() + retryDelay;
        retryDelay = Math.min(retryDelay * 2, 30000);
      }
    }
  };

  const reconcile = () => {
    if (stopped) return;
    const key = currentIdentity();
    if (key !== identity) {
      identity = key;
      active?.abort();
      active = null;
      retryAt = 0;
      retryDelay = 1000;
    }
    if (key && key !== deniedIdentity && !active && Date.now() >= retryAt) void connect(key);
  };
  const events = ['focus', 'online', 'offline', 'storage', 'popstate'];
  events.forEach(event => window.addEventListener(event, reconcile));
  document.addEventListener('visibilitychange', reconcile);
  const timer = setInterval(reconcile, 5000);
  reconcile();
  return () => {
    stopped = true;
    active?.abort();
    clearInterval(timer);
    events.forEach(event => window.removeEventListener(event, reconcile));
    document.removeEventListener('visibilitychange', reconcile);
  };
}

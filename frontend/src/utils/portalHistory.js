// Browser history may contain auth, public pages, another account, or another portal.
// Only previously observed entries in this signed-in portal are safe app Back targets.
const PREFIX = 'tracked:portal-history:';
export function portalHome(pathname = '') {
  const match = pathname.match(/^\/(student|organizer|admin)\/dashboard(?:\/|$)/);
  return match ? `/${match[1]}/dashboard` : null;
}
function scope(location, user) {
  const home = portalHome(location.pathname);
  return home && user?.id && home === `/${user.role}/dashboard`
    ? `${PREFIX}${user.role}:${user.id}:${user.sessionVersion || 0}:${user.organizerVersion || 0}` : null;
}
const pathOf = location => location.pathname + (location.search || '') + (location.hash || '');
function read(storage, key) {
  try { const entries = JSON.parse(storage.getItem(key) || '[]'); return Array.isArray(entries) ? entries : []; }
  catch { return []; }
}
export function recordPortalVisit(storage, location, user, index, action = 'PUSH') {
  const key = scope(location, user);
  try {
    if (!key) {
      for (let n = storage.length - 1; n >= 0; n--) { const stored = storage.key(n); if (stored?.startsWith(PREFIX)) storage.removeItem(stored); }
      return;
    }
    if (!Number.isInteger(index) || !location.key) return;
    let entries = read(storage, key).filter(entry => entry.index !== index);
    if (action === 'PUSH') entries = entries.filter(entry => entry.index < index);
    entries.push({ index, key: location.key, path: pathOf(location) });
    storage.setItem(key, JSON.stringify(entries.sort((a,b) => a.index-b.index).slice(-100)));
  } catch { /* Restricted storage falls back to the portal dashboard. */ }
}
export function portalBackTarget(storage, location, user, index, fallback) {
  const home = portalHome(location.pathname);
  if (!home || location.pathname.replace(/\/$/, '') === home) return { home, disabled: true };
  const safeFallback = portalHome(fallback) === home ? fallback : home;
  const key = scope(location, user);
  if (key && Number.isInteger(index)) {
    const entries = read(storage, key);
    const current = entries.find(entry => entry.index === index && entry.key === location.key && entry.path === pathOf(location));
    const previous = entries.find(entry => entry.index === index - 1);
    if (current && previous && portalHome(previous.path.split(/[?#]/)[0]) === home) return { home, delta: -1, disabled: false };
  }
  return { home, path: safeFallback, disabled: false };
}

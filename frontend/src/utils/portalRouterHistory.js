import { getAppLocation, isPortalPath, PORTAL_ADDRESS, PORTAL_PATH_KEY } from './portalLocation.js';

// Keep the real route in the current browser history entry, so refresh and
// Back/Forward restore it without putting role, page, IDs or filters in the URL.
export function createPortalHistory(browser, resolveHome) {
  let action = 'POP';
  const listeners = new Set();
  const key = () => Math.random().toString(36).slice(2, 10);
  const urlFor = to => {
    const current = getAppLocation(browser);
    const path = typeof to === 'string' ? to : `${to.pathname || current.pathname}${to.search || ''}${to.hash || ''}`;
    return new URL(path, browser.location.origin + current.pathname);
  };
  const pathOf = url => url.pathname + url.search + url.hash;
  function initialize() {
    const stored = browser.history.state || {};
    let path = pathOf(new URL(browser.location.href));
    if (browser.location.pathname.replace(/\/$/, '') === PORTAL_ADDRESS) {
      path = isPortalPath(stored[PORTAL_PATH_KEY]) ? stored[PORTAL_PATH_KEY] : resolveHome();
    }
    const masked = isPortalPath(path);
    browser.history.replaceState({ ...stored, idx: stored.idx ?? 0, key: stored.key || key(), [PORTAL_PATH_KEY]: masked ? path : null }, '', masked ? PORTAL_ADDRESS : path);
  }
  initialize();
  const location = () => ({ ...getAppLocation(browser), state: browser.history.state?.usr ?? null, key: browser.history.state?.key || 'default' });
  const emit = delta => listeners.forEach(listener => listener({ action, location: location(), delta }));
  const onPop = () => {
    const previous = index;
    initialize();
    index = browser.history.state.idx;
    action = 'POP';
    emit(index - previous);
  };
  let index = browser.history.state.idx;
  function change(to, state, replace) {
    const url = urlFor(to);
    if (url.origin !== browser.location.origin) throw new Error('Portal navigation must stay on TrackED');
    const path = pathOf(url), masked = isPortalPath(path);
    const next = { usr: state, key: key(), idx: replace ? index : index + 1, [PORTAL_PATH_KEY]: masked ? path : null };
    browser.history[replace ? 'replaceState' : 'pushState'](next, '', masked ? PORTAL_ADDRESS : path);
    index = next.idx;
    action = replace ? 'REPLACE' : 'PUSH';
    emit(replace ? 0 : 1);
  }
  return {
    get action() { return action; },
    get location() { return location(); },
    createHref(to) { const url = urlFor(to); return isPortalPath(pathOf(url)) ? PORTAL_ADDRESS : pathOf(url); },
    createURL: urlFor,
    encodeLocation(to) { const url = urlFor(to); return { pathname: url.pathname, search: url.search, hash: url.hash }; },
    push(to, state) { change(to, state, false); },
    replace(to, state) { change(to, state, true); },
    go(delta) { browser.history.go(delta); },
    listen(listener) {
      if (!listeners.size) browser.addEventListener('popstate', onPop);
      listeners.add(listener);
      return () => { listeners.delete(listener); if (!listeners.size) browser.removeEventListener('popstate', onPop); };
    },
  };
}

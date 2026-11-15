import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPortalHistory } from '../src/utils/portalRouterHistory.js';
import { getAppLocation, isPortalPath } from '../src/utils/portalLocation.js';

function browserAt(path, initialState = null) {
  let cursor = 0;
  const entries = [{ url: new URL(path, 'https://tracked.test'), state: initialState }];
  const listeners = new Set();
  return {
    get location() { return entries[cursor].url; },
    addEventListener(type, fn) { assert.equal(type, 'popstate'); listeners.add(fn); },
    removeEventListener(type, fn) { listeners.delete(fn); },
    history: {
      get state() { return entries[cursor].state; },
      replaceState(state, _, path) { entries[cursor] = { state, url: new URL(path, entries[cursor].url) }; },
      pushState(state, _, path) { const url = new URL(path, entries[cursor].url); entries.splice(++cursor, entries.length, { state, url }); },
      go(delta) { if (cursor + delta < 0 || cursor + delta >= entries.length) return; cursor += delta; listeners.forEach(fn => fn()); },
    },
  };
}

test('legacy deep links mask their address and refresh restores the exact internal route', () => {
  const browser = browserAt('/admin/dashboard/users?search=Demo#details');
  const history = createPortalHistory(browser, () => '/auth');
  assert.equal(browser.location.pathname, '/portal');
  assert.equal(browser.location.search + browser.location.hash, '');
  assert.deepEqual(getAppLocation(browser), { pathname: '/admin/dashboard/users', search: '?search=Demo', hash: '#details' });
  assert.equal(history.createHref('/admin/dashboard/reports?event=123'), '/portal');
  const refreshed = createPortalHistory(browser, () => '/auth');
  assert.deepEqual(refreshed.location, history.location);
});

test('push, replace and browser Back/Forward retain route, query, hash, state and index', () => {
  const browser = browserAt('/student/dashboard');
  const history = createPortalHistory(browser, () => '/auth');
  const actions = [];
  const stop = history.listen(value => actions.push(value));
  history.push('/student/dashboard/events?page=2', { source: 'dashboard' });
  const eventKey = history.location.key;
  history.push('/student/dashboard/community-service#manual-requests');
  history.go(-1);
  assert.equal(history.location.pathname, '/student/dashboard/events');
  assert.equal(history.location.search, '?page=2');
  assert.deepEqual(history.location.state, { source: 'dashboard' });
  assert.equal(history.location.key, eventKey);
  assert.equal(browser.history.state.idx, 1);
  assert.equal(actions.at(-1).delta, -1);
  history.go(1);
  assert.equal(history.location.hash, '#manual-requests');
  history.replace('/student/dashboard/profile');
  assert.equal(browser.history.state.idx, 2);
  assert.equal(browser.location.pathname, '/portal');
  stop();
});

test('bare portal uses the current session home, while signed-out entry goes to auth', () => {
  const signedIn = browserAt('/portal');
  const active = createPortalHistory(signedIn, () => '/organizer/dashboard');
  assert.equal(active.location.pathname, '/organizer/dashboard');
  const signedOut = browserAt('/portal');
  const inactive = createPortalHistory(signedOut, () => '/auth');
  assert.equal(inactive.location.pathname, '/auth');
  assert.equal(signedOut.location.pathname, '/auth');
});

test('public auth, kiosk and terms URLs remain usable, and saved routes cannot redirect externally', () => {
  for (const path of ['/auth/signup', '/terms', '/check-in/station-token']) {
    const browser = browserAt(path), history = createPortalHistory(browser, () => '/auth');
    assert.equal(history.location.pathname, path);
    assert.equal(history.createHref(path), path);
    assert.equal(browser.location.pathname, path);
    assert.throws(() => history.push('https://other.test/admin/dashboard'), /stay on TrackED/);
  }
  for (const saved of ['//other.test', 'https://other.test', '/admin/../auth', '/api/admin/users']) {
    assert.equal(isPortalPath(saved), false);
    const browser = browserAt('/portal', { trackedPortalPath: saved });
    assert.equal(createPortalHistory(browser, () => '/auth').location.pathname, '/auth');
  }
});

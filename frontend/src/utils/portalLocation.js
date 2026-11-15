// This is display routing, not authorization. ProtectedRoute and the API still
// validate the signed-in account for every protected screen and request.
export const PORTAL_ADDRESS = '/portal';
export const PORTAL_PATH_KEY = 'trackedPortalPath';

export function isPortalPath(path) {
  return typeof path === 'string' && /^\/(student|organizer|admin)\/dashboard(?:[/?#]|$)/.test(path);
}

export function getAppLocation(browser = window) {
  const actual = browser.location;
  const saved = browser.history?.state?.[PORTAL_PATH_KEY];
  if (actual.pathname.replace(/\/$/, '') === PORTAL_ADDRESS && isPortalPath(saved)) {
    const url = new URL(saved, actual.origin);
    return { pathname: url.pathname, search: url.search, hash: url.hash };
  }
  return { pathname: actual.pathname, search: actual.search || '', hash: actual.hash || '' };
}

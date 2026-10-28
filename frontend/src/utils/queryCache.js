// utils/queryCache.js
//
// A tiny in-memory cache for screen data. It is deliberately not a data
// library: each screen writes the payload it just rendered, then seeds its
// state from it on the next mount. That makes switching back to a tab instant
// (the previous payload is already on screen) while the normal
// useAutoRefresh/fetch still runs in the background and replaces it when the
// server answers.
//
// Keys are scoped to the signed-in account, so switching portals or logging in
// as someone else on the same device can never show another account's data.
// Nothing is persisted: a reload starts clean, which keeps stale attendance
// from surviving a refresh.

import { getUserFromToken } from "./auth";

const MAX_ENTRIES = 40;
const store = new Map(); // "userId:role|screen-key" -> value

function scope() {
  const user = getUserFromToken();
  return user?.id ? `${user.id}:${user.role || ""}` : "anon";
}

const fullKey = (key) => `${scope()}|${key}`;

/** Cached payload for a screen, or undefined when this is a first visit. */
export function readScreen(key) {
  return store.get(fullKey(key));
}

/** Remember the payload a screen just rendered. */
export function writeScreen(key, value) {
  const full = fullKey(key);
  // Re-insert so the map's iteration order stays "least recently written first".
  store.delete(full);
  store.set(full, value);
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    store.delete(oldest);
  }
  return value;
}

/** Drop everything — used when the session identity changes. */
export function clearScreens() {
  store.clear();
}

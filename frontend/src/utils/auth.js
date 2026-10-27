import { jwtDecode } from "jwt-decode";

const ROLES = ["student", "organizer", "admin"];

// Each browser tab lives under /student, /organizer or /admin routes,
// so we can resolve which role's token this tab should use even when
// multiple accounts are logged in across different tabs.
export const getContextRole = () => {
  const path = window.location.pathname;
  if (path.startsWith("/student")) return "student";
  if (path.startsWith("/organizer")) return "organizer";
  if (path.startsWith("/admin")) return "admin";
  return null;
};

export const setAuth = (token, role) => {
  localStorage.setItem("token", token);
  if (role && ROLES.includes(role)) {
    localStorage.setItem(`token_${role}`, token);
    localStorage.setItem("last_role", role);
  }
};

// Remember which role the user is actually working with right now. The bare
// "/" URL has no /student|/organizer|/admin prefix to tell tabs apart, and the
// generic "token" is simply whoever logged in last — so without this, pasting
// the base address bounced people into whichever dashboard happened to win the
// last login (usually the organizer, when testing multiple roles).
export const markRoleActive = (role) => {
  if (role && ROLES.includes(role)) localStorage.setItem("last_role", role);
};

// Role of the account the user last *used* (not just last logged in), but only
// if that account still has a live, unexpired token. Returns null otherwise so
// callers can fall back.
export const getLastActiveRole = () => {
  const last = localStorage.getItem("last_role");
  if (!last || !ROLES.includes(last)) return null;
  const token = localStorage.getItem(`token_${last}`);
  if (!token) return null;
  try {
    const payload = jwtDecode(token);
    if (payload?.exp && payload.exp * 1000 <= Date.now()) return null;
    return last;
  } catch {
    return null;
  }
};

export const getToken = () => {
  const context = getContextRole();
  if (context) {
    const contextualToken = localStorage.getItem(`token_${context}`);
    if (contextualToken) return contextualToken;
  }
  return localStorage.getItem("token");
};

export const clearAuth = (role = getContextRole()) => {
  const context = role;
  localStorage.removeItem("token");
  if (context) localStorage.removeItem(`token_${context}`);
};

export const clearAllAuth = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("last_role");
  ROLES.forEach((role) => localStorage.removeItem(`token_${role}`));
};

// Signup email-verification is easy to interrupt: the student leaves to read the
// emailed code and the tab reloads. Remembering the address lets the auth page
// drop them straight back onto the code screen after the refresh instead of the
// sign-in form. Cleared once the code is verified or the student backs out.
const PENDING_VERIFICATION_KEY = "pendingVerificationEmail";

export const setPendingVerificationEmail = (email) => {
  if (email) localStorage.setItem(PENDING_VERIFICATION_KEY, email);
};

export const getPendingVerificationEmail = () =>
  localStorage.getItem(PENDING_VERIFICATION_KEY) || null;

export const clearPendingVerificationEmail = () => {
  localStorage.removeItem(PENDING_VERIFICATION_KEY);
};

export const getUserFromToken = () => {
  const token = getToken();
  if (!token) return null;

  try {
    const payload = jwtDecode(token);
    // An expired token is no different from no token: treat it as logged out
    // so routes decide on the spot instead of loading a dashboard that can
    // only answer 401.
    if (payload?.exp && payload.exp * 1000 <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
};

export const getUserRole = () => {
  const user = getUserFromToken();
  return user?.role || null;
};

export const logout = () => {
  clearAllAuth();
  window.location.href = "/auth";
};

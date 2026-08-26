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

export const clearAuth = () => {
  const context = getContextRole();
  localStorage.removeItem("token");
  if (context) localStorage.removeItem(`token_${context}`);
};

export const clearAllAuth = () => {
  localStorage.removeItem("token");
  ROLES.forEach((role) => localStorage.removeItem(`token_${role}`));
};

export const getUserFromToken = () => {
  const token = getToken();
  if (!token) return null;

  try {
    return jwtDecode(token);
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

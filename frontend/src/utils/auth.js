import { jwtDecode } from "jwt-decode";

export const getUserFromToken = () => {
  const token = localStorage.getItem("token");
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
  localStorage.removeItem("token");
  window.location.href = "/auth";
};
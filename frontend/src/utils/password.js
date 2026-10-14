// frontend/src/utils/password.js
// Mirror of backend/utils/passwordPolicy.js — same regex, same message, so the
// inline error matches what the API would have returned.
export const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
export const PASSWORD_MESSAGE =
  "Password must be at least 8 characters and include a letter and a number.";
export const PASSWORD_HINT = "At least 8 characters, with a letter and a number.";

export function isStrongPassword(password) {
  return typeof password === "string" && PASSWORD_RE.test(password);
}

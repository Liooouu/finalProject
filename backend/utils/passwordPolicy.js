// backend/utils/passwordPolicy.js
// One shared rule for every password the system accepts: at least 8
// characters with at least one letter and one digit. The regex is mirrored on
// the frontend (src/utils/password.js) so the same hint and the same error can
// be shown before a request is ever sent.
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const PASSWORD_MESSAGE =
  "Password must be at least 8 characters and include a letter and a number.";

function isStrongPassword(password) {
  return typeof password === "string" && PASSWORD_RE.test(password);
}

module.exports = { isStrongPassword, PASSWORD_MESSAGE, PASSWORD_RE };

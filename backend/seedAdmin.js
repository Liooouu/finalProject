// Creates the first administrator account. Two ways in:
//
//   node seedAdmin.js      manual run, from the command line
//   ensureAdmin()          called by server.js on boot when the ADMIN_* env
//                          vars are set, so a fresh deploy is usable without
//                          a shell session
//
// The password is handed to the model as plain text on purpose. User.js hashes
// it in a pre-save hook, and the previous version of this file passed a value
// that had already been hashed, so it was hashed a second time and the seeded
// admin could never log in.
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");

// Development fallbacks for the manual command only. ensureAdmin() is never
// called without explicit credentials, so a deploy can't silently create an
// account with a well-known password.
const DEV_DEFAULTS = {
  email: "admin@tracked.com",
  password: "admin123",
  name: "System Admin",
};

const WEAK_PASSWORDS = new Set(["admin123", "password", "changeme", "admin"]);

/**
 * Creates the first admin account if, and only if, the database has none.
 *
 * - Skips when any admin already exists, so a deleted seed account is never
 *   quietly recreated by a restart.
 * - Refuses to escalate an existing non-admin account that happens to use the
 *   requested email; that would be a privilege escalation triggered by env.
 *
 * Requires an active mongoose connection.
 */
async function ensureAdmin({ email, password, name } = {}, { log = console.log } = {}) {
  if (!email || !password) {
    throw new Error("ensureAdmin requires an email and a password");
  }

  const existingAdmin = await User.findOne({ role: "admin" });
  if (existingAdmin) {
    log(`[seed] An admin already exists (${existingAdmin.email}) — not creating another.`);
    return { created: false, reason: "admin-exists", email: existingAdmin.email };
  }

  const conflict = await User.findOne({ email });
  if (conflict) {
    log(
      `[seed] Refusing to seed: ${email} already belongs to a ${conflict.role} account. ` +
        "Promote it manually if that is intended."
    );
    return { created: false, reason: "email-taken", email };
  }

  if (WEAK_PASSWORDS.has(String(password).toLowerCase()) || String(password).length < 10) {
    log(
      "[seed] WARNING: ADMIN_PASSWORD is weak. Use a long, unique password — " +
        "the admin account can create organizers and manage all users."
    );
  }

  // Plain text: the User model's pre-save hook performs the single hash.
  await User.create({ name: name || "System Admin", email, password, role: "admin" });

  log(`[seed] Admin account created for ${email}. Change the password after first login.`);
  return { created: true, email };
}

module.exports = { ensureAdmin };

// Manual CLI entry point: connect, seed, disconnect.
if (require.main === module) {
  (async () => {
    try {
      await mongoose.connect(process.env.MONGO_URI);
      console.log("[seed] MongoDB connected");

      await ensureAdmin({
        email: process.env.ADMIN_EMAIL || DEV_DEFAULTS.email,
        password: process.env.ADMIN_PASSWORD || DEV_DEFAULTS.password,
        name: process.env.ADMIN_NAME || DEV_DEFAULTS.name,
      });

      await mongoose.disconnect();
      process.exit(0);
    } catch (error) {
      console.error("[seed] Failed:", error.message);
      process.exit(1);
    }
  })();
}

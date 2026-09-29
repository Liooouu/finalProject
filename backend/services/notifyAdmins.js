// backend/services/notifyAdmins.js
// Sends an in-app Notification to every admin account (used for security
// alerts: face-based PIN recovery, lockouts, and student appeals).
const User = require("../models/User");
const Notification = require("../models/Notification");

async function notifyAdmins(title, message, extra = {}) {
  const admins = await User.find({ role: "admin" }).select("_id").lean();
  if (admins.length === 0) return;
  await Notification.insertMany(
    admins.map((u) => ({
      user: u._id,
      type: "system",
      title,
      message,
      ...(extra.relatedEvent ? { relatedEvent: extra.relatedEvent } : {}),
    }))
  );
}

module.exports = { notifyAdmins };
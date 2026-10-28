// services/eventAccess.js
// Who may manage an event. Kept in one place so the event routes, the face
// check-in station and anything added later cannot drift apart on ownership.
const User = require("../models/User");

// Strict ownership: only the creator or an admin. Destructive actions (delete)
// stay here; normal event operations use canManageEventOrAdminCreated below.
function canManageEvent(event, user) {
  if (!event || !user) return false;
  if (user.role === "admin") return true;
  if (user.role !== "organizer") return false;
  return String(event.organizer?._id || event.organizer) === String(user._id);
}

// Attendance operations remain limited to the owner and admin-created events.
async function canManageEventOrAdminCreated(event, user) {
  if (!event || !user) return false;
  if (user.role === "admin") return true;
  if (user.role !== "organizer") return false;

  const ownerId = event.organizer?._id || event.organizer;
  if (String(ownerId) === String(user._id)) return true;

  const creator = await User.findById(ownerId).select("role").lean();
  return creator?.role === "admin";
}

// Recording attendance is an organizer responsibility. Admin access above is
// for event correction and read-only monitoring, not check-in or status entry.
async function canRecordAttendance(event, user) {
  return user?.role === "organizer" && await canManageEventOrAdminCreated(event, user);
}
// Event information is shared work; editing does not transfer ownership.
function canEditEvent(event, user) {
  return Boolean(event && user && ["organizer", "admin"].includes(user.role));
}
module.exports = { canManageEvent, canManageEventOrAdminCreated, canRecordAttendance, canEditEvent };

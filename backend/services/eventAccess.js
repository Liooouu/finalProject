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

// Organizers run their own events and events an admin created. This covers
// attendance plus editing/status changes; deleting an admin-created event still
// requires the admin or the event's original creator.
async function canManageEventOrAdminCreated(event, user) {
  if (!event || !user) return false;
  if (user.role === "admin") return true;
  if (user.role !== "organizer") return false;

  const ownerId = event.organizer?._id || event.organizer;
  if (String(ownerId) === String(user._id)) return true;

  const creator = await User.findById(ownerId).select("role").lean();
  return creator?.role === "admin";
}

module.exports = { canManageEvent, canManageEventOrAdminCreated };

// services/eventAccess.js
// Shared event work and creator-only deletion have separate permissions.

// Strict ownership: only the creator or an admin. Destructive actions (delete)
// stay here; viewing and attendance operations use the shared rules below.
function canManageEvent(event, user) {
  if (!event || !user) return false;
  if (user.role === "admin") return true;
  if (user.role !== "organizer") return false;
  return String(event.organizer?._id || event.organizer) === String(user._id);
}

// Organizers collaborate across events; administrators retain monitoring access.
// Authentication validates the current organizer grant before these checks.
function canViewEventAttendance(event, user) {
  return Boolean(event && user && ["organizer", "admin"].includes(user.role));
}

// Recording attendance is an organizer responsibility. Admin access above is
// for event correction and read-only monitoring, not check-in or status entry.
function canRecordAttendance(event, user) {
  return Boolean(event && user?.role === "organizer");
}
// Event information is shared work; editing does not transfer ownership.
function canEditEvent(event, user) {
  return Boolean(event && user && ["organizer", "admin"].includes(user.role));
}
module.exports = { canManageEvent, canViewEventAttendance, canRecordAttendance, canEditEvent };

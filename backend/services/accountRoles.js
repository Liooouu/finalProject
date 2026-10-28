function availableRoles(user) {
  const roles = [user.role];
  if (user.role === "student" && user.organizerAccess === true) roles.push("organizer");
  return roles;
}
function accountView(user, activeRole = user.role) {
  const data = user.toObject ? user.toObject() : { ...user };
  const roles = availableRoles(user);
  return { ...data, accountRole: user.role, role: roles.includes(activeRole) ? activeRole : user.role, availableRoles: roles };
}
// protect derives accountRole from the stored identity when switching portals.
function hasStudentProfile(user) {
  return user?.role === "student" || (user?.role === "organizer" && user?.accountRole === "student");
}
module.exports = { availableRoles, accountView, hasStudentProfile };

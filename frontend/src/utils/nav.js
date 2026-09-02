const ROLE_PATHS = {
  admin: "/admin/dashboard",
  organizer: "/organizer/dashboard",
  student: "/student/dashboard",
};

export const portalName = {
  admin: "Admin Portal",
  organizer: "Organizer Portal",
  student: "Student Portal",
};

export const profilePathFor = {
  admin: "/admin/dashboard/profile",
  organizer: "/organizer/dashboard/profile",
  student: "/student/dashboard/profile",
};

export const notificationsPathFor = {
  admin: "/admin/dashboard/notifications",
  organizer: "/organizer/dashboard/notifications",
  student: "/student/dashboard/notifications",
};

const TITLES = {
  "/student/dashboard": "Dashboard",
  "/student/dashboard/events": "Attend Events",
  "/student/dashboard/events/": "Event Details",
  "/student/dashboard/community-service": "Community Service",
  "/student/dashboard/submit-excuse": "Submit Excuse",
  "/student/dashboard/notifications": "Notifications",
  "/student/dashboard/profile": "Profile Settings",

  "/organizer/dashboard": "Dashboard",
  "/organizer/dashboard/events": "Manage Events",
  "/organizer/dashboard/events/": "Event Details",
  "/organizer/dashboard/events/detail/attendees": "Manage Attendees",
  "/organizer/dashboard/excuses": "Manage Excuses",
  "/organizer/dashboard/notifications": "Notifications",
  "/organizer/dashboard/profile": "Profile Settings",

  "/admin/dashboard": "Dashboard",
  "/admin/dashboard/create-organizer": "Create Organizer",
  "/admin/dashboard/events": "Manage Events",
  "/admin/dashboard/users": "Manage Users",
  "/admin/dashboard/reports": "Attendance Report",
  "/admin/dashboard/notifications": "Notifications",
  "/admin/dashboard/profile": "Profile Settings",
};

export const getPageTitle = (role, pathname) => {
  const base = ROLE_PATHS[role] || "/";
  const known = TITLES[pathname];
  if (known) return known;
  // Dynamic routes: pick the longest known parent prefix.
  let prefix = pathname;
  while (prefix.length > base.length) {
    prefix = prefix.slice(0, prefix.lastIndexOf("/"));
    if (TITLES[prefix]) return TITLES[prefix];
  }
  return "Dashboard";
};
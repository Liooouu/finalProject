// utils/prefetchRoutes.js
//
// Each page is its own lazy chunk, which is what keeps the first paint cheap —
// but it also means the first click on a nav item waits for a download. These
// helpers start that download before the click: on hover/focus of a nav item
// (the moment the user has clearly decided) and during browser idle time
// (after the current page has painted).
//
// The point is only to hide the wait. A prefetch never blocks, never throws and
// never renders anything, so a failure just means the click behaves exactly as
// it did before.

import { ROLE_PATHS } from "./nav";

// The same module specifiers the shells pass to React.lazy, so Rollup resolves
// these to chunks that already exist instead of creating new ones.
const chunks = {
  // Student portal
  [ROLE_PATHS.student]: () => import("../components/student/StDashboardHome"),
  "/student/dashboard/events": () => import("../components/student/AttendEvents"),
  "/student/dashboard/community-service": () => import("../components/student/CommunityService"),
  "/student/dashboard/submit-excuse": () => import("../components/student/SubmitExcuse"),
  "/student/dashboard/notifications": () => import("../components/student/NotificationsPage"),
  "/student/dashboard/profile": () => import("../components/settings/ProfileSettings"),

  // Organizer portal
  [ROLE_PATHS.organizer]: () => import("../components/organizer/OrgDashboardHome"),
  "/organizer/dashboard/events": () => import("../components/organizer/OrgManageEvents"),
  "/organizer/dashboard/excuses": () => import("../components/organizer/ManageExcuses"),
  "/organizer/dashboard/manual-attendance": () => import("../components/organizer/ManualAttendance"),
  "/organizer/dashboard/profile": () => import("../components/settings/ProfileSettings"),

  // Admin portal
  [ROLE_PATHS.admin]: () => import("../components/admin/DashboardHome"),
  "/admin/dashboard/events": () => import("../components/admin/ManageEvents"),
  "/admin/dashboard/excuses": () => import("../components/organizer/ManageExcuses"),
  "/admin/dashboard/users": () => import("../components/admin/ManageUsers"),
  "/admin/dashboard/promote-student": () => import("../components/admin/PromoteStudentPage"),
  "/admin/dashboard/reports": () => import("../components/admin/AttendanceReports"),
  "/admin/dashboard/profile": () => import("../components/settings/ProfileSettings"),
};

// Charts and the export tooling make the report the one page worth 190 KB. It
// is fetched when its nav item is hovered, never on idle.
const HEAVY = new Set(["/admin/dashboard/reports"]);

// Routes worth warming on idle: the pages a portal opens first.
const IDLE_ROUTES = {
  student: [
    ROLE_PATHS.student,
    "/student/dashboard/events",
    "/student/dashboard/community-service",
  ],
  organizer: [
    ROLE_PATHS.organizer,
    "/organizer/dashboard/events",
    "/organizer/dashboard/excuses",
  ],
  admin: [
    ROLE_PATHS.admin,
    "/admin/dashboard/events",
    "/admin/dashboard/excuses",
    "/admin/dashboard/users",
    "/admin/dashboard/promote-student",
  ],
};

const started = new Set();

const start = (path) => {
  const loader = chunks[path];
  if (!loader || started.has(path)) return;
  started.add(path);
  loader().catch(() => {
    // Offline, or a deploy replaced the chunks: forget it so a later hover can
    // try again instead of giving up for the rest of the session.
    started.delete(path);
  });
};

/** Warm one route — call it from a nav item's hover/focus. */
export const prefetchRoute = (path) => {
  if (path) start(path);
};

/** Warm a portal's first pages once the browser is idle. */
export const prefetchIdle = (role) => {
  const paths = (IDLE_ROUTES[role] || []).filter((path) => !HEAVY.has(path));
  if (!paths.length) return;

  // Respect data-saver and very slow connections: a prefetch is a convenience,
  // never worth someone's metered bandwidth.
  const connection = typeof navigator !== "undefined" ? navigator.connection : null;
  if (connection?.saveData) return;
  if (/^(slow-)?2g$/.test(connection?.effectiveType || "")) return;

  const run = () => {
    if (document.visibilityState !== "visible") return;
    paths.forEach(start);
  };
  // requestIdleCallback keeps this off the critical path; older Safari lacks it,
  // so fall back to a timer that is comfortably after first paint.
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    window.requestIdleCallback(run, { timeout: 4000 });
  } else {
    setTimeout(run, 1500);
  }
};

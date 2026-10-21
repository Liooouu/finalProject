import React from "react";
import {
  FaHome,
  FaCalendarAlt,
  FaUsers,
  FaUserPlus,
  FaChartBar,
  FaBell,
  FaEdit,
  FaClock,
  FaShieldAlt,
  FaKey,
  FaEnvelopeOpenText,
  FaUserCircle,
  FaCalendarCheck,
} from "react-icons/fa";
import { ROLE_PATHS } from "./nav";

const dashboardItem = { name: "Dashboard", path: ROLE_PATHS.admin, icon: <FaHome />, end: true };

export const navSections = {
  admin: [
    {
      label: "Overview",
      items: [{ ...dashboardItem, path: ROLE_PATHS.admin }],
    },
    {
      label: "Management",
      items: [
        { name: "Manage Events", path: "/admin/dashboard/events", icon: <FaCalendarAlt /> },
        { name: "Manage Users", path: "/admin/dashboard/users", icon: <FaUsers /> },
        {
          name: "Create Organizer",
          path: "/admin/dashboard/create-organizer",
          icon: <FaUserPlus />,
        },
      ],
    },
    {
      label: "Security & insight",
      items: [
        {
          name: "PIN Reset Requests",
          path: "/admin/dashboard/pin-resets",
          icon: <FaKey />,
          badge: "pinResets",
        },
        { name: "Attendance Report", path: "/admin/dashboard/reports", icon: <FaChartBar /> },
      ],
    },
    {
      label: "System",
      items: [
        { name: "Notifications", path: "/admin/dashboard/notifications", icon: <FaBell /> },
        {
          name: "Email Settings",
          path: "/admin/dashboard/settings/email",
          icon: <FaEnvelopeOpenText />,
        },
      ],
    },
    {
      label: "Account",
      items: [
        { name: "Profile", path: "/admin/dashboard/profile", icon: <FaUserCircle /> },
      ],
    },
  ],
  organizer: [
    {
      label: "Overview",
      items: [{ ...dashboardItem, path: ROLE_PATHS.organizer }],
    },
    {
      label: "Management",
      items: [
        { name: "Manage Events", path: "/organizer/dashboard/events", icon: <FaCalendarAlt /> },
        {
          name: "Manage Excuses",
          path: "/organizer/dashboard/excuses",
          icon: <FaEdit />,
          badge: "excuses",
        },
      ],
    },
    {
      label: "Support",
      items: [
        {
          name: "PIN Reset Requests",
          path: "/organizer/dashboard/pin-resets",
          icon: <FaKey />,
          badge: "pinResets",
        },
        { name: "Notifications", path: "/organizer/dashboard/notifications", icon: <FaBell /> },
      ],
    },
    {
      label: "Account",
      items: [
        { name: "Profile", path: "/organizer/dashboard/profile", icon: <FaUserCircle /> },
      ],
    },
  ],
  student: [
    {
      label: "Overview",
      items: [
        { ...dashboardItem, path: ROLE_PATHS.student },
        { name: "Attend Events", path: "/student/dashboard/events", icon: <FaCalendarCheck /> },
      ],
    },
    {
      label: "Service",
      items: [
        {
          name: "Community Service",
          path: "/student/dashboard/community-service",
          icon: <FaClock />,
        },
        { name: "Submit Excuse", path: "/student/dashboard/submit-excuse", icon: <FaEdit /> },
      ],
    },
    {
      label: "Account",
      items: [
        { name: "Notifications", path: "/student/dashboard/notifications", icon: <FaBell /> },
        { name: "Security", path: "/student/dashboard/security", icon: <FaShieldAlt /> },
        { name: "Profile", path: "/student/dashboard/profile", icon: <FaUserCircle /> },
      ],
    },
  ],
};

export const flatNavItems = (role) =>
  (navSections[role] || []).flatMap((section) =>
    section.items.map((item) => ({ ...item, group: section.label }))
  );

export const isNavItemActive = (item, pathname) => {
  if (!item?.path) return false;
  if (item.end) return pathname === item.path;
  return pathname === item.path || pathname.startsWith(`${item.path}/`);
};

const portalShort = { admin: "Admin", organizer: "Organizer", student: "Student" };

/**
 * Parent trail only (portal + the nav section the current route belongs to).
 * The page title is appended by the shell because pages can override it
 * through PageMetaContext.
 */
export const breadcrumbTrail = (role, pathname) => {
  const base = ROLE_PATHS[role] || "/";
  const trail = [{ label: portalShort[role] || "Portal", to: base }];

  const match = flatNavItems(role)
    .filter(
      (item) =>
        item.path !== base &&
        (pathname === item.path || pathname.startsWith(`${item.path}/`))
    )
    .sort((a, b) => b.path.length - a.path.length)[0];

  if (match) trail.push({ label: match.name, to: match.path });
  return trail;
};

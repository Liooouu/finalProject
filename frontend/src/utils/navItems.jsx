import React from "react";
import {
  FaHome,
  FaCalendarAlt,
  FaUsers,
  FaUserPlus,
  FaChartBar,
  FaEdit,
  FaClock,
  FaCalendarCheck,
} from "react-icons/fa";
import { ROLE_PATHS } from "./nav";

const dashboardItem = { name: "Dashboard", path: ROLE_PATHS.admin, icon: <FaHome />, end: true };

const sectionsByRole = {
  admin: [
    {
      label: "Overview",
      items: [{ ...dashboardItem, path: ROLE_PATHS.admin }],
    },
    {
      label: "Management",
      items: [
        { name: "Manage Events", path: "/admin/dashboard/events", icon: <FaCalendarAlt /> },
        { name: "Manual Reviews", path: "/admin/dashboard/manual-reviews", icon: <FaCalendarCheck />, badge: "manual" },
        {
          name: "Manage Excuses",
          path: "/admin/dashboard/excuses",
          icon: <FaEdit />,
          badge: "excuses",
        },
        { name: "Manage Users", path: "/admin/dashboard/users", icon: <FaUsers /> },
        {
          name: "Promote Student",
          path: "/admin/dashboard/promote-student",
          icon: <FaUserPlus />,
        },
      ],
    },
    {
      label: "Security & insight",
      items: [
        { name: "Attendance Report", path: "/admin/dashboard/reports", icon: <FaChartBar /> },
      ],
    },
    {
      label: "Account",
      items: [
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
        { name: "Manual Attendance", path: "/organizer/dashboard/manual-attendance", icon: <FaCalendarCheck /> },
        { name: "Manual Requests", path: "/organizer/dashboard/manual-reviews", icon: <FaClock />, badge: "manual" },
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
      ],
    },
    {
      label: "Account",
      items: [
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
      ],
    },
  ],
};

// Account and notification access live in the top bar. Drop empty groups.
export const navSections = Object.fromEntries(
  Object.entries(sectionsByRole).map(([role, sections]) => [role, sections.filter((section) => section.items.length > 0)])
);

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

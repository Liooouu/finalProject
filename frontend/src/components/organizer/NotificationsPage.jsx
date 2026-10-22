import React from "react";
import { FaCalendarAlt, FaEdit, FaUsers } from "react-icons/fa";
import NotificationCenter from "../shared/NotificationCenter";

const ORGANIZER_ACTIONS = [
  {
    icon: <FaEdit />,
    label: "Manage excuses",
    description: "Review student excuse letters",
    to: "/organizer/dashboard/excuses",
  },
  {
    icon: <FaCalendarAlt />,
    label: "Manage events",
    description: "View and edit your events",
    to: "/organizer/dashboard/events",
  },
];

const ADMIN_ACTIONS = [
  {
    icon: <FaCalendarAlt />,
    label: "Manage events",
    description: "View and manage all events",
    to: "/admin/dashboard/events",
  },
  {
    icon: <FaEdit />,
    label: "Review excuses",
    description: "Act on student excuse letters",
    to: "/admin/dashboard/excuses",
  },
  {
    icon: <FaUsers />,
    label: "Manage users",
    description: "Review students and staff",
    to: "/admin/dashboard/users",
  },
];

const NotificationsPage = ({ role = "organizer" }) => (
  <NotificationCenter
    role={role}
    actions={role === "admin" ? ADMIN_ACTIONS : ORGANIZER_ACTIONS}
  />
);

export default NotificationsPage;

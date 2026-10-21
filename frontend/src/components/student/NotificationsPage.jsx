import React from "react";
import { FaCalendarAlt } from "react-icons/fa";
import { FaChartBar } from "react-icons/fa6";
import NotificationCenter from "../shared/NotificationCenter";

const ACTIONS = [
  {
    icon: <FaCalendarAlt />,
    label: "View events",
    description: "Check upcoming events",
    to: "/student/dashboard/events",
  },
  {
    icon: <FaChartBar />,
    label: "Community service",
    description: "View your attendance records",
    to: "/student/dashboard/community-service",
  },
];

const NotificationsPage = () => <NotificationCenter actions={ACTIONS} />;

export default NotificationsPage;

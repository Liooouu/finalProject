import React from "react";
import { FaCamera, FaClock, FaBell, FaChartBar } from "react-icons/fa";

// Shared feature blurb — the four cards shown on the auth page's desktop
// panel and on the pre-login landing page.
const features = [
  {
    icon: <FaCamera />,
    title: "Face check-in",
    desc: "Enroll your face, then check in at an organizer-operated face station.",
  },
  {
    icon: <FaClock />,
    title: "Community service ledger",
    desc: "Track required service hours from attendance penalties and approved adjustments.",
  },
  {
    icon: <FaBell />,
    title: "Event and attendance updates",
    desc: "Receive notifications about events, excuse decisions, and attendance changes.",
  },
  {
    icon: <FaChartBar />,
    title: "Attendance reports",
    desc: "Admins review attendance summaries and export filtered CSV reports.",
  },
];

export default features;

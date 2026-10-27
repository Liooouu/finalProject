import React from "react";
import { FaCamera, FaClock, FaBell, FaChartBar } from "react-icons/fa";

// Shared feature blurb — the four cards shown on the auth page's desktop
// panel and on the pre-login landing page.
const features = [
  {
    icon: <FaCamera />,
    title: "Face check-in",
    desc: "Look at the organizer's kiosk camera — no login, no QR code.",
  },
  {
    icon: <FaClock />,
    title: "Community service hours",
    desc: "Earn and track every required hour.",
  },
  {
    icon: <FaBell />,
    title: "Real-time notifications",
    desc: "Instant updates on events, excuses, and statuses.",
  },
  {
    icon: <FaChartBar />,
    title: "Live attendance reports",
    desc: "Organizers and admins see everything at a glance.",
  },
];

export default features;

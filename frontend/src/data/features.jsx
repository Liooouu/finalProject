import React from "react";
import { FaQrcode, FaClock, FaBell, FaChartBar } from "react-icons/fa";

// Shared feature blurb — the four cards shown on the auth page's desktop
// panel and on the pre-login landing page.
const features = [
  {
    icon: <FaQrcode />,
    title: "QR & map check-in",
    desc: "Scan your code or mark attendance in one tap.",
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

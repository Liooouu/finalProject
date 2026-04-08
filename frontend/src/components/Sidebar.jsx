import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { logout } from "../utils/auth";

const Sidebar = ({ role }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [active, setActive] = useState(location.pathname);

  const menuItems = {
    admin: [
      { name: "Dashboard", path: "/admin/dashboard" },
      { name: "Create Organizer", path: "/admin/dashboard/create-organizer" },
      { name: "Manage Events", path: "/admin/dashboard/events" },
      { name: "Manage Users", path: "/admin/dashboard/users" },
      { name: "Attendance Report", path: "/admin/dashboard/reports" },
      { name: "Account Settings", path: "/admin/dashboard/account-settings" },
      { name: "Log Out", action: logout },
    ],
    organizer: [
      { name: "Dashboard", path: "/organizer/dashboard" },
      { name: "Manage Events", path: "/organizer/dashboard/events" },
      { name: "Manage Attendees", path: "/organizer/dashboard/attendees" },
      { name: "Account Settings", path: "/organizer/dashboard/account-settings" },
      { name: "Log Out", action: logout },
    ],
    student: [
      { name: "Dashboard", path: "/student/dashboard" },
      { name: "Attend Events", path: "/student/dashboard/events" },
      { name: "My Attendance", path: "/student/dashboard/attendance" },
      { name: "Account Settings", path: "/student/dashboard/account-settings" },
      { name: "Log Out", action: logout },
    ],
  };

  const items = menuItems[role] || [];

  const handleClick = (item) => {
    if (item.action) {
      item.action();
    } else {
      setActive(item.path);
      navigate(item.path);
    }
  };

  return (
    <div className="w-64 bg-[#0f0f14] text-white p-6 min-h-screen flex flex-col">
      <h2 className="text-2xl font-bold mb-10">
        Track<span className="text-red-400">Ed</span>
      </h2>

      <nav className="flex-1 flex flex-col gap-4">
        {items.map((item, idx) => (
          <p
            key={idx}
            onClick={() => handleClick(item)}
            className={`cursor-pointer px-2 py-1 rounded ${
              active === item.path
                ? "bg-red-400 text-white"
                : "text-gray-300 hover:text-red-400"
            }`}
          >
            {item.name}
          </p>
        ))}
      </nav>
    </div>
  );
};

export default Sidebar;
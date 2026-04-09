import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { logout } from "../utils/auth";
import { FaHome, FaUser, FaUsers, FaCalendarAlt, FaChartBar, FaCog, FaBell, FaEdit, FaClock, FaDoorOpen } from "react-icons/fa";

const Sidebar = ({ role }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = {
    admin: [
      { name: "Dashboard", path: "/admin/dashboard", icon: <FaHome /> },
      { name: "Create Organizer", path: "/admin/dashboard/create-organizer", icon: <FaUser /> },
      { name: "Manage Events", path: "/admin/dashboard/events", icon: <FaCalendarAlt /> },
      { name: "Manage Users", path: "/admin/dashboard/users", icon: <FaUsers /> },
      { name: "Attendance Report", path: "/admin/dashboard/reports", icon: <FaChartBar /> },
      { name: "Account Settings", path: "/admin/dashboard/account-settings", icon: <FaCog /> },
    ],
    organizer: [
      { name: "Dashboard", path: "/organizer/dashboard", icon: <FaHome /> },
      { name: "Manage Events", path: "/organizer/dashboard/events", icon: <FaCalendarAlt /> },
      { name: "Manage Excuses", path: "/organizer/dashboard/excuses", icon: <FaEdit /> },
      { name: "Notifications", path: "/organizer/dashboard/notifications", icon: <FaBell /> },
      { name: "My Profile", path: "/organizer/dashboard/profile", icon: <FaUser /> },
      { name: "Account Settings", path: "/organizer/dashboard/account-settings", icon: <FaCog /> },
    ],
    student: [
      { name: "Dashboard", path: "/student/dashboard", icon: <FaHome /> },
      { name: "Attend Events", path: "/student/dashboard/events", icon: <FaCalendarAlt /> },
      { name: "Community Service", path: "/student/dashboard/community-service", icon: <FaClock /> },
      { name: "Submit Excuse", path: "/student/dashboard/submit-excuse", icon: <FaEdit /> },
      { name: "Notifications", path: "/student/dashboard/notifications", icon: <FaBell /> },
      { name: "My Profile", path: "/student/dashboard/profile", icon: <FaUser /> },
      { name: "Account Settings", path: "/student/dashboard/account-settings", icon: <FaCog /> },
    ],
  };

  const items = menuItems[role] || [];

  const handleClick = (item) => {
    if (item.action) {
      item.action();
    } else {
      navigate(item.path);
    }
  };

  const isActive = (path) => location.pathname === path;

  return (
    <div className="w-64 bg-linear-to-b from-[#0f0f14] to-[#1a1a24] text-white p-4 min-h-screen flex flex-col border-r border-white/5">
      <div className="mb-8 px-2">
        <h2 className="text-2xl font-bold tracking-tight">
          Track<span className="text-red-400">ED</span>
        </h2>
        <p className="text-xs text-gray-500 mt-1 capitalize">{role} Portal</p>
      </div>

      <nav className="flex-1 flex flex-col gap-1">
        {items.map((item, idx) => (
          <button
            key={idx}
            onClick={() => handleClick(item)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 group ${
              isActive(item.path)
                ? "bg-linear-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-600/20"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            <span className="font-medium text-sm">{item.name}</span>
            {isActive(item.path) && (
              <span className="ml-auto w-2 h-2 bg-white rounded-full animate-pulse" />
            )}
          </button>
        ))}
      </nav>

      <div className="mt-auto pt-4 border-t border-white/5">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 w-full"
        >
          <span className="text-lg"><FaDoorOpen /></span>
          <span className="font-medium text-sm">Log Out</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;

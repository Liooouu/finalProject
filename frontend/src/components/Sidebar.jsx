import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaHome, FaUser, FaUsers, FaCalendarAlt, FaChartBar, FaEdit, FaClock, FaSignOutAlt, FaIdBadge } from "react-icons/fa";
import { getUserFromToken } from "../utils/auth";

const Sidebar = ({ role }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUserFromToken();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const menuItems = {
    admin: [
      { name: "Dashboard", path: "/admin/dashboard", icon: <FaHome /> },
      { name: "Create Organizer", path: "/admin/dashboard/create-organizer", icon: <FaUser /> },
      { name: "Manage Events", path: "/admin/dashboard/events", icon: <FaCalendarAlt /> },
      { name: "Manage Users", path: "/admin/dashboard/users", icon: <FaUsers /> },
      { name: "Attendance Report", path: "/admin/dashboard/reports", icon: <FaChartBar /> },
    ],
    organizer: [
      { name: "Dashboard", path: "/organizer/dashboard", icon: <FaHome /> },
      { name: "Manage Events", path: "/organizer/dashboard/events", icon: <FaCalendarAlt /> },
      { name: "Manage Excuses", path: "/organizer/dashboard/excuses", icon: <FaEdit /> },
    ],
    student: [
      { name: "Dashboard", path: "/student/dashboard", icon: <FaHome /> },
      { name: "Attend Events", path: "/student/dashboard/events", icon: <FaCalendarAlt /> },
      { name: "Community Service", path: "/student/dashboard/community-service", icon: <FaClock /> },
      { name: "Submit Excuse", path: "/student/dashboard/submit-excuse", icon: <FaEdit /> },
    ],
  };

  const profilePaths = {
    admin: "/admin/dashboard/profile",
    organizer: "/organizer/dashboard/profile",
    student: "/student/dashboard/profile",
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

      {/* User Menu */}
      <div className="mt-auto pt-4 border-t border-white/10 relative" ref={menuRef}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
        >
          <div className="w-9 h-9 rounded-full bg-linear-to-br from-red-500 to-red-700 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {user?.id?.slice(-2).toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium text-white truncate capitalize">{role}</p>
            <p className="text-xs text-gray-500 truncate">{user?.role || role}</p>
          </div>
          <span className={`text-gray-500 text-xs transition-transform duration-200 ${showMenu ? "rotate-180" : ""}`}>▾</span>
        </button>

        {showMenu && (
          <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#1a1a24] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
            <button
              onClick={() => {
                navigate(profilePaths[role]);
                setShowMenu(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:bg-white/5 hover:text-white transition-colors text-sm"
            >
              <FaIdBadge /> My Profile
            </button>
            <button
              onClick={() => {
                localStorage.removeItem("token");
                navigate("/auth");
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:bg-white/5 hover:text-red-400 transition-colors text-sm border-t border-white/5"
            >
              <FaSignOutAlt /> Log Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;

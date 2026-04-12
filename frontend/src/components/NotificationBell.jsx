import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { FaBell } from "react-icons/fa";

const NotificationBell = ({ role }) => {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);

  const fetchUnreadCount = async () => {
    try {
      const res = await api.get("/notifications/unread-count");
      setUnreadCount(res.data.count);
    } catch (err) {
      console.error(err.response?.data || err.message);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const getNotificationPath = () => {
    switch (role) {
      case "student": return "/student/dashboard/notifications";
      case "organizer": return "/organizer/dashboard/notifications";
      case "admin": return "/admin/dashboard/notifications";
      default: return "/";
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => {
          setShowDropdown(!showDropdown);
          if (!showDropdown) navigate(getNotificationPath());
        }}
        className="relative p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
      >
        <FaBell className="text-lg text-gray-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
};

export default NotificationBell;

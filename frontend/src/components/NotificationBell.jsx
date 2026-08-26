import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { FaBell } from "react-icons/fa";

const paths = {
  student: "/student/dashboard/notifications",
  organizer: "/organizer/dashboard/notifications",
  admin: "/admin/dashboard/notifications",
};

const NotificationBell = ({ role }) => {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUnreadCount = () => {
      api
        .get("/notifications/unread-count")
        .then((res) => setUnreadCount(res.data.count))
        .catch(() => {});
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <button
      onClick={() => navigate(paths[role] || "/")}
      className="relative p-2 rounded-lg bg-card hover:bg-card-alt transition-colors text-on-dim"
      title="Notifications"
    >
      <FaBell className="text-lg" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
};

export default NotificationBell;

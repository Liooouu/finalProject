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
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-on-dim transition-colors hover:bg-card-alt hover:text-on"
      title="Notifications"
      aria-label="Notifications"
    >
      <FaBell className="text-sm" />
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
};

export default NotificationBell;

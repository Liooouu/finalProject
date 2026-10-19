import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { FaBell } from "react-icons/fa";
import { NOTIFICATIONS_CHANGED_EVENT } from "../utils/helpers";

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

    // React immediately when a notifications page marks items read/deletes
    // them, and when the tab regains focus after being backgrounded.
    const onChanged = () => fetchUnreadCount();
    const onFocus = () => fetchUnreadCount();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
      window.removeEventListener("focus", onFocus);
    };
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

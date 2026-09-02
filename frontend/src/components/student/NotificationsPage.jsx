import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { FaCalendarAlt, FaExclamationTriangle, FaCheck, FaBell, FaBolt, FaInfo, FaTrash, FaEdit } from "react-icons/fa";
import { FaChartBar } from "react-icons/fa6";
import Loading from "../shared/Loading";
import { usePageMeta } from "../../context/PageMetaContext";
import EmptyState from "../shared/EmptyState";
import Button from "../ui/Button";
import ConfirmDialog from "../ui/ConfirmDialog";

const NotificationsPage = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);

  usePageMeta("Notifications", "Stay updated with your events.");

  const fetchNotifications = async () => {
    try {
      const res = await api.get("/notifications");
      setNotifications(res.data);
    } catch (err) {
      console.error(err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(notifications.map(n => 
        n._id === id ? { ...n, isRead: true } : n
      ));
    } catch (err) {
      console.error(err.response?.data || err.message);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch("/notifications/read-all");
      setNotifications(notifications.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error(err.response?.data || err.message);
    }
  };

  const deleteNotification = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(notifications.filter(n => n._id !== id));
    } catch (err) {
      console.error(err.response?.data || err.message);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case "attendance": return <FaCalendarAlt />;
      case "excuse": return <FaEdit />;
      case "penalty": return <FaExclamationTriangle />;
      case "system": return <FaBolt />;
      default: return <FaInfo />;
    }
  };

  const typeConfig = {
    attendance: { bg: "bg-blue-500/20", text: "dark:text-blue-400 text-blue-600", label: "Attendance" },
    excuse: { bg: "bg-yellow-500/20", text: "dark:text-yellow-400 text-yellow-600", label: "Excuse" },
    penalty: { bg: "bg-red-500/20", text: "dark:text-red-400 text-red-600", label: "Penalty" },
    system: { bg: "bg-purple-500/20", text: "dark:text-purple-400 text-purple-600", label: "System" },
    info: { bg: "bg-gray-500/20", text: "dark:text-gray-400 text-gray-600", label: "Info" },
  };

  const formatTime = (date) => {
    const now = new Date();
    const then = new Date(date);
    const diff = Math.floor((now - then) / 1000);
    
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
    return then.toLocaleDateString();
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (loading) {
    return <Loading label="Loading notifications..." />;
  }

  return (
    <div className="space-y-6">
      {unreadCount > 0 && (
        <div className="flex justify-end">
          <Button
            onClick={markAllAsRead}
            variant="secondary"
            size="sm"
          >
            <FaCheck className="text-xs" />
            Mark all as read ({unreadCount})
          </Button>
        </div>
      )}

      <div className="space-y-4">
        {notifications.map((notif) => {
          const config = typeConfig[notif.type] || typeConfig.info;
          return (
            <div
              key={notif._id}
              onClick={() => !notif.isRead && markAsRead(notif._id)}
              className={`cursor-pointer rounded-xl border bg-card p-6 transition-all duration-200 hover:shadow-lg ${
                notif.isRead
                  ? "border-line opacity-65"
                  : "border-indigo-500/40 shadow-md shadow-indigo-900/5"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${config.bg} ${config.text}`}>
                  <span className="text-lg">{getIcon(notif.type)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-on">{notif.title}</h3>
                      <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.text}`}>
                        {config.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-on-muted">{formatTime(notif.createdAt)}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(notif._id);
                        }}
                        className="p-1 text-on-muted transition-colors hover:text-red-500"
                        aria-label="Delete notification"
                      >
                        <FaTrash className="text-sm" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-on-dim">{notif.message}</p>
                  {!notif.isRead && (
                    <span className="mt-3 inline-block rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                      New
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {notifications.length === 0 && (
        <EmptyState
          icon={<FaBell />}
          title="No notifications yet"
          description="You're all caught up."
        />
      )}

      <div className="rounded-xl border border-line bg-card p-6">
        <h3 className="text-lg font-semibold text-on mb-4 flex items-center gap-2">
          <span className="text-indigo-500"><FaBolt /></span> Quick Actions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => navigate("/student/dashboard/events")}
            className="p-4 bg-card hover:bg-card-alt rounded-xl border border-line text-left group transition-colors"
          >
            <p className="font-medium text-on group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors flex items-center gap-2"><FaCalendarAlt /> View Events</p>
            <p className="text-sm text-on-dim mt-1">Check upcoming events</p>
          </button>
          <button
            onClick={() => navigate("/student/dashboard/community-service")}
            className="p-4 bg-card hover:bg-card-alt rounded-xl border border-line text-left group transition-colors"
          >
            <p className="font-medium text-on group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors flex items-center gap-2"><FaChartBar /> Community Service</p>
            <p className="text-sm text-on-dim mt-1">View your records</p>
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete notification?"
        message="This notification will be permanently removed."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          const target = deleteTarget;
          setDeleteTarget(null);
          deleteNotification(target);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default NotificationsPage;

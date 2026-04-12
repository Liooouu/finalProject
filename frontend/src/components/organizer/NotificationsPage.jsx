import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { FaEdit, FaCalendarAlt, FaCheck, FaBell, FaBolt, FaInfo, FaTrash } from "react-icons/fa";

const NotificationsPage = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

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
    attendance: { bg: "bg-blue-500/20", text: "text-blue-400", label: "Attendance" },
    excuse: { bg: "bg-yellow-500/20", text: "text-yellow-400", label: "Excuse" },
    penalty: { bg: "bg-red-500/20", text: "text-red-400", label: "Penalty" },
    system: { bg: "bg-purple-500/20", text: "text-purple-400", label: "System" },
    info: { bg: "bg-gray-500/20", text: "text-gray-400", label: "Info" },
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
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Loading notifications...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Notifications</h1>
          <p className="text-gray-400 mt-1">Stay updated with your events</p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors text-sm"
          >
            Mark all as read ({unreadCount})
          </button>
        )}
      </div>

      <div className="space-y-4">
        {notifications.map((notif) => {
          const config = typeConfig[notif.type] || typeConfig.info;
          return (
            <div
              key={notif._id}
              onClick={() => !notif.isRead && markAsRead(notif._id)}
              className={`bg-linear-to-br from-white/10 to-white/5 backdrop-blur-sm border-l-4 rounded-2xl p-6 transition-all duration-200 hover:shadow-lg cursor-pointer ${
                notif.isRead ? "border-l-gray-500 opacity-70" : "border-l-green-500"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${config.bg}`}>
                  <span className={`text-2xl ${config.text}`}>{getIcon(notif.type)}</span>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-white">{notif.title}</h3>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mt-1 ${config.bg} ${config.text}`}>
                        {config.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">{formatTime(notif.createdAt)}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notif._id);
                        }}
                        className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                      >
                        <FaTrash className="text-sm" />
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-300">{notif.message}</p>
                  {!notif.isRead && (
                    <span className="inline-block mt-3 text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
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
        <div className="bg-linear-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-12 text-center">
          <span className="text-5xl mb-4 block"><FaBell /></span>
          <p className="text-gray-400">No notifications yet</p>
        </div>
      )}

      <div className="bg-linear-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span><FaBolt /></span> Quick Actions
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          <button
            onClick={() => navigate("/organizer/dashboard/excuses")}
            className="p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 hover:border-yellow-500/30 transition-all duration-200 text-left group"
          >
            <p className="font-medium text-white group-hover:text-yellow-400 transition-colors flex items-center gap-2"><FaEdit /> Manage Excuses</p>
            <p className="text-sm text-gray-400 mt-1">Review student excuse letters</p>
          </button>
          <button
            onClick={() => navigate("/organizer/dashboard/events")}
            className="p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 hover:border-green-500/30 transition-all duration-200 text-left group"
          >
            <p className="font-medium text-white group-hover:text-green-400 transition-colors flex items-center gap-2"><FaCalendarAlt /> Manage Events</p>
            <p className="text-sm text-gray-400 mt-1">View and edit your events</p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationsPage;

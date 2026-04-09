import React from "react";
import { useNavigate } from "react-router-dom";
import { FaEdit, FaCalendarAlt, FaCheck, FaBell, FaBolt, FaInfo } from "react-icons/fa";

const NotificationsPage = () => {
  const navigate = useNavigate();

  const notifications = [
    {
      id: 1,
      type: "excuse",
      icon: <FaEdit />,
      title: "New Excuse Submitted",
      message: "John Doe has submitted an excuse letter for the 'Library Workshop' event.",
      time: "1 hour ago",
      unread: true,
    },
    {
      id: 2,
      type: "event",
      icon: <FaCalendarAlt />,
      title: "Attendance Window Opened",
      message: "The attendance window for 'Campus Cleanup Drive' is now open.",
      time: "2 hours ago",
      unread: true,
    },
    {
      id: 3,
      type: "info",
      icon: <FaInfo />,
      title: "Weekly Report Ready",
      message: "Your weekly attendance summary is ready to view.",
      time: "1 day ago",
      unread: false,
    },
    {
      id: 4,
      type: "success",
      icon: <FaCheck />,
      title: "Excuse Approved",
      message: "You approved the excuse for 'Sports Day' event.",
      time: "2 days ago",
      unread: false,
    },
    {
      id: 5,
      type: "event",
      icon: <FaCalendarAlt />,
      title: "New Event Created",
      message: "You created a new event 'Community Outreach Program'.",
      time: "3 days ago",
      unread: false,
    },
  ];

  const typeConfig = {
    excuse: { bg: "bg-yellow-500/20", text: "text-yellow-400", border: "border-yellow-500/30" },
    event: { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/30" },
    info: { bg: "bg-gray-500/20", text: "text-gray-400", border: "border-gray-500/30" },
    success: { bg: "bg-green-500/20", text: "text-green-400", border: "border-green-500/30" },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Notifications</h1>
        <p className="text-gray-400 mt-1">Stay updated with your events</p>
      </div>

      {/* Notifications List */}
      <div className="space-y-4">
        {notifications.map((notif) => {
          const type = typeConfig[notif.type];
          return (
            <div
              key={notif.id}
              className={`bg-linear-to-br from-white/10 to-white/5 backdrop-blur-sm border-l-4 rounded-2xl p-6 transition-all duration-200 hover:shadow-lg ${
                notif.unread ? "border-l-red-500" : "border-l-gray-500"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-white/5 rounded-xl">
                  <span className="text-2xl">{notif.icon}</span>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-white">{notif.title}</h3>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mt-1 ${type.bg} ${type.text}`}>
                        {notif.type.charAt(0).toUpperCase() + notif.type.slice(1)}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">{notif.time}</span>
                  </div>
                  <p className="text-gray-300">{notif.message}</p>
                  {notif.unread && (
                    <span className="inline-block mt-3 text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-full">
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

      {/* Quick Actions */}
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
            className="p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 hover:border-red-500/30 transition-all duration-200 text-left group"
          >
            <p className="font-medium text-white group-hover:text-red-400 transition-colors flex items-center gap-2"><FaCalendarAlt /> Manage Events</p>
            <p className="text-sm text-gray-400 mt-1">View and edit your events</p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationsPage;

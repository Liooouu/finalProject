import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";

const OrganizerHome = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalEvents: 0, totalAttendees: 0, pendingExcuses: 0 });
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get("/organizer/stats");
        setStats(res.data);
      } catch (err) {
        console.error(err.response?.data || err.message);
      }
    };
    fetchStats();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const dummyNotifications = [
    { id: 1, message: "New excuse submitted by a student", time: "1 hour ago", unread: true },
    { id: 2, message: "Event 'Campus Cleanup' has upcoming attendance", time: "3 hours ago", unread: true },
    { id: 3, message: "Weekly attendance report ready", time: "1 day ago", unread: false },
  ];

  const unreadCount = dummyNotifications.filter(n => n.unread).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Welcome, Organizer!</h1>
          <p className="text-gray-400 mt-1">Manage your events and track attendance</p>
        </div>
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl hover:bg-white/10 transition-all duration-200"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-medium animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>
          
          {showNotifications && (
            <div className="absolute right-0 mt-3 w-80 bg-white/10 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-4 border-b border-white/10">
                <h3 className="font-semibold text-white">Notifications</h3>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {dummyNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-4 border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors ${
                      notif.unread ? "bg-red-500/5" : ""
                    }`}
                    onClick={() => {
                      navigate("/organizer/dashboard/notifications");
                      setShowNotifications(false);
                    }}
                  >
                    <p className="text-sm text-white">{notif.message}</p>
                    <p className="text-xs text-gray-500 mt-1">{notif.time}</p>
                  </div>
                ))}
              </div>
              <div
                className="p-3 text-center text-sm text-red-400 hover:bg-white/5 cursor-pointer transition-colors"
                onClick={() => {
                  navigate("/organizer/dashboard/notifications");
                  setShowNotifications(false);
                }}
              >
                View all notifications →
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="group bg-linear-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-red-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-red-500/10">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-500/20 rounded-xl">
              <span className="text-2xl">📅</span>
            </div>
            <span className="text-xs text-red-400 font-medium bg-red-500/10 px-2 py-1 rounded-full">Events</span>
          </div>
          <h3 className="text-gray-400 text-sm font-medium">Total Events</h3>
          <p className="text-4xl font-bold text-white mt-1">{stats.totalEvents}</p>
        </div>

        <div className="group bg-linear-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-green-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-green-500/10">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-500/20 rounded-xl">
              <span className="text-2xl">👥</span>
            </div>
            <span className="text-xs text-green-400 font-medium bg-green-500/10 px-2 py-1 rounded-full">Attendees</span>
          </div>
          <h3 className="text-gray-400 text-sm font-medium">Total Attendees</h3>
          <p className="text-4xl font-bold text-green-400 mt-1">{stats.totalAttendees}</p>
        </div>

        <div className="group bg-linear-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-yellow-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/10">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-yellow-500/20 rounded-xl">
              <span className="text-2xl">📝</span>
            </div>
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${stats.pendingExcuses > 0 ? 'text-yellow-400 bg-yellow-500/10' : 'text-gray-400 bg-white/10'}`}>
              Excuses
            </span>
          </div>
          <h3 className="text-gray-400 text-sm font-medium">Pending Excuses</h3>
          <p className={`text-4xl font-bold mt-1 ${stats.pendingExcuses > 0 ? 'text-yellow-400' : 'text-white'}`}>
            {stats.pendingExcuses}
          </p>
        </div>
      </div>

      {/* Quick Actions & Activity */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-linear-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span>⚡</span> Quick Actions
          </h3>
          <div className="space-y-3">
            <button
              onClick={() => navigate("/organizer/dashboard/events")}
              className="w-full text-left p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 hover:border-red-500/30 transition-all duration-200 group"
            >
              <p className="font-medium text-white group-hover:text-red-400 transition-colors">📅 Manage Events</p>
              <p className="text-sm text-gray-400 mt-1">Create and manage your events</p>
            </button>
            <button
              onClick={() => navigate("/organizer/dashboard/excuses")}
              className="w-full text-left p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 hover:border-yellow-500/30 transition-all duration-200 group"
            >
              <p className="font-medium text-white group-hover:text-yellow-400 transition-colors">📝 Manage Excuses</p>
              <p className="text-sm text-gray-400 mt-1">Review student excuse letters</p>
            </button>
          </div>
        </div>

        <div className="bg-linear-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span>📊</span> Recent Activity
          </h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-white/5 rounded-xl">
              <span className="text-xl">📋</span>
              <div>
                <p className="text-sm text-white">Manage attendance for your events</p>
                <p className="text-xs text-gray-500 mt-1">Click on any event to view attendees</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-white/5 rounded-xl">
              <span className="text-xl">⚠️</span>
              <div>
                <p className="text-sm text-white">Review pending excuses</p>
                <p className="text-xs text-gray-500 mt-1">{stats.pendingExcuses} excuse(s) waiting for review</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrganizerHome;

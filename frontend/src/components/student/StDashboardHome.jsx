import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { FaCalendarAlt, FaClock, FaBolt, FaBell, FaExclamationTriangle } from "react-icons/fa";
import { BsClipboardCheck } from "react-icons/bs";

const DashboardHome = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalHours: 0, totalAttended: 0 });
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get("/student/community-service");
        setStats({
          totalHours: res.data.totalHours || 0,
          totalAttended: res.data.totalAttended || 0,
        });
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
    { id: 1, message: "New event scheduled for tomorrow!", time: "2 hours ago", unread: true },
    { id: 2, message: "Community Service reminder: You have pending hours", time: "1 day ago", unread: true },
    { id: 3, message: "Event 'Campus Cleanup' has been approved", time: "2 days ago", unread: false },
  ];

  const unreadCount = dummyNotifications.filter(n => n.unread).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Welcome Back!</h1>
          <p className="text-gray-400 mt-1">Here's your activity overview</p>
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
                      navigate("/student/dashboard/notifications");
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
                  navigate("/student/dashboard/notifications");
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
            <div className="p-3 bg-green-500/20 rounded-xl">
              <span className="text-2xl"><FaCalendarAlt /></span>
            </div>
            <span className="text-xs text-green-400 font-medium bg-green-500/10 px-2 py-1 rounded-full">Events</span>
          </div>
          <h3 className="text-gray-400 text-sm font-medium">Events Attended</h3>
          <p className="text-4xl font-bold text-white mt-1">{stats.totalAttended}</p>
        </div>

        <div className="group bg-linear-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-yellow-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/10">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-yellow-500/20 rounded-xl">
              <span className="text-2xl"><FaClock /></span>
            </div>
            <span className="text-xs text-yellow-400 font-medium bg-yellow-500/10 px-2 py-1 rounded-full">Hours</span>
          </div>
          <h3 className="text-gray-400 text-sm font-medium">Community Service</h3>
          <p className="text-4xl font-bold text-yellow-400 mt-1">{stats.totalHours} <span className="text-lg font-normal text-gray-400">hrs</span></p>
        </div>

        <div className="group bg-linear-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-red-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-red-500/10">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-500/20 rounded-xl">
              <span className="text-2xl"><FaBolt /></span>
            </div>
            <span className="text-xs text-red-400 font-medium bg-red-500/10 px-2 py-1 rounded-full">Quick</span>
          </div>
          <h3 className="text-gray-400 text-sm font-medium">Quick Actions</h3>
          <div className="mt-3 space-y-2">
            <button
              onClick={() => navigate("/student/dashboard/events")}
              className="block w-full text-left text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              → View Events
            </button>
            <button
              onClick={() => navigate("/student/dashboard/community-service")}
              className="block w-full text-left text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              → Community Service
            </button>
            <button
              onClick={() => navigate("/student/dashboard/submit-excuse")}
              className="block w-full text-left text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              → Submit Excuse
            </button>
          </div>
        </div>
      </div>

      {/* Reminders Section */}
      <div className="bg-linear-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span className="text-xl"><FaBell /></span> Important Reminders
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="flex items-start gap-4 p-4 bg-white/5 rounded-xl border border-white/5 hover:border-red-500/20 transition-colors">
            <span className="text-3xl"><BsClipboardCheck /></span>
            <div>
              <p className="text-white font-medium">Mark Attendance On Time</p>
              <p className="text-sm text-gray-400 mt-1">Don't forget to mark your attendance during the attendance window to avoid community service hours.</p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-4 bg-white/5 rounded-xl border border-white/5 hover:border-yellow-500/20 transition-colors">
            <span className="text-3xl"><FaExclamationTriangle /></span>
            <div>
              <p className="text-white font-medium">Have an Absence?</p>
              <p className="text-sm text-gray-400 mt-1">Submit an excuse letter within 24 hours if you missed an event.</p>
              <button
                onClick={() => navigate("/student/dashboard/submit-excuse")}
                className="text-xs text-red-400 hover:text-red-300 mt-2 transition-colors"
              >
                Submit Excuse →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;

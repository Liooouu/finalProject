import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { FaCalendarAlt, FaClock, FaBell, FaExclamationTriangle } from "react-icons/fa";
import { BsClipboardCheck } from "react-icons/bs";

const DashboardHome = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalHours: 0, totalAttended: 0 });

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-on">Welcome Back!</h1>
        <p className="text-on-dim mt-1">Here's your activity overview</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="group bg-linear-to-br dark:from-white/10 dark:to-white/5 from-slate-50 to-slate-100 backdrop-blur-sm border border-line rounded-2xl p-6 hover:border-green-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-green-500/10">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-500/20 rounded-xl">
              <span className="text-2xl"><FaCalendarAlt /></span>
            </div>
            <span className="text-xs dark:text-green-400 text-green-600 font-medium bg-green-500/10 px-2 py-1 rounded-full">Events</span>
          </div>
          <h3 className="text-on-dim text-sm font-medium">Events Attended</h3>
          <p className="text-4xl font-bold text-on mt-1">{stats.totalAttended}</p>
        </div>

        <div className="group bg-linear-to-br dark:from-white/10 dark:to-white/5 from-slate-50 to-slate-100 backdrop-blur-sm border border-line rounded-2xl p-6 hover:border-yellow-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/10">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-yellow-500/20 rounded-xl">
              <span className="text-2xl"><FaClock /></span>
            </div>
            <span className="text-xs dark:text-yellow-400 text-yellow-600 font-medium bg-yellow-500/10 px-2 py-1 rounded-full">Hours</span>
          </div>
          <h3 className="text-on-dim text-sm font-medium">Community Service</h3>
          <p className="text-4xl font-bold dark:text-yellow-400 text-yellow-600 mt-1">{stats.totalHours} <span className="text-lg font-normal text-on-dim">hrs</span></p>
        </div>
      </div>

      {/* Reminders Section */}
      <div className="bg-linear-to-br dark:from-white/10 dark:to-white/5 from-slate-50 to-slate-100 backdrop-blur-sm border border-line rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-on mb-4 flex items-center gap-2">
          <span className="text-xl"><FaBell /></span> Important Reminders
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="flex items-start gap-4 p-4 bg-card rounded-xl border border-line-dim hover:border-red-500/20 transition-colors">
            <span className="text-3xl"><BsClipboardCheck /></span>
            <div>
              <p className="text-on font-medium">Mark Attendance On Time</p>
              <p className="text-sm text-on-dim mt-1">Don't forget to mark your attendance during the attendance window to avoid community service hours.</p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-4 bg-card rounded-xl border border-line-dim hover:border-yellow-500/20 transition-colors">
            <span className="text-3xl"><FaExclamationTriangle /></span>
            <div>
              <p className="text-on font-medium">Have an Absence?</p>
              <p className="text-sm text-on-dim mt-1">Submit an excuse letter within 24 hours if you missed an event.</p>
              <button
                onClick={() => navigate("/student/dashboard/submit-excuse")}
                className="text-xs dark:text-red-400 text-red-600 hover:text-red-300 mt-2 transition-colors"
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

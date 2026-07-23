import React, { useState, useEffect } from "react";
import api from "../../api/axios";
import { FaCalendarAlt, FaUsers, FaEdit, FaChartBar, FaExclamationTriangle, FaClock } from "react-icons/fa";

const OrganizerHome = () => {
  const [stats, setStats] = useState({ totalEvents: 0, totalAttendees: 0, pendingExcuses: 0 });

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-on">Welcome, Organizer!</h1>
        <p className="text-on-dim mt-1">Manage your events and track attendance</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="group bg-linear-to-br dark:from-white/10 dark:to-white/5 from-slate-50 to-slate-100 backdrop-blur-sm border border-line rounded-2xl p-6 hover:border-red-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-red-500/10">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-500/20 rounded-xl">
              <span className="text-2xl"><FaCalendarAlt /></span>
            </div>
            <span className="text-xs text-red-400 font-medium bg-red-500/10 px-2 py-1 rounded-full">Events</span>
          </div>
          <h3 className="text-on-dim text-sm font-medium">Total Events</h3>
          <p className="text-4xl font-bold text-on mt-1">{stats.totalEvents}</p>
        </div>

        <div className="group bg-linear-to-br dark:from-white/10 dark:to-white/5 from-slate-50 to-slate-100 backdrop-blur-sm border border-line rounded-2xl p-6 hover:border-green-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-green-500/10">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-500/20 rounded-xl">
              <span className="text-2xl"><FaUsers /></span>
            </div>
            <span className="text-xs text-green-400 font-medium bg-green-500/10 px-2 py-1 rounded-full">Attendees</span>
          </div>
          <h3 className="text-on-dim text-sm font-medium">Total Attendees</h3>
          <p className="text-4xl font-bold text-green-400 mt-1">{stats.totalAttendees}</p>
        </div>

        <div className="group bg-linear-to-br dark:from-white/10 dark:to-white/5 from-slate-50 to-slate-100 backdrop-blur-sm border border-line rounded-2xl p-6 hover:border-yellow-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/10">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-yellow-500/20 rounded-xl">
              <span className="text-2xl"><FaEdit /></span>
            </div>
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${stats.pendingExcuses > 0 ? 'text-yellow-400 bg-yellow-500/10' : 'text-on-dim bg-card-alt'}`}>
              Excuses
            </span>
          </div>
          <h3 className="text-on-dim text-sm font-medium">Pending Excuses</h3>
          <p className={`text-4xl font-bold mt-1 ${stats.pendingExcuses > 0 ? 'text-yellow-400' : 'text-on'}`}>
            {stats.pendingExcuses}
          </p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-linear-to-br dark:from-white/10 dark:to-white/5 from-slate-50 to-slate-100 backdrop-blur-sm border border-line rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-on mb-4 flex items-center gap-2">
            <span><FaChartBar /></span> Quick Tips
          </h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-card rounded-xl">
              <span className="text-xl"><FaCalendarAlt /></span>
              <div>
                <p className="text-sm text-on">Manage your events</p>
                <p className="text-xs text-on-muted mt-1">Click on any event to view details, edit, or manage attendance</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-card rounded-xl">
              <span className="text-xl"><FaUsers /></span>
              <div>
                <p className="text-sm text-on">Track attendance in real-time</p>
                <p className="text-xs text-on-muted mt-1">Use QR scanning or manual attendance to mark students</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-linear-to-br dark:from-white/10 dark:to-white/5 from-slate-50 to-slate-100 backdrop-blur-sm border border-line rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-on mb-4 flex items-center gap-2">
            <span><FaClock /></span> Reminders
          </h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-card rounded-xl">
              <span className="text-xl"><FaExclamationTriangle /></span>
              <div>
                <p className="text-sm text-on">Review pending excuses</p>
                <p className="text-xs text-on-muted mt-1">{stats.pendingExcuses} excuse(s) waiting for review</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-card rounded-xl">
              <span className="text-xl"><FaEdit /></span>
              <div>
                <p className="text-sm text-on">Close events when done</p>
                <p className="text-xs text-on-muted mt-1">Mark events as closed to finalize attendance and CS hours</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrganizerHome;

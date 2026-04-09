import React, { useState, useEffect } from "react";
import api from "../../api/axios";
import { Link } from "react-router-dom";

const DashboardHome = () => {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [users, setUsers] = useState([]);
  const [attendance, setAttendance] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [eventsRes, usersRes, attendanceRes] = await Promise.all([
        api.get("/reports/events"),
        api.get("/reports/users"),
        api.get("/reports/attendance"),
      ]);
      setEvents(eventsRes.data.events.slice(0, 5));
      setUsers(usersRes.data.users.slice(0, 5));
      setAttendance(attendanceRes.data.records.slice(0, 10));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      upcoming: "bg-blue-900/50 text-blue-400",
      live: "bg-green-900/50 text-green-400",
      closed: "bg-gray-700/50 text-gray-400",
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status] || styles.closed}`}>
        {status}
      </span>
    );
  };

  const getRoleBadge = (role) => {
    const styles = {
      admin: "bg-cyan-900/50 text-cyan-400",
      organizer: "bg-yellow-900/50 text-yellow-400",
      student: "bg-purple-900/50 text-purple-400",
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[role] || styles.student}`}>
        {role}
      </span>
    );
  };

  const getAttendanceBadge = (status) => {
    const styles = {
      present: "bg-green-900/50 text-green-400",
      absent: "bg-red-900/50 text-red-400",
      pending: "bg-yellow-900/50 text-yellow-400",
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status] || styles.pending}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-red-400">Dashboard</h2>
        <p className="text-gray-400 text-sm">
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#0f0f14] rounded-xl border border-gray-800 overflow-hidden">
          <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gradient-to-r from-red-950/30 to-transparent">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">Recent Events</h3>
                <p className="text-xs text-gray-400">Latest 5 events</p>
              </div>
            </div>
            <Link
              to="/admin/dashboard/events"
              className="text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              View all →
            </Link>
          </div>
          <div className="divide-y divide-gray-800/50">
            {events.length === 0 ? (
              <p className="p-4 text-gray-400 text-center text-sm">No events yet</p>
            ) : (
              events.map((event) => (
                <div key={event._id} className="p-4 hover:bg-white/5 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{event.title}</p>
                      <p className="text-sm text-gray-400 truncate">
                        {event.location || "No location"} • {new Date(event.date).toLocaleDateString()}
                      </p>
                    </div>
                    {getStatusBadge(event.status)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-[#0f0f14] rounded-xl border border-gray-800 overflow-hidden">
          <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gradient-to-r from-red-950/30 to-transparent">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">Recent Users</h3>
                <p className="text-xs text-gray-400">Latest 5 registrations</p>
              </div>
            </div>
            <Link
              to="/admin/dashboard/users"
              className="text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              View all →
            </Link>
          </div>
          <div className="divide-y divide-gray-800/50">
            {users.length === 0 ? (
              <p className="p-4 text-gray-400 text-center text-sm">No users yet</p>
            ) : (
              users.map((user) => (
                <div key={user._id} className="p-4 hover:bg-white/5 transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{user.name}</p>
                        <p className="text-sm text-gray-400 truncate">{user.email}</p>
                      </div>
                    </div>
                    {getRoleBadge(user.role)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-[#0f0f14] rounded-xl border border-gray-800 overflow-hidden">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gradient-to-r from-red-950/30 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold">Recent Attendance</h3>
              <p className="text-xs text-gray-400">Latest 10 attendance records</p>
            </div>
          </div>
          <Link
            to="/admin/dashboard/reports"
            className="text-sm text-red-400 hover:text-red-300 transition-colors"
          >
            View all →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 bg-black/30">
                <th className="text-left p-4 font-medium text-gray-400 text-sm">Event</th>
                <th className="text-left p-4 font-medium text-gray-400 text-sm">Student</th>
                <th className="text-left p-4 font-medium text-gray-400 text-sm">Status</th>
                <th className="text-left p-4 font-medium text-gray-400 text-sm">Date</th>
              </tr>
            </thead>
            <tbody>
              {attendance.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-4 text-gray-400 text-center text-sm">
                    No attendance records yet
                  </td>
                </tr>
              ) : (
                attendance.map((record, index) => (
                  <tr key={index} className="border-b border-gray-800/50 hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <p className="font-medium text-sm">{record.event?.title || "Event"}</p>
                      <p className="text-xs text-gray-400">
                        {record.event?.date && new Date(record.event.date).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-purple-500/30 flex items-center justify-center text-purple-400 text-xs font-bold">
                          {record.student?.name?.charAt(0).toUpperCase() || "?"}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{record.student?.name || "Unknown"}</p>
                          <p className="text-xs text-gray-400">{record.student?.email || ""}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">{getAttendanceBadge(record.status)}</td>
                    <td className="p-4 text-sm text-gray-400">
                      {new Date(record.attendedAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;

import React, { useState, useEffect } from "react";
import api from "../../api/axios";
import { useTheme } from "../../context/ThemeContext";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Pie, Doughnut } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const AttendanceReports = () => {
  const [activeTab, setActiveTab] = useState("attendance");
  const [attendanceData, setAttendanceData] = useState(null);
  const [eventsData, setEventsData] = useState(null);
  const [usersData, setUsersData] = useState(null);
  const [loading, setLoading] = useState(false);
  const { darkMode } = useTheme();

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const res = await api.get("/reports/attendance");
      setAttendanceData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await api.get("/reports/events");
      setEventsData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get("/reports/users");
      setUsersData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "attendance" && !attendanceData) fetchAttendance();
    if (activeTab === "events" && !eventsData) fetchEvents();
    if (activeTab === "users" && !usersData) fetchUsers();
  }, [activeTab]);

  const downloadCSV = async (type) => {
    try {
      const response = await api.get(`/reports/${type}/export`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${type}-report.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error(err);
    }
  };

  const chartOptions = {
    responsive: true,
    plugins: { legend: { labels: { color: darkMode ? "#fff" : "#1e293b" } } },
    scales: {
      x: { ticks: { color: darkMode ? "#aaa" : "#64748b" }, grid: { color: darkMode ? "#333" : "#e2e8f0" } },
      y: { ticks: { color: darkMode ? "#aaa" : "#64748b" }, grid: { color: darkMode ? "#333" : "#e2e8f0" } },
    },
  };

  const pieOptions = {
    responsive: true,
    plugins: { legend: { labels: { color: darkMode ? "#fff" : "#1e293b" } } },
  };

  const attendanceChartData = attendanceData
    ? {
        labels: ["Present", "Absent", "Pending"],
        datasets: [
          {
            label: "Attendance Status",
            data: [
              attendanceData.stats.present,
              attendanceData.stats.absent,
              attendanceData.stats.pending,
            ],
            backgroundColor: ["#22c55e", "#ef4444", "#eab308"],
            borderColor: ["#16a34a", "#dc2626", "#ca8a04"],
            borderWidth: 1,
          },
        ],
      }
    : null;

  const attendanceByEventData = attendanceData
    ? {
        labels: attendanceData.byEvent.slice(0, 10).map((e) =>
          e.eventTitle.length > 20 ? e.eventTitle.substring(0, 20) + "..." : e.eventTitle
        ),
        datasets: [
          {
            label: "Present",
            data: attendanceData.byEvent.slice(0, 10).map((e) => e.present),
            backgroundColor: "#22c55e",
          },
          {
            label: "Absent",
            data: attendanceData.byEvent.slice(0, 10).map((e) => e.absent),
            backgroundColor: "#ef4444",
          },
          {
            label: "Pending",
            data: attendanceData.byEvent.slice(0, 10).map((e) => e.pending),
            backgroundColor: "#eab308",
          },
        ],
      }
    : null;

  const eventStatusData = eventsData
    ? {
        labels: ["Upcoming", "Live", "Closed"],
        datasets: [
          {
            data: [eventsData.stats.upcoming, eventsData.stats.live, eventsData.stats.closed],
            backgroundColor: ["#3b82f6", "#22c55e", "#6b7280"],
            borderColor: ["#2563eb", "#16a34a", "#4b5563"],
            borderWidth: 1,
          },
        ],
      }
    : null;

  const usersRoleData = usersData
    ? {
        labels: ["Students", "Organizers", "Admins"],
        datasets: [
          {
            data: [usersData.stats.student, usersData.stats.organizer, usersData.stats.admin],
            backgroundColor: ["#8b5cf6", "#f59e0b", "#06b6d4"],
            borderColor: ["#7c3aed", "#d97706", "#0891b2"],
            borderWidth: 1,
          },
        ],
      }
    : null;

  const TabButton = ({ tab, label }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`px-4 py-2 rounded ${
        activeTab === tab ? "bg-red-500 text-white" : "bg-card text-on-dim hover:text-on"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <TabButton tab="attendance" label="Attendance" />
        <TabButton tab="events" label="Events" />
        <TabButton tab="users" label="Users" />
      </div>

      {loading && <p className="text-on-dim">Loading...</p>}

      {activeTab === "attendance" && attendanceData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard label="Total Records" value={attendanceData.stats.total} color="blue" />
            <StatCard label="Present" value={attendanceData.stats.present} color="green" />
            <StatCard label="Absent" value={attendanceData.stats.absent} color="red" />
            <StatCard label="Pending" value={attendanceData.stats.pending} color="yellow" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-card p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-4">Status Distribution</h3>
              <div className="h-64">
                <Pie data={attendanceChartData} options={{ ...pieOptions, maintainAspectRatio: false }} />
              </div>
            </div>
            <div className="bg-card p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-4">Attendance by Event</h3>
              <div className="h-64">
                <Bar data={attendanceByEventData} options={{ ...chartOptions, maintainAspectRatio: false }} />
              </div>
            </div>
          </div>

          <div className="bg-card p-6 rounded-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Recent Attendance Records</h3>
              <button
                onClick={() => downloadCSV("attendance")}
                className="bg-red-500 px-4 py-2 rounded hover:bg-red-600 text-sm"
              >
                Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className="text-left p-2">Event</th>
                    <th className="text-left p-2">Student</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceData.records.slice(0, 10).map((r, i) => (
                    <tr key={i} className="border-b border-line">
                      <td className="p-2">{r.event?.title || "N/A"}</td>
                      <td className="p-2">{r.student?.name || "N/A"}</td>
                      <td className="p-2">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            r.status === "present"
                              ? "dark:bg-green-900 bg-green-100 dark:text-green-300 text-green-700"
                              : r.status === "absent"
                              ? "dark:bg-red-900 bg-red-100 dark:text-red-300 text-red-700"
                              : "dark:bg-yellow-900 bg-yellow-100 dark:text-yellow-300 text-yellow-700"
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="p-2">{new Date(r.attendedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === "events" && eventsData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard label="Total Events" value={eventsData.stats.total} color="blue" />
            <StatCard label="Upcoming" value={eventsData.stats.upcoming} color="blue" />
            <StatCard label="Live" value={eventsData.stats.live} color="green" />
            <StatCard label="Closed" value={eventsData.stats.closed} color="gray" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-card p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-4">Events by Status</h3>
              <div className="h-64">
                <Doughnut data={eventStatusData} options={{ ...pieOptions, maintainAspectRatio: false }} />
              </div>
            </div>
            <div className="bg-card p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-4">Top Events by Attendance</h3>
              <div className="h-64">
                <Bar
                  data={{
                    labels: eventsData.events.slice(0, 10).map((e) =>
                      e.title.length > 15 ? e.title.substring(0, 15) + "..." : e.title
                    ),
                    datasets: [
                      {
                        label: "Attendance Rate %",
                        data: eventsData.events.slice(0, 10).map((e) => e.attendanceRate),
                        backgroundColor: "#3b82f6",
                      },
                    ],
                  }}
                  options={{ ...chartOptions, maintainAspectRatio: false }}
                />
              </div>
            </div>
          </div>

          <div className="bg-card p-6 rounded-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">All Events</h3>
              <button
                onClick={() => downloadCSV("events")}
                className="bg-red-500 px-4 py-2 rounded hover:bg-red-600 text-sm"
              >
                Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className="text-left p-2">Title</th>
                    <th className="text-left p-2">Date</th>
                    <th className="text-left p-2">Location</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Attendees</th>
                    <th className="text-left p-2">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {eventsData.events.map((e) => (
                    <tr key={e._id} className="border-b border-line">
                      <td className="p-2">{e.title}</td>
                      <td className="p-2">{new Date(e.date).toLocaleDateString()}</td>
                      <td className="p-2">{e.location || "N/A"}</td>
                      <td className="p-2">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            e.status === "upcoming"
                              ? "dark:bg-blue-900 bg-blue-100 dark:text-blue-300 text-blue-700"
                              : e.status === "live"
                              ? "dark:bg-green-900 bg-green-100 dark:text-green-300 text-green-700"
                              : "dark:bg-gray-700 bg-gray-200 dark:text-gray-300 text-gray-600"
                          }`}
                        >
                          {e.status}
                        </span>
                      </td>
                      <td className="p-2">{e.totalAttendees}</td>
                      <td className="p-2">{e.attendanceRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === "users" && usersData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard label="Total Users" value={usersData.stats.total} color="blue" />
            <StatCard label="Students" value={usersData.stats.student} color="purple" />
            <StatCard label="Organizers" value={usersData.stats.organizer} color="yellow" />
            <StatCard label="Admins" value={usersData.stats.admin} color="cyan" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-card p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-4">Users by Role</h3>
              <div className="h-64">
                <Pie data={usersRoleData} options={{ ...pieOptions, maintainAspectRatio: false }} />
              </div>
            </div>
            <div className="bg-card p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-4">Role Distribution</h3>
              <div className="h-64 flex items-center justify-center">
                <Doughnut
                  data={{
                    labels: ["Students", "Organizers", "Admins"],
                    datasets: [
                      {
                        data: [
                          usersData.stats.student,
                          usersData.stats.organizer,
                          usersData.stats.admin,
                        ],
                        backgroundColor: ["#8b5cf6", "#f59e0b", "#06b6d4"],
                        borderColor: ["#7c3aed", "#d97706", "#0891b2"],
                        borderWidth: 1,
                      },
                    ],
                  }}
                  options={{ ...pieOptions, maintainAspectRatio: false }}
                />
              </div>
            </div>
          </div>

          <div className="bg-card p-6 rounded-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">All Users</h3>
              <button
                onClick={() => downloadCSV("users")}
                className="bg-red-500 px-4 py-2 rounded hover:bg-red-600 text-sm"
              >
                Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className="text-left p-2">Name</th>
                    <th className="text-left p-2">Email</th>
                    <th className="text-left p-2">Role</th>
                    <th className="text-left p-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {usersData.users.map((u) => (
                    <tr key={u._id} className="border-b border-line">
                      <td className="p-2">{u.name}</td>
                      <td className="p-2">{u.email}</td>
                      <td className="p-2">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            u.role === "admin"
                              ? "dark:bg-cyan-900 bg-cyan-100 dark:text-cyan-300 text-cyan-700"
                              : u.role === "organizer"
                              ? "dark:bg-yellow-900 bg-yellow-100 dark:text-yellow-300 text-yellow-700"
                              : "dark:bg-purple-900 bg-purple-100 dark:text-purple-300 text-purple-700"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="p-2">{new Date(u.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const StatCard = ({ label, value, color }) => {
  const colors = {
    blue: "dark:bg-blue-900/30 bg-blue-50 dark:border-blue-700 border-blue-200 dark:text-blue-400 text-blue-600",
    green: "dark:bg-green-900/30 bg-green-50 dark:border-green-700 border-green-200 dark:text-green-400 text-green-600",
    red: "dark:bg-red-900/30 bg-red-50 dark:border-red-700 border-red-200 dark:text-red-400 text-red-600",
    yellow: "dark:bg-yellow-900/30 bg-yellow-50 dark:border-yellow-700 border-yellow-200 dark:text-yellow-400 text-yellow-600",
    gray: "dark:bg-gray-900/30 bg-gray-100 dark:border-gray-700 border-gray-200 dark:text-gray-400 text-gray-600",
    purple: "dark:bg-purple-900/30 bg-purple-50 dark:border-purple-700 border-purple-200 dark:text-purple-400 text-purple-600",
    cyan: "dark:bg-cyan-900/30 bg-cyan-50 dark:border-cyan-700 border-cyan-200 dark:text-cyan-400 text-cyan-600",
  };

  return (
    <div className={`p-4 rounded-xl border ${colors[color] || colors.blue}`}>
      <p className="text-sm opacity-70">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
};

export default AttendanceReports;

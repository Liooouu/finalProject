import React, { useState, useEffect } from "react";
import api from "../../api/axios";
import { Link } from "react-router-dom";
import {
  FaCalendarAlt,
  FaUsers,
  FaClipboardList,
  FaUserTie,
} from "react-icons/fa";
import { usePageMeta } from "../../context/PageMetaContext";
import { KpiCard, StatusChip, PageHeader, TableSkeleton, BaseCard } from "../ui";
import Button from "../ui/Button";

const Avatar = ({ name }) => {
  const initials = (name || "?")
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-xs font-bold text-indigo-600 ring-1 ring-indigo-500/20 dark:text-indigo-400">
      {initials}
    </div>
  );
};

const DashboardHome = () => {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [users, setUsers] = useState([]);
  const [attendance, setAttendance] = useState([]);

  usePageMeta("Overview", new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }));

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
      setEvents(eventsRes.data.events);
      setUsers(usersRes.data.users);
      setAttendance(attendanceRes.data.records);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const students = users.filter((u) => u.role === "student");
  const organizers = users.filter((u) => u.role === "organizer");
  const presentCount = attendance.filter(
    (r) => r.status === "present" || r.status === "attended"
  ).length;
  const attendanceRate = attendance.length
    ? Math.round((presentCount / attendance.length) * 100)
    : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-line bg-card p-5">
              <div className="skeleton h-3 w-1/2 rounded" />
              <div className="skeleton mt-3 h-7 w-10 rounded" />
            </div>
          ))}
        </div>
        <TableSkeleton rows={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Button as={Link} to="/admin/dashboard/create-organizer" variant="primary" size="sm">
            <FaUserTie className="text-xs" />
            Create Organizer
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Events" value={events.length} icon={<FaCalendarAlt />} />
        <KpiCard label="Students" value={students.length} icon={<FaUsers />} />
        <KpiCard
          label="Attendance Rate"
          value={`${attendanceRate}%`}
          icon={<FaClipboardList />}
          hint={`${presentCount} of ${attendance.length} records`}
        />
        <KpiCard label="Organizers" value={organizers.length} icon={<FaUserTie />} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BaseCard
          title="Recent Events"
          icon={<FaCalendarAlt />}
          menu={
            <Link
              to="/admin/dashboard/events"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
            >
              View all
            </Link>
          }
        >
          {events.length === 0 ? (
            <p className="py-8 text-center text-sm text-on-dim">No events yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {events.slice(0, 5).map((event) => (
                <li key={event._id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-on">{event.title}</p>
                    <p className="truncate text-xs text-on-dim">
                      {event.location || "No location"} · {new Date(event.date).toLocaleDateString()}
                    </p>
                  </div>
                  <StatusChip status={event.status} />
                </li>
              ))}
            </ul>
          )}
        </BaseCard>

        <BaseCard
          title="Recent Users"
          icon={<FaUsers />}
          menu={
            <Link
              to="/admin/dashboard/users"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
            >
              View all
            </Link>
          }
        >
          {users.length === 0 ? (
            <p className="py-8 text-center text-sm text-on-dim">No users yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {users.slice(0, 5).map((user) => (
                <li key={user._id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={user.name} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-on">{user.name}</p>
                      <p className="truncate text-xs text-on-dim">{user.email}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-slate-500/10 px-2.5 py-0.5 text-xs font-medium capitalize text-slate-600 ring-1 ring-inset ring-slate-500/25 dark:text-slate-300">
                    {user.role}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </BaseCard>
      </div>

      <BaseCard
        title="Recent Attendance"
        icon={<FaClipboardList />}
        menu={
          <Link
            to="/admin/dashboard/reports"
            className="text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            View all
          </Link>
        }
      >
        {attendance.length === 0 ? (
          <p className="py-8 text-center text-sm text-on-dim">No attendance records yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-on-muted">Event</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-on-muted">Student</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-on-muted">Status</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-on-muted">Checked In</th>
                </tr>
              </thead>
              <tbody>
                {attendance.slice(0, 8).map((record, index) => (
                  <tr key={index} className="border-b border-line last:border-0 hover:bg-card-alt/60">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-on">{record.event?.title || "Event"}</p>
                      {record.event?.date && (
                        <p className="text-xs text-on-muted">{new Date(record.event.date).toLocaleDateString()}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-on">{record.student?.name || "Unknown"}</p>
                      <p className="text-xs text-on-muted">{record.student?.email || ""}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip status={record.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-on-dim">
                      {record.attendedAt ? new Date(record.attendedAt).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </BaseCard>
    </div>
  );
};

export default DashboardHome;
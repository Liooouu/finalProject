import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import { useAutoRefresh } from "../../utils/useAutoRefresh";
import { formatDate, formatDateTime, formatTime12Hour, splitEventsByLifecycle } from "../../utils/helpers";
import { BaseCard, Button, StatusChip } from "../ui";
import Pagination from "../ui/Pagination";
import Loading from "../shared/Loading";
import EmptyState from "../shared/EmptyState";
import { FaClipboardList, FaEnvelope, FaShieldAlt } from "react-icons/fa";

const sources = [
  { key: "events", label: "Events", path: "/reports/events" },
  { key: "attendance", label: "Attendance", path: "/reports/attendance" },
  { key: "appeals", label: "Face appeals", path: "/admin/security/face-appeals?status=pending" },
  { key: "excuses", label: "Excuse letters", path: "/organizer/excuses" },
];

export default function DashboardHome() {
  const [state, setState] = useState({ loading: true, events: null, attendance: null, appeals: null, excuses: null, failures: [] });
  const [page, setPage] = useState(1);
  const load = useCallback(() => Promise.allSettled(sources.map(source => api.get(source.path))).then(results => {
    setState(previous => {
      const next = { ...previous, loading: false, failures: [] };
      results.forEach((result, index) => {
        const source = sources[index];
        if (result.status === "fulfilled") next[source.key] = result.value.data;
        else next.failures.push(source.label);
      });
      return next;
    });
  }), []);
  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);
  if (state.loading) return <Loading label="Loading admin dashboard..." />;
  const records = [...(state.attendance?.records || [])].sort((a, b) => new Date(b.attendedAt || b.createdAt || 0) - new Date(a.attendedAt || a.createdAt || 0));
  const stats = state.attendance?.stats;
  const total = stats?.total ?? records.length;
  const attended = (stats?.present ?? records.filter(record => record.status === "present").length) + (stats?.late ?? records.filter(record => record.status === "late").length);
  const rate = total ? Math.round(attended / total * 100) : null;
  const events = state.events?.events || [];
  const active = splitEventsByLifecycle(events).active.sort((a, b) => (a.status === "live" ? 0 : 1) - (b.status === "live" ? 0 : 1) || new Date(a.date) - new Date(b.date));
  const currentPage = Math.min(page, Math.max(1, Math.ceil(records.length / 6)));
  const reviews = [
    { label: "Face appeals", description: "Review student identity requests", count: state.appeals?.filter(item => item.status === "pending").length ?? null, path: "/admin/dashboard/users?tab=appeals", icon: <FaShieldAlt /> },
    { label: "Excuse letters", description: "Review pending absence letters", count: state.excuses?.filter(item => item.status === "pending").length ?? null, path: "/admin/dashboard/excuses", icon: <FaEnvelope /> },
  ];
  const cardClass = "flex min-w-0 flex-col";
  return <div className="space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="font-display text-xl font-semibold tracking-tight text-on sm:text-2xl">Admin dashboard</h1><p className="mt-1 text-sm text-on-dim">Attendance overview and the work that needs your attention.</p></div></header>
    {!!state.failures.length && <div role="alert" className="alert alert-danger"><p>Could not refresh: {state.failures.join(", ")}. Previously loaded records stay visible.</p><Button onClick={load} variant="secondary" size="sm">Try again</Button></div>}
    <div className="grid items-stretch gap-3 md:grid-cols-2 xl:grid-cols-3">
      <BaseCard title="Attendance rate" icon={<FaClipboardList />} className={cardClass} bodyClassName="flex flex-1 flex-col gap-2" >
        <p className="num font-display text-4xl font-bold tracking-tight text-on" data-testid="admin-attendance-rate">{state.attendance && rate !== null ? `${rate}%` : "—"}</p>
        <p className="text-sm text-on-dim">{!state.attendance ? "Attendance data unavailable." : total ? `${attended} attended out of ${total} attendance records.` : "No attendance records yet."}</p>
        <p className="text-xs text-on-muted">Present and late records count as attended. The total includes all recorded statuses.</p>
        <div className="mt-auto pt-2"><Button as={Link} to="/admin/dashboard/reports" variant="secondary" size="sm">View attendance reports</Button></div>
      </BaseCard>
      <BaseCard title="Needs review" className={cardClass}>
        <ul className="divide-y divide-line">{reviews.map(item => <li key={item.label}><Link to={item.path} className="flex items-center gap-3 rounded-lg py-3 first:pt-0 hover:bg-card-alt/40"><span className="text-on-muted" aria-hidden="true">{item.icon}</span><div className="min-w-0 flex-1"><p className="text-sm font-medium text-on">{item.label}</p><p className="mt-1 text-xs text-on-muted">{item.description}</p></div><span className={`num text-sm font-semibold ${item.count ? "text-warn" : "text-on-muted"}`}>{item.count === null ? "Unavailable" : `${item.count} pending`}</span></Link></li>)}</ul>
      </BaseCard>
      <BaseCard title="Live & upcoming events" className={`${cardClass} md:col-span-2 xl:col-span-1`} menu={<Button as={Link} to="/admin/dashboard/events" variant="ghost" size="sm">View events</Button>}>
        {!state.events ? <EmptyState compact title="Events unavailable" description="Try loading the event list again." /> : !active.length ? <EmptyState compact title="No active events" description="New events will appear here when scheduled." /> : <ul className="divide-y divide-line">{active.slice(0, 3).map(event => <li key={event._id}><Link to={`/admin/dashboard/events/${event._id}`} className="flex items-start justify-between gap-3 rounded-lg py-2 hover:bg-card-alt/40"><div className="min-w-0"><p className="text-sm font-medium text-on [overflow-wrap:anywhere]">{event.title}</p><p className="mt-1 text-xs text-on-muted">{formatDate(event.date)}{event.time ? ` at ${formatTime12Hour(event.time)}` : ""}</p></div><StatusChip status={event.status} /></Link></li>)}</ul>}
      </BaseCard>
    </div>
    <BaseCard title="Recent attendance" description="Latest attendance records across all events." menu={<Button as={Link} to="/admin/dashboard/reports" variant="ghost" size="sm">All records</Button>}>
      {!state.attendance ? <EmptyState compact title="Attendance unavailable" description="Try loading your records again." /> : !records.length ? <EmptyState compact title="No attendance records yet" description="Attendance will appear once it is recorded." /> : <>
        <ul className="divide-y divide-line">{records.slice((currentPage - 1) * 6, currentPage * 6).map((record, index) => <li key={record._id || index} className="flex flex-wrap items-start justify-between gap-2 py-3 first:pt-0"><div className="min-w-0 flex-1"><p className="text-sm font-medium text-on [overflow-wrap:anywhere]">{record.student?.name || "Student"}</p><p className="mt-1 text-xs text-on-dim [overflow-wrap:anywhere]">{record.event?.title || record.eventTitle || "Event unavailable"}</p><p className="mt-1 text-xs text-on-muted">{record.attendedAt ? formatDateTime(record.attendedAt) : "Date unavailable"}</p></div><StatusChip status={record.status} /></li>)}</ul>
        <Pagination page={currentPage} pageSize={6} total={records.length} onChange={setPage} label="Admin attendance pages" />
      </>}
    </BaseCard>
  </div>;
}

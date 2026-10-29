import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import { useAutoRefresh } from "../../utils/useAutoRefresh";
import { formatDate, formatDateTime, formatTime12Hour, splitEventsByLifecycle } from "../../utils/helpers";
import { Card, Button, StatusChip } from "../ui";
import Pagination from "../ui/Pagination";
import Loading from "../shared/Loading";
import EmptyState from "../shared/EmptyState";
import { FaClipboardList, FaEnvelope, FaShieldAlt } from "react-icons/fa";
import { readScreen, writeScreen } from "../../utils/queryCache";

const CACHE_KEY = "admin:home";

const sources = [
  { key: "events", label: "Events", path: "/reports/events" },
  { key: "attendance", label: "Attendance", path: "/reports/attendance?limit=30" },
  { key: "appeals", label: "Face appeals", path: "/admin/security/face-appeals?status=pending" },
  { key: "excuses", label: "Excuse letters", path: "/organizer/excuses" },
];

export default function DashboardHome() {
  const seed = readScreen(CACHE_KEY);
  const [state, setState] = useState(
    seed
      ? { loading: false, events: null, attendance: null, appeals: null, excuses: null, failures: [], ...seed }
      : { loading: true, events: null, attendance: null, appeals: null, excuses: null, failures: [] }
  );
  const [page, setPage] = useState(1);
  const [eventPage, setEventPage] = useState(1);
  const load = useCallback(
    () =>
      Promise.allSettled(sources.map((source) => api.get(source.path))).then((results) => {
        const previous = readScreen(CACHE_KEY) || {};
        const next = { ...previous, loading: false, failures: [] };
        results.forEach((result, index) => {
          const source = sources[index];
          if (result.status === "fulfilled") next[source.key] = result.value.data;
          else next.failures.push(source.label);
        });
        // Remember the dashboard so returning to this tab paints immediately.
        writeScreen(CACHE_KEY, next);
        setState(next);
      }),
    []
  );
  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load, { interval: 30000 });
  if (state.loading) return <Loading label="Loading admin dashboard..." />;
  const records = [...(state.attendance?.records || [])].sort((a, b) => new Date(b.attendedAt || b.createdAt || 0) - new Date(a.attendedAt || a.createdAt || 0));
  const stats = state.attendance?.stats;
  const total = stats?.total ?? records.length;
  const attended = (stats?.present ?? records.filter(record => record.status === "present").length) + (stats?.late ?? records.filter(record => record.status === "late").length);
  const rate = total ? Math.round(attended / total * 100) : null;
  const events = state.events?.events || [];
  const active = splitEventsByLifecycle(events).active.sort((a, b) => (a.status === "live" ? 0 : 1) - (b.status === "live" ? 0 : 1) || new Date(a.date) - new Date(b.date));
  const eventPageSize = 3;
  const currentEventPage = Math.min(eventPage, Math.max(1, Math.ceil(active.length / eventPageSize)));
  const currentPage = Math.min(page, Math.max(1, Math.ceil(records.length / 6)));
  const reviews = [
    { label: "Face appeals", description: "Review student identity requests", count: state.appeals?.filter(item => item.status === "pending").length ?? null, path: "/admin/dashboard/users?tab=appeals", icon: <FaShieldAlt /> },
    { label: "Excuse letters", description: "Review pending absence letters", count: state.excuses?.filter(item => item.status === "pending").length ?? null, path: "/admin/dashboard/excuses", icon: <FaEnvelope /> },
  ];
  return <div className="admin-home-page">
    <header className="admin-page-heading"><h1>Admin dashboard</h1><p>Attendance overview and the work that needs your attention.</p></header>
    {!!state.failures.length && <div role="alert" className="alert alert-danger"><p>Could not refresh: {state.failures.join(", ")}. Previously loaded records stay visible.</p><Button onClick={load} variant="secondary" size="sm">Try again</Button></div>}
    <div className="admin-home-summary">
      <Card as="section" className="admin-home-rate">
        <h2><FaClipboardList aria-hidden="true" /> Attendance rate</h2>
        <div className="admin-rate-box"><strong className="admin-rate-value" data-testid="admin-attendance-rate">{state.attendance && rate !== null ? `${rate}%` : "—"}</strong></div>
        <p>{!state.attendance ? "Attendance data unavailable." : total ? `${attended} attended out of ${total} records.` : "No attendance records yet."}</p>
        <span className="sr-only">Present and late records count as attended. The total includes all recorded statuses.</span>
        <Link to="/admin/dashboard/reports" className="admin-text-link" aria-label="View attendance reports">View attendance reports →</Link>
      </Card>
      <Card as="section" className="admin-home-reviews">
        <h2>Needs review</h2>
        <ul className="admin-review-list">{reviews.map(item=><li key={item.label}><Link to={item.path} className="admin-review-box"><span className="admin-review-icon" aria-hidden="true">{item.icon}</span><span className="admin-review-label">{item.label}<span className="sr-only"> · {item.description}</span></span><strong className={`admin-review-count ${item.count ? "text-warn" : "text-on-muted"}`}>{item.count ?? "—"}</strong><span className="admin-review-caption">{item.count === null ? "Unavailable" : "pending"}</span></Link></li>)}</ul>
      </Card>
      <Card as="section" className="admin-home-events">
        <div className="admin-section-heading"><h2>Live &amp; upcoming events</h2><Link to="/admin/dashboard/events" className="admin-text-link">View events →</Link></div>
        {!state.events ? <EmptyState compact title="Events unavailable" description="Try loading the event list again." /> : !active.length ? <EmptyState compact title="No active events" description="New events will appear here when scheduled." /> : <><ul className="admin-next-list">{active.slice((currentEventPage - 1) * eventPageSize, currentEventPage * eventPageSize).map(event=><li key={event._id}><Link to={`/admin/dashboard/events/${event._id}`}><div><p>{event.title}</p><span>{formatDate(event.date)}{event.time ? ` · ${formatTime12Hour(event.time)}` : ""}</span></div><StatusChip status={event.status} /></Link></li>)}</ul><Pagination page={currentEventPage} pageSize={eventPageSize} total={active.length} onChange={setEventPage} label="Admin upcoming event pages" /></>}
      </Card>
    </div>
    <Card as="section" padding="none" className="admin-home-attendance">
      <div className="admin-section-heading admin-table-heading"><div><h2>Recent attendance</h2><p>Latest attendance records across all events.</p></div><Link to="/admin/dashboard/reports" className="admin-text-link">All records →</Link></div>
      {!state.attendance ? <EmptyState compact title="Attendance unavailable" description="Try loading your records again." /> : !records.length ? <EmptyState compact title="No attendance records yet" description="Attendance will appear once it is recorded." /> : <>
        <div className="overflow-x-auto"><table className="data-table admin-home-table"><colgroup><col style={{width:"27%"}} /><col style={{width:"27%"}} /><col style={{width:"16%"}} /><col style={{width:"30%"}} /></colgroup><thead><tr><th>Student</th><th>Event</th><th>Status</th><th>Recorded</th></tr></thead><tbody>{records.slice((currentPage-1)*6,currentPage*6).map((record,index)=><tr key={record._id || index}>
          <td><div className="admin-person-cell"><span className="admin-person-avatar" aria-hidden="true">{(record.student?.name || "?").split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join("").toUpperCase()}</span><span>{record.student?.name || "Student"}</span></div></td>
          <td>{record.event?.title || record.eventTitle || "Event unavailable"}</td><td><StatusChip status={record.status} /></td><td className="whitespace-nowrap">{record.attendedAt ? formatDateTime(record.attendedAt) : "Date unavailable"}</td>
        </tr>)}</tbody></table></div>
        <div className="admin-table-pager"><Pagination page={currentPage} pageSize={6} total={records.length} onChange={setPage} label="Admin attendance pages" /></div>
      </>}
    </Card>
  </div>;
}

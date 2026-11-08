import EventAttendanceSchedule from "../shared/EventAttendanceSchedule";
import "../../styles/admin-dashboard-bento.css";
import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import { useAutoRefresh } from "../../utils/useAutoRefresh";
import { formatDate, formatTime12Hour, splitEventsByLifecycle } from "../../utils/helpers";
import { Card, Button, StatusChip } from "../ui";
import Loading from "../shared/Loading";
import EmptyState from "../shared/EmptyState";
import { FaClipboardList, FaEnvelope, FaShieldAlt, FaUsers, FaArrowRight, FaCalendarAlt } from "react-icons/fa";
import { readScreen, writeScreen } from "../../utils/queryCache";

const CACHE_KEY = "admin:home:overview";

// The dashboard is a launcher: the next few events plus the queues that need a
// decision. Attendance records and their bulk actions now live on Reports only.
const EVENT_PREVIEW = 3;

const sources = [
  { key: "events", label: "Events", path: "/reports/events" },
  // Only the aggregate is used here, so ask for the smallest window the report
  // endpoint allows instead of loading 30 records the dashboard never renders.
  { key: "attendance", label: "Attendance", path: "/reports/attendance?limit=1" },
  { key: "appeals", label: "Face appeals", path: "/admin/security/face-appeals?status=pending" },
  { key: "excuses", label: "Excuse letters", path: "/organizer/excuses" },
  { key: "manual", label: "Manual attendance requests", path: "/manual-attendance/summary" },
];

export default function DashboardHome() {
  const seed = readScreen(CACHE_KEY);
  const [state, setState] = useState(
    seed
      ? { loading: false, events: null, attendance: null, appeals: null, excuses: null, manual: null, failures: [], ...seed }
      : { loading: true, events: null, attendance: null, appeals: null, excuses: null, manual: null, failures: [] }
  );
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
  useEffect(() => { window.addEventListener("tracked:manual-attendance-changed", load); return () => window.removeEventListener("tracked:manual-attendance-changed", load); }, [load]);
  useAutoRefresh(load, { interval: 30000 });
  if (state.loading) return <Loading label="Loading admin dashboard..." />;
  const stats = state.attendance?.stats;
  const total = stats?.total ?? 0;
  const attended = (stats?.present ?? 0) + (stats?.late ?? 0);
  const rate = total ? Math.round(attended / total * 100) : null;
  const events = state.events?.events || [];
  const active = splitEventsByLifecycle(events)
    .active.sort((a, b) => (a.status === "live" ? 0 : 1) - (b.status === "live" ? 0 : 1) || new Date(a.date) - new Date(b.date))
    .slice(0, EVENT_PREVIEW);
  const reviews = [
    { label: "ID Attendance", description: "Approve pending requests or assign event reviewers", count: state.manual?.pendingReview ?? null, path: "/admin/dashboard/reviews/manual", icon: <FaClipboardList /> },
    { label: "Face appeals", description: "Review student identity requests", count: state.appeals?.filter(item => item.status === "pending").length ?? null, path: "/admin/dashboard/reviews/face-appeals", icon: <FaShieldAlt /> },
    { label: "Excuse letters", description: "Review pending absence letters", count: state.excuses?.filter(item => item.status === "pending").length ?? null, path: "/admin/dashboard/reviews/excuses", icon: <FaEnvelope /> },
  ];
  return <div className="admin-home-page">
    <header className="admin-page-heading"><h1>Admin dashboard</h1><p>Attendance overview and the work that needs your attention.</p></header>
    {!!state.failures.length && <div role="alert" className="alert alert-danger"><p>Could not refresh: {state.failures.join(", ")}. Previously loaded records stay visible.</p><Button onClick={load} variant="secondary" size="sm">Try again</Button></div>}
    <div className="admin-bento-grid">
      <Card as="section" className="admin-home-rate">
        <div className="admin-bento-heading"><span className="admin-bento-icon" aria-hidden="true"><FaClipboardList /></span><div><p className="admin-bento-eyebrow">Attendance overview</p><h2>Attendance rate</h2></div></div>
        <div className="admin-rate-box"><span className="admin-rate-caption">Overall attendance</span><strong className="admin-rate-value" data-testid="admin-attendance-rate">{state.attendance && rate !== null ? `${rate}%` : "—"}</strong><span className="admin-rate-context">Present and late records count as attended</span></div>
        <p>{!state.attendance ? "Attendance data unavailable." : total ? `${attended} attended out of ${total} records.` : "No attendance records yet."}</p>
        <span className="sr-only">Present and late records count as attended. The total includes all recorded statuses.</span>
        <Link to="/admin/dashboard/reports" className="admin-text-link" aria-label="View attendance reports">View attendance reports →</Link>
      </Card>
      <Card as="section" className="admin-home-reviews">
        <div className="admin-section-heading"><h2>Needs review</h2><Link to="/admin/dashboard/reviews" className="admin-text-link">All reviews <FaArrowRight aria-hidden="true" /></Link></div>
        <ul className="admin-review-list">{reviews.map(item=><li key={item.label}><Link to={item.path} className="admin-review-box"><span className="admin-review-icon" aria-hidden="true">{item.icon}</span><span className="admin-review-text"><span className="admin-review-label">{item.label}</span><span className="admin-review-desc">{item.description}</span></span><strong className={`admin-review-count ${item.count ? "text-warn" : "text-on-muted"}`}>{item.count ?? "—"}</strong><span className="sr-only">{item.count === null ? "Unavailable" : " pending"}</span></Link></li>)}</ul>
      </Card>
      <Card as={Link} to="/admin/dashboard/users" aria-label="Manage users" className="admin-home-users">
        <span className="admin-bento-icon admin-users-icon" aria-hidden="true"><FaUsers /></span>
        <div className="admin-users-copy"><p className="admin-bento-eyebrow">People &amp; access</p><h2>Manage users</h2><p>View accounts, update student details, and manage organizer access.</p></div>
        <span className="admin-users-arrow" aria-hidden="true"><FaArrowRight /></span>
      </Card>
      <Card as="section" className="admin-home-events">
        <div className="admin-section-heading"><h2><FaCalendarAlt aria-hidden="true" /> Live &amp; upcoming events</h2><Link to="/admin/dashboard/events" className="admin-text-link">View all events →</Link></div>
        {!state.events ? <EmptyState compact title="Events unavailable" description="Try loading the event list again." /> : !active.length ? <EmptyState compact title="No active events" description="New events will appear here when scheduled." /> : <ul className="admin-next-list stretch-page-list gap-1">{active.map(event=><li key={event._id} className="admin-event-preview"><Link to={`/admin/dashboard/events/${event._id}`}><div><p className="line-clamp-2" title={event.title}>{event.title}</p><span>{formatDate(event.date)}{event.time ? ` · ${formatTime12Hour(event.time)}` : ""}</span>{event.location && <span className="admin-event-venue">{event.location}</span>}</div><StatusChip status={event.status} /></Link><div className="px-3.5 pb-3.5"><EventAttendanceSchedule event={event} compact /></div></li>)}</ul>}
      </Card>
    </div>
  </div>;
}

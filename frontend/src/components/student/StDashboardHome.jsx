import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { useAutoRefresh } from "../../utils/useAutoRefresh";
import { FaArrowRight, FaCalendarAlt, FaClock, FaMinus, FaPlus, FaUserCheck } from "react-icons/fa";
import { MdLocalActivity } from "react-icons/md";
import { usePageMeta } from "../../context/PageMetaContext";
import { splitEventsByLifecycle, formatDate } from "../../utils/helpers";
import { BaseCard, Button, FlightPanel, StatusPill } from "../ui";
import Loading from "../shared/Loading";
import Pagination from "../ui/Pagination";
import EmptyState from "../shared/EmptyState";
import StudentEventCard from "./StudentEventCard";

const DashboardHome = () => {
  const navigate = useNavigate();
  usePageMeta("Student Overview", "Your attendance and service activity at a glance.");
  const [stats, setStats] = useState(null);
  const [upcoming, setUpcoming] = useState(0);
  const [eventPage, setEventPage] = useState(1);
  const [attendance, setAttendance] = useState([]);
  const [attendanceError, setAttendanceError] = useState(false);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [activity, setActivity] = useState([]);
  const [activityPage, setActivityPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [serviceError, setServiceError] = useState("");
  const [eventsError, setEventsError] = useState("");
  const [penaltyRange, setPenaltyRange] = useState("year");

  const fetchAll = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      // A failed ledger request must not hide events or look like a zero balance.
      const [csResult, eventsResult, attendanceResult] = await Promise.allSettled([
        api.get("/student/community-service"),
        api.get("/events"),
        api.get("/events/my-attendance"),
      ]);
      if (csResult.status === "fulfilled") {
        const data = csResult.value.data;
        const breakdown = data.breakdown || [];
        setStats({ totalHours: data.totalHours || 0, totalAttended: data.totalAttended || 0, breakdown });
        setActivity([...breakdown].sort((a, b) => new Date(b.attendedAt || 0) - new Date(a.attendedAt || 0)));
        setServiceError("");
      } else {
        setServiceError("Service records could not be refreshed. Try again.");
      }
      if (eventsResult.status === "fulfilled") {
        const active = splitEventsByLifecycle(eventsResult.value.data).active.filter((event) => event.date);
        const visible = active;
        setUpcoming(active.length);
        setUpcomingEvents(visible);
        setEventsError("");
      } else {
        setEventsError("Upcoming events could not be refreshed. Try again.");
      }
      if (attendanceResult.status === "fulfilled") {
        setAttendance(attendanceResult.value.data);
        setAttendanceError(false);
      } else setAttendanceError(true);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useAutoRefresh(fetchAll);

  if (loading) return <Loading label="Loading your dashboard..." />;

  const currentActivityPage = Math.min(activityPage, Math.max(1, Math.ceil(activity.length / 6)));
  const currentEventPage = Math.min(eventPage, Math.max(1, upcomingEvents.length));
  const visibleEvents = upcomingEvents.slice(currentEventPage - 1, currentEventPage);
  const visibleActivity = activity.slice((currentActivityPage - 1) * 6, currentActivityPage * 6);
  const records = stats?.breakdown || [];
  const rangeLabel = penaltyRange === "day" ? "the last 24 hours" : penaltyRange === "week" ? "the last 7 days" : "the last 365 days";
  const cutoff = Date.now() - ({ day: 1, week: 7, year: 365 }[penaltyRange] * 24 * 60 * 60 * 1000);
  const sumLog = (action, status) => records.filter((record) => !status || record.status === status).reduce((sum, record) => sum + (record.communityServiceLog || []).filter((log) => {
    const timestamp = new Date(log.at).getTime();
    return log.action === action && (Number.isFinite(timestamp) ? timestamp : Date.now()) >= cutoff;
  }).reduce((total, log) => total + (log.hours || 0), 0), 0);
  const retry = <Button variant="secondary" size="sm" onClick={() => fetchAll()}>Try again</Button>;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight text-on sm:text-2xl">Student dashboard</h1>
          <p className="mt-1 text-sm text-on-dim">Your service balance first, then what is happening next.</p>
        </div>

      </header>

      <FlightPanel
        as="section" level="command" glass icon={<FaClock />}
        title="Community service ledger"
        subtitle="Your current balance and the changes behind it."
        className="overflow-hidden"
        actions={<Button variant="secondary" size="sm" onClick={() => navigate("/student/dashboard/community-service")}>Full ledger <FaArrowRight className="text-[10px]" /></Button>}
        data-testid="service-ledger"
      >
        {serviceError && <div role="alert" className="alert alert-danger mb-4"><p>{serviceError}{stats ? " Showing the last loaded records." : ""}</p>{retry}</div>}
        {!stats ? (
          <EmptyState compact title="Service balance unavailable" description="Your balance will appear when your records can be loaded." />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1.2fr_1fr_1fr]">
              <div className="col-span-2 rounded-xl border border-brand/25 bg-brand/5 p-4 sm:col-span-1">
                <p className="text-xs font-medium text-on-dim">Current service balance</p>
                <p className="num mt-2 font-display text-4xl font-bold tracking-tight text-on sm:text-5xl" data-testid="service-balance">
                  {stats.totalHours}<span className="ml-2 text-sm font-medium text-on-muted">hrs</span>
                </p>
                <p className="mt-1 text-xs text-on-muted">All-time hours remaining</p>
              </div>
              <div className="rounded-xl border border-line bg-card-alt/30 p-4">
                <p className="text-xs font-medium text-on-dim">Absent penalties</p>
                <p className="num mt-2 text-3xl font-semibold text-danger">{sumLog("penalty", "absent")}<span className="ml-1 text-sm font-normal">hrs</span></p>
                <p className="mt-1 text-xs text-on-muted">8 hours per absent mark</p>
              </div>
              <div className="rounded-xl border border-line bg-card-alt/30 p-4">
                <p className="text-xs font-medium text-on-dim">Late penalties</p>
                <p className="num mt-2 text-3xl font-semibold text-warn">{sumLog("penalty", "late")}<span className="ml-1 text-sm font-normal">hrs</span></p>
                <p className="mt-1 text-xs text-on-muted">4 hours per late mark</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-x-5 gap-y-3 border-t border-line pt-3 text-xs">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <span className="inline-flex items-center gap-1.5 text-on-muted"><FaPlus className="text-[10px] text-danger" /> Penalties added <strong className="num text-danger">+{sumLog("penalty")} hrs</strong></span>
                <span className="inline-flex items-center gap-1.5 text-on-muted"><FaMinus className="text-[10px] text-ok" /> Hours removed <strong className="num text-ok">−{sumLog("removed")} hrs</strong></span>
              </div>
              <label className="flex items-center gap-2 text-on-muted" htmlFor="ledger-range">
                Changes
                <select aria-label="Ledger changes range" id="ledger-range" value={penaltyRange} onChange={(event) => setPenaltyRange(event.target.value)} className="rounded-lg border border-line bg-card px-2 py-1.5 text-xs text-on focus:outline-none focus:ring-2 focus:ring-brand/30">
                  <option value="day">Last 24 hours</option><option value="week">Last 7 days</option><option value="year">Last 365 days</option>
                </select>
              </label>
            </div>
            <p className="mt-2 text-xs text-on-muted">Changes cover {rangeLabel}. Approved excuses and staff adjustments are included in the full ledger.</p>
          </>
        )}
      </FlightPanel>

      <div className="grid gap-5 lg:grid-cols-2" data-testid="dashboard-panels">
        <BaseCard title={eventsError && !upcomingEvents.length ? "Upcoming events" : `Upcoming events (${upcoming})`} description="Event details and your attendance at a glance." icon={<FaCalendarAlt />} className="min-w-0 overflow-hidden lg:flex lg:h-[32rem] lg:flex-col [&>.fd-rail]:shrink-0" bodyClassName="min-h-0 flex-1 lg:overflow-y-auto [scrollbar-gutter:stable]" menu={<Button variant="ghost" size="sm" onClick={() => navigate("/student/dashboard/events")}>View all <FaArrowRight className="text-[10px]" /></Button>}>
          {eventsError && <div role="alert" className="alert alert-danger mb-4"><p>{eventsError}</p>{retry}</div>}
          {!upcomingEvents.length ? <EmptyState compact title={eventsError ? "Events unavailable" : "No upcoming events"} description={eventsError ? "Try loading the event list again." : "New events will appear here when they are published."} /> : <>
            {visibleEvents.map((event) => <StudentEventCard key={event._id} event={event} attendance={attendance.find((record) => (record.event?._id || record.event) === event._id)} attendanceError={attendanceError} />)}
            <Pagination page={currentEventPage} pageSize={1} total={upcomingEvents.length} onChange={setEventPage} label="Upcoming event pages" />
          </>}
        </BaseCard>

        <BaseCard title="Recent activity" description="Your latest attendance updates." icon={<MdLocalActivity />} className="min-w-0 overflow-hidden lg:flex lg:h-[32rem] lg:flex-col [&>.fd-rail]:shrink-0" bodyClassName="min-h-0 flex-1 lg:overflow-y-auto [scrollbar-gutter:stable]">
          {!stats ? <EmptyState compact title="Activity unavailable" description="Activity will appear when your service records can be loaded." /> : !activity.length ? <EmptyState compact title="No activity yet" description="Check in at your next event to start your record." /> : <><ul className="divide-y divide-line">
            {visibleActivity.map((record, index) => <li key={record._id || index} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${record.status === "absent" ? "bg-danger/10 text-danger ring-danger/20" : record.status === "late" ? "bg-warn/10 text-warn ring-warn/20" : "bg-card-alt text-on-dim ring-line"}`}>{record.status === "present" ? <FaUserCheck /> : <FaClock />}</span>
              <div className="min-w-0 flex-1"><p className="break-words text-sm font-medium text-on">{record.event?.title || record.eventTitle || "Unknown event"}</p><p className="mt-1 text-xs text-on-muted">{record.event?.date || record.eventDate ? formatDate(record.event?.date || record.eventDate) : "Date unavailable"}</p></div><StatusPill status={record.status} />
            </li>)}
          </ul><Pagination page={currentActivityPage} pageSize={6} total={activity.length} onChange={setActivityPage} label="Recent attendance pages" /></>}
        </BaseCard>
      </div>
    </div>
  );
};

export default DashboardHome;

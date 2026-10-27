import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { useAutoRefresh } from "../../utils/useAutoRefresh";
import { FaArrowRight, FaCalendarAlt, FaClock, FaMapMarkerAlt, FaMinus, FaPlus, FaUserCheck } from "react-icons/fa";
import { MdLocalActivity } from "react-icons/md";
import { usePageMeta } from "../../context/PageMetaContext";
import { splitEventsByLifecycle, formatDate } from "../../utils/helpers";
import { BaseCard, Button, FlightPanel, StatusPill } from "../ui";
import Loading from "../shared/Loading";
import EmptyState from "../shared/EmptyState";
import EventMap from "../shared/EventMap";

const DashboardHome = () => {
  const navigate = useNavigate();
  usePageMeta("Student Overview", "Your attendance and service activity at a glance.");
  const [stats, setStats] = useState(null);
  const [upcoming, setUpcoming] = useState(0);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [selectedUpcoming, setSelectedUpcoming] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [serviceError, setServiceError] = useState("");
  const [eventsError, setEventsError] = useState("");
  const [penaltyRange, setPenaltyRange] = useState("year");

  const fetchAll = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      // A failed ledger request must not hide events or look like a zero balance.
      const [csResult, eventsResult] = await Promise.allSettled([
        api.get("/student/community-service"),
        api.get("/events"),
      ]);
      if (csResult.status === "fulfilled") {
        const data = csResult.value.data;
        const breakdown = data.breakdown || [];
        setStats({ totalHours: data.totalHours || 0, totalAttended: data.totalAttended || 0, breakdown });
        setActivity([...breakdown].sort((a, b) => new Date(b.attendedAt || 0) - new Date(a.attendedAt || 0)).slice(0, 6));
        setServiceError("");
      } else {
        setServiceError("Service records could not be refreshed. Try again.");
      }
      if (eventsResult.status === "fulfilled") {
        const active = splitEventsByLifecycle(eventsResult.value.data).active.filter((event) => event.date);
        const visible = active.slice(0, 4);
        setUpcoming(active.length);
        setUpcomingEvents(visible);
        setSelectedUpcoming((current) => visible.some((event) => event._id === current) ? current : visible[0]?._id || null);
        setEventsError("");
      } else {
        setEventsError("Upcoming events could not be refreshed. Try again.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useAutoRefresh(fetchAll);

  if (loading) return <Loading label="Loading your dashboard..." />;

  const records = stats?.breakdown || [];
  const selectedEvent = upcomingEvents.find((event) => event._id === selectedUpcoming) || upcomingEvents[0];
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
        eyebrow="Your priority" title="Community service ledger"
        subtitle="Your current balance and the changes behind it."
        className="overflow-hidden"
        data-testid="service-ledger"
      >
        {serviceError && <div role="alert" className="alert alert-danger mb-4"><p>{serviceError}{stats ? " Showing the last loaded records." : ""}</p>{retry}</div>}
        {!stats ? (
          <EmptyState compact title="Service balance unavailable" description="Your balance will appear when your records can be loaded." />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-on-muted">
              <p>Balance includes all records. Changes below use the selected range.</p>
              <label className="flex items-center gap-2" htmlFor="ledger-range">
                Changes
                <select aria-label="Ledger changes range" id="ledger-range" value={penaltyRange} onChange={(event) => setPenaltyRange(event.target.value)} className="rounded-lg border border-line bg-card px-2 py-1.5 text-xs text-on focus:outline-none focus:ring-2 focus:ring-brand/30">
                  <option value="day">Last 24 hours</option><option value="week">Last 7 days</option><option value="year">Last 365 days</option>
                </select>
              </label>
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(240px,0.85fr)_2fr]">
              <div className="rounded-2xl border border-brand/25 bg-brand/5 p-5">
                <p className="eyebrow">Current service balance</p>
                <p className="num mt-3 font-display text-5xl font-bold leading-none tracking-tight text-on sm:text-6xl" data-testid="service-balance">
                  {stats.totalHours}<span className="ml-2 text-base font-medium text-on-muted">hrs</span>
                </p>
                <p className="mt-2 text-xs text-on-muted">Hours remaining after penalties and adjustments</p>
                <div className="mt-5 space-y-2 border-t border-line pt-3 text-xs">
                  <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-on-muted"><FaPlus className="text-[10px] text-danger" /> Penalties added</span><span className="num font-semibold text-danger">+{sumLog("penalty")} hrs</span></div>
                  <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-on-muted"><FaMinus className="text-[10px] text-ok" /> Hours removed</span><span className="num font-semibold text-ok">−{sumLog("removed")} hrs</span></div>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-line bg-card-alt/30 p-5">
                  <p className="text-xs font-medium text-on-dim">Absent penalties</p>
                  <p className="num mt-3 text-3xl font-semibold text-danger">{sumLog("penalty", "absent")}<span className="ml-1 text-sm font-normal">hrs</span></p>
                  <p className="mt-2 text-xs text-on-muted">8 hours per absent mark</p>
                </div>
                <div className="rounded-2xl border border-line bg-card-alt/30 p-5">
                  <p className="text-xs font-medium text-on-dim">Late penalties</p>
                  <p className="num mt-3 text-3xl font-semibold text-warn">{sumLog("penalty", "late")}<span className="ml-1 text-sm font-normal">hrs</span></p>
                  <p className="mt-2 text-xs text-on-muted">4 hours per late mark</p>
                </div>
                <p className="text-xs leading-relaxed text-on-muted sm:col-span-2">Penalty additions and removals cover {rangeLabel}. Approved excuses and staff adjustments can change your balance; full records include each adjustment.</p>
              </div>
            </div>
            <div className="mt-4 flex justify-end"><Button variant="secondary" size="sm" onClick={() => navigate("/student/dashboard/community-service")}>View full ledger <FaArrowRight className="text-[10px]" /></Button></div>
          </>
        )}
      </FlightPanel>

      <div className="grid items-start gap-5 lg:grid-cols-2" data-testid="dashboard-panels">
        <BaseCard title={eventsError && !upcomingEvents.length ? "Upcoming events" : `Upcoming events (${upcoming})`} description="Choose an event to preview its venue." icon={<FaCalendarAlt />} className="min-w-0" menu={<Button variant="ghost" size="sm" onClick={() => navigate("/student/dashboard/events")}>View all <FaArrowRight className="text-[10px]" /></Button>}>
          {eventsError && <div role="alert" className="alert alert-danger mb-4"><p>{eventsError}</p>{retry}</div>}
          {!upcomingEvents.length ? <EmptyState compact title={eventsError ? "Events unavailable" : "No upcoming events"} description={eventsError ? "Try loading the event list again." : "New events will appear here when they are published."} /> : <>
            <ul className="space-y-2" aria-label="Upcoming event list">
              {upcomingEvents.map((event) => <li key={event._id}>
                <button type="button" onClick={() => setSelectedUpcoming(event._id)} aria-pressed={selectedEvent?._id === event._id} className={`w-full rounded-xl border p-3 text-left transition-colors ${selectedEvent?._id === event._id ? "border-brand/40 bg-brand/10" : "border-line bg-card-alt/30 hover:bg-card-alt"}`}>
                  <p className="break-words text-sm font-medium text-on">{event.title}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-on-muted"><span className="inline-flex items-center gap-1.5"><FaCalendarAlt />{formatDate(event.date)}</span>{event.location && <span className="inline-flex min-w-0 items-center gap-1.5"><FaMapMarkerAlt className="shrink-0" /><span className="break-words">{event.location}</span></span>}</div>
                </button>
              </li>)}
            </ul>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><p className="min-w-0 break-words text-xs text-on-muted">Venue: {selectedEvent.title}</p><Button variant="secondary" size="sm" onClick={() => navigate(`/student/dashboard/events/${selectedEvent._id}`)}>Open event details <FaArrowRight className="text-[10px]" /></Button></div>
            <div className="relative mt-3 h-52 overflow-hidden rounded-xl border border-line bg-card-alt/50"><EventMap key={selectedEvent._id} event={selectedEvent} frame={false} fill className="h-full w-full" /></div>
          </>}
        </BaseCard>

        <BaseCard title="Recent activity" description="Your latest attendance updates." icon={<MdLocalActivity />} className="min-w-0">
          {!stats ? <EmptyState compact title="Activity unavailable" description="Activity will appear when your service records can be loaded." /> : !activity.length ? <EmptyState compact title="No activity yet" description="Check in at your next event to start your record." /> : <ul className="divide-y divide-line">
            {activity.map((record, index) => <li key={record._id || index} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${record.status === "absent" ? "bg-danger/10 text-danger ring-danger/20" : record.status === "late" ? "bg-warn/10 text-warn ring-warn/20" : "bg-card-alt text-on-dim ring-line"}`}>{record.status === "present" ? <FaUserCheck /> : <FaClock />}</span>
              <div className="min-w-0 flex-1"><p className="break-words text-sm font-medium text-on">{record.event?.title || record.eventTitle || "Unknown event"}</p><p className="mt-1 text-xs text-on-muted">{record.event?.date || record.eventDate ? formatDate(record.event?.date || record.eventDate) : "Date unavailable"}</p><div className="mt-2"><StatusPill status={record.status} /></div></div>
            </li>)}
          </ul>}
        </BaseCard>
      </div>
    </div>
  );
};

export default DashboardHome;

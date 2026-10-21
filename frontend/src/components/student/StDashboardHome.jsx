import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import {
  FaArrowRight,
  FaCalendarAlt,
  FaCalendarCheck,
  FaClock,
  FaEdit,
  FaMapMarkerAlt,
  FaMinus,
  FaPlus,
  FaTrophy,
  FaUserCheck,
} from "react-icons/fa";
import { MdLocalActivity } from "react-icons/md";
import { usePageMeta } from "../../context/PageMetaContext";
import { splitEventsByLifecycle, formatDate } from "../../utils/helpers";
import {
  BaseCard,
  Button,
  StatTile,
  StatusPill,
  ProgressBar,
  ProgressRing,
  BadgeItem,
} from "../ui";
import Loading from "../shared/Loading";
import EmptyState from "../shared/EmptyState";
import EventMap from "../shared/EventMap";
import TodayCard from "./TodayCard";

// Late/absent marks add 8/4 to the student's community service hours; excuses
// and removals take them off. Organizers/admin can adjust the hours manually.
const EVENTS_BADGE = 5;

const DashboardHome = () => {
  const navigate = useNavigate();
  usePageMeta("Student Overview", "Your attendance and service activity at a glance.");
  const [stats, setStats] = useState({ totalHours: 0, completedHours: 0, totalAttended: 0, breakdown: [] });
  const [upcoming, setUpcoming] = useState(0);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [selectedUpcoming, setSelectedUpcoming] = useState(0);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [penaltyRange, setPenaltyRange] = useState("year");

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      setError("");
      try {
        // Fetch stats and events independently — a stats failure must never
        // hide the upcoming events list (or vice versa).
        const [csResult, eventsResult] = await Promise.allSettled([
          api.get("/student/community-service"),
          api.get("/events"),
        ]);

        const csData = csResult.status === "fulfilled" ? csResult.value.data : null;
        const eventsData = eventsResult.status === "fulfilled" ? eventsResult.value.data : [];

        if (!csData && eventsResult.status !== "fulfilled") {
          setError(csResult.reason?.message || "Could not load dashboard data");
          return;
        }

        const breakdown = (csData && csData.breakdown) || [];
        setStats({
          totalHours: (csData && csData.totalHours) || 0,
          completedHours: (csData && csData.completedHours) || 0,
          totalAttended: (csData && csData.totalAttended) || 0,
          breakdown,
        });

        // Recent Activity — the student's own attendance/community-service records.
        const sortedActivity = [...breakdown].sort(
          (a, b) => new Date(b.attendedAt || 0) - new Date(a.attendedAt || 0)
        );
        setActivity(sortedActivity.slice(0, 6));

        // "Upcoming" means what a student can still act on. The backend finishes
        // an event when its end time passes, so the status — not the date — is
        // what separates an upcoming event from history.
        const upcomingList = splitEventsByLifecycle(eventsData).active.filter((e) => e.date);
        setUpcoming(upcomingList.length);
        setUpcomingEvents(upcomingList.slice(0, 4));
        setSelectedUpcoming(0);
      } catch (err) {
        const msg = err.response?.data?.error || err.message;
        setError(msg);
        console.error(msg);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

// Aggregate community-service log entries within the selected day/week/year
// window so students can track their hours. Logs recorded without a timestamp
// are treated as "now" so they always count. Pass a status to sum penalties
// from only absent or only late records (for the 0→8 / 0→4 meters).
const windowCutoff = () => {
    const ranges = {
      day: 1 * 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000,
    };
    return Date.now() - ranges[penaltyRange];
  };

  const inWindow = (l) => {
    const t = new Date(l.at).getTime();
    const ts = Number.isFinite(t) ? t : Date.now();
    return ts >= windowCutoff();
  };

  const sumLog = (action, status) =>
    (stats.breakdown || [])
      .filter((rec) => !status || rec.status === status)
      .reduce((sum, rec) => {
        const logs = (rec.communityServiceLog || []).filter(
          (l) => l.action === action && inWindow(l)
        );
        return sum + logs.reduce((s, l) => s + (l.hours || 0), 0);
      }, 0);

  const badges = useMemo(
    () => [
      {
        icon: <FaUserCheck />,
        label: "Attend your first event",
        current: stats.totalAttended,
        target: 1,
        unit: "event",
        earned: stats.totalAttended >= 1,
      },
      {
        icon: <FaCalendarAlt />,
        label: `${EVENTS_BADGE}+ events attended`,
        current: stats.totalAttended,
        target: EVENTS_BADGE,
        unit: "events",
        earned: stats.totalAttended >= EVENTS_BADGE,
      },
      {
        icon: <FaTrophy />,
        label: "Perfect attendance",
        current: activity.filter((r) => r.status !== "absent").length,
        target: activity.length,
        unit: "event",
        binary: true,
        earned: activity.length > 0 && activity.every((r) => r.status !== "absent"),
      },
    ],
    [stats.totalAttended, activity]
  );

  if (loading) return <Loading label="Loading your dashboard..." />;

  if (error) {
    return (
      <EmptyState
        icon={<FaUserCheck />}
        title="Couldn't load your dashboard"
        description={error}
      />
    );
  }

  const quickActions = [
    { label: "Attend Events", icon: <FaCalendarAlt />, path: "/student/dashboard/events", color: "text-ok bg-ok/10 border-ok/20" },
    { label: "Submit Excuse", icon: <FaEdit />, path: "/student/dashboard/submit-excuse", color: "text-warn bg-warn/10 border-warn/20" },
    { label: "Community Service", icon: <FaClock />, path: "/student/dashboard/community-service", color: "text-brand bg-brand/10 border-brand/20" },
  ];

  const records = stats.breakdown || [];
  const selectedEvent = upcomingEvents[selectedUpcoming] || upcomingEvents[0];
  const attendanceRate = records.length
    ? Math.round((stats.totalAttended / records.length) * 100)
    : 0;
  const rangeLabel =
    penaltyRange === "day" ? "today" : penaltyRange === "week" ? "this week" : "this year";

  return (
    <div className="space-y-5">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-line bg-card p-6 shadow-[var(--elev-2)] sm:p-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-brand/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 left-1/4 h-56 w-56 rounded-full bg-brand-3/10 blur-3xl"
        />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="min-w-0">
            <p className="eyebrow">Student overview</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-on sm:text-4xl">
              Welcome back
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-on-dim">
              {upcoming > 0
                ? `You have ${upcoming} event${upcoming === 1 ? "" : "s"} still open to join. Keep your service hours on track.`
                : "No open events right now. Your attendance and service history are below."}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button onClick={() => navigate("/student/dashboard/events")}>
                Browse events <FaArrowRight className="text-[11px]" />
              </Button>
              <Button
                variant="secondary"
                onClick={() => navigate("/student/dashboard/submit-excuse")}
              >
                Submit an excuse
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-line bg-card-alt/50 p-4">
            <ProgressRing
              value={attendanceRate}
              max={100}
              label={`${attendanceRate}%`}
              sublabel="attendance"
              size={104}
              stroke={9}
              tone="ok"
            />
            <div className="min-w-0">
              <p className="eyebrow">Service hours</p>
              <p className="num mt-1 text-3xl font-bold leading-none text-on">
                {stats.totalHours}
                <span className="ml-1 text-sm font-medium text-on-muted">h</span>
              </p>
              <p className="mt-1 text-xs text-on-muted">Penalty-adjusted total</p>
              <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-ok/10 px-2 py-0.5 text-[11px] font-medium text-ok ring-1 ring-inset ring-ok/20">
                <FaCalendarCheck className="text-[10px]" /> {stats.totalAttended} attended
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Events attended"
          value={stats.totalAttended}
          icon={<FaUserCheck />}
          hint="All-time check-ins"
          tone="ok"
          to="/student/dashboard/community-service"
        />
        <StatTile
          label="Upcoming events"
          value={upcoming}
          icon={<FaCalendarAlt />}
          hint="Still open to join"
          tone="info"
          to="/student/dashboard/events"
        />
        <StatTile
          label="Service hours"
          value={`${stats.totalHours}h`}
          icon={<FaClock />}
          hint="Penalties and adjustments"
          tone="warn"
          to="/student/dashboard/community-service"
        />
        <StatTile
          label="Attendance rate"
          value={`${attendanceRate}%`}
          icon={<FaCalendarCheck />}
          hint={`${records.length} logged record${records.length === 1 ? "" : "s"}`}
          tone={attendanceRate >= 80 ? "ok" : attendanceRate >= 50 ? "warn" : "danger"}
        />
      </div>

      {/* Main bento — paired rows so each card matches its neighbour's height */}
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="contents">
          <BaseCard
            title="Upcoming events"
            icon={<FaCalendarAlt />}
            className="order-1 flex flex-col xl:col-span-2"
            bodyClassName="flex flex-1 flex-col"
            menu={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/student/dashboard/events")}
              >
                View all <FaArrowRight className="text-[10px]" />
              </Button>
            }
          >
            {!upcomingEvents.length ? (
              <EmptyState
                compact
                title="No upcoming events"
                description="New events will appear here as soon as they are published."
              />
            ) : (
              <>
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-base font-semibold text-on">
                      {selectedEvent.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-on-dim">
                      <span className="inline-flex items-center gap-1.5">
                        <FaCalendarAlt className="text-[11px] text-brand" />
                        {selectedEvent.date ? formatDate(selectedEvent.date) : "Date TBA"}
                      </span>
                      {selectedEvent.location && (
                        <span className="inline-flex items-center gap-1.5">
                          <FaMapMarkerAlt className="text-[11px] text-brand" />
                          {selectedEvent.location}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(`/student/dashboard/events/${selectedEvent._id}`)}
                  >
                    Open event details <FaArrowRight className="text-[10px]" />
                  </Button>
                </div>

                <div className="relative min-h-[22rem] flex-1 overflow-hidden rounded-xl border border-line bg-card-alt/50">
                  <EventMap event={selectedEvent} frame={false} fill className="h-full w-full" />
                </div>
              </>
            )}
          </BaseCard>

          <BaseCard
            title="Recent activity"
            description="Your latest attendance and service records."
            icon={<MdLocalActivity />}
            className="order-3 flex flex-col xl:col-span-2"
            bodyClassName="flex flex-1 flex-col"
          >
            {!activity.length ? (
              <EmptyState
                compact
                title="No activity yet"
                description="Check in at your next event to start your record."
              />
            ) : (
              <ul className="divide-y divide-line">
                {activity.map((record, idx) => {
                  const isAbsent = record.status === "absent";
                  return (
                    <li key={idx} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${
                          isAbsent
                            ? "bg-danger/10 text-danger ring-danger/20"
                            : "bg-ok/10 text-ok ring-ok/20"
                        }`}
                      >
                        {isAbsent ? <FaClock /> : <FaUserCheck />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-on">
                          {record.event?.title || record.eventTitle || "Unknown event"}
                        </p>
                        <p className="mt-0.5 text-xs text-on-muted">
                          {record.event?.date
                            ? formatDate(record.event.date)
                            : record.eventDate
                              ? formatDate(record.eventDate)
                              : "—"}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <StatusPill status={record.status} />
                        <p className="mt-1 text-[11px] text-on-muted">
                          {record.communityServiceHours || 0} hrs
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </BaseCard>
        </div>

        <div className="contents">
          <BaseCard title="Today" icon={<FaClock />} className="order-2 flex flex-col">
            <TodayCard
              events={upcomingEvents}
              selectedUpcoming={selectedUpcoming}
              onSelectEvent={setSelectedUpcoming}
              quickActions={quickActions}
            />
          </BaseCard>

          <BaseCard
            title="Achievements"
            icon={<FaTrophy />}
            className="order-4 flex flex-col"
            bodyClassName="flex flex-1 flex-col gap-4"
          >
            <div className="space-y-4">
              {badges.map((b, i) => (
                <div key={i} className="space-y-2">
                  <BadgeItem earned={b.earned} icon={b.icon} label={b.label} />
                  {b.binary ? (
                    <p className={`text-xs ${b.earned ? "text-ok" : "text-on-muted"}`}>
                      {b.earned
                        ? "No absences — flawless record."
                        : "Attend every event with no absences."}
                    </p>
                  ) : (
                    <ProgressBar
                      current={Math.min(b.current, b.target)}
                      target={b.target}
                      tone={b.earned ? "ok" : "brand"}
                      label={
                        b.earned
                          ? "Unlocked"
                          : b.current > 0
                            ? `${b.current} / ${b.target} ${b.unit} — ${b.target - b.current} to go`
                            : `${b.target} ${b.target === 1 ? "event" : b.unit} needed`
                      }
                    />
                  )}
                </div>
              ))}
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="mt-auto w-full"
              onClick={() => navigate("/student/dashboard/community-service")}
            >
              Track my service
            </Button>
          </BaseCard>
        </div>
      </div>

      {/* Community service ledger */}
      <BaseCard
        title="Community service ledger"
        description="How penalties and adjustments move your hours."
        icon={<FaClock />}
        menu={
          <label className="flex items-center gap-2 text-xs text-on-muted">
            <span className="hidden sm:inline">Range</span>
            <select
              value={penaltyRange}
              onChange={(e) => setPenaltyRange(e.target.value)}
              className="rounded-lg border border-line bg-card px-2 py-1.5 text-xs text-on focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              <option value="day">This day</option>
              <option value="week">This week</option>
              <option value="year">This year</option>
            </select>
          </label>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <div className="rounded-2xl border border-line bg-card-alt/50 p-4">
            <p className="eyebrow">Community service hours</p>
            <p className="num mt-2 text-4xl font-bold leading-none text-on">
              {stats.totalHours}
              <span className="ml-1 text-sm font-medium text-on-muted">hrs</span>
            </p>
            <div className="mt-4 space-y-2 border-t border-line pt-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-on-muted">
                  <FaPlus className="text-[10px] text-danger" /> Added
                </span>
                <span className="num font-semibold text-danger">+{sumLog("penalty")} hrs</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-on-muted">
                  <FaMinus className="text-[10px] text-ok" /> Removed
                </span>
                <span className="num font-semibold text-ok">−{sumLog("removed")} hrs</span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-line p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-on-dim">Absent penalty</p>
                <span className="num text-sm font-semibold text-danger">
                  {sumLog("penalty", "absent")} hrs
                </span>
              </div>
              <ProgressBar
                className="mt-3"
                current={Math.min(sumLog("penalty", "absent"), 8)}
                target={8}
                tone="danger"
                label="0–8 hrs per absent mark"
              />
            </div>
            <div className="rounded-2xl border border-line p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-on-dim">Late penalty</p>
                <span className="num text-sm font-semibold text-warn">
                  {sumLog("penalty", "late")} hrs
                </span>
              </div>
              <ProgressBar
                className="mt-3"
                current={Math.min(sumLog("penalty", "late"), 4)}
                target={4}
                tone="warn"
                label="0–4 hrs per late mark"
              />
            </div>
            <div className="alert alert-info sm:col-span-2">
              <span aria-hidden="true" className="mt-0.5 text-xs">i</span>
              <p className="text-xs leading-relaxed">
                Late marks add 4 hrs and absent marks add 8 hrs to your community
                service hours; approved excuses and removals take hours off. An
                organizer or admin may adjust these at their discretion. Showing{" "}
                <span className="font-semibold">{rangeLabel}</span>.
              </p>
            </div>
          </div>
        </div>
      </BaseCard>
    </div>
  );
};

export default DashboardHome;

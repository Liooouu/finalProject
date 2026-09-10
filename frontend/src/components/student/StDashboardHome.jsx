import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import {
  FaCalendarAlt,
  FaClock,
  FaEdit,
  FaUserCheck,
  FaTrophy,
  FaEllipsisH,
  FaMapMarkerAlt,
  FaPlus,
  FaMinus,
} from "react-icons/fa";
import { BsClipboardCheck, BsEmojiSmile } from "react-icons/bs";
import { MdLocalActivity } from "react-icons/md";
import { usePageMeta } from "../../context/PageMetaContext";
import {
  BaseCard,
  StatusPill,
  ProgressBar,
  BadgeItem,
} from "../ui";
import Loading from "../shared/Loading";
import EmptyState from "../shared/EmptyState";
import EventMap from "../shared/EventMap";
import TodayCard from "./TodayCard";

// The goal is set exactly by organizers/admins ("Set goal" box) and stays fixed;
// late/absent marks add to the student's community service hours instead.
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
          requiredHours: (csData && csData.requiredHours) ?? 0,
          breakdown,
        });

        // Recent Activity — the student's own attendance/community-service records.
        const sortedActivity = [...breakdown].sort(
          (a, b) => new Date(b.attendedAt || 0) - new Date(a.attendedAt || 0)
        );
        setActivity(sortedActivity.slice(0, 6));

        // Show every created event — past, present or future. The section reads all
        // non-closed events, prioritizing upcoming ones (soonest first) then
        // present, then the most recent past events.
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const upcomingList = eventsData
          .filter((e) => e.date)
          .sort((a, b) => {
            const A = new Date(a.date);
            const B = new Date(b.date);
            const aFuture = A >= todayStart;
            const bFuture = B >= todayStart;
            if (aFuture !== bFuture) return aFuture ? -1 : 1;
            return aFuture ? A - B : B - A;
          });
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
        icon: <BsClipboardCheck />,
        label: "Perfect attendance",
        current: activity.filter((r) => r.status !== "absent").length,
        target: activity.length,
        unit: "event",
        binary: true,
        earned: activity.length > 0 && activity.every((r) => r.status !== "absent"),
      },
      ...(() => {
        const goal = stats.requiredHours || 0;
        const allDone = goal > 0 && stats.completedHours >= goal;
        return [
          {
            icon: allDone ? <FaTrophy /> : <FaClock />,
            label: allDone ? "Service hours complete!" : `${goal}+ service hours`,
            current: stats.completedHours,
            target: goal,
            unit: "hrs",
            earned: allDone,
          },
        ];
      })(),
    ],
    [stats.totalAttended, stats.completedHours, stats.requiredHours, activity]
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
    { label: "Attend Events", icon: <FaCalendarAlt />, path: "/student/dashboard/events", color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
    { label: "Submit Excuse", icon: <FaEdit />, path: "/student/dashboard/submit-excuse", color: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20" },
    { label: "Community Service", icon: <FaClock />, path: "/student/dashboard/community-service", color: "text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20" },
  ];

  const menu = (
    <button className="text-on-muted hover:text-on transition-colors p-1" aria-label="More options">
      <FaEllipsisH />
    </button>
  );

  return (
    <div className="space-y-6">
      {/* ===== ROW 1: Upcoming Events + Live calendar (side by side) ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ===== TOP-LEFT PRIORITY: Upcoming Events + Location Map ===== */}
        <div className="lg:col-span-2">
          <BaseCard
            title="Upcoming Events"
            icon={<FaCalendarAlt />}
            className="h-full flex flex-col"
            bodyClassName="flex flex-1 flex-col min-h-0"
            centerTitle
          >
            {upcomingEvents.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <span className="text-3xl text-on-muted mb-2"><BsEmojiSmile /></span>
                <p className="text-on-dim text-sm">No upcoming events right now — check back soon.</p>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <ul className="divide-y divide-line">
                  {upcomingEvents.map((event, i) => (
                    <li key={event._id}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedUpcoming(i)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") setSelectedUpcoming(i);
                        }}
                        className={`flex items-center gap-3 rounded-lg py-3 transition-colors ${
                          selectedUpcoming === i ? "cursor-pointer" : "cursor-pointer hover:bg-card-alt/50"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className={`truncate font-medium ${selectedUpcoming === i ? "text-indigo-600 dark:text-indigo-400" : "text-on"}`}>
                            {event.title}
                          </p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-on-muted">
                            <FaCalendarAlt className="text-[10px]" />
                            {event.date ? new Date(event.date).toLocaleDateString() : "-"}
                            {event.location && (
                              <>
                                <span>·</span>
                                <FaMapMarkerAlt className="text-[10px]" />
                                {event.location}
                              </>
                            )}
                          </p>
                        </div>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            navigate(`/student/dashboard/events/${event._id}`);
                          }}
                          onKeyDown={(ev) => {
                            if (ev.key === "Enter" || ev.key === " ") {
                              ev.stopPropagation();
                              navigate(`/student/dashboard/events/${event._id}`);
                            }
                          }}
                          className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-on-dim transition-colors hover:border-indigo-500/40 hover:text-indigo-600"
                        >
                          View
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="mt-5 flex w-auto flex-1 flex-col overflow-hidden rounded-xl border border-line p-2">
                  <EventMap
                    event={upcomingEvents[selectedUpcoming]}
                    frame={false}
                    className="h-full w-full max-w-none rounded-lg"
                  />
                </div>
              </div>
            )}
          </BaseCard>
        </div>

        {/* ===== TOP-RIGHT PRIORITY: Live calendar + weather + quick actions ===== */}
        <div className="lg:col-span-1">
          <BaseCard title="Today" icon={<FaClock />}>
            <TodayCard
              events={upcomingEvents}
              selectedUpcoming={selectedUpcoming}
              onSelectEvent={setSelectedUpcoming}
              quickActions={quickActions}
            />
          </BaseCard>
        </div>
      </div>

      {/* ===== ROW 2: Recent Activity + Achievements (side by side) ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {/* ===== SECONDARY: Recent Activity feed (scanned after the top row) ===== */}
          <BaseCard title="Recent Activity" icon={<MdLocalActivity />} className="h-full" menu={menu}>
            {!activity.length ? (
              <div className="flex flex-col items-center py-6 text-center">
                <span className="text-3xl text-on-muted mb-2"><BsEmojiSmile /></span>
                <p className="text-on-dim text-sm">No activity yet — check in at your next event to get started.</p>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {activity.map((record, idx) => (
                  <li key={idx} className="flex items-center gap-4 py-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
                      record.status === "absent"
                        ? "bg-red-500/10 text-red-400"
                        : "bg-green-500/10 text-green-400"
                    }`}>
                      {record.status === "absent" ? <FaClock /> : <BsClipboardCheck />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-on font-medium truncate">{record.event?.title || "Unknown Event"}</p>
                      <p className="text-xs text-on-muted">
                        {record.event?.date ? new Date(record.event.date).toLocaleDateString() : "-"}
                      </p>
                    </div>
                    <StatusPill
                      status={record.status}
                      hint={`${record.communityServiceHours || 0} hrs`}
                    />
                  </li>
                ))}
              </ul>
            )}
          </BaseCard>
        </div>

        {/* ===== ACHIEVEMENTS (gamification) ===== */}
        <div className="lg:col-span-1">
          <BaseCard title="Achievements" icon={<FaTrophy />} className="h-full" menu={menu}>
            <div className="space-y-5">
              {badges.map((b, i) => (
                <div key={i} className="space-y-1.5">
                  <BadgeItem earned={b.earned} icon={b.icon} label={b.label} />
                  {b.binary ? (
                    <p className={`pl-[52px] text-xs ${b.earned ? "text-green-500" : "text-on-muted"}`}>
                      {b.earned ? "No absences — flawless!" : "Attend every event with no absences."}
                    </p>
                  ) : (
                    <div className={b.earned ? "pl-[52px]" : "pl-[52px]"}>
                      <ProgressBar
                        current={Math.min(b.current, b.target)}
                        target={b.target}
                        label={
                          b.earned
                            ? "Unlocked"
                            : b.current > 0
                              ? `${b.current} / ${b.target} ${b.unit} — ${b.target - b.current} ${b.unit} to go`
                              : `${b.target} ${b.target === 1 ? "event" : b.unit} needed`
                        }
                        barClassName={b.earned ? "bg-green-500" : "bg-indigo-500"}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => navigate("/student/dashboard/community-service")}
              className="mt-4 w-full text-center text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 transition-colors"
            >
              Track my service
            </button>
          </BaseCard>
        </div>
      </div>

      {/* ===== ROW 3: Key stats (very bottom) ===== */}
      <BaseCard title="Your Stats" icon={<FaClock />} menu={menu}>
        {/* Events Attended */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-sm text-on-dim">
            <span className="text-green-400"><FaCalendarAlt /></span> Events Attended
          </div>
          <span className="text-2xl font-bold text-on">{stats.totalAttended}</span>
        </div>

        {/* Community Service tracking — CS hours ↔ added ↔ removed vs fixed goal */}
        <div className="mb-4 rounded-xl border border-line p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-on-dim">
              <span className="text-yellow-400"><FaClock /></span> Community Service tracking
            </div>
            <select
              value={penaltyRange}
              onChange={(e) => setPenaltyRange(e.target.value)}
              className="shrink-0 bg-card border border-line rounded-lg px-2 py-1 text-xs text-on focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
            >
              <option value="day">This day</option>
              <option value="week">This week</option>
              <option value="year">This year</option>
            </select>
          </div>

          {/* CS hours — the student's accumulated (added/removed) hours */}
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-on-muted">Community service hours</span>
            <span className="text-2xl font-bold text-indigo-500 dark:text-indigo-400">
              {stats.totalHours} <span className="text-sm text-on-muted">hrs</span>
            </span>
          </div>
          <ProgressBar
            current={Math.min(stats.totalHours, stats.requiredHours)}
            target={stats.requiredHours}
            label={`${stats.totalHours} of the ${stats.requiredHours} hr goal currently assigned`}
          />

          {/* Goal — the fixed requirement set by the organizer/admin */}
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-on-muted">Set goal (fixed)</span>
            <span className="text-lg font-bold text-yellow-400">
              {stats.requiredHours} <span className="text-sm text-on-muted">hrs</span>
            </span>
          </div>

          {/* Added vs removed — the two flows that move the CS hours */}
          <div className="mt-3 space-y-3 border-t border-line pt-3">
            <p className="text-xs font-medium text-on-muted">
              Penalty meters ({penaltyRange === "day" ? "today" : penaltyRange === "week" ? "this week" : "this year"})
            </p>
            <div className="space-y-2">
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-on-muted">
                    <span className="text-red-400"><FaPlus /></span> Absent penalty
                  </span>
                  <span className="font-semibold text-red-400">{sumLog("penalty", "absent")} hrs</span>
                </div>
                <ProgressBar
                  current={Math.min(sumLog("penalty", "absent"), 8)}
                  target={8}
                  label="0–8 hrs per absent mark"
                  barClassName="bg-red-500"
                />
              </div>
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-on-muted">
                    <span className="text-amber-400"><FaPlus /></span> Late penalty
                  </span>
                  <span className="font-semibold text-amber-500">{sumLog("penalty", "late")} hrs</span>
                </div>
                <ProgressBar
                  current={Math.min(sumLog("penalty", "late"), 4)}
                  target={4}
                  label="0–4 hrs per late mark"
                  barClassName="bg-amber-500"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs text-on-muted">
                <span className="text-green-400"><FaMinus /></span> Removed (excuse / admin)
              </span>
              <span className="text-sm font-semibold text-green-400">−{sumLog("removed")} hrs</span>
            </div>
            <p className="flex items-center justify-between border-t border-line pt-2">
              <span className="flex items-center gap-1.5 text-xs text-on-muted">
                <span className="text-red-400"><FaPlus /></span> Added total (late / absent)
              </span>
              <span className="text-sm font-semibold text-red-400">+{sumLog("penalty")} hrs</span>
            </p>
          </div>
          <p className="text-xs text-on-muted mt-2">
            Your community service goal is set by the organizer and stays fixed. Late marks add 4 hrs and absent marks add 8 hrs to your community service hours; approved excuses and removals take hours off. The event organizer and admin may modify your community service hours according to your behavior.
          </p>
        </div>

        {/* Upcoming */}
        <div className="flex items-center justify-between pt-4 border-t border-line">
          <div className="flex items-center gap-2 text-sm text-on-dim">
            <span className="text-blue-400"><FaCalendarAlt /></span> Upcoming Events
          </div>
          <span className="text-2xl font-bold text-on">{upcoming}</span>
        </div>
      </BaseCard>
    </div>
  );
};

export default DashboardHome;

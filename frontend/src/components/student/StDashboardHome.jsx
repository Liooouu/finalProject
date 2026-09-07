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
} from "react-icons/fa";
import { BsClipboardCheck, BsEmojiSmile } from "react-icons/bs";
import { MdLocalActivity } from "react-icons/md";
import { usePageMeta } from "../../context/PageMetaContext";
import {
  BaseCard,
  StatusPill,
  ProgressBar,
  Sparkline,
  BadgeItem,
} from "../ui";
import Loading from "../shared/Loading";
import EmptyState from "../shared/EmptyState";
import EventMap from "../shared/EventMap";
import TodayCard from "./TodayCard";

// TODO(required-hours): hardcoded target until a `requiredServiceHours` field
// is added to the Student/User schema. Add `requiredServiceHours: Number,
// default: 40` to backend/models/User.js and fetch it from the account/API.
const REQUIRED_HOURS = 10;
const EVENTS_BADGE = 5;
const HOURS_BADGE = 20;

const DashboardHome = () => {
  const navigate = useNavigate();
  usePageMeta("Student Overview", "Your attendance and service activity at a glance.");
  const [stats, setStats] = useState({ totalHours: 0, totalAttended: 0, breakdown: [] });
  const [upcoming, setUpcoming] = useState(0);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [selectedUpcoming, setSelectedUpcoming] = useState(0);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      setError("");
      try {
        const [csRes, eventsRes] = await Promise.all([
          api.get("/student/community-service"),
          api.get("/events"),
        ]);

        const breakdown = csRes.data.breakdown || [];
        setStats({
          totalHours: csRes.data.totalHours || 0,
          totalAttended: csRes.data.totalAttended || 0,
          breakdown,
        });

        // Recent Activity — the student's own attendance/community-service records.
        const sortedActivity = [...breakdown].sort(
          (a, b) => new Date(b.attendedAt || 0) - new Date(a.attendedAt || 0)
        );
        setActivity(sortedActivity.slice(0, 6));

        // Upcoming events = events dated today or later.
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const upcomingList = (eventsRes.data || [])
          .filter((e) => {
            const d = new Date(e.date);
            d.setHours(0, 0, 0, 0);
            return d >= today;
          })
          .sort((a, b) => new Date(a.date) - new Date(b.date));
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

  // TODO(weekly-hours): replace with a real MongoDB aggregation. The backend
  // does not yet return per-week hours; using placeholder spread for the trend.
  const serviceTrend = useMemo(
    () => [2, 3, 1.5, 4, 3.5, Math.min(5, Math.max(1, stats.totalHours))],
    [stats.totalHours]
  );

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
      {
        icon: <FaClock />,
        label: "10+ service hours",
        current: stats.totalHours,
        target: 10,
        unit: "hrs",
        earned: stats.totalHours >= 10,
      },
      {
        icon: <FaTrophy />,
        label: `${HOURS_BADGE}+ service hours`,
        current: stats.totalHours,
        target: HOURS_BADGE,
        unit: "hrs",
        earned: stats.totalHours >= HOURS_BADGE,
      },
      {
        icon: <FaClock />,
        label: "Reach required service total",
        current: stats.totalHours,
        target: REQUIRED_HOURS,
        unit: "hrs",
        earned: stats.totalHours >= REQUIRED_HOURS,
      },
    ],
    [stats.totalAttended, stats.totalHours, activity]
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ===== TOP-LEFT PRIORITY: Live calendar + weather + quick actions ===== */}
        <div className="lg:col-span-2 flex flex-col space-y-6">
          <BaseCard title="Today" icon={<FaClock />}>
            <TodayCard
              events={upcomingEvents}
              selectedUpcoming={selectedUpcoming}
              onSelectEvent={setSelectedUpcoming}
              quickActions={quickActions}
            />
          </BaseCard>

          {/* ===== UPCOMING EVENTS + LOCATION MAP ===== */}
          <BaseCard
            title="Upcoming Events"
            icon={<FaCalendarAlt />}
            className="flex-1"
            centerTitle
          >
            {upcomingEvents.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <span className="text-3xl text-on-muted mb-2"><BsEmojiSmile /></span>
                <p className="text-on-dim text-sm">No upcoming events right now — check back soon.</p>
              </div>
            ) : (
              <div className="flex h-full flex-col">
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

                <div className="mt-5 -mx-5 -mb-5 flex w-auto flex-1 flex-col justify-center overflow-hidden rounded-b-xl">
                  <EventMap
                    event={upcomingEvents[selectedUpcoming]}
                    frame={false}
                    className="h-56 w-full grow sm:min-h-0 max-w-none"
                  />
                </div>
              </div>
            )}
          </BaseCard>
        </div>

        {/* ===== TOP-RIGHT PRIORITY: Key stats ===== */}
        <div className="lg:col-span-1 flex flex-col space-y-6">
          <BaseCard title="Your Stats" icon={<FaClock />} menu={menu}>
            {/* Events Attended */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-sm text-on-dim">
                <span className="text-green-400"><FaCalendarAlt /></span> Events Attended
              </div>
              <span className="text-2xl font-bold text-on">{stats.totalAttended}</span>
            </div>

            {/* Service Hours + Sparkline + Progress */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 text-sm text-on-dim">
                  <span className="text-yellow-400"><FaClock /></span> Service Hours
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-yellow-400">{stats.totalHours}</span>
                  <span className="text-sm text-on-muted">hrs</span>
                  <Sparkline data={serviceTrend} color="#facc15" />
                </div>
              </div>
              <ProgressBar current={stats.totalHours} target={stats.totalHours} />
              <p className="text-xs text-on-muted mt-2">
                {stats.totalHours > 0
                  ? `Total: ${stats.totalHours} community service hours`
                  : "No community service hours yet"}
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

          {/* ===== ACHIEVEMENTS (gamification) ===== */}
          <BaseCard title="Achievements" icon={<FaTrophy />} className="flex-1" menu={menu}>
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

      {/* ===== SECONDARY: Recent Activity feed (scanned after the top row) ===== */}
      <BaseCard title="Recent Activity" icon={<MdLocalActivity />} menu={menu}>
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
  );
};

export default DashboardHome;

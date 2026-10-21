import React, { useState, useEffect } from "react";
import api from "../../api/axios";
import { Link } from "react-router-dom";
import {
  FaCalendarDays,
  FaUsers,
  FaInbox,
  FaBolt,
  FaCircleQuestion,
} from "react-icons/fa6";
import { FaArrowRight, FaCalendarCheck } from "react-icons/fa";
import { usePageMeta } from "../../context/PageMetaContext";
import {
  BaseCard,
  Button,
  PageHeader,
  ProgressBar,
  StatTile,
} from "../ui";
import EmptyState from "../shared/EmptyState";
import Loading from "../shared/Loading";
import { formatDate } from "../../utils/helpers";

const OrganizerHome = () => {
  const [stats, setStats] = useState({
    totalEvents: 0,
    totalAttendees: 0,
    pendingExcuses: 0,
    attendeesPerEvent: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  usePageMeta("Organizer Overview", "Manage your events and track attendance.");

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await api.get("/organizer/stats");
        setStats({
          totalEvents: res.data.totalEvents ?? 0,
          totalAttendees: res.data.totalAttendees ?? 0,
          pendingExcuses: res.data.pendingExcuses ?? 0,
          attendeesPerEvent: res.data.attendeesPerEvent ?? [],
        });
      } catch (err) {
        setError(
          err.response?.data?.error ||
            err.message ||
            "Could not load organizer statistics."
        );
        console.error(err.response?.data || err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const resources = [
    {
      icon: <FaBolt />,
      title: "Run an event smoothly",
      text: "Enable QR scanning when an event is live to check students in on the spot.",
      to: "/organizer/dashboard/events",
      cta: "Go to events",
    },
    {
      icon: <FaCircleQuestion />,
      title: "Handle excuses",
      text: "Review student excuses and decide whether to mark them as excused.",
      to: "/organizer/dashboard/excuses",
      cta: "Review excuses",
    },
  ];

  const avgAttendance = stats.totalEvents
    ? Math.round((stats.totalAttendees / stats.totalEvents) * 10) / 10
    : 0;
  const maxAttendees = Math.max(
    1,
    ...stats.attendeesPerEvent.map((event) => event.attendeeCount || 0)
  );

  if (loading) return <Loading label="Loading organizer overview..." />;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Organizer workspace"
        title="Keep every event on track"
        subtitle="Your events, attendance and pending decisions in one place."
        actions={
          <Button as={Link} to="/organizer/dashboard/events" size="sm">
            <FaCalendarDays className="text-xs" />
            Manage events
          </Button>
        }
      />

      {error && (
        <div className="alert alert-danger" role="alert">
          <span aria-hidden="true">!</span>
          <p>{error}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Your events"
          value={stats.totalEvents}
          icon={<FaCalendarDays />}
          hint="Created and managed by you"
          tone="brand"
          to="/organizer/dashboard/events"
        />
        <StatTile
          label="Total attendees"
          value={stats.totalAttendees}
          icon={<FaUsers />}
          hint="Across every event"
          tone="info"
        />
        <StatTile
          label="Avg per event"
          value={avgAttendance}
          icon={<FaCalendarCheck />}
          hint="Mean check-ins"
          tone="ok"
        />
        <StatTile
          label="Pending excuses"
          value={stats.pendingExcuses}
          icon={<FaInbox />}
          hint={stats.pendingExcuses > 0 ? "Needs your review" : "All caught up"}
          tone={stats.pendingExcuses > 0 ? "warn" : "ok"}
          to="/organizer/dashboard/excuses"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <BaseCard
          title="Attendance by event"
          description="Relative to your busiest event."
          icon={<FaUsers />}
          className="xl:col-span-2"
          menu={
            <Link
              to="/organizer/dashboard/events"
              className="text-xs font-medium text-brand hover:opacity-80"
            >
              View all
            </Link>
          }
        >
          {!stats.attendeesPerEvent.length ? (
            <EmptyState
              compact
              title="No attendee data yet"
              description="Attendance appears once students check in to one of your events."
              action={
                <Button as={Link} to="/organizer/dashboard/events" size="sm" variant="secondary">
                  Create an event
                </Button>
              }
            />
          ) : (
            <ul className="space-y-4">
              {stats.attendeesPerEvent.map((event) => (
                <li key={event._id}>
                  <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-on">{event.title}</p>
                      <p className="truncate text-xs text-on-muted">
                        {formatDate(event.date, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <span className="num shrink-0 text-sm font-semibold text-on">
                      {event.attendeeCount}
                      <span className="ml-1 text-[11px] font-medium text-on-muted">checked in</span>
                    </span>
                  </div>
                  <ProgressBar
                    className="mt-2"
                    current={event.attendeeCount || 0}
                    target={maxAttendees}
                    showLabel={false}
                    tone="brand"
                  />
                </li>
              ))}
            </ul>
          )}
        </BaseCard>

        <div className="space-y-5">
          {resources.map((item) => (
            <BaseCard key={item.title} title={item.title} icon={item.icon}>
              <p className="text-sm leading-relaxed text-on-dim">{item.text}</p>
              <Button
                as={Link}
                to={item.to}
                variant="secondary"
                size="sm"
                className="mt-4"
              >
                {item.cta}
                <FaArrowRight className="text-[10px]" />
              </Button>
            </BaseCard>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OrganizerHome;

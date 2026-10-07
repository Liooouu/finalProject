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
import { FaArrowRight, FaClipboardCheck } from "react-icons/fa";
import { usePageMeta } from "../../context/PageMetaContext";
import { KpiCard, PageHeader, BaseCard } from "../ui";
import Button from "../ui/Button";

const OrganizerHome = () => {
  const [stats, setStats] = useState({
    totalEvents: 0,
    totalAttendees: 0,
    pendingExcuses: 0,
    attendeesPerEvent: [],
  });

  usePageMeta("Organizer Overview", "Manage your events and track attendance.");

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get("/organizer/stats");
        setStats({
          totalEvents: res.data.totalEvents ?? 0,
          totalAttendees: res.data.totalAttendees ?? 0,
          pendingExcuses: res.data.pendingExcuses ?? 0,
          attendeesPerEvent: res.data.attendeesPerEvent ?? [],
        });
      } catch (err) {
        console.error(err.response?.data || err.message);
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizer Overview"
        subtitle="Manage your events and track attendance."
        actions={
          <Button as={Link} to="/organizer/dashboard/events" variant="primary" size="sm">
            <FaCalendarDays className="text-xs" />
            Manage Events
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label="Total Events"
          value={stats.totalEvents}
          icon={<FaCalendarDays />}
          hint="Events you organize"
        />
        <KpiCard
          label="Total Attendees"
          value={stats.totalAttendees}
          icon={<FaUsers />}
          hint="Across all events"
        />
        <KpiCard
          label="Pending Excuses"
          value={stats.pendingExcuses}
          icon={<FaInbox />}
          hint={stats.pendingExcuses > 0 ? "Action needed" : "All caught up"}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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

      <BaseCard
        title="Attendees per Event"
        icon={<FaUsers />}
        menu={
          <Link
            to="/organizer/dashboard/events"
            className="text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            View all
          </Link>
        }
      >
        {stats.attendeesPerEvent.length === 0 ? (
          <p className="py-8 text-center text-sm text-on-dim">
            No events with attendees yet.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {stats.attendeesPerEvent.map((event) => (
              <li
                key={event._id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-on">
                    {event.title}
                  </p>
                  <p className="truncate text-xs text-on-dim">
                    {new Date(event.date).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                  <FaClipboardCheck className="text-xs" />
                  {event.attendeeCount}+ attendees
                </span>
              </li>
            ))}
          </ul>
        )}
      </BaseCard>
    </div>
  );
};

export default OrganizerHome;
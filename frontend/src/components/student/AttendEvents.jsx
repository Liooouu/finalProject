import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { formatTime12Hour, splitEventsByLifecycle, formatDate } from "../../utils/helpers";
import {
  FaArrowRight,
  FaCalendarAlt,
  FaClock,
  FaMapMarkerAlt,
} from "react-icons/fa";
import { BsClipboardCheck } from "react-icons/bs";
import { usePageMeta } from "../../context/PageMetaContext";
import {
  Button,
  PageHeader,
  SegmentedControl,
  StatusChip,
} from "../ui";
import Loading from "../shared/Loading";
import EmptyState from "../shared/EmptyState";
import EventMap from "../shared/EventMap";

const TABS = [
  { key: "active", label: "Upcoming" },
  { key: "past", label: "Past events" },
];

const AttendEvents = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("active");

  usePageMeta("Events", "Browse and attend events.");

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await api.get("/events");
        setEvents(res.data);
      } catch (err) {
        console.error(err.response?.data || err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  const { active, past } = useMemo(() => splitEventsByLifecycle(events), [events]);
  const visible = tab === "active" ? active : past;

  if (loading) {
    return <Loading label="Loading events..." />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Student events"
        title="Find your next event"
        subtitle="Open events you can still join, plus everything you have attended before."
        actions={
          <SegmentedControl
            ariaLabel="Event timeframe"
            value={tab}
            onChange={setTab}
            options={TABS.map((item) => ({
              value: item.key,
              label: item.label,
              count: item.key === "active" ? active.length : past.length,
            }))}
          />
        }
      />

      {visible.length === 0 ? (
        <EmptyState
          icon={<FaCalendarAlt />}
          title={tab === "active" ? "No upcoming events" : "No past events"}
          description={
            tab === "active"
              ? "Check back soon — new events will show up here."
              : "Events you have already attended or missed will be listed here."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((event) => (
            <article
              key={event._id}
              className="panel-surface panel-hover group flex flex-col overflow-hidden rounded-[var(--panel-radius)]"
            >
              <div className="border-b border-line bg-card-alt/40 p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-line bg-card text-center">
                    <span className="num text-base font-bold leading-none text-on">
                      {event.date ? new Date(event.date).getDate() : "–"}
                    </span>
                    <span className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-on-muted">
                      {event.date
                        ? new Date(event.date).toLocaleString("en-PH", { month: "short" })
                        : "TBA"}
                    </span>
                  </span>
                  <StatusChip status={event.status} />
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/student/dashboard/events/${event._id}`)}
                  className="mt-3 block text-left"
                >
                  <h3 className="font-display text-lg font-semibold leading-snug tracking-tight text-on transition-colors group-hover:text-brand">
                    {event.title}
                  </h3>
                </button>
                <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-on-dim">
                  {event.description || "No description provided."}
                </p>
              </div>

              <div className="flex flex-1 flex-col p-5">
                <div className="space-y-2 text-sm text-on-dim">
                  <div className="flex items-center gap-2">
                    <FaCalendarAlt className="text-[11px] text-on-muted" />
                    <span>{formatDate(event.date)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FaClock className="text-[11px] text-on-muted" />
                    <span>{formatTime12Hour(event.time)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FaMapMarkerAlt className="text-[11px] text-on-muted" />
                    <span className="truncate">{event.location || "TBA"}</span>
                  </div>
                </div>

                {event.attendanceStartTime && event.attendanceEndTime && (
                  <div className="alert alert-warn alert-sm mt-3">
                    <BsClipboardCheck className="mt-0.5 shrink-0" />
                    <p>
                      Attendance: {formatTime12Hour(event.attendanceStartTime)} –{" "}
                      {formatTime12Hour(event.attendanceEndTime)}
                    </p>
                  </div>
                )}

                <div className="mt-3 overflow-hidden rounded-xl border border-line">
                  <EventMap event={event} className="h-32 w-full" placeholder={false} frame={false} />
                </div>

                <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-4">
                  <p className="min-w-0 truncate text-xs text-on-muted">
                    {event.organizer ? (
                      <>
                        By <span className="text-on-dim">{event.organizer.name}</span>
                      </>
                    ) : (
                      "Organizer TBA"
                    )}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/student/dashboard/events/${event._id}`)}
                  >
                    Details <FaArrowRight className="text-[10px]" />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default AttendEvents;

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { formatTime12Hour } from "../../utils/helpers";
import { FaCalendarAlt, FaMapMarkerAlt, FaClock, FaArrowRight } from "react-icons/fa";
import { BsClipboardCheck } from "react-icons/bs";
import { usePageMeta } from "../../context/PageMetaContext";
import StatusChip from "../ui/StatusChip";
import Loading from "../shared/Loading";
import EmptyState from "../shared/EmptyState";
import EventMap from "../shared/EventMap";

const AttendEvents = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  usePageMeta("Upcoming Events", "Browse and attend events.");

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

  if (loading) {
    return <Loading label="Loading events..." />;
  }

  if (events.length === 0) {
    return (
      <EmptyState
        icon={<FaCalendarAlt />}
        title="No upcoming events"
        description="Check back soon — new events will show up here."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      {events.map((event) => (
        <div
          key={event._id}
          onClick={() => navigate(`/student/dashboard/events/${event._id}`)}
          className="group flex cursor-pointer flex-col rounded-xl border border-line bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-900/10"
        >
          <div className="mb-4 flex items-start justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 ring-1 ring-inset ring-indigo-500/20 transition-colors group-hover:bg-indigo-500/15 dark:text-indigo-400">
              <FaCalendarAlt className="text-lg" />
            </div>
            <StatusChip status={event.status} />
          </div>

          <h3 className="mb-2 text-lg font-bold text-on transition-colors group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
            {event.title}
          </h3>
          <p className="mb-4 line-clamp-2 text-sm text-on-dim">
            {event.description || "No description provided"}
          </p>

          <div className="mb-4 space-y-2 text-sm text-on-dim">
            <div className="flex items-center gap-2">
              <FaCalendarAlt className="text-xs text-on-muted" />
              <span>{new Date(event.date).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <FaClock className="text-xs text-on-muted" />
              <span>{formatTime12Hour(event.time)}</span>
            </div>
            <div className="flex items-center gap-2">
              <FaMapMarkerAlt className="text-xs text-on-muted" />
              <span>{event.location || "TBA"}</span>
            </div>
          </div>

          {event.attendanceStartTime && event.attendanceEndTime && (
            <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2.5">
              <p className="flex items-center gap-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                <BsClipboardCheck />
                Attendance: {formatTime12Hour(event.attendanceStartTime)} -{" "}
                {formatTime12Hour(event.attendanceEndTime)}
              </p>
            </div>
          )}

          <EventMap
            event={event}
            className="mb-4 h-36 w-full"
            placeholder={false}
          />

          {event.organizer && (
            <div className="pt-4 border-t border-line mt-auto">
              <p className="text-xs text-on-muted">
                Organized by <span className="text-on-dim">{event.organizer.name}</span>
              </p>
            </div>
          )}

          <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400">
            View Details
            <FaArrowRight className="text-[10px] transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default AttendEvents;
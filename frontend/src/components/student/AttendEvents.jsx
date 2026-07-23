import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { formatTime12Hour } from "../../utils/helpers";
import { FaCalendarAlt, FaMapMarkerAlt, FaClock } from "react-icons/fa";
import { BsClipboardCheck } from "react-icons/bs";

const AttendEvents = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

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
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-on-dim">
          <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Loading events...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-on">Upcoming Events</h1>
        <p className="text-on-dim mt-1">Browse and attend events</p>
      </div>

      {events.length === 0 ? (
        <div className="bg-linear-to-br dark:from-white/10 dark:to-white/5 from-white to-slate-50 backdrop-blur-sm border border-line rounded-2xl p-12 text-center">
          <span className="text-5xl mb-4 block"><FaCalendarAlt /></span>
          <p className="text-on-dim">No upcoming events available.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <div
              key={event._id}
              onClick={() => navigate(`/student/dashboard/events/${event._id}`)}
              className="group bg-linear-to-br dark:from-white/10 dark:to-white/5 from-white to-slate-50 backdrop-blur-sm border border-line rounded-2xl p-6 cursor-pointer hover:border-red-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-red-500/10 hover:-translate-y-1"
            >
              {/* Event Icon & Title */}
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-red-500/20 rounded-xl group-hover:bg-red-500/30 transition-colors">
                  <span className="text-2xl"><FaCalendarAlt /></span>
                </div>
                <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-xs font-medium rounded-full">
                  {event.status?.charAt(0).toUpperCase() + event.status?.slice(1)}
                </span>
              </div>

              <h3 className="text-lg font-bold text-on mb-2 group-hover:text-red-400 transition-colors">
                {event.title}
              </h3>
              
              <p className="text-on-dim text-sm mb-4 line-clamp-2">
                {event.description || "No description provided"}
              </p>

              {/* Event Details */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-on-dim">
                  <span><FaCalendarAlt /></span>
                  <span>{new Date(event.date).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-on-dim">
                  <span><FaClock /></span>
                  <span>{formatTime12Hour(event.time)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-on-dim">
                  <span><FaMapMarkerAlt /></span>
                  <span>{event.location || "TBA"}</span>
                </div>
              </div>

              {/* Attendance Window */}
              {event.attendanceStartTime && event.attendanceEndTime && (
                <div className="p-3 bg-yellow-500/10 rounded-xl border border-yellow-500/20 mb-4">
                  <p className="text-yellow-400 text-xs font-medium">
                    <BsClipboardCheck /> Attendance: {formatTime12Hour(event.attendanceStartTime)} - {formatTime12Hour(event.attendanceEndTime)}
                  </p>
                </div>
              )}

              {/* Organizer */}
              {event.organizer && (
                <div className="pt-4 border-t border-line">
                  <p className="text-xs text-on-muted">
                    Organized by <span className="text-on-dim">{event.organizer.name}</span>
                  </p>
                </div>
              )}

              {/* Action */}
              <div className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-red-400 text-sm font-medium flex items-center gap-1">
                  View Details <span>→</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AttendEvents;

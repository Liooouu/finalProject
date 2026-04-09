import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";

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
        <p className="text-gray-400">Loading events...</p>
      </div>
    );
  }

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl font-bold mb-6">Upcoming Events</h1>
      
      {events.length === 0 ? (
        <p className="text-gray-400">No upcoming events available.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((event) => (
            <div
              key={event._id}
              onClick={() => navigate(`/student/dashboard/events/${event._id}`)}
              className="bg-white/10 border border-white/10 rounded-xl p-5 cursor-pointer hover:bg-white/15 transition"
            >
              <h3 className="text-lg font-semibold mb-2">{event.title}</h3>
              <p className="text-gray-400 text-sm mb-3 line-clamp-2">
                {event.description || "No description"}
              </p>
              <div className="text-sm text-gray-300 space-y-1">
                <p>📅 {new Date(event.date).toLocaleDateString()}</p>
                <p>⏰ {event.time}</p>
                <p>📍 {event.location || "TBA"}</p>
              </div>
              {event.organizer && (
                <p className="text-gray-500 text-xs mt-3">
                  By: {event.organizer.name}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AttendEvents;
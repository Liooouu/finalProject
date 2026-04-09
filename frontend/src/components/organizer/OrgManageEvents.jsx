import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { formatTime12Hour } from "../../utils/helpers";

const OrgManageEvents = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [viewMode, setViewMode] = useState("my");
  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    date: "",
    time: "",
    attendanceStartTime: "",
    attendanceEndTime: "",
  });

  const fetchEvents = async () => {
    try {
      const endpoint = viewMode === "my" ? "/events/my-events" : "/events/all";
      const res = await api.get(endpoint);
      setEvents(res.data);
    } catch (err) {
      console.error(err.response?.data || err.message);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [viewMode]);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/events", form);
      setMessage("Event created successfully!");
      setForm({
        title: "",
        description: "",
        location: "",
        date: "",
        time: "",
        attendanceStartTime: "",
        attendanceEndTime: "",
      });
      setShowForm(false);
      fetchEvents();
    } catch (err) {
      setMessage(err.response?.data?.error || "Failed to create event.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this event?")) return;
    try {
      await api.delete(`/events/${id}`);
      setMessage("Event deleted.");
      fetchEvents();
    } catch (err) {
      setMessage(err.response?.data?.error || "Failed to delete event.");
    }
  };

  const statusConfig = {
    upcoming: { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/30" },
    live: { bg: "bg-green-500/20", text: "text-green-400", border: "border-green-500/30" },
    closed: { bg: "bg-gray-500/20", text: "text-gray-400", border: "border-gray-500/30" },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Manage Events</h1>
          <p className="text-gray-400 mt-1">Create and manage your events</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-linear-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold px-6 py-3 rounded-xl shadow-lg shadow-red-600/30 transition-all duration-200 flex items-center gap-2"
        >
          <span>{showForm ? "✕" : "+"}</span>
          <span>{showForm ? "Cancel" : "Create Event"}</span>
        </button>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setViewMode("my")}
          className={`px-5 py-2 rounded-lg font-medium transition-all duration-200 ${
            viewMode === "my"
              ? "bg-red-600 text-white shadow-lg shadow-red-600/30"
              : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10"
          }`}
        >
          My Events
        </button>
        <button
          onClick={() => setViewMode("all")}
          className={`px-5 py-2 rounded-lg font-medium transition-all duration-200 ${
            viewMode === "all"
              ? "bg-red-600 text-white shadow-lg shadow-red-600/30"
              : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10"
          }`}
        >
          All Events
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className="p-4 bg-green-500/20 border border-green-500/30 rounded-xl text-green-400">
          {message}
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-linear-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 space-y-5"
        >
          <h2 className="text-lg font-semibold text-white">Create New Event</h2>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <input
                type="text"
                name="title"
                placeholder="Event Title"
                value={form.title}
                onChange={handleChange}
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
              />
            </div>
            <div className="md:col-span-2">
              <textarea
                name="description"
                placeholder="Description"
                value={form.description}
                onChange={handleChange}
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
              />
            </div>
            <div className="md:col-span-2">
              <input
                type="text"
                name="location"
                placeholder="Location"
                value={form.location}
                onChange={handleChange}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
              />
            </div>
            <div>
              <input
                type="date"
                name="date"
                value={form.date}
                onChange={handleChange}
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
              />
            </div>
            <div>
              <input
                type="time"
                name="time"
                value={form.time}
                onChange={handleChange}
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
              />
            </div>
          </div>

          <div className="border-t border-white/10 pt-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">Attendance Window</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Start Time</label>
                <input
                  type="time"
                  name="attendanceStartTime"
                  value={form.attendanceStartTime}
                  onChange={handleChange}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">End Time</label>
                <input
                  type="time"
                  name="attendanceEndTime"
                  value={form.attendanceEndTime}
                  onChange={handleChange}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">Students can only mark attendance within this time window.</p>
          </div>

          <button
            type="submit"
            className="w-full bg-linear-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold py-3 rounded-xl shadow-lg shadow-red-600/30 transition-all duration-200"
          >
            Create Event
          </button>
        </form>
      )}

      {/* Events List */}
      {events.length === 0 ? (
        <div className="bg-linear-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-12 text-center">
          <span className="text-5xl mb-4 block">📅</span>
          <p className="text-gray-400">
            {viewMode === "my" ? "No events yet. Create your first one!" : "No events found."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {events.map((event) => {
            const status = statusConfig[event.status] || statusConfig.upcoming;
            return (
              <div
                key={event._id}
                onClick={() => navigate(`/organizer/dashboard/events/${event._id}`)}
                className="group bg-linear-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 cursor-pointer hover:border-red-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-red-500/10"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-500/20 rounded-lg">
                      <span className="text-xl">📅</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white group-hover:text-red-400 transition-colors">
                        {event.title}
                      </h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${status.bg} ${status.text}`}>
                        {event.status?.charAt(0).toUpperCase() + event.status?.slice(1)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(event._id);
                    }}
                    className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                  >
                    🗑️
                  </button>
                </div>

                <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                  {event.description || "No description"}
                </p>

                <div className="flex flex-wrap gap-4 text-sm text-gray-300 mb-4">
                  <span className="flex items-center gap-1">📍 {event.location || "TBA"}</span>
                  <span className="flex items-center gap-1">📅 {new Date(event.date).toLocaleDateString()}</span>
                  <span className="flex items-center gap-1">⏰ {formatTime12Hour(event.time)}</span>
                </div>

                <div className="p-3 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                  <p className="text-yellow-400 text-xs">
                    📋 Attendance: {formatTime12Hour(event.attendanceStartTime)} - {formatTime12Hour(event.attendanceEndTime)}
                  </p>
                </div>

                {viewMode === "all" && event.organizer && (
                  <p className="text-xs text-gray-500 mt-4 pt-4 border-t border-white/10">
                    Created by: <span className="text-gray-400">{event.organizer.name}</span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OrgManageEvents;

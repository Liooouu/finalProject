import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";

const OrgManageEvents = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [viewMode, setViewMode] = useState("my"); // "my" or "all"
  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    date: "",
    time: "",
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
      setForm({ title: "", description: "", location: "", date: "", time: "" });
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

  const statusColors = {
    upcoming: "bg-blue-600",
    live: "bg-green-600",
    closed: "bg-gray-600",
  };

  return (
    <div className="p-6 text-white">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Manage Events</h1>
          <p className="text-gray-400">Create and manage your events here.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg transition"
        >
          {showForm ? "Cancel" : "+ Create Event"}
        </button>
      </div>

      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setViewMode("my")}
          className={`px-4 py-2 rounded-lg transition ${
            viewMode === "my"
              ? "bg-red-600 text-white"
              : "bg-white/10 text-gray-400 hover:bg-white/20"
          }`}
        >
          My Events
        </button>
        <button
          onClick={() => setViewMode("all")}
          className={`px-4 py-2 rounded-lg transition ${
            viewMode === "all"
              ? "bg-red-600 text-white"
              : "bg-white/10 text-gray-400 hover:bg-white/20"
          }`}
        >
          All Events
        </button>
      </div>

      {message && (
        <p className="mb-4 text-green-400">{message}</p>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white/10 p-6 rounded-xl mb-8 flex flex-col gap-4"
        >
          <h2 className="text-lg font-semibold">New Event</h2>

          <input
            type="text"
            name="title"
            placeholder="Event Title"
            value={form.title}
            onChange={handleChange}
            required
            className="bg-white/10 border border-white/20 px-4 py-2 rounded-lg placeholder-gray-400 text-white"
          />
          <textarea
            name="description"
            placeholder="Description"
            value={form.description}
            onChange={handleChange}
            rows={3}
            className="bg-white/10 border border-white/20 px-4 py-2 rounded-lg placeholder-gray-400 text-white"
          />
          <input
            type="text"
            name="location"
            placeholder="Location"
            value={form.location}
            onChange={handleChange}
            className="bg-white/10 border border-white/20 px-4 py-2 rounded-lg placeholder-gray-400 text-white"
          />
          <div className="flex gap-4">
            <input
              type="date"
              name="date"
              value={form.date}
              onChange={handleChange}
              required
              className="bg-white/10 border border-white/20 px-4 py-2 rounded-lg text-white flex-1"
            />
            <input
              type="time"
              name="time"
              value={form.time}
              onChange={handleChange}
              required
              className="bg-white/10 border border-white/20 px-4 py-2 rounded-lg text-white flex-1"
            />
          </div>

          <button
            type="submit"
            className="bg-red-600 hover:bg-red-500 text-white py-2 rounded-lg transition"
          >
            Create Event
          </button>
        </form>
      )}

      {events.length === 0 ? (
        <p className="text-gray-400">
          {viewMode === "my" ? "No events yet. Create your first one!" : "No events found."}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {events.map((event) => (
            <div
              key={event._id}
              className="bg-white/10 border border-white/10 rounded-xl p-5 cursor-pointer hover:bg-white/15 transition"
              onClick={() => navigate(`/organizer/dashboard/events/${event._id}`)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{event.title}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs ${statusColors[event.status] || "bg-gray-600"}`}>
                      {event.status}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm">{event.description}</p>
                  <p className="text-gray-300 text-sm mt-1">
                    📍 {event.location || "TBA"} &nbsp;|&nbsp; 📅{" "}
                    {new Date(event.date).toLocaleDateString()} &nbsp;|&nbsp; ⏰{" "}
                    {event.time}
                  </p>
                  {viewMode === "all" && event.organizer && (
                    <p className="text-gray-500 text-xs mt-2">
                      Created by: {event.organizer.name || event.organizer}
                    </p>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(event._id);
                  }}
                  className="bg-red-700 hover:bg-red-600 text-white px-3 py-1 rounded-lg text-sm transition"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrgManageEvents;
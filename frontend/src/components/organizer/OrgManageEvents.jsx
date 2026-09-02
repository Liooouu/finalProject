import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { formatTime12Hour } from "../../utils/helpers";
import { FaPlus, FaCalendarAlt, FaMapMarkerAlt, FaClock, FaTrash } from "react-icons/fa";
import { MdClose } from "react-icons/md";
import { BsClipboardCheck } from "react-icons/bs";
import { usePageMeta } from "../../context/PageMetaContext";
import Button from "../ui/Button";
import StatusChip from "../ui/StatusChip";
import EmptyState from "../shared/EmptyState";
import MapPicker from "../shared/MapPicker";
import ConfirmDialog from "../ui/ConfirmDialog";

const OrgManageEvents = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [viewMode, setViewMode] = useState("my");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    mapQuery: "",
    date: "",
    time: "",
    attendanceStartTime: "",
    attendanceEndTime: "",
  });

  usePageMeta("Manage Events", "Create and manage your events.");

  const fetchEvents = useCallback(() => {
    const endpoint = viewMode === "my" ? "/events/my-events" : "/events/all";
    return api
      .get(endpoint)
      .then((res) => setEvents(res.data))
      .catch((err) => console.error(err.response?.data || err.message));
  }, [viewMode]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleMapPick = (v) =>
    setForm({ ...form, location: v, mapQuery: v });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/events", form);
      setMessage("Event created successfully!");
      setForm({
        title: "",
        description: "",
        location: "",
        mapQuery: "",
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
    try {
      await api.delete(`/events/${id}`);
      setMessage("Event deleted.");
      fetchEvents();
    } catch (err) {
      setMessage(err.response?.data?.error || "Failed to delete event.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-on-dim">
          {events.length} {events.length === 1 ? "event" : "events"}
        </p>
        <Button
          onClick={() => setShowForm(!showForm)}
          variant={showForm ? "secondary" : "primary"}
          size="sm"
        >
          {showForm ? <MdClose /> : <FaPlus className="text-xs" />}
          {showForm ? "Cancel" : "Create Event"}
        </Button>
      </div>

      {/* View Toggle */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setViewMode("my")}
          className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
            viewMode === "my"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-card text-on-dim hover:bg-card-alt hover:text-on border border-line"
          }`}
        >
          My Events
        </button>
        <button
          onClick={() => setViewMode("all")}
          className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
            viewMode === "all"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-card text-on-dim hover:bg-card-alt hover:text-on border border-line"
          }`}
        >
          All Events
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-sm text-emerald-600 dark:text-emerald-400">
          {message}
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-xl border border-line bg-card p-6"
        >
          <h2 className="text-lg font-semibold text-on">Create New Event</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <input
                type="text"
                name="title"
                placeholder="Event Title"
                value={form.title}
                onChange={handleChange}
                required
                className="w-full bg-card border border-line rounded-lg px-3.5 py-2.5 text-on placeholder-on-muted focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
              />
            </div>
            <div className="md:col-span-2">
              <textarea
                name="description"
                placeholder="Description"
                value={form.description}
                onChange={handleChange}
                rows={3}
                className="w-full bg-card border border-line rounded-lg px-3.5 py-2.5 text-on placeholder-on-muted focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
              />
            </div>
            <div className="md:col-span-2">
              <input
                type="text"
                name="location"
                placeholder="Location"
                value={form.location}
                onChange={handleChange}
                className="w-full bg-card border border-line rounded-lg px-3.5 py-2.5 text-on placeholder-on-muted focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
              />
            </div>
            <div className="md:col-span-2">
              <MapPicker
                value={form.mapQuery}
                onChange={handleMapPick}
                className="h-64"
              />
            </div>
            <div>
              <input
                type="date"
                name="date"
                value={form.date}
                onChange={handleChange}
                required
                className="w-full bg-card border border-line rounded-lg px-3.5 py-2.5 text-on focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
              />
            </div>
            <div>
              <input
                type="time"
                name="time"
                value={form.time}
                onChange={handleChange}
                required
                className="w-full bg-card border border-line rounded-lg px-3.5 py-2.5 text-on focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
              />
            </div>
          </div>

          <div className="border-t border-line pt-4">
            <h3 className="text-sm font-semibold text-on-dim mb-3">Attendance Window</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-on-muted block mb-1">Start Time</label>
                <input
                  type="time"
                  name="attendanceStartTime"
                  value={form.attendanceStartTime}
                  onChange={handleChange}
                  required
                  className="w-full bg-card border border-line rounded-lg px-3.5 py-2.5 text-on focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
                />
              </div>
              <div>
                <label className="text-xs text-on-muted block mb-1">End Time</label>
                <input
                  type="time"
                  name="attendanceEndTime"
                  value={form.attendanceEndTime}
                  onChange={handleChange}
                  required
                  className="w-full bg-card border border-line rounded-lg px-3.5 py-2.5 text-on focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
                />
              </div>
            </div>
            <p className="text-xs text-on-muted mt-2">Students can only mark attendance within this time window.</p>
          </div>

          <Button
            type="submit"
            className="w-full py-2.5"
          >
            Create Event
          </Button>
        </form>
      )}

      {/* Events List */}
      {events.length === 0 ? (
        <EmptyState
          icon={<FaCalendarAlt />}
          title={viewMode === "my" ? "No events yet" : "No events found"}
          description={
            viewMode === "my"
              ? "Create your first event to start tracking attendance."
              : "No events match this view."
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {events.map((event) => {
            return (
              <div
                key={event._id}
                onClick={() => navigate(`/organizer/dashboard/events/${event._id}`)}
                className="group flex cursor-pointer flex-col rounded-xl border border-line bg-card p-6 transition-all duration-300 hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-900/10"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 ring-1 ring-inset ring-indigo-500/20 dark:text-indigo-400">
                      <FaCalendarAlt className="text-lg" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-on transition-colors group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                        {event.title}
                      </h3>
                      <StatusChip status={event.status} className="mt-1" />
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(event._id);
                    }}
                    className="rounded-lg p-2 text-on-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
                    aria-label="Delete event"
                  >
                    <FaTrash className="text-sm" />
                  </button>
                </div>

                <p className="text-on-dim text-sm mb-4 line-clamp-2">
                  {event.description || "No description"}
                </p>

                <div className="flex flex-wrap gap-4 text-sm text-on-dim mb-4">
                  <span className="flex items-center gap-1"><FaMapMarkerAlt /> {event.location || "TBA"}</span>
                  <span className="flex items-center gap-1"><FaCalendarAlt /> {new Date(event.date).toLocaleDateString()}</span>
                  <span className="flex items-center gap-1"><FaClock /> {formatTime12Hour(event.time)}</span>
                </div>

                <div className="p-3 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                  <p className="text-yellow-400 text-xs">
                    <BsClipboardCheck /> Attendance: {formatTime12Hour(event.attendanceStartTime)} - {formatTime12Hour(event.attendanceEndTime)}
                  </p>
                </div>

                {viewMode === "all" && event.organizer && (
                  <p className="text-xs text-on-muted mt-4 pt-4 border-t border-line">
                    Created by: <span className="text-on-dim">{event.organizer.name}</span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this event?"
        message="This will permanently delete the event and all of its attendance records. This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          const target = deleteTarget;
          setDeleteTarget(null);
          handleDelete(target);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default OrgManageEvents;

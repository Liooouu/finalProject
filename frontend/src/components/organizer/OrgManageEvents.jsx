import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import {
  formatTime12Hour,
  isTerminalStatus,
  describeEventLifecycle,
} from "../../utils/helpers";
import { FaPlus, FaCalendarAlt, FaMapMarkerAlt, FaClock, FaTrash, FaUndo, FaChevronDown, FaChevronRight } from "react-icons/fa";
import { MdClose } from "react-icons/md";
import { BsClipboardCheck } from "react-icons/bs";
import { usePageMeta } from "../../context/PageMetaContext";
import Button from "../ui/Button";
import StatusChip from "../ui/StatusChip";
import EmptyState from "../shared/EmptyState";
import MapPicker from "../shared/MapPicker";
import ConfirmDialog from "../ui/ConfirmDialog";

const STATUS_FILTERS = [
  { key: "all", label: "All statuses" },
  { key: "active", label: "Active" },
  { key: "upcoming", label: "Upcoming" },
  { key: "live", label: "Live" },
  { key: "finished", label: "Finished" },
  { key: "closed", label: "Closed" },
];

const inputClasses =
  "rounded-lg border border-line bg-card px-3 py-2 text-sm text-on focus:outline-none focus:ring-2 focus:ring-indigo-500/40";

const OrgManageEvents = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [viewMode, setViewMode] = useState("my");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [expandedEvent, setExpandedEvent] = useState(null);
  const [eventGroups, setEventGroups] = useState({});
  const [loadingGroups, setLoadingGroups] = useState({});
  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    mapQuery: "",
    date: "",
    time: "",
    endDate: "",
    endTime: "",
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

  const toggleGroups = async (eventId) => {
    if (expandedEvent === eventId) {
      setExpandedEvent(null);
      return;
    }
    setExpandedEvent(eventId);
    if (!eventGroups[eventId]) {
      setLoadingGroups((prev) => ({ ...prev, [eventId]: true }));
      try {
        const res = await api.get(`/events/${eventId}/attendees/groups`);
        setEventGroups((prev) => ({ ...prev, [eventId]: res.data || [] }));
      } catch (err) {
        console.error(err.response?.data || err.message);
        setEventGroups((prev) => ({ ...prev, [eventId]: [] }));
      } finally {
        setLoadingGroups((prev) => ({ ...prev, [eventId]: false }));
      }
    }
  };

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
        endDate: "",
        endTime: "",
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

  // Put a finished/closed event back in play. Reopening hands the event back to
  // the clock, so it finishes again within a minute unless its end time moves.
  const handleReopen = async (id) => {
    try {
      await api.patch(`/events/${id}/status`, { status: "upcoming" });
      setMessage(
        "Event reopened. It will finish again at its end time — extend the schedule to keep it running."
      );
      fetchEvents();
    } catch (err) {
      setMessage(err.response?.data?.error || "Failed to reopen event.");
    }
  };

  // Finished events sink to the bottom so the live work stays on top.
  const visibleEvents = useMemo(() => {
    const matches = events.filter((event) => {
      if (statusFilter === "all") return true;
      if (statusFilter === "active") return !isTerminalStatus(event.status);
      return event.status === statusFilter;
    });
    return matches.sort((a, b) => {
      const aDone = isTerminalStatus(a.status) ? 1 : 0;
      const bDone = isTerminalStatus(b.status) ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return aDone ? new Date(b.date) - new Date(a.date) : new Date(a.date) - new Date(b.date);
    });
  }, [events, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-on-dim">
          {events.length} {events.length === 1 ? "event" : "events"} •{" "}
          {events.reduce((sum, e) => sum + (e.attendeeCount || 0), 0)} total {events.reduce((sum, e) => sum + (e.attendeeCount || 0), 0) === 1 ? "attendee" : "attendees"}
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
      <div className="flex flex-wrap items-center gap-2">
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
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
          className={`${inputClasses} ml-auto`}
        >
          {STATUS_FILTERS.map((filter) => (
            <option key={filter.key} value={filter.key}>
              {filter.label}
            </option>
          ))}
        </select>
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

          {/* Event Ends — when the event itself finishes */}
          <div className="border-t border-line pt-4">
            <h3 className="text-sm font-semibold text-on-dim mb-3">Event Ends</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-on-muted block mb-1">End Date</label>
                <input
                  type="date"
                  name="endDate"
                  value={form.endDate}
                  onChange={handleChange}
                  className="w-full bg-card border border-line rounded-lg px-3.5 py-2.5 text-on focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
                />
              </div>
              <div>
                <label className="text-xs text-on-muted block mb-1">End Time</label>
                <input
                  type="time"
                  name="endTime"
                  value={form.endTime}
                  onChange={handleChange}
                  className="w-full bg-card border border-line rounded-lg px-3.5 py-2.5 text-on focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
                />
              </div>
            </div>
            <p className="text-xs text-on-muted mt-2">
              This event ends on{" "}
              <span className="font-medium text-on-dim">
                {form.endDate || form.date || "—"} at {form.endTime || form.attendanceEndTime || "—"}
              </span>
              . Leave blank to default to the event date and attendance end time.
            </p>
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
      {visibleEvents.length === 0 ? (
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
          {visibleEvents.map((event) => {
            const lifecycleNote = describeEventLifecycle(event);
            const canReopen = isTerminalStatus(event.status);
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
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <StatusChip status={event.status} />
                        {canReopen && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReopen(event._id);
                            }}
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-500/10 dark:text-indigo-400"
                          >
                            <FaUndo className="text-[10px]" />
                            Reopen
                          </button>
                        )}
                      </div>
                      {lifecycleNote && (
                        <p className="mt-1 text-xs text-on-muted">{lifecycleNote}</p>
                      )}
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
                  <span className="flex items-center gap-1"><BsClipboardCheck /> {event.attendeeCount ?? 0}+ {event.attendeeCount === 1 ? "attendee" : "attendees"}</span>
                </div>
                <p className="text-xs text-on-muted mb-4">
                  Ends: {new Date(event.endDate || event.date).toLocaleDateString()} at {formatTime12Hour(event.endTime || event.attendanceEndTime)}
                </p>

                <div className="p-3 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                  <p className="text-yellow-400 text-xs">
                    <BsClipboardCheck /> Attendance: {formatTime12Hour(event.attendanceStartTime)} - {formatTime12Hour(event.attendanceEndTime)}
                  </p>
                </div>

                <div className="mt-4 pt-4 border-t border-line">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleGroups(event._id);
                    }}
                    className="flex items-center gap-2 text-sm text-on-dim hover:text-on transition-colors"
                  >
                    {expandedEvent === event._id ? <FaChevronDown /> : <FaChevronRight />}
                    Attendees with filtered groups
                  </button>
                  {expandedEvent === event._id && (
                    <div className="mt-3 space-y-2">
                      {loadingGroups[event._id] ? (
                        <p className="text-xs text-on-muted">Loading...</p>
                      ) : (eventGroups[event._id] || []).length > 0 ? (
                        (eventGroups[event._id] || []).map((g) => (
                          <div key={g.key || g.label} className="flex items-center justify-between rounded-lg bg-card-alt/40 border border-line px-3 py-2 text-sm">
                            <span className="text-on-dim">{g.label || "Unassigned"}</span>
                            <span className="text-on">{g.attended || 0} {g.attended === 1 ? "student" : "students"} have attended</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-on-muted">No groups found.</p>
                      )}
                    </div>
                  )}
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
        message="This deletes the event, but students keep the community service hours they have accumulated from it. This action cannot be undone."
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

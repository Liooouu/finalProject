import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import {
  formatTime12Hour,
  isTerminalStatus,
  describeEventLifecycle,
  formatDate,
} from "../../utils/helpers";
import { getUserFromToken } from "../../utils/auth";
import {
  FaCalendarAlt,
  FaChevronDown,
  FaChevronRight,
  FaClock,
  FaMapMarkerAlt,
  FaPlus,
  FaTrash,
  FaUndo,
} from "react-icons/fa";
import { MdClose } from "react-icons/md";
import { BsClipboardCheck } from "react-icons/bs";
import { usePageMeta } from "../../context/PageMetaContext";
import {
  Button,
  Card,
  PageHeader,
  SegmentedControl,
  StatusChip,
} from "../ui";
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

const EMPTY_FORM = {
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
};

const OrgManageEvents = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [viewMode, setViewMode] = useState("my");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [expandedEvent, setExpandedEvent] = useState(null);
  const [eventGroups, setEventGroups] = useState({});
  const [loadingGroups, setLoadingGroups] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  usePageMeta("Manage Events", "Create and manage your events.");

  const currentUserId = getUserFromToken()?.id;
  const isOwnEvent = (event) => {
    const ownerId = event.organizer?._id || event.organizer;
    return Boolean(currentUserId && ownerId && String(ownerId) === String(currentUserId));
  };
  const canTakeAttendance = (event) =>
    isOwnEvent(event) || event.organizer?.role === "admin";

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
    // A slow request leaves the button clickable; a second tap would POST again
    // and create a duplicate event. Latch until the first one resolves.
    if (submitting) return;
    setSubmitting(true);
    try {
      await api.post("/events", form);
      setMessage("Event created successfully!");
      setMessageType("success");
      setForm(EMPTY_FORM);
      setShowForm(false);
      fetchEvents();
    } catch (err) {
      setMessage(err.response?.data?.error || "Failed to create event.");
      setMessageType("error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/events/${id}`);
      setMessage("Event deleted.");
      setMessageType("success");
      fetchEvents();
    } catch (err) {
      setMessage(err.response?.data?.error || "Failed to delete event.");
      setMessageType("error");
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
      setMessageType("success");
      fetchEvents();
    } catch (err) {
      setMessage(err.response?.data?.error || "Failed to reopen event.");
      setMessageType("error");
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

  const attendeeTotal = events.reduce((sum, e) => sum + (e.attendeeCount || 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Organizer events"
        title="Events"
        subtitle={`${events.length} ${events.length === 1 ? "event" : "events"} · ${attendeeTotal} total ${
          attendeeTotal === 1 ? "attendee" : "attendees"
        }`}
        actions={
          <Button
            onClick={() => setShowForm(!showForm)}
            variant={showForm ? "secondary" : "primary"}
            size="sm"
          >
            {showForm ? <MdClose /> : <FaPlus className="text-xs" />}
            {showForm ? "Cancel" : "Create event"}
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          ariaLabel="Event ownership"
          value={viewMode}
          onChange={setViewMode}
          options={[
            { value: "my", label: "My events" },
            { value: "all", label: "All events" },
          ]}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
          className="field-select ml-auto max-w-[180px]"
        >
          {STATUS_FILTERS.map((filter) => (
            <option key={filter.key} value={filter.key}>
              {filter.label}
            </option>
          ))}
        </select>
      </div>

      {message && (
        <div
          className={`alert ${messageType === "error" ? "alert-danger" : "alert-ok"}`}
          role="status"
        >
          <span aria-hidden="true">{messageType === "error" ? "!" : "✓"}</span>
          <p>{message}</p>
        </div>
      )}

      {showForm && (
        <Card as="form" onSubmit={handleSubmit} className="space-y-6">
          <div>
            <h2 className="panel-heading">Create new event</h2>
            <p className="mt-1 text-sm text-on-dim">
              Publish the schedule, location and attendance window in one pass.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="event-title" className="field-label">Event title</label>
              <input
                id="event-title"
                type="text"
                name="title"
                placeholder="e.g. Coastal Clean-Up 2026"
                value={form.title}
                onChange={handleChange}
                required
                className="field"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="event-description" className="field-label">Description</label>
              <textarea
                id="event-description"
                name="description"
                placeholder="What should students expect?"
                value={form.description}
                onChange={handleChange}
                rows={3}
                className="field"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="event-location" className="field-label">Location</label>
              <input
                id="event-location"
                type="text"
                name="location"
                placeholder="Venue or address"
                value={form.location}
                onChange={handleChange}
                className="field"
              />
            </div>
            <div className="md:col-span-2">
              <MapPicker
                value={form.mapQuery}
                onChange={handleMapPick}
                className="h-64"
              />
            </div>
          </div>

          <div className="border-t border-line pt-5">
            <h3 className="text-sm font-semibold text-on">Event starts</h3>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="event-date" className="field-label">Start date</label>
                <input
                  id="event-date"
                  type="date"
                  name="date"
                  value={form.date}
                  onChange={handleChange}
                  required
                  className="field-datetime"
                />
              </div>
              <div>
                <label htmlFor="event-time" className="field-label">Start time</label>
                <input
                  id="event-time"
                  type="time"
                  name="time"
                  value={form.time}
                  onChange={handleChange}
                  required
                  className="field-datetime"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-line pt-5">
            <h3 className="text-sm font-semibold text-on">Event ends</h3>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="event-end-date" className="field-label">End date</label>
                <input
                  id="event-end-date"
                  type="date"
                  name="endDate"
                  value={form.endDate}
                  onChange={handleChange}
                  className="field-datetime"
                />
              </div>
              <div>
                <label htmlFor="event-end-time" className="field-label">End time</label>
                <input
                  id="event-end-time"
                  type="time"
                  name="endTime"
                  value={form.endTime}
                  onChange={handleChange}
                  className="field-datetime"
                />
              </div>
            </div>
            <p className="field-hint">
              This event ends on{" "}
              <span className="font-medium text-on-dim">
                {form.endDate || form.date || "—"} at {form.endTime || form.attendanceEndTime || "—"}
              </span>
              . Leave blank to default to the event date and attendance end time.
            </p>
          </div>

          <div className="border-t border-line pt-5">
            <h3 className="text-sm font-semibold text-on">Attendance window</h3>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="attendance-start" className="field-label">Start time</label>
                <input
                  id="attendance-start"
                  type="time"
                  name="attendanceStartTime"
                  value={form.attendanceStartTime}
                  onChange={handleChange}
                  required
                  className="field-datetime"
                />
              </div>
              <div>
                <label htmlFor="attendance-end" className="field-label">End time</label>
                <input
                  id="attendance-end"
                  type="time"
                  name="attendanceEndTime"
                  value={form.attendanceEndTime}
                  onChange={handleChange}
                  required
                  className="field-datetime"
                />
              </div>
            </div>
            <p className="field-hint">Students can only mark attendance within this window.</p>
          </div>

          <Button type="submit" loading={submitting} className="w-full">
            {submitting ? "Creating..." : "Create event"}
          </Button>
        </Card>
      )}

      {visibleEvents.length === 0 ? (
        <EmptyState
          icon={<FaCalendarAlt />}
          title={viewMode === "my" ? "No events yet" : "No events found"}
          description={
            viewMode === "my"
              ? "Create your first event to start tracking attendance."
              : "No events match this view."
          }
          action={
            viewMode === "my" && (
              <Button size="sm" onClick={() => setShowForm(true)}>
                <FaPlus className="text-xs" /> Create event
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {visibleEvents.map((event) => {
            const lifecycleNote = describeEventLifecycle(event);
            const ownedByMe = isOwnEvent(event);
            const canManageAttendance = canTakeAttendance(event);
            const canReopen = canManageAttendance && isTerminalStatus(event.status);
            return (
              <Card
                key={event._id}
                as="article"
                onClick={() => navigate(`/organizer/dashboard/events/${event._id}`)}
                className="group flex cursor-pointer flex-col transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-[var(--elev-2)] motion-reduce:hover:translate-y-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-inset ring-brand/20">
                      <FaCalendarAlt />
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-[17px] font-semibold tracking-tight text-on transition-colors group-hover:text-brand">
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
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-brand transition-colors hover:bg-brand/10"
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
                  {ownedByMe && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(event._id);
                      }}
                      className="shrink-0 rounded-lg p-2 text-on-muted transition-colors hover:bg-danger/10 hover:text-danger"
                      aria-label="Delete event"
                    >
                      <FaTrash className="text-sm" />
                    </button>
                  )}
                </div>

                <p className="mt-4 line-clamp-2 text-sm text-on-dim">
                  {event.description || "No description"}
                </p>

                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-on-dim">
                  <span className="flex items-center gap-1.5">
                    <FaMapMarkerAlt className="text-on-muted" /> {event.location || "TBA"}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FaCalendarAlt className="text-on-muted" /> {formatDate(event.date)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FaClock className="text-on-muted" /> {formatTime12Hour(event.time)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <BsClipboardCheck className="text-on-muted" /> {event.attendeeCount ?? 0}{" "}
                    {event.attendeeCount === 1 ? "attendee" : "attendees"}
                  </span>
                </div>
                <p className="mt-2 text-xs text-on-muted">
                  Ends: {formatDate(event.endDate || event.date)} at{" "}
                  {formatTime12Hour(event.endTime || event.attendanceEndTime)}
                </p>

                <div className="alert alert-warn alert-sm mt-4">
                  <BsClipboardCheck className="mt-0.5 shrink-0" />
                  <p>
                    Attendance: {formatTime12Hour(event.attendanceStartTime)} –{" "}
                    {formatTime12Hour(event.attendanceEndTime)}
                  </p>
                </div>

                {canManageAttendance && (
                  <div className="mt-auto border-t border-line pt-4">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleGroups(event._id);
                      }}
                      className="flex items-center gap-2 text-sm text-on-dim transition-colors hover:text-on"
                    >
                      {expandedEvent === event._id ? <FaChevronDown /> : <FaChevronRight />}
                      Attendees by group
                    </button>
                    {expandedEvent === event._id && (
                      <div className="mt-3 space-y-2">
                        {loadingGroups[event._id] ? (
                          <p className="text-xs text-on-muted">Loading...</p>
                        ) : (eventGroups[event._id] || []).length > 0 ? (
                          (eventGroups[event._id] || []).map((g) => (
                            <div
                              key={g.key || g.label}
                              className="flex items-center justify-between gap-3 rounded-lg border border-line bg-card-alt/40 px-3 py-2 text-sm"
                            >
                              <span className="text-on-dim">{g.label || "Unassigned"}</span>
                              <span className="num text-on">
                                {g.attended || 0}{" "}
                                {g.attended === 1 ? "student" : "students"}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-on-muted">No groups found.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {viewMode === "all" && event.organizer && (
                  <p className="mt-4 border-t border-line pt-4 text-xs text-on-muted">
                    Created by <span className="text-on-dim">{event.organizer.name}</span>
                  </p>
                )}
              </Card>
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

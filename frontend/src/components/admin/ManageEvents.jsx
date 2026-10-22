import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { useAutoRefresh } from "../../utils/useAutoRefresh";
import { FaCalendarAlt, FaEdit, FaMapMarkerAlt, FaPlus, FaUsers } from "react-icons/fa";
import EmptyState from "../shared/EmptyState";
import { usePageMeta } from "../../context/PageMetaContext";
import {
  isTerminalStatus,
  describeEventLifecycle,
  formatTime12Hour,
  formatDate,
} from "../../utils/helpers";
import {
  Button,
  Card,
  PageHeader,
  StatusChip,
  TableSkeleton,
} from "../ui";
import ConfirmDialog from "../ui/ConfirmDialog";
import MapPicker from "../shared/MapPicker";
import { MdClose } from "react-icons/md";

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

const ManageEvents = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [showCreate, setShowCreate] = useState(false);
  const [createMsg, setCreateMsg] = useState("");
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);

  usePageMeta("Manage Events", "Every event across the institution.");

  const fetchEvents = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get("/events/all");
      setEvents(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useAutoRefresh(fetchEvents);

  const fetchAttendees = async (eventId) => {
    try {
      const res = await api.get(`/events/${eventId}/attendees`);
      setAttendees(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const openEventDetails = async (event) => {
    setSelectedEvent(event);
    await fetchAttendees(event._id);
    setShowModal(true);
  };

  const updateEventStatus = async (eventId, newStatus) => {
    try {
      await api.patch(`/events/${eventId}/status`, { status: newStatus });
      fetchEvents();
      if (selectedEvent?._id === eventId) {
        setSelectedEvent((prev) => ({ ...prev, status: newStatus }));
      }
      setMessage(`Event status updated to ${newStatus}`);
      setMessageType("success");
    } catch (err) {
      console.error(err);
      setMessage("Failed to update status");
      setMessageType("error");
    }
  };

  const deleteEvent = async (eventId) => {
    try {
      await api.delete(`/events/${eventId}`);
      setEvents(events.filter((e) => e._id !== eventId));
      setShowModal(false);
      setMessage("Event deleted successfully");
      setMessageType("success");
    } catch (err) {
      console.error(err);
      setMessage("Failed to delete event");
      setMessageType("error");
    }
  };

  const handleCreateChange = (e) =>
    setCreateForm({ ...createForm, [e.target.name]: e.target.value });

  const handleCreateMapPick = (v) =>
    setCreateForm({ ...createForm, location: v, mapQuery: v });

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    // Latch while the request is in flight so a slow connection can't turn one
    // click into several events.
    if (creating) return;
    setCreating(true);
    try {
      const res = await api.post("/events", createForm);
      setEvents((prev) => [res.data, ...prev]);
      setCreateForm(EMPTY_FORM);
      setShowCreate(false);
      setCreateMsg("");
    } catch (err) {
      setCreateMsg(err.response?.data?.error || "Failed to create event");
    } finally {
      setCreating(false);
    }
  };

  const updateAttendeeStatus = async (eventId, studentId, newStatus) => {
    try {
      await api.patch(`/events/${eventId}/attendees/${studentId}`, { status: newStatus });
      fetchAttendees(eventId);
      setMessage("Attendee status updated");
      setMessageType("success");
    } catch (err) {
      console.error(err);
      setMessage("Failed to update attendee status");
      setMessageType("error");
    }
  };

  const filteredEvents = events
    .filter((event) => {
      const matchesSearch =
        event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.organizer?.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active"
          ? !isTerminalStatus(event.status)
          : event.status === statusFilter);
      return matchesSearch && matchesStatus;
    })
    // Finished/closed events sink to the bottom of the list.
    .sort((a, b) => {
      const aDone = isTerminalStatus(a.status) ? 1 : 0;
      const bDone = isTerminalStatus(b.status) ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return aDone
        ? new Date(b.date) - new Date(a.date)
        : new Date(a.date) - new Date(b.date);
    });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Institution events"
        title="All events"
        subtitle={`${filteredEvents.length} of ${events.length} events`}
        actions={
          <Button
            onClick={() => setShowCreate(!showCreate)}
            variant={showCreate ? "secondary" : "primary"}
            size="sm"
          >
            {showCreate ? <MdClose /> : <FaPlus className="text-xs" />}
            {showCreate ? "Cancel" : "Create event"}
          </Button>
        }
      />

      {message && (
        <div
          className={`alert ${messageType === "error" ? "alert-danger" : "alert-ok"}`}
          role="status"
        >
          <span aria-hidden="true">{messageType === "error" ? "!" : "✓"}</span>
          <p>{message}</p>
        </div>
      )}

      {!showCreate && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            placeholder="Search events or organizers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="field sm:max-w-xs"
            aria-label="Search events"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="field-select sm:ml-auto sm:max-w-[180px]"
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="upcoming">Upcoming</option>
            <option value="live">Live</option>
            <option value="finished">Finished</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      )}

      {showCreate && (
        <Card as="form" onSubmit={handleCreateSubmit} className="space-y-6">
          <div>
            <h2 className="panel-heading">Create new event</h2>
            <p className="mt-1 text-sm text-on-dim">
              The event appears for every student once published.
            </p>
          </div>

          {createMsg && (
            <div className="alert alert-danger" role="alert">
              <span aria-hidden="true">!</span>
              <p>{createMsg}</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="admin-event-title" className="field-label">Event title</label>
              <input
                id="admin-event-title"
                type="text"
                name="title"
                placeholder="e.g. Founders Day"
                value={createForm.title}
                onChange={handleCreateChange}
                required
                className="field"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="admin-event-description" className="field-label">Description</label>
              <textarea
                id="admin-event-description"
                name="description"
                placeholder="What should students expect?"
                value={createForm.description}
                onChange={handleCreateChange}
                rows={3}
                className="field"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="admin-event-location" className="field-label">Location</label>
              <input
                id="admin-event-location"
                type="text"
                name="location"
                placeholder="Venue or address"
                value={createForm.location}
                onChange={handleCreateChange}
                className="field"
              />
            </div>
            <div className="md:col-span-2">
              <MapPicker
                value={createForm.mapQuery}
                onChange={handleCreateMapPick}
                className="h-64"
              />
            </div>
          </div>

          <div className="border-t border-line pt-5">
            <h3 className="text-sm font-semibold text-on">Event starts</h3>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="admin-event-date" className="field-label">Start date</label>
                <input
                  id="admin-event-date"
                  type="date"
                  name="date"
                  value={createForm.date}
                  onChange={handleCreateChange}
                  required
                  className="field-datetime"
                />
              </div>
              <div>
                <label htmlFor="admin-event-time" className="field-label">Start time</label>
                <input
                  id="admin-event-time"
                  type="time"
                  name="time"
                  value={createForm.time}
                  onChange={handleCreateChange}
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
                <label htmlFor="admin-event-end-date" className="field-label">End date</label>
                <input
                  id="admin-event-end-date"
                  type="date"
                  name="endDate"
                  value={createForm.endDate}
                  onChange={handleCreateChange}
                  className="field-datetime"
                />
              </div>
              <div>
                <label htmlFor="admin-event-end-time" className="field-label">End time</label>
                <input
                  id="admin-event-end-time"
                  type="time"
                  name="endTime"
                  value={createForm.endTime}
                  onChange={handleCreateChange}
                  className="field-datetime"
                />
              </div>
            </div>
            <p className="field-hint">
              This event ends on{" "}
              <span className="font-medium text-on-dim">
                {createForm.endDate || createForm.date || "—"} at{" "}
                {createForm.endTime || createForm.attendanceEndTime || "—"}
              </span>
              . Leave blank to default to the event date and attendance end time.
            </p>
          </div>

          <div className="border-t border-line pt-5">
            <h3 className="text-sm font-semibold text-on">Attendance window</h3>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="admin-attendance-start" className="field-label">Start time</label>
                <input
                  id="admin-attendance-start"
                  type="time"
                  name="attendanceStartTime"
                  value={createForm.attendanceStartTime}
                  onChange={handleCreateChange}
                  required
                  className="field-datetime"
                />
              </div>
              <div>
                <label htmlFor="admin-attendance-end" className="field-label">End time</label>
                <input
                  id="admin-attendance-end"
                  type="time"
                  name="attendanceEndTime"
                  value={createForm.attendanceEndTime}
                  onChange={handleCreateChange}
                  required
                  className="field-datetime"
                />
              </div>
            </div>
            <p className="field-hint">
              Students can only mark attendance within this window.
            </p>
          </div>

          <Button type="submit" loading={creating} className="w-full">
            {creating ? "Creating..." : "Create event"}
          </Button>
        </Card>
      )}

      {loading ? (
        <Card>
          <TableSkeleton rows={5} />
        </Card>
      ) : filteredEvents.length === 0 ? (
        <EmptyState
          icon={<FaCalendarAlt />}
          title="No events found"
          description="Events created by organizers will appear here."
        />
      ) : (
        <div className="space-y-3">
          {filteredEvents.map((event) => (
            <Card key={event._id} as="article">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="font-display text-[17px] font-semibold tracking-tight text-on">
                      {event.title}
                    </h3>
                    <StatusChip status={event.status} />
                  </div>
                  {describeEventLifecycle(event) && (
                    <p className="mt-1 text-xs text-on-muted">
                      {describeEventLifecycle(event)}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-on-dim">
                    <span className="flex items-center gap-1.5">
                      <FaCalendarAlt className="text-on-muted" />
                      {formatDate(event.date)} at {formatTime12Hour(event.time)}
                    </span>
                    {event.location && (
                      <span className="flex items-center gap-1.5">
                        <FaMapMarkerAlt className="text-on-muted" />
                        {event.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <FaUsers className="text-on-muted" />
                      {event.organizer?.name || "Unknown organizer"}
                    </span>
                    <span className="text-on-muted">
                      Ends {formatDate(event.endDate || event.date)} at{" "}
                      {formatTime12Hour(event.endTime || event.attendanceEndTime)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={event.status}
                    onChange={(e) => updateEventStatus(event._id, e.target.value)}
                    className="field-select w-auto py-1.5 text-xs"
                    aria-label={`Status for ${event.title}`}
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="live">Live</option>
                    <option value="finished">Finished</option>
                    <option value="closed">Closed</option>
                  </select>
                  <Button
                    onClick={() => navigate(`/admin/dashboard/events/${event._id}`)}
                    variant="secondary"
                    size="sm"
                  >
                    <FaEdit className="text-xs" /> Edit
                  </Button>
                  <Button
                    onClick={() => openEventDetails(event)}
                    variant="secondary"
                    size="sm"
                  >
                    View attendees
                  </Button>
                  <Button
                    onClick={() => setDeleteTarget(event._id)}
                    variant="danger"
                    size="sm"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showModal && selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[var(--panel-radius)] border border-line bg-card shadow-[var(--elev-3)]">
            <div className="flex items-start justify-between gap-3 border-b border-line p-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-xl font-semibold tracking-tight text-on">
                    {selectedEvent.title}
                  </h3>
                  <StatusChip status={selectedEvent.status} />
                </div>
                <p className="mt-1 text-sm text-on-dim">
                  {formatDate(selectedEvent.date)} at {formatTime12Hour(selectedEvent.time)}
                  {selectedEvent.location && ` · ${selectedEvent.location}`}
                </p>
              </div>
              <Button
                onClick={() => setShowModal(false)}
                variant="ghost"
                size="icon"
                aria-label="Close event details"
              >
                <MdClose />
              </Button>
            </div>
            <div className="overflow-y-auto p-5">
              <h4 className="panel-heading text-base">
                Attendees ({attendees.length})
              </h4>
              {attendees.length === 0 ? (
                <EmptyState
                  compact
                  icon={<FaUsers />}
                  title="No attendees yet"
                  description="Check-ins for this event will appear here."
                />
              ) : (
                <div className="mt-4 space-y-2">
                  {attendees.map((attendee) => (
                    <div
                      key={attendee._id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-card-alt/40 p-3.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-on">
                          {attendee.student?.name}
                        </p>
                        <p className="truncate text-xs text-on-dim">
                          {attendee.student?.email}
                        </p>
                      </div>
                      <select
                        value={attendee.status}
                        onChange={(e) =>
                          updateAttendeeStatus(
                            selectedEvent._id,
                            attendee.student._id,
                            e.target.value
                          )
                        }
                        className="field-select w-auto py-1.5 text-xs"
                        aria-label={`Attendance status for ${attendee.student?.name}`}
                      >
                        <option value="present">Present</option>
                        <option value="late">Late</option>
                        <option value="absent">Absent</option>
                        <option value="pending">Pending</option>
                        <option value="excused">Excused</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
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
          deleteEvent(target);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default ManageEvents;

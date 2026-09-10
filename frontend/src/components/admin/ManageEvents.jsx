import React, { useState, useEffect } from "react";
import api from "../../api/axios";
import { FaCalendarAlt } from "react-icons/fa";
import EmptyState from "../shared/EmptyState";
import StatusBadge from "../shared/StatusBadge";
import StatusChip from "../ui/StatusChip";
import Button from "../ui/Button";
import ConfirmDialog from "../ui/ConfirmDialog";
import { usePageMeta } from "../../context/PageMetaContext";
import { TableSkeleton } from "../ui";
import MapPicker from "../shared/MapPicker";
import { FaPlus } from "react-icons/fa";
import { MdClose } from "react-icons/md";

const ManageEvents = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createMsg, setCreateMsg] = useState("");
  const [createForm, setCreateForm] = useState({
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

  usePageMeta("Manage Events", "Every event across the institution.");

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await api.get("/events/all");
      setEvents(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

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
    } catch (err) {
      console.error(err);
      alert("Failed to update status");
    }
  };

  const deleteEvent = async (eventId) => {
    try {
      await api.delete(`/events/${eventId}`);
      setEvents(events.filter((e) => e._id !== eventId));
      setShowModal(false);
    } catch (err) {
      console.error(err);
      alert("Failed to delete event");
    }
  };

  const handleCreateChange = (e) =>
    setCreateForm({ ...createForm, [e.target.name]: e.target.value });

  const handleCreateMapPick = (v) =>
    setCreateForm({ ...createForm, location: v, mapQuery: v });

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("/events", createForm);
      setEvents((prev) => [res.data, ...prev]);
      setCreateForm({
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
      setShowCreate(false);
      setCreateMsg("");
    } catch (err) {
      setCreateMsg(err.response?.data?.error || "Failed to create event");
    }
  };

  const updateAttendeeStatus = async (eventId, studentId, newStatus) => {
    try {
      await api.patch(`/events/${eventId}/attendees/${studentId}`, { status: newStatus });
      fetchAttendees(eventId);
    } catch (err) {
      console.error(err);
      alert("Failed to update attendee status");
    }
  };

  const filteredEvents = events.filter((event) => {
    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.organizer?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || event.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const inputClasses =
    "px-3.5 py-2 bg-card rounded-lg border border-line text-sm text-on placeholder-on-muted focus:outline-none focus:border-transparent focus:ring-2 focus:ring-indigo-500/40 transition-colors";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-on-dim">
          {filteredEvents.length} of {events.length} events
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            onClick={() => setShowCreate(!showCreate)}
            variant={showCreate ? "secondary" : "primary"}
            size="sm"
          >
            {showCreate ? <MdClose /> : <FaPlus className="text-xs" />}
            {showCreate ? "Cancel" : "Create Event"}
          </Button>
          <input
            type="text"
            placeholder="Search events..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={inputClasses}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={inputClasses}
          >
            <option value="all">All Status</option>
            <option value="upcoming">Upcoming</option>
            <option value="live">Live</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Create Event Form */}
      {showCreate && (
        <form
          onSubmit={handleCreateSubmit}
          className="space-y-5 rounded-xl border border-line bg-card p-6"
        >
          <h2 className="text-lg font-semibold text-on">Create New Event</h2>

          {createMsg && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-600 dark:text-red-400">
              {createMsg}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <input
                type="text"
                name="title"
                placeholder="Event Title"
                value={createForm.title}
                onChange={handleCreateChange}
                required
                className="w-full bg-card border border-line rounded-lg px-3.5 py-2.5 text-on placeholder-on-muted focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
              />
            </div>
            <div className="md:col-span-2">
              <textarea
                name="description"
                placeholder="Description"
                value={createForm.description}
                onChange={handleCreateChange}
                rows={3}
                className="w-full bg-card border border-line rounded-lg px-3.5 py-2.5 text-on placeholder-on-muted focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
              />
            </div>
            <div className="md:col-span-2">
              <input
                type="text"
                name="location"
                placeholder="Location"
                value={createForm.location}
                onChange={handleCreateChange}
                className="w-full bg-card border border-line rounded-lg px-3.5 py-2.5 text-on placeholder-on-muted focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
              />
            </div>
            <div className="md:col-span-2">
              <MapPicker
                value={createForm.mapQuery}
                onChange={handleCreateMapPick}
                className="h-64"
              />
            </div>
            <div>
              <input
                type="date"
                name="date"
                value={createForm.date}
                onChange={handleCreateChange}
                required
                className="w-full bg-card border border-line rounded-lg px-3.5 py-2.5 text-on focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
              />
            </div>
            <div>
              <input
                type="time"
                name="time"
                value={createForm.time}
                onChange={handleCreateChange}
                required
                className="w-full bg-card border border-line rounded-lg px-3.5 py-2.5 text-on focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
              />
            </div>
          </div>

          <div className="border-t border-line pt-4">
            <h3 className="text-sm font-semibold text-on-dim mb-3">Event Ends</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-on-muted block mb-1">End Date</label>
                <input
                  type="date"
                  name="endDate"
                  value={createForm.endDate}
                  onChange={handleCreateChange}
                  className="w-full bg-card border border-line rounded-lg px-3.5 py-2.5 text-on focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
                />
              </div>
              <div>
                <label className="text-xs text-on-muted block mb-1">End Time</label>
                <input
                  type="time"
                  name="endTime"
                  value={createForm.endTime}
                  onChange={handleCreateChange}
                  className="w-full bg-card border border-line rounded-lg px-3.5 py-2.5 text-on focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
                />
              </div>
            </div>
            <p className="text-xs text-on-muted mt-2">
              This event ends on{" "}
              <span className="font-medium text-on-dim">
                {createForm.endDate || createForm.date || "—"} at{" "}
                {createForm.endTime || createForm.attendanceEndTime || "—"}
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
                  value={createForm.attendanceStartTime}
                  onChange={handleCreateChange}
                  required
                  className="w-full bg-card border border-line rounded-lg px-3.5 py-2.5 text-on focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
                />
              </div>
              <div>
                <label className="text-xs text-on-muted block mb-1">End Time</label>
                <input
                  type="time"
                  name="attendanceEndTime"
                  value={createForm.attendanceEndTime}
                  onChange={handleCreateChange}
                  required
                  className="w-full bg-card border border-line rounded-lg px-3.5 py-2.5 text-on focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
                />
              </div>
            </div>
            <p className="text-xs text-on-muted mt-2">Students can only mark attendance within this time window.</p>
          </div>

          <Button type="submit" className="w-full py-2.5">
            Create Event
          </Button>
        </form>
      )}

      {loading ? (
        <TableSkeleton rows={5} />
      ) : filteredEvents.length === 0 ? (
        <EmptyState icon={<FaCalendarAlt />} title="No events found" description="Events created by organizers will appear here." />
      ) : (
        <div className="grid gap-4">
          {filteredEvents.map((event) => (
            <div
              key={event._id}
              className="bg-card p-5 rounded-xl border border-line hover:border-line transition-colors"
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{event.title}</h3>
                    <StatusChip status={event.status} />
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-on-dim">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {new Date(event.date).toLocaleDateString()} at {event.time}
                    </span>
                    {event.location && (
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {event.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {event.organizer?.name || "Unknown"}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Ends: {new Date(event.endDate || event.date).toLocaleDateString()} at{" "}
                      {event.endTime || event.attendanceEndTime}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={event.status}
                    onChange={(e) => updateEventStatus(event._id, e.target.value)}
                    className="px-3 py-2 bg-card rounded-lg border border-line text-sm text-on focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="live">Live</option>
                    <option value="closed">Closed</option>
                  </select>
                  <Button
                    onClick={() => openEventDetails(event)}
                    variant="secondary"
                    size="sm"
                    className="border-indigo-500/30 text-indigo-600 dark:text-indigo-400"
                  >
                    View Attendees
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
            </div>
          ))}
        </div>
      )}

      {showModal && selectedEvent && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden border border-line">
            <div className="p-6 border-b border-line flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">{selectedEvent.title}</h3>
                <p className="text-sm text-on-dim">
                  {new Date(selectedEvent.date).toLocaleDateString()} at {selectedEvent.time}
                  {selectedEvent.location && ` - ${selectedEvent.location}`}
                </p>
              </div>
              <div className="flex gap-2">
                <StatusBadge status={selectedEvent.status} />
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-card-alt rounded"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <h4 className="text-lg font-semibold mb-4">
                Attendees ({attendees.length})
              </h4>
              {attendees.length === 0 ? (
                <p className="text-on-dim text-center py-8">No attendees yet</p>
              ) : (
                <div className="space-y-2">
                  {attendees.map((attendee) => (
                    <div
                      key={attendee._id}
                      className="flex items-center justify-between p-4 bg-card-alt rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{attendee.student?.name}</p>
                        <p className="text-sm text-on-dim">{attendee.student?.email}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <select
                          value={attendee.status}
                          onChange={(e) =>
                            updateAttendeeStatus(selectedEvent._id, attendee.student._id, e.target.value)
                          }
                          className="px-3 py-1 bg-card rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                        >
                          <option value="present">Present</option>
                          <option value="absent">Absent</option>
                          <option value="pending">Pending</option>
                        </select>
                      </div>
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
        message="This will permanently delete the event and all of its attendance records, including community service credits. This action cannot be undone."
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

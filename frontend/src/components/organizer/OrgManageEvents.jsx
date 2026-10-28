import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../../api/axios";
import { useAutoRefresh } from "../../utils/useAutoRefresh";
import {
  formatTime12Hour,
  isTerminalStatus,
  describeEventLifecycle,
  formatDate,
} from "../../utils/helpers";
import { getUserFromToken } from "../../utils/auth";
import { FaCalendarAlt, FaPlus } from "react-icons/fa";
import { MdClose } from "react-icons/md";
import { usePageMeta } from "../../context/PageMetaContext";
import { readScreen, writeScreen } from "../../utils/queryCache";
import {
  Button,
  Card,
  PageHeader,
  SegmentedControl,
  StatusChip,
} from "../ui";
import { useOrganizerPeriod } from "../../utils/useOrganizerPeriod";
import { recordsForAcademicPeriod } from "../../utils/academicPeriods";
import AcademicPeriodFilter from "./AcademicPeriodFilter";
import Pagination from "../ui/Pagination";
import Loading from "../shared/Loading";
import EmptyState from "../shared/EmptyState";
import ConfirmDialog from "../ui/ConfirmDialog";
import EventLastEdit from "../shared/EventLastEdit";

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
  date: "",
  time: "",
  endDate: "",
  endTime: "",
  attendanceStartTime: "",
  attendanceEndTime: "",
};

const OrgManageEvents = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [events, setEvents] = useState(() => readScreen("organizer:events:all")?.events ?? []);
  const periodSelection = useOrganizerPeriod();
  const { period, semester } = periodSelection;
  const [page, setPage] = useState(1);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(() => readScreen("organizer:events:all") === undefined);
  const [showForm, setShowForm] = useState(searchParams.get("create") === "1");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [viewMode, setViewMode] = useState("all");
  const [eventRange, setEventRange] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [expandedEvent, setExpandedEvent] = useState(null);
  const [eventGroups, setEventGroups] = useState({});
  const [loadingGroups, setLoadingGroups] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  usePageMeta("Manage Events", "Create and edit shared events, or review past events.");

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
      .then((res) => {
        setEvents(res.data);
        setLoadError(false);
        setLoading(false);
        writeScreen(`organizer:events:${viewMode}`, { events: res.data });
      })
      .catch(() => { setLoadError(true); setLoading(false); });
  }, [viewMode]);

  // Switching between "All events" and "My events" is instant on a revisit.
  useEffect(() => {
    const seeded = readScreen(`organizer:events:${viewMode}`);
    if (seeded) {
      setEvents(seeded.events ?? []);
      setLoading(false);
    }
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

  useAutoRefresh(fetchEvents, { interval: 30000 });

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });


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

  const periodEvents = useMemo(() => recordsForAcademicPeriod(events, period, semester), [events, period, semester]);

  // Finished events sink to the bottom so the live work stays on top.
  const visibleEvents = useMemo(() => {
    const matches = periodEvents.filter((event) => {
      const past = isTerminalStatus(event.status);
      if (eventRange === "past" && !past) return false;
      if (eventRange === "active" && past) return false;
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
  }, [periodEvents, statusFilter, eventRange]);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(visibleEvents.length / 6)));
  const pageEvents = visibleEvents.slice((currentPage - 1) * 6, currentPage * 6);

  const attendeeTotal = visibleEvents.reduce((sum, e) => sum + (e.attendeeCount || 0), 0);

  if (loading) return <Loading label="Loading your events..." />;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Organizer events"
        title={showForm ? "Create event" : eventRange === "past" ? "Past events" : eventRange === "active" ? "Active events" : viewMode === "my" ? "My events" : "All events"}
        subtitle={showForm ? "Enter the event details and attendance schedule." : `${visibleEvents.length} ${visibleEvents.length === 1 ? "event" : "events"} · ${attendeeTotal} total ${
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

      {!showForm && <>
      <SegmentedControl ariaLabel="Event timeline" value={eventRange} onChange={value => { setEventRange(value); setStatusFilter("all"); setPage(1); }} options={[{ value: "all", label: "All events" }, { value: "active", label: "Active events" }, { value: "past", label: "Past events" }]} />
      <details className="rounded-xl border border-line bg-card-alt/20 p-3">
        <summary className="cursor-pointer text-sm font-medium text-on">Filters{viewMode !== "all" || statusFilter !== "all" || period ? " · Applied" : ""}</summary>
        <div className="mt-3 space-y-3">
          <AcademicPeriodFilter selection={periodSelection} />
      <div className="event-filter-row">
        <SegmentedControl
          ariaLabel="Event ownership"
          value={viewMode}
          onChange={value => { if (value === viewMode) return; setLoading(true); setViewMode(value); setPage(1); }}
          options={[
            { value: "my", label: "My events" },
            { value: "all", label: "All events" },
          ]}
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          aria-label="Filter by status"
          className="field-select"
        >
          {STATUS_FILTERS.map((filter) => (
            <option key={filter.key} value={filter.key}>
              {filter.label}
            </option>
          ))}
        </select>
      </div>
        </div>
      </details>
      </>}
      {loadError && <div role="alert" className="alert alert-danger">Events could not be refreshed. Please reload to try again.</div>}

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
                {form.endDate || form.date || "—"} at {form.endTime || "11:59 PM"}
              </span>
              . Leave blank to default to the end of the event date.
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

      {!showForm && (visibleEvents.length === 0 ? (
        <EmptyState
          icon={<FaCalendarAlt />}
          title={events.length ? "No matching events" : viewMode === "my" ? "No events yet" : "No events found"}
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
          {pageEvents.map((event) => {
            const ownedByMe = isOwnEvent(event);
            const canManageAttendance = canTakeAttendance(event);
            const terminal = isTerminalStatus(event.status);
            return <Card key={event._id} as="article" className="flex min-w-0 flex-col">
              <div className="flex items-start justify-between gap-3"><h3 className="min-w-0 flex-1 font-display text-lg font-semibold text-on [overflow-wrap:anywhere]">{event.title}</h3><StatusChip status={event.status} /></div>
              <div className="mt-4 space-y-2 text-sm text-on-dim">
                <p><span className="text-on-muted">Starts: </span>{formatDate(event.date)} at {formatTime12Hour(event.time)}</p>
                <p><span className="text-on-muted">Ends: </span>{formatDate(event.endDate || event.date)} at {formatTime12Hour(event.endTime || "23:59")}</p>
                <p className="[overflow-wrap:anywhere]"><span className="text-on-muted">Venue: </span>{event.location || "TBA"}</p>
                <p className="text-xs text-on-muted">{event.attendeeCount ?? 0} checked in · Attendance {formatTime12Hour(event.attendanceStartTime) || "TBA"} – {formatTime12Hour(event.attendanceEndTime) || "TBA"}</p>
              </div>
              <EventLastEdit event={event} className="mt-3" />
              <details className="mt-3 text-xs text-on-muted">
                <summary className="cursor-pointer py-1 font-medium">Event information</summary>
                <p className="mt-2 whitespace-pre-wrap text-sm text-on-dim [overflow-wrap:anywhere]">{event.description || "No description provided."}</p>
                <p className="mt-2">{describeEventLifecycle(event)}</p>
                {viewMode === "all" && <p className="mt-2">Organized by {event.organizer?.name || "Organizer TBA"}</p>}
                {canManageAttendance && <div className="mt-3"><button type="button" className="font-medium text-brand" onClick={() => toggleGroups(event._id)}>Attendees by group</button>{expandedEvent === event._id && <div className="mt-2 space-y-1">{loadingGroups[event._id] ? "Loading…" : eventGroups[event._id]?.length ? eventGroups[event._id].map(group => <p key={group.key || group.label}>{group.label || "Unassigned"}: {group.attended || 0}</p>) : "No groups found."}</div>}</div>}
              </details>
              <div className="mt-auto pt-4">
                <div className="flex flex-wrap items-start gap-3 border-t border-line pt-3">
                  <Button variant="secondary" size="sm" onClick={() => navigate(`/organizer/dashboard/events/${event._id}`)}>View / edit event</Button>
                  {(terminal || ownedByMe) && <details className="min-w-0 text-xs text-on-muted">
                    <summary className="cursor-pointer rounded-lg border border-line px-3 py-2 font-medium">More actions</summary>
                    <div className="mt-2 flex flex-col items-start gap-2 rounded-lg border border-line bg-card p-2">
                      {terminal && <Button variant="ghost" size="sm" onClick={() => handleReopen(event._id)}>Reopen event</Button>}
                      {ownedByMe && <Button variant="danger" size="sm" onClick={() => setDeleteTarget(event._id)}>Delete event</Button>}
                    </div>
                  </details>}
                </div>
              </div>
            </Card>;
          })}
        </div>
      ))}

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
      {!showForm && <Pagination page={currentPage} pageSize={6} total={visibleEvents.length} onChange={setPage} label="Organizer event pages" />}
    </div>
  );
};

export default OrgManageEvents;

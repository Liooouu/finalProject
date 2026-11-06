import { applyEventField } from "../../utils/academicPeriods";
import { useTransientState } from "../../utils/useTransientState";
import EventCreateForm from "../shared/EventCreateForm";
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../../api/axios";
import { useAutoRefresh } from "../../utils/useAutoRefresh";
import {
  isTerminalStatus,
  describeEventLifecycle,
} from "../../utils/helpers";
import { getUserFromToken } from "../../utils/auth";
import { FaCalendarAlt, FaPlus } from "react-icons/fa";
import { MdClose } from "react-icons/md";
import { usePageMeta } from "../../context/PageMetaContext";
import { readScreen, writeScreen } from "../../utils/queryCache";
import {
  Button,
  PageHeader,
  SegmentedControl,
} from "../ui";
import { useOrganizerPeriod } from "../../utils/useOrganizerPeriod";
import { recordsForAcademicPeriod } from "../../utils/academicPeriods";
import AcademicPeriodFilter from "./AcademicPeriodFilter";
import Pagination from "../ui/Pagination";
import StablePage from "../ui/StablePage";
import Loading from "../shared/Loading";
import EmptyState from "../shared/EmptyState";
import ConfirmDialog from "../ui/ConfirmDialog";
import ManagedEventCard from "../shared/ManagedEventCard";

const STATUS_FILTERS = [
  { key: "all", label: "All statuses" },
  { key: "active", label: "Active" },
  { key: "upcoming", label: "Upcoming" },
  { key: "live", label: "Live" },
  { key: "finished", label: "Finished" },
  { key: "closed", label: "Closed" },
];

const EVENT_PAGE_SIZE = 2;

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
  const { period, semester, schoolYear } = periodSelection;
  const [page, setPage] = useState(1);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(() => readScreen("organizer:events:all") === undefined);
  const [showForm, setShowForm] = useState(searchParams.get("create") === "1");
  const [message, setMessage] = useTransientState("");
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
  const eventRequest = useRef(0);

  usePageMeta("Manage Events", "Create and edit shared events, or review past events.");

  const currentUserId = getUserFromToken()?.id;
  const isOwnEvent = (event) => {
    const ownerId = event.organizer?._id || event.organizer;
    return Boolean(currentUserId && ownerId && String(ownerId) === String(currentUserId));
  };

  const fetchEvents = useCallback(() => {
    const request = ++eventRequest.current;
    const endpoint = viewMode === "my" ? "/events/my-events" : "/events/all";
    return api
      .get(endpoint)
      .then((res) => {
        if (request !== eventRequest.current) return;
        setEvents(res.data);
        setLoadError(false);
        setLoading(false);
        writeScreen(`organizer:events:${viewMode}`, { events: res.data });
      })
      .catch(() => { if (request === eventRequest.current) { setLoadError(true); setLoading(false); } });
  }, [viewMode]);

  // Switching between "All events" and "My events" is instant on a revisit.
  useEffect(() => {
    const seeded = readScreen(`organizer:events:${viewMode}`);
    setEvents(seeded?.events ?? []);
    setLoading(seeded === undefined);
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
    return () => { eventRequest.current += 1; };
  }, [fetchEvents]);

  useAutoRefresh(fetchEvents, { interval: 30000 });

  const handleChange = (e) => { const field={name:e.target.name,value:e.target.value}; setForm(previous=>applyEventField(previous,field)); };


  const handleSubmit = async (e) => {
    e.preventDefault();
    // A slow request leaves the button clickable; a second tap would POST again
    // and create a duplicate event. Latch until the first one resolves.
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await api.post("/events", form);
      const created = { ...res.data, attendeeCount: res.data.attendeeCount || 0 };
      setEvents(previous => {
        const updated = [created, ...previous.filter(event => event._id !== created._id)];
        writeScreen(`organizer:events:${viewMode}`, { events: updated });
        return updated;
      });
      setLoading(false);
      setPage(1);
      setEventRange("all");
      setStatusFilter("all");
      setMessage(res.data.notificationWarning || "Event created successfully!");
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
  const currentPage = Math.min(page, Math.max(1, Math.ceil(visibleEvents.length / EVENT_PAGE_SIZE)));
  const pageEvents = visibleEvents.slice((currentPage - 1) * EVENT_PAGE_SIZE, currentPage * EVENT_PAGE_SIZE);

  const attendeeTotal = visibleEvents.reduce((sum, e) => sum + (e.attendeeCount || 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Organizer events"
        title={showForm ? "Create event" : eventRange === "past" ? "Past events" : eventRange === "active" ? "Active events" : viewMode === "my" ? "My events" : "All events"}
        subtitle={showForm ? "Enter the event details and attendance schedule." : loading ? "Loading events…" : `${visibleEvents.length} ${visibleEvents.length === 1 ? "event" : "events"} · ${attendeeTotal} total ${
          attendeeTotal === 1 ? "attendee" : "attendees"
        }`}
        actions={showForm ? <Button onClick={() => setShowForm(false)} variant="secondary" size="sm"><MdClose /> Cancel</Button> : undefined}
      />

      {!showForm && <>
      <div className="event-view-toolbar">
        <SegmentedControl ariaLabel="Event timeline" value={eventRange} onChange={value => { setEventRange(value); setStatusFilter("all"); setPage(1); }} options={[{ value: "all", label: "All events", shortLabel: "All" }, { value: "active", label: "Active events", shortLabel: "Active" }, { value: "past", label: "Past events", shortLabel: "Past" }]} />
        <Button onClick={() => setShowForm(true)} size="sm"><FaPlus className="text-xs" /> Create event</Button>
      </div>
      <details className="portal-card rounded-xl border border-line bg-card-alt/20 p-3">
        <summary className="cursor-pointer text-sm font-medium text-on">Filters{viewMode !== "all" || statusFilter !== "all" || period ? " · Applied" : ""}</summary>
        <div className="mt-3 space-y-3">
          <AcademicPeriodFilter selection={{
            ...periodSelection,
            setSchoolYear: value => { periodSelection.setSchoolYear(value); setPage(1); },
            setSemester: value => { periodSelection.setSemester(value); setPage(1); },
          }} />
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
      {loadError && <div role="alert" className="alert alert-danger"><p>Events could not be loaded.</p><Button size="sm" variant="secondary" onClick={fetchEvents}>Retry loading events</Button></div>}

      {message && (
        <div
          className={`alert ${messageType === "error" ? "alert-danger" : "alert-ok"}`}
          role="status"
        >
          <span aria-hidden="true">{messageType === "error" ? "!" : "✓"}</span>
          <p>{message}</p>
        </div>
      )}

      {showForm && <EventCreateForm value={form} onChange={handleChange} onSubmit={handleSubmit} busy={submitting} idPrefix="organizer-event" />}

      {!showForm && (loading ? <Loading label="Loading your events..." /> : loadError && events.length === 0 ? (
        <EmptyState icon={<FaCalendarAlt />} title="Events unavailable" description="Retry loading events to see the current list." />
      ) : visibleEvents.length === 0 ? (
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
        <StablePage pageKey={`organizer-events:${viewMode}:${eventRange}:${statusFilter}:${schoolYear}:${semester}:${visibleEvents.length}`} footer={<Pagination page={currentPage} pageSize={EVENT_PAGE_SIZE} total={visibleEvents.length} onChange={setPage} label="Organizer event pages" />}>
        <div className="managed-events-grid-organizer stretch-page-grid grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
          {pageEvents.map((event) => {
            const ownedByMe = isOwnEvent(event);
            return <ManagedEventCard key={event._id} event={event} showAttendees details={
              <details className="mt-3 text-xs text-on-muted">
                <summary className="cursor-pointer py-1 font-medium">Event information</summary>
                <p className="mt-2">{describeEventLifecycle(event)}</p>
                {viewMode === "all" && <p className="mt-2">Organized by {event.organizer?.name || "Organizer TBA"}</p>}
                <div className="mt-3"><button type="button" className="font-medium text-brand" onClick={() => toggleGroups(event._id)}>Attendees by group</button>{expandedEvent === event._id && <div className="mt-2 space-y-1">{loadingGroups[event._id] ? "Loading…" : eventGroups[event._id]?.length ? eventGroups[event._id].map(group => <p key={group.key || group.label}>{group.label || "Unassigned"}: {group.attended || 0}</p>) : "No groups found."}</div>}</div>
              </details>
            } actions={
              <div className="">
                <div className="flex flex-wrap items-start gap-3 border-t border-line pt-3">
                  <Button variant="secondary" size="sm" onClick={() => navigate(`/organizer/dashboard/events/${event._id}`)}>View / edit event</Button>
                  {ownedByMe && <Button variant="danger" size="sm" onClick={() => setDeleteTarget(event._id)}>Delete</Button>}
                </div>
              </div>
            } />;
          })}
        </div>
        </StablePage>
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
    </div>
  );
};

export default OrgManageEvents;

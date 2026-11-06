import { useAcademicPeriods } from "../../utils/useAcademicPeriods";
import AcademicPeriodFilter from "../organizer/AcademicPeriodFilter";
import { recordsForAcademicPeriod } from "../../utils/academicPeriods";
import { applyEventField } from "../../utils/academicPeriods";
import { useTransientState } from "../../utils/useTransientState";
import EventCreateForm from "../shared/EventCreateForm";
import ManagedEventCard from "../shared/ManagedEventCard";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { useAutoRefresh } from "../../utils/useAutoRefresh";
import { FaCalendarAlt, FaEdit, FaPlus, FaUsers } from "react-icons/fa";
import EmptyState from "../shared/EmptyState";
import { usePageMeta } from "../../context/PageMetaContext";
import {
  isTerminalStatus,
  formatTime12Hour,
  formatDate,
} from "../../utils/helpers";
import {
  Button,
  Card,
  PageHeader,
  SegmentedControl,
  StatusChip,
  TableSkeleton,
} from "../ui";
import ConfirmDialog from "../ui/ConfirmDialog";
import Pagination from "../ui/Pagination";
import StablePage from "../ui/StablePage";
import { MdClose } from "react-icons/md";
import { readScreen, writeScreen } from "../../utils/queryCache";

const CACHE_KEY = "admin:events";

const EVENT_PAGE_SIZE = 3;

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

const ManageEvents = () => {
  const periodSelection=useAcademicPeriods();
  const navigate = useNavigate();
  const seed = readScreen(CACHE_KEY);
  const [events, setEvents] = useState(seed?.events ?? []);
  const [loading, setLoading] = useState(seed === undefined);
  const [loadError, setLoadError] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [attendeeSearch, setAttendeeSearch] = useState("");
  const [attendeePage, setAttendeePage] = useState(1);
  const [attendeesLoading, setAttendeesLoading] = useState(false);
  const [attendeesError, setAttendeesError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [eventRange, setEventRange] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [message, setMessage] = useTransientState("");
  const [messageType, setMessageType] = useState("success");
  const [showCreate, setShowCreate] = useState(false);
  const [eventsPage, setEventsPage] = useState(1);
  const [createMsg, setCreateMsg] = useTransientState("");
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const eventRequest = useRef(0);
  const attendeeRequest = useRef(0);

  usePageMeta("Manage Events", "Monitor events and correct their information.");

  const fetchEvents = useCallback(async ({ silent = false } = {}) => {
    const request = ++eventRequest.current;
    const previous = readScreen(CACHE_KEY);
    if (!silent && previous === undefined) setLoading(true);
    try {
      const res = await api.get("/events/all");
      if (request !== eventRequest.current) return;
      setEvents(res.data);
      setLoadError("");
      writeScreen(CACHE_KEY, { events: res.data });
    } catch (err) {
      if (request === eventRequest.current) setLoadError(err.response?.data?.error || "Events could not be loaded. Try again.");
    } finally {
      if (request === eventRequest.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    return () => { eventRequest.current += 1; attendeeRequest.current += 1; };
  }, [fetchEvents]);

  useAutoRefresh(fetchEvents, { interval: 30000 });

  const fetchAttendees = async (eventId) => {
    const request = ++attendeeRequest.current;
    setAttendees([]); setAttendeesLoading(true); setAttendeesError(false);
    try {
      const res = await api.get(`/events/${eventId}/attendees`);
      if (request === attendeeRequest.current) setAttendees(res.data);
    } catch {
      if (request === attendeeRequest.current) setAttendeesError(true);
    } finally { if (request === attendeeRequest.current) setAttendeesLoading(false); }
  };

  const openEventDetails = async (event) => {
    setSelectedEvent(event);
    setAttendeeSearch("");
    setAttendeePage(1);
    setShowModal(true);
    await fetchAttendees(event._id);
  };

  const deleteEvent = async (eventId) => {
    try {
      await api.delete(`/events/${eventId}`);
      eventRequest.current += 1;
      setLoading(false);
      setEvents(previous => {
        const updated = previous.filter(event => event._id !== eventId);
        writeScreen(CACHE_KEY, { events: updated });
        return updated;
      });
      setShowModal(false);
      setMessage("Event deleted successfully");
      setMessageType("success");
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.error || "Failed to delete event");
      setMessageType("error");
    }
  };

  const handleCreateChange = (e) => { const field={name:e.target.name,value:e.target.value}; setCreateForm(previous=>applyEventField(previous,field)); };


  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    // Latch while the request is in flight so a slow connection can't turn one
    // click into several events.
    if (creating) return;
    setCreating(true);
    try {
      const res = await api.post("/events", createForm);
      eventRequest.current += 1;
      setLoading(false);
      setLoadError("");
      setEvents(previous => {
        const updated = [res.data, ...previous.filter(event => event._id !== res.data._id)];
        writeScreen(CACHE_KEY, { events: updated });
        return updated;
      });
      setSearchTerm("");
      setEventRange("all");
      setStatusFilter("all");
      setEventsPage(1);
      setCreateForm(EMPTY_FORM);
      setShowCreate(false);
      setCreateMsg("");
      setMessage(res.data.notificationWarning || "Event created successfully!");
      setMessageType("success");
    } catch (err) {
      setCreateMsg(err.response?.data?.error || "Failed to create event");
    } finally {
      setCreating(false);
    }
  };


  const attendeeQuery = attendeeSearch.trim().toLowerCase();
  const matchingAttendees = attendees.filter(record => `${record.student?.name || ""} ${record.student?.email || ""}`.toLowerCase().includes(attendeeQuery));
  const currentAttendeePage = Math.min(attendeePage, Math.max(1, Math.ceil(matchingAttendees.length / 5)));
  const visibleAttendees = matchingAttendees.slice((currentAttendeePage - 1) * 5, currentAttendeePage * 5);

  const filteredEvents = recordsForAcademicPeriod(events,periodSelection.period,periodSelection.semester)
    .filter((event) => {
      const matchesSearch =
        event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.organizer?.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active"
          ? !isTerminalStatus(event.status)
          : event.status === statusFilter);
      const matchesRange = eventRange === "all" || (eventRange === "past" ? isTerminalStatus(event.status) : !isTerminalStatus(event.status));
      return matchesSearch && matchesStatus && matchesRange;
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

  // Keep the final page valid after deletion or a background refresh.
  const eventPageCount = Math.max(1, Math.ceil(filteredEvents.length / EVENT_PAGE_SIZE));
  const visibleEventPage = Math.min(eventsPage, eventPageCount);
  const pagedEvents = filteredEvents.slice(
    (visibleEventPage - 1) * EVENT_PAGE_SIZE,
    visibleEventPage * EVENT_PAGE_SIZE
  );


  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Department events"
        title={showCreate ? "Create event" : "All events"}
        subtitle={showCreate ? "Enter the event details and attendance schedule." : `${filteredEvents.length} of ${events.length} events`}
        actions={showCreate ? <Button onClick={() => setShowCreate(false)} variant="secondary" size="sm"><MdClose /> Cancel</Button> : undefined}
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

      {!showCreate && <AcademicPeriodFilter selection={{...periodSelection,setSchoolYear:value=>{periodSelection.setSchoolYear(value);setEventsPage(1);},setSemester:value=>{periodSelection.setSemester(value);setEventsPage(1);}}}/>}
      {loadError && <div className="alert alert-danger" role="alert"><p>{loadError}</p><Button variant="secondary" size="sm" onClick={() => fetchEvents()}>Retry loading events</Button></div>}

      {!showCreate && (
        <div className="event-view-toolbar">
          <SegmentedControl ariaLabel="Event timeline" value={eventRange} onChange={value => { setEventRange(value); setStatusFilter("all"); setEventsPage(1); }} options={[{ value: "all", label: "All events", shortLabel: "All" }, { value: "active", label: "Active events", shortLabel: "Active" }, { value: "past", label: "Past events", shortLabel: "Past" }]} />
          <Button onClick={() => setShowCreate(true)} size="sm"><FaPlus className="text-xs" /> Create event</Button>
        </div>
      )}
      {!showCreate && (
        <div className="event-filter-row">
          <input
            type="text"
            placeholder="Search events or organizers..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setEventsPage(1); }}
            className="field sm:max-w-xs"
            aria-label="Search events"
          />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setEventsPage(1); }}
            className="field-select"
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

      {showCreate && <EventCreateForm value={createForm} onChange={handleCreateChange} onSubmit={handleCreateSubmit} busy={creating} error={createMsg} idPrefix="admin-event" />}

      {!showCreate && (loading ? (
        <Card>
          <TableSkeleton rows={5} />
        </Card>
      ) : loadError && events.length === 0 ? (
        <EmptyState icon={<FaCalendarAlt />} title="Events unavailable" description="Retry loading events to see the current list." />
      ) : filteredEvents.length === 0 ? (
        <EmptyState
          icon={<FaCalendarAlt />}
          title="No events found"
          description="Events created by organizers will appear here."
        />
      ) : (
        <div className="flex min-w-0 flex-col gap-4">
        <StablePage fill className="gap-4" pageKey={`admin-events:${periodSelection.schoolYear}:${periodSelection.semester}:${searchTerm}:${eventRange}:${statusFilter}:${filteredEvents.length}`} footer={<div className="admin-event-page-footer shrink-0 pb-2 pt-1 [&>nav]:mt-0"><Pagination page={visibleEventPage} pageSize={EVENT_PAGE_SIZE} total={filteredEvents.length} onChange={setEventsPage} label="Admin event pages" /></div>}>
        <div className="managed-events-grid-admin admin-event-page-grid stretch-page-grid grid min-w-0 flex-1 grid-cols-1 items-stretch gap-4 xl:grid-cols-3" data-testid="admin-event-page">
          {pagedEvents.map((event) => (
            <ManagedEventCard key={event._id} event={event} actions={
                <div className="grid grid-cols-2 items-center gap-2">

                  <Button
                    onClick={() => navigate(`/admin/dashboard/events/${event._id}`)}
                    variant="secondary"
                    size="sm"
                  >
                    <FaEdit className="text-xs" /> Edit event
                  </Button>
                  <Button
                    onClick={() => openEventDetails(event)}
                    variant="secondary"
                    size="sm"
                  >
                    Attendance
                  </Button>
                  <Button
                    onClick={() => setDeleteTarget(event._id)}
                    variant="danger"
                    size="sm"
                    className="col-span-2"
                  >
                    Delete
                  </Button>
                </div>
            } />
          ))}
        </div>
        </StablePage>
        </div>
      ))}

      {showModal && selectedEvent && (
        <div role="dialog" aria-modal="true" aria-labelledby="event-monitor-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="portal-card flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-[var(--panel-radius)] border border-line bg-card shadow-[var(--elev-3)]">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line p-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 id="event-monitor-title" className="font-display text-xl font-semibold tracking-tight text-on">
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
                onClick={() => { attendeeRequest.current += 1; setShowModal(false); }}
                variant="ghost"
                size="icon"
                aria-label="Close event details"
              >
                <MdClose />
              </Button>
            </div>
            <div className="min-h-0 overflow-y-auto p-5">
              <h4 className="panel-heading text-base">
                Attendance records ({attendeeQuery ? `${matchingAttendees.length} of ${attendees.length}` : attendees.length})
              </h4>
              <label htmlFor="attendee-search" className="field-label mt-4">Search attendance records</label>
              <input id="attendee-search" type="search" className="field mb-4" placeholder="Search by student name or email" value={attendeeSearch} onChange={e => { setAttendeeSearch(e.target.value); setAttendeePage(1); }} disabled={attendeesLoading || attendeesError} />
              {attendeesLoading ? <TableSkeleton rows={3} cols={2} /> : attendeesError ? <EmptyState compact title="Attendance unavailable" description="These event records could not be loaded. Try again." action={<Button size="sm" variant="secondary" onClick={() => fetchAttendees(selectedEvent._id)}>Try again</Button>} /> : attendees.length === 0 ? (
                <EmptyState
                  compact
                  icon={<FaUsers />}
                  title="No attendance records yet"
                  description="Records will appear here after an organizer takes attendance."
                />
              ) : !matchingAttendees.length ? <EmptyState compact title="No matching attendance records" description="Try another name or email address." action={<Button variant="ghost" size="sm" onClick={() => setAttendeeSearch("")}>Clear search</Button>} /> : (
                <StablePage pageKey={`event-attendees:${selectedEvent._id}:${attendeeQuery}`} footer={<Pagination page={currentAttendeePage} pageSize={5} total={matchingAttendees.length} onChange={setAttendeePage} label="Event attendance pages" />}><div className="mt-4 space-y-2">
                  {visibleAttendees.map((attendee) => (
                    <div
                      key={attendee._id}
                      className="portal-card flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-card-alt/40 p-3.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-on">
                          {attendee.student?.name}
                        </p>
                        <p className="truncate text-xs text-on-dim">
                          {attendee.student?.email}
                        </p>
                      </div>
                      <StatusChip status={attendee.status} />
                    </div>
                  ))}
                </div></StablePage>
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

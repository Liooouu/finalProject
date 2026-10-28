import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import { useAutoRefresh } from "../../utils/useAutoRefresh";
import { usePageMeta } from "../../context/PageMetaContext";
import { BaseCard, Button, StatusChip } from "../ui";
import EmptyState from "../shared/EmptyState";
import Loading from "../shared/Loading";
import { formatDate, formatTime12Hour, isTerminalStatus } from "../../utils/helpers";
import { FaCamera, FaClipboardList, FaCalendarAlt, FaEnvelopeOpenText } from "react-icons/fa";
import CheckInStation from "./CheckInStation";
import OpenFaceStationButton from "./OpenFaceStationButton";

export default function OrganizerHome() {
  const [events, setEvents] = useState([]);
  const [letters, setLetters] = useState([]);
  const [showStationControls, setShowStationControls] = useState(false);
  const [faceEventId, setFaceEventId] = useState("");
  const [manualEventId, setManualEventId] = useState("");
  const [loading, setLoading] = useState(true);
  const [eventsError, setEventsError] = useState(false);
  const [lettersError, setLettersError] = useState(false);
  usePageMeta("Dashboard", "Your next event and requests needing review.");
  const refresh = useCallback(() => Promise.allSettled([api.get("/events/my-events"), api.get("/organizer/excuses")]).then(([eventResult, letterResult]) => {
    if (eventResult.status === "fulfilled") { setEvents(eventResult.value.data); setEventsError(false); } else setEventsError(true);
    if (letterResult.status === "fulfilled") { setLetters(letterResult.value.data); setLettersError(false); } else setLettersError(true);
    setLoading(false);
  }), []);
  useEffect(() => { refresh(); }, [refresh]);
  useAutoRefresh(refresh);
  if (loading) return <Loading label="Loading organizer dashboard..." />;
  const active = events.filter(event => !isTerminalStatus(event.status)).sort((a, b) => (a.status === "live" ? 0 : 1) - (b.status === "live" ? 0 : 1) || new Date(a.date) - new Date(b.date));
  const next = active[0];
  const faceEvent = active.find(event => event._id === faceEventId) || next;
  const manualEvents = [...events].sort((a, b) => new Date(b.date) - new Date(a.date));
  const manualEvent = events.find(event => event._id === manualEventId) || next || manualEvents[0];
  const pending = letters.filter(letter => letter.status === "pending");
  const cardClass = "flex min-w-0 flex-col overflow-hidden [&>.fd-rail]:shrink-0";
  const bodyClass = "flex min-h-0 flex-1 flex-col gap-2";
  return <div className="space-y-3">
    <header className="fd-surface fd-command fd-glass overflow-hidden" style={{ "--fd-accent": "var(--brand)" }} data-testid="organizer-page-header">
      <div className="fd-rail fd-rail-command">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="fd-rail-icon" aria-hidden="true"><FaCalendarAlt /></span>
          <div className="min-w-0"><h1 className="fd-title">Organizer dashboard</h1><p className="fd-subtitle">Record attendance, manage events, and review requests.</p></div>
        </div>
        <Button as={Link} to="/organizer/dashboard/events?create=1" size="sm" variant="secondary" className="shrink-0">Create event</Button>
      </div>
    </header>
    {eventsError && <div role="alert" className="alert alert-danger">Events could not be refreshed. <button onClick={() => refresh()} className="underline">Try again</button></div>}
    <div className="grid auto-rows-fr items-stretch gap-3 md:grid-cols-2" data-testid="organizer-dashboard-cards">
      <BaseCard title="Face station" eyebrow="01 · Primary attendance" icon={<FaCamera />} className={`${cardClass} border-brand/40`} bodyClassName={bodyClass}>
        <p className="text-sm text-on-dim">Verify students by face and record their attendance.</p>
        {faceEvent ? <>
          <label className="text-xs text-on-muted">Event<select aria-label="Face station event" value={faceEvent._id} onChange={e => { setFaceEventId(e.target.value); setShowStationControls(false); }} className="field-select mt-1 w-full">{active.map(event => <option key={event._id} value={event._id}>{event.title}</option>)}</select></label>
          <p className="text-xs text-on-muted">Attendance window: {formatTime12Hour(faceEvent.attendanceStartTime) || "TBA"} – {formatTime12Hour(faceEvent.attendanceEndTime) || "TBA"}</p>
          <div className="mt-auto flex flex-wrap items-start gap-2 border-t border-line pt-3">
            <OpenFaceStationButton key={faceEvent._id} eventId={faceEvent._id} />
            <Button onClick={() => setShowStationControls(value => !value)} aria-expanded={showStationControls} size="sm" variant="ghost">{showStationControls ? "Hide station controls" : "Station controls"}</Button>
          </div>
          {showStationControls && <CheckInStation key={faceEvent._id} eventId={faceEvent._id} controlsOnly />}
        </> : <EmptyState compact title={eventsError ? "Events unavailable" : "No event ready for face attendance"} description={eventsError ? "Try loading your events again." : "Create or reopen an event to use the face station."} />}
      </BaseCard>
      <BaseCard title="Manual attendance" eyebrow="02 · Record adjustments" icon={<FaClipboardList />} className={cardClass} bodyClassName={bodyClass}>
        <p className="text-sm text-on-dim">Add or correct attendance and adjust service hours.</p>
        {manualEvent ? <>
          <label className="text-xs text-on-muted">Event<select aria-label="Manual attendance event" value={manualEvent._id} onChange={e => setManualEventId(e.target.value)} className="field-select mt-1 w-full">{manualEvents.map(event => <option key={event._id} value={event._id}>{event.title}</option>)}</select></label>
          <p className="text-xs text-on-muted">Includes past events for reviewing and correcting records.</p>
          <div className="mt-auto border-t border-line pt-3"><Button as={Link} to={`/organizer/dashboard/manual-attendance/${manualEvent._id}`} variant="secondary" size="sm">Open manual attendance</Button></div>
        </> : <EmptyState compact title={eventsError ? "Events unavailable" : "No attendance records to manage"} description="Choose an event here once one has been created." />}
      </BaseCard>
      <BaseCard title={next?.status === "live" ? "Live event" : "Next event"} eyebrow="03 · Event overview" icon={<FaCalendarAlt />} className={cardClass} bodyClassName={bodyClass}>
        {next ? <>
          <div className="flex flex-wrap items-start justify-between gap-2"><h2 className="min-w-0 flex-1 font-display text-base font-semibold text-on [overflow-wrap:anywhere]">{next.title}</h2><StatusChip status={next.status} /></div>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div><dt className="text-xs text-on-muted">Starts</dt><dd className="text-on-dim">{formatDate(next.date)} at {formatTime12Hour(next.time) || "Time TBA"}</dd></div>
            <div><dt className="text-xs text-on-muted">Ends</dt><dd className="text-on-dim">{formatDate(next.endDate || next.date)} at {formatTime12Hour(next.endTime || "23:59")}</dd></div>
            <div className="col-span-2"><dt className="text-xs text-on-muted">Venue</dt><dd className="text-on-dim [overflow-wrap:anywhere]">{next.location || "Venue TBA"}</dd></div>
          </dl>
          <div className="mt-auto border-t border-line pt-3"><Button as={Link} to="/organizer/dashboard/events" variant="ghost" size="sm">View events</Button></div>
        </> : <><EmptyState compact title={eventsError ? "Events unavailable" : "No upcoming events"} description={eventsError ? "Try loading your events again." : "Create an event to get started."} /><div className="mt-auto"><Button as={Link} to="/organizer/dashboard/events" variant="ghost" size="sm">View events</Button></div></>}
      </BaseCard>
      <BaseCard title="Excuse letters" eyebrow="04 · Requests to review" icon={<FaEnvelopeOpenText />} className={cardClass} bodyClassName={bodyClass}>
        {lettersError && <p role="alert" className="text-xs text-danger">Letters could not be refreshed. <button onClick={() => refresh()} className="underline">Try again</button></p>}
        {!lettersError || letters.length ? <>
          <p className="text-sm text-on-dim"><strong className="num text-lg text-on">{pending.length}</strong> waiting for review</p>
          {pending.length ? <ul className="divide-y divide-line">{pending.slice(0, 2).map(letter => <li key={letter._id} className="py-2"><p className="text-sm font-medium text-on">{letter.student?.name || "Student"}</p><p className="mt-0.5 text-xs text-on-muted [overflow-wrap:anywhere]">{letter.event?.title || "Event unavailable"}</p></li>)}</ul> : <p className="text-xs text-on-muted">You’re all caught up.</p>}
        </> : <p className="text-sm text-on-muted">Review count unavailable.</p>}
        <div className="mt-auto border-t border-line pt-3"><Button as={Link} to="/organizer/dashboard/excuses" variant="secondary" size="sm">Review letters</Button></div>
      </BaseCard>
    </div>
  </div>;
}

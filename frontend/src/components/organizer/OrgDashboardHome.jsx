import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import { useAutoRefresh } from "../../utils/useAutoRefresh";
import { usePageMeta } from "../../context/PageMetaContext";
import Pagination from "../ui/Pagination";
import StablePage from "../ui/StablePage";
import { BaseCard, Button, StatusChip } from "../ui";
import EmptyState from "../shared/EmptyState";
import Loading from "../shared/Loading";
import { formatDate, formatTime12Hour, isTerminalStatus } from "../../utils/helpers";
import { FaCamera, FaClipboardList, FaCalendarAlt, FaEnvelopeOpenText } from "react-icons/fa";
import OpenFaceStationButton from "./OpenFaceStationButton";
import { readScreen, writeScreen } from "../../utils/queryCache";

const CACHE_KEY = "organizer:home:manual-requests-v1";

export default function OrganizerHome() {
  const seed = readScreen(CACHE_KEY);
  const [events, setEvents] = useState(seed?.events ?? []);
  const [letters, setLetters] = useState(seed?.letters ?? []);
  const [eventPage, setEventPage] = useState(1);
  const [faceEventId, setFaceEventId] = useState("");
  const [loading, setLoading] = useState(seed === undefined);
  const [eventsError, setEventsError] = useState(seed?.eventsError ?? false);
  const [lettersError, setLettersError] = useState(seed?.lettersError ?? false);
  const [manualSummary, setManualSummary] = useState(seed?.manualSummary ?? null);
  const [manualError, setManualError] = useState(seed?.manualError ?? false);
  usePageMeta("Dashboard", "Live and upcoming events and requests needing review.");
  const refresh = useCallback(() => Promise.allSettled([api.get("/events/all"), api.get("/organizer/excuses"), api.get("/manual-attendance/summary")]).then(([eventResult, letterResult, manualResult]) => {
    const previous = readScreen(CACHE_KEY) || {};
    const next = { ...previous };
    if (eventResult.status === "fulfilled") {
      setEvents(eventResult.value.data);
      setEventsError(false);
      next.events = eventResult.value.data;
      next.eventsError = false;
    } else {
      setEventsError(true);
      next.eventsError = true;
    }
    if (letterResult.status === "fulfilled") {
      setLetters(letterResult.value.data);
      setLettersError(false);
      next.letters = letterResult.value.data;
      next.lettersError = false;
    } else {
      setLettersError(true);
      next.lettersError = true;
    }
    if (manualResult.status === "fulfilled") {
      setManualSummary(manualResult.value.data);
      setManualError(false);
      next.manualSummary = manualResult.value.data;
      next.manualError = false;
    } else {
      setManualError(true);
      next.manualError = true;
    }
    writeScreen(CACHE_KEY, next);
    setLoading(false);
  }), []);
  useEffect(() => { refresh(); }, [refresh]);
  useAutoRefresh(refresh, { interval: 30000 });
  if (loading) return <Loading label="Loading organizer dashboard..." />;
  const active = events.filter(event => !isTerminalStatus(event.status)).sort((a, b) => (a.status === "live" ? 0 : 1) - (b.status === "live" ? 0 : 1) || new Date(a.date) - new Date(b.date));
  const next = active[0];
  const eventPageSize = 3;
  const currentEventPage = Math.min(eventPage, Math.max(1, Math.ceil(active.length / eventPageSize)));
  const visibleEvents = active.slice((currentEventPage - 1) * eventPageSize, currentEventPage * eventPageSize);
  const faceEvent = active.find(event => event._id === faceEventId) || next;
  const pending = letters.filter(letter => letter.status === "pending" && letter.canReview !== false);
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
    <div className="organizer-home-grid grid grid-cols-2 items-stretch gap-3" data-testid="organizer-dashboard-cards">
      <BaseCard title="Live & upcoming events" eyebrow="01 · Event overview" icon={<FaCalendarAlt />} className={`${cardClass} organizer-upcoming-card col-span-2`} bodyClassName={bodyClass}>
        {active.length ? <StablePage pageKey={`organizer-upcoming:${active.length}`} fill className="flex-1" footer={<>
            <Pagination page={currentEventPage} pageSize={eventPageSize} total={active.length} onChange={setEventPage} label="Upcoming event pages" />
            <Button as={Link} to="/organizer/dashboard/events" variant="ghost" size="sm" className="mt-3">View events</Button>
          </>}>
          <div className="stretch-page-list gap-3">
            {visibleEvents.map(event => <article key={event._id} className="portal-inset organizer-event-box flex flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-2"><h2 className="min-w-0 flex-1 font-display text-base font-semibold text-on [overflow-wrap:anywhere]">{event.title}</h2><StatusChip status={event.status} /></div>
              {event.description && <div className="text-sm text-on-dim [overflow-wrap:anywhere]"><p className="line-clamp-3 whitespace-pre-wrap leading-relaxed">{event.description}</p>{event.description.length > 160 && <details className="mt-2"><summary className="cursor-pointer text-xs font-medium text-brand">Full description</summary><p className="mt-2 whitespace-pre-wrap leading-relaxed">{event.description}</p></details>}</div>}
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-xs text-on-muted">Starts</dt><dd className="text-on-dim">{formatDate(event.date)} at {formatTime12Hour(event.time) || "Time TBA"}</dd></div>
                <div><dt className="text-xs text-on-muted">Ends</dt><dd className="text-on-dim">{formatDate(event.endDate || event.date)} at {formatTime12Hour(event.endTime || "23:59")}</dd></div>
                <div className="col-span-2"><dt className="text-xs text-on-muted">Venue</dt><dd className="text-on-dim [overflow-wrap:anywhere]">{event.location || "Venue TBA"}</dd></div>
              </dl>
              <dl className="mt-auto grid gap-3 border-t border-line pt-3 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-on-muted">Attendance window</dt><dd className="mt-1 text-on-dim">{formatTime12Hour(event.attendanceStartTime) || "TBA"} – {formatTime12Hour(event.attendanceEndTime) || "TBA"}</dd></div>
                <div><dt className="text-xs text-on-muted">Organized by</dt><dd className="mt-1 text-on-dim [overflow-wrap:anywhere]">{event.organizer?.name || "Organizer TBA"}</dd></div>
              </dl>
            </article>)}
          </div>
        </StablePage> : <><EmptyState compact title={eventsError ? "Events unavailable" : "No upcoming events"} description={eventsError ? "Try loading your events again." : "Create an event to get started."} /><div className="mt-auto"><Button as={Link} to="/organizer/dashboard/events" variant="ghost" size="sm">View events</Button></div></>}
      </BaseCard>
      <BaseCard title="Face station" eyebrow="02 · Primary attendance" icon={<FaCamera />} className={`${cardClass} organizer-attendance-card organizer-face-card border-brand/40`} bodyClassName={bodyClass}>
        {faceEvent ? <>
          <div className="portal-inset organizer-event-box"><label className="text-xs text-on-muted">Event<select aria-label="Face station event" value={faceEvent._id} onChange={e => { setFaceEventId(e.target.value); }} className="field-select mt-1 w-full">{active.map(event => <option key={event._id} value={event._id}>{event.title}</option>)}</select></label>
          <p className="mt-3 text-xs text-on-muted"><span className="block">Attendance:</span><span className="mt-1 block">{formatTime12Hour(faceEvent.attendanceStartTime) || "TBA"} – {formatTime12Hour(faceEvent.attendanceEndTime) || "TBA"}</span></p>
          <div className="organizer-station-actions mt-3 flex flex-wrap items-start gap-2">
            <OpenFaceStationButton key={faceEvent._id} eventId={faceEvent._id} />
          </div>
          </div>
        </> : <EmptyState compact title={eventsError ? "Events unavailable" : "No event ready for face attendance"} description={eventsError ? "Try loading your events again." : "Create or reopen an event to use the face station."} />}
      </BaseCard>
      <BaseCard title="Manual attendance" eyebrow="03 · Record adjustments" icon={<FaClipboardList />} className={`${cardClass} organizer-attendance-card organizer-manual-card`} bodyClassName={bodyClass}>
        <Link to="/organizer/dashboard/manual-attendance" className="portal-inset portal-action-box organizer-review-box flex-1" aria-label="Open manual attendance">
          <FaClipboardList aria-hidden="true" className="text-2xl text-brand" />
          <span className="text-sm font-medium text-on">Open manual attendance →</span>
          <span className="text-xs text-on-muted">Verify the student and submit for review.</span>
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs">
          <Link to="/organizer/dashboard/manual-reviews?view=mine" className="font-medium text-on-dim hover:text-on">{manualSummary ? `${manualSummary.pendingMine || 0} submitted · pending` : "My submitted requests"}</Link>
          <Link to="/organizer/dashboard/manual-reviews?view=review" className="font-medium text-brand">{manualSummary?.pendingReview ? `${manualSummary.pendingReview} to review →` : "Assigned reviews →"}</Link>
        </div>
        {manualError && <p className="text-xs text-on-muted">Request counts could not refresh. <button onClick={() => refresh()} className="underline">Retry</button></p>}
      </BaseCard>
      <BaseCard title="Excuse letters" eyebrow="04 · Requests to review" icon={<FaEnvelopeOpenText />} className={`${cardClass} organizer-excuses-card col-span-2`} bodyClassName={bodyClass}>
        {lettersError && <p role="alert" className="text-xs text-danger">Letters could not be refreshed. <button onClick={() => refresh()} className="underline">Try again</button></p>}
        {!lettersError || letters.length ? <>
          <Link to="/organizer/dashboard/excuses" className="portal-inset portal-action-box organizer-review-box flex-1" aria-label="Review letters"><span className="text-xs text-on-dim">Waiting for review</span><strong className="num text-on">{pending.length}</strong><span className="text-xs text-brand">Review letters →</span></Link>
          {pending.length ? <ul className="divide-y divide-line">{pending.slice(0, 2).map(letter => <li key={letter._id} className="py-2"><p className="text-sm font-medium text-on">{letter.student?.name || "Student"}</p><p className="mt-0.5 text-xs text-on-muted [overflow-wrap:anywhere]">{letter.event?.title || "Event unavailable"}</p></li>)}</ul> : <p className="text-xs text-on-muted">You’re all caught up.</p>}
        </> : <p className="text-sm text-on-muted">Review count unavailable.</p>}
        {lettersError && !letters.length && <div className="mt-auto pt-3"><Button as={Link} to="/organizer/dashboard/excuses" variant="secondary" size="sm">Review letters</Button></div>}
      </BaseCard>
    </div>
  </div>;
}

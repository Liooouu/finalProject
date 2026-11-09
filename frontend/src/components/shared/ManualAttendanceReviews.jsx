import AttendanceReviewCard from "./AttendanceReviewCard";
import EventReviewers from "../admin/EventReviewers";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { FaClipboardCheck, FaSearch } from "react-icons/fa";
import api from "../../api/axios";
import { getUserRole } from "../../utils/auth";
import { useAutoRefresh } from "../../utils/useAutoRefresh";
import { usePageMeta } from "../../context/PageMetaContext";
import { Button, Card, PageHeader, SegmentedControl } from "../ui";
import Pagination from "../ui/Pagination";
import StablePage from "../ui/StablePage";
import EmptyState from "./EmptyState";
import Loading from "./Loading";

const PAGE_SIZE = 6;
const errorMessage = (error, fallback) => error.response?.data?.error || error.response?.data?.message || fallback;

export default function ManualAttendanceReviews({ defaultView = "mine" }) {
  const isAdmin = getUserRole() === "admin";
  const location = useLocation();
  const [view, setView] = useState(() => {
    if (isAdmin) return "review";
    const requested = new URLSearchParams(location.search).get("view");
    return ["mine", "review"].includes(requested) ? requested : defaultView;
  });
  const [status, setStatus] = useState("pending");
  const [eventId, setEventId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignmentEvent, setAssignmentEvent] = useState("");
  const [events, setEvents] = useState([]);
  const [eventError, setEventError] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [requests, setRequests] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [note, setNote] = useState("");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [outcomeErrors, setOutcomeErrors] = useState([]);
  const feedback = useRef(null);
  const requestSequence = useRef(0);
  const mounted = useRef(true);
  const reviewInFlight = useRef(false);

  usePageMeta("Manual attendance review", "Verify manual check-ins and attendance corrections.");

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; requestSequence.current += 1; }; }, []);
  useEffect(() => {
    if (search.trim() === query) return undefined;
    const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); setSelected(new Set()); setVerified(false); }, 250);
    return () => clearTimeout(timer);
  }, [search, query]);

  const loadEvents = useCallback(async () => {
    try {
      const { data } = await api.get(!isAdmin && view === "mine" ? "/events/all" : "/manual-attendance/review-events");
      if (!mounted.current) return;
      setEvents(Array.isArray(data) ? data : []);
      setEventError("");
    } catch (error) {
      if (mounted.current) setEventError(errorMessage(error, "Event choices could not be loaded."));
    }
  }, [isAdmin, view]);
  useEffect(() => { loadEvents(); }, [loadEvents]);

  const loadRequests = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setRefreshing(true);
    try {
      const { data } = await api.get("/manual-attendance/requests", { params: { view, status, eventId: eventId || undefined, search: query || undefined, page, limit: PAGE_SIZE } });
      if (!mounted.current || sequence !== requestSequence.current) return;
      const rows = data.requests || [];
      setRequests(rows);
      setTotal(Number(data.total) || 0);
      setLoadError("");
      setSelected(previous => new Set([...previous].filter(id => rows.some(row => row._id === id && row.status === "pending" && row.canReview))));
      const lastPage = Math.max(1, Math.ceil((Number(data.total) || 0) / PAGE_SIZE));
      if (page > lastPage) setPage(lastPage);
    } catch (error) {
      if (mounted.current && sequence === requestSequence.current) setLoadError(errorMessage(error, "Manual attendance requests could not be loaded."));
    } finally {
      if (mounted.current && sequence === requestSequence.current) { setLoading(false); setRefreshing(false); }
    }
  }, [eventId, page, query, status, view]);
  useEffect(() => { loadRequests(); return () => { requestSequence.current += 1; }; }, [loadRequests]);
  useAutoRefresh(loadRequests, { interval: 30000, enabled: !busy });
  useEffect(() => {
    if (busy || !(message || actionError || outcomeErrors.length)) return;
    feedback.current?.focus({ preventScroll: true });
    feedback.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [busy, message, actionError, outcomeErrors]);

  const resetSelection = () => { setSelected(new Set()); setVerified(false); setNote(""); setOutcomeErrors([]); };
  const clearFilters = () => { setSearch(""); setQuery(""); setEventId(""); setStatus("all"); setPage(1); resetSelection(); };
  const changeFilter = (setter, value) => { setter(value); setPage(1); resetSelection(); };
  const toggleRequest = id => {
    setSelected(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    setVerified(false); setActionError("");
  };
  const reviewSelected = async (decision, individual) => {
    const selectedIds = individual ? [individual.id] : [...selected];
    const confirmed = individual ? individual.verified : verified;
    const reviewNote = (individual ? individual.note : note).trim();
    if (reviewInFlight.current || !selectedIds.length) return false;
    if (decision === "approved" && !confirmed) { setActionError("Confirm that you checked the attendance evidence for every selected student."); return false; }
    if (decision === "rejected" && reviewNote.length < 5) { setActionError("Add a review note of at least 5 characters explaining why these requests are rejected."); return false; }
    reviewInFlight.current = true;
    setBusy(decision); setActionError(""); setMessage(""); setOutcomeErrors([]);
    // A refresh started before this decision must not clear its selection or
    // replace the result. Fetch fresh rows explicitly after the review finishes.
    requestSequence.current += 1;
    setRefreshing(false);
    const names = new Map(requests.map(row => [row._id, row.student?.name || row.student?.email || "Student"]));
    try {
      const { data } = await api.post("/manual-attendance/requests/review", { ids: selectedIds, decision, note: reviewNote, verifiedPresence: decision === "approved" && confirmed });
      if (!mounted.current) return;
      const results = Array.isArray(data.results) ? data.results : [];
      const completed = results.filter(result => result.status === decision && !result.error);
      const errors = results.filter(result => result.error || result.status !== decision).map(result => ({ id: result.id, message: result.error || "This request was not updated. Refresh and try again." }));
      for (const id of selectedIds) if (!results.some(result => String(result.id) === String(id))) errors.push({ id, message: "No result was returned for this request. Refresh before retrying." });
      setOutcomeErrors(errors.map(item => ({ ...item, name: names.get(item.id) || "Student" })));
      const existingCount = completed.filter(result => result.keptExistingAttendance).length;
      setMessage(completed.length ? `${completed.length} request${completed.length === 1 ? "" : "s"} ${decision}.${decision === "approved" ? `${completed.length > existingCount ? " Attendance uses the recorded check-in time, even when reviewed after the event." : ""}${existingCount ? ` ${existingCount} already matched face attendance; the existing time and service hours were kept.` : ""}` : ""}` : "");
      setSelected(new Set(errors.map(item => item.id))); setVerified(false); setNote("");
      window.dispatchEvent(new Event("tracked:manual-attendance-changed"));
      await loadRequests();
      return individual ? completed.some(result => String(result.id) === String(individual.id)) : completed.length > 0;
    } catch (error) { if (mounted.current) setActionError(errorMessage(error, "The selected requests could not be reviewed. Refresh before retrying.")); }
    finally { reviewInFlight.current = false; if (mounted.current) setBusy(false); }
  };

  const currentPage = Math.min(page, Math.max(1, Math.ceil(total / PAGE_SIZE)));
  const selectedRows = requests.filter(row => selected.has(row._id));
  const eligibleIds = view === "review" ? requests.filter(row => row.status === "pending" && row.canReview === true).map(row => row._id) : [];
  const selectedEligibleCount = eligibleIds.filter(id => selected.has(id)).length;
  const allOnPageSelected = eligibleIds.length > 0 && selectedEligibleCount === eligibleIds.length;
  const someOnPageSelected = selectedEligibleCount > 0 && !allOnPageSelected;
  const eventMissingFromChoices = eventId && !events.some(event => event._id === eventId);

  const reviewActions = <Card as="section" aria-label="Review selected requests" className="manual-review-actions space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-medium text-on">Review {selected.size === 1 ? "attendance request" : `${selected.size} selected requests`}</h3><Button variant="ghost" size="sm" onClick={resetSelection} disabled={busy}>Clear selection</Button></div>
      <p className="text-xs text-on-dim">{selectedRows.map(row => row.student?.name || row.student?.email || "Student").join(", ")}</p>
      <label className="flex items-start gap-3 rounded-xl bg-card-alt/40 p-3 text-sm text-on-dim"><input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand-solid)]" checked={verified} onChange={event => setVerified(event.target.checked)} disabled={busy} /><span>I checked the evidence and attendance time for all selected students.</span></label>
      <div><label htmlFor="manual-review-note" className="field-label">Review note <span className="font-normal text-on-muted">(at least 5 characters when rejecting)</span></label><textarea id="manual-review-note" className="field min-h-20 resize-y" maxLength={1000} placeholder="Reason for rejection, or an optional note." value={note} onChange={event => setNote(event.target.value)} disabled={busy} /></div>
      <div className="flex flex-col gap-2 sm:flex-row"><Button variant="success" onClick={() => reviewSelected("approved")} disabled={!!busy || !verified} loading={busy === "approved"}>{busy === "approved" ? "Approving..." : selected.size === 1 ? "Approve attendance" : "Approve selected"}</Button><Button variant="danger" onClick={() => reviewSelected("rejected")} disabled={!!busy || note.trim().length < 5} loading={busy === "rejected"}>{busy === "rejected" ? "Rejecting..." : selected.size === 1 ? "Reject request" : "Reject selected"}</Button></div>
    </Card>;

  return <div className="manual-review-page space-y-4">
    <PageHeader eyebrow="Attendance exceptions" title={view === "mine" ? "My attendance requests" : "ID attendance & corrections"} subtitle={view === "review" ? "Check the evidence, then approve or reject. Capture time determines attendance." : "Track your submissions and review decisions."} actions={<div className="flex flex-wrap gap-2">{isAdmin && <Button size="sm" onClick={() => { setAssignmentEvent(eventId); setAssigning(value => !value); }} aria-expanded={assigning} aria-controls="attendance-reviewer-assignment">{assigning ? "Close assignment" : "Assign reviewers"}</Button>}<Button variant="secondary" size="sm" onClick={() => { loadRequests(); loadEvents(); }} disabled={refreshing || busy}>Refresh</Button></div>} />
    {isAdmin && <p className="text-sm text-on-muted">Assign organizers to review requests for this event. Reviewers can decide requests for other students, including requests they submitted.</p>}
    {isAdmin && assigning && <section id="attendance-reviewer-assignment" aria-label="Assign attendance reviewers" className="space-y-3">
      <Card><label className="field-label" htmlFor="assignment-event">Event</label><select id="assignment-event" className="field-select w-full" value={assignmentEvent} onChange={event => setAssignmentEvent(event.target.value)}><option value="">Select an event</option>{events.map(event => <option key={event._id} value={event._id}>{event.title}</option>)}</select><p className="mt-2 text-xs text-on-muted">Organizer access applies to this event only.</p>{eventError && <p role="alert" className="mt-2 text-sm text-danger">{eventError}</p>}</Card>
      {assignmentEvent && <EventReviewers key={assignmentEvent} eventId={assignmentEvent} expanded />}
    </section>}
    {!isAdmin && <SegmentedControl ariaLabel="Manual request views" value={view} onChange={value => { if (!busy) changeFilter(setView, value); }} options={[{ value: "review", label: "Assigned events" }, { value: "mine", label: "My requests" }]} />}
    {loadError && <div role="alert" className="alert alert-danger"><p>{loadError}</p><Button variant="secondary" size="sm" onClick={loadRequests} disabled={refreshing || busy}>Try again</Button></div>}
    <Card className="manual-review-filters">
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,.65fr)]">
        <div className="min-w-0"><label className="field-label" htmlFor="manual-review-search">Search student</label><div className="relative"><FaSearch aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-on-muted" /><input id="manual-review-search" type="search" className="field field-search min-w-0" placeholder="Student name or email" value={search} onChange={event => setSearch(event.target.value)} disabled={busy} /></div></div>
        <div className="min-w-0"><label className="field-label" htmlFor="manual-review-event">Event</label><select id="manual-review-event" className="field-select w-full min-w-0" value={eventId} onChange={event => changeFilter(setEventId, event.target.value)} disabled={busy}><option value="">All events</option>{eventMissingFromChoices && <option value={eventId}>Selected event</option>}{events.map(event => <option key={event._id} value={event._id}>{event.title}</option>)}</select>{eventError && <p className="mt-1 text-xs text-danger">{eventError}</p>}</div>
        <div><label className="field-label" htmlFor="manual-review-status">Request status</label><select id="manual-review-status" className="field-select w-full" value={status} onChange={event => changeFilter(setStatus, event.target.value)} disabled={busy}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="all">All statuses</option></select></div>
      </div>
      {(search || eventId || status !== "all") && <Button className="mt-3" variant="ghost" size="sm" onClick={clearFilters} disabled={busy}>Reset filters</Button>}
    </Card>
    <section aria-label="Manual attendance requests" aria-busy={refreshing} className="attendance-review-results min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-medium text-on">{total} request{total === 1 ? "" : "s"}</h3><p className="text-xs text-on-muted">Times shown in Philippine time</p></div>
      {view === "review" && eligibleIds.length > 0 && <label className="mb-3 flex min-h-11 w-fit cursor-pointer items-center gap-3 text-sm text-on">
        <input type="checkbox" className="h-5 w-5 shrink-0 accent-[var(--brand-solid)]" ref={node => { if (node) node.indeterminate = someOnPageSelected; }} checked={allOnPageSelected} disabled={loading || refreshing || !!busy || !!loadError} onChange={event => { setSelected(event.target.checked ? new Set(eligibleIds) : new Set()); setVerified(false); setActionError(""); setOutcomeErrors([]); }} />
        <span>Select all on this page <span className="text-on-muted">({eligibleIds.length})</span></span>
      </label>}
      <StablePage loading={refreshing} pageKey={`${view}:${status}:${eventId}:${query}:${total}`} footer={<Pagination page={currentPage} pageSize={PAGE_SIZE} total={total} onChange={value => { setPage(value); resetSelection(); }} disabled={refreshing || busy} label="Manual attendance request pages" />}>
      {loading ? <Loading label="Loading manual attendance requests..." /> : !requests.length ? <EmptyState compact icon={<FaClipboardCheck />} title={loadError ? "Requests unavailable" : "No matching requests"} description={view === "mine" ? "Your submitted attendance requests will appear here." : "Manual requests for assigned events will appear here."} /> : <ul className="attendance-review-grid">{requests.map(request => <li key={request._id}><AttendanceReviewCard key={`${request._id}:${request.status}`} request={request} reviewMode={view === "review"} selected={selected.has(request._id)} onToggle={() => toggleRequest(request._id)} onReview={reviewSelected} busy={!!busy} /></li>)}</ul>}
      </StablePage>
    </section>
    {view === "review" && selected.size > 0 && reviewActions}
    {(message || actionError || outcomeErrors.length > 0) && <section ref={feedback} tabIndex={-1} aria-label="Review result" className="space-y-3 rounded-xl focus-visible:outline-2 focus-visible:outline-brand">
      {message && <div role="status" className="alert alert-ok"><p>{message}</p></div>}
      {actionError && <div role="alert" className="alert alert-danger"><p>{actionError}</p></div>}
      {outcomeErrors.length > 0 && <Card className="space-y-2" role="alert"><h3 className="text-sm font-medium text-danger">{message ? "Some requests need attention" : "Requests were not updated"}</h3><ul className="space-y-2 text-sm text-on-dim">{outcomeErrors.map(item => <li key={item.id}><span className="font-medium text-on">{item.name}: </span>{item.message}</li>)}</ul></Card>}
      <Button variant="ghost" size="sm" onClick={() => { setMessage(""); setActionError(""); setOutcomeErrors([]); }}>Dismiss result</Button>
    </section>}
  </div>;
}

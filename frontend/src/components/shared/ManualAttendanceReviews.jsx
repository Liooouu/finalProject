import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { FaClipboardCheck, FaSearch } from "react-icons/fa";
import api from "../../api/axios";
import { getUserRole } from "../../utils/auth";
import { formatDateTime } from "../../utils/helpers";
import { useAutoRefresh } from "../../utils/useAutoRefresh";
import { usePageMeta } from "../../context/PageMetaContext";
import { Button, Card, PageHeader, SegmentedControl, StatusChip } from "../ui";
import Pagination from "../ui/Pagination";
import StablePage from "../ui/StablePage";
import EmptyState from "./EmptyState";
import Loading from "./Loading";

const PAGE_SIZE = 10;
const errorMessage = (error, fallback) => error.response?.data?.error || error.response?.data?.message || fallback;
const displayTime = value => value ? formatDateTime(value) : "—";

export default function ManualAttendanceReviews() {
  const isAdmin = getUserRole() === "admin";
  const location = useLocation();
  const [view, setView] = useState(() => !isAdmin && new URLSearchParams(location.search).get("view") !== "review" ? "mine" : "review");
  const [status, setStatus] = useState("pending");
  const [eventId, setEventId] = useState("");
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
  const requestSequence = useRef(0);
  const mounted = useRef(true);

  usePageMeta("Manual attendance review", "Verify manual check-ins and attendance corrections.");

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; requestSequence.current += 1; }; }, []);
  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); setSelected(new Set()); setVerified(false); }, 250);
    return () => clearTimeout(timer);
  }, [search]);

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
  useAutoRefresh(loadRequests, { interval: 30000 });

  const resetSelection = () => { setSelected(new Set()); setVerified(false); setNote(""); setOutcomeErrors([]); };
  const clearFilters = () => { setSearch(""); setQuery(""); setEventId(""); setStatus("all"); setPage(1); resetSelection(); };
  const changeFilter = (setter, value) => { setter(value); setPage(1); resetSelection(); };
  const toggleRequest = id => {
    setSelected(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    setVerified(false); setActionError("");
  };
  const reviewSelected = async decision => {
    if (busy || !selected.size) return;
    if (decision === "approved" && !verified) { setActionError("Confirm that you independently checked the attendance evidence for every selected student."); return; }
    if (decision === "rejected" && note.trim().length < 5) { setActionError("Add a review note of at least 5 characters explaining why these requests are rejected."); return; }
    setBusy(true); setActionError(""); setMessage(""); setOutcomeErrors([]);
    const selectedIds = [...selected];
    try {
      const { data } = await api.post("/manual-attendance/requests/review", { ids: selectedIds, decision, note: note.trim(), verifiedPresence: decision === "approved" && verified });
      if (!mounted.current) return;
      const results = data.results || [];
      const completed = results.filter(result => result.status === decision && !result.error);
      const errors = results.filter(result => result.error || result.status !== decision).map(result => ({ id: result.id, message: result.error || "This request was not updated. Refresh and try again." }));
      for (const id of selectedIds) if (!results.some(result => String(result.id) === String(id))) errors.push({ id, message: "No result was returned for this request. Refresh before retrying." });
      setOutcomeErrors(errors);
      setMessage(completed.length ? `${completed.length} request${completed.length === 1 ? "" : "s"} ${decision}. Attendance uses the verified check-in time.` : "No requests were updated.");
      setSelected(new Set(errors.map(item => item.id))); setVerified(false); setNote("");
      window.dispatchEvent(new Event("tracked:manual-attendance-changed"));
      await loadRequests();
    } catch (error) { if (mounted.current) setActionError(errorMessage(error, "The selected requests could not be reviewed. Refresh before retrying.")); }
    finally { if (mounted.current) setBusy(false); }
  };

  const currentPage = Math.min(page, Math.max(1, Math.ceil(total / PAGE_SIZE)));
  const selectedRows = requests.filter(row => selected.has(row._id));
  const eventMissingFromChoices = eventId && !events.some(event => event._id === eventId);

  return <div className="manual-review-page space-y-4">
    <PageHeader eyebrow="Attendance exceptions" title={view === "mine" ? "My attendance requests" : "Manual attendance review"} subtitle="Verified check-in time determines attendance. Reviewing later does not add a late penalty." actions={<Button variant="secondary" size="sm" onClick={() => { loadRequests(); loadEvents(); }} disabled={refreshing || busy}>Refresh</Button>} />
    {!isAdmin && <SegmentedControl ariaLabel="Manual request views" value={view} onChange={value => { if (!busy) changeFilter(setView, value); }} options={[{ value: "review", label: "Assigned reviews" }, { value: "mine", label: "My requests" }]} />}
    {message && <div role="status" className="alert alert-ok"><p>{message}</p></div>}
    {(loadError || actionError) && <div role="alert" className="alert alert-danger"><p>{actionError || loadError}</p>{loadError && <Button variant="secondary" size="sm" onClick={loadRequests} disabled={refreshing}>Try again</Button>}</div>}
    {!!outcomeErrors.length && <Card className="space-y-2" role="alert"><h3 className="text-sm font-medium text-danger">Some requests need attention</h3><ul className="space-y-1 text-sm text-on-dim">{outcomeErrors.map(item => <li key={item.id}>{requests.find(row => row._id === item.id)?.student?.name || "Request"}: {item.message}</li>)}</ul></Card>}
    <Card className="manual-review-filters">
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,.65fr)]">
        <div className="min-w-0"><label className="field-label" htmlFor="manual-review-search">Search student</label><div className="relative"><FaSearch aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-on-muted" /><input id="manual-review-search" type="search" className="field field-search min-w-0" placeholder="Student name or email" value={search} onChange={event => setSearch(event.target.value)} disabled={busy} /></div></div>
        <div className="min-w-0"><label className="field-label" htmlFor="manual-review-event">Event</label><select id="manual-review-event" className="field-select w-full min-w-0" value={eventId} onChange={event => changeFilter(setEventId, event.target.value)} disabled={busy}><option value="">All events</option>{eventMissingFromChoices && <option value={eventId}>Selected event</option>}{events.map(event => <option key={event._id} value={event._id}>{event.title}</option>)}</select>{eventError && <p className="mt-1 text-xs text-danger">{eventError}</p>}</div>
        <div><label className="field-label" htmlFor="manual-review-status">Request status</label><select id="manual-review-status" className="field-select w-full" value={status} onChange={event => changeFilter(setStatus, event.target.value)} disabled={busy}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="all">All statuses</option></select></div>
      </div>
      {(search || eventId || status !== "all") && <Button className="mt-3" variant="ghost" size="sm" onClick={clearFilters} disabled={busy}>Clear filters · show all requests</Button>}
    </Card>
    <section aria-label="Manual attendance requests" aria-busy={refreshing} className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-medium text-on">{total} request{total === 1 ? "" : "s"}</h3><p className="text-xs text-on-muted">Times shown in Philippine time</p></div>
      <StablePage loading={refreshing} pageKey={`${view}:${status}:${eventId}:${query}:${total}`} footer={<Pagination page={currentPage} pageSize={PAGE_SIZE} total={total} onChange={value => { setPage(value); resetSelection(); }} disabled={refreshing || busy} label="Manual attendance request pages" />}>
      {loading ? <Loading label="Loading manual attendance requests..." /> : !requests.length ? <EmptyState compact icon={<FaClipboardCheck />} title={loadError ? "Requests unavailable" : "No matching requests"} description={view === "mine" ? "Your submitted attendance requests will appear here." : "Requests assigned for your review will appear here."} /> : <ul className="space-y-3">{requests.map(request => {
        const selectable = view === "review" && request.status === "pending" && request.canReview === true;
        return <li key={request._id}><Card as="article" className={`manual-review-record min-w-0 ${selected.has(request._id) ? "ring-2 ring-brand/50" : ""}`}>
          <div className="flex min-w-0 items-start gap-3">
            {selectable && <input type="checkbox" aria-label={`Select verified request for ${request.student?.name || request.student?.email || "student"}`} className="mt-1 h-5 w-5 shrink-0 accent-[var(--brand-solid)]" checked={selected.has(request._id)} onChange={() => toggleRequest(request._id)} disabled={busy} />}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0 [overflow-wrap:anywhere]"><h4 className="font-display text-base font-semibold text-on">{request.student?.name || "Student unavailable"}</h4><p className="mt-0.5 text-xs text-on-muted">{request.student?.email || "Email unavailable"}</p></div><StatusChip status={request.status} /></div>
              <p className="mt-3 text-sm font-medium text-on [overflow-wrap:anywhere]">{request.event?.title || "Event unavailable"}</p>
              <dl className="mt-3 grid grid-cols-1 gap-x-5 gap-y-3 text-sm sm:grid-cols-2 xl:grid-cols-4"><div><dt className="text-xs text-on-muted">{request.proposedStatus === "absent" ? "Attendance cutoff" : request.mode === "correction" ? "Claimed check-in" : "Recorded check-in"}</dt><dd className="mt-1 font-medium text-on">{displayTime(request.effectiveAt)}</dd></div><div><dt className="text-xs text-on-muted">Attendance if approved</dt><dd className="mt-1 flex flex-wrap items-center gap-2"><StatusChip status={request.proposedStatus} /><span className="text-xs text-on-dim">{request.proposedHours ?? 0} penalty hrs</span></dd></div><div><dt className="text-xs text-on-muted">Submitted</dt><dd className="mt-1 text-on-dim">{displayTime(request.submittedAt)}</dd></div><div><dt className="text-xs text-on-muted">Submitted by</dt><dd className="mt-1 text-on-dim [overflow-wrap:anywhere]">{request.requestedBy?.name || "Organizer"}</dd></div></dl>
              <p className="mt-3 whitespace-pre-wrap text-sm text-on-dim [overflow-wrap:anywhere]"><span className="font-medium text-on">Reason: </span>{request.reason}</p>
              {request.mode === "correction" && <p className="mt-2 text-xs text-warn">Correction request · verify the claimed attendance time before approval.</p>}
              {request.status === "pending" && !selectable && <p className="mt-2 text-xs text-on-muted">{view === "mine" ? "An independent reviewer must handle this request." : "You cannot review your own submission or attendance, or you are not assigned to this event."}</p>}
              <details className="mt-3 text-xs text-on-muted"><summary className="cursor-pointer font-medium text-on-dim">Review details</summary><dl className="mt-2 grid gap-2 sm:grid-cols-2"><div><dt>Reviewed</dt><dd className="mt-0.5">{displayTime(request.reviewedAt)}</dd></div><div><dt>Reviewed by</dt><dd className="mt-0.5 [overflow-wrap:anywhere]">{request.reviewedBy?.name || "Not reviewed yet"}</dd></div>{request.schedule?.start && <div><dt>Recorded attendance window</dt><dd className="mt-0.5">{displayTime(request.schedule.start)} – {displayTime(request.schedule.deadline)}</dd></div>}{request.schedule?.cutoff && <div><dt>Last accepted check-in</dt><dd className="mt-0.5">{displayTime(request.schedule.cutoff)}</dd></div>}</dl>{(request.reviewNote || request.note) && <p className="mt-2 whitespace-pre-wrap [overflow-wrap:anywhere]">{request.reviewNote || request.note}</p>}</details>
            </div>
          </div>
        </Card></li>;
      })}</ul>}
      </StablePage>
    </section>
    {view === "review" && selected.size > 0 && <Card as="section" aria-label="Review selected requests" className="manual-review-actions space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-medium text-on">Review {selected.size} selected request{selected.size === 1 ? "" : "s"}</h3><Button variant="ghost" size="sm" onClick={resetSelection} disabled={busy}>Clear selection</Button></div>
      <p className="text-xs text-on-dim">{selectedRows.map(row => row.student?.name || row.student?.email || "Student").join(", ")}</p>
      <label className="flex items-start gap-3 rounded-xl bg-card-alt/40 p-3 text-sm text-on-dim"><input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand-solid)]" checked={verified} onChange={event => setVerified(event.target.checked)} disabled={busy} /><span>I independently verified physical attendance and any claimed arrival time for Present/Late requests, and verified absence for Absent requests, for every selected student.</span></label>
      <div><label htmlFor="manual-review-note" className="field-label">Review note <span className="font-normal text-on-muted">(at least 5 characters when rejecting)</span></label><textarea id="manual-review-note" className="field min-h-20 resize-y" maxLength={1000} placeholder="Explain a rejection or add useful verification details." value={note} onChange={event => setNote(event.target.value)} disabled={busy} /></div>
      <div className="flex flex-col gap-2 sm:flex-row"><Button onClick={() => reviewSelected("approved")} disabled={busy || refreshing || !verified} loading={busy}>Approve selected</Button><Button variant="danger" onClick={() => reviewSelected("rejected")} disabled={busy || refreshing || note.trim().length < 5}>Reject selected</Button></div>
    </Card>}
  </div>;
}

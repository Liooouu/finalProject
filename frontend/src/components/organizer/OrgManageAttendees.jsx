import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaSearch, FaTimes, FaUserCheck, FaUsers } from "react-icons/fa";
import api from "../../api/axios";
import { formatDateTime, isTerminalStatus } from "../../utils/helpers";
import { getUserFromToken } from "../../utils/auth";
import { useAutoRefresh } from "../../utils/useAutoRefresh";
import { readScreen, writeScreen } from "../../utils/queryCache";
import { usePageMeta } from "../../context/PageMetaContext";
import { Button, Card, PageHeader, SegmentedControl, StatusChip } from "../ui";
import Pagination from "../ui/Pagination";
import StablePage from "../ui/StablePage";
import EmptyState from "../shared/EmptyState";
import Loading from "../shared/Loading";

const REASONS = ["Face not recognised", "Camera unavailable", "Student declined face capture", "Attendance correction", "Other"];
const studentIdOf = value => String(value?.student?._id || value?.student || "");
const manilaInput = value => value && Number.isFinite(new Date(value).getTime())
  ? new Date(new Date(value).getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 16) : "";
const PAGE_SIZE = 5;

export default function OrgManageAttendees({ embedded = false, event }) {
  const { id: eventId } = useParams();
  const currentUserId = String(getUserFromToken()?.id || "");
  const cacheKey = `attendees:requests-v1:${eventId}`;
  const seed = readScreen(cacheKey);
  const navigate = useNavigate();
  const location = useLocation();
  const searchRef = useRef(null);
  const requestSequence = useRef(0);
  const [students, setStudents] = useState(seed?.students || []);
  const [attendees, setAttendees] = useState(seed?.attendees || []);
  const [loading, setLoading] = useState(seed === undefined);
  const [loadError, setLoadError] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [studentPage, setStudentPage] = useState(1);
  const [recordPage, setRecordPage] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [mode, setMode] = useState("checkin");
  const [correctionStatus, setCorrectionStatus] = useState("auto");
  const [effectiveAt, setEffectiveAt] = useState("");
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [identityChecked, setIdentityChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [requests, setRequests] = useState([]);
  const [requestTotal, setRequestTotal] = useState(0);
  const [requestPage, setRequestPage] = useState(1);
  const [requestStatus, setRequestStatus] = useState("all");
  const [requestsError, setRequestsError] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [panel, setPanel] = useState("checkin");

  usePageMeta(embedded ? "Manual attendance" : "Attendance desk", "Submit verified check-ins for independent review.");

  const fetchData = useCallback(async () => {
    try {
      const [studentsRes, attendeesRes] = await Promise.all([
        api.get("/admin/users?role=student"), api.get(`/events/${eventId}/attendees`),
      ]);
      const next = { students: studentsRes.data || [], attendees: attendeesRes.data || [] };
      setStudents(next.students); setAttendees(next.attendees); setLoadError(false);
      writeScreen(cacheKey, next);
    } catch { setLoadError(true); }
    finally { setLoading(false); }
  }, [cacheKey, eventId]);

  const fetchRequests = useCallback(async () => {
    const sequence = ++requestSequence.current;
    try {
      const { data } = await api.get("/manual-attendance/requests", { params: {
        eventId, view: "mine", status: requestStatus, page: requestPage, limit: PAGE_SIZE,
      } });
      if (sequence !== requestSequence.current) return;
      const clampedPage = Math.min(Number(data.page) || requestPage, Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE)));
      if (clampedPage !== requestPage) { setRequestTotal(data.total || 0); setRequestPage(clampedPage); return; }
      setRequests(data.requests || []); setRequestTotal(data.total || 0); setRequestsError(false);
    } catch { if (sequence === requestSequence.current) setRequestsError(true); }
    finally { if (sequence === requestSequence.current) setRequestsLoading(false); }
  }, [eventId, requestPage, requestStatus]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setRequestsLoading(true); fetchRequests(); }, [fetchRequests]);
  const refresh = useCallback(() => Promise.allSettled([fetchData(), fetchRequests()]), [fetchData, fetchRequests]);
  useAutoRefresh(refresh, { interval: 30000 });

  const query = searchTerm.trim().toLowerCase();
  const matches = student => !query || [student?.name, student?.email].some(value => String(value || "").toLowerCase().includes(query));
  const matchingStudents = students.filter(matches);
  const currentStudentPage = Math.min(studentPage, Math.max(1, Math.ceil(matchingStudents.length / PAGE_SIZE)));
  const visibleStudents = matchingStudents.slice((currentStudentPage - 1) * PAGE_SIZE, currentStudentPage * PAGE_SIZE);
  const matchingAttendees = attendees.filter(record => matches(record.student));
  const currentRecordPage = Math.min(recordPage, Math.max(1, Math.ceil(matchingAttendees.length / 10)));
  const pendingIds = new Set([
    ...requests.filter(request => request.status === "pending").map(studentIdOf),
    ...attendees.filter(record => record.manualReviewPending || record.pendingManualRequest).map(studentIdOf),
  ]);
  const selectedRecord = attendees.find(record => studentIdOf(record) === String(selectedStudent?._id));
  const isSelf = String(selectedStudent?._id) === currentUserId;
  const isProtected = selectedRecord?.method === "face" || selectedRecord?.status === "excused";
  const isPending = pendingIds.has(String(selectedStudent?._id));
  const needsDetails = mode === "correction" || reason === "Other";

  const selectStudent = (student, forceCorrection = false) => {
    if (!student?._id) return;
    setPanel("checkin");
    const record = attendees.find(item => studentIdOf(item) === String(student._id));
    const correction = forceCorrection || isTerminalStatus(event?.status) || ["present", "late"].includes(record?.status);
    setSelectedStudent(student); setMode(correction ? "correction" : "checkin");
    setCorrectionStatus("auto"); setEffectiveAt(record?.status !== "absent" ? manilaInput(record?.attendedAt) : "");
    if (correction) setReason("Attendance correction");
    setDetails(""); setIdentityChecked(false); setMessage(null);
  };

  const submit = async e => {
    e.preventDefault();
    if (submitting || !selectedStudent || isSelf || isPending || isProtected) return;
    if (!reason || !identityChecked || (needsDetails && details.trim().length < 10)) {
      setMessage({ error: true, text: "Choose a reason, complete the required details, and confirm the identity check." }); return;
    }
    const payload = { eventId, studentId: selectedStudent._id, mode,
      reason: `${reason}${details.trim() ? ` — ${details.trim()}` : ""}`, identityChecked: true };
    if (mode === "correction") {
      if (correctionStatus === "absent") payload.requestedStatus = "absent";
      else {
        const instant = new Date(`${effectiveAt}:00+08:00`);
        if (!effectiveAt || !Number.isFinite(instant.getTime()) || instant > new Date()) {
          setMessage({ error: true, text: "Enter a valid past attendance date and time in Philippine time." }); return;
        }
        payload.effectiveAt = instant.toISOString();
      }
    }
    setSubmitting(true); setMessage(null);
    try {
      const { data } = await api.post("/manual-attendance/requests", payload);
      const request = data.request || data;
      setMessage({ error: false, text: `${selectedStudent.name}: request submitted for review. ${request.proposedStatus === "absent" ? "Absence cutoff" : "Check-in recorded"}: ${formatDateTime(request.effectiveAt)}. Approval time will not change this attendance time.` });
      setSelectedStudent(null); setIdentityChecked(false); setDetails(""); setRequestPage(1); setRequestStatus("all");
      // Keep the last reason and search results so the next person needs fewer steps.
      await Promise.allSettled([fetchData(), requestPage === 1 && requestStatus === "all" ? fetchRequests() : Promise.resolve()]);
      searchRef.current?.focus();
    } catch (err) {
      setMessage({ error: true, text: err.response?.data?.error || err.response?.data?.message || "The request could not be submitted. Please try again." });
      if (err.response?.status === 409) refresh();
    } finally { setSubmitting(false); }
  };

  if (loading) return <Loading label="Loading attendance desk..." />;

  return <div className="min-w-0 space-y-4">
    {!embedded && <PageHeader title="Attendance desk" subtitle="Verify the student, then submit a check-in for review."
      actions={<Button variant="secondary" size="sm" onClick={() => location.key && location.key !== "default" ? navigate(-1) : navigate(`/organizer/dashboard/events/${eventId}`)}><FaArrowLeft /> Back to event</Button>} />}
    {loadError && <div role="alert" className="alert alert-danger">Attendance could not be refreshed. <button className="underline" onClick={fetchData}>Try again</button></div>}
    {message && <div role={message.error ? "alert" : "status"} className={`alert ${message.error ? "alert-danger" : "alert-ok"}`}><p className="min-w-0 [overflow-wrap:anywhere]">{message.text}</p></div>}
    <SegmentedControl ariaLabel="Attendance desk views" className="manual-desk-tabs" value={panel} onChange={setPanel} options={[{value:"checkin",label:"Check in"},{value:"requests",label:"My requests",shortLabel:"Requests",count:requestTotal},{value:"records",label:"Attendance records",shortLabel:"Records",count:attendees.length}]} />
    {panel === "checkin" && <Card className="min-w-0">
        <div className="flex items-start gap-3"><FaUserCheck className="mt-1 shrink-0 text-brand" aria-hidden="true" /><div className="min-w-0"><h2 className="panel-heading">Manual check-in</h2><p className="mt-1 text-sm text-on-muted">Find a student, check their ID, then submit for review.</p></div></div>
        <div className="mt-4">
          <label htmlFor="attendee-search" className="field-label">Search student</label>
          <div className="relative"><FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-on-muted" aria-hidden="true" /><input ref={searchRef} id="attendee-search" type="search" placeholder="Name or email" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setStudentPage(1); setRecordPage(1); }} className="field field-search w-full" /></div>
        </div>
        {selectedStudent ? <form onSubmit={submit} className="manual-desk-form mt-4 space-y-4">
          <div className="flex items-start justify-between gap-3 border-b border-line pb-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-on [overflow-wrap:anywhere]">{selectedStudent.name}</p>{selectedRecord && <StatusChip status={selectedRecord.status} />}</div><p className="mt-1 text-sm text-on-dim [overflow-wrap:anywhere]">{selectedStudent.email}</p></div><button type="button" aria-label="Clear selection" disabled={submitting} onClick={() => { setSelectedStudent(null); setIdentityChecked(false); }} className="shrink-0 rounded-lg p-2 text-on-dim hover:text-on"><FaTimes /></button></div>
          {isSelf || isPending || isProtected ? <p role="status" className="text-sm text-on-dim">{isSelf ? "Another organizer must handle your attendance. You cannot manually mark your own record." : isPending ? "A request is already waiting for review for this student and event." : "This record is face verified or covered by an approved excuse. It cannot be overwritten at the manual desk."}</p> : <>
            <div className={`grid items-start gap-5 ${mode === "correction" ? "md:grid-cols-2" : ""}`}>
            <div className="min-w-0 space-y-4">
              <div><label htmlFor="manual-reason" className="field-label">Reason</label><select id="manual-reason" className="field-select w-full" required value={reason} onChange={e => setReason(e.target.value)} disabled={submitting}><option value="">Choose a reason</option>{REASONS.map(value => <option key={value}>{value}</option>)}</select></div>
              {(needsDetails || details) && <div><label htmlFor="manual-details" className="field-label">Verification details {needsDetails ? "(required)" : ""}</label><textarea id="manual-details" className="field min-h-32 w-full resize-y" minLength={needsDetails ? 10 : undefined} maxLength={800} required={needsDetails} value={details} onChange={e => setDetails(e.target.value)} disabled={submitting} placeholder="What happened, and how was attendance verified?" /><p className="mt-1 text-xs text-on-muted">Include at least 10 characters. An independent reviewer checks this information.</p></div>}
            </div>
            <details open={mode === "correction"} className="min-w-0 rounded-xl bg-card-alt/30 p-4" onToggle={e => { if (!submitting) setMode(e.currentTarget.open ? "correction" : "checkin"); }}>
              <summary className="cursor-pointer text-sm font-medium text-on">Correct an earlier record</summary>
              <div className="mt-3 space-y-3">
                <label className="field-label" htmlFor="manual-correction-result">Correction type</label><select id="manual-correction-result" className="field-select w-full" value={correctionStatus} onChange={e => setCorrectionStatus(e.target.value)} disabled={submitting}><option value="auto">Student attended — use attendance time</option><option value="absent">Student was absent — after event cutoff</option></select>
                {correctionStatus === "auto" && <div><label htmlFor="manual-effective-at" className="field-label">Actual attendance date and time (Philippine time)</label><input id="manual-effective-at" type="datetime-local" className="field w-full min-w-0" value={effectiveAt} max={manilaInput(new Date())} onChange={e => setEffectiveAt(e.target.value)} required={mode === "correction" && correctionStatus === "auto"} disabled={submitting} /></div>}
                <p className="text-xs text-on-muted">Explain how this earlier attendance was verified. A reviewer must confirm the correction.</p>
              </div>
            </details>
            </div>
            <div className="space-y-3 border-t border-line pt-4">
            <label className="flex cursor-pointer items-start gap-3 text-sm text-on-dim"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand-solid)]" checked={identityChecked} onChange={e => setIdentityChecked(e.target.checked)} disabled={submitting} required /><span>{mode === "checkin" ? "I checked this student’s school ID and physical presence at the event." : "I checked this student’s identity and the supporting attendance information."}</span></label>
            {mode === "checkin" && <p className="text-xs text-on-muted">Check-in time is recorded automatically when you submit, in Philippine time. Present or Late is calculated from the event’s attendance window.</p>}
            <Button type="submit" className="w-full sm:w-auto" loading={submitting} disabled={!reason || !identityChecked || (needsDetails && details.trim().length < 10)}>{mode === "checkin" ? "Submit check-in" : "Submit correction"}</Button>
            </div>
          </>}
        </form> : matchingStudents.length ? <StablePage pageKey={`manual-search:${eventId}:${query}:${matchingStudents.length}`} footer={<Pagination page={currentStudentPage} pageSize={PAGE_SIZE} total={matchingStudents.length} onChange={setStudentPage} label="Student search pages" />}>
          <ul className="mt-4 space-y-2">{visibleStudents.map(student => {
            const self = String(student._id) === currentUserId;
            const pending = pendingIds.has(String(student._id));
            const record = attendees.find(item => studentIdOf(item) === String(student._id));
            const academic = [student.program, student.yearLevel ? `Year ${student.yearLevel}` : "", student.section ? `Section ${student.section}` : ""].filter(Boolean).join(" · ");
            return <li key={student._id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-card-alt/30 p-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]"><div className="min-w-0"><p className="text-sm font-medium text-on [overflow-wrap:anywhere]">{student.name}</p><p className="text-xs text-on-dim [overflow-wrap:anywhere]">{student.email}</p>{academic && <p className="mt-1 text-xs text-on-muted sm:hidden">{academic}</p>}{self && <p className="mt-1 text-xs text-on-muted">Your account — another organizer must record it</p>}</div><div className="hidden min-w-0 space-y-1 sm:block">{academic && <p className="text-xs text-on-muted [overflow-wrap:anywhere]">{academic}</p>}{pending ? <span className="text-xs text-info">Pending review</span> : record ? <StatusChip status={record.status} /> : <span className="text-xs text-on-dim">Not recorded</span>}</div><Button variant="secondary" size="sm" type="button" disabled={self || pending} onClick={() => selectStudent(student)}>Select</Button>{pending && <p className="col-span-2 text-xs text-info sm:hidden">Pending review</p>}</li>;
          })}</ul>
        </StablePage> : <EmptyState compact icon={<FaUsers />} title="No matching students" description="Try another name or email." />}
      </Card>}
      {panel === "requests" && <Card className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="panel-heading">My submitted requests</h2><Link to="/organizer/dashboard/manual-reviews?view=review" className="text-sm font-medium text-brand">Review assigned requests →</Link></div>
        <p className="mt-1 text-sm text-on-muted">The recorded attendance time is kept even when review happens later.</p>
        <div className="mt-4"><label className="sr-only" htmlFor="manual-request-status">Request status</label><select id="manual-request-status" className="field-select w-full sm:w-auto" value={requestStatus} onChange={e => { setRequestStatus(e.target.value); setRequestPage(1); }}><option value="all">All requests</option><option value="pending">Pending review</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></div>
        {requestsError && <p role="alert" className="mt-3 text-sm text-danger">Requests could not be refreshed. <button onClick={fetchRequests} className="underline">Try again</button></p>}
        <StablePage loading={requestsLoading} pageKey={`manual-history:${eventId}:${requestStatus}:${requestTotal}`} footer={<Pagination page={Math.min(requestPage, Math.max(1, Math.ceil(requestTotal / PAGE_SIZE)))} pageSize={PAGE_SIZE} total={requestTotal} onChange={setRequestPage} disabled={requestsLoading} label="My attendance request pages" />}>
        {requestsLoading ? <p role="status" className="py-6 text-sm text-on-muted">Loading requests…</p> : requests.length ? <ul className="mt-4 space-y-3">{requests.map(request => <li key={request._id} className="rounded-xl bg-card-alt/30 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="text-sm font-medium text-on [overflow-wrap:anywhere]">{request.student?.name || "Student"}</p><p className="text-xs text-on-muted [overflow-wrap:anywhere]">{request.student?.email || ""}</p></div><StatusChip status={request.status} /></div>
          <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2"><div><dt className="text-on-muted">{request.proposedStatus === "absent" ? "Absence cutoff" : "Attendance time"}</dt><dd className="mt-0.5 text-on-dim">{formatDateTime(request.effectiveAt)}</dd></div><div><dt className="text-on-muted">Submitted</dt><dd className="mt-0.5 text-on-dim">{formatDateTime(request.submittedAt)}</dd></div><div><dt className="text-on-muted">Requested result</dt><dd className="mt-0.5 capitalize text-on-dim">{request.proposedStatus} · {request.proposedHours ?? 0} penalty hrs</dd></div>{request.reviewedAt && <div><dt className="text-on-muted">Reviewed</dt><dd className="mt-0.5 text-on-dim">{formatDateTime(request.reviewedAt)}{request.reviewedBy?.name && ` · ${request.reviewedBy.name}`}</dd></div>}</dl>
          <p className="mt-3 whitespace-pre-wrap text-sm text-on-dim [overflow-wrap:anywhere]">{request.reason}</p>{request.reviewNote && <p className="mt-2 text-xs text-on-muted [overflow-wrap:anywhere]">Reviewer note: {request.reviewNote}</p>}
        </li>)}</ul> : !requestsError && <EmptyState compact title="No requests here yet" description="Your submitted requests for this event will appear here." />}
        </StablePage>
      </Card>}
    {panel === "records" && <Card className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="panel-heading">Attendance records ({matchingAttendees.length})</h2><p className="mt-1 text-sm text-on-muted">Confirmed records stay unchanged until a correction is approved.</p></div></div>
      <label className="field-label mt-4" htmlFor="record-search">Find an attendance record</label><input id="record-search" type="search" className="field w-full" placeholder="Student name or email" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setRecordPage(1); }} />
      <StablePage pageKey={`manual-records:${eventId}:${query}:${matchingAttendees.length}`} footer={<Pagination page={currentRecordPage} pageSize={10} total={matchingAttendees.length} onChange={setRecordPage} label="Attendance record pages" />}>
      {matchingAttendees.length ? <ul className="mt-4 space-y-2">{matchingAttendees.slice((currentRecordPage - 1) * 10, currentRecordPage * 10).map(record => {
        const student = record.student;
        const self = studentIdOf(record) === currentUserId;
        const pending = pendingIds.has(studentIdOf(record));
        const protectedRecord = record.method === "face" || record.status === "excused";
        return <li key={record._id} className="flex flex-col justify-between gap-3 rounded-xl bg-card-alt/30 p-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="text-sm font-medium text-on [overflow-wrap:anywhere]">{student?.name || "Student"}</p><p className="text-xs text-on-dim [overflow-wrap:anywhere]">{student?.email || ""}</p><p className="mt-1 text-xs text-on-muted">{record.method === "face" ? "Face verified" : record.method === "auto" ? "Automatic record" : "Manual record"}{record.attendedAt ? ` · ${formatDateTime(record.attendedAt)}` : ""}</p>{pending && <p className="mt-1 text-xs text-warn">Manual request pending review; automatic absence is provisional.</p>}{self && <p className="mt-1 text-xs text-on-muted">Another organizer must handle your record.</p>}</div><div className="flex flex-wrap items-center gap-3"><StatusChip status={record.status} /><span className="text-xs text-on-muted">{record.communityServiceHours || 0} hrs</span>{!protectedRecord && <Button type="button" variant="secondary" size="sm" disabled={self || pending} onClick={() => { selectStudent(student, true); window.requestAnimationFrame(() => searchRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })); }}>Request correction</Button>}</div></li>;
      })}</ul> : <EmptyState compact title={query ? "No matching records" : "No attendance records yet"} description="Find a student above to submit a manual check-in." />}
      </StablePage>
    </Card>}
  </div>;
}

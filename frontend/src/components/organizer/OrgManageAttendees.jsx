import SessionAttendanceDetails from "../shared/SessionAttendanceDetails";
import { usePortalBack } from "../../utils/usePortalBack";
import IdPhotoCheckin from "./IdPhotoCheckin";
import IdPhotoEvidence from "../shared/IdPhotoEvidence";
import { useTransientState } from "../../utils/useTransientState";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FaArrowLeft, FaUserCheck } from "react-icons/fa";
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
const attendancePair = value => `${studentIdOf(value)}:${value?.session?._id || value?.session || ""}`;
const PAGE_SIZE = 5;

export default function OrgManageAttendees({ embedded = false, event }) {
  const { id: eventId } = useParams();
  const currentUserId = String(getUserFromToken()?.id || "");
  const cacheKey = `attendees:requests-v1:${eventId}`;
  const seed = readScreen(cacheKey);
  const { back: goBack } = usePortalBack(`/organizer/dashboard/events/${eventId}`);
  const requestSequence = useRef(0);
  const [attendees, setAttendees] = useState(seed?.attendees || []);
  const [loading, setLoading] = useState(seed === undefined);
  const [loadError, setLoadError] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [recordPage, setRecordPage] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [correctionAction, setCorrectionAction] = useState("time_in");
  const [mode, setMode] = useState("checkin");
  const [correctionStatus, setCorrectionStatus] = useState("auto");
  const [effectiveAt, setEffectiveAt] = useState("");
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [identityChecked, setIdentityChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useTransientState(null);
  const [requests, setRequests] = useState([]);
  const [requestTotal, setRequestTotal] = useState(0);
  const [requestPage, setRequestPage] = useState(1);
  const [requestStatus, setRequestStatus] = useState("all");
  const [requestsError, setRequestsError] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [panel, setPanel] = useState("checkin");

  usePageMeta(embedded ? "Manual attendance" : "Attendance desk", "Capture ID-assisted check-ins; corrections remain independently reviewed.");

  const fetchData = useCallback(async () => {
    try {
      const attendeesRes = await api.get(`/events/${eventId}/attendees`);
      const next = { attendees: attendeesRes.data || [] };
      setAttendees(next.attendees); setLoadError(false);
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
  const matchingAttendees = attendees.filter(record => matches(record.student));
  const currentRecordPage = Math.min(recordPage, Math.max(1, Math.ceil(matchingAttendees.length / PAGE_SIZE)));
  const pendingIds = new Set([
    ...requests.filter(request => request.status === "pending").map(attendancePair),
    ...attendees.filter(record => record.manualReviewPending || record.pendingManualRequest).map(attendancePair),
  ]);
  const selectedRecord = selectedStudent?._attendance || attendees.find(record => studentIdOf(record) === String(selectedStudent?._id));
  const isSelf = String(selectedStudent?._id) === currentUserId;
  const canChangeRecordedStatus = ["manual", "id_photo"].includes(selectedRecord?.method) && ["absent", "present", "late"].includes(selectedRecord?.status);
  const isProtected = selectedRecord?.status === "excused" || (selectedRecord?.method === "face" && !(selectedRecord.session && selectedRecord.timeInAt && !selectedRecord.timeOutAt && correctionAction === "time_out"));
  const isPending = pendingIds.has(attendancePair({ student: selectedStudent?._id, session: selectedRecord?.session }));
  const needsDetails = mode === "correction" || reason === "Other";

  const selectStudent = (student, forceCorrection = false) => {
    if (!student?._id) return;
    const record = student._attendance || attendees.find(item => studentIdOf(item) === String(student._id));
    const correction = forceCorrection && record && ["absent", "present", "late"].includes(record.status) && (record.method !== "face" || (record.session && record.timeInAt && !record.timeOutAt));
    if (forceCorrection && !correction) return;
    if (!correction && (isTerminalStatus(event?.status) || ["present", "late", "excused"].includes(record?.status) || record?.method === "face")) return;
    setCorrectionAction(record?.method === "face" && record?.session ? "time_out" : "time_in");
    setPanel(correction ? "correction" : "checkin");
    setSelectedStudent(student); setMode(correction ? "correction" : "checkin");
    setCorrectionStatus("auto"); setEffectiveAt(record?.status !== "absent" ? manilaInput(record?.method === "face" && record?.session ? record.timeOutAt : record?.attendedAt) : "");
    setReason(correction ? "Attendance correction" : "");
    setDetails(""); setIdentityChecked(false); setMessage(null);
  };

  const submit = async e => {
    e.preventDefault();
    if (submitting || !selectedStudent || isSelf || isPending || isProtected) return;
    if (mode === "correction" && !["absent", "present", "late"].includes(selectedRecord?.status)) return;
    if (!reason || !identityChecked || (needsDetails && details.trim().length < 10)) {
      setMessage({ error: true, text: "Choose a reason, complete the required details, and confirm the identity check." }); return;
    }
    const payload = { eventId, studentId: selectedStudent._id, sessionId: selectedRecord?.session || undefined, action: correctionAction, mode,
      reason: `${reason}${details.trim() ? ` — ${details.trim()}` : ""}`, identityChecked: true };
    if (mode === "correction") {
      if (canChangeRecordedStatus && correctionStatus === "absent") payload.requestedStatus = "absent";
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
      setSelectedStudent(null); setPanel(mode === "correction" ? "records" : "checkin"); setIdentityChecked(false); setDetails(""); setRequestPage(1); setRequestStatus("all");
      // Keep the last reason and search results so the next person needs fewer steps.
      await Promise.allSettled([fetchData(), requestPage === 1 && requestStatus === "all" ? fetchRequests() : Promise.resolve()]);
    } catch (err) {
      setMessage({ error: true, text: err.response?.data?.error || err.response?.data?.message || "The request could not be submitted. Please try again." });
      if (err.response?.status === 409) refresh();
    } finally { setSubmitting(false); }
  };

  if (loading && panel !== "checkin") return <Loading label="Loading attendance desk..." />;

  return <div className="min-w-0 space-y-4">
    {!embedded && <PageHeader title="Attendance desk" subtitle="Verify the student, then submit a check-in for review."
      actions={<Button variant="secondary" size="sm" onClick={goBack}><FaArrowLeft /> Back to event</Button>} />}
    {loadError && <div role="alert" className="alert alert-danger">Attendance could not be refreshed. <button className="underline" onClick={fetchData}>Try again</button></div>}
    {message && <div role={message.error ? "alert" : "status"} className={`alert ${message.error ? "alert-danger" : "alert-ok"}`}><p className="min-w-0 [overflow-wrap:anywhere]">{message.text}</p></div>}
    <SegmentedControl ariaLabel="Attendance desk views" className="manual-desk-tabs" value={panel === "correction" ? "records" : panel} onChange={value => { if (submitting) return; setPanel(value); setSelectedStudent(null); setIdentityChecked(false); setMode("checkin"); }} options={[{value:"checkin",label:"Check in"},{value:"requests",label:"My requests",shortLabel:"Requests",count:requestTotal},{value:"records",label:"Attendance records",shortLabel:"Records",count:attendees.length}]} />
    {panel === "checkin" && <IdPhotoCheckin event={event} attendees={attendees} onRecorded={refresh} onViewRecords={() => setPanel("records")} />}
    {panel === "correction" && <Card className="min-w-0">
        <div className="flex items-start gap-3"><FaUserCheck className="mt-1 shrink-0 text-brand" aria-hidden="true" /><div className="min-w-0"><h2 className="panel-heading">{panel === "correction" ? "Correct attendance record" : "Manual check-in"}</h2><p className="mt-1 text-sm text-on-muted">{panel === "correction" ? "Submit corrected information for independent review." : "Find a student, check their ID, then submit for review."}</p></div></div>
        {selectedStudent && <form onSubmit={submit} className="manual-desk-form mt-4 space-y-4">
          <div className="flex items-start justify-between gap-3 border-b border-line pb-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-on [overflow-wrap:anywhere]">{selectedStudent.name}</p>{selectedRecord && <StatusChip status={selectedRecord.status} />}</div><p className="mt-1 text-sm text-on-dim [overflow-wrap:anywhere]">{selectedStudent.email}</p></div><Button type="button" variant="secondary" size="sm" disabled={submitting} onClick={() => { setSelectedStudent(null); setIdentityChecked(false); setSearchTerm(""); if (panel === "correction") setPanel("records"); }}>{panel === "correction" ? "Back to records" : "Change student"}</Button></div>
          {isSelf || isPending || isProtected ? <p role="status" className="text-sm text-on-dim">{isSelf ? "Another organizer must handle your attendance. You cannot manually mark your own record." : isPending ? "A request is already waiting for review for this student and event." : "This record is face verified or covered by an approved excuse. It cannot be overwritten at the manual desk."}</p> : <>
            <div>
              <div><label htmlFor="manual-reason" className="field-label">Reason for manual attendance</label><select id="manual-reason" className="field-select w-full" required value={reason} onChange={e => setReason(e.target.value)} disabled={submitting}><option value="">Choose a reason</option>{REASONS.filter(value => mode === "correction" || value !== "Attendance correction").map(value => <option key={value}>{value}</option>)}</select></div>
            </div>
            {mode === "correction" && <div className="grid items-start gap-4 rounded-xl bg-card-alt/30 p-4 sm:grid-cols-2">
              {selectedRecord?.session && <label className="field-label">Action<select className="field-select w-full" value={correctionAction} onChange={e => setCorrectionAction(e.target.value)}>{selectedRecord.method !== "face" && <option value="time_in">Time In correction</option>}<option value="time_out">Time Out correction</option></select></label>}
              {canChangeRecordedStatus && <div><label className="field-label" htmlFor="manual-correction-result">Correct attendance to</label><select id="manual-correction-result" className="field-select w-full" value={correctionStatus} onChange={e => setCorrectionStatus(e.target.value)} disabled={submitting}><option value="auto">Attended - calculate Present or Late</option><option value="absent">Absent</option></select></div>}
              {correctionStatus === "auto" && <div><label htmlFor="manual-effective-at" className="field-label">Actual attendance time (Philippine time)</label><input id="manual-effective-at" type="datetime-local" className="field w-full min-w-0" value={effectiveAt} max={manilaInput(new Date())} onChange={e => setEffectiveAt(e.target.value)} required disabled={submitting} /></div>}
            </div>}
            {(needsDetails || details) && <div><label htmlFor="manual-details" className="field-label">How was attendance verified? {needsDetails ? "(required)" : ""}</label><textarea id="manual-details" className="field min-h-24 w-full resize-y" minLength={needsDetails ? 10 : undefined} maxLength={800} required={needsDetails} value={details} onChange={e => setDetails(e.target.value)} disabled={submitting} placeholder="For example: checked the school ID against the signed attendance sheet." /><p className="mt-1 text-xs text-on-muted">At least 10 characters. An independent reviewer will check this information.</p></div>}
            <div className="space-y-3 border-t border-line pt-4">
            <label className="flex cursor-pointer items-start gap-3 text-sm text-on-dim"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand-solid)]" checked={identityChecked} onChange={e => setIdentityChecked(e.target.checked)} disabled={submitting} required /><span>{mode === "checkin" ? "I checked this student’s school ID and physical presence at the event." : "I checked this student’s identity and the supporting attendance information."}</span></label>
            {mode === "checkin" && <p className="text-xs text-on-muted">Check-in time is recorded automatically when you submit, in Philippine time. Present or Late is calculated from the event’s attendance window.</p>}
            <Button type="submit" className="w-full sm:w-auto" loading={submitting} disabled={!reason || !identityChecked || (needsDetails && details.trim().length < 10)}>{mode === "checkin" ? "Submit check-in" : "Submit correction"}</Button>
            </div>
          </>}
        </form>}
      </Card>}
      {panel === "requests" && <Card className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="panel-heading">My submitted requests</h2><Link to="/organizer/dashboard/reviews/manual?view=review" className="text-sm font-medium text-brand">Review assigned requests →</Link></div>
        <p className="mt-1 text-sm text-on-muted">The recorded attendance time is kept even when review happens later.</p>
        <div className="mt-4"><label className="sr-only" htmlFor="manual-request-status">Request status</label><select id="manual-request-status" className="field-select w-full sm:w-auto" value={requestStatus} onChange={e => { setRequestStatus(e.target.value); setRequestPage(1); }}><option value="all">All requests</option><option value="pending">Pending review</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></div>
        {requestsError && <p role="alert" className="mt-3 text-sm text-danger">Requests could not be refreshed. <button onClick={fetchRequests} className="underline">Try again</button></p>}
        <StablePage loading={requestsLoading} pageKey={`manual-history:${eventId}:${requestStatus}:${requestTotal}`} footer={<Pagination page={Math.min(requestPage, Math.max(1, Math.ceil(requestTotal / PAGE_SIZE)))} pageSize={PAGE_SIZE} total={requestTotal} onChange={setRequestPage} disabled={requestsLoading} label="My attendance request pages" />}>
        {requestsLoading ? <p role="status" className="py-6 text-sm text-on-muted">Loading requests…</p> : requests.length ? <ul className="mt-4 space-y-3">{requests.map(request => <li key={request._id} className="rounded-xl bg-card-alt/30 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="text-sm font-medium text-on [overflow-wrap:anywhere]">{request.student?.name || "Student"}</p><p className="text-xs text-on-muted [overflow-wrap:anywhere]">{request.student?.email || ""}</p></div><StatusChip status={request.status} /></div>
          <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2"><div><dt className="text-on-muted">{request.proposedStatus === "absent" ? "Absence cutoff" : "Attendance time"}</dt><dd className="mt-0.5 text-on-dim">{formatDateTime(request.effectiveAt)}</dd></div><div><dt className="text-on-muted">Submitted</dt><dd className="mt-0.5 text-on-dim">{formatDateTime(request.submittedAt)}</dd></div><div><dt className="text-on-muted">Requested result</dt><dd className="mt-0.5 capitalize text-on-dim">{request.proposedStatus} · {request.proposedHours ?? 0} penalty hrs</dd></div>{request.reviewedAt && <div><dt className="text-on-muted">Reviewed</dt><dd className="mt-0.5 text-on-dim">{formatDateTime(request.reviewedAt)}{request.reviewedBy?.name && ` · ${request.reviewedBy.name}`}</dd></div>}</dl>
          <p className="mt-3 whitespace-pre-wrap text-sm text-on-dim [overflow-wrap:anywhere]">{request.reason}</p>{request.source === "id_photo" && <IdPhotoEvidence request={request} />}{request.reviewNote && <p className="mt-2 text-xs text-on-muted [overflow-wrap:anywhere]">Reviewer note: {request.reviewNote}</p>}
        </li>)}</ul> : !requestsError && <EmptyState compact title="No requests here yet" description="Your submitted requests for this event will appear here." />}
        </StablePage>
      </Card>}
    {panel === "records" && <Card className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="panel-heading">Attendance records ({matchingAttendees.length})</h2><p className="mt-1 text-sm text-on-muted">Confirmed records stay unchanged until a correction is approved.</p></div></div>
      <label className="field-label mt-4" htmlFor="record-search">Find an attendance record</label><input id="record-search" type="search" className="field w-full" placeholder="Student name or email" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setRecordPage(1); }} />
      <StablePage pageKey={`manual-records:${eventId}:${query}:${matchingAttendees.length}`} footer={<Pagination page={currentRecordPage} pageSize={PAGE_SIZE} total={matchingAttendees.length} onChange={setRecordPage} label="Attendance record pages" />}>
      {matchingAttendees.length ? <ul className="mt-4 space-y-2">{matchingAttendees.slice((currentRecordPage - 1) * PAGE_SIZE, currentRecordPage * PAGE_SIZE).map(record => {
        const student = record.student;
        const self = studentIdOf(record) === currentUserId;
        const pending = pendingIds.has(attendancePair(record));
        const protectedRecord = record.status === "excused" || (record.method === "face" && !(record.session && record.timeInAt && !record.timeOutAt));
        return <li key={record._id} className="flex flex-col justify-between gap-3 rounded-xl bg-card-alt/30 p-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="text-sm font-medium text-on [overflow-wrap:anywhere]">{student?.name || "Student"}</p><p className="text-xs text-on-dim [overflow-wrap:anywhere]">{student?.email || ""}</p><p className="mt-1 text-xs text-on-muted">{record.method === "face" ? "Face verified" : record.method === "auto" ? "Automatic record" : record.method === "id_photo" ? "ID-assisted check-in" : "Manual record"}{record.attendedAt ? ` · ${formatDateTime(record.attendedAt)}` : ""}</p>{pending && <p className="mt-1 text-xs text-warn">Manual request pending review; automatic absence is provisional.</p>}{self && <p className="mt-1 text-xs text-on-muted">Another organizer must handle your record.</p>}</div><div className="flex flex-wrap items-center gap-3"><StatusChip status={record.status} /><SessionAttendanceDetails record={record} /><span className="text-xs text-on-muted">{record.communityServiceHours || 0} hrs</span>{!protectedRecord && ["absent", "present", "late"].includes(record.status) && <Button type="button" variant="secondary" size="sm" disabled={self || pending} onClick={() => { selectStudent({ ...student, _attendance: record }, true); window.requestAnimationFrame(() => document.querySelector(".manual-desk-form")?.scrollIntoView({ behavior: "smooth", block: "start" })); }}>Request correction</Button>}</div></li>;
      })}</ul> : <EmptyState compact title={query ? "No matching records" : "No attendance records yet"} description="Use the Check in tab to capture a physical school ID." />}
      </StablePage>
    </Card>}
  </div>;
}

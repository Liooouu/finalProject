import React, { useId, useState } from "react";
import { FaClipboardCheck } from "react-icons/fa";
import { Button, Card, StatusChip } from "../ui";
import { formatDateTime } from "../../utils/helpers";
import IdPhotoEvidence from "./IdPhotoEvidence";
import "../../styles/attendance-reviews.css";

const displayTime = value => value ? formatDateTime(value) : "—";

export default function AttendanceReviewCard({ request, reviewMode, selected, onToggle, onReview, busy }) {
  const [verified, setVerified] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const noteId = useId();
  const selectable = reviewMode && request.status === "pending" && request.canReview === true;
  const recorded = request.resolution === "existing_face" ? request.confirmedAttendance : request.currentAttendance;
  const isSessionExit = !!request.session && request.action === "time_out";
  const waitingForTimeIn = selectable && isSessionExit && !recorded?.timeInAt;
  const faceEntry = recorded?.method === "face" && (!request.session || !!recorded.timeInAt);
  const faceExit = !!recorded?.timeOutAt && (recorded.timeOutMethod === "face" || recorded.method === "face");
  const faceProtected = request.proposedStatus === "absent" ? faceEntry || faceExit : isSessionExit ? faceExit : faceEntry;
  const protectedRecord = recorded?.status === "excused" || faceProtected;
  const matchingFace = faceProtected && recorded.status !== "excused" && request.mode !== "correction" &&
    (isSessionExit || (["present", "late"].includes(recorded.status) && recorded.status === request.proposedStatus));
  const conflict = protectedRecord && !matchingFace;
  const decide = async decision => {
    const saved = await onReview(decision, { id: request._id, verified, note });
    setVerified(false);
    if (saved) { setRejecting(false); setNote(""); }
  };
  return <Card as="article" padding="sm" className={`manual-review-record attendance-review-card ${selected ? "ring-2 ring-brand/50" : ""}`}>
    <div className="attendance-review-card-top">
      {selectable ? <input type="checkbox" aria-label={`Select request for ${request.student?.name || request.student?.email || "student"}`} className="h-5 w-5 accent-[var(--brand-solid)]" checked={selected} onChange={onToggle} disabled={busy} /> : <span />}
      <StatusChip status={request.status} />
    </div>
    <div className="attendance-review-card-body">
      {request.source === "id_photo" ? <IdPhotoEvidence request={request} autoLoad={reviewMode} /> : <div className="id-review-placeholder"><FaClipboardCheck aria-hidden="true" /><span>Attendance correction</span></div>}
      <div className="attendance-review-card-info">
        <div><h3 className="font-display text-base font-semibold text-on [overflow-wrap:anywhere]">{request.student?.name || "Student unavailable"}</h3><p className="mt-0.5 text-xs text-on-muted [overflow-wrap:anywhere]">{request.student?.email || "Email unavailable"}</p></div>
        <dl className="attendance-review-facts">
          <div><dt>Session / action</dt><dd>{request.sessionName || "Time In only"} · {request.action === "time_out" ? "Time Out" : "Time In"}</dd></div>
          <div><dt>Event</dt><dd>{request.event?.title || "Event unavailable"}</dd></div>
          <div><dt>{request.proposedStatus === "absent" ? "Cutoff" : request.mode === "correction" ? "Claimed time" : "Check-in"}</dt><dd>{displayTime(request.effectiveAt)}</dd></div>
          <div><dt>Result</dt><dd className="flex flex-wrap items-center gap-2">{request.action === "time_out" ? <span>Time Out</span> : <StatusChip status={request.proposedStatus} />}<span className="text-xs text-on-muted">{request.proposedHours ?? 0} penalty hrs</span></dd></div>
        </dl>
        {request.source === "id_photo" && <p className="text-xs text-info">{request.captureBasis === "device" ? "Offline capture · Verify time" : "ID checked by organizer"}</p>}
        {request.session && !isSessionExit && faceExit && !recorded.timeInAt && <p className="text-xs text-info">Face Time Out is already recorded. This request is for the missing Time In.</p>}
        {waitingForTimeIn && <p className="text-xs text-warn">Approval records Time Out. If Time In remains missing when the session closes, the absence penalty is 8 service hours.</p>}
        {protectedRecord && <div className="rounded-lg bg-card-alt/60 p-2 text-xs text-on-dim"><p className="font-medium text-on">{request.resolution === "existing_face" ? "Confirmed using existing face attendance" : "Attendance already recorded"}</p><p className="mt-1">{recorded.status === "excused" ? "Approved excuse kept. Reject this duplicate with a note." : matchingFace ? "Matching face attendance: approval keeps its original time and hours." : "Different face attendance: approval cannot replace it. Review or reject this request."}</p></div>}
        <details className="text-xs text-on-muted"><summary className="cursor-pointer font-medium text-on-dim">Review details</summary>
          <p className="mt-2 whitespace-pre-wrap [overflow-wrap:anywhere]"><strong>Reason: </strong>{request.reason}</p>
          <dl className="attendance-review-facts mt-2">
            <div><dt>Submitted</dt><dd>{displayTime(request.submittedAt)}</dd></div>
            <div><dt>By</dt><dd>{request.requestedBy?.name || "Organizer"}</dd></div>
            <div><dt>Reviewed</dt><dd>{displayTime(request.reviewedAt)}</dd></div>
            <div><dt>Reviewer</dt><dd>{request.reviewedBy?.name || (request.resolution === "id_photo" ? "Organizer confirmation" : "Not reviewed yet")}</dd></div>
            {request.schedule?.start && <div><dt>Window</dt><dd>{displayTime(request.schedule.start)} – {displayTime(request.schedule.deadline)}</dd></div>}
            {request.schedule?.cutoff && <div><dt>Cutoff</dt><dd>{displayTime(request.schedule.cutoff)}</dd></div>}
            {protectedRecord && <div><dt>Existing</dt><dd>{recorded.status} · {recorded.hours ?? 0} hrs{recorded.attendedAt ? ` · ${displayTime(recorded.attendedAt)}` : ""}</dd></div>}
          </dl>
          {(request.reviewNote || request.note) && <p className="mt-2 whitespace-pre-wrap [overflow-wrap:anywhere]">{request.reviewNote || request.note}</p>}
        </details>
        {selectable ? <div className="attendance-review-card-actions">
          <label className="flex cursor-pointer items-start gap-2 text-xs text-on-dim"><input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--brand-solid)]" checked={verified} disabled={busy} onChange={event => setVerified(event.target.checked)} /><span>I checked the evidence and time.</span></label>
          {rejecting && <div><label className="field-label" htmlFor={noteId}>Rejection reason</label><textarea id={noteId} className="field min-h-20 w-full resize-y text-sm" placeholder="At least 5 characters" maxLength={1000} value={note} disabled={busy} onChange={event => setNote(event.target.value)} /></div>}
          <div className="grid grid-cols-2 gap-2"><Button type="button" size="sm" variant="success" disabled={busy || !verified || conflict} onClick={() => decide("approved")}>Approve</Button><Button type="button" size="sm" variant="danger" disabled={busy || (rejecting && note.trim().length < 5)} onClick={() => rejecting ? decide("rejected") : setRejecting(true)}>{rejecting ? "Confirm reject" : "Reject"}</Button></div>
          {rejecting && <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setRejecting(false)}>Cancel rejection</Button>}
        </div> : request.status === "pending" && <p className="text-xs text-on-muted">Awaiting admin review.</p>}
      </div>
    </div>
  </Card>;
}

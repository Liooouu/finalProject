import React from "react";
import StatusBadge from "../shared/StatusBadge";
import { attendanceCompletion, attendancePenaltyLabel, manilaInput } from "../../utils/attendanceSessions";
import { formatDate, formatDateTime, formatTime } from "../../utils/helpers";
import "../../styles/student-ledger-records.css";

export default function StudentLedgerRecord({ record }) {
  const date = record.event?.date || record.eventDate;
  const isSession = Boolean(record.session);
  const timeIn = record.timeInAt || (!isSession && ["present", "late"].includes(record.status) ? record.attendedAt : null);
  const clock = value => !value ? "Not recorded" : date && manilaInput(value).slice(0, 10) === String(date).slice(0, 10)
    ? formatTime(value, { hour: "numeric", minute: "2-digit", hour12: true }) : formatDateTime(value);
  const hours = record.communityServiceHours || 0;
  const completion = isSession ? attendanceCompletion(record) : '';
  return <article className="portal-inset student-ledger-card">
    <header>
      <h3 className="font-semibold text-on">{record.event?.title || record.eventTitle || "Event unavailable"}</h3>
      <p className="mt-1 text-xs text-on-muted">{date ? formatDate(date) : "Date unavailable"}{isSession && <> · {record.sessionName || "Event attendance"}</>}</p>
    </header>
    <div className="flex min-w-0 flex-wrap items-start gap-2">
      <StatusBadge status={record.status} />
      {isSession && !['Absent', 'Excused'].includes(completion) && <span className="student-ledger-completion">{completion}</span>}
    </div>
    <div className="space-y-2">
      <dl className="student-ledger-times">
        <div><dt>Time In</dt><dd className={timeIn ? "text-ok" : "text-on-muted"}>{clock(timeIn)}</dd></div>
        {isSession ? <div><dt>Time Out</dt><dd className={record.timeOutAt ? "text-ok" : "text-on-muted"}>{clock(record.timeOutAt)}</dd></div> : <div><dt>Time Out</dt><dd className="text-on-muted">Not required · older event</dd></div>}
      </dl>
      {record.manualReviewPending && <p className="text-xs text-info">{record.status === "pending" ? "Awaiting independent review" : "Attendance correction awaiting review"}{record.manualAttendanceRequest?.effectiveAt && <> · Captured {formatDateTime(record.manualAttendanceRequest.effectiveAt)}</>}</p>}
    </div>
    <footer className={`student-ledger-hours ${hours > 0 ? "student-ledger-hours-due" : "student-ledger-hours-clear"}`}>
      <p className="text-xs text-on-dim">Service hours</p>
      <p className="num text-xl font-semibold">{hours} hours</p>
      {record.provisionalHours > 0 && <p className="mt-1 text-xs text-on-muted">{record.provisionalHours} provisional hours on hold</p>}
      {isSession && record.completionStatus !== "pending" && <p className="mt-1 text-xs text-on-dim">Attendance rule: {attendancePenaltyLabel(record)}</p>}
    </footer>
  </article>;
}

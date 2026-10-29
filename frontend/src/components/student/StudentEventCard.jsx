import React from "react";
import { FaCalendarAlt, FaClock, FaMapMarkerAlt, FaCheckCircle, FaExclamationCircle } from "react-icons/fa";
import { BsClipboardCheck } from "react-icons/bs";
import { StatusChip } from "../ui";
import { formatDate, formatDateTime, formatTime12Hour } from "../../utils/helpers";

const results = {
  present: { title: "Attendance marked · Present", tone: "border-ok/40 bg-ok/10 text-ok", detail: "Your attendance has been recorded." },
  late: { title: "Attendance marked · Late", tone: "border-warn/40 bg-warn/10 text-warn", detail: "Your attendance has been recorded as late." },
  absent: { title: "Marked absent", tone: "border-danger/40 bg-danger/10 text-danger", detail: "Your attendance record shows an absence." },
  excused: { title: "Absence excused", tone: "border-info/40 bg-info/10 text-info", detail: "Your absence has been excused." },
};

export default function StudentEventCard({ event, attendance, attendanceError = false }) {
  const result = results[attendance?.status];
  const unavailable = attendanceError && !result;
  const title = result?.title || (unavailable ? "Attendance status unavailable" : "Attendance not marked yet");
  const tone = result?.tone || "border-line bg-card-alt/50 text-on-dim";
  const recorded = attendance?.status === "present" || attendance?.status === "late";
  const timestamp = attendance?.verifiedAt || attendance?.attendedAt;
  return (
    <article aria-label={event.title} className="student-event-card fd-surface fd-instrument fd-glass flex min-w-0 flex-col overflow-hidden">
      <div className="border-b border-line bg-card-alt/40 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <span aria-hidden="true" className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-line bg-card text-center">
            <span className="num text-base font-bold leading-none text-on">{event.date ? formatDate(event.date, { day: "numeric" }) : "–"}</span>
            <span className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-on-muted">{event.date ? formatDate(event.date, { month: "short" }) : "TBA"}</span>
          </span>
          <StatusChip status={event.status} />
        </div>
        <h3 className="mt-3 whitespace-normal font-display text-lg font-semibold leading-snug tracking-tight text-on [overflow-wrap:anywhere]">{event.title}</h3>
        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-on-dim [overflow-wrap:anywhere]">{event.description || "No description provided."}</p>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
        <div role="status" aria-live="polite" aria-atomic="true" className={`rounded-xl border p-3 ${tone}`}>
          <div className="flex items-start gap-2.5">
            {recorded ? <FaCheckCircle aria-hidden="true" className="mt-0.5 shrink-0 text-lg" /> : <FaExclamationCircle aria-hidden="true" className="mt-0.5 shrink-0 text-lg" />}
            <div className="min-w-0">
              <p className="text-sm font-bold">{title}</p>
              <p className="mt-1 text-xs leading-relaxed">{result?.detail || (unavailable ? "Unable to load your record. Please try refreshing." : "An organizer records your attendance at the face verification station.")}</p>
              {recorded && timestamp && <p className="mt-1 text-xs">{attendance.method === "face" ? "Face verified" : "Recorded"}: {formatDateTime(timestamp)}</p>}
              {attendanceError && result && <p className="mt-1 text-xs">Could not refresh. Showing your last loaded result.</p>}
            </div>
          </div>
        </div>
        <dl className="space-y-3 text-sm">
          <div className="flex items-start gap-2.5"><FaCalendarAlt aria-hidden="true" className="mt-1 shrink-0 text-xs text-on-muted" /><div className="min-w-0"><dt className="text-xs text-on-muted">Starts</dt><dd className="mt-0.5 text-on-dim">{event.date ? formatDate(event.date) : "Date TBA"}{event.time ? ` at ${formatTime12Hour(event.time)}` : " · Time TBA"}</dd></div></div>
          <div className="flex items-start gap-2.5"><FaClock aria-hidden="true" className="mt-1 shrink-0 text-xs text-on-muted" /><div className="min-w-0"><dt className="text-xs text-on-muted">Ends</dt><dd className="mt-0.5 text-on-dim">{event.endDate || event.date ? formatDate(event.endDate || event.date) : "Date TBA"} at {formatTime12Hour(event.endTime || "23:59")}</dd></div></div>
          <div className="flex items-start gap-2.5"><FaMapMarkerAlt aria-hidden="true" className="mt-1 shrink-0 text-xs text-on-muted" /><div className="min-w-0"><dt className="text-xs text-on-muted">Venue</dt><dd className="mt-0.5 whitespace-pre-wrap text-on-dim [overflow-wrap:anywhere]">{event.location || "Venue TBA"}</dd></div></div>
        </dl>
        <div className="flex items-start gap-2 rounded-xl border border-warn/25 bg-warn/5 px-3 py-2.5 text-xs text-warn">
          <BsClipboardCheck aria-hidden="true" className="mt-0.5 shrink-0" />
          <p><span className="font-semibold">Attendance window</span><br />{event.attendanceStartTime && event.attendanceEndTime ? `${formatTime12Hour(event.attendanceStartTime)} – ${formatTime12Hour(event.attendanceEndTime)}` : "Not yet announced"}</p>
        </div>
        <p className="mt-auto border-t border-line pt-3 text-xs text-on-muted [overflow-wrap:anywhere]">Organized by <span className="font-medium text-on-dim">{event.organizer?.name || "Organizer TBA"}</span></p>
      </div>
    </article>
  );
}

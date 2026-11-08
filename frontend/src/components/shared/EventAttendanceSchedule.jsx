import { attendanceWindowLabel } from "../../utils/attendanceWindowLabel";
import React from 'react';
import { formatDate, formatTime12Hour } from '../../utils/helpers';
import { manilaInput } from '../../utils/attendanceSessions';

const columns = { gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 9rem), 1fr))" };

export default function EventAttendanceSchedule({ event, compact = false }) {
  const periods = event.attendanceSessions || [];
  if (!periods.length) return <dl aria-label="Attendance times" className="grid min-w-0 gap-2 text-xs" style={columns}>
    <div><dt className="font-semibold text-on">Time In</dt><dd className="mt-1 text-on-dim">{formatTime12Hour(event.attendanceStartTime) || 'Not set'} – {formatTime12Hour(event.attendanceEndTime) || 'Not set'}</dd><dd className="mt-1 text-xs text-on-muted">Time In only · no Time Out required</dd></div>
  </dl>;
  return <div aria-label="Attendance times" className="min-w-0 space-y-3">{periods.map((period, index) => {
    const inDay = manilaInput(period.timeInOpen).slice(0, 10);
    const outDay = manilaInput(period.timeOutOpen).slice(0, 10);
    return <div key={period._id || index} className="min-w-0">
      {periods.length > 1 && <p className="mb-2 text-xs font-semibold text-on">{period.name} · {formatDate(period.timeInOpen, { month: 'short', day: 'numeric' })}</p>}
      <dl className={`grid min-w-0 gap-2 ${compact ? 'text-xs' : 'text-sm'}`} style={columns}>
        <div className="min-w-0 rounded-lg bg-card-alt/50 px-3 py-2"><dt className="font-semibold text-on">Time In</dt><dd className="mt-1 text-on-dim [overflow-wrap:anywhere]">{attendanceWindowLabel(period.timeInOpen, period.timeInCutoff)}</dd></div>
        <div className="min-w-0 rounded-lg bg-card-alt/50 px-3 py-2"><dt className="font-semibold text-on">Time Out</dt>{outDay !== inDay && <dd className="mt-1 text-xs text-on-muted">{formatDate(period.timeOutOpen, { month: 'short', day: 'numeric', year: 'numeric' })}</dd>}<dd className="mt-1 text-on-dim [overflow-wrap:anywhere]">{attendanceWindowLabel(period.timeOutOpen, period.timeOutClose)}</dd></div>
      </dl>
    </div>;
  })}</div>;
}

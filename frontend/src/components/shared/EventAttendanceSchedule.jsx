import { attendanceWindowLabel } from "../../utils/attendanceWindowLabel";
import React from 'react';
import { formatDate, formatTime12Hour } from '../../utils/helpers';
import { manilaInput, onTimeWindowEnd } from '../../utils/attendanceSessions';
import { formatTime } from '../../utils/helpers';
import SessionDayPager from './SessionDayPager';

const columns = { gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 9rem), 1fr))" };

export default function EventAttendanceSchedule({ event, compact = false }) {
  const periods = event.attendanceSessions || [];
  if (!periods.length) return <dl aria-label="Attendance times" className="grid min-w-0 gap-2 text-xs" style={columns}>
    <div><dt className="font-semibold text-on">Time In</dt><dd className="mt-1 text-on-dim">{formatTime12Hour(event.attendanceStartTime) || 'Not set'} – {formatTime12Hour(event.attendanceEndTime) || 'Not set'}</dd><dd className="mt-1 text-xs text-on-muted">Time In only · no Time Out required</dd></div>
  </dl>;
  return <div aria-label="Attendance times" className="min-w-0"><SessionDayPager event={event}>{(period) => {
    const inDay = manilaInput(period.timeInOpen).slice(0, 10);
    const outDay = manilaInput(period.timeOutOpen).slice(0, 10);
    return <div className="min-w-0">
      <dl className={`grid min-w-0 gap-2 ${compact ? 'text-xs' : 'text-sm'}`} style={columns}>
        <div className="min-w-0 rounded-lg bg-card-alt/50 px-3 py-2"><dt className="font-semibold text-on">Time In</dt><dd className="mt-1 text-on-dim [overflow-wrap:anywhere]">{attendanceWindowLabel(period.timeInOpen, onTimeWindowEnd(period))}</dd><dd className="mt-1 text-xs text-on-muted">{period.timeInPolicy === 'window_then_late' ? 'On time in this range; Late afterward, before Time Out.' : `On time until ${formatTime(period.onTimeDeadline)}.`}</dd></div>
        <div className="min-w-0 rounded-lg bg-card-alt/50 px-3 py-2"><dt className="font-semibold text-on">Time Out</dt>{outDay !== inDay && <dd className="mt-1 text-xs text-on-muted">{formatDate(period.timeOutOpen, { month: 'short', day: 'numeric', year: 'numeric' })}</dd>}<dd className="mt-1 text-on-dim [overflow-wrap:anywhere]">{attendanceWindowLabel(period.timeOutOpen, period.timeOutClose)}</dd></div>
      </dl>
    </div>;
  }}</SessionDayPager></div>;
}

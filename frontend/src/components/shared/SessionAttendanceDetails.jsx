import React from 'react';
import { formatDateTime } from '../../utils/helpers';
import { attendanceCompletion, attendancePenaltyLabel } from '../../utils/attendanceSessions';
import { attendanceWindowLabel } from '../../utils/attendanceWindowLabel';

// One block per attendance session. The scheduled window and the student's own
// recorded instants share a single "Time In" / "Time Out" label, so a page can
// never print those words twice for the same session. Callers that only have a
// record (recent activity, ledger) omit `session` and get the recorded times
// without a window. Pass `showWindow={false}` when the window is already
// displayed elsewhere on the page, and `compact` inside tables or list rows.
function recordedAt(value) {
  return value ? `Recorded ${formatDateTime(value)}` : 'Not recorded';
}

function Clock({ label, windowLabel, actual }) {
  return <div className="min-w-0 rounded-lg bg-card-alt/50 px-2.5 py-2">
    <p className="font-semibold text-on">{label}</p>
    {windowLabel && <p className="mt-0.5 text-on-dim [overflow-wrap:anywhere]">{windowLabel}</p>}
    <p className={`mt-0.5 ${actual ? 'text-ok' : 'text-on-muted'}`}>{recordedAt(actual)}</p>
  </div>;
}

export default function SessionAttendanceDetails({ record, session = null, showWindow = true, compact = false }) {
  if (!session && !record?.session) return null;
  const name = session?.name || record?.sessionName || 'Attendance session';
  const status = record ? attendanceCompletion(record) : 'Not checked in';
  const inWindow = showWindow && session ? attendanceWindowLabel(session.timeInOpen, session.timeInCutoff) : '';
  const outWindow = showWindow && session ? attendanceWindowLabel(session.timeOutOpen, session.timeOutClose) : '';

  if (compact) {
    return <div className="mt-1 space-y-0.5 text-xs text-on-dim">
      <p className="font-medium text-on">{name} · {status}</p>
      <p>Time In: {inWindow ? `${inWindow} · ` : ''}{recordedAt(record?.timeInAt)}</p>
      <p>Time Out: {outWindow ? `${outWindow} · ` : ''}{recordedAt(record?.timeOutAt)}</p>
      <p>{attendancePenaltyLabel(record)}</p>
    </div>;
  }

  return <div className="mt-2 space-y-2 text-xs text-on-dim">
    <p className="font-medium text-on">{name}<span className="text-on-muted"> · {status}</span></p>
    <div className="grid gap-2 sm:grid-cols-2">
      <Clock label="Time In" windowLabel={inWindow} actual={record?.timeInAt} />
      <Clock label="Time Out" windowLabel={outWindow} actual={record?.timeOutAt} />
    </div>
    <p>{attendancePenaltyLabel(record)}</p>
  </div>;
}

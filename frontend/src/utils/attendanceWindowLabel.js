import { formatDateTime, formatTime } from "./helpers";
import { manilaInput } from "./attendanceSessions";
const clockOptions = { hour: "numeric", minute: "2-digit", hour12: true };
export function attendanceWindowLabel(start, end) {
  if (!start || !end || !Number.isFinite(+new Date(start)) || !Number.isFinite(+new Date(end))) return 'Not set';
  return manilaInput(start).slice(0, 10) === manilaInput(end).slice(0, 10)
    ? `${formatTime(start, clockOptions)} – ${formatTime(end, clockOptions)}`
    : `${formatDateTime(start)} – ${formatDateTime(end)}`;
}


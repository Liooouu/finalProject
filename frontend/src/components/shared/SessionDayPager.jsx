import React, { useState } from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { formatDate } from '../../utils/helpers';
import { sessionDayStatus } from '../../utils/attendanceSessions';

const keyOf = (period, index) => String(period._id || `${period.name}:${period.timeInOpen}:${index}`);

// Keep the chosen day across background refreshes, without changing the event
// list's own pagination or the attendance station's selected session.
export default function SessionDayPager({ event, children }) {
  const periods = event.attendanceSessions || [];
  const [selection, setSelection] = useState(null);
  if (!periods.length) return null;
  const eventKey = String(event._id || `${event.title}:${event.date}`);
  const selectedIndex = selection?.eventKey === eventKey ? periods.findIndex((period, index) => keyOf(period, index) === selection.key) : -1;
  const index = Math.max(0, selectedIndex);
  const period = periods[index];
  const status = event.status === 'closed' ? 'Closed' : { upcoming: 'Upcoming', live: 'Live', finished: 'Finished' }[sessionDayStatus(period)];
  const move = (clickEvent, next) => {
    clickEvent.preventDefault();
    clickEvent.stopPropagation();
    if (next < 0 || next >= periods.length) return;
    setSelection({ eventKey, key: keyOf(periods[next], next) });
  };
  const arrowClass = 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-card-alt/60 text-on transition-colors hover:bg-brand/10 focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-default disabled:opacity-35';
  const customName = period.name && !/^(Event attendance|Day \/ activity \d+)$/i.test(period.name);
  return <div className="min-w-0 space-y-2">
    {periods.length > 1 && <div className="flex min-w-0 items-start justify-between gap-3">
      <div className="min-w-0 text-xs" aria-live="polite" aria-atomic="true"><p className="font-semibold tabular-nums text-on">Day {index + 1} of {periods.length} · {status}</p><p className="mt-1 text-on-dim [overflow-wrap:anywhere]">{customName ? `${period.name} · ` : ''}{formatDate(period.activityStart || period.timeInOpen, { month: 'short', day: 'numeric', year: 'numeric' })}</p></div>
      <div role="group" aria-label={`Attendance days for ${event.title || 'event'}`} className="flex shrink-0 gap-1.5">
        <button type="button" aria-label="Previous day or activity" title="Previous day / activity" disabled={index === 0} className={arrowClass} onClick={clickEvent => move(clickEvent, index - 1)}><FaChevronLeft aria-hidden="true" className="text-xs" /></button>
        <button type="button" aria-label="Next day or activity" title="Next day / activity" disabled={index === periods.length - 1} className={arrowClass} onClick={clickEvent => move(clickEvent, index + 1)}><FaChevronRight aria-hidden="true" className="text-xs" /></button>
      </div>
    </div>}
    <div className="min-w-0">{children(period, index)}</div>
  </div>;
}

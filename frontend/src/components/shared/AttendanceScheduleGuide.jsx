import React, { useEffect, useRef } from 'react';
import { Button } from '../ui';

export function ScheduleExample() {
  return <div className="space-y-2 text-sm text-on-dim">
    <p>Set the event duration first, then the arrival and departure times.</p>
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl bg-card-alt/50 p-3">
      <dt>Event</dt><dd>9:00 AM–5:00 PM</dd>
      <dt>Time In</dt><dd>7:00–9:00 AM</dd>
      <dt>Invalid Time In</dt><dd>7:00–9:01 AM (after the event starts)</dd>
      <dt>Time Out</dt><dd>5:00–6:00 PM</dd>
      <dt>Invalid Time Out</dt><dd>4:59–6:00 PM (before the event ends)</dd>
    </dl>
    <p>Time In must end by the start time. Time Out must open at or after the end time. Each added day/activity uses its own start and end schedule. For an overnight activity, choose the next end date.</p>
  </div>;
}

export default function AttendanceScheduleGuide({ issue, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    if (issue && !dialog.current?.open) dialog.current?.showModal();
  }, [issue]);
  if (!issue) return null;
  return <dialog ref={dialog} aria-labelledby="schedule-guide-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }} className="m-auto max-w-lg rounded-2xl border border-line bg-card p-5 text-on shadow-2xl backdrop:bg-black/60" style={{ width: 'calc(100% - 2rem)' }}>
    <h2 id="schedule-guide-title" className="text-lg font-semibold">Check the attendance schedule</h2>
    <p role="alert" className="my-3 rounded-xl bg-danger/10 p-3 text-sm text-danger">{issue}</p>
    <ScheduleExample />
    <div className="mt-4 flex justify-end"><Button type="button" onClick={onClose}>Back to the schedule</Button></div>
  </dialog>;
}

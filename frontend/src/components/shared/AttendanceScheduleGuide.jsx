import React, { useEffect, useRef } from 'react';
import { Button } from '../ui';

export function ScheduleExample() {
  return <div className="space-y-2 text-sm text-on-dim">
    <p>Set the event duration first, then the arrival and departure times.</p>
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl bg-card-alt/50 p-3">
      <dt>Event</dt><dd>8:00–10:00 PM</dd>
      <dt>Time In</dt><dd>7:45–8:15 PM (on time)</dd>
      <dt>Late arrival</dt><dd>After 8:15 PM, before 10:00 PM</dd>
      <dt>Time Out</dt><dd>10:00–10:15 PM</dd>
    </dl>
    <p>Time In must finish before Time Out opens. For an overnight event, choose the next end date. Extra days or activities must not overlap.</p>
  </div>;
}

export function ScheduleHelp() {
  return <details className="mt-3 text-sm text-on-muted"><summary className="cursor-pointer font-medium text-brand">How to set the attendance times</summary><div className="mt-3"><ScheduleExample /></div></details>;
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

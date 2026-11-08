import React from 'react';
import { Button } from '../ui';
import { ATTENDANCE_GROUPS, attendanceGroupsFor, emptyEventAttendance, attendanceClock, attendanceGroupDate, updateAttendanceGroup, manilaInput, activityScheduleFields, updateActivitySchedule } from '../../utils/attendanceSessions';
import TimePicker from '../ui/TimePicker';
import { formatDate } from '../../utils/helpers';

export function AttendanceTimeGroup({ value, onChange, groupId, index = 0, disabled = false, followEventDate = false, followActivityDate = false }) {
  const rows = value.attendanceSessions?.length ? value.attendanceSessions : [emptyEventAttendance(0)];
  const row = rows[index];
  const group = attendanceGroupsFor(row).find(item => item.id === groupId);
  if (!row || !group) return null;
  const linked = (followEventDate && row.name === 'Event attendance') || followActivityDate;
  const activity = activityScheduleFields(row, value.date);
  const eventDate = followActivityDate ? group.id === 'timeIn' ? activity.startDate : activity.endDate : group.id === 'timeIn' ? value.date : value.endDate || value.date;
  const date = linked ? eventDate || '' : attendanceGroupDate(row, group, eventDate);
  const overnight = row[`_${group.id}Overnight`] ?? (manilaInput(row[group.fields.at(-1)[0]]).slice(0, 10) > date);
  const setGroup = (nextDate, key, time) => onChange({ target: { name: 'attendanceSessions', value: rows.map((item, i) => i === index ? updateAttendanceGroup({ ...item, [`_${group.id}Overnight`]: overnight }, group, nextDate, key, time) : item) } });
  return <section aria-label={`${group.title} attendance times`} className="min-w-0 space-y-3 rounded-xl bg-card-alt/40 p-3">
    <h3 className="text-sm font-semibold text-on">{group.title}</h3>
    {!linked && <div><label className="field-label" htmlFor={`attendance-${index}-${group.id}-date`}>Date</label><input id={`attendance-${index}-${group.id}-date`} type="date" className="field field-datetime w-full min-w-0" min="2026-01-01" required disabled={disabled} value={date || ''} onChange={e => setGroup(e.target.value)} /></div>}
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">{group.fields.map(([key,label]) => {
      const fieldDate = manilaInput(row[key]).slice(0, 10);
      return <div key={key} className="min-w-0"><label className="field-label" htmlFor={`attendance-${index}-${key}`}>{label}</label><TimePicker id={`attendance-${index}-${key}`} name={key} value={attendanceClock(row, key)} required disabled={disabled || !date} className="field field-datetime w-full min-w-0" onChange={e => setGroup(date, key, e.target.value)} />{fieldDate && fieldDate !== date && <p className="mt-1 text-xs text-on-muted">{key === 'timeOutClose' ? 'Closes on' : 'On'} {formatDate(row[key], { month: 'short', day: 'numeric', year: 'numeric' })}</p>}</div>;
    })}</div>
    {groupId === 'timeOut' && row.timeInPolicy === 'window_then_late' && attendanceClock(row, 'timeOutClose') && attendanceClock(row, 'timeOutOpen') && attendanceClock(row, 'timeOutClose') < attendanceClock(row, 'timeOutOpen') && <label className="flex items-center gap-2 text-xs text-on-dim"><input type="checkbox" disabled={disabled} checked={overnight} onChange={event => onChange({ target: { name: 'attendanceSessions', value: rows.map((item, i) => i === index ? updateAttendanceGroup({ ...item, _timeOutOvernight: event.target.checked }, group, date) : item) } })} />Closes the next day</label>}
    {groupId === 'timeIn' && row.timeInPolicy !== 'window_then_late' && !disabled && <Button type="button" size="sm" variant="secondary" onClick={() => onChange({ target: { name: 'attendanceSessions', value: rows.map((item, i) => i === index ? { ...item, timeInPolicy: 'window_then_late', onTimeDeadline: item.timeInCutoff } : item) } })}>Use the updated Time In rule</Button>}
  </section>;
}

function ActivitySchedule({ value, row, index, onChange, disabled }) {
  const fields = activityScheduleFields(row, value.date);
  const change = (key, next) => onChange({ target: { name: 'attendanceSessions', value: value.attendanceSessions.map((item, i) => i === index ? updateActivitySchedule(item, key, next, value.date) : item) } });
  const input = (key, label, type) => <div className="min-w-0"><label className="field-label" htmlFor={`activity-${index}-${key}`}>{label}</label>{type === 'time' ? <TimePicker id={`activity-${index}-${key}`} name={key} value={fields[key]} required disabled={disabled} onChange={event => change(key, event.target.value)} /> : <input id={`activity-${index}-${key}`} type="date" className="field field-datetime w-full min-w-0" min="2026-01-01" required disabled={disabled} value={fields[key]} onChange={event => change(key, event.target.value)} />}</div>;
  return <div className="grid min-w-0 gap-4 lg:grid-cols-2">
    <div className="space-y-3"><div className="grid min-w-0 gap-3 sm:grid-cols-2">{input('startDate', 'Start date', 'date')}{input('startTime', 'Start time', 'time')}</div>{fields.startDate && fields.startTime && <AttendanceTimeGroup value={value} onChange={onChange} groupId="timeIn" index={index} disabled={disabled} followActivityDate />}</div>
    <div className="space-y-3"><div className="grid min-w-0 gap-3 sm:grid-cols-2">{input('endDate', 'End date', 'date')}{input('endTime', 'End time', 'time')}</div>{fields.endDate && fields.endTime && <AttendanceTimeGroup value={value} onChange={onChange} groupId="timeOut" index={index} disabled={disabled} followActivityDate />}</div>
  </div>;
}

export default function SessionSetupEditor({ value, onChange, disabled = false, legacy = false, extrasOnly = false }) {
  const saved = value.attendanceSessions || [];
  const rows = saved.length ? saved : legacy ? [] : [emptyEventAttendance(0)];
  const set = next => onChange({ target: { name: 'attendanceSessions', value: next.map(row => ({ ...row, _auto: false })) } });
  const visible = rows.map((row,index) => ({row,index})).filter(({index}) => !extrasOnly || index > 0);
  return <div className="min-w-0 space-y-3">
    {!extrasOnly && <h3 className="text-sm font-semibold">Attendance: Time In &amp; Time Out</h3>}
    {!rows.length && <p className="text-sm text-on-muted">This existing event uses Time In only.</p>}
    {visible.map(({row,index}) => <div key={row._id || index} className="min-w-0 space-y-3 rounded-xl bg-card/60 p-3">
      {index > 0 && <h3 className="text-sm font-semibold text-on">Day / activity {index + 1}</h3>}
      {index > 0 && <div className="flex items-end gap-3"><label className="field-label min-w-0 flex-1">Day or activity name<input className="field mt-1 w-full" required value={row.name} disabled={disabled} maxLength={80} onChange={e => set(rows.map((item,i) => i === index ? {...item,name:e.target.value} : item))} /></label>{!disabled && <Button type="button" variant="ghost" size="sm" onClick={() => set(rows.filter((_,i) => i !== index))}>Remove</Button>}</div>}
      {index > 0 && ('activityStart' in row || !row._id) ? <ActivitySchedule value={value} row={row} index={index} onChange={onChange} disabled={disabled} /> : <div className="grid min-w-0 gap-4 lg:grid-cols-2">{ATTENDANCE_GROUPS.map(group => <AttendanceTimeGroup key={group.id} value={value} onChange={onChange} groupId={group.id} index={index} disabled={disabled} />)}</div>}
    </div>)}
    {!disabled && !legacy && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3"><p className="text-xs text-on-muted">Multiple required days or activities? Add another attendance period.</p><Button type="button" size="sm" variant="secondary" disabled={!saved.length || rows.length >= 30} onClick={() => set([...rows, emptyEventAttendance(rows.length)])}>+ Add another day / activity</Button></div>}
    <details className="text-xs text-on-muted"><summary className="cursor-pointer">Penalty rules</summary><p className="mt-2">On time until the displayed on-time deadline. Late: 4 hours. Missing Time Out: 2 hours, or 6 hours if also late. Absent: 8 hours total for each required attendance period.</p></details>
  </div>;
}

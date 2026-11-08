import React, { useState } from "react";
import SessionSetupEditor, { AttendanceTimeGroup } from "./SessionSetupEditor";
import AttendanceScheduleGuide from "./AttendanceScheduleGuide";
import { attendanceSetupIssue, attendanceBoundaryIssue } from "../../utils/attendanceSessions";
import { applyEventField } from "../../utils/academicPeriods";
import { Button, Card } from "../ui";
import EventAcademicFields from "./EventAcademicFields";
import TimePicker from "../ui/TimePicker";
import "../../styles/event-create-form.css";

export default function EventCreateForm({ value, onChange, onSubmit, busy, error, idPrefix = "event" }) {
  const [validationError, setValidationError] = useState("");
  const change = e => { setValidationError(attendanceBoundaryIssue(applyEventField(value, e.target))); onChange(e); };
  const submit = e => { const issue = attendanceSetupIssue(value); if (issue) { e.preventDefault(); setValidationError(issue); return; } onSubmit(e); };
  const field = (name, label, type = "text", required = false, placeholder) => (
    <div className="event-create-field">
      <label className="field-label" htmlFor={`${idPrefix}-${name}`}>{label}</label>
      {type === "time" ? <TimePicker id={`${idPrefix}-${name}`} name={name} value={name === "endDate" ? value.endDate || value.date || "" : value[name]} onChange={change} required={required} disabled={busy} /> : <input id={`${idPrefix}-${name}`} name={name} type={type} value={name === "endDate" ? value.endDate || value.date || "" : value[name]}
        onChange={change} required={required} placeholder={placeholder}
        min={type === "date" ? name === "endDate" && value.date >= "2026-01-01" ? value.date : "2026-01-01" : undefined}
        className={type === "date" ? "field-datetime" : "field"} />}
    </div>
  );

  return (
    <Card as="form" onSubmit={submit} className="event-create-form" aria-label="Create event">
      {(validationError || error) && <div className="alert alert-danger mb-4" role="alert"><span aria-hidden="true">!</span><p>{validationError || error}</p></div>}
      <AttendanceScheduleGuide issue={validationError} onClose={() => setValidationError('')} />
      <div className="mb-4"><EventAcademicFields value={value} onChange={change} creating disabled={busy}/></div>
      <div className="event-create-layout">
        <fieldset className="event-create-section">
          <legend>Event details</legend>
          <div className="event-create-details">
            {field("title", "Event title", "text", true, "e.g. Department assembly")}
            {field("location", "Location", "text", false, "Venue or address")}
            <div className="event-create-description">
              <label htmlFor={`${idPrefix}-description`} className="field-label">Description <span className="font-normal text-on-muted">(optional)</span></label>
              <textarea id={`${idPrefix}-description`} name="description" value={value.description}
                onChange={change} rows={3} className="field" placeholder="What should students know?" />
            </div>
          </div>
        </fieldset>
        <fieldset className="event-create-section">
          <legend>Schedule</legend>
          <div className="event-create-schedule">
            <div className="space-y-3">
              <div className="event-create-pair">{field("date", "Start date", "date", true)}{field("time", "Start time", "time", true)}</div>
              {value.date && value.time && <AttendanceTimeGroup value={value} onChange={change} groupId="timeIn" followEventDate disabled={busy} />}
            </div>
            <div className="space-y-3">
              <div className="event-create-pair">
                {field("endDate", "End date", "date", true)}
                {field("endTime", "End time", "time", true)}
              </div>
              {(value.endDate || value.date) && value.endTime && <AttendanceTimeGroup value={value} onChange={change} groupId="timeOut" followEventDate disabled={busy} />}
            </div>
          </div>
        </fieldset>
      </div>
      <div className="mt-4"><SessionSetupEditor value={value} onChange={change} disabled={busy} extrasOnly /></div>
      <div className="event-create-footer">
        <p className="text-xs text-on-muted">Events must be dated 2026 onward. All times use Philippine time.</p>
        <Button type="submit" loading={busy}>{busy ? "Creating..." : "Create event"}</Button>
      </div>
    </Card>
  );
}

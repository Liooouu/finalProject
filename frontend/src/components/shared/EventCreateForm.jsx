import React from "react";
import { Button, Card } from "../ui";
import TimePicker from "../ui/TimePicker";
import "../../styles/event-create-form.css";

export default function EventCreateForm({ value, onChange, onSubmit, busy, error, idPrefix = "event" }) {
  const field = (name, label, type = "text", required = false, placeholder) => (
    <div className="event-create-field">
      <label className="field-label" htmlFor={`${idPrefix}-${name}`}>{label}</label>
      {type === "time" ? <TimePicker id={`${idPrefix}-${name}`} name={name} value={value[name]} onChange={onChange} required={required} disabled={busy} /> : <input id={`${idPrefix}-${name}`} name={name} type={type} value={value[name]}
        onChange={onChange} required={required} placeholder={placeholder}
        className={type === "date" ? "field-datetime" : "field"} />}
    </div>
  );

  return (
    <Card as="form" onSubmit={onSubmit} className="event-create-form" aria-label="Create event">
      {error && <div className="alert alert-danger mb-4" role="alert"><span aria-hidden="true">!</span><p>{error}</p></div>}
      <div className="event-create-layout">
        <fieldset className="event-create-section">
          <legend>Event details</legend>
          <div className="event-create-details">
            {field("title", "Event title", "text", true, "e.g. Department assembly")}
            {field("location", "Location", "text", false, "Venue or address")}
            <div className="event-create-description">
              <label htmlFor={`${idPrefix}-description`} className="field-label">Description <span className="font-normal text-on-muted">(optional)</span></label>
              <textarea id={`${idPrefix}-description`} name="description" value={value.description}
                onChange={onChange} rows={3} className="field" placeholder="What should students know?" />
            </div>
          </div>
        </fieldset>
        <fieldset className="event-create-section">
          <legend>Schedule</legend>
          <div className="event-create-schedule">
            <div className="event-create-pair">
              {field("date", "Start date", "date", true)}
              {field("time", "Start time", "time", true)}
            </div>
            <div>
              <div className="event-create-pair">
                {field("endDate", "End date", "date")}
                {field("endTime", "End time", "time")}
              </div>
              <p className="field-hint">Leave both blank to end at 11:59 PM on the start date.</p>
            </div>
            <div>
              <div className="event-create-pair">
                {field("attendanceStartTime", "Attendance opens", "time", true)}
                {field("attendanceEndTime", "On-time deadline", "time", true)}
              </div>
              <p className="field-hint">Later check-ins may be marked late.</p>
            </div>
          </div>
        </fieldset>
      </div>
      <div className="event-create-footer">
        <p className="text-xs text-on-muted">All dates and times use Philippine time.</p>
        <Button type="submit" loading={busy}>{busy ? "Creating..." : "Create event"}</Button>
      </div>
    </Card>
  );
}

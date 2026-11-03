import React, { useRef, useState } from "react";
import { FaClock } from "react-icons/fa";
import Button from "./Button";
import "../../styles/time-picker.css";

function splitTime(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(value || "");
  const hour = match ? Number(match[1]) : 9;
  return { hour: String(hour % 12 || 12), minute: match?.[2] || "00", period: hour >= 12 ? "PM" : "AM" };
}

export default function TimePicker({ id, name, value = "", onChange, required, disabled, className = "field-datetime" }) {
  const dialog = useRef(null);
  const trigger = useRef(null);
  const [draft, setDraft] = useState(() => splitTime(value));
  const labelId = `${id}-picker-title`;
  const valid = /^\d{1,2}$/.test(draft.hour) && Number(draft.hour) >= 1 && Number(draft.hour) <= 12 &&
    /^\d{1,2}$/.test(draft.minute) && Number(draft.minute) <= 59;
  const display = value ? splitTime(value) : null;

  const open = () => {
    if (disabled || document.querySelector(".tracked-time-dialog[open]")) return;
    setDraft(splitTime(value));
    dialog.current.showModal();
    dialog.current.querySelector("input")?.focus();
  };
  const close = () => { dialog.current.close(); trigger.current.focus(); };
  const apply = () => {
    if (!valid) return;
    const hour = Number(draft.hour) % 12 + (draft.period === "PM" ? 12 : 0);
    onChange({ target: { name, value: `${String(hour).padStart(2, "0")}:${draft.minute.padStart(2, "0")}` } });
    close();
  };

  return <>
    {/* A real constraint-validation field preserves required form behavior. */}
    <input className="sr-only" tabIndex={-1} aria-hidden="true" name={name} value={value} required={required}
      disabled={disabled} onChange={() => {}} onInvalid={event => {
        event.preventDefault();
        if (event.currentTarget.form?.querySelector("input:invalid, textarea:invalid, select:invalid") === event.currentTarget) open();
      }} />
    <button ref={trigger} id={id} type="button" disabled={disabled} onClick={open}
      aria-haspopup="dialog" aria-describedby={`${id}-value`}
      className={`${className} tracked-time-trigger`}>
      <span id={`${id}-value`} className={display ? "" : "text-on-muted"}>{display ? `${display.hour}:${display.minute} ${display.period}` : "Select time"}</span>
      <FaClock aria-hidden="true" className="text-on-muted" />
    </button>
    <dialog ref={dialog} className="tracked-time-dialog" aria-labelledby={labelId}
      onKeyDown={event => { if (event.key === "Enter" && event.target.tagName === "INPUT") { event.preventDefault(); apply(); } }}>
      <h2 id={labelId} className="text-base font-semibold">Set time</h2>
      <p className="mt-1 text-sm text-on-muted">Philippine time · choose a time, then select Set.</p>
      <div className="tracked-time-parts">
        <label>Hour<input className="tracked-time-input" inputMode="numeric" autoComplete="off" maxLength={2}
          value={draft.hour} onChange={event => setDraft({ ...draft, hour: event.target.value })} /></label>
        <span aria-hidden="true">:</span>
        <label>Minute<input className="tracked-time-input" inputMode="numeric" autoComplete="off" maxLength={2}
          value={draft.minute} onChange={event => setDraft({ ...draft, minute: event.target.value })} /></label>
      </div>
      <div className="tracked-time-period" role="group" aria-label="AM or PM">
        {["AM", "PM"].map(period => <Button key={period} type="button" variant={draft.period === period ? "primary" : "secondary"}
          aria-pressed={draft.period === period} onClick={() => setDraft({ ...draft, period })}>{period}</Button>)}
      </div>
      {!valid && <p className="mt-3 text-sm text-danger" role="status">Enter an hour from 1–12 and minutes from 00–59.</p>}
      <div className="tracked-time-actions">
        {!required && value && <Button type="button" variant="ghost" onClick={() => { onChange({ target: { name, value: "" } }); close(); }}>Clear</Button>}
        <Button type="button" variant="secondary" onClick={close}>Cancel</Button>
        <Button type="button" disabled={!valid} onClick={apply}>Set</Button>
      </div>
    </dialog>
  </>;
}

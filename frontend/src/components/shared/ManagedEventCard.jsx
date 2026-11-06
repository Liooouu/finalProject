import React from "react";
import { FaMapMarkerAlt, FaUsers } from "react-icons/fa";
import { Card, StatusChip } from "../ui";
import EventLastEdit from "./EventLastEdit";
import { describeEventLifecycle, formatDate, formatTime12Hour } from "../../utils/helpers";
import "../../styles/managed-event-cards.css";

/** Shared rows align adjacent event cards while allowing complete, wrapping text. */
export default function ManagedEventCard({ event, actions, details, showAttendees = false }) {
  return <Card as="article" className="managed-event-card">
    <header className="managed-event-heading"><h3>{event.title}</h3><StatusChip status={event.status} /></header>
    <p className="managed-event-description">{event.description || "No description provided."}</p>
    <dl className="managed-event-details">
      <div><dt>Starts</dt><dd>{formatDate(event.date)}<br />{formatTime12Hour(event.time)}</dd></div>
      <div><dt>Ends</dt><dd>{formatDate(event.endDate || event.date)}<br />{formatTime12Hour(event.endTime || "23:59")}</dd></div>
      <div className="managed-event-wide"><dt><FaMapMarkerAlt aria-hidden="true" /> Venue</dt><dd>{event.location || "Venue unavailable"}</dd></div>
      <div className="managed-event-wide"><dt>Attendance window</dt><dd>{formatTime12Hour(event.attendanceStartTime) || "TBA"} – {formatTime12Hour(event.attendanceEndTime) || "TBA"}</dd></div>
    </dl>
    <p className="managed-event-organizer"><FaUsers aria-hidden="true" /><span>{event.organizer?.name || "Unknown organizer"}{showAttendees && <span className="block mt-1">{event.attendeeCount ?? 0} checked in</span>}</span></p>
    <div className="managed-event-editor"><EventLastEdit event={event} /></div>
    <div className="managed-event-extra">{details}<span className="sr-only">{describeEventLifecycle(event)}</span></div>
    <div className="managed-event-actions">{actions}</div>
  </Card>;
}

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/axios";
import { usePageMeta } from "../../context/PageMetaContext";
import { Card, PageHeader, StatusChip } from "../ui";
import Loading from "../shared/Loading";
import EmptyState from "../shared/EmptyState";
import OrgManageAttendees from "./OrgManageAttendees";
import IdPhotoCheckin from "./IdPhotoCheckin";
import { formatDate, formatDateTime, formatTime12Hour } from "../../utils/helpers";
import { useAutoRefresh } from "../../utils/useAutoRefresh";

export default function ManualAttendance() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const request = useRef(0);
  usePageMeta("Manual attendance", "Photograph IDs for supervised check-in; review exceptions and corrections.");
  const refreshEvents = useCallback(async () => {
    const current = ++request.current;
    try {
      const { data } = await api.get("/events/all", { timeout: 15000 });
      if (current !== request.current) return;
      setEvents([...data].sort((a, b) => new Date(b.date) - new Date(a.date)));
      setError(false);
    } catch {
      if (current === request.current) setError(true);
    } finally {
      if (current === request.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    refreshEvents();
    return () => { request.current += 1; };
  }, [refreshEvents]);
  useAutoRefresh(refreshEvents, { interval: 30000 });
  if (loading) return <Loading label="Loading attendance events..." />;
  const selected = events.find(event => event._id === id);
  return <div className="space-y-4">
    <PageHeader title="Manual attendance" subtitle="Choose an event to start checking in students." />
    {error && <div role="status" className="alert alert-warn">Could not refresh events. TrackED will retry automatically.</div>}
    {!events.length ? !error && <EmptyState title="No events available" description="Events from all organizers and administrators will appear here." /> : <>
      <Card padding="sm">
        <div className="mb-2 flex items-center justify-between gap-3"><label htmlFor="manual-event" className="field-label mb-0">Event</label>{selected && <StatusChip status={selected.status} />}</div>
        <select id="manual-event" aria-label="Manual attendance event" className="field-select w-full" value={selected?._id || ""} onChange={e => navigate(`/organizer/dashboard/manual-attendance/${e.target.value}`)}><option value="" disabled>Choose an event</option>{events.map(event => <option key={event._id} value={event._id}>{event.title} · {formatDate(event.date)}</option>)}</select>
        {selected && !selected.attendanceSessions?.length && <p className="mt-2 text-xs text-on-muted">Attendance: {selected.attendanceWindow?.start ? formatDateTime(selected.attendanceWindow.start) : `${formatDate(selected.date)} at ${formatTime12Hour(selected.attendanceStartTime)}`} – {selected.attendanceWindow?.end ? formatDateTime(selected.attendanceWindow.end) : formatTime12Hour(selected.attendanceEndTime)} · Philippine time</p>}
      </Card>
      {selected ? <OrgManageAttendees key={selected._id} event={selected} embedded /> : id ? <div role="alert" className="alert alert-danger">This event is unavailable or you do not have permission to manage it.</div> : <EmptyState compact title="Choose an event to begin" description="Assigned organizers can capture IDs and submit corrections for admin review." />}
    </>}
    {!selected && <IdPhotoCheckin />}
  </div>;
}

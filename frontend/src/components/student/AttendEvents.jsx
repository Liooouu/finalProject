import React, { useState, useEffect, useMemo, useCallback } from "react";
import api from "../../api/axios";
import { useAutoRefresh } from "../../utils/useAutoRefresh";
import { splitEventsByLifecycle } from "../../utils/helpers";
import { FaCalendarAlt } from "react-icons/fa";
import StudentEventCard from "./StudentEventCard";
import { usePageMeta } from "../../context/PageMetaContext";
import {
  PageHeader,
  SegmentedControl,
} from "../ui";
import Loading from "../shared/Loading";
import EmptyState from "../shared/EmptyState";

const TABS = [
  { key: "active", label: "Upcoming" },
  { key: "past", label: "Past events" },
];

const AttendEvents = () => {
  const [events, setEvents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [attendanceError, setAttendanceError] = useState(false);
  const [eventsError, setEventsError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("active");

  usePageMeta("Events", "Browse and attend events.");

  const fetchEvents = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [eventsResult, attendanceResult] = await Promise.allSettled([
        api.get("/events"), api.get("/events/my-attendance"),
      ]);
      if (eventsResult.status === "fulfilled") {
        setEvents(eventsResult.value.data);
        setEventsError(false);
      } else setEventsError(true);
      if (attendanceResult.status === "fulfilled") {
        setAttendance(attendanceResult.value.data);
        setAttendanceError(false);
      } else setAttendanceError(true);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useAutoRefresh(fetchEvents);

  const { active, past } = useMemo(() => splitEventsByLifecycle(events), [events]);
  const visible = tab === "active" ? active : past;

  if (loading) {
    return <Loading label="Loading events..." />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Student events"
        title="Find your next event"
        subtitle="Full event details and your recorded attendance, all in one place."
        actions={
          <SegmentedControl
            ariaLabel="Event timeframe"
            value={tab}
            onChange={setTab}
            options={TABS.map((item) => ({
              value: item.key,
              label: item.label,
              count: item.key === "active" ? active.length : past.length,
            }))}
          />
        }
      />

      {eventsError && <div role="alert" className="alert alert-danger">Events could not be refreshed. Please reload to try again.</div>}
      {visible.length === 0 ? (
        <EmptyState
          icon={<FaCalendarAlt />}
          title={eventsError ? "Events unavailable" : tab === "active" ? "No upcoming events" : "No past events"}
          description={
            eventsError ? "Please reload to try again." : tab === "active"
              ? "Check back soon — new events will show up here."
              : "Events you have already attended or missed will be listed here."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((event) => <StudentEventCard key={event._id} event={event} attendance={attendance.find((record) => (record.event?._id || record.event) === event._id)} attendanceError={attendanceError} />)}
        </div>
      )}
    </div>
  );
};

export default AttendEvents;

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
import Pagination from "../ui/Pagination";
import StablePage from "../ui/StablePage";
import { readScreen, writeScreen } from "../../utils/queryCache";

const CACHE_KEY = "student:events";

const TABS = [
  { key: "active", label: "Upcoming" },
  { key: "past", label: "Past events" },
];

const AttendEvents = () => {
  const seed = readScreen(CACHE_KEY);
  const [events, setEvents] = useState(seed?.events ?? []);
  const [attendance, setAttendance] = useState(seed?.attendance ?? []);
  const [attendanceError, setAttendanceError] = useState(seed?.attendanceError ?? false);
  const [eventsError, setEventsError] = useState(seed?.eventsError ?? false);
  const [loading, setLoading] = useState(seed === undefined);
  const [tab, setTab] = useState("active");
  const [page, setPage] = useState(1);

  usePageMeta("Events", "Browse and attend events.");

  const fetchEvents = useCallback(async ({ silent = false } = {}) => {
    const previous = readScreen(CACHE_KEY);
    if (!silent && previous === undefined) setLoading(true);
    let next = previous ? { ...previous } : {};
    try {
      const [eventsResult, attendanceResult] = await Promise.allSettled([
        api.get("/events"), api.get("/events/my-attendance"),
      ]);
      if (eventsResult.status === "fulfilled") {
        setEvents(eventsResult.value.data);
        setEventsError(false);
        next = { ...next, events: eventsResult.value.data, eventsError: false };
      } else {
        setEventsError(true);
        next = { ...next, eventsError: true };
      }
      if (attendanceResult.status === "fulfilled") {
        setAttendance(attendanceResult.value.data);
        setAttendanceError(false);
        next = { ...next, attendance: attendanceResult.value.data, attendanceError: false };
      } else {
        setAttendanceError(true);
        next = { ...next, attendanceError: true };
      }
      writeScreen(CACHE_KEY, next);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useAutoRefresh(fetchEvents, { interval: 30000 });

  const { active, past } = useMemo(() => splitEventsByLifecycle(events), [events]);
  const visible = tab === "active" ? active : past;
  const currentPage = Math.min(page, Math.max(1, Math.ceil(visible.length / 5)));
  const pageEvents = visible.slice((currentPage - 1) * 5, currentPage * 5);

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
            onChange={value => { setTab(value); setPage(1); }}
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
        <StablePage pageKey={`student-events:${tab}`} footer={<Pagination page={currentPage} pageSize={5} total={visible.length} onChange={setPage} label="Student event pages" />}><div className="student-event-grid grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {pageEvents.map((event) => <StudentEventCard key={event._id} event={event} attendance={attendance.find((record) => (record.event?._id || record.event) === event._id)} attendanceError={attendanceError} />)}
        </div></StablePage>
      )}
    </div>
  );
};

export default AttendEvents;

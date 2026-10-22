import React, { useState, useEffect, useCallback, useMemo } from "react";
import api from "../../api/axios";
import { useTheme } from "../../context/ThemeContext";
import { usePageMeta } from "../../context/PageMetaContext";
import {
  Button,
  Card,
  ChartCard,
  FlightPanel,
  PageHeader,
  ProgressBar,
  ProgressRing,
  StatTile,
  StatusChip,
  TableSkeleton,
  Tabs,
} from "../ui";
import { formatDate, formatTime12Hour } from "../../utils/helpers";
import {
  FaCalendarAlt,
  FaCheckCircle,
  FaClipboardList,
  FaClock,
  FaFlagCheckered,
  FaPercent,
  FaPlayCircle,
  FaShieldAlt,
  FaTimesCircle,
  FaUserGraduate,
  FaUsers,
  FaUserTie,
} from "react-icons/fa";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const EMPTY_FILTERS = { program: "all", yearLevel: "all", section: "all", eventId: "all" };
const YEAR_LABELS = { 1: "1st Year", 2: "2nd Year", 3: "3rd Year", 4: "4th Year" };

const REPORT_CHART_DARK = {
  present: "#34d399",
  late: "#fbbf24",
  absent: "#fb7185",
  pending: "#94a3b8",
  excused: "#38bdf8",
  brand: "#a5b4fc",
  brand2: "#c4b5fd",
  cyan: "#67e8f9",
  info: "#93c5fd",
};
const REPORT_CHART_LIGHT = {
  present: "#059669",
  late: "#d97706",
  absent: "#dc2626",
  pending: "#64748b",
  excused: "#0284c7",
  brand: "#4f46e5",
  brand2: "#7c3aed",
  cyan: "#0891b2",
  info: "#1d4ed8",
};

const AttendanceReports = () => {
  const [activeTab, setActiveTab] = useState("attendance");
  const [attendanceData, setAttendanceData] = useState(null);
  const [eventsData, setEventsData] = useState(null);
  const [usersData, setUsersData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filterOptions, setFilterOptions] = useState({
    programs: [],
    yearLevels: [1, 2, 3, 4],
    sections: [],
    events: [],
  });
  const { isDark } = useTheme();

  usePageMeta("Reports", "System-wide analytics, breakdowns, and exports.");

  const attendanceParams = useMemo(() => {
    const params = {};
    if (filters.program !== "all") params.program = filters.program;
    if (filters.yearLevel !== "all") params.yearLevel = filters.yearLevel;
    if (filters.section !== "all") params.section = filters.section;
    if (filters.eventId !== "all") params.eventId = filters.eventId;
    return params;
  }, [filters]);

  const hasActiveFilters = Object.values(filters).some((value) => value !== "all");

  const fetchAttendance = useCallback(
    async (signal) => {
      setAttendanceLoading(true);
      setAttendanceError("");
      try {
        const res = await api.get("/reports/attendance", { params: attendanceParams, signal });
        setAttendanceData(res.data);
        if (res.data.filters) setFilterOptions(res.data.filters);
      } catch (err) {
        if (err.code === "ERR_CANCELED") return;
        setAttendanceError(
          err.response?.data?.message || err.message || "Could not load attendance report"
        );
      } finally {
        if (!signal?.aborted) setAttendanceLoading(false);
      }
    },
    [attendanceParams]
  );

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/reports/events");
      setEventsData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/reports/users");
      setUsersData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== "attendance") return undefined;
    const controller = new AbortController();
    fetchAttendance(controller.signal);
    return () => controller.abort();
  }, [activeTab, fetchAttendance]);

  useEffect(() => {
    if (activeTab === "events" && !eventsData) fetchEvents();
    if (activeTab === "users" && !usersData) fetchUsers();
  }, [activeTab, eventsData, usersData, fetchEvents, fetchUsers]);

  const downloadCSV = async (type) => {
    setExporting(true);
    try {
      const params = type === "attendance" ? attendanceParams : undefined;
      const response = await api.get(`/reports/${type}/export`, {
        params,
        responseType: "blob",
      });
      const disposition = response.headers["content-disposition"] || "";
      const filenameMatch =
        disposition.match(/filename="([^"]+)"/i) || disposition.match(/filename=([^;]+)/i);
      const filename = filenameMatch ? filenameMatch[1].trim() : `${type}-report.csv`;
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      if (type === "attendance") {
        setAttendanceError("Could not download the filtered attendance CSV.");
      }
    } finally {
      setExporting(false);
    }
  };

  const palette = isDark ? REPORT_CHART_DARK : REPORT_CHART_LIGHT;
  const chartText = isDark ? "#94a3b8" : "#64748b";
  const chartGrid = isDark ? "rgba(148, 163, 184, 0.12)" : "rgba(15, 23, 42, 0.07)";
  const tooltipStyle = {
    backgroundColor: "#0f172a",
    titleColor: "#f8fafc",
    bodyColor: "#cbd5e1",
    borderColor: isDark ? "rgba(148, 163, 184, 0.24)" : "rgba(15, 23, 42, 0.1)",
    borderWidth: 1,
    padding: 10,
    displayColors: false,
    cornerRadius: 8,
  };

  const horizontalBarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "y",
    interaction: { mode: "index", intersect: false },
    plugins: { legend: { display: false }, tooltip: tooltipStyle },
    scales: {
      x: {
        stacked: true,
        beginAtZero: true,
        border: { display: false },
        grid: { color: chartGrid },
        ticks: { color: chartText, font: { size: 10 }, precision: 0 },
      },
      y: {
        stacked: true,
        border: { display: false },
        grid: { display: false },
        ticks: { color: chartText, font: { size: 10 }, autoSkip: false },
      },
    },
  };

  const rankedBarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "y",
    plugins: { legend: { display: false }, tooltip: tooltipStyle },
    scales: {
      x: {
        beginAtZero: true,
        max: 100,
        border: { display: false },
        grid: { color: chartGrid },
        ticks: {
          color: chartText,
          font: { size: 10 },
          callback: (value) => `${value}%`,
        },
      },
      y: {
        border: { display: false },
        grid: { display: false },
        ticks: { color: chartText, font: { size: 10 }, autoSkip: false },
      },
    },
  };

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "74%",
    plugins: { legend: { display: false }, tooltip: tooltipStyle },
  };

  const statusRows = attendanceData
    ? [
        { key: "present", label: "Present", value: attendanceData.stats.present, color: palette.present },
        { key: "late", label: "Late", value: attendanceData.stats.late, color: palette.late },
        { key: "absent", label: "Absent", value: attendanceData.stats.absent, color: palette.absent },
        { key: "pending", label: "Pending", value: attendanceData.stats.pending, color: palette.pending },
        { key: "excused", label: "Excused", value: attendanceData.stats.excused, color: palette.excused },
      ].map((row) => ({
        ...row,
        pct: attendanceData.stats.total
          ? Math.round((row.value / attendanceData.stats.total) * 100)
          : 0,
      }))
    : [];

  const attendedCount = attendanceData
    ? attendanceData.stats.present + attendanceData.stats.late
    : 0;
  const attendanceRate = attendanceData?.stats.total
    ? Math.round((attendedCount / attendanceData.stats.total) * 100)
    : 0;

  const eventLeaders = attendanceData
    ? attendanceData.byEvent
        .filter((event) => event.total > 0)
        .slice()
        .sort((a, b) => b.attendanceRate - a.attendanceRate)
        .slice(0, 5)
    : [];

  const attendanceChartData = statusRows.length
    ? {
        labels: statusRows.map((row) => row.label),
        datasets: [
          {
            data: statusRows.map((row) => row.value),
            backgroundColor: statusRows.map((row) => row.color),
            borderWidth: 0,
            hoverOffset: 4,
          },
        ],
      }
    : null;

  const byEventChartRows = attendanceData ? attendanceData.byEvent.slice(0, 8) : [];
  const attendanceByEventData = attendanceData
    ? {
        labels: byEventChartRows.map((event) =>
          event.eventTitle.length > 24
            ? `${event.eventTitle.substring(0, 24)}...`
            : event.eventTitle
        ),
        datasets: [
          {
            label: "Present",
            data: byEventChartRows.map((event) => event.present),
            backgroundColor: palette.present,
          },
          {
            label: "Late",
            data: byEventChartRows.map((event) => event.late),
            backgroundColor: palette.late,
          },
          {
            label: "Absent",
            data: byEventChartRows.map((event) => event.absent),
            backgroundColor: palette.absent,
          },
          {
            label: "Pending",
            data: byEventChartRows.map((event) => event.pending),
            backgroundColor: palette.pending,
          },
          {
            label: "Excused",
            data: byEventChartRows.map((event) => event.excused),
            backgroundColor: palette.excused,
          },
        ],
      }
    : null;

  const eventStatusRows = eventsData
    ? [
        { label: "Upcoming", value: eventsData.stats.upcoming, color: palette.info },
        { label: "Live", value: eventsData.stats.live, color: palette.present },
        { label: "Finished", value: eventsData.stats.finished ?? 0, color: palette.pending },
        { label: "Closed", value: eventsData.stats.closed, color: palette.absent },
      ].map((row) => ({
        ...row,
        pct: eventsData.stats.total
          ? Math.round((row.value / eventsData.stats.total) * 100)
          : 0,
      }))
    : [];

  const eventStatusData = eventStatusRows.length
    ? {
        labels: eventStatusRows.map((row) => row.label),
        datasets: [
          {
            data: eventStatusRows.map((row) => row.value),
            backgroundColor: eventStatusRows.map((row) => row.color),
            borderWidth: 0,
            hoverOffset: 4,
          },
        ],
      }
    : null;

  const eventRankedRows = eventsData
    ? eventsData.events
        .slice()
        .sort((a, b) => b.attendanceRate - a.attendanceRate)
        .slice(0, 8)
    : [];

  const eventRateData = eventRankedRows.length
    ? {
        labels: eventRankedRows.map((event) =>
          event.title.length > 26 ? `${event.title.substring(0, 26)}...` : event.title
        ),
        datasets: [
          {
            label: "Attendance rate",
            data: eventRankedRows.map((event) => event.attendanceRate),
            backgroundColor: palette.brand,
            borderRadius: 6,
            borderSkipped: false,
            barPercentage: 0.62,
          },
        ],
      }
    : null;

  const roleRows = usersData
    ? [
        {
          label: "Students",
          value: usersData.stats.student,
          color: palette.brand2,
          tone: "brand",
        },
        {
          label: "Organizers",
          value: usersData.stats.organizer,
          color: palette.late,
          tone: "warn",
        },
        { label: "Admins", value: usersData.stats.admin, color: palette.cyan, tone: "ok" },
      ].map((row) => ({
        ...row,
        pct: usersData.stats.total
          ? Math.round((row.value / usersData.stats.total) * 100)
          : 0,
      }))
    : [];

  const usersRoleData = roleRows.length
    ? {
        labels: roleRows.map((row) => row.label),
        datasets: [
          {
            data: roleRows.map((row) => row.value),
            backgroundColor: roleRows.map((row) => row.color),
            borderWidth: 0,
            hoverOffset: 4,
          },
        ],
      }
    : null;

  const roleStyles = {
    admin: "border-brand/25 bg-brand/10 text-brand",
    organizer: "border-warn/25 bg-warn/10 text-warn",
    student: "border-info/25 bg-info/10 text-info",
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Analytics"
        title="Reports"
        subtitle="Attendance, events, and account totals across the institution."
      />

      <Tabs
        active={activeTab}
        onChange={setActiveTab}
        tabs={[
          { key: "attendance", label: "Attendance" },
          { key: "events", label: "Events" },
          { key: "users", label: "Users" },
        ]}
      />

      {loading && !attendanceData && !eventsData && !usersData && (
        <Card>
          <TableSkeleton rows={5} />
        </Card>
      )}

      {activeTab === "attendance" && (
        <>
          <Card>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[150px] flex-1">
                <label htmlFor="attendance-program" className="field-label">
                  Program
                </label>
                <select
                  id="attendance-program"
                  value={filters.program}
                  onChange={(e) => setFilters((prev) => ({ ...prev, program: e.target.value }))}
                  className="field-select"
                >
                  <option value="all">All programs</option>
                  {filterOptions.programs.map((program) => (
                    <option key={program} value={program}>
                      {program}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-[150px] flex-1">
                <label htmlFor="attendance-year" className="field-label">
                  Year level
                </label>
                <select
                  id="attendance-year"
                  value={filters.yearLevel}
                  onChange={(e) => setFilters((prev) => ({ ...prev, yearLevel: e.target.value }))}
                  className="field-select"
                >
                  <option value="all">All year levels</option>
                  {(filterOptions.yearLevels || [1, 2, 3, 4]).map((year) => (
                    <option key={year} value={year}>
                      {YEAR_LABELS[year] || `Year ${year}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-[150px] flex-1">
                <label htmlFor="attendance-section" className="field-label">
                  Section
                </label>
                <select
                  id="attendance-section"
                  value={filters.section}
                  onChange={(e) => setFilters((prev) => ({ ...prev, section: e.target.value }))}
                  className="field-select"
                >
                  <option value="all">All sections</option>
                  {filterOptions.sections.map((section) => (
                    <option key={section} value={section}>
                      Section {section}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-[220px] flex-[1.5]">
                <label htmlFor="attendance-event" className="field-label">
                  Event
                </label>
                <select
                  id="attendance-event"
                  value={filters.eventId}
                  onChange={(e) => setFilters((prev) => ({ ...prev, eventId: e.target.value }))}
                  className="field-select"
                >
                  <option value="all">All events</option>
                  {filterOptions.events.map((event) => (
                    <option key={event._id} value={event._id}>
                      {event.title} — {formatDate(event.date)}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                variant="ghost"
                onClick={() => setFilters(EMPTY_FILTERS)}
                disabled={!hasActiveFilters}
                className="w-full sm:w-auto"
              >
                Reset filters
              </Button>
            </div>
            {attendanceLoading && attendanceData && (
              <p className="mt-3 text-xs text-on-muted">Updating results…</p>
            )}
          </Card>

          {attendanceError && (
            <div role="alert" className="alert alert-danger">
              {attendanceError}
            </div>
          )}

          {attendanceLoading && !attendanceData && (
            <Card>
              <TableSkeleton rows={5} />
            </Card>
          )}

          {attendanceData && (
            <>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <StatTile
                  label="Enrolled students"
                  value={attendanceData.stats.students ?? 0}
                  icon={<FaUsers />}
                  hint={`${attendanceData.stats.studentsWithRecords ?? 0} with records`}
                  tone="brand"
                />
                <StatTile
                  label="Attendance records"
                  value={attendanceData.stats.total}
                  icon={<FaClipboardList />}
                  hint={`${attendanceData.stats.studentsWithRecords ?? 0} students represented`}
                  tone="info"
                />
                <StatTile
                  label="Attended"
                  value={attendedCount}
                  icon={<FaCheckCircle />}
                  hint={`${attendanceRate}% of matching records`}
                  tone="ok"
                />
                <StatTile
                  label="Attendance rate"
                  value={`${attendanceRate}%`}
                  icon={<FaPercent />}
                  hint={`${attendedCount} of ${attendanceData.stats.total} records`}
                  tone={attendanceRate >= 75 ? "ok" : attendanceRate >= 50 ? "warn" : "danger"}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                <ChartCard
                  className="xl:col-span-8"
                  title="Attendance by event"
                  subtitle="Status mix for the latest events in this filter"
                  actions={
                    <span className="num rounded-full border border-line bg-card-alt/60 px-2.5 py-1 text-[10px] font-medium text-on-muted">
                      {byEventChartRows.length} events
                    </span>
                  }
                  legend={statusRows.map((row) => (
                    <span
                      key={row.key}
                      className="inline-flex items-center gap-1.5 text-[11px] text-on-dim"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: row.color }}
                        aria-hidden="true"
                      />
                      {row.label}
                    </span>
                  ))}
                >
                  {byEventChartRows.length ? (
                    <div className="h-[320px]">
                      <Bar data={attendanceByEventData} options={horizontalBarOptions} />
                    </div>
                  ) : (
                    <div className="flex h-[320px] items-center justify-center rounded-xl border border-dashed border-line text-sm text-on-muted">
                      No attendance records match these filters.
                    </div>
                  )}
                </ChartCard>

                <ChartCard
                  className="xl:col-span-4"
                  title="Status distribution"
                  subtitle="Share of every matching record"
                  actions={
                    <span className="num rounded-full border border-line bg-card-alt/60 px-2.5 py-1 text-[10px] font-medium text-on-muted">
                      {attendanceData.stats.total}
                    </span>
                  }
                >
                  <div className="flex h-[320px] flex-col items-center justify-between gap-4">
                    <div className="relative h-[180px] w-[180px] shrink-0">
                      <Doughnut data={attendanceChartData} options={donutOptions} />
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <span className="num font-display text-2xl font-bold leading-none text-on">
                          {attendanceData.stats.total}
                        </span>
                        <span className="mt-1 text-[10px] uppercase tracking-wide text-on-muted">
                          records
                        </span>
                      </div>
                    </div>

                    <ul className="w-full space-y-2">
                      {statusRows.map((row) => (
                        <li key={row.key} className="flex items-center gap-2 text-xs">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: row.color }}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1 truncate text-on-dim">
                            {row.label}
                          </span>
                          <span className="num font-semibold text-on">{row.value}</span>
                          <span className="num w-8 text-right text-on-muted">
                            {row.pct}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </ChartCard>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                <ChartCard
                  className="xl:col-span-4"
                  title="Attendance rate"
                  subtitle="Present and late count as attended"
                >
                  <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-5 py-2">
                    <ProgressRing
                      value={attendanceRate}
                      max={100}
                      size={176}
                      stroke={14}
                      label={`${attendanceRate}%`}
                      sublabel="attended"
                      tone={
                        attendanceRate >= 75 ? "ok" : attendanceRate >= 50 ? "warn" : "danger"
                      }
                    />
                    <div className="grid w-full grid-cols-2 gap-3">
                      <div className="rounded-xl border border-line bg-card-alt/50 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-on-muted">
                          Attended
                        </p>
                        <p className="num mt-1.5 text-xl font-bold text-on">
                          {attendedCount}
                        </p>
                      </div>
                      <div className="rounded-xl border border-line bg-card-alt/50 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-on-muted">
                          Not attended
                        </p>
                        <p className="num mt-1.5 text-xl font-bold text-on">
                          {Math.max(0, attendanceData.stats.total - attendedCount)}
                        </p>
                      </div>
                    </div>
                  </div>
                </ChartCard>

                <ChartCard
                  className="xl:col-span-8"
                  title="Event attendance leaders"
                  subtitle="Highest attendance rates in the current filter"
                  actions={
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card-alt/60 px-2.5 py-1 text-[10px] font-medium text-on-muted">
                      <FaCheckCircle className="text-[10px]" />
                      Top 5
                    </span>
                  }
                >
                  {eventLeaders.length ? (
                    <ul className="space-y-4">
                      {eventLeaders.map((event) => (
                        <li key={event._id || event.eventTitle}>
                          <div className="flex items-center justify-between gap-3">
                            <p className="truncate text-sm font-medium text-on">
                              {event.eventTitle}
                            </p>
                            <span className="num shrink-0 text-sm font-semibold text-on">
                              {event.attendanceRate}%
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-on-muted">
                            <span>{formatDate(event.eventDate)}</span>
                            <span aria-hidden="true">·</span>
                            <span>{event.total} records</span>
                          </div>
                          <ProgressBar
                            className="mt-2"
                            current={event.attendanceRate}
                            target={100}
                            showLabel={false}
                            tone={
                              event.attendanceRate >= 75
                                ? "ok"
                                : event.attendanceRate >= 50
                                  ? "warn"
                                  : "danger"
                            }
                          />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex h-full min-h-[240px] items-center justify-center rounded-xl border border-dashed border-line text-sm text-on-muted">
                      No event attendance to rank yet.
                    </div>
                  )}
                </ChartCard>
              </div>

              <FlightPanel
                level="ledger"
                glass
                flush
                eyebrow="Attendance ledger"
                title="Filtered attendance records"
                subtitle={`Latest ${Math.min(10, attendanceData.records.length)} of ${
                  attendanceData.records.length
                } matching record${
                  attendanceData.records.length === 1 ? "" : "s"
                } — CSV exports the full filtered roster`}
                actions={
                  <Button
                    onClick={() => downloadCSV("attendance")}
                    variant="secondary"
                    size="sm"
                    loading={exporting}
                  >
                    Export filtered CSV
                  </Button>
                }
              >
                <div className="overflow-x-auto">
                  <table className="data-table min-w-[860px]">
                    <thead>
                      <tr>
                        <th>Event</th>
                        <th>Student</th>
                        <th>Program / Year / Section</th>
                        <th>Status</th>
                        <th>Event schedule</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceData.records.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-10 text-center text-sm text-on-muted">
                            No attendance records match these filters.
                          </td>
                        </tr>
                      ) : (
                        attendanceData.records.slice(0, 10).map((r, i) => {
                          const eventDate = r.event?.date || r.eventDate;
                          const program = r.student?.program || "";
                          const year = r.student?.yearLevel;
                          const section = r.student?.section || "";
                          return (
                            <tr key={i}>
                              <td className="text-on">
                                {r.event?.title || r.eventTitle || "N/A"}
                              </td>
                              <td>
                                <p className="font-medium text-on">
                                  {r.student?.name || "N/A"}
                                </p>
                                <p className="mt-0.5 text-xs text-on-muted">
                                  {r.student?.email || "No email"}
                                </p>
                              </td>
                              <td>
                                {program || year || section ? (
                                  <span className="text-on-dim">
                                    {program || "?"} · {YEAR_LABELS[year] || "?"} ·{" "}
                                    {section || "?"}
                                  </span>
                                ) : (
                                  <span className="text-on-muted">Unassigned</span>
                                )}
                              </td>
                              <td>
                                <StatusChip status={r.status} />
                              </td>
                              <td className="whitespace-nowrap">
                                <p className="text-on-dim">
                                  {eventDate ? formatDate(eventDate) : "Date unavailable"}
                                </p>
                                <p className="mt-0.5 text-xs text-on-muted">
                                  {r.event?.time
                                    ? formatTime12Hour(r.event.time)
                                    : "Time unavailable"}
                                </p>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </FlightPanel>
            </>
          )}
        </>
      )}

      {activeTab === "events" && eventsData && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <StatTile
              label="Total events"
              value={eventsData.stats.total}
              icon={<FaCalendarAlt />}
              tone="brand"
            />
            <StatTile
              label="Upcoming"
              value={eventsData.stats.upcoming}
              icon={<FaClock />}
              tone="info"
            />
            <StatTile
              label="Live"
              value={eventsData.stats.live}
              icon={<FaPlayCircle />}
              tone="ok"
            />
            <StatTile
              label="Finished"
              value={eventsData.stats.finished ?? 0}
              icon={<FaFlagCheckered />}
              tone="excused"
            />
            <StatTile
              label="Closed"
              value={eventsData.stats.closed}
              icon={<FaTimesCircle />}
              tone="danger"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <ChartCard
              className="xl:col-span-5"
              title="Events by status"
              subtitle="Current lifecycle of every event"
              actions={
                <span className="num rounded-full border border-line bg-card-alt/60 px-2.5 py-1 text-[10px] font-medium text-on-muted">
                  {eventsData.stats.total}
                </span>
              }
            >
              <div className="flex h-[320px] flex-col items-center justify-between gap-4">
                <div className="relative h-[180px] w-[180px] shrink-0">
                  <Doughnut data={eventStatusData} options={donutOptions} />
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="num font-display text-2xl font-bold leading-none text-on">
                      {eventsData.stats.total}
                    </span>
                    <span className="mt-1 text-[10px] uppercase tracking-wide text-on-muted">
                      events
                    </span>
                  </div>
                </div>

                <ul className="w-full space-y-2">
                  {eventStatusRows.map((row) => (
                    <li key={row.label} className="flex items-center gap-2 text-xs">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: row.color }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate text-on-dim">{row.label}</span>
                      <span className="num font-semibold text-on">{row.value}</span>
                      <span className="num w-8 text-right text-on-muted">{row.pct}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            </ChartCard>

            <ChartCard
              className="xl:col-span-7"
              title="Top events by attendance"
              subtitle="Highest attendance rates across all events"
              actions={
                <span className="num rounded-full border border-line bg-card-alt/60 px-2.5 py-1 text-[10px] font-medium text-on-muted">
                  Top {eventRankedRows.length}
                </span>
              }
            >
              {eventRankedRows.length ? (
                <div className="h-[320px]">
                  <Bar data={eventRateData} options={rankedBarOptions} />
                </div>
              ) : (
                <div className="flex h-[320px] items-center justify-center rounded-xl border border-dashed border-line text-sm text-on-muted">
                  No event attendance to rank yet.
                </div>
              )}
            </ChartCard>
          </div>

          <FlightPanel
            level="ledger"
            glass
            flush
            eyebrow="Event ledger"
            title="All events"
            subtitle={`${eventsData.events.length} event${
              eventsData.events.length === 1 ? "" : "s"
            } in this report`}
            actions={
              <Button onClick={() => downloadCSV("events")} variant="secondary" size="sm">
                Export CSV
              </Button>
            }
          >
            <div className="overflow-x-auto">
              <table className="data-table min-w-[760px]">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Date</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Attendees</th>
                    <th>Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {eventsData.events.map((e) => (
                    <tr key={e._id}>
                      <td className="text-on">{e.title}</td>
                      <td className="whitespace-nowrap">{formatDate(e.date)}</td>
                      <td>{e.location || "N/A"}</td>
                      <td>
                        <StatusChip status={e.status} />
                      </td>
                      <td className="num">{e.totalAttendees}</td>
                      <td className="min-w-[120px]">
                        <p className="num mb-1.5 text-right font-semibold text-on">
                          {e.attendanceRate}%
                        </p>
                        <ProgressBar
                          current={e.attendanceRate}
                          target={100}
                          showLabel={false}
                          tone={
                            e.attendanceRate >= 75
                              ? "ok"
                              : e.attendanceRate >= 50
                                ? "warn"
                                : "danger"
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FlightPanel>
        </>
      )}

      {activeTab === "users" && usersData && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile
              label="Total users"
              value={usersData.stats.total}
              icon={<FaUsers />}
              tone="brand"
            />
            <StatTile
              label="Students"
              value={usersData.stats.student}
              icon={<FaUserGraduate />}
              tone="info"
            />
            <StatTile
              label="Organizers"
              value={usersData.stats.organizer}
              icon={<FaUserTie />}
              tone="warn"
            />
            <StatTile
              label="Admins"
              value={usersData.stats.admin}
              icon={<FaShieldAlt />}
              tone="ok"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <ChartCard
              className="xl:col-span-5"
              title="Users by role"
              subtitle="Every account in the institution"
              actions={
                <span className="num rounded-full border border-line bg-card-alt/60 px-2.5 py-1 text-[10px] font-medium text-on-muted">
                  {usersData.stats.total}
                </span>
              }
            >
              <div className="flex h-[320px] flex-col items-center justify-between gap-4">
                <div className="relative h-[180px] w-[180px] shrink-0">
                  <Doughnut data={usersRoleData} options={donutOptions} />
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="num font-display text-2xl font-bold leading-none text-on">
                      {usersData.stats.total}
                    </span>
                    <span className="mt-1 text-[10px] uppercase tracking-wide text-on-muted">
                      users
                    </span>
                  </div>
                </div>

                <ul className="w-full space-y-2">
                  {roleRows.map((row) => (
                    <li key={row.label} className="flex items-center gap-2 text-xs">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: row.color }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate text-on-dim">{row.label}</span>
                      <span className="num font-semibold text-on">{row.value}</span>
                      <span className="num w-8 text-right text-on-muted">{row.pct}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            </ChartCard>

            <ChartCard
              className="xl:col-span-7"
              title="Role distribution"
              subtitle="Share of all accounts by access level"
            >
              <div className="flex h-[320px] flex-col justify-center gap-6">
                {roleRows.map((row) => (
                  <div key={row.label}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-sm font-medium text-on">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: row.color }}
                          aria-hidden="true"
                        />
                        {row.label}
                      </span>
                      <span className="text-xs text-on-muted">
                        <span className="num font-semibold text-on">{row.value}</span> ·{" "}
                        <span className="num">{row.pct}%</span>
                      </span>
                    </div>
                    <ProgressBar
                      current={row.pct}
                      target={100}
                      showLabel={false}
                      tone={row.tone}
                    />
                  </div>
                ))}
              </div>
            </ChartCard>
          </div>

          <FlightPanel
            level="ledger"
            glass
            flush
            eyebrow="User ledger"
            title="All users"
            subtitle={`${usersData.users.length} account${
              usersData.users.length === 1 ? "" : "s"
            } listed`}
            actions={
              <Button onClick={() => downloadCSV("users")} variant="secondary" size="sm">
                Export CSV
              </Button>
            }
          >
            <div className="overflow-x-auto">
              <table className="data-table min-w-[640px]">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {usersData.users.map((u) => (
                    <tr key={u._id}>
                      <td className="text-on">{u.name}</td>
                      <td>{u.email}</td>
                      <td>
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize ${
                            roleStyles[u.role] || roleStyles.student
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="whitespace-nowrap">{formatDate(u.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FlightPanel>
        </>
      )}
    </div>
  );
};

export default AttendanceReports;

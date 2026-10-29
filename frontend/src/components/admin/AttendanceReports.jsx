import React, { useState, useEffect, useCallback, useMemo } from "react";
import api from "../../api/axios";
import { useTheme } from "../../context/ThemeContext";
import { usePageMeta } from "../../context/PageMetaContext";
import {
  Button,
  Card,
  ChartCard,
  FlightPanel,
  ProgressBar,
  StatusChip,
  TableSkeleton,
  Tabs,
} from "../ui";
import { formatDate, formatTime12Hour } from "../../utils/helpers";
import Pagination from "../ui/Pagination";

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
  const [attendancePage, setAttendancePage] = useState(1);
  const attendancePageSize = 10;
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
        const res = await api.get("/reports/attendance", { params: { ...attendanceParams, page: attendancePage, limit: attendancePageSize }, signal });
        setAttendanceData(res.data);
        const lastPage = Math.max(1, Math.ceil(res.data.stats.total / attendancePageSize));
        if (attendancePage > lastPage) setAttendancePage(lastPage);
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
    [attendanceParams, attendancePage]
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
  const chartText = isDark ? "#b4b1c2" : "#64616c";
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

  const attendanceBarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "x",
    datasets: { bar: { maxBarThickness: 36, borderRadius: 3, borderSkipped: false } },
    interaction: { mode: "index", intersect: false },
    plugins: { legend: { display: false }, tooltip: tooltipStyle },
    scales: {
      x: {
        stacked: true,
        beginAtZero: true,
        border: { display: false },
        grid: { display: false },
        ticks: { color: chartText, font: { size: 11 }, maxRotation: 0, minRotation: 0 },
      },
      y: {
        stacked: true,
        border: { display: false },
        grid: { color: chartGrid },
        ticks: { color: chartText, font: { size: 11 }, precision: 0 },
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
    <div className="admin-report-page">
      <header className="admin-report-heading">
        <div><h1>{activeTab === "attendance" ? "Attendance report" : activeTab === "events" ? "Event report" : "User report"}</h1><p>Monitor records and export the information you need.</p></div>
        <Tabs active={activeTab} onChange={setActiveTab} tabs={[{key:"attendance",label:"Attendance"},{key:"events",label:"Events"},{key:"users",label:"Users"}]} />
      </header>

      {loading && !attendanceData && !eventsData && !usersData && (
        <Card>
          <TableSkeleton rows={5} />
        </Card>
      )}

      {activeTab === "attendance" && (
        <>
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
              <Card as="section" padding="none" className="admin-report-overview" aria-label="Attendance summary">
                <div><span className="admin-overview-label">Attendance rate</span><strong>{attendanceData.stats.total ? `${attendanceRate}%` : "—"}</strong></div>
                <div className="admin-overview-copy"><p>{attendedCount} attended out of {attendanceData.stats.total} attendance records.</p><span>Present and late records count as attended.</span></div>
              </Card>
              <div className="admin-report-charts">
                <ChartCard
                  className="admin-report-chart"
                  title="Attendance by event"
                  subtitle="Status mix for the latest events in this filter"
                  actions={
                    <span className="num rounded-full border border-line bg-card-alt/60 px-2.5 py-1 text-[10px] font-medium text-on-muted">
                      {byEventChartRows.length} {byEventChartRows.length === 1 ? "event" : "events"}
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
                    <div className="admin-event-plot">
                      <Bar data={attendanceByEventData} options={attendanceBarOptions} />
                    </div>
                  ) : (
                    <div className="admin-event-plot flex items-center justify-center text-sm text-on-muted">
                      No attendance records match these filters.
                    </div>
                  )}
                </ChartCard>

                <ChartCard
                  className="admin-report-chart"
                  title="Attendance status"
                  subtitle="All recorded statuses in this filter"
                  actions={
                    <span className="num rounded-full border border-line bg-card-alt/60 px-2.5 py-1 text-[10px] font-medium text-on-muted">
                      {attendanceData.stats.total}
                    </span>
                  }
                >
                  <div className="admin-status-plot">
                    <div className="admin-status-donut relative">
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

              <div className="admin-record-toolbar" role="region" aria-label="Attendance record filters">
                {[
                  {key:"program",label:"Program",all:"All programs",options:filterOptions.programs.map(value=>({value,label:value}))},
                  {key:"yearLevel",label:"Year level",all:"All year levels",options:(filterOptions.yearLevels || [1,2,3,4]).map(value=>({value,label:YEAR_LABELS[value] || `Year ${value}`}))},
                  {key:"section",label:"Section",all:"All sections",options:filterOptions.sections.map(value=>({value,label:`Section ${value}`}))},
                  {key:"eventId",label:"Event",all:"All events",options:filterOptions.events.map(event=>({value:event._id,label:`${event.title} — ${formatDate(event.date)}`}))},
                ].map(field=><label key={field.key} className={`admin-report-filter admin-report-filter-${field.key}`}><span className="sr-only">{field.label}</span><select aria-label={field.label} className="field-select" value={filters[field.key]} onChange={event=>{setAttendancePage(1);setFilters(previous=>({...previous,[field.key]:event.target.value}));}}><option value="all">{field.all}</option>{field.options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>)}
                <Button variant="ghost" size="sm" onClick={()=>{setAttendancePage(1);setFilters(EMPTY_FILTERS);}} disabled={!hasActiveFilters}>Reset filters</Button>
                <Button variant="primary" size="sm" loading={exporting} title="Export all records matching the current filters" onClick={()=>downloadCSV("attendance")}>Export CSV</Button>
                <p className="sr-only">Filters apply to both graphs, attendance records and CSV export.</p>
              </div>
              {attendanceLoading && <p role="status" className="text-xs text-on-muted">Updating results…</p>}
              <FlightPanel
                level="ledger"
                glass
                flush
                title="Recent attendance records"
                className="admin-records-panel"
                subtitle={`${attendanceData.stats.total} matching records · ${attendancePageSize} per page`}

              >
                <div className="overflow-x-auto">
                  <table className="data-table admin-records-table min-w-[960px]" aria-busy={attendanceLoading}>
                    <colgroup><col style={{width:"24%"}} /><col style={{width:"24%"}} /><col style={{width:"22%"}} /><col style={{width:"13%"}} /><col style={{width:"17%"}} /></colgroup>
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Event</th>
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
                        attendanceData.records.map((r, i) => {
                          const eventDate = r.event?.date || r.eventDate;
                          const program = r.student?.program || "";
                          const year = r.student?.yearLevel;
                          const section = r.student?.section || "";
                          return (
                            <tr key={i}>
                              <td><div className="admin-person-cell"><span className="admin-person-avatar" aria-hidden="true">{(r.student?.name || "?").split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join("").toUpperCase()}</span><div><p className="font-medium text-on">{r.student?.name || "N/A"}</p><p className="mt-0.5 text-xs text-on-muted">{r.student?.email || "No email"}</p></div></div></td>
                              <td className="text-on">{r.event?.title || r.eventTitle || "N/A"}</td>
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
                <div className="admin-table-pager"><Pagination page={attendancePage} pageSize={attendancePageSize} total={attendanceData.stats.total} disabled={attendanceLoading} onChange={setAttendancePage} label="Attendance report pages" /></div>
              </FlightPanel>
            </>
          )}
        </>
      )}

      {activeTab === "events" && eventsData && (
        <>
          <div className="grid grid-cols-1 gap-4">
            <ChartCard
              className="min-w-0"
              title="Events by status"
              subtitle="Current lifecycle of every event"
              actions={
                <span className="num rounded-full border border-line bg-card-alt/60 px-2.5 py-1 text-[10px] font-medium text-on-muted">
                  {eventsData.stats.total}
                </span>
              }
            >
              <div className="grid items-center gap-6 sm:grid-cols-2 sm:py-4">
                <div className="relative mx-auto h-[180px] w-[180px]">
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
          <div className="grid grid-cols-1 gap-4">
            <ChartCard
              className="min-w-0"
              title="Users by role"
              subtitle="Student organizers are included under Students."
              actions={
                <span className="num rounded-full border border-line bg-card-alt/60 px-2.5 py-1 text-[10px] font-medium text-on-muted">
                  {usersData.stats.total}
                </span>
              }
            >
              <div className="grid items-center gap-6 sm:grid-cols-2 sm:py-4">
                <div className="relative mx-auto h-[180px] w-[180px]">
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
                          {u.role === "student" && u.organizerAccess ? "Student/Organizer" : u.role}
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

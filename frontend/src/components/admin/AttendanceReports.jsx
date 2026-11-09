import ReportExport from "./ReportExport";
import { attendanceCompletion, attendancePenaltyLabel } from "../../utils/attendanceSessions";
import { useAcademicPeriods } from "../../utils/useAcademicPeriods";
import AcademicPeriodFilter from "../organizer/AcademicPeriodFilter";
import AttendanceRecordActions from "./AttendanceRecordActions";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import api from "../../api/axios";
import { useAutoRefresh } from "../../utils/useAutoRefresh";
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
import { formatDate, formatTime } from "../../utils/helpers";
import Pagination from "../ui/Pagination";
import StablePage from "../ui/StablePage";

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
import { Bar } from "react-chartjs-2";
import ReportDonut from "../ui/ReportDonut";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const EMPTY_FILTERS = { program: "all", yearLevel: "all", section: "all", eventId: "all", sessionId: "all", completionStatus: "all" };
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
  const [exportError, setExportError] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [attendancePage, setAttendancePage] = useState(1);
  const attendancePageSize = 5;
  const [eventLedgerPage, setEventLedgerPage] = useState(1);
  const [userLedgerPage, setUserLedgerPage] = useState(1);
  const eventTotal = eventsData?.events?.length || 0;
  const userTotal = usersData?.users?.length || 0;
  const currentEventLedgerPage = Math.min(eventLedgerPage, Math.max(1, Math.ceil(eventTotal / 5)));
  const currentUserLedgerPage = Math.min(userLedgerPage, Math.max(1, Math.ceil(userTotal / 5)));
  const visibleReportEvents = eventsData?.events?.slice((currentEventLedgerPage - 1) * 5, currentEventLedgerPage * 5) || [];
  const visibleReportUsers = usersData?.users?.slice((currentUserLedgerPage - 1) * 5, currentUserLedgerPage * 5) || [];
  const [filterOptions, setFilterOptions] = useState({
    programs: [],
    yearLevels: [1, 2, 3, 4],
    sections: [],
    events: [],
  });
  const { isDark } = useTheme();
  const periodSelection=useAcademicPeriods();
  const {schoolYear,semester}=periodSelection;
  const periodParams=useMemo(()=>({...schoolYear!=="all"?{academicYearStart:schoolYear}:{},...semester!=="all"?{semester}: {}}),[schoolYear,semester]);

  usePageMeta("Reports", "System-wide analytics, breakdowns, and exports.");

  const attendanceParams = useMemo(() => {
    const params = {...periodParams};
    if (filters.program !== "all") params.program = filters.program;
    if (filters.yearLevel !== "all") params.yearLevel = filters.yearLevel;
    if (filters.section !== "all") params.section = filters.section;
    if (filters.eventId !== "all") params.eventId = filters.eventId;
    if (filters.sessionId !== "all") params.sessionId = filters.sessionId;
    if (filters.completionStatus !== "all") params.completionStatus = filters.completionStatus;
    return params;
  }, [filters,periodParams]);

  const hasActiveFilters = Object.values(filters).some((value) => value !== "all");
  const moreActiveFilters = ["program", "yearLevel", "section"].filter((key) => filters[key] !== "all").length;

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

  const fetchEvents = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get("/reports/events", {params:periodParams});
      setEventsData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [periodParams]);

  const fetchUsers = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get("/reports/users");
      setUsersData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== "attendance") return undefined;
    const controller = new AbortController();
    fetchAttendance(controller.signal);
    return () => controller.abort();
  }, [activeTab, fetchAttendance]);

  useEffect(() => {
    if (activeTab === "events") fetchEvents();
  }, [activeTab, fetchEvents]);

  useEffect(() => {
    if (activeTab === "users") fetchUsers();
  }, [activeTab, fetchUsers]);
  useAutoRefresh(fetchUsers, { interval: 30000, enabled: activeTab === "users" });
  useAutoRefresh(() => fetchAttendance(), { interval: 30000, enabled: activeTab === "attendance" });
  useAutoRefresh(fetchEvents, { interval: 30000, enabled: activeTab === "events" });

  const downloadReport = async (type, format) => {
    if (exporting) return;
    setExportError("");
    setExporting(true);
    try {
      const params = type === "attendance" ? attendanceParams : type === "events" ? periodParams : undefined;
      const response = await api.get(`/reports/${type}/export`, {
        params: { ...params, format },
        responseType: "blob",
      });
      const disposition = response.headers["content-disposition"] || "";
      const filenameMatch =
        disposition.match(/filename="([^"]+)"/i) || disposition.match(/filename=([^;]+)/i);
      const filename = filenameMatch ? filenameMatch[1].trim() : `${type}-report.${format}`;
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
      setExportError("Could not download the report. Please try again.");
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
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
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
          label: "Event Organizers",
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
      {exportError && <p role="alert" className="text-[var(--danger)]">{exportError}</p>}
      <header className="admin-report-heading">
        <div><h1>{activeTab === "attendance" ? "Attendance report" : activeTab === "events" ? "Event report" : "User report"}</h1><p>Monitor and export records.</p></div>
        <Tabs active={activeTab} onChange={setActiveTab} tabs={[{key:"attendance",label:"Attendance"},{key:"events",label:"Events"},{key:"users",label:"Users"}]} />
      </header>

      {activeTab!=="users" && <AcademicPeriodFilter selection={{...periodSelection,setSchoolYear:value=>{periodSelection.setSchoolYear(value);setAttendancePage(1);setEventLedgerPage(1);},setSemester:value=>{periodSelection.setSemester(value);setAttendancePage(1);setEventLedgerPage(1);}}}/>}

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
                <div className="admin-overview-copy"><p>{attendedCount} attended out of {attendanceData.stats.total} attendance records.</p><span>Time In rate: present and late records count as attended; completion is separate.</span>{attendanceData.stats.completion && <p className="mt-2 text-xs text-on-muted">Session completion: {attendanceData.stats.completion.completed || 0} completed · {attendanceData.stats.completion.incomplete || 0} incomplete · {attendanceData.stats.completion.absent || 0} absent · {attendanceData.stats.completion.pending || 0} awaiting Time Out.</p>}</div>
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
                  <ReportDonut data={attendanceChartData} options={donutOptions} total={attendanceData.stats.total} unit="records" rows={statusRows} />
                </ChartCard>
              </div>

               <div className="admin-record-toolbar" role="region" aria-label="Attendance record filters">
                  <div className="admin-report-filter-row">
                    <label className="admin-report-filter admin-report-filter-eventId">
                      <span className="sr-only">Event</span>
                      <select aria-label="Event" className="field-select" value={filters.eventId} onChange={event=>{setAttendancePage(1);setFilters(previous=>({...previous,eventId:event.target.value,sessionId:"all"}));}}>
                        <option value="all">All events</option>
                        {filterOptions.events.map(event=><option key={event._id} value={event._id}>{event.title} - {formatDate(event.date)}</option>)}
                      </select>
                    </label>
                    {filters.eventId !== "all" && (
                      <label className="admin-report-filter admin-report-filter-sessionId">
                        <span className="sr-only">Session</span>
                        <select aria-label="Session" className="field-select" value={filters.sessionId} onChange={event=>{setAttendancePage(1);setFilters(previous=>({...previous,sessionId:event.target.value}));}}>
                          <option value="all">All sessions</option>
                          {(filterOptions.events.find(event => event._id === filters.eventId)?.attendanceSessions || []).map(row=><option key={row._id} value={row._id}>{row.name}</option>)}
                        </select>
                      </label>
                    )}
                    <label className="admin-report-filter admin-report-filter-completionStatus">
                      <span className="sr-only">Completion</span>
                      <select aria-label="Completion" className="field-select" value={filters.completionStatus} onChange={event=>{setAttendancePage(1);setFilters(previous=>({...previous,completionStatus:event.target.value}));}}>
                        <option value="all">All completion states</option>
                        {["completed","incomplete","absent","pending","excused"].map(value=><option key={value} value={value}>{value === "pending" ? "Awaiting Time Out" : value[0].toUpperCase()+value.slice(1)}</option>)}
                      </select>
                    </label>
                    <Button variant="ghost" size="sm" onClick={()=>setShowMoreFilters(value=>!value)} aria-expanded={showMoreFilters}>
                      More filters{moreActiveFilters ? ` (${moreActiveFilters})` : ""} {showMoreFilters ? "^" : "v"}
                    </Button>
                    <Button variant="info" size="sm" onClick={()=>{setAttendancePage(1);setFilters(EMPTY_FILTERS);}} disabled={!hasActiveFilters}>Reset filters</Button>
                    <ReportExport busy={exporting} onExport={format => downloadReport("attendance", format)} />
                  </div>
                  {showMoreFilters && (
                    <div className="admin-report-filter-more">
                      <label className="admin-report-filter admin-report-filter-program">
                        <span className="sr-only">Program</span>
                        <select aria-label="Program" className="field-select" value={filters.program} onChange={event=>{setAttendancePage(1);setFilters(previous=>({...previous,program:event.target.value}));}}>
                          <option value="all">All programs</option>
                          {filterOptions.programs.map(value=><option key={value} value={value}>{value}</option>)}
                        </select>
                      </label>
                      <label className="admin-report-filter admin-report-filter-yearLevel">
                        <span className="sr-only">Year level</span>
                        <select aria-label="Year level" className="field-select" value={filters.yearLevel} onChange={event=>{setAttendancePage(1);setFilters(previous=>({...previous,yearLevel:event.target.value}));}}>
                          <option value="all">All year levels</option>
                          {(filterOptions.yearLevels || [1,2,3,4]).map(value=><option key={value} value={value}>{YEAR_LABELS[value] || `Year ${value}`}</option>)}
                        </select>
                      </label>
                      <label className="admin-report-filter admin-report-filter-section">
                        <span className="sr-only">Section</span>
                        <select aria-label="Section" className="field-select" value={filters.section} onChange={event=>{setAttendancePage(1);setFilters(previous=>({...previous,section:event.target.value}));}}>
                          <option value="all">All sections</option>
                          {filterOptions.sections.map(value=><option key={value} value={value}>{`Section ${value}`}</option>)}
                        </select>
                      </label>
                    </div>
                  )}
                  <p className="sr-only">Filters apply to graphs, attendance records, Excel and CSV exports.</p>
                </div>
              <FlightPanel
                level="ledger"
                glass
                flush
                title="Recent attendance records"
                actions={<span role="status" aria-live="polite" className="attendance-refresh-status">{attendanceLoading ? "Updating…" : ""}</span>}
                className="admin-records-panel"
                subtitle={`${attendanceData.stats.total} matching records · ${attendancePageSize} per page`}

              >
                <AttendanceRecordActions scopeKey={`${JSON.stringify(periodParams)}:${JSON.stringify(filters)}:${attendancePage}`} records={attendanceData.records} loading={attendanceLoading} onDeleted={() => Promise.all([fetchAttendance(), fetchEvents()])}>{({ selecting, checkbox, busy }) => <StablePage loading={attendanceLoading || busy} pageKey={`${JSON.stringify(periodParams)}:${JSON.stringify(filters)}:${attendanceData.stats.total}`} footer={<div className="admin-table-pager"><Pagination page={attendancePage} pageSize={attendancePageSize} total={attendanceData.stats.total} disabled={attendanceLoading || busy} onChange={setAttendancePage} label="Attendance report pages" /></div>}>
                <div className="overflow-x-auto">
                  <table className="data-table admin-records-table min-w-[960px]" aria-busy={attendanceLoading}>
                    <colgroup>{selecting && <col style={{width:"48px"}} />}<col style={{width:"22%"}} /><col style={{width:"20%"}} /><col style={{width:"18%"}} /><col style={{width:"12%"}} /><col style={{width:"14%"}} /><col /></colgroup>
                    <thead>
                      <tr>
                        {selecting && <th className="attendance-action-cell"><span className="sr-only">Select</span></th>}
                        <th>Student</th>
                        <th>Event / Session</th>
                        <th>Program / Year / Section</th>
                        <th>Status</th>
                        <th>Time In</th>
                        <th>Time Out</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceData.records.length === 0 ? (
                        <tr>
                          <td colSpan={selecting ? 7 : 6} className="py-10 text-center text-sm text-on-muted">
                            No attendance records match these filters.
                          </td>
                        </tr>
                      ) : (
                        attendanceData.records.map((r, i) => {
                          const checkedInAt = r.timeInAt || (!r.session && r.method !== "auto" && ["present", "late"].includes(r.status) ? r.attendedAt : null);
                          const program = r.student?.program || "";
                          const year = r.student?.yearLevel;
                          const section = r.student?.section || "";
                          return (
                            <tr key={r._id || i}>
                              {selecting && <td className="attendance-action-cell">{checkbox(r)}</td>}
                              <td><div className="admin-person-cell"><span className="admin-person-avatar" aria-hidden="true">{(r.student?.name || "?").split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join("").toUpperCase()}</span><div><p className="font-medium text-on">{r.student?.name || "N/A"}</p><p className="mt-0.5 text-xs text-on-muted">{r.student?.email || "No email"}</p></div></div></td>
                              <td className="text-on">{r.event?.title || r.eventTitle || "N/A"}{r.sessionName && <p className="mt-0.5 text-xs text-on-muted">{r.sessionName}</p>}</td>
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
                                <p className="mt-1 text-xs text-on-muted">{r.session ? `${attendanceCompletion(r)} · ` : ""}{attendancePenaltyLabel(r)}</p>
                              </td>
                              <td className="whitespace-nowrap">
                                {checkedInAt ? (
                                  <>
                                    <p className="text-on-dim">
                                      {formatTime(checkedInAt, {
                                        hour: "numeric",
                                        minute: "2-digit",
                                      })}
                                    </p>
                                    <p className="mt-0.5 text-xs text-on-muted">
                                      {formatDate(checkedInAt)}
                                    </p>
                                  </>
                                ) : (
                                  <span className="text-on-muted">Not recorded</span>
                                )}
                              </td>
                              <td className="whitespace-nowrap">
                                {r.timeOutAt ? (
                                  <>
                                    <p className="text-on-dim">{formatTime(r.timeOutAt, { hour: "numeric", minute: "2-digit" })}</p>
                                    <p className="mt-0.5 text-xs text-on-muted">{formatDate(r.timeOutAt)}</p>
                                  </>
                                ) : (
                                  <span className="text-on-muted">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                </StablePage>}</AttendanceRecordActions>
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
              <ReportDonut data={eventStatusData} options={donutOptions} total={eventsData.stats.total} unit="events" rows={eventStatusRows} />
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
              <ReportExport busy={exporting} onExport={format => downloadReport("events", format)} />
            }
          >
            <StablePage pageKey={`Event report pages:${JSON.stringify(periodParams)}`} footer={<div className="px-4 pb-4"><Pagination page={currentEventLedgerPage} pageSize={5} total={eventTotal} onChange={setEventLedgerPage} label="Event report pages" /></div>}><div className="overflow-x-auto">
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
                  {eventsData.events.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-10 text-center text-sm text-on-muted"
                      >
                        No events in this report yet.
                      </td>
                    </tr>
                  ) : (
                    visibleReportEvents.map((e) => (
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </StablePage>
          </FlightPanel>
        </>
      )}

      {activeTab === "users" && usersData && (
        <>
          <div className="grid grid-cols-1 gap-4">
            <ChartCard
              className="min-w-0"
              title="Users by role"
              subtitle="Promoted students count as Event Organizers until demoted."
              actions={
                <span className="num rounded-full border border-line bg-card-alt/60 px-2.5 py-1 text-[10px] font-medium text-on-muted">
                  {usersData.stats.total}
                </span>
              }
            >
              <ReportDonut data={usersRoleData} options={donutOptions} total={usersData.stats.total} unit="users" rows={roleRows} />
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
              <ReportExport busy={exporting} onExport={format => downloadReport("users", format)} />
            }
          >
            <StablePage pageKey="User report pages" footer={<div className="px-4 pb-4"><Pagination page={currentUserLedgerPage} pageSize={5} total={userTotal} onChange={setUserLedgerPage} label="User report pages" /></div>}><div className="overflow-x-auto">
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
                  {visibleReportUsers.map((u) => (
                    <tr key={u._id}>
                      <td className="text-on">{u.name}</td>
                      <td>{u.email}</td>
                      <td>
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize ${
                            roleStyles[u.role === "student" && u.organizerAccess ? "organizer" : u.role] || roleStyles.student
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
          </StablePage>
          </FlightPanel>
        </>
      )}
    </div>
  );
};

export default AttendanceReports;

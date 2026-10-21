import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import { useTheme } from "../../context/ThemeContext";
import { usePageMeta } from "../../context/PageMetaContext";
import { formatDate, formatDateTime, formatTime, formatTime12Hour } from "../../utils/helpers";
import {
  FaArrowRight,
  FaBolt,
  FaCalendarAlt,
  FaCheckCircle,
  FaClipboardList,
  FaClock,
  FaKey,
  FaMapMarkerAlt,
  FaPlus,
  FaRegClock,
  FaShieldAlt,
  FaTimesCircle,
  FaUserTie,
  FaUsers,
} from "react-icons/fa";
import {
  Card,
  StatTile,
  ChartCard,
  Timeline,
  StatusChip,
  Button,
  TableSkeleton,
} from "../ui";
import EmptyState from "../shared/EmptyState";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Line, Doughnut } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  ArcElement,
  Tooltip,
  Legend
);

const DAY_KEY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const SHORT_DAY = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  month: "short",
  day: "numeric",
});
const MONTH_KEY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
});

const STATUS_META = [
  { key: "present", label: "Present" },
  { key: "late", label: "Late" },
  { key: "absent", label: "Absent" },
  { key: "pending", label: "Pending" },
  { key: "excused", label: "Excused" },
];

const CHART_DARK = {
  present: "#34d399",
  late: "#fbbf24",
  absent: "#fb7185",
  pending: "#94a3b8",
  excused: "#38bdf8",
  brand: "#a5b4fc",
};
const CHART_LIGHT = {
  present: "#059669",
  late: "#d97706",
  absent: "#dc2626",
  pending: "#64748b",
  excused: "#0284c7",
  brand: "#4f46e5",
};

const toDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const dayKey = (value) => {
  const date = toDate(value);
  return date ? DAY_KEY.format(date) : "";
};

const dailySeries = (records, days = 14) => {
  const counts = {};
  records.forEach((record) => {
    const key = dayKey(record.attendedAt || record.createdAt);
    if (key) counts[key] = (counts[key] || 0) + 1;
  });

  const labels = [];
  const values = [];
  const now = Date.now();
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(now - i * 86400000);
    labels.push(SHORT_DAY.format(date));
    values.push(counts[dayKey(date)] || 0);
  }
  return { labels, values };
};

const monthlySeries = (items, field, months = 6) => {
  const counts = {};
  items.forEach((item) => {
    const date = toDate(item[field]);
    if (date) {
      const key = MONTH_KEY.format(date);
      counts[key] = (counts[key] || 0) + 1;
    }
  });

  const now = new Date();
  const values = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 15);
    values.push(counts[MONTH_KEY.format(date)] || 0);
  }
  return values;
};

const weeklyRateSeries = (records, weeks = 6) => {
  const now = Date.now();
  const values = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const end = now - i * 7 * 86400000;
    const start = end - 7 * 86400000;
    const slice = records.filter((record) => {
      const date = toDate(record.attendedAt || record.createdAt);
      const time = date ? date.getTime() : NaN;
      return Number.isFinite(time) && time > start && time <= end;
    });
    const attended = slice.filter(
      (record) => record.status === "present" || record.status === "late"
    ).length;
    values.push(slice.length ? Math.round((attended / slice.length) * 100) : 0);
  }
  return values;
};

const activityVisual = (status) => {
  switch (status) {
    case "present":
      return { icon: <FaCheckCircle />, tone: "ok" };
    case "late":
      return { icon: <FaClock />, tone: "warn" };
    case "absent":
      return { icon: <FaTimesCircle />, tone: "danger" };
    case "excused":
      return { icon: <FaShieldAlt />, tone: "excused" };
    default:
      return { icon: <FaRegClock />, tone: "muted" };
  }
};

const SectionHeader = ({ title, subtitle, action }) => (
  <div className="mb-4 flex items-start justify-between gap-3">
    <div className="min-w-0">
      <h3 className="font-display text-[15px] font-semibold tracking-tight text-on">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-on-muted">{subtitle}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

const fetchDashboard = () =>
  Promise.allSettled([
    api.get("/reports/events"),
    api.get("/reports/users"),
    api.get("/reports/attendance"),
    api.get("/admin/security/face-appeals", { params: { status: "pending" } }),
    api.get("/admin/security/pin-reset-requests", { params: { status: "pending" } }),
  ]);

const dashboardStateFrom = (results) => {
  const [eventsRes, usersRes, attendanceRes, appealsRes, pinsRes] = results;

  if ([eventsRes, usersRes, attendanceRes].every((result) => result.status === "rejected")) {
    return {
      loading: false,
      error: "The dashboard could not load. Check your connection and try again.",
    };
  }

  return {
    loading: false,
    error: "",
    events: eventsRes.status === "fulfilled" ? eventsRes.value.data.events || [] : [],
    eventStats: eventsRes.status === "fulfilled" ? eventsRes.value.data.stats || null : null,
    users: usersRes.status === "fulfilled" ? usersRes.value.data.users || [] : [],
    userStats: usersRes.status === "fulfilled" ? usersRes.value.data.stats || null : null,
    records: attendanceRes.status === "fulfilled" ? attendanceRes.value.data.records || [] : [],
    stats: attendanceRes.status === "fulfilled" ? attendanceRes.value.data.stats || null : null,
    appeals: appealsRes.status === "fulfilled" ? appealsRes.value.data || [] : [],
    pinResets: pinsRes.status === "fulfilled" ? pinsRes.value.data || [] : [],
  };
};

const DashboardHome = () => {
  const { isDark } = useTheme();
  const [state, setState] = useState({
    loading: true,
    error: "",
    events: [],
    eventStats: null,
    users: [],
    userStats: null,
    records: [],
    stats: null,
    appeals: [],
    pinResets: [],
  });

  usePageMeta(
    "Overview",
    formatDate(new Date(), {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  );

  const load = useCallback(async () => {
    const results = await fetchDashboard();
    setState(dashboardStateFrom(results));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchDashboard().then((results) => {
      if (!cancelled) setState(dashboardStateFrom(results));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const retry = () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    load();
  };

  const derived = useMemo(() => {
    const { events, users, records, stats, userStats, eventStats } = state;
    const palette = isDark ? CHART_DARK : CHART_LIGHT;

    const students = userStats?.student ?? users.filter((user) => user.role === "student").length;
    const organizers =
      userStats?.organizer ?? users.filter((user) => user.role === "organizer").length;
    const studentUsers = users.filter((user) => user.role === "student");
    const organizerUsers = users.filter((user) => user.role === "organizer");

    const totalRecords = stats?.total ?? records.length;
    const present = stats?.present ?? 0;
    const late = stats?.late ?? 0;
    const attended = present + late;
    const rate = totalRecords ? Math.round((attended / totalRecords) * 100) : 0;

    const upcoming = eventStats?.upcoming ?? events.filter((event) => event.status === "upcoming").length;
    const live = eventStats?.live ?? events.filter((event) => event.status === "live").length;

    const statusRows = STATUS_META.map((meta) => {
      const count = stats?.[meta.key] ?? 0;
      return {
        ...meta,
        count,
        pct: totalRecords ? Math.round((count / totalRecords) * 100) : 0,
        color: palette[meta.key],
      };
    });

    const today = dayKey(new Date());
    const todayEvents = events
      .filter((event) => event.date && dayKey(event.date) === today && event.status !== "closed")
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const activityItems = records.slice(0, 6).map((record) => {
      const visual = activityVisual(record.status);
      return {
        id: record._id,
        title: record.student?.name || "Student",
        meta: `${record.event?.title || record.eventTitle || "Event"} · ${
          record.status || "recorded"
        }`,
        time: record.attendedAt ? formatTime(record.attendedAt) : "",
        icon: visual.icon,
        tone: visual.tone,
      };
    });

    return {
      palette,
      students,
      organizers,
      totalRecords,
      attended,
      rate,
      upcoming,
      live,
      statusRows,
      todayEvents,
      activityItems,
      trend: dailySeries(records),
      eventsSpark: monthlySeries(events, "date"),
      studentsSpark: monthlySeries(studentUsers, "createdAt"),
      organizersSpark: monthlySeries(organizerUsers, "createdAt"),
      rateSpark: weeklyRateSeries(records),
      attentionTotal: state.appeals.length + state.pinResets.length + live,
    };
  }, [state, isDark]);

  if (state.loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading dashboard">
        <div className="skeleton h-40 rounded-2xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-32 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="skeleton h-80 rounded-2xl lg:col-span-8" />
          <div className="skeleton h-80 rounded-2xl lg:col-span-4" />
        </div>
        <TableSkeleton rows={5} cols={4} />
      </div>
    );
  }

  if (state.error) {
    return (
      <EmptyState
        icon={<FaClipboardList />}
        title="Dashboard unavailable"
        description={state.error}
        action={
          <Button onClick={retry} variant="secondary">
            Try again
          </Button>
        }
      />
    );
  }

  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      hour: "numeric",
      hour12: false,
    }).format(new Date())
  );
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const lineData = {
    labels: derived.trend.labels,
    datasets: [
      {
        data: derived.trend.values,
        borderColor: derived.palette.brand,
        backgroundColor: isDark ? "rgba(165, 180, 252, 0.16)" : "rgba(79, 70, 229, 0.12)",
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: derived.palette.brand,
        pointHoverBorderColor: "#ffffff",
        pointHoverBorderWidth: 2,
      },
    ],
  };

  const chartText = isDark ? "#94a3b8" : "#64748b";
  const chartGrid = isDark ? "rgba(148, 163, 184, 0.12)" : "rgba(15, 23, 42, 0.06)";
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

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: { legend: { display: false }, tooltip: tooltipStyle },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: chartText, font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 7 },
      },
      y: {
        beginAtZero: true,
        border: { display: false },
        grid: { color: chartGrid },
        ticks: { color: chartText, font: { size: 10 }, precision: 0, maxTicksLimit: 4 },
      },
    },
  };

  const doughnutData = {
    labels: derived.statusRows.map((row) => row.label),
    datasets: [
      {
        data: derived.statusRows.map((row) => row.count),
        backgroundColor: derived.statusRows.map((row) => row.color),
        borderWidth: 0,
        hoverOffset: 3,
      },
    ],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "74%",
    plugins: { legend: { display: false }, tooltip: tooltipStyle },
  };

  const attentionRows = [
    {
      key: "appeals",
      label: "Face appeals",
      hint: "Identity reviews waiting",
      count: state.appeals.length,
      icon: <FaShieldAlt />,
      tone: "warn",
      to: "/admin/dashboard/users",
    },
    {
      key: "pins",
      label: "PIN reset requests",
      hint: "Verify students on-site",
      count: state.pinResets.length,
      icon: <FaKey />,
      tone: "info",
      to: "/admin/dashboard/pin-resets",
    },
    {
      key: "live",
      label: "Live events",
      hint: "Attendance windows open",
      count: derived.live,
      icon: <FaBolt />,
      tone: "ok",
      to: "/admin/dashboard/events",
    },
  ];

  const attentionTones = {
    warn: "bg-warn/10 text-warn ring-warn/20",
    info: "bg-info/10 text-info ring-info/20",
    ok: "bg-ok/10 text-ok ring-ok/20",
  };

  return (
    <div className="space-y-4">
      {/* Hero */}
      <Card variant="glass" padding="none" className="animate-rise overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -right-24 -top-32 h-72 w-72 rounded-full bg-brand/20 blur-3xl" />
          <div className="absolute -bottom-40 left-1/3 h-72 w-72 rounded-full bg-[var(--brand-2)]/15 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.35] [background-image:linear-gradient(var(--line-dim-color)_1px,transparent_1px),linear-gradient(90deg,var(--line-dim-color)_1px,transparent_1px)] [background-size:36px_36px] [mask-image:radial-gradient(ellipse_70%_80%_at_60%_0%,black,transparent)]" />
        </div>

        <div className="relative flex flex-col gap-5 p-6 lg:flex-row lg:items-end lg:justify-between lg:p-8">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand">
              System overview
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-on sm:text-3xl">
              {greeting}, admin.
            </h2>
            <p className="mt-1 text-sm text-on-dim">
              {formatDate(new Date(), {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}{" "}
              · {derived.students} students · {state.events.length} events tracked
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button as={Link} to="/admin/dashboard/create-organizer" size="md">
              <FaPlus className="text-[10px]" />
              Create organizer
            </Button>
            <Button as={Link} to="/admin/dashboard/reports" variant="secondary" size="md">
              <FaClipboardList className="text-[11px]" />
              View reports
            </Button>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Events"
          value={state.events.length}
          icon={<FaCalendarAlt />}
          hint={`${derived.upcoming} upcoming · ${derived.live} live`}
          data={derived.eventsSpark}
          to="/admin/dashboard/events"
        />
        <StatTile
          label="Students"
          value={derived.students}
          icon={<FaUsers />}
          hint={`${state.userStats?.total ?? state.users.length} accounts total`}
          data={derived.studentsSpark}
          tone="info"
          to="/admin/dashboard/users"
        />
        <StatTile
          label="Attendance rate"
          value={`${derived.rate}%`}
          icon={<FaClipboardList />}
          hint={`${derived.attended} of ${derived.totalRecords} records`}
          data={derived.rateSpark}
          tone="ok"
          to="/admin/dashboard/reports"
        />
        <StatTile
          label="Organizers"
          value={derived.organizers}
          icon={<FaUserTie />}
          hint="Accounts you manage"
          data={derived.organizersSpark}
          tone="excused"
          to="/admin/dashboard/users"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <ChartCard
          className="lg:col-span-8"
          title="Attendance pulse"
          subtitle="Check-ins recorded over the last 14 days"
          actions={
            <span className="rounded-full border border-line bg-card-alt/60 px-2.5 py-1 text-[10px] font-medium text-on-muted">
              Last 14 days
            </span>
          }
        >
          <div className="h-[260px]">
            {derived.totalRecords > 0 ? (
              <Line data={lineData} options={lineOptions} />
            ) : (
              <EmptyState
                compact
                icon={<FaCalendarAlt />}
                title="No attendance yet"
                description="Once students are checked in, the trend appears here."
              />
            )}
          </div>
        </ChartCard>

        <ChartCard
          className="lg:col-span-4"
          title="Status mix"
          subtitle="Every attendance record"
          actions={
            <span className="num rounded-full border border-line bg-card-alt/60 px-2.5 py-1 text-[10px] font-medium text-on-muted">
              {derived.totalRecords}
            </span>
          }
        >
          {derived.totalRecords > 0 ? (
            <div className="flex flex-col items-center gap-5 sm:flex-row lg:flex-col xl:flex-row">
              <div className="relative h-[150px] w-[150px] shrink-0">
                <Doughnut data={doughnutData} options={doughnutOptions} />
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="num font-display text-xl font-bold leading-none text-on">
                    {derived.totalRecords}
                  </span>
                  <span className="mt-1 text-[10px] uppercase tracking-wide text-on-muted">
                    records
                  </span>
                </div>
              </div>

              <ul className="w-full min-w-0 flex-1 space-y-2">
                {derived.statusRows.map((row) => (
                  <li key={row.key} className="flex items-center gap-2 text-xs">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: row.color }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate text-on-dim">{row.label}</span>
                    <span className="num font-semibold text-on">{row.count}</span>
                    <span className="num w-8 text-right text-on-muted">{row.pct}%</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <EmptyState
              compact
              icon={<FaClipboardList />}
              title="Nothing to chart"
              description="Attendance statuses will be summarized here."
            />
          )}
        </ChartCard>
      </div>

      {/* Operations */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-4" padding="lg">
          <SectionHeader
            title="Needs attention"
            subtitle="Reviews and windows waiting on you"
            action={
              <span
                className={`num rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  derived.attentionTotal > 0
                    ? "bg-warn/10 text-warn"
                    : "bg-ok/10 text-ok"
                }`}
              >
                {derived.attentionTotal}
              </span>
            }
          />

          {derived.attentionTotal === 0 && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-ok/20 bg-ok/5 px-3 py-2 text-xs text-ok">
              <FaCheckCircle className="text-[11px]" />
              All clear — nothing needs action right now.
            </div>
          )}

          <div className="space-y-2">
            {attentionRows.map((row) => (
              <Link
                key={row.key}
                to={row.to}
                className="group flex items-center gap-3 rounded-xl border border-line/70 bg-card-alt/40 p-3 transition-colors hover:border-brand/30 hover:bg-card-alt"
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[13px] ring-1 ring-inset ${
                    attentionTones[row.tone]
                  }`}
                >
                  {row.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-on">{row.label}</p>
                  <p className="truncate text-[11px] text-on-muted">{row.hint}</p>
                </div>
                <span
                  className={`num rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    row.count > 0 ? "bg-brand/15 text-brand" : "bg-card text-on-muted"
                  }`}
                >
                  {row.count}
                </span>
                <FaArrowRight
                  className="text-[9px] text-on-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-4" padding="lg">
          <SectionHeader
            title="Today"
            subtitle={formatDate(new Date(), { month: "long", day: "numeric" })}
            action={
              <Link
                to="/admin/dashboard/events"
                className="text-[11px] font-medium text-brand transition-colors hover:text-brand-2"
              >
                All events
              </Link>
            }
          />

          {derived.todayEvents.length === 0 ? (
            <EmptyState
              compact
              icon={<FaCalendarAlt />}
              title="Nothing scheduled today"
              description="The next event will appear here."
              action={
                <Button as={Link} to="/admin/dashboard/events" variant="secondary" size="sm">
                  Browse events
                </Button>
              }
            />
          ) : (
            <div className="space-y-2">
              {derived.todayEvents.slice(0, 3).map((event) => (
                <Link
                  key={event._id}
                  to={`/admin/dashboard/events/${event._id}`}
                  className="group flex items-center gap-3 rounded-xl border border-line/70 bg-card-alt/40 p-3 transition-colors hover:border-brand/30 hover:bg-card-alt"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-[13px] text-brand ring-1 ring-inset ring-brand/20">
                    <FaRegClock />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-on">{event.title}</p>
                    <p className="flex items-center gap-1 truncate text-[11px] text-on-muted">
                      {formatTime12Hour(event.time)}
                      {event.location && (
                        <>
                          <span aria-hidden="true">·</span>
                          <FaMapMarkerAlt className="text-[9px]" />
                          <span className="truncate">{event.location}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <StatusChip status={event.status} />
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="lg:col-span-4" padding="lg">
          <SectionHeader
            title="Recent activity"
            subtitle="Latest check-ins across the system"
            action={
              <Link
                to="/admin/dashboard/reports"
                className="text-[11px] font-medium text-brand transition-colors hover:text-brand-2"
              >
                Reports
              </Link>
            }
          />

          <Timeline
            items={derived.activityItems}
            empty={
              <EmptyState
                compact
                icon={<FaRegClock />}
                title="No activity yet"
                description="Check-ins will stream in here as events run."
              />
            }
          />
        </Card>
      </div>

      {/* Recent attendance table */}
      <Card padding="none" className="overflow-hidden">
        <div className="flex items-start justify-between gap-3 p-5">
          <div className="min-w-0">
            <h3 className="font-display text-[15px] font-semibold tracking-tight text-on">
              Recent attendance
            </h3>
            <p className="mt-0.5 text-xs text-on-muted">
              The six latest records, newest first.
            </p>
          </div>
          <Link
            to="/admin/dashboard/reports"
            className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-brand transition-colors hover:text-brand-2"
          >
            View report
            <FaArrowRight className="text-[9px]" />
          </Link>
        </div>

        {state.records.length === 0 ? (
          <EmptyState
            icon={<FaClipboardList />}
            title="No attendance records yet"
            description="Scan a student QR at a live event to create the first record."
          />
        ) : (
          <div className="nice-scroll overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-y border-line bg-card-alt/40 text-left text-[10px] uppercase tracking-[0.14em] text-on-muted">
                  <th scope="col" className="px-5 py-2.5 font-semibold">Student</th>
                  <th scope="col" className="px-5 py-2.5 font-semibold">Event</th>
                  <th scope="col" className="px-5 py-2.5 font-semibold">Status</th>
                  <th scope="col" className="px-5 py-2.5 font-semibold">Checked in</th>
                </tr>
              </thead>
              <tbody>
                {state.records.slice(0, 6).map((record) => (
                  <tr
                    key={record._id}
                    className="border-b border-line/70 transition-colors last:border-0 hover:bg-card-alt/40"
                  >
                    <td className="px-5 py-3">
                      <p className="font-medium text-on">{record.student?.name || "Unknown"}</p>
                      <p className="text-[11px] text-on-muted">{record.student?.email || ""}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-on-dim">
                        {record.event?.title || record.eventTitle || "Event"}
                      </p>
                      <p className="text-[11px] text-on-muted">
                        {record.event?.date
                          ? formatDate(record.event.date)
                          : record.eventDate
                            ? formatDate(record.eventDate)
                            : ""}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <StatusChip status={record.status} />
                    </td>
                    <td className="px-5 py-3 text-xs text-on-muted">
                      {record.attendedAt ? formatDateTime(record.attendedAt) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default DashboardHome;

import React, { useState, useEffect, useCallback, useRef } from "react";
import api from "../../api/axios";
import { recordsForAcademicPeriod } from "../../utils/academicPeriods";
import { useAutoRefresh } from "../../utils/useAutoRefresh";
import { FaBook, FaCheck, FaClock, FaTimes } from "react-icons/fa";
import { BsClipboardCheck } from "react-icons/bs";
import StatusBadge from "../shared/StatusBadge";
import EmptyState from "../shared/EmptyState";
import Loading from "../shared/Loading";
import Pagination from "../ui/Pagination";
import { usePageMeta } from "../../context/PageMetaContext";
import { formatDate, formatDateTime } from "../../utils/helpers";
import { BaseCard, Card, FlightPanel, PageHeader, StatusChip } from "../ui";
import { readScreen, writeScreen } from "../../utils/queryCache";

const CACHE_KEY = "student:community-service";

const ServiceSummaryTile = ({ label, value, icon, hint, tone }) => (
  <Card padding="none" className="service-summary-card">
    <div className="portal-inset service-summary-box">
      <div className="service-summary-heading">
        <h3 className="service-summary-label">{label}</h3>
        <span aria-hidden="true" className={{ ok: "text-ok", danger: "text-danger", info: "text-info" }[tone]}>{icon}</span>
      </div>
      <p className="num service-summary-value">{value}</p>
      <p className="service-summary-hint">{hint}</p>
    </div>
  </Card>
);

const CommunityService = () => {
  const seed = readScreen(CACHE_KEY);
  const [data, setData] = useState(seed?.data ?? null);
  const [loading, setLoading] = useState(seed === undefined);
  const [recordPage, setRecordPage] = useState(1);
  const [calendar, setCalendar] = useState(seed?.calendar ?? null);
  const [schoolYear, setSchoolYear] = useState("all");
  const [semester, setSemester] = useState("all");
  const historyViewportRef = useRef(null);
  useEffect(() => {
    let active = true;
    api.get("/student/academic-status").then(({ data: payload }) => {
      if (!active || !payload?.years) return;
      setCalendar(payload);
      // The academic calendar changes at most once a year; cache it with the
      // ledger so the filter is available immediately on the next visit.
      writeScreen(CACHE_KEY, { ...(readScreen(CACHE_KEY) || {}), calendar: payload });
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  usePageMeta("Community Service", "Track your attendance and service hours.");

  const fetchData = useCallback(async ({ silent = false } = {}) => {
    const previous = readScreen(CACHE_KEY);
    if (!silent && previous === undefined) setLoading(true);
    try {
      const res = await api.get("/student/community-service");
      setData(res.data);
      writeScreen(CACHE_KEY, { ...(previous || {}), data: res.data });
    } catch (err) {
      console.error(err.response?.data || err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useAutoRefresh(fetchData, { interval: 30000 });

  if (loading) {
    return <Loading label="Loading records..." />;
  }

  const period = calendar?.years.find(item => String(item.startYear) === schoolYear);
  const records = recordsForAcademicPeriod(data?.breakdown || [], period, semester);
  const currentPage = Math.min(recordPage, Math.max(1, Math.ceil(records.length / 10)));
  const visibleRecords = records.slice((currentPage - 1) * 10, currentPage * 10);
  const changeRecordPage = (page) => {
    setRecordPage(page);
    if (historyViewportRef.current) historyViewportRef.current.scrollTop = 0;
  };

  const removedHours = (data?.breakdown || []).reduce(
    (sum, rec) =>
      sum +
      (rec.communityServiceLog || [])
        .filter((l) => l.action === "removed")
        .reduce((s, l) => s + (l.hours || 0), 0),
    0
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Student ledger"
        title="Community service"
        subtitle="Every attendance record and the hours attached to it."
      />

      <div className="alert alert-info">
        <span aria-hidden="true" className="mt-0.5 font-semibold">i</span>
        <p>
          The event organizer or admin may adjust your community service hours at
          their discretion.
        </p>
      </div>

      <div className="student-service-summary grid grid-cols-3 gap-2 md:gap-4" role="group" aria-label="Community service summary">
        <ServiceSummaryTile
          label="Events attended"
          value={data?.totalAttended || 0}
          icon={<FaCheck />}
          hint="All-time check-ins"
          tone="ok"
        />
        <ServiceSummaryTile
          label="Penalty hours"
          value={`${data?.totalHours || 0}h`}
          icon={<FaTimes />}
          hint="From late (4) and absent (8) marks"
          tone="danger"
        />
        <ServiceSummaryTile
          label="Removed hours"
          value={`${removedHours}h`}
          icon={<FaClock />}
          hint="Cleared by excuses or manual removal"
          tone="info"
        />
      </div>

      {calendar && <section className="student-card rounded-xl border border-line bg-card/60 p-4" aria-label="School year and semester filters">
        {!calendar.confirmed && <p className="mb-3 text-xs text-warn">Calendar preview: semester dates are not official. Filters below use the sample calendar.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-on-dim" htmlFor="history-school-year">School year
            <select aria-label="School year" id="history-school-year" className="field-select mt-1" value={schoolYear} onChange={event => { setSchoolYear(event.target.value); setSemester("all"); setRecordPage(1); }}>
              <option value="all">All school years</option>{calendar.years.map(item => <option key={item.startYear} value={item.startYear}>{item.label}</option>)}
            </select>
          </label>
          <label className="text-xs text-on-dim" htmlFor="history-semester">Semester
            <select aria-label="Semester" id="history-semester" className="field-select mt-1" value={semester} disabled={!period} onChange={event => { setSemester(event.target.value); setRecordPage(1); }}>
              <option value="all">All semesters</option>{period?.semesters.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs text-on-muted">Filters change the records below. Your total service balance includes all school years.</p>
      </section>}

      <FlightPanel
        level="ledger"
        glass
        flush
        eyebrow="Student ledger"
        title="Detailed breakdown"
        subtitle={`${records.length} attendance record${records.length === 1 ? "" : "s"}`}
        icon={<BsClipboardCheck />}
        className="overflow-hidden"
      >
        {!records.length ? (
          <EmptyState
            icon={<BsClipboardCheck />}
            title="No attendance records"
            description={period ? "No attendance records match this school year and semester." : "Your attendance and community service records will appear here."}
          />
        ) : (
          <div>
          <div className="student-history-pagination px-4 pt-4"><Pagination page={currentPage} pageSize={10} total={records.length} onChange={changeRecordPage} label="Attendance history pages" /></div>
          <div ref={historyViewportRef} className="student-history-viewport overflow-x-auto" role="region" aria-label="Attendance breakdown table" tabIndex={0}>
            <table className="data-table student-history-table">
              <colgroup>
                <col style={{ width: "35%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "17%" }} />
                <col style={{ width: "20%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Community service</th>
                  <th>Checked in</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.map((record, index) => (
                  <tr key={record._id || index}>
                    <td className="font-medium text-on">
                      {record.event?.title || record.eventTitle || "Unknown event"}
                    </td>
                    <td>
                      {record.event?.date
                        ? formatDate(record.event.date)
                        : record.eventDate
                          ? formatDate(record.eventDate)
                          : "—"}
                    </td>
                    <td>
                      <StatusBadge status={record.status} />
                    </td>
                    <td>
                      <span
                        className={`num font-medium ${
                          record.communityServiceHours > 0 ? "text-warn" : "text-ok"
                        }`}
                      >
                        {record.communityServiceHours || 0} hours
                      </span>
                    </td>
                    <td className="text-xs">
                      {record.attendedAt ? formatDateTime(record.attendedAt) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        )}
      </FlightPanel>

      <BaseCard
        title="Penalty guide"
        description="How each attendance status affects your hours."
        icon={<FaBook />}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {[
            { status: "present", hours: "0 hours", copy: "No adjustment" },
            { status: "late", hours: "4 hours", copy: "Added to your total" },
            { status: "absent", hours: "8 hours", copy: "Added to your total" },
          ].map((item) => (
            <div
              key={item.status}
              className="student-card flex items-center justify-between gap-3 rounded-xl border border-line bg-card-alt/40 p-3.5"
            >
              <StatusChip status={item.status} />
              <div className="text-right">
                <p className="num text-sm font-semibold text-on">{item.hours}</p>
                <p className="text-[11px] text-on-muted">{item.copy}</p>
              </div>
            </div>
          ))}
        </div>
      </BaseCard>
    </div>
  );
};

export default CommunityService;

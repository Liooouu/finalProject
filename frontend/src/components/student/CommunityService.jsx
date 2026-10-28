import React, { useState, useEffect, useCallback } from "react";
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
import { BaseCard, FlightPanel, PageHeader, StatTile, StatusChip } from "../ui";
import { readScreen, writeScreen } from "../../utils/queryCache";

const CACHE_KEY = "student:community-service";

const CommunityService = () => {
  const seed = readScreen(CACHE_KEY);
  const [data, setData] = useState(seed?.data ?? null);
  const [loading, setLoading] = useState(seed === undefined);
  const [recordPage, setRecordPage] = useState(1);
  const [calendar, setCalendar] = useState(seed?.calendar ?? null);
  const [schoolYear, setSchoolYear] = useState("all");
  const [semester, setSemester] = useState("all");
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatTile
          label="Events attended"
          value={data?.totalAttended || 0}
          icon={<FaCheck />}
          hint="All-time check-ins"
          tone="ok"
        />
        <StatTile
          label="Penalty hours"
          value={`${data?.totalHours || 0}h`}
          icon={<FaTimes />}
          hint="From late (4) and absent (8) marks"
          tone="danger"
        />
        <StatTile
          label="Removed hours"
          value={`${removedHours}h`}
          icon={<FaClock />}
          hint="Cleared by excuses or manual removal"
          tone="info"
        />
      </div>

      {calendar && <section className="rounded-xl border border-line bg-card/60 p-4" aria-label="School year and semester filters">
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
          <div className="overflow-x-auto">
            <table className="data-table">
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
                  <tr key={index}>
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
          <div className="px-4 pb-4"><Pagination page={currentPage} pageSize={10} total={records.length} onChange={setRecordPage} label="Attendance history pages" /></div>
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
              className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card-alt/40 p-3.5"
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

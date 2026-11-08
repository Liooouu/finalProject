import StudentLedgerRecord from "./StudentLedgerRecord";
import { useAcademicPeriods } from "../../utils/useAcademicPeriods";
import AcademicPeriodFilter from "../organizer/AcademicPeriodFilter";
import React, { useState, useEffect, useCallback } from "react";
import api from "../../api/axios";
import { recordsForAcademicPeriod } from "../../utils/academicPeriods";
import { useAutoRefresh } from "../../utils/useAutoRefresh";
import { FaBook, FaCheck, FaClock, FaTimes } from "react-icons/fa";
import { BsClipboardCheck } from "react-icons/bs";

import EmptyState from "../shared/EmptyState";
import Loading from "../shared/Loading";
import Pagination from "../ui/Pagination";
import StablePage from "../ui/StablePage";
import { usePageMeta } from "../../context/PageMetaContext";

import { BaseCard, Card, FlightPanel, PageHeader, StatusChip } from "../ui";
import { readScreen, writeScreen } from "../../utils/queryCache";
import ManualAttendanceHistory from "./ManualAttendanceHistory";

const CACHE_KEY = "student:community-service:manual-review";

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
  const periodSelection=useAcademicPeriods();
  const {schoolYear,semester,period}=periodSelection;

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

  const records = recordsForAcademicPeriod(data?.breakdown || [], period, semester);
  const currentPage = Math.min(recordPage, Math.max(1, Math.ceil(records.length / 5)));
  const visibleRecords = records.slice((currentPage - 1) * 5, currentPage * 5);
  const changeRecordPage = (page) => {
    setRecordPage(page);

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
          hint="Late: 4h · Incomplete: 2h · Late + incomplete: 6h · Absent: 8h per session"
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

      <AcademicPeriodFilter selection={{...periodSelection,setSchoolYear:value=>{periodSelection.setSchoolYear(value);setRecordPage(1);},setSemester:value=>{periodSelection.setSemester(value);setRecordPage(1);}}}/>
      <p className="text-xs text-on-muted">Filters change the records below. Your service balance includes all school years and semesters.</p>

      <FlightPanel
        level="ledger"
        glass
        flush
        eyebrow="Student ledger"
        title="Detailed breakdown"
        subtitle={`${records.length} attendance record${records.length === 1 ? "" : "s"}`}
        icon={<BsClipboardCheck />}
        className="overflow-hidden student-ledger-panel"
      >
        {!records.length ? (
          <EmptyState
            icon={<BsClipboardCheck />}
            title="No attendance records"
            description={period ? "No attendance records match this school year and semester." : "Your attendance and community service records will appear here."}
          />
        ) : (
          <StablePage pageKey={`${schoolYear}:${semester}:${records.length}`} footer={<div className="px-4 pb-4"><Pagination page={currentPage} pageSize={5} total={records.length} onChange={changeRecordPage} label="Attendance history pages" /></div>}>
          <ul className="student-ledger-grid" aria-label="Attendance breakdown records">{visibleRecords.map((record, index) => <li key={record._id || index}><StudentLedgerRecord record={record} /></li>)}</ul>
          </StablePage>
        )}
      </FlightPanel>

      <ManualAttendanceHistory />

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

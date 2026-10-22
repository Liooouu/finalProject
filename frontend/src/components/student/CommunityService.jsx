import React, { useState, useEffect, useCallback } from "react";
import api from "../../api/axios";
import { useAutoRefresh } from "../../utils/useAutoRefresh";
import { FaBook, FaCheck, FaClock, FaTimes } from "react-icons/fa";
import { BsClipboardCheck } from "react-icons/bs";
import StatusBadge from "../shared/StatusBadge";
import EmptyState from "../shared/EmptyState";
import Loading from "../shared/Loading";
import { usePageMeta } from "../../context/PageMetaContext";
import { formatDate, formatDateTime } from "../../utils/helpers";
import { BaseCard, FlightPanel, PageHeader, StatTile, StatusChip } from "../ui";

const CommunityService = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  usePageMeta("Community Service", "Track your attendance and service hours.");

  const fetchData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get("/student/community-service");
      setData(res.data);
    } catch (err) {
      console.error(err.response?.data || err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useAutoRefresh(fetchData);

  if (loading) {
    return <Loading label="Loading records..." />;
  }

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

      <FlightPanel
        level="ledger"
        glass
        flush
        eyebrow="Student ledger"
        title="Detailed breakdown"
        subtitle={`${data?.breakdown?.length || 0} attendance record${
          data?.breakdown?.length === 1 ? "" : "s"
        }`}
        icon={<BsClipboardCheck />}
        className="overflow-hidden"
      >
        {!data?.breakdown?.length ? (
          <EmptyState
            icon={<BsClipboardCheck />}
            title="No attendance records"
            description="Your attendance and community service records will appear here."
          />
        ) : (
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
                {data.breakdown.map((record, index) => (
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

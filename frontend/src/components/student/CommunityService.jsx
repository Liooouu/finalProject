import React, { useState, useEffect } from "react";
import api from "../../api/axios";
import { FaCheck, FaTimes, FaClock, FaBook } from "react-icons/fa";
import { BsClipboardCheck } from "react-icons/bs";
import StatusBadge from "../shared/StatusBadge";
import EmptyState from "../shared/EmptyState";
import Loading from "../shared/Loading";
import { usePageMeta } from "../../context/PageMetaContext";

const CommunityService = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  usePageMeta("Community Service", "Track your attendance and service hours.");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get("/student/community-service");
        setData(res.data);
      } catch (err) {
        console.error(err.response?.data || err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

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
    <div className="space-y-6">
      {/* Note to students about CS adjustments */}
      <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 text-sm text-on-dim">
        Note: The event organizer and admin may modify your community service hours according to your behavior.
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-linear-to-br from-yellow-500/10 to-yellow-500/5 backdrop-blur-sm border border-yellow-500/20 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <span className="text-xl"><FaClock /></span>
            </div>
            <span className="dark:text-yellow-400 text-yellow-600 text-sm font-medium">Goal Hours</span>
          </div>
          <p className="text-4xl font-bold dark:text-yellow-400 text-yellow-600">{data?.requiredHours || 0} <span className="text-lg font-normal text-on-dim">hrs</span></p>
          <p className="text-xs text-on-muted mt-1">Set by organizers/admins — stays fixed</p>
        </div>

        <div className="bg-linear-to-br from-green-500/10 to-green-500/5 backdrop-blur-sm border border-green-500/20 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <span className="text-xl"><FaCheck /></span>
            </div>
            <span className="dark:text-green-400 text-green-600 text-sm font-medium">Events Attended</span>
          </div>
          <p className="text-4xl font-bold dark:text-green-400 text-green-600">{data?.totalAttended || 0}</p>
        </div>

        <div className="bg-linear-to-br from-red-500/10 to-red-500/5 backdrop-blur-sm border border-red-500/20 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <span className="text-xl"><FaTimes /></span>
            </div>
            <span className="dark:text-red-400 text-red-600 text-sm font-medium">Penalty Hours</span>
          </div>
          <p className="text-4xl font-bold dark:text-red-400 text-red-600">
            {data?.totalHours || 0} <span className="text-lg font-normal text-on-dim">hrs</span>
          </p>
          <p className="text-xs text-on-muted mt-1">Current balance from late (4) &amp; absent (8) marks</p>
        </div>

        <div className="bg-linear-to-br from-green-500/10 to-green-500/5 backdrop-blur-sm border border-green-500/20 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <span className="text-xl"><FaTimes /></span>
            </div>
            <span className="dark:text-green-400 text-green-600 text-sm font-medium">Removed Hours</span>
          </div>
          <p className="text-4xl font-bold dark:text-green-400 text-green-600">
            {removedHours} <span className="text-lg font-normal text-on-dim">hrs</span>
          </p>
          <p className="text-xs text-on-muted mt-1">Forgiven via excuses, status changes &amp; Remove CS</p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-line bg-card overflow-hidden">
        <div className="p-6 border-b border-line">
          <h2 className="text-lg font-semibold text-on">Detailed Breakdown</h2>
        </div>
        
        {!data?.breakdown?.length ? (
          <EmptyState
            icon={<BsClipboardCheck />}
            title="No attendance records"
            description="Your attendance and community service records will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-card">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-on-dim uppercase tracking-wider">Event</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-on-dim uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-on-dim uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-on-dim uppercase tracking-wider">Community Service</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-on-dim uppercase tracking-wider">Checked In</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-white/5 divide-slate-200">
                {data.breakdown.map((record, index) => {
                  return (
                    <tr key={index} className="hover:bg-card transition-colors">
                      <td className="px-6 py-4 text-on font-medium">{record.event?.title || "Unknown Event"}</td>
                      <td className="px-6 py-4 text-on-dim">
                        {record.event?.date ? new Date(record.event.date).toLocaleDateString() : "-"}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={record.status} />
                      </td>
                      <td className="px-6 py-4">
                        {record.communityServiceHours > 0 ? (
                          <span className="dark:text-yellow-400 text-yellow-600 font-medium">{record.communityServiceHours} hours</span>
                        ) : (
                          <span className="dark:text-green-400 text-green-600 font-medium">0 hours</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-on-dim text-sm">
                        {new Date(record.attendedAt).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Penalty Guide */}
      <div className="rounded-xl border border-line bg-card p-6">
        <h3 className="text-lg font-semibold text-on mb-4 flex items-center gap-2">
          <span><FaBook /></span> Penalty Guide
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-4 bg-green-500/10 rounded-xl border border-green-500/20">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 dark:text-green-400 text-green-600">Present</span>
            <span className="text-on-dim text-sm">→ 0 hours</span>
          </div>
          <div className="flex items-center gap-3 p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-500/20 dark:text-yellow-400 text-yellow-600">Late</span>
            <span className="text-on-dim text-sm">→ 4 hours</span>
          </div>
          <div className="flex items-center gap-3 p-4 bg-red-500/10 rounded-xl border border-red-500/20">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-500/20 dark:text-red-400 text-red-600">Absent</span>
            <span className="text-on-dim text-sm">→ 8 hours</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunityService;

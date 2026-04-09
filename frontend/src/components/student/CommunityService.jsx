import React, { useState, useEffect } from "react";
import api from "../../api/axios";

const CommunityService = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

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
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Loading records...</span>
        </div>
      </div>
    );
  }

  const statusConfig = {
    present: { bg: "bg-green-500/20", text: "text-green-400", border: "border-green-500/30" },
    late: { bg: "bg-yellow-500/20", text: "text-yellow-400", border: "border-yellow-500/30" },
    absent: { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/30" },
    pending: { bg: "bg-gray-500/20", text: "text-gray-400", border: "border-gray-500/30" },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Community Service Records</h1>
        <p className="text-gray-400 mt-1">Track your attendance and community service hours</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 backdrop-blur-sm border border-yellow-500/20 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <span className="text-xl">⏱️</span>
            </div>
            <span className="text-yellow-400 text-sm font-medium">Total Hours</span>
          </div>
          <p className="text-4xl font-bold text-yellow-400">{data?.totalHours || 0} <span className="text-lg font-normal text-gray-400">hrs</span></p>
        </div>

        <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 backdrop-blur-sm border border-green-500/20 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <span className="text-xl">✅</span>
            </div>
            <span className="text-green-400 text-sm font-medium">Events Attended</span>
          </div>
          <p className="text-4xl font-bold text-green-400">{data?.totalAttended || 0}</p>
        </div>

        <div className="bg-gradient-to-br from-red-500/10 to-red-500/5 backdrop-blur-sm border border-red-500/20 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <span className="text-xl">❌</span>
            </div>
            <span className="text-red-400 text-sm font-medium">Pending Hours</span>
          </div>
          <p className="text-4xl font-bold text-red-400">
            {data?.breakdown?.filter(a => a.status === "absent").length * 4 || 0} <span className="text-lg font-normal text-gray-400">hrs</span>
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Detailed Breakdown</h2>
        </div>
        
        {!data?.breakdown?.length ? (
          <div className="p-12 text-center">
            <span className="text-5xl mb-4 block">📋</span>
            <p className="text-gray-400">No attendance records found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Event</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Community Service</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Checked In</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.breakdown.map((record, index) => {
                  const status = statusConfig[record.status] || statusConfig.pending;
                  return (
                    <tr key={index} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 text-white font-medium">{record.event?.title || "Unknown Event"}</td>
                      <td className="px-6 py-4 text-gray-400">
                        {record.event?.date ? new Date(record.event.date).toLocaleDateString() : "-"}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text} border ${status.border}`}>
                          {record.status?.charAt(0).toUpperCase() + record.status?.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {record.communityServiceHours > 0 ? (
                          <span className="text-yellow-400 font-medium">{record.communityServiceHours} hours</span>
                        ) : (
                          <span className="text-green-400 font-medium">0 hours</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-sm">
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
      <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span>📖</span> Penalty Guide
        </h3>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-4 bg-green-500/10 rounded-xl border border-green-500/20">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">Present</span>
            <span className="text-gray-400 text-sm">→ 0 hours</span>
          </div>
          <div className="flex items-center gap-3 p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">Late</span>
            <span className="text-gray-400 text-sm">→ 2 hours</span>
          </div>
          <div className="flex items-center gap-3 p-4 bg-red-500/10 rounded-xl border border-red-500/20">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400">Absent</span>
            <span className="text-gray-400 text-sm">→ 4 hours</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunityService;

import React, { useState, useEffect } from "react";
import api from "../../api/axios";

const ManageExcuses = () => {
  const [excuses, setExcuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [selectedExcuse, setSelectedExcuse] = useState(null);
  const [responseNote, setResponseNote] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchExcuses = async () => {
      try {
        const res = await api.get("/organizer/excuses");
        setExcuses(res.data);
      } catch (err) {
        console.error(err.response?.data || err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchExcuses();
  }, []);

  const filteredExcuses = excuses.filter(e => e.status === filter);

  const handleApprove = async (id) => {
    try {
      const res = await api.patch(`/organizer/excuses/${id}`, {
        status: "approved",
        responseNote,
      });
      setExcuses(excuses.map(e => e._id === id ? res.data : e));
      setMessage("Excuse approved!");
      setSelectedExcuse(null);
      setResponseNote("");
    } catch (err) {
      setMessage(err.response?.data?.error || "Failed to approve excuse");
    }
  };

  const handleReject = async (id) => {
    try {
      const res = await api.patch(`/organizer/excuses/${id}`, {
        status: "rejected",
        responseNote,
      });
      setExcuses(excuses.map(e => e._id === id ? res.data : e));
      setMessage("Excuse rejected!");
      setSelectedExcuse(null);
      setResponseNote("");
    } catch (err) {
      setMessage(err.response?.data?.error || "Failed to reject excuse");
    }
  };

  const statusConfig = {
    pending: { bg: "bg-yellow-500/20", text: "text-yellow-400", border: "border-yellow-500/30" },
    approved: { bg: "bg-green-500/20", text: "text-green-400", border: "border-green-500/30" },
    rejected: { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/30" },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Loading excuses...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Manage Excuses</h1>
        <p className="text-gray-400 mt-1">Review and manage student excuse letters</p>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-xl ${message.includes("approved") ? "bg-green-500/20 border border-green-500/30 text-green-400" : "bg-red-500/20 border border-red-500/30 text-red-400"}`}>
          {message}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {["pending", "approved", "rejected"].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-5 py-2 rounded-lg font-medium transition-all duration-200 capitalize ${
              filter === status
                ? "bg-red-600 text-white shadow-lg shadow-red-600/30"
                : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10"
            }`}
          >
            {status}
            <span className="ml-2 text-sm opacity-75">
              ({excuses.filter(e => e.status === status).length})
            </span>
          </button>
        ))}
      </div>

      {/* Excuses List */}
      {filteredExcuses.length === 0 ? (
        <div className="bg-linear-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-12 text-center">
          <span className="text-5xl mb-4 block">📝</span>
          <p className="text-gray-400">No {filter} excuses found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredExcuses.map((excuse) => {
            const status = statusConfig[excuse.status];
            return (
              <div key={excuse._id} className="bg-linear-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-red-500/20 rounded-xl">
                      <span className="text-2xl">👤</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">{excuse.student?.name || "Unknown Student"}</h3>
                      <p className="text-sm text-gray-400">{excuse.student?.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                      {excuse.status}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(excuse.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Event Info */}
                <div className="p-4 bg-white/5 rounded-xl mb-4">
                  <p className="text-sm text-gray-400 mb-1">Event:</p>
                  <p className="font-medium text-white">{excuse.event?.title || "Unknown Event"}</p>
                  <p className="text-sm text-gray-500">
                    {excuse.event?.date ? new Date(excuse.event.date).toLocaleDateString() : ""}
                  </p>
                </div>

                {/* Excuse Text */}
                <div className="mb-4">
                  <p className="text-sm text-gray-400 mb-1">Excuse:</p>
                  <p className="text-white">{excuse.excuseText}</p>
                </div>

                {/* Attachment */}
                {excuse.attachmentUrl && (
                  <div className="mb-4">
                    <a
                      href={`http://localhost:5000${excuse.attachmentUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors"
                    >
                      <span>📄</span> View Attachment
                    </a>
                  </div>
                )}

                {/* Response Note */}
                {excuse.responseNote && (
                  <div className="p-4 bg-white/5 rounded-xl mb-4 border-l-4 border-green-500">
                    <p className="text-sm text-gray-400 mb-1">Response Note:</p>
                    <p className="text-white">{excuse.responseNote}</p>
                    {excuse.reviewedBy && (
                      <p className="text-xs text-gray-500 mt-1">By: {excuse.reviewedBy.name}</p>
                    )}
                  </div>
                )}

                {/* Review Actions */}
                {filter === "pending" && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <button
                      onClick={() => setSelectedExcuse(selectedExcuse === excuse._id ? null : excuse._id)}
                      className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
                    >
                      {selectedExcuse === excuse._id ? "Cancel" : "Review Excuse"}
                    </button>

                    {selectedExcuse === excuse._id && (
                      <div className="mt-4 space-y-4">
                        <textarea
                          value={responseNote}
                          onChange={(e) => setResponseNote(e.target.value)}
                          placeholder="Add a response note (optional)..."
                          rows={3}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
                        />
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleApprove(excuse._id)}
                            className="flex-1 bg-linear-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-semibold py-3 rounded-xl shadow-lg shadow-green-600/30 transition-all duration-200"
                          >
                            ✓ Approve
                          </button>
                          <button
                            onClick={() => handleReject(excuse._id)}
                            className="flex-1 bg-linear-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold py-3 rounded-xl shadow-lg shadow-red-600/30 transition-all duration-200"
                          >
                            ✗ Reject
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ManageExcuses;

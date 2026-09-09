import React, { useState, useEffect } from "react";
import api from "../../api/axios";
import { FaEdit, FaUser, FaFileAlt, FaCheck, FaTimes } from "react-icons/fa";
import StatusBadge from "../shared/StatusBadge";
import EmptyState from "../shared/EmptyState";
import Loading from "../shared/Loading";
import { usePageMeta } from "../../context/PageMetaContext";
import Button from "../ui/Button";

const ManageExcuses = () => {
  const [excuses, setExcuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [selectedExcuse, setSelectedExcuse] = useState(null);
  const [responseNote, setResponseNote] = useState("");
  const [message, setMessage] = useState("");

  usePageMeta("Manage Excuses", "Review and manage student excuse letters.");

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

  if (loading) {
    return <Loading label="Loading excuses..." />;
  }

  return (
    <div className="space-y-6">
      {/* Message */}
      {message && (
        <div className={`rounded-lg border px-3.5 py-2.5 text-sm ${message.includes("approved") ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"}`}>
          {message}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {["pending", "approved", "rejected"].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
              filter === status
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-card text-on-dim hover:bg-card-alt hover:text-on border border-line"
            }`}
          >
            {status}
            <span className="ml-2 text-xs opacity-75">
              ({excuses.filter(e => e.status === status).length})
            </span>
          </button>
        ))}
      </div>

      {/* Excuses List */}
      {filteredExcuses.length === 0 ? (
        <div className="rounded-xl border border-line bg-card">
          <EmptyState icon={<FaEdit />} title={`No ${filter} excuses`} description="Excuse letters submitted by students will appear here." />
        </div>
      ) : (
        <div className="space-y-4">
          {filteredExcuses.map((excuse) => {
            return (
              <div key={excuse._id} className="rounded-xl border border-line bg-card p-6">
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 ring-1 ring-inset ring-indigo-500/20 dark:text-indigo-400">
                      <FaUser className="text-lg" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-on">{excuse.student?.name || "Unknown Student"}</h3>
                      <p className="text-sm text-on-dim">{excuse.student?.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-2 flex-wrap">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          excuse.type === "advance"
                            ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                            : "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                        }`}
                      >
                        {excuse.type === "advance" ? "Advance" : "Absence"}
                      </span>
                      <StatusBadge status={excuse.status} />
                    </div>
                    <p className="text-xs text-on-muted mt-1">
                      {new Date(excuse.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Event Info */}
                <div className="p-4 bg-card rounded-xl mb-4">
                  <p className="text-sm text-on-dim mb-1">
                    Event:{excuse.type === "advance" && (
                      <span className="dark:text-blue-400 text-blue-600 font-medium"> filed in advance</span>
                    )}
                  </p>
                  <p className="font-medium text-on">{excuse.event?.title || "Unknown Event"}</p>
                  <p className="text-sm text-on-muted">
                    {excuse.event?.date ? new Date(excuse.event.date).toLocaleDateString() : ""}
                  </p>
                </div>

                {/* Excuse Text */}
                <div className="mb-4">
                  <p className="text-sm text-on-dim mb-1">Excuse:</p>
                  <p className="text-on">{excuse.excuseText}</p>
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
                      <span><FaFileAlt /></span> View Attachment
                    </a>
                  </div>
                )}

                {/* Response Note */}
                {excuse.responseNote && (
                  <div className="p-4 bg-card rounded-xl mb-4 border-l-4 border-green-500">
                    <p className="text-sm text-on-dim mb-1">Response Note:</p>
                    <p className="text-on">{excuse.responseNote}</p>
                    {excuse.reviewedBy && (
                      <p className="text-xs text-on-muted mt-1">By: {excuse.reviewedBy.name}</p>
                    )}
                  </div>
                )}

                {/* Review Actions */}
                {filter === "pending" && (
                  <div className="mt-4 pt-4 border-t border-line">
                    <button
                      onClick={() => setSelectedExcuse(selectedExcuse === excuse._id ? null : excuse._id)}
                      className="text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-500 dark:text-indigo-400"
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
                          className="w-full bg-card border border-line rounded-lg px-3.5 py-2.5 text-on placeholder-on-muted focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
                        />
                        <div className="flex gap-3">
                          <Button
                            onClick={() => handleApprove(excuse._id)}
                            variant="primary"
                            className="flex-1"
                          >
                            <FaCheck /> Approve
                          </Button>
                          <Button
                            onClick={() => handleReject(excuse._id)}
                            variant="danger"
                            className="flex-1"
                          >
                            <FaTimes /> Reject
                          </Button>
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

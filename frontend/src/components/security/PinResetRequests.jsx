// frontend/src/components/security/PinResetRequests.jsx
// Staff-side queue for the camera-less "Request a PIN reset" flow. Mounted by
// both the admin and the organizer dashboards — organizers see the whole queue,
// so a student can be verified on-site by whichever staff member is present.
import React, { useState, useEffect } from "react";
import api from "../../api/axios";
import { FaCheck, FaTimes, FaKey } from "react-icons/fa";
import StatusBadge from "../shared/StatusBadge";
import { usePageMeta } from "../../context/PageMetaContext";
import { TableSkeleton } from "../ui";
import ConfirmDialog from "../ui/ConfirmDialog";

const PinResetRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewTarget, setReviewTarget] = useState(null); // { request, action }
  const [reviewNote, setReviewNote] = useState("");
  const [clearDevices, setClearDevices] = useState(false);
  const [approvedPin, setApprovedPin] = useState(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  usePageMeta(
    "PIN Reset Requests",
    "Students who need their security PIN reset without face verification."
  );

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/security/pin-reset-requests");
      setRequests(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  const groupLabel = (student) => {
    if (!student) return "";
    const p = String(student.program || "").trim().toUpperCase();
    const y = student.yearLevel != null ? String(student.yearLevel) : "";
    const sec = String(student.section || "").trim().toUpperCase();
    if (p && y && sec) return `${p}-${y}${sec}`;
    return "";
  };

  const handleReview = async (request, action) => {
    try {
      const res = await api.post(
        `/admin/security/pin-reset-requests/${request._id}/review`,
        {
          action,
          note: action === "rejected" ? reviewNote : "",
          clearDevices: action === "approved" ? clearDevices : false,
        }
      );
      setRequests(
        requests.map((r) => (r._id === request._id ? res.data.request : r))
      );
      if (action === "approved") {
        // Keep the dialog open and swap its contents for the new PIN.
        setApprovedPin(res.data.pin);
      } else {
        setReviewTarget(null);
        setReviewNote("");
        setClearDevices(false);
        setMessage(res.data.message || "Request rejected");
        setMessageType("success");
      }
    } catch (err) {
      console.error(err);
      setReviewTarget(null);
      setApprovedPin(null);
      setMessage(err.response?.data?.message || "Failed to review request");
      setMessageType("error");
    }
  };

  const resetDialog = () => {
    setReviewTarget(null);
    setApprovedPin(null);
    setReviewNote("");
    setClearDevices(false);
  };

  return (
    <div className="space-y-4">
      {message && (
        <div
          role="status"
          className={`rounded-lg border px-3.5 py-2.5 text-sm ${
            messageType === "error"
              ? "border-red-200 bg-red-50 text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          }`}
        >
          {message}
        </div>
      )}

      <p className="text-sm text-on-dim">
        {pendingCount} pending &middot; {requests.length} total requests
      </p>

      {loading ? (
        <TableSkeleton rows={4} />
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-line bg-card py-12 text-center text-sm text-on-dim">
          No PIN reset requests
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => {
            const label = groupLabel(request.student);
            return (
              <div key={request._id} className="rounded-xl border border-line bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {request.student?.name || "Unknown student"}
                      {label && (
                        <span className="ml-2 rounded-full bg-card-alt px-2 py-0.5 text-xs font-medium text-on-dim">
                          {label}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-on-dim">{request.student?.email}</p>
                  </div>
                  <StatusBadge status={request.status} />
                </div>

                {request.note && (
                  <p className="mt-4 text-sm text-on-dim">&quot;{request.note}&quot;</p>
                )}

                <p className="mt-3 text-xs text-on-muted">
                  Submitted {new Date(request.createdAt).toLocaleString()}
                  {request.deviceLabel ? ` from ${request.deviceLabel}` : ""}
                </p>

                {request.status === "pending" && (
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setReviewNote("");
                        setClearDevices(false);
                        setApprovedPin(null);
                        setReviewTarget({ request, action: "approved" });
                      }}
                      className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-600 transition-colors hover:bg-emerald-500/20 dark:text-emerald-400"
                    >
                      <FaCheck className="text-xs" /> Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReviewNote("");
                        setApprovedPin(null);
                        setReviewTarget({ request, action: "rejected" });
                      }}
                      className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/20 dark:text-red-400"
                    >
                      <FaTimes className="text-xs" /> Reject
                    </button>
                  </div>
                )}

                {request.status !== "pending" && request.responseNote && (
                  <p className="mt-3 text-sm text-on-dim">
                    <span className="font-medium text-on">Note:</span> {request.responseNote}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!reviewTarget}
        title={
          approvedPin
            ? "New security PIN minted"
            : reviewTarget?.action === "approved"
              ? "Approve this PIN reset?"
              : "Reject this PIN reset request?"
        }
        message={
          approvedPin
            ? "Give this PIN to the student in person. It replaces their previous PIN and clears every lockout."
            : reviewTarget?.action === "approved"
              ? `Approving mints a fresh PIN for "${
                  reviewTarget?.request?.student?.name || "this student"
                }" and trusts the device they filed this request from. Verify their identity in person first.`
              : "Rejecting notifies the student that their request was declined. Add a reason below."
        }
        confirmLabel={approvedPin ? "Done" : reviewTarget?.action === "approved" ? "Approve" : "Reject"}
        cancelLabel={approvedPin ? "Close" : "Cancel"}
        variant={approvedPin ? "default" : reviewTarget?.action === "approved" ? "default" : "danger"}
        icon={approvedPin ? <FaKey /> : undefined}
        onConfirm={() => {
          if (approvedPin) {
            resetDialog();
            setMessage("Security PIN reset");
            setMessageType("success");
            return;
          }
          if (reviewTarget) handleReview(reviewTarget.request, reviewTarget.action);
        }}
        onCancel={resetDialog}
      >
        {approvedPin ? (
          <p className="mt-3 rounded-xl border border-dashed border-indigo-400/50 bg-indigo-500/5 px-4 py-3 text-center text-2xl font-bold tracking-[0.4em] text-on">
            {approvedPin}
          </p>
        ) : (
          <>
            {reviewTarget?.action === "approved" && (
              <label className="mt-3 flex items-center gap-2 text-sm text-on-dim">
                <input
                  type="checkbox"
                  checked={clearDevices}
                  onChange={(e) => setClearDevices(e.target.checked)}
                  className="accent-indigo-600"
                />
                Also remove all other trusted devices (student lost every browser)
              </label>
            )}
            {reviewTarget?.action === "rejected" && (
              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="Optional reason for rejection (shown to the student)..."
                rows={2}
                className="mt-3 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-on placeholder-on-muted focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            )}
          </>
        )}
      </ConfirmDialog>
    </div>
  );
};

export default PinResetRequests;

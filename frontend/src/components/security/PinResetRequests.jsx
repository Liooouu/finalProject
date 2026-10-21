// frontend/src/components/security/PinResetRequests.jsx
// Staff-side queue for the camera-less "Request a PIN reset" flow. Mounted by
// both the admin and the organizer dashboards — organizers see the whole queue,
// so a student can be verified on-site by whichever staff member is present.
import React, { useState, useEffect } from "react";
import api from "../../api/axios";
import { FaCheck, FaKey, FaTimes, FaUserShield } from "react-icons/fa";
import StatusBadge from "../shared/StatusBadge";
import EmptyState from "../shared/EmptyState";
import { usePageMeta } from "../../context/PageMetaContext";
import { Button, Card, PageHeader, TableSkeleton } from "../ui";
import ConfirmDialog from "../ui/ConfirmDialog";
import { formatDateTime } from "../../utils/helpers";

const PinResetRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewTarget, setReviewTarget] = useState(null); // { request, action }
  const [reviewNote, setReviewNote] = useState("");
  const [clearDevices, setClearDevices] = useState(false);
  const [approvedPin, setApprovedPin] = useState(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [reviewing, setReviewing] = useState(false);

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
    if (reviewing) return;
    setReviewing(true);
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
        (prev) => prev.map((r) => (r._id === request._id ? res.data.request : r))
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
    } finally {
      setReviewing(false);
    }
  };

  const resetDialog = () => {
    setReviewTarget(null);
    setApprovedPin(null);
    setReviewNote("");
    setClearDevices(false);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Security queue"
        title="PIN reset requests"
        subtitle={`${pendingCount} pending · ${requests.length} total requests`}
      />

      {message && (
        <div
          role="status"
          className={`alert ${messageType === "error" ? "alert-danger" : "alert-ok"}`}
        >
          <span aria-hidden="true">{messageType === "error" ? "!" : "✓"}</span>
          <p>{message}</p>
        </div>
      )}

      {loading ? (
        <Card>
          <TableSkeleton rows={4} />
        </Card>
      ) : requests.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FaUserShield />}
            title="No PIN reset requests"
            description="Requests from students who cannot use face verification will appear here."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => {
            const label = groupLabel(request.student);
            return (
              <Card key={request._id} as="article">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-inset ring-brand/20">
                      <FaUserShield />
                    </span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium text-on">
                        {request.student?.name || "Unknown student"}
                        {label && (
                          <span className="rounded-full border border-line bg-card-alt px-2 py-0.5 text-[11px] font-medium text-on-dim">
                            {label}
                          </span>
                        )}
                      </p>
                      <p className="truncate text-sm text-on-dim">{request.student?.email}</p>
                    </div>
                  </div>
                  <StatusBadge status={request.status} />
                </div>

                {request.note && (
                  <p className="mt-4 rounded-xl border border-line bg-card-alt/40 px-3.5 py-3 text-sm leading-relaxed text-on-dim">
                    &quot;{request.note}&quot;
                  </p>
                )}

                <p className="mt-3 text-xs text-on-muted">
                  Submitted {formatDateTime(request.createdAt)}
                  {request.deviceLabel ? ` from ${request.deviceLabel}` : ""}
                </p>

                {request.status === "pending" && (
                  <div className="mt-4 flex gap-2 border-t border-line pt-4">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setReviewNote("");
                        setClearDevices(false);
                        setApprovedPin(null);
                        setReviewTarget({ request, action: "approved" });
                      }}
                    >
                      <FaCheck className="text-xs" /> Approve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        setReviewNote("");
                        setApprovedPin(null);
                        setReviewTarget({ request, action: "rejected" });
                      }}
                    >
                      <FaTimes className="text-xs" /> Reject
                    </Button>
                  </div>
                )}

                {request.status !== "pending" && request.responseNote && (
                  <p className="mt-3 border-t border-line pt-3 text-sm text-on-dim">
                    <span className="font-medium text-on">Note:</span>{" "}
                    {request.responseNote}
                  </p>
                )}
              </Card>
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
        busy={reviewing}
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
          <p className="num mt-3 rounded-xl border border-dashed border-brand/40 bg-brand/5 px-4 py-3 text-center text-2xl font-bold tracking-[0.4em] text-on">
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
                  className="accent-[var(--brand-solid)]"
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
                className="field mt-3"
              />
            )}
          </>
        )}
      </ConfirmDialog>
    </div>
  );
};

export default PinResetRequests;

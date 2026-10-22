import React, { useState, useEffect, useCallback } from "react";
import api from "../../api/axios";
import { useAutoRefresh } from "../../utils/useAutoRefresh";
import {
  FaCheck,
  FaEdit,
  FaFileAlt,
  FaTimes,
  FaTrash,
  FaUser,
} from "react-icons/fa";
import StatusBadge from "../shared/StatusBadge";
import EmptyState from "../shared/EmptyState";
import Loading from "../shared/Loading";
import { usePageMeta } from "../../context/PageMetaContext";
import {
  Button,
  Card,
  PageHeader,
  SegmentedControl,
} from "../ui";
import ConfirmDialog from "../ui/ConfirmDialog";
import { formatDate } from "../../utils/helpers";
import { getUserRole } from "../../utils/auth";

const API_BASE = api.defaults.baseURL.replace(/\/api$/, "");

const ManageExcuses = () => {
  const role = getUserRole();
  const isAdmin = role === "admin";
  const [excuses, setExcuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [selectedExcuse, setSelectedExcuse] = useState(null);
  const [responseNote, setResponseNote] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [reviewingId, setReviewingId] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  usePageMeta(
    "Manage Excuses",
    isAdmin
      ? "Review excuse letters from every event."
      : "Review and manage student excuse letters."
  );

  const fetchExcuses = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get("/organizer/excuses");
      setExcuses(res.data);
    } catch (err) {
      console.error(err.response?.data || err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExcuses();
  }, [fetchExcuses]);

  useAutoRefresh(fetchExcuses);

  const filteredExcuses = excuses.filter((e) => e.status === filter);

  const showMessage = (text, type) => {
    setMessage(text);
    setMessageType(type);
  };

  const handleApprove = async (id) => {
    if (reviewingId) return;
    setReviewingId(id);
    try {
      const res = await api.patch(`/organizer/excuses/${id}`, {
        status: "approved",
        responseNote,
        removal: "complete",
      });
      setExcuses((prev) => prev.map((e) => (e._id === id ? res.data : e)));
      showMessage("Excuse approved!", "success");
      setSelectedExcuse(null);
      setResponseNote("");
    } catch (err) {
      showMessage(err.response?.data?.error || "Failed to approve excuse", "error");
    } finally {
      setReviewingId(null);
    }
  };

  const handleReject = async (id) => {
    if (reviewingId) return;
    setReviewingId(id);
    try {
      const res = await api.patch(`/organizer/excuses/${id}`, {
        status: "rejected",
        responseNote,
      });
      setExcuses((prev) => prev.map((e) => (e._id === id ? res.data : e)));
      showMessage("Excuse rejected!", "success");
      setSelectedExcuse(null);
      setResponseNote("");
    } catch (err) {
      showMessage(err.response?.data?.error || "Failed to reject excuse", "error");
    } finally {
      setReviewingId(null);
    }
  };

  const reviewedExcuseCount = excuses.filter((e) => e.status !== "pending").length;

  // Uploaded files are stored as "/uploads/..." and must be resolved against
  // the API origin (the SPA dev server does not proxy that path).
  const fileUrl = (url) => (/^https?:\/\//i.test(url) ? url : `${API_BASE}${url}`);

  const confirmDeleteOne = (id) => setPendingDelete({ type: "one", id });
  const confirmDeleteAll = () => setPendingDelete({ type: "all" });

  const doDelete = async () => {
    const target = pendingDelete;
    if (!target || deleting) return;
    setDeleting(true);
    try {
      if (target.type === "all") {
        const res = await api.delete("/organizer/excuses");
        setExcuses((prev) => prev.filter((e) => e.status === "pending"));
        showMessage(
          `${res.data.deleted} reviewed ${res.data.deleted === 1 ? "excuse" : "excuses"} deleted!`,
          "success"
        );
      } else {
        await api.delete(`/organizer/excuses/${target.id}`);
        setExcuses((prev) => prev.filter((e) => e._id !== target.id));
        showMessage("Excuse deleted!", "success");
      }
      setPendingDelete(null);
    } catch (err) {
      showMessage(err.response?.data?.error || "Failed to delete excuse", "error");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <Loading label="Loading excuses..." />;
  }

  const counts = {
    pending: excuses.filter((e) => e.status === "pending").length,
    approved: excuses.filter((e) => e.status === "approved").length,
    rejected: excuses.filter((e) => e.status === "rejected").length,
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={isAdmin ? "Institution review" : "Organizer review"}
        title="Excuse letters"
        subtitle={`${counts.pending} waiting for review · ${reviewedExcuseCount} reviewed`}
        actions={
          reviewedExcuseCount > 0 && (
            <Button onClick={confirmDeleteAll} variant="danger" size="sm">
              <FaTrash className="text-xs" /> Delete reviewed ({reviewedExcuseCount})
            </Button>
          )
        }
      />

      {message && (
        <div
          className={`alert ${messageType === "success" ? "alert-ok" : "alert-danger"}`}
          role="status"
        >
          <span aria-hidden="true">{messageType === "success" ? "✓" : "!"}</span>
          <p>{message}</p>
        </div>
      )}

      <SegmentedControl
        ariaLabel="Filter excuses"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "pending", label: "Pending", count: counts.pending },
          { value: "approved", label: "Approved", count: counts.approved },
          { value: "rejected", label: "Rejected", count: counts.rejected },
        ]}
      />

      {filteredExcuses.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FaEdit />}
            title={`No ${filter} excuses`}
            description="Excuse letters submitted by students will appear here."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredExcuses.map((excuse) => (
            <Card key={excuse._id} as="article">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-inset ring-brand/20">
                    <FaUser />
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate font-display text-[17px] font-semibold tracking-tight text-on">
                      {excuse.student?.name || "Unknown student"}
                    </h3>
                    <p className="truncate text-sm text-on-dim">{excuse.student?.email}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                      excuse.type === "advance"
                        ? "bg-info/10 text-info ring-info/25"
                        : "bg-excused/10 text-excused ring-excused/25"
                    }`}
                  >
                    {excuse.type === "advance" ? "Advance" : "Absence"}
                  </span>
                  <StatusBadge status={excuse.status} />
                  <span className="text-xs text-on-muted">
                    {formatDate(excuse.createdAt)}
                  </span>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-line bg-card-alt/40 p-3.5">
                <p className="text-xs text-on-muted">
                  Event
                  {excuse.type === "advance" && (
                    <span className="font-medium text-info"> · filed in advance</span>
                  )}
                </p>
                <p className="mt-0.5 text-sm font-medium text-on">
                  {excuse.event?.title || "Unknown event"}
                </p>
                <p className="text-xs text-on-muted">
                  {excuse.event?.date ? formatDate(excuse.event.date) : ""}
                </p>
              </div>

              <div className="mt-4">
                <p className="text-xs font-medium text-on-muted">Excuse</p>
                <p className="mt-1 text-sm leading-relaxed text-on">{excuse.excuseText}</p>
              </div>

              {(excuse.attachments?.length || excuse.attachmentUrl) && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-on-muted">Attachments</p>
                  <div className="mt-2 flex flex-wrap gap-2.5">
                    {(excuse.attachments?.length
                      ? excuse.attachments
                      : [excuse.attachmentUrl]
                    ).map((url, idx) => {
                      const isImage = /\.(jpe?g|png|gif|webp)$/i.test(url);
                      return isImage ? (
                        <a
                          key={idx}
                          href={fileUrl(url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group block"
                        >
                          <img
                            src={fileUrl(url)}
                            alt={`Attachment ${idx + 1}`}
                            className="h-24 w-24 rounded-lg object-cover ring-1 ring-line transition-all group-hover:ring-2 group-hover:ring-brand/50"
                          />
                        </a>
                      ) : (
                        <a
                          key={idx}
                          href={fileUrl(url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-lg border border-info/25 bg-info/10 px-3.5 py-2 text-sm font-medium text-info transition-colors hover:bg-info/15"
                        >
                          <FaFileAlt />
                          {excuse.attachments?.length > 1
                            ? `Attachment ${idx + 1}`
                            : "View attachment"}
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {excuse.responseNote && (
                <div className="alert alert-ok mt-4">
                  <FaCheck className="mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide">Response note</p>
                    <p className="mt-0.5">{excuse.responseNote}</p>
                    {excuse.reviewedBy && (
                      <p className="mt-1 text-xs opacity-80">By {excuse.reviewedBy.name}</p>
                    )}
                  </div>
                </div>
              )}

              {filter === "pending" && (
                <div className="mt-4 border-t border-line pt-4">
                  <Button
                    onClick={() =>
                      setSelectedExcuse(selectedExcuse === excuse._id ? null : excuse._id)
                    }
                    variant={selectedExcuse === excuse._id ? "ghost" : "secondary"}
                    size="sm"
                  >
                    {selectedExcuse === excuse._id ? "Cancel review" : "Review excuse"}
                  </Button>

                  {selectedExcuse === excuse._id && (
                    <div className="mt-4 space-y-4">
                      <textarea
                        value={responseNote}
                        onChange={(e) => setResponseNote(e.target.value)}
                        placeholder="Add a response note (optional)..."
                        rows={3}
                        className="field"
                      />
                      {excuse.type === "absence" && (
                        <p className="rounded-lg border border-line bg-card-alt/50 px-3.5 py-2 text-xs text-on-muted">
                          Approving forgives this event&apos;s penalty only (the{" "}
                          {excuse.removedHours || 8} hours recorded for this event).
                        </p>
                      )}
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <Button
                          onClick={() => handleApprove(excuse._id)}
                          className="flex-1"
                          disabled={reviewingId === excuse._id}
                        >
                          <FaCheck /> {reviewingId === excuse._id ? "Approving…" : "Approve"}
                        </Button>
                        <Button
                          onClick={() => handleReject(excuse._id)}
                          variant="danger"
                          className="flex-1"
                          disabled={reviewingId === excuse._id}
                        >
                          <FaTimes /> Reject
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {filter !== "pending" && (
                <div className="mt-4 flex justify-end border-t border-line pt-4">
                  <Button
                    onClick={() => confirmDeleteOne(excuse._id)}
                    variant="ghost"
                    size="sm"
                    className="text-danger hover:bg-danger/10"
                  >
                    <FaTrash /> Delete
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {pendingDelete && (
        <ConfirmDialog
          open
          title={
            pendingDelete.type === "all"
              ? "Delete all reviewed excuses?"
              : "Delete this excuse letter?"
          }
          message={
            pendingDelete.type === "all"
              ? `This will permanently delete all ${reviewedExcuseCount} reviewed excuse letters. This cannot be undone.`
              : "This will permanently delete this reviewed excuse letter. This cannot be undone."
          }
          confirmLabel="Delete"
          variant="danger"
          icon={<FaTrash />}
          onConfirm={doDelete}
          onCancel={() => setPendingDelete(null)}
          busy={deleting}
        />
      )}
    </div>
  );
};

export default ManageExcuses;

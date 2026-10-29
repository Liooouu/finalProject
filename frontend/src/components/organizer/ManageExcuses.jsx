import React, { useState, useEffect, useCallback } from "react";
import "../../styles/excuse-workspace.css";
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
import { useOrganizerPeriod } from "../../utils/useOrganizerPeriod";
import { recordsForAcademicPeriod } from "../../utils/academicPeriods";
import AcademicPeriodFilter from "./AcademicPeriodFilter";
import Pagination from "../ui/Pagination";
import { formatDate, formatDateTime } from "../../utils/helpers";
import { getUserRole } from "../../utils/auth";
import { readScreen, writeScreen } from "../../utils/queryCache";

const formatSubmissionTime = value => formatDateTime(value, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });

const API_BASE = api.defaults.baseURL.replace(/\/api$/, "");

const ManageExcuses = () => {
  const role = getUserRole();
  const isAdmin = role === "admin";
  const cacheKey = `excuses:${role}`;
  const seed = readScreen(cacheKey);
  const [excuses, setExcuses] = useState(seed?.excuses ?? []);
  const periodSelection = useOrganizerPeriod();
  const [page, setPage] = useState(1);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(seed === undefined);
  const [filter, setFilter] = useState("pending");
  const [selectedExcuse, setSelectedExcuse] = useState(null);
  const [responseNote, setResponseNote] = useState("");
  const [responseNotes, setResponseNotes] = useState({});
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
    const previous = readScreen(cacheKey);
    if (!silent && previous === undefined) setLoading(true);
    try {
      const res = await api.get("/organizer/excuses");
      setExcuses(res.data);
      setLoadError(false);
      writeScreen(cacheKey, { excuses: res.data });
    } catch {
      setLoadError(true);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [cacheKey]);

  useEffect(() => {
    fetchExcuses();
  }, [fetchExcuses]);

  useAutoRefresh(fetchExcuses, { interval: 30000 });

  const periodExcuses = recordsForAcademicPeriod(excuses, periodSelection.period, periodSelection.semester);
  const filteredExcuses = periodExcuses.filter((e) => e.status === filter);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filteredExcuses.length / 6)));
  const pageExcuses = filteredExcuses.slice((currentPage - 1) * 6, currentPage * 6);

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
        expectedVersion: (selectedExcuse?._id === id ? selectedExcuse : excuses.find(letter => letter._id === id))?.submissionVersion || 1,
        responseNote: isAdmin ? responseNote : responseNotes[id] || "",
        removal: "complete",
      });
      setExcuses((prev) => prev.map((e) => (e._id === id ? res.data : e)));
      showMessage(res.data.notificationWarning ? `Excuse approved. ${res.data.notificationWarning}` : "Excuse approved!", "success");
      setSelectedExcuse(null);
      setResponseNote("");
    } catch (err) {
      showMessage(err.response?.data?.error || "Failed to approve excuse", "error");
      if (err.response?.status === 409) { setSelectedExcuse(null); await fetchExcuses({ silent: true }); }
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
        expectedVersion: (selectedExcuse?._id === id ? selectedExcuse : excuses.find(letter => letter._id === id))?.submissionVersion || 1,
        responseNote: isAdmin ? responseNote : responseNotes[id] || "",
      });
      setExcuses((prev) => prev.map((e) => (e._id === id ? res.data : e)));
      showMessage(res.data.notificationWarning ? `Excuse rejected. ${res.data.notificationWarning}` : "Excuse rejected!", "success");
      setSelectedExcuse(null);
      setResponseNote("");
    } catch (err) {
      showMessage(err.response?.data?.error || "Failed to reject excuse", "error");
      if (err.response?.status === 409) { setSelectedExcuse(null); await fetchExcuses({ silent: true }); }
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
    pending: periodExcuses.filter((e) => e.status === "pending").length,
    approved: periodExcuses.filter((e) => e.status === "approved").length,
    rejected: periodExcuses.filter((e) => e.status === "rejected").length,
  };

  return (
    <div className="excuse-workspace">
      <PageHeader
        eyebrow={isAdmin ? "Institution review" : "Organizer review"}
        title="Excuse letters"
        subtitle={`${counts.pending} waiting for review · ${periodExcuses.filter(e => e.status !== "pending").length} reviewed in this period`}
        actions={
          reviewedExcuseCount > 0 && (
            <details className="text-xs text-on-muted"><summary className="cursor-pointer rounded-lg border border-line px-3 py-2 font-medium">More actions</summary><div className="mt-2"><Button onClick={confirmDeleteAll} variant="danger" size="sm"><FaTrash className="text-xs" /> Delete all reviewed ({reviewedExcuseCount})</Button></div></details>
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

      {loadError && <div role="alert" className="alert alert-danger">Excuse letters could not be refreshed. Please reload to try again.</div>}
      <div className="excuse-toolbar">
        <SegmentedControl
          ariaLabel="Filter excuses"
          value={filter}
          onChange={value => { setFilter(value); setPage(1); }}
          options={[
            { value: "pending", label: "Pending", count: counts.pending },
            { value: "approved", label: "Approved", count: counts.approved },
            { value: "rejected", label: "Rejected", count: counts.rejected },
          ]}
        />
        <div className="excuse-toolbar-tools">
          <details className="excuse-filter-menu"><summary>Filters{periodSelection.period ? " · Applied" : ""}</summary><div className="excuse-toolbar-popover"><AcademicPeriodFilter selection={periodSelection} /></div></details>
          <details className="excuse-policy-menu"><summary>Excuse policy</summary><p className="excuse-toolbar-popover">Only recorded absences with supporting attachments can be approved. Students must submit after the event ends and within 7 days; on-time letters can be reviewed later.</p></details>
        </div>
      </div>

      {filteredExcuses.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FaEdit />}
            title={`No ${filter} excuses`}
            description="Excuse letters submitted by students will appear here."
          />
        </Card>
      ) : (
        <div className="excuse-grid">
          {pageExcuses.map((excuse) => (
            <Card key={excuse._id} as="article" className="excuse-letter-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-inset ring-brand/20">
                    <FaUser />
                  </span>
                  <div className="min-w-0">
                    <h3 className="break-words font-display text-base font-semibold tracking-tight text-on">
                      {excuse.student?.name || "Unknown student"}
                    </h3>
                    <p className="break-all text-xs text-on-dim">{excuse.student?.email}</p>
                    <p className="mt-1 text-xs text-on-muted">Current class: {excuse.student?.program || "Unassigned"} · Year {excuse.student?.yearLevel || "–"} · {excuse.student?.section || "–"}{excuse.student?.enrollmentStatus === "graduated" ? " · Graduated" : ""}</p>
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
                    {excuse.type === "advance" ? "Legacy advance · reject only" : "Absence"}
                  </span>
                  <StatusBadge status={excuse.status} />
                  <span className="text-xs text-on-muted">
                    {formatDate(excuse.createdAt)}
                  </span>
                </div>
              </div>

              <div className="excuse-event-box mt-3">
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

              <p className="mt-3 text-xs text-on-muted">First submitted: {formatSubmissionTime(excuse.createdAt)}{(excuse.submissionVersion || 1) > 1 ? ` · Last resubmitted: ${formatSubmissionTime(excuse.lastSubmittedAt)} · Version ${excuse.submissionVersion}` : ""}{excuse.submissionDeadline ? ` · Submission deadline: ${formatDateTime(excuse.submissionDeadline)}` : ""}</p>
              {excuse.status === "pending" && excuse.approvalIssue && <div role="note" className="alert alert-warn mt-3">{excuse.approvalIssue}</div>}
              <div className="excuse-letter-text mt-3">
                <p className="text-xs font-medium text-on-muted">Excuse</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-on">{excuse.excuseText}</p>
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
                            className="excuse-attachment-preview rounded-lg object-cover ring-1 ring-line transition-all group-hover:ring-2 group-hover:ring-brand/50"
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
                <div className="excuse-review-controls">
                  {isAdmin && <Button
                    onClick={() =>
                      { setSelectedExcuse(selectedExcuse === excuse._id ? null : excuse._id); setResponseNote(""); }
                    }
                    variant={selectedExcuse === excuse._id ? "ghost" : "secondary"}
                    size="sm"
                  >
                    {selectedExcuse === excuse._id ? "Cancel review" : "Review excuse"}
                  </Button>}

                  {(!isAdmin || selectedExcuse === excuse._id) && (
                    <div className="excuse-review-fields">
                      <details><summary className="cursor-pointer text-xs text-on-muted">Add a response note (optional)</summary>
                        <textarea aria-label={`Response note for ${excuse.student?.name || "student"}`} value={isAdmin ? responseNote : responseNotes[excuse._id] || ""} onChange={e => isAdmin ? setResponseNote(e.target.value) : setResponseNotes(notes => ({ ...notes, [excuse._id]: e.target.value }))} rows={2} className="field mt-2" />
                      </details>
                      {excuse.type === "absence" && (
                        <p className="rounded-lg border border-line bg-card-alt/50 px-3.5 py-2 text-xs text-on-muted">
                          Approval clears this event’s remaining penalty only.
                        </p>
                      )}
                      <div className="excuse-decision-buttons">
                        <Button
                          onClick={() => handleApprove(excuse._id)}
                          className="flex-1"
                          disabled={reviewingId === excuse._id || !!excuse.approvalIssue || excuse.type === "advance" || !(excuse.attachments?.length || excuse.attachmentUrl)}
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

      <Pagination page={currentPage} pageSize={6} total={filteredExcuses.length} onChange={setPage} label="Excuse letter pages" />
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

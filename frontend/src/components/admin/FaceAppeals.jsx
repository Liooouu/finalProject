import React, { useCallback, useEffect, useRef, useState } from "react";
import { FaCheck, FaTimes, FaShieldAlt, FaTrashAlt } from "react-icons/fa";
import api from "../../api/axios";
import PrivateImage from "../shared/PrivateImage";
import EmptyState from "../shared/EmptyState";
import { Button, Card, StatusChip, TableSkeleton } from "../ui";
import ConfirmDialog from "../ui/ConfirmDialog";
import Pagination from "../ui/Pagination";
import StablePage from "../ui/StablePage";
import { formatDateTime } from "../../utils/helpers";
import { readScreen, writeScreen, clearScreens } from "../../utils/queryCache";
import { useTransientState } from "../../utils/useTransientState";
import { useAutoRefresh } from "../../utils/useAutoRefresh";

const APPEALS_CACHE_KEY = "admin:face-appeals";
export default function FaceAppeals() {
  const seed = readScreen(APPEALS_CACHE_KEY);
  const [appeals, setAppeals] = useState(seed?.appeals ?? []);
  const [appealsLoading, setAppealsLoading] = useState(seed === undefined);
  const [loadError, setLoadError] = useState("");
  const [appealPage, setAppealPage] = useState(1);
  const [selected, setSelected] = useState(new Set());
  const reviewInFlight = useRef(false);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [resultFailures, setResultFailures] = useState([]);
  const [reviewIdentityChecked, setReviewIdentityChecked] = useState(false);
  const [reviewingAppeal, setReviewingAppeal] = useState(false);
  const [message, setMessage] = useTransientState("");
  const [messageType, setMessageType] = useState("success");
  const isFaceLocked = user => !!user?.faceLockUntil && new Date(user.faceLockUntil) > new Date();
  const fetchAppeals = useCallback(async ({ silent = false } = {}) => {
    if (!silent && readScreen(APPEALS_CACHE_KEY) === undefined) setAppealsLoading(true);
    try {
      const { data } = await api.get("/admin/security/face-appeals");
      setAppeals(data);
      setAppealPage(previous => Math.min(previous, Math.max(1, Math.ceil(data.length / 6))));
      setSelected(previous => new Set([...previous].filter(id => data.some(row => row._id === id && row.enrollmentUpload && row.status === "pending"))));
      writeScreen(APPEALS_CACHE_KEY, { appeals: data });
      setLoadError("");
    } catch (error) {
      setLoadError(error.response?.data?.message || "Could not load face appeals. Please try again.");
    } finally { setAppealsLoading(false); }
  }, []);
  useEffect(() => { fetchAppeals(); }, [fetchAppeals]);
  useAutoRefresh(fetchAppeals, { interval: 30000, enabled: !reviewingAppeal });
  const pendingCount = appeals.filter(appeal => appeal.status === "pending").length;
  const currentAppealPage = Math.min(appealPage, Math.max(1, Math.ceil(appeals.length / 6)));
  const visibleAppeals = appeals.slice((currentAppealPage - 1) * 6, currentAppealPage * 6);
  const eligible = visibleAppeals.filter(row => row.enrollmentUpload && row.status === "pending");
  const allSelected = eligible.length > 0 && eligible.every(row => selected.has(row._id));
  const targets = reviewTarget?.appeals || (reviewTarget?.appeal ? [reviewTarget.appeal] : []);
  const needsIdentity = targets.some(row => row.enrollmentUpload || row.replacement);
  const requiresReason = targets.some(row => row.enrollmentUpload);
  const handleReview = async (rows, action) => {
    if (reviewInFlight.current || !rows.length) return;
    if (action === "approved" && needsIdentity && !reviewIdentityChecked) return;
    if (action === "rejected" && requiresReason && reviewNote.trim().length < 5) return;
    reviewInFlight.current = true; setReviewError(""); setResultFailures([]); setReviewingAppeal(true);
    const failures = []; const completed = new Set();
    try {
      for (const row of rows) {
        try {
          await api.post(`/admin/security/face-appeals/${row._id}/review`, { action, note: action === "rejected" ? reviewNote.trim() : "", identityChecked: reviewIdentityChecked });
          completed.add(row._id);
        } catch (err) { failures.push(`${row.student?.name || "Student"}: ${err.response?.data?.message || "Review failed. Refresh and retry."}`); }
      }
      setSelected(previous => new Set([...previous].filter(id => !completed.has(id))));
      clearScreens(); await fetchAppeals();
      setReviewTarget(null); setReviewNote(""); setReviewIdentityChecked(false);
      setMessage(`${completed.size} request${completed.size === 1 ? "" : "s"} ${action}.`);
      setResultFailures(failures);
      setMessageType(failures.length ? "error" : "success");
    } finally { reviewInFlight.current = false; setReviewingAppeal(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget || reviewInFlight.current) return;
    reviewInFlight.current = true; setReviewingAppeal(true); setDeleteError("");
    try {
      const { data } = await api.delete(`/admin/security/face-appeals/${deleteTarget._id}`);
      setAppeals(previous => previous.filter(row => row._id !== deleteTarget._id));
      setSelected(previous => { const next = new Set(previous); next.delete(deleteTarget._id); return next; });
      clearScreens(); await fetchAppeals();
      setDeleteTarget(null); setMessageType("success"); setMessage(data.message || "Face appeal deleted.");
    } catch (error) { setDeleteError(error.response?.data?.message || "Could not delete this appeal. Try again."); }
    finally { reviewInFlight.current = false; setReviewingAppeal(false); }
  };

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-on">Face appeals</h2><p className="text-sm text-on-dim">Review uploaded enrollment photos, replacements and face verification support.</p></div><Button variant="secondary" size="sm" onClick={() => fetchAppeals()} disabled={reviewingAppeal || appealsLoading}>Refresh</Button></div>
    {message && <div role="status" className={`alert ${messageType === "error" ? "alert-danger" : "alert-ok"}`}>{message}</div>}
    {resultFailures.length > 0 && <div role="alert" className="alert alert-danger"><div><p className="font-medium">Some requests need attention</p><ul className="mt-2 space-y-2">{resultFailures.map((failure, index) => <li key={index}>{failure}</li>)}</ul><Button size="sm" variant="ghost" onClick={() => setResultFailures([])}>Dismiss</Button></div></div>}
    {loadError && <div role="alert" className="alert alert-danger">{loadError}<Button variant="secondary" size="sm" onClick={() => fetchAppeals()}>Try again</Button></div>}
        <div className="space-y-4">
          <p className="text-sm text-on-dim">
            {pendingCount} pending · {appeals.length} total appeals
          </p>
          {eligible.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex min-h-11 items-center gap-2 text-sm text-on"><input type="checkbox" checked={allSelected} ref={node => { if (node) node.indeterminate = !allSelected && eligible.some(row => selected.has(row._id)); }} disabled={reviewingAppeal || appealsLoading || !!loadError} onChange={event => setSelected(event.target.checked ? new Set(eligible.map(row => row._id)) : new Set())} />Select all on this page</label>
            <div className="flex flex-wrap gap-2">{["approved", "rejected"].map(action => <Button key={action} size="sm" variant={action === "rejected" ? "danger" : "success"} disabled={reviewingAppeal || !eligible.some(row => selected.has(row._id)) || !!loadError} onClick={() => { setReviewNote(""); setReviewError(""); setReviewIdentityChecked(false); setReviewTarget({ appeals: eligible.filter(row => selected.has(row._id)), action }); }}>{action === "approved" ? "Approve selected" : "Reject selected"}</Button>)}</div>
          </div>}
          {appealsLoading ? (
            <Card>
              <TableSkeleton rows={4} />
            </Card>
          ) : appeals.length === 0 ? (
            <Card>
              <EmptyState
                icon={<FaShieldAlt />}
                title="No face verification appeals"
                description="Appeals submitted by students will appear here for review."
              />
            </Card>
          ) : (
            <StablePage pageKey="face-appeals" footer={<Pagination page={currentAppealPage} pageSize={6} total={appeals.length} onChange={value => { setAppealPage(value); setSelected(new Set()); }} disabled={reviewingAppeal} label="Face appeal pages" />}><div className="grid items-start gap-4 xl:grid-cols-2">
              {visibleAppeals.map((appeal) => (
                <Card key={appeal._id} as="article">
                  {appeal.enrollmentUpload && appeal.status === "pending" && <label className="mb-3 flex items-center gap-2 text-sm text-on-dim"><input type="checkbox" checked={selected.has(appeal._id)} disabled={reviewingAppeal} onChange={event => setSelected(previous => { const next = new Set(previous); if (event.target.checked) next.add(appeal._id); else next.delete(appeal._id); return next; })} />Select enrollment request</label>}
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-on">
                        {appeal.student?.name || "Unknown student"}
                      </p>
                      <p className="break-words text-sm text-on-dim">{appeal.student?.email}</p>
                      {appeal.enrollmentUpload && <p className="mt-1 text-xs text-brand">Uploaded face enrollment · Identity check required</p>}
                      {appeal.replacement && <p className="mt-1 text-xs text-brand">Face replacement · school ID check required</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {isFaceLocked(appeal.student) && (
                        <span className="rounded-full bg-danger/10 px-2.5 py-0.5 text-[11px] font-medium text-danger">
                          Face locked
                        </span>
                      )}
                      <StatusChip status={appeal.status} />
                    </div>
                  </div>

                  {appeal.note && (
                    <p className="mb-4 rounded-xl border border-line bg-card-alt/40 px-3.5 py-2.5 text-sm text-on-dim">
                      &quot;{appeal.note}&quot;
                    </p>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-on-muted">
                        Proof photo (submitted)
                      </p>
                      <PrivateImage
                        src={appeal.photoUrl}
                        alt="Proof"
                        className="aspect-[4/3] w-full rounded-xl border border-line object-contain bg-card-alt"
                      />
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-on-muted">
                        Enrolled face photo
                      </p>
                      {appeal.student?.facePhoto ? (
                        <PrivateImage
                          src={appeal.student.facePhoto}
                          alt="Enrolled face"
                          className="aspect-[4/3] w-full rounded-xl border border-line object-contain bg-card-alt"
                        />
                      ) : (
                        <div className="flex aspect-[4/3] w-full items-center justify-center rounded-xl border border-line bg-card-alt text-sm text-on-muted">
                          No face enrolled
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-on-muted">
                    Submitted {formatDateTime(appeal.createdAt)}
                  </p>

                  {appeal.status === "pending" && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          setReviewNote("");
                          setReviewError("");
                          setReviewIdentityChecked(false);
                          setReviewIdentityChecked(false); setReviewTarget({ appeal, action: "approved" });
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
                          setReviewError("");
                          setReviewIdentityChecked(false); setReviewTarget({ appeal, action: "rejected" });
                        }}
                      >
                        <FaTimes className="text-xs" /> Reject
                      </Button>
                    </div>
                  )}

                  {appeal.status !== "pending" && appeal.responseNote && (
                    <p className="mt-3 text-sm text-on-dim">
                      <span className="font-medium text-on">Admin note:</span>{" "}
                      {appeal.responseNote}
                    </p>
                  )}
                  <div className="mt-4 flex justify-end"><Button type="button" size="sm" variant="danger" disabled={reviewingAppeal} aria-label={`Delete face appeal for ${appeal.student?.name || "student"}`} onClick={() => { setDeleteError(""); setDeleteTarget(appeal); }}><FaTrashAlt aria-hidden="true" /> Delete</Button></div>
                </Card>
              ))}
            </div></StablePage>
          )}
        </div>
      <ConfirmDialog
        open={!!reviewTarget}
        title={
          reviewTarget?.action === "approved"
            ? `Approve ${targets.length} request${targets.length === 1 ? "" : "s"}?`
            : `Reject ${targets.length} request${targets.length === 1 ? "" : "s"}?`
        }
        message={
          reviewTarget?.action === "approved"
            ? targets.some(row => row.enrollmentUpload) ? "Verify each selected student before approval. Approved uploads become the active enrolled faces." : reviewTarget?.appeal?.replacement ? "Check the student's school ID and proof photo. Approval permits replacing the enrolled face with this same verified identity within seven days." : "Approving unlocks the student's face verification so they can retry immediately."
            : "Rejecting notifies the student that their appeal was declined. Add a reason below."
        }
        confirmLabel={reviewTarget?.action === "approved" ? "Approve" : "Reject"}
        cancelLabel="Cancel"
        variant={reviewTarget?.action === "approved" ? "default" : "danger"}
        busy={reviewingAppeal}
        confirmDisabled={reviewTarget?.action === "approved" ? needsIdentity && !reviewIdentityChecked : requiresReason && reviewNote.trim().length < 5}
        onConfirm={() =>
          reviewTarget && handleReview(targets, reviewTarget.action)
        }
        onCancel={() => {
          setReviewTarget(null);
          setReviewNote("");
        }}
      >
        {reviewError && <p role="alert" className="mt-3 text-sm text-danger">{reviewError}</p>}
        {reviewTarget?.action === "approved" && needsIdentity && <label className="mt-3 flex items-start gap-2 text-sm text-on-dim"><input type="checkbox" checked={reviewIdentityChecked} onChange={e=>setReviewIdentityChecked(e.target.checked)} /><span>I verified the identity of every selected student and confirmed that each photo belongs to them.</span></label>}
        {reviewTarget?.action === "rejected" && (
          <textarea
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            placeholder={requiresReason ? "Rejection reason (at least 5 characters)" : "Optional reason shown to the student"}
            maxLength={1000}
            rows={2}
            className="field mt-3"
          />
        )}
      </ConfirmDialog>
      <ConfirmDialog open={!!deleteTarget} title="Delete this face appeal?"
        message={`This removes the request from the review list. The student's active enrolled face and attendance will be kept.${deleteTarget?.status === "pending" ? " The student can submit a new request." : deleteTarget?.replacement ? " An unused replacement approval will be withdrawn." : ""}`}
        confirmLabel="Delete appeal" variant="danger" busy={reviewingAppeal} onConfirm={handleDelete} onCancel={() => { setDeleteTarget(null); setDeleteError(""); }}>
        <p className="mt-3 break-words text-sm text-on-dim">{deleteTarget?.student?.name} {deleteTarget?.student?.email && `(${deleteTarget.student.email})`}</p>
        {deleteError && <p role="alert" className="mt-3 text-sm text-danger">{deleteError}</p>}
      </ConfirmDialog>
  </div>;
}

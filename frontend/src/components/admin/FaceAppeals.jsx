import React, { useCallback, useEffect, useState } from "react";
import { FaCheck, FaTimes, FaShieldAlt } from "react-icons/fa";
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
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewError, setReviewError] = useState("");
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
      writeScreen(APPEALS_CACHE_KEY, { appeals: data });
      setLoadError("");
    } catch (error) {
      setLoadError(error.response?.data?.message || "Could not load face appeals. Please try again.");
    } finally { setAppealsLoading(false); }
  }, []);
  useEffect(() => { fetchAppeals(); }, [fetchAppeals]);
  useAutoRefresh(fetchAppeals, { interval: 30000, enabled: !reviewingAppeal });
  const pendingCount = appeals.filter(appeal => appeal.status === "pending").length;
  const currentAppealPage = Math.min(appealPage, Math.max(1, Math.ceil(appeals.length / 5)));
  const visibleAppeals = appeals.slice((currentAppealPage - 1) * 5, currentAppealPage * 5);
  const handleReview = async (appeal, action) => {
    if (reviewingAppeal) return;
    if (appeal.replacement && action === "approved" && !reviewIdentityChecked) return;
    setReviewError("");
    setReviewingAppeal(true);
    try {
      const res = await api.post(`/admin/security/face-appeals/${appeal._id}/review`, {
        action,
        note: action === "rejected" ? reviewNote : "",
        identityChecked: reviewIdentityChecked,
      });
      setAppeals((prev) => prev.map((a) => (a._id === appeal._id ? res.data.appeal : a)));
      setReviewTarget(null);
      setReviewNote("");
      setMessage(res.data.message || `Appeal ${action}`);
      setMessageType("success");
      clearScreens();
      writeScreen(APPEALS_CACHE_KEY, { appeals: appeals.map(item => item._id === appeal._id ? res.data.appeal : item) });
    } catch (err) {
      console.error(err);
      setReviewError(err.response?.data?.message || "Failed to review appeal. Please try again.");
    } finally {
      setReviewingAppeal(false);
    }
  };

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-on">Face appeals</h2><p className="text-sm text-on-dim">Verify identity before unlocking face verification or allowing a replacement.</p></div><Button variant="secondary" size="sm" onClick={() => fetchAppeals()} disabled={reviewingAppeal || appealsLoading}>Refresh</Button></div>
    {message && <div role="status" className={`alert ${messageType === "error" ? "alert-danger" : "alert-ok"}`}>{message}</div>}
    {loadError && <div role="alert" className="alert alert-danger">{loadError}<Button variant="secondary" size="sm" onClick={() => fetchAppeals()}>Try again</Button></div>}
        <div className="space-y-4">
          <p className="text-sm text-on-dim">
            {pendingCount} pending · {appeals.length} total appeals
          </p>
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
            <StablePage pageKey="face-appeals" footer={<Pagination page={currentAppealPage} pageSize={5} total={appeals.length} onChange={setAppealPage} label="Face appeal pages" />}><div className="space-y-3">
              {visibleAppeals.map((appeal) => (
                <Card key={appeal._id} as="article">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-on">
                        {appeal.student?.name || "Unknown student"}
                      </p>
                      <p className="truncate text-sm text-on-dim">{appeal.student?.email}</p>
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
                        className="aspect-[4/3] w-full rounded-xl border border-line object-cover"
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
                          className="aspect-[4/3] w-full rounded-xl border border-line object-cover"
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
                          setReviewTarget({ appeal, action: "approved" });
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
                          setReviewTarget({ appeal, action: "rejected" });
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
                </Card>
              ))}
            </div></StablePage>
          )}
        </div>
      <ConfirmDialog
        open={!!reviewTarget}
        title={
          reviewTarget?.action === "approved"
            ? "Approve this appeal?"
            : "Reject this appeal?"
        }
        message={
          reviewTarget?.action === "approved"
            ? reviewTarget?.appeal.replacement ? "Check the student's school ID and proof photo. Approval permits replacing the enrolled face with this same verified identity within seven days." : "Approving unlocks the student's face verification so they can retry immediately."
            : "Rejecting notifies the student that their appeal was declined. Add a reason below."
        }
        confirmLabel={reviewTarget?.action === "approved" ? "Approve" : "Reject"}
        cancelLabel="Cancel"
        variant={reviewTarget?.action === "approved" ? "default" : "danger"}
        busy={reviewingAppeal}
        confirmDisabled={reviewTarget?.action === "approved" && reviewTarget?.appeal.replacement && !reviewIdentityChecked}
        onConfirm={() =>
          reviewTarget && handleReview(reviewTarget.appeal, reviewTarget.action)
        }
        onCancel={() => {
          setReviewTarget(null);
          setReviewNote("");
        }}
      >
        {reviewError && <p role="alert" className="mt-3 text-sm text-danger">{reviewError}</p>}
        {reviewTarget?.action === "approved" && reviewTarget?.appeal.replacement && <label className="mt-3 flex items-start gap-2 text-sm text-on-dim"><input type="checkbox" checked={reviewIdentityChecked} onChange={e=>setReviewIdentityChecked(e.target.checked)} /><span>I checked the school ID and confirmed that the proof photo belongs to this student.</span></label>}
        {reviewTarget?.action === "rejected" && (
          <textarea
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            placeholder="Optional reason for rejection (shown to the student)..."
            rows={2}
            className="field mt-3"
          />
        )}
      </ConfirmDialog>
  </div>;
}

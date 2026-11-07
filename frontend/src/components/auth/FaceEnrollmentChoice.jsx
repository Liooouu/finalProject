import React, { useEffect, useRef, useState } from "react";
import { FaCamera, FaUpload } from "react-icons/fa";
import api from "../../api/axios";
import { Button, SegmentedControl, StatusChip } from "../ui";
import FaceCapture from "./FaceCapture";

// Only enrollment offers gallery upload. Attendance/ID captures remain live-only.
export default function FaceEnrollmentChoice({ onEnrolled, ...cameraProps }) {
  const [method, setMethod] = useState("camera");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [ownPhoto, setOwnPhoto] = useState(false);
  const inFlight = useRef(false);
  const inputId = React.useId();

  useEffect(() => {
    let active = true;
    api.get("/student/security/face-appeals").then(({ data }) => {
      if (active) setPending(data.find(row => row.enrollmentUpload && row.status === "pending") || null);
    }).catch(() => { if (active) setError("Could not check enrollment requests. Refresh before submitting."); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const checkStatus = async () => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      const { data } = await api.get("/student/security/face-appeals");
      const result = data.find(row => row._id === pending?._id);
      if (result?.status === "approved") { setPending(null); setNotice("Face enrolled. You can now use face attendance."); await onEnrolled?.(); }
      else if (result?.status === "rejected") { setPending(null); setNotice(`Photo rejected. ${result.responseNote || "Please submit a new photo."}`); }
      else { setPending(data.find(row => row.enrollmentUpload && row.status === "pending") || null); setNotice("Your request is still awaiting admin verification."); }
    } catch { setError("Could not check the request. Please try again."); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const submit = async () => {
    if (!file || !ownPhoto || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const body = new FormData(); body.append("photo", file); body.append("consent", "true");
      const { data } = await api.post("/account/face-enrollment-upload", body);
      setPending(data); setFile(null); setPreview("");
    } catch (err) { setError(err.response?.data?.error || "Could not submit the photo. Try again."); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return <div className="space-y-4">
    {error && <p role="alert" className="alert alert-danger">{error}</p>}
    {notice && <p role="status" className="text-sm text-on-dim">{notice}</p>}
    {checking ? <p role="status" className="text-sm text-on-muted">Checking enrollment requests…</p> : pending ? <div className="space-y-3 rounded-xl border border-line bg-card-alt/40 p-4"><StatusChip status="pending" /><h3 className="font-medium text-on">Pending verification</h3><p className="text-sm text-on-dim">An admin must verify your uploaded photo before it becomes your enrolled face. Your existing enrollment, if any, stays active.</p><div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="secondary" onClick={checkStatus} loading={busy}>Check status</Button>{cameraProps.onCancel && <Button type="button" size="sm" variant="ghost" onClick={cameraProps.onCancel} disabled={busy}>Back</Button>}</div></div> : <>
      <SegmentedControl ariaLabel="Enrollment photo method" value={method} onChange={value => { if (!busy && !cameraProps.loading) { setMethod(value); setError(""); } }} options={[{ value: "camera", label: "Use camera", icon: <FaCamera /> }, { value: "upload", label: "Upload photo", icon: <FaUpload /> }]} />
      {method === "camera" ? <FaceCapture {...cameraProps} /> : <div className="space-y-4">
        <p className="text-sm text-on-dim">Camera unavailable? Upload a recent photo of your own face: one face, looking straight ahead, good lighting, no filters.</p>
        <div className="grid items-start gap-4 sm:grid-cols-[9rem_minmax(0,1fr)]">
          {file && preview && <img src={preview} alt="Selected face photo preview" className="mx-auto max-h-48 w-full max-w-36 rounded-xl border border-line object-contain" />}
          <div><label className="field-label" htmlFor={inputId}>Choose photo · JPG or PNG · Maximum 4 MB</label><input id={inputId} type="file" accept="image/jpeg,image/png" className="field w-full text-sm" disabled={busy} onChange={event => {
            const next = event.target.files?.[0]; setError(""); setFile(null); setPreview(""); setOwnPhoto(false);
            if (!next) return;
            if (!["image/jpeg", "image/png"].includes(next.type) || next.size > 4 * 1024 * 1024) { setError("Choose a JPG or PNG photo no larger than 4 MB."); event.target.value = ""; return; }
            setFile(next);
          }} /><p className="mt-3 text-xs text-on-muted">Your uploaded photo stays private and requires admin approval. Submitting does not activate face attendance.</p></div>
        </div>
        <label className="flex items-start gap-2 text-sm text-on-dim"><input type="checkbox" className="mt-1 shrink-0" checked={ownPhoto} disabled={busy} onChange={event => setOwnPhoto(event.target.checked)} /><span>This is my own photo. I consent to its use for face enrollment and admin identity review.</span></label>
        <div className="flex flex-wrap justify-end gap-2">{cameraProps.onCancel && <Button type="button" variant="secondary" onClick={cameraProps.onCancel} disabled={busy}>Cancel</Button>}<Button type="button" onClick={submit} loading={busy} disabled={!file || !ownPhoto || checking}>Submit for verification</Button></div>
      </div>}
    </>}
  </div>;
}

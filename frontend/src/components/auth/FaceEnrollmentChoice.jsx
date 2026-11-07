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
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const inFlight = useRef(false);
  const fileInput = useRef(null);
  const inputId = React.useId();

  useEffect(() => {
    let active = true;
    api.get("/account/face-enrollment-requests").then(({ data }) => {
      if (!Array.isArray(data)) throw new Error("Invalid enrollment response");
      if (active) { setPending(data.find(row => row.status === "pending") || null); setLoadError(""); }
    }).catch(() => { if (active) setLoadError("Could not check upload status. Try again before uploading."); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [retry]);
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
      const { data } = await api.get("/account/face-enrollment-requests");
      if (!Array.isArray(data)) throw new Error("Invalid enrollment response");
      const result = data.find(row => row._id === pending?._id);
      if (result?.status === "approved") { setPending(null); setNotice("Face enrolled. You can now use face attendance."); await onEnrolled?.(); }
      else if (!result || result.status === "deleted") { setPending(null); setNotice("This upload request was removed. You can choose and submit a new photo."); }
      else if (result?.status === "rejected") { setPending(null); setNotice(`Photo rejected. ${result.responseNote || "Please submit a new photo."}`); }
      else { setPending(data.find(row => row.enrollmentUpload && row.status === "pending") || null); setNotice("Your request is still awaiting admin verification."); }
    } catch { setError("Could not check the request. Please try again."); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const submit = async () => {
    if (!file || !ownPhoto || loadError || checking || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const body = new FormData(); body.append("photo", file); body.append("consent", "true");
      const { data } = await api.post("/account/face-enrollment-upload", body);
      setPending(data); setFile(null); setPreview("");
    } catch (err) { setError(err.response?.data?.error || "Could not submit the photo. Try again."); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const cancelUpload = () => {
    setFile(null); setPreview(""); setOwnPhoto(false); setError(""); setNotice("");
    if (fileInput.current) fileInput.current.value = "";
  };
  return <div className="min-w-0 space-y-4">
    {loadError && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warn/30 bg-warn/10 p-3 text-sm text-on-dim"><p className="min-w-0 flex-1">{loadError}</p><Button type="button" size="sm" variant="secondary" disabled={checking} onClick={() => { setChecking(true); setRetry(value => value + 1); }}>Try again</Button></div>}
    {error && <p role="alert" className="alert alert-danger">{error}</p>}
    {notice && <p role="status" className="text-sm text-on-dim">{notice}</p>}
    {checking ? <p role="status" className="text-sm text-on-muted">Checking enrollment requests…</p> : pending ? <div className="space-y-3 rounded-xl border border-line bg-card-alt/40 p-4"><StatusChip status="pending" /><h3 className="font-medium text-on">Pending verification</h3><p className="text-sm text-on-dim">An admin must verify your uploaded photo before it becomes your enrolled face. Your existing enrollment, if any, stays active.</p><div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="secondary" onClick={checkStatus} loading={busy}>Check status</Button>{cameraProps.onCancel && <Button type="button" size="sm" variant="ghost" onClick={cameraProps.onCancel} disabled={busy}>Back</Button>}</div></div> : <>
      <SegmentedControl ariaLabel="Enrollment photo method" value={method} onChange={value => { if (!busy && !cameraProps.loading) { setMethod(value); setError(""); } }} options={[{ value: "camera", label: "Use camera", icon: <FaCamera /> }, { value: "upload", label: "Upload photo", icon: <FaUpload /> }]} />
      {method === "camera" ? <FaceCapture compact {...cameraProps} /> : <div className="min-w-0 space-y-4">
        <p className="text-sm text-on-dim">Use a clear, recent photo of your own face. Look straight ahead, with good lighting and no filters.</p>
        <div className={`grid min-w-0 items-center gap-4 rounded-xl border border-line bg-card-alt/30 p-4 ${file ? "sm:grid-cols-[8rem_minmax(0,1fr)]" : "grid-cols-1"}`}>
          {file && preview && <img src={preview} alt="Selected face photo preview" className="mx-auto max-h-44 w-full max-w-32 rounded-xl object-contain" />}
          <div className="min-w-0 space-y-3"><div><p className="text-sm font-medium text-on">{file ? "Selected photo" : "Choose your face photo"}</p><p className="mt-1 text-xs text-on-muted [overflow-wrap:anywhere]">{file ? file.name : "JPG or PNG · Maximum 4 MB"}</p></div><input ref={fileInput} id={inputId} type="file" accept="image/jpeg,image/png" className="hidden" disabled={busy} onChange={event => {
            const next = event.target.files?.[0];
            if (!next) return;
            setError(""); setFile(null); setPreview(""); setOwnPhoto(false);
            if (!["image/jpeg", "image/png"].includes(next.type) || next.size > 4 * 1024 * 1024) { setError("Choose a JPG or PNG photo no larger than 4 MB."); event.target.value = ""; return; }
            setFile(next);
          }} /><div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="secondary" aria-controls={inputId} disabled={busy} onClick={() => fileInput.current?.click()}><FaUpload aria-hidden="true" />{file ? "Change photo" : "Choose photo"}</Button>{file && <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={cancelUpload}>Cancel upload</Button>}</div></div>
        </div>
        <p className="text-xs text-on-muted">An admin will verify your uploaded photo before it becomes your enrolled face.</p>
        <label className="flex items-start gap-2 text-sm text-on-dim"><input type="checkbox" className="mt-1 shrink-0" checked={ownPhoto} disabled={busy} onChange={event => setOwnPhoto(event.target.checked)} /><span>This is my own photo. I consent to its use for face enrollment and admin identity review.</span></label>
        <div className="flex flex-col-reverse justify-end gap-2 min-[420px]:flex-row">{cameraProps.onCancel && <Button type="button" variant="secondary" onClick={cameraProps.onCancel} disabled={busy}>Back</Button>}<Button type="button" onClick={submit} loading={busy} disabled={!file || !ownPhoto || checking || !!loadError}>Submit for verification</Button></div>
      </div>}
    </>}
  </div>;
}

import React, { useState, useEffect } from "react";
import api from "../../api/axios";
import {
  FaShieldAlt,
  FaLaptop,
  FaKey,
  FaExclamationTriangle,
  FaCheck,
  FaEye,
  FaEyeSlash,
  FaCameraRetro,
  FaHeadset,
} from "react-icons/fa";
import { usePageMeta } from "../../context/PageMetaContext";
import { Button, FlightPanel, PageHeader, StatusChip } from "../ui";
import ConfirmDialog from "../ui/ConfirmDialog";
import Loading from "../shared/Loading";
import FaceCapture from "../auth/FaceCapture";
import PrivateImage from "../shared/PrivateImage";
import EmptyState from "../shared/EmptyState";
import { getDeviceId } from "../../utils/device";
import { formatDateTime } from "../../utils/helpers";

const SecuritySettings = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [rotating, setRotating] = useState(false);
  const [currentPin, setCurrentPin] = useState(null);
  const [showPin, setShowPin] = useState(false);
  const [facePhoto, setFacePhoto] = useState(null);
  const [enrollingFace, setEnrollingFace] = useState(false);
  const [faceUploading, setFaceUploading] = useState(false);
  const [appeals, setAppeals] = useState([]);
  const [showAppealForm, setShowAppealForm] = useState(false);
  const [appealNote, setAppealNote] = useState("");
  const [appealSubmitting, setAppealSubmitting] = useState(false);

  usePageMeta("Security", "Manage your trusted devices and security PIN.");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [devRes, appealsRes] = await Promise.all([
          api.get("/auth/devices"),
          api.get("/student/security/face-appeals"),
        ]);
        if (active) {
          setDevices(devRes.data.devices || []);
          setCurrentPin(devRes.data.pin || null);
          setFacePhoto(devRes.data.facePhoto || null);
          setAppeals(appealsRes.data || []);
        }
      } catch (err) {
        if (active) {
          setMessage(err.response?.data?.message || "Failed to load security settings");
          setMessageType("error");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const submitAppeal = async (blob) => {
    setAppealSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("photo", blob, "proof.jpg");
      fd.append("note", appealNote.trim());
      const res = await api.post("/student/security/face-appeals", fd);
      setAppeals([res.data, ...appeals]);
      setShowAppealForm(false);
      setAppealNote("");
      showMessage("Appeal submitted. An admin will review your proof photo.");
    } catch (err) {
      console.error(err);
      showMessage(
        err.response?.data?.error || err.response?.data?.message || "Failed to submit appeal",
        "error"
      );
    } finally {
      setAppealSubmitting(false);
    }
  };

  const showMessage = (text, type = "success") => {
    setMessage(text);
    setMessageType(type);
  };

  const revokeDevice = async (deviceId) => {
    try {
      const res = await api.delete(`/auth/devices/${deviceId}`);
      setDevices(res.data.devices || []);
      showMessage("Device removed. It will need your security PIN again.");
    } catch (err) {
      console.error(err);
      showMessage(err.response?.data?.message || "Failed to remove device", "error");
    }
  };

  const rotatePin = async () => {
    setRotating(true);
    try {
      const res = await api.post("/auth/rotate-pin");
      setCurrentPin(res.data.pin);
      setShowPin(true);
      showMessage(res.data.message || "Your security PIN has changed.");
    } catch (err) {
      console.error(err);
      showMessage(err.response?.data?.message || "Failed to rotate PIN", "error");
    } finally {
      setRotating(false);
    }
  };

  const handleFaceUpload = async (blob) => {
    setFaceUploading(true);
    try {
      const fd = new FormData();
      fd.append("face", blob, "face.jpg");
      const res = await api.post("/account/face", fd);
      setFacePhoto(res.data.facePhoto);
      setEnrollingFace(false);
      showMessage("Face photo saved. You can now recover your PIN with a face scan.");
    } catch (err) {
      console.error(err);
      showMessage(
        err.response?.data?.error || err.response?.data?.message || "Failed to save face photo",
        "error"
      );
    } finally {
      setFaceUploading(false);
    }
  };

  const formatDate = (d) =>
    d ? formatDateTime(d, { dateStyle: "medium", timeStyle: "short" }) : "—";

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        eyebrow="Account"
        title="Security"
        subtitle="Your security PIN, trusted devices, and face verification."
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

      <FlightPanel
        level="ledger"
        glass
        eyebrow="Security"
        title="Security PIN"
        subtitle="Your 6-digit PIN is required on a new browser or computer."
        icon={<FaKey />}
        actions={
          <Button onClick={rotatePin} loading={rotating} size="sm" className="shrink-0">
            {rotating ? "Generating..." : "Rotate my PIN"}
          </Button>
        }
      >
        <div className="max-w-2xl space-y-2">
          <p className="text-sm leading-relaxed text-on-dim">
            TrackED assigns you a random 6-digit PIN. You'll need it the first time you sign in
            from a{" "}
            <span className="font-medium text-on">new browser or computer</span>. Every successful
            verification creates a new PIN.
          </p>
          <p className="text-sm leading-relaxed text-on-dim">
            Forgot your PIN? Rotate it here and save the new one. If you've lost every device, ask
            an admin to reset your security.
          </p>
        </div>

        {currentPin && (
          <div className="mt-4 rounded-xl border border-dashed border-brand/40 bg-brand/5 px-4 py-5">
            <p className="flex items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">
              <FaCheck /> Your current security PIN
            </p>
            <div className="mt-2 flex items-center justify-center gap-3">
              <p className="num text-center text-2xl font-bold tracking-[0.45em] text-on sm:text-3xl">
                {showPin ? currentPin : "••••••"}
              </p>
              <Button
                type="button"
                onClick={() => setShowPin((v) => !v)}
                variant="ghost"
                size="icon"
                aria-label={showPin ? "Hide PIN" : "Show PIN"}
              >
                {showPin ? <FaEyeSlash /> : <FaEye />}
              </Button>
            </div>
            <p className="mt-1 text-center text-xs text-on-dim">
              You'll need this PIN the next time you sign in from a new device.
            </p>
          </div>
        )}
      </FlightPanel>

      <FlightPanel
        level="ledger"
        glass
        eyebrow="Devices"
        title="Trusted devices"
        subtitle={`${devices.length} device${devices.length === 1 ? "" : "s"} recognized`}
        icon={<FaShieldAlt />}
      >
        {loading ? (
          <Loading />
        ) : devices.length === 0 ? (
          <EmptyState
            compact
            icon={<FaLaptop />}
            title="No trusted devices yet"
            description="Signing in from a new browser will ask for your PIN."
          />
        ) : (
          <div className="space-y-2">
            {devices.map((device) => {
              const isThis = device.deviceId === getDeviceId();
              return (
                <div
                  key={device.deviceId}
                  className="flex flex-col gap-3 rounded-xl border border-line bg-card-alt/40 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-info/10 text-info ring-1 ring-inset ring-info/20">
                      <FaLaptop />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-on">
                        {device.label || "Unknown device"}
                        {isThis && (
                          <span className="ml-2 rounded-full bg-ok/10 px-2 py-0.5 text-[10px] font-medium text-ok">
                            This device
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-on-dim">
                        Verified {formatDate(device.verifiedAt)} · Last used{" "}
                        {formatDate(device.lastUsedAt)}
                      </p>
                    </div>
                  </div>
                  {!isThis && (
                    <Button
                      onClick={() => setRevokeTarget(device)}
                      variant="danger"
                      size="sm"
                      className="shrink-0 self-start sm:self-center"
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </FlightPanel>

      <FlightPanel
        level="instrument"
        glass
        eyebrow="Biometrics"
        title="Face verification"
        subtitle={
          facePhoto
            ? "If you forget your security PIN, you can recover it with a quick face scan."
            : "Enroll a face photo now so you can recover your security PIN with a face scan if you ever forget it."
        }
        icon={<FaCameraRetro />}
        actions={
          <Button
            onClick={() => setEnrollingFace(true)}
            disabled={faceUploading}
            size="sm"
            className="shrink-0"
          >
            {facePhoto ? "Update face photo" : "Add face photo"}
          </Button>
        }
      >
        {facePhoto && (
          <div className="mb-4 flex items-center gap-3">
            <PrivateImage
              src={facePhoto}
              alt="Enrolled face"
              className="h-16 w-16 rounded-xl border border-line object-cover"
            />
            <p className="text-sm text-on-dim">Enrolled face photo</p>
          </div>
        )}

        {enrollingFace && (
          <div className="mt-4 rounded-xl border border-line bg-card-alt/40 p-4">
            <FaceCapture
              title="Save my face"
              onCapture={handleFaceUpload}
              onCancel={() => setEnrollingFace(false)}
              loading={faceUploading}
            />
          </div>
        )}
      </FlightPanel>

      <FlightPanel
        level="ledger"
        glass
        tone="warn"
        eyebrow="Support"
        title="Face verification not working?"
        subtitle="Submit a proof photo and an admin will compare it to your enrolled face photo."
        icon={<FaHeadset />}
      >
        {appeals.length > 0 && (
          <div className="mt-4 space-y-2">
            {appeals.map((appeal) => (
              <div
                key={appeal._id}
                className="flex flex-col gap-2 rounded-xl border border-line bg-card-alt/40 p-3.5 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-on">Appeal</p>
                    <StatusChip status={appeal.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-on-muted">
                    Submitted {formatDateTime(appeal.createdAt)}
                  </p>
                  {appeal.responseNote && (
                    <p className="mt-1 text-xs text-on-dim">
                      Admin note: {appeal.responseNote}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {showAppealForm ? (
          <div className="mt-4 rounded-xl border border-line bg-card-alt/40 p-4">
            <FaceCapture
              title="Take proof photo"
              onCapture={submitAppeal}
              onCancel={() => setShowAppealForm(false)}
              loading={appealSubmitting}
            />
            <textarea
              value={appealNote}
              onChange={(e) => setAppealNote(e.target.value)}
              placeholder="Optional note for the admin (e.g. camera kept failing, lighting too dark)..."
              rows={2}
              className="field mt-3"
            />
          </div>
        ) : (
          <Button
            onClick={() => setShowAppealForm(true)}
            disabled={appealSubmitting}
            variant="secondary"
            size="sm"
            className="mt-4"
          >
            Submit an appeal
          </Button>
        )}
      </FlightPanel>

      <div className="flex items-start gap-2.5 rounded-xl border border-line bg-card p-4 text-sm text-on-dim">
        <FaExclamationTriangle className="mt-0.5 shrink-0 text-warn" />
        <p>
          Don&apos;t share your PIN. Because it rotates after every new-device sign-in, someone
          using only your login credentials still can&apos;t get in.
        </p>
      </div>

      <ConfirmDialog
        open={!!revokeTarget}
        title="Revoke this device?"
        message={
          revokeTarget
            ? `"${revokeTarget.label || "This device"}" will need your security PIN again the next time it signs in.`
            : ""
        }
        confirmLabel="Revoke"
        cancelLabel="Cancel"
        onConfirm={() => {
          const target = revokeTarget;
          setRevokeTarget(null);
          revokeDevice(target.deviceId);
        }}
        onCancel={() => setRevokeTarget(null)}
      />
    </div>
  );
};

export default SecuritySettings;

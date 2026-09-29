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
import { BaseCard } from "../ui";
import Button from "../ui/Button";
import ConfirmDialog from "../ui/ConfirmDialog";
import Loading from "../shared/Loading";
import FaceCapture from "../auth/FaceCapture";
import { getDeviceId } from "../../utils/device";

const API_BASE = api.defaults.baseURL.replace(/\/api$/, "");

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
    d ? new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

  return (
    <div className="space-y-6">
      {message && (
        <div
          role="status"
          className={`rounded-lg border px-3.5 py-2.5 text-sm ${
            messageType === "error"
              ? "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          }`}
        >
          {message}
        </div>
      )}

      <BaseCard
        icon={<FaKey />}
        title="Security PIN"
        bodyClassName="space-y-4"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-lg">
            <p className="text-sm text-on-dim">
              TrackED assigns you a random 6-digit security PIN. You'll need it the first time you
              sign in from a <span className="font-semibold text-on">new browser or computer</span>.
              Every successful verification creates a <span className="font-semibold text-on">new PIN</span>.
            </p>
            <p className="mt-2 text-sm text-on-dim">
              Forgot your PIN? Rotate it here and save the new one. If you've lost every device, ask
              an admin to reset your security.
            </p>
          </div>
          <Button onClick={rotatePin} disabled={rotating} className="shrink-0">
            {rotating ? "Generating..." : "Rotate my PIN"}
          </Button>
        </div>

        {currentPin && (
          <div className="animate-fade-up rounded-xl border border-dashed border-indigo-400/50 bg-indigo-500/5 px-4 py-5">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              <FaCheck /> Your current security PIN
            </p>
            <div className="mt-2 flex items-center justify-center gap-3">
              <p className="text-center text-2xl font-bold tracking-[0.45em] text-on sm:text-3xl">
                {showPin ? currentPin : "••••••"}
              </p>
              <button
                type="button"
                onClick={() => setShowPin((v) => !v)}
                aria-label={showPin ? "Hide PIN" : "Show PIN"}
                className="text-on-dim transition-colors hover:text-on"
              >
                {showPin ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            <p className="mt-2 text-center text-xs text-on-dim">
              You'll need this PIN the next time you sign in from a new device.
            </p>
          </div>
        )}
      </BaseCard>

      <BaseCard
        icon={<FaShieldAlt />}
        title={`Trusted Devices (${devices.length})`}
        bodyClassName="space-y-2"
      >
        {loading ? (
          <Loading />
        ) : devices.length === 0 ? (
          <p className="py-8 text-center text-sm text-on-dim">
            No trusted devices yet. This browser was registered on your account.
          </p>
        ) : (
          devices.map((device) => {
            const isThis = device.deviceId === getDeviceId();
            return (
              <div
                key={device.deviceId}
                className="flex flex-col gap-3 rounded-lg border border-line bg-card-alt/60 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 ring-1 ring-inset ring-indigo-500/20 dark:text-indigo-400">
                    <FaLaptop />
                  </span>
                  <div>
                    <p className="font-medium text-on">
                      {device.label || "Unknown device"}
                      {isThis && (
                        <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          This device
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-on-dim">
                      Verified {formatDate(device.verifiedAt)} · Last used {formatDate(device.lastUsedAt)}
                    </p>
                  </div>
                </div>
                {!isThis && (
                  <button
                    onClick={() => setRevokeTarget(device)}
                    className="shrink-0 self-start rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/20 dark:text-red-400 sm:self-center"
                  >
                    Revoke
                  </button>
                )}
              </div>
            );
          })
        )}
      </BaseCard>

      <BaseCard
        icon={<FaCameraRetro />}
        title="Face verification"
        bodyClassName="space-y-4"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {facePhoto ? (
              <img
                src={`${API_BASE}${facePhoto}`}
                alt="Enrolled face"
                className="h-16 w-16 rounded-xl border border-line object-cover"
              />
            ) : (
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500 ring-1 ring-inset ring-indigo-500/20">
                <FaCameraRetro />
              </span>
            )}
            <div>
              <p className="font-medium text-on">
                {facePhoto ? "Face photo enrolled" : "No face photo yet"}
              </p>
              <p className="mt-0.5 max-w-sm text-sm text-on-dim">
                {facePhoto
                  ? "If you forget your security PIN, you can recover it with a quick face scan."
                  : "Enroll a face photo now so you can recover your security PIN with a face scan if you ever forget it."}
              </p>
            </div>
          </div>
          <Button onClick={() => setEnrollingFace(true)} disabled={faceUploading} className="shrink-0">
            {facePhoto ? "Update face photo" : "Add face photo"}
          </Button>
        </div>

        {enrollingFace && (
          <div className="rounded-xl border border-line bg-card-alt/50 p-4">
            <FaceCapture
              title="Save my face"
              onCapture={handleFaceUpload}
              onCancel={() => setEnrollingFace(false)}
              loading={faceUploading}
            />
          </div>
        )}
      </BaseCard>

      <BaseCard
        icon={<FaHeadset />}
        title="Face verification not working?"
        bodyClassName="space-y-4"
      >
        <p className="text-sm text-on-dim">
          Camera refusing to recognize you? Submit a proof photo and an admin will compare it to
          your enrolled face photo, then unlock your face verification.
        </p>

        {appeals.length > 0 && (
          <div className="space-y-2">
            {appeals.map((appeal) => (
              <div
                key={appeal._id}
                className="flex flex-col gap-2 rounded-lg border border-line bg-card-alt/50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium text-on">
                    Appeal {(appeal.status).charAt(0).toUpperCase() + appeal.status.slice(1)}
                  </p>
                  <p className="text-xs text-on-muted">
                    Submitted {new Date(appeal.createdAt).toLocaleString()}
                  </p>
                  {appeal.responseNote && (
                    <p className="mt-0.5 text-xs text-on-dim">
                      Admin note: {appeal.responseNote}
                    </p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    appeal.status === "approved"
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : appeal.status === "rejected"
                        ? "bg-red-500/15 text-red-600 dark:text-red-400"
                        : "bg-gray-500/15 text-gray-600 dark:text-gray-400"
                  }`}
                >
                  {appeal.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {showAppealForm ? (
          <div className="rounded-xl border border-line bg-card-alt/50 p-4">
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
              className="mt-3 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-on focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>
        ) : (
          <Button onClick={() => setShowAppealForm(true)} disabled={appealSubmitting}>
            Submit an appeal
          </Button>
        )}
      </BaseCard>

      <div className="flex items-start gap-2.5 rounded-xl border border-line bg-card p-4 text-sm text-on-dim">
        <FaExclamationTriangle className="mt-0.5 shrink-0 text-amber-500" />
        <p>
          Don&apos;t share your PIN. Because it rotates after every new device, a friend using your
          login credentials gets locked out the moment your PIN changes.
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
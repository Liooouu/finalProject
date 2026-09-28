import React, { useState, useEffect } from "react";
import api from "../../api/axios";
import {
  FaShieldAlt,
  FaLaptop,
  FaKey,
  FaExclamationTriangle,
  FaCheck,
} from "react-icons/fa";
import { usePageMeta } from "../../context/PageMetaContext";
import { BaseCard } from "../ui";
import Button from "../ui/Button";
import ConfirmDialog from "../ui/ConfirmDialog";
import Loading from "../shared/Loading";
import { getDeviceId } from "../../utils/device";

const SecuritySettings = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [rotating, setRotating] = useState(false);
  const [newPin, setNewPin] = useState(null);

  usePageMeta("Security", "Manage your trusted devices and security PIN.");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await api.get("/auth/devices");
        if (active) setDevices(res.data || []);
      } catch (err) {
        if (active) {
          setMessage(err.response?.data?.message || "Failed to load devices");
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
    setNewPin(null);
    try {
      const res = await api.post("/auth/rotate-pin");
      setNewPin(res.data.pin);
      showMessage(res.data.message || "Your security PIN has changed.");
    } catch (err) {
      console.error(err);
      showMessage(err.response?.data?.message || "Failed to rotate PIN", "error");
    } finally {
      setRotating(false);
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

        {newPin && (
          <div className="animate-fade-up rounded-xl border border-dashed border-indigo-400/50 bg-indigo-500/5 px-4 py-5">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              <FaCheck /> Your new security PIN
            </p>
            <p className="mt-2 text-center text-2xl font-bold tracking-[0.45em] text-on sm:text-3xl">
              {newPin}
            </p>
            <p className="mt-2 text-center text-xs text-on-dim">
              Save this now — the old PIN no longer works.
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
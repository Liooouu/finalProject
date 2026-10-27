import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import * as faceapi from "@vladmandic/face-api";
import {
  FaCheck,
  FaCamera,
  FaExpand,
  FaExclamationTriangle,
  FaRedo,
  FaUserCheck,
  FaClock,
} from "react-icons/fa";
import api from "../api/axios";
import { formatDateTime } from "../utils/helpers";
import TrackMark from "../components/shared/TrackMark";

// Same face-recognition models used for enrollment, served as static assets so the
// kiosk works on the venue's LAN without hitting the API for model files.
const MODEL_URL = `${import.meta.env.BASE_URL}models/face`;
const SCAN_INTERVAL_MS = 850;
const RESULT_HOLD_MS = 3400;

const STATE_LABEL = {
  before: "Not open yet",
  open: "Scanning",
  late: "Late check-in",
  closed: "Station closed",
  expired: "Station expired",
  unavailable: "No attendance window",
};

function statusWord(status) {
  return status === "late" ? "Late" : "Present";
}

const CheckInKiosk = () => {
  const { token } = useParams();

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const modelsRef = useRef(false);
  const busyRef = useRef(false);
  const holdUntilRef = useRef(0);
  const stateRef = useRef("before");
  const detectorRef = useRef(null);

  const [boot, setBoot] = useState("loading"); // loading | ready | error
  const [cameraError, setCameraError] = useState("");
  const [error, setError] = useState("");
  const [station, setStation] = useState(null);
  const [result, setResult] = useState(null);
  const [cameraNonce, setCameraNonce] = useState(0);

  // ── Station status ─────────────────────────────────────────────────────────
  const refreshStation = useCallback(async () => {
    try {
      const { data } = await api.get(`/checkin/${token}`);
      setStation(data);
      stateRef.current = data.state;
      setError("");
    } catch (err) {
      stateRef.current = "unavailable";
      if (err.response?.status === 404) {
        setError("This check-in station link is not valid. Ask the organizer for a new one.");
      } else {
        setError("Can't reach the attendance station. Retrying…");
      }
    }
  }, [token]);

  useEffect(() => {
    refreshStation();
    const timer = setInterval(refreshStation, 10000);
    return () => clearInterval(timer);
  }, [refreshStation]);

  // ── Models ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        try {
          await faceapi.tf.setBackend("webgl");
        } catch {
          await faceapi.tf.setBackend("cpu");
        }
        await faceapi.tf.ready();
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        if (cancelled) return;
        detectorRef.current = new faceapi.TinyFaceDetectorOptions({
          inputSize: 320,
          scoreThreshold: 0.5,
        });
        modelsRef.current = true;
        setBoot("ready");
      } catch (err) {
        console.error("Face models failed to load:", err);
        if (!cancelled) {
          setBoot("error");
          setError("The face scanner could not start on this device.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Camera ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const stream = { current: null };

    (async () => {
      try {
        setCameraError("");
        const media = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelled) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = media;
        streamRef.current = media;
        if (videoRef.current) {
          videoRef.current.srcObject = media;
          await videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        if (!cancelled) {
          setCameraError(
            "Camera unavailable. Allow camera access, or ask the organizer to mark attendance manually."
          );
          console.error("Kiosk camera error:", err);
        }
      }
    })();

    return () => {
      cancelled = true;
      const media = stream.current || streamRef.current;
      media?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [cameraNonce]);

  // ── Scan loop ──────────────────────────────────────────────────────────────
  const applyResult = useCallback(
    (data) => {
      holdUntilRef.current = Date.now() + RESULT_HOLD_MS;

      if (data?.ok && data.result === "marked") {
        setResult({
          kind: data.status === "late" ? "late" : "ok",
          name: data.student?.name || "Student",
          meta:
            data.status === "late"
              ? "Late — 4 community service hours recorded"
              : "Present",
          note: data.replacedExcuse ? "Your approved excuse was replaced." : "",
        });
        refreshStation();
        return;
      }

      if (data?.ok && data.result === "already") {
        setResult({
          kind: "info",
          name: data.student?.name || "Student",
          meta: `Already checked in — ${statusWord(data.status)}`,
        });
        return;
      }

      if (data?.result === "unknown" || data?.result === "not-enrolled") {
        setResult({
          kind: "warn",
          name: "Face not recognised",
          meta: "Please see the organizer to be marked manually.",
        });
        return;
      }

      if (data?.result === "ambiguous") {
        setResult({
          kind: "warn",
          name: "Could not confirm your face",
          meta: "Two faces are too similar. Please see the organizer.",
        });
        return;
      }

      if (data?.result === "no-enrollments") {
        setResult({
          kind: "warn",
          name: "No faces enrolled yet",
          meta: "Ask the organizer to mark attendance manually.",
        });
        return;
      }

      if (["before", "closed", "expired", "unavailable"].includes(data?.result)) {
        refreshStation();
        setResult({
          kind: "info",
          name: STATE_LABEL[data.result] || "Attendance closed",
          meta: "This station is not accepting check-ins right now.",
        });
        return;
      }

      if (data?.result === "finished") {
        setResult({
          kind: "info",
          name: "This event is over",
          meta: "Attendance can no longer be recorded.",
        });
      }
    },
    [refreshStation]
  );

  const scanOnce = useCallback(async () => {
    if (!modelsRef.current || busyRef.current) return;
    if (Date.now() < holdUntilRef.current) return;
    if (!["open", "late"].includes(stateRef.current)) return;

    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth) return;

    busyRef.current = true;
    try {
      const detections = await faceapi
        .detectAllFaces(video, detectorRef.current)
        .withFaceLandmarks()
        .withFaceDescriptors();
      if (detections.length > 1) {
        holdUntilRef.current = Date.now() + 1500;
        setResult({ kind: "warn", name: "One person at a time",
          meta: "Only the student checking in should be visible to the camera." });
        return;
      }
      const detection = detections[0];
      if (detection?.descriptor) {
        const descriptor = Array.from(detection.descriptor);
        const { data } = await api.post(`/checkin/${token}`, { descriptor });
        applyResult(data);
      }
    } catch (err) {
      if (err.response?.status === 429) {
        holdUntilRef.current = Date.now() + 3000;
        setResult({
          kind: "warn",
          name: "Slow down a moment",
          meta: "Too many scans. Try again in a few seconds.",
        });
      } else if (err.response?.status === 400) {
        holdUntilRef.current = Date.now() + 1500;
      } else if (!err.response) {
        setError("Connection lost. Reconnecting…");
      } else {
        console.error("Check-in scan failed:", err);
      }
    } finally {
      busyRef.current = false;
    }
  }, [applyResult, token]);

  useEffect(() => {
    if (boot !== "ready") return undefined;
    if (!["open", "late"].includes(station?.state)) return undefined;

    const timer = setInterval(scanOnce, SCAN_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [boot, station?.state, scanOnce]);

  // Clear a transient result even when no new face appears.
  useEffect(() => {
    if (!result) return undefined;
    const timer = setTimeout(() => setResult(null), RESULT_HOLD_MS + 400);
    return () => clearTimeout(timer);
  }, [result]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const state = station?.state || "before";
  const scanning = boot === "ready" && (state === "open" || state === "late");

  return (
    <div className="flex min-h-screen flex-col bg-[#070b12] text-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <TrackMark className="h-9 w-9 shrink-0 text-brand" />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
              TrackED face check-in
            </p>
            <h1 className="truncate font-display text-lg font-semibold sm:text-xl">
              {station?.event?.title || "Attendance station"}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70">
            {STATE_LABEL[state] || "Starting"}
          </span>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded-full border border-white/15 bg-white/5 p-2.5 text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Toggle full screen"
          >
            <FaExpand />
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 py-5 sm:px-8 sm:py-8">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"
          >
            <FaExclamationTriangle className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="relative overflow-hidden rounded-3xl border border-white/12 bg-black shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]">
          <video
            key={cameraNonce}
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="aspect-[4/3] w-full scale-x-[-1] object-cover"
          />

          {/* Corner brackets make the framing obvious on a kiosk screen. */}
          <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-dashed border-white/15 sm:inset-10" />

          {state === "before" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#070b12]/85 px-6 text-center">
              <FaClock className="text-4xl text-brand" />
              <p className="font-display text-2xl font-semibold">Attendance is not open yet</p>
              <p className="max-w-md text-sm text-white/65">
                {station?.window?.start
                  ? `This station starts accepting faces at ${formatDateTime(
                      station.window.start,
                      { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
                    )}.`
                  : "The organizer has not opened the attendance window for this event."}
              </p>
            </div>
          )}

          {state === "late" && !result && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-amber-500/90 px-4 py-3 text-center text-sm font-semibold text-amber-950">
              The window has closed — you can still check in, but you will be marked late.
            </div>
          )}

          {(state === "closed" || state === "expired" || state === "unavailable") && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#070b12]/90 px-6 text-center">
              <FaUserCheck className="text-4xl text-white/40" />
              <p className="font-display text-2xl font-semibold">
                {state === "unavailable" ? "No attendance window" : "This station is closed"}
              </p>
              <p className="max-w-md text-sm text-white/60">
                {state === "expired"
                  ? "The organizer's check-in link has expired. Ask them to open a new station."
                  : "Attendance is no longer being recorded here. See the organizer if you need help."}
              </p>
            </div>
          )}

          {cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#070b12]/95 px-6 text-center">
              <FaCamera className="text-3xl text-white/40" />
              <p className="font-display text-xl font-semibold">Camera unavailable</p>
              <p className="max-w-md text-sm text-white/60">{cameraError}</p>
              <button
                type="button"
                onClick={() => setCameraNonce((n) => n + 1)}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white"
              >
                <FaRedo /> Try again
              </button>
            </div>
          )}

          {scanning && !result && !cameraError && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-gradient-to-t from-black/80 to-transparent px-4 pb-4 pt-14 text-sm font-medium text-white/80">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </span>
              {state === "late" ? "Late check-in — look at the camera" : "Look at the camera to check in"}
            </div>
          )}

          {boot === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#070b12]/95 px-6 text-center">
              <FaExclamationTriangle className="text-3xl text-amber-400" />
              <p className="text-xl font-semibold">Face scanner unavailable</p>
              <p className="text-sm text-white/65">Reload to retry, or ask the organizer for manual attendance.</p>
              <button type="button" onClick={() => window.location.reload()} className="rounded-xl bg-brand px-4 py-2">Reload scanner</button>
            </div>
          )}
          {boot === "loading" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#070b12]/90">
              <TrackMark className="h-10 w-10 animate-pulse text-brand" />
              <p className="text-sm text-white/60">Starting the face scanner…</p>
            </div>
          )}

          {result && (
            <div
              role="status"
              aria-live="polite"
              className={`absolute inset-x-3 top-3 rounded-2xl border px-5 py-4 shadow-2xl backdrop-blur sm:inset-x-6 sm:top-6 ${
                result.kind === "ok"
                  ? "border-emerald-400/40 bg-emerald-500/95 text-emerald-950"
                  : result.kind === "late"
                    ? "border-amber-400/40 bg-amber-400/95 text-amber-950"
                    : result.kind === "info"
                      ? "border-sky-400/40 bg-sky-500/95 text-sky-950"
                      : "border-rose-400/40 bg-rose-500/95 text-rose-950"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/10 text-xl">
                  {result.kind === "ok" || result.kind === "late" ? <FaCheck /> : <FaExclamationTriangle />}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-display text-xl font-bold leading-tight sm:text-2xl">
                    {result.name}
                  </p>
                  <p className="text-sm font-medium opacity-80">{result.meta}</p>
                  {result.note && <p className="mt-1 text-xs opacity-70">{result.note}</p>}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
              Checked in
            </p>
            <p className="num mt-1 text-2xl font-semibold">
              {station?.counts?.checkedIn ?? 0}
              <span className="ml-2 text-sm font-normal text-white/40">
                {station?.counts?.faceCheckedIn
                  ? `${station.counts.faceCheckedIn} by face`
                  : "students"}
              </span>
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
              Attendance window
            </p>
            <p className="mt-1 text-sm font-medium text-white/80">
              {station?.window?.start
                ? `${formatDateTime(station.window.start, {
                    hour: "numeric",
                    minute: "2-digit",
                  })} – ${formatDateTime(station.window.end, {
                    hour: "numeric",
                    minute: "2-digit",
                  })}`
                : "Not set"}
            </p>
            <p className="mt-0.5 text-xs text-white/40">
              {station?.station?.label ? `Station: ${station.station.label}` : "Organizer check-in station"}
            </p>
          </div>
        </div>

        <p className="text-center text-xs leading-relaxed text-white/35">
          Only a mathematical face signature is sent to TrackED — no photo leaves this device.
          If the scanner cannot recognise you, ask the organizer to mark you manually.
        </p>
      </main>
    </div>
  );
};

export default CheckInKiosk;

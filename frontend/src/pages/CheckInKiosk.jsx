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
import ScannerDiagnostics from "../components/shared/ScannerDiagnostics";
import { faceScanIssue } from "../utils/faceScanQuality";
import { canPairFaceScans, faceScanSize, MAX_SCAN_PAIR_AGE_MS } from "../utils/faceScanPair";

// Same face-recognition models used for enrollment, served as static assets so the
// kiosk works on the venue's LAN without hitting the API for model files.
const MODEL_URL = `${import.meta.env.BASE_URL}models/face`;
const SCAN_INTERVAL_MS = 400;
const SCAN_REST_MS = 100;
const RESULT_HOLD_MS = 5000;
const SCAN_RESULT_PAUSE_MS = 2200;

const STATE_LABEL = {
  before: "Not open yet",
  open: "Scanning",
  late: "Late check-in",
  closed: "Station closed",
  expired: "Station expired",
  unavailable: "No attendance window",
};

const MODE_LABEL = {
  time_in: "TIME IN",
  time_out: "TIME OUT",
  closed: "Attendance not open",
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
  const modeRef = useRef(null);
  const detectorRef = useRef(null);
  const frameRef = useRef(null);
  const probeRef = useRef(null);
  const qualityRef = useRef(null);
  const diagnosticsRef = useRef({ stage: "Starting scanner" });
  const unknownCountRef = useRef(0);
  const compatibilityRef = useRef(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const report = useCallback(value => { diagnosticsRef.current = { ...diagnosticsRef.current, ...value }; }, []);
  const tryCompatibility = useCallback(async () => {
    if (compatibilityRef.current || faceapi.tf.getBackend() === "cpu") return false;
    compatibilityRef.current = true;
    probeRef.current = null;
    report({ stage: "Switching to CPU compatibility mode" });
    try {
      if (!await faceapi.tf.setBackend("cpu")) throw new Error("CPU backend unavailable");
      await faceapi.tf.ready();
      report({ backend: "cpu", stage: "Compatibility mode ready; waiting for two new scans" });
      return true;
    } catch {
      report({ stage: "Compatibility mode unavailable" });
      return false;
    }
  }, [report]);

  const [boot, setBoot] = useState("loading"); // loading | ready | error
  const [startupDetail, setStartupDetail] = useState("Starting face processing…");
  const [startupError, setStartupError] = useState("");
  const [slowStartup, setSlowStartup] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [error, setError] = useState("");
  const [station, setStation] = useState(null);
  const [result, setResult] = useState(null);
  const showResult = useCallback(value => setResult(previous => previous?.kind === value.kind && previous?.name === value.name && previous?.meta === value.meta ? previous : value), []);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraNonce, setCameraNonce] = useState(0);

  // ── Station status ─────────────────────────────────────────────────────────
  const refreshStation = useCallback(async () => {
    try {
      const { data } = await api.get(`/checkin/${token}`, { timeout: 15000 });
      setStation(data);
      stateRef.current = data.state;
      modeRef.current = data.mode;
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
    const slowTimer = setTimeout(() => {
      if (!cancelled) setSlowStartup(true);
    }, 20000);
    // Model fetches and backend initialization can remain pending indefinitely.
    // A late completion must not silently activate a scanner after this deadline.
    const deadline = setTimeout(() => {
      if (cancelled) return;
      cancelled = true;
      setStartupError("Scanner setup timed out. Check your connection, then reload. If it still cannot start, use manual attendance.");
      report({ stage: "Scanner startup timed out" });
      setBoot("error");
    }, 90000);
    (async () => {
      try {
        try {
          if (!(await faceapi.tf.setBackend("webgl"))) {
            await faceapi.tf.setBackend("cpu");
          }
        } catch {
          await faceapi.tf.setBackend("cpu");
        }
        await faceapi.tf.ready();
        if (cancelled) return;
        setStartupDetail("Downloading face models. The first visit needs about 7 MB.");
        report({ backend: faceapi.tf.getBackend(), stage: "Loading face models" });
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        if (cancelled) return;
        clearTimeout(deadline);
        clearTimeout(slowTimer);
        detectorRef.current = new faceapi.TinyFaceDetectorOptions({
          inputSize: 320,
          scoreThreshold: 0.5,
        });
        modelsRef.current = true;
        setBoot("ready");
        report({ stage: "Waiting for a clear face" });
      } catch (err) {
        console.error("Face models failed to load:", err);
        if (!cancelled) {
          clearTimeout(deadline);
          clearTimeout(slowTimer);
          setStartupError("Face models could not load. Check your connection and reload, or use manual attendance.");
          setBoot("error");
          setError("The face scanner could not start on this device.");
        }
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(deadline);
      clearTimeout(slowTimer);
    };
  }, [report]);

  // ── Camera ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const stream = { current: null };
    probeRef.current = null;

    (async () => {
      try {
        setCameraError("");
        const media = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
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

  // Permission prompts and camera playback may never resolve on some devices.
  useEffect(() => {
    if (cameraReady || cameraError) return undefined;
    const timer = setTimeout(() => setCameraError("Camera is still not ready. Allow camera access in your browser, close other apps using it, then try again."), 45000);
    return () => clearTimeout(timer);
  }, [cameraReady, cameraError, cameraNonce]);

  // ── Scan loop ──────────────────────────────────────────────────────────────
  const applyResult = useCallback(
    async (data) => {
      holdUntilRef.current = Date.now() + SCAN_RESULT_PAUSE_MS;
      report({ stage: "Face-match response received", serverResult: data?.result || "No result", reason: "", serverReason: "" });

      if (data?.ok && data.result === "marked") {
        unknownCountRef.current = 0;
        showResult({
          kind: data.status === "late" ? "late" : "ok",
          name: data.student?.name || "Student",
          meta:
            data.action === "time_out" ? "Time Out recorded · Session completed" : data.status === "late"
              ? "Time In recorded · Late · 4 penalty hours"
              : "Time In recorded · Present",
          note: data.replacedExcuse ? "Your approved excuse was replaced." : "",
        });
        refreshStation();
        return;
      }

      if (data?.ok && data.result === "already") {
        showResult({
          kind: "info",
          name: data.student?.name || "Student",
          meta: data.message || `Already checked in — ${statusWord(data.status)}`,
        });
        return;
      }

      if (data?.result === "unknown" || data?.result === "not-enrolled") {
        report({ serverReason: data.result === "unknown" ? "The scans did not meet the enrolled-face matching threshold." : "The enrollment is no longer active or has changed." });
        if (data.result === "unknown" && ++unknownCountRef.current >= 3 && await tryCompatibility()) {
          showResult({ kind: "info", name: "Compatibility mode", meta: "Trying a different processing mode. Look straight at the camera." });
          return;
        }
        showResult({
          kind: "warn",
          name: "Face not recognised",
          meta: "Please see the organizer to be marked manually.",
        });
        return;
      }

      if (data?.result === "ambiguous") {
        showResult({
          kind: "warn",
          name: "Could not confirm your face",
          meta: "Two faces are too similar. Please see the organizer.",
        });
        return;
      }
      if (data?.result === "unstable") {
        showResult({ kind: "info", name: "Hold still for a moment", meta: "Look straight at the camera while we confirm your face." });
        return;
      }

      if (data?.result === "no-enrollments") {
        showResult({
          kind: "warn",
          name: "No faces enrolled yet",
          meta: "Ask the organizer to mark attendance manually.",
        });
        return;
      }

      if (["before", "closed", "expired", "unavailable"].includes(data?.result)) {
        refreshStation();
        showResult({
          kind: data.result === "before" ? "info" : "warn",
          name: STATE_LABEL[data.result] || "Attendance closed",
          meta: data.result === "expired" ? "Organizer: reopen this station from the dashboard." : "Check this session's Time In and Time Out schedule.",
        });
        return;
      }

      if (["no_time_in", "ineligible"].includes(data?.result)) { showResult({ kind: "warn", name: "Attendance needs attention", meta: data.message || "Ask the organizer to check your Time In." }); return; }
      if (data?.result === "finished") {
        showResult({
          kind: "info",
          name: "This event is over",
          meta: "Attendance can no longer be recorded.",
        });
      }
    },
    [refreshStation, showResult, report, tryCompatibility]
  );

  const scanOnce = useCallback(async () => {
    if (!modelsRef.current || busyRef.current || document.hidden) return;
    if (Date.now() < holdUntilRef.current) return;
    if (!["open", "late"].includes(stateRef.current)) return;

    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth) return;

    busyRef.current = true;
    const capturedAt = Date.now();
    const capturedState = stateRef.current, capturedMode = modeRef.current;
    let submitting = false;
    let input;
    try {
      // Keep detection and face alignment on the same frame as the student moves.
      const frame = (frameRef.current ??= document.createElement("canvas"));
      const size = faceScanSize(video.videoWidth, video.videoHeight);
      report({ stage: "Detecting face", frame: `${size.width} × ${size.height}` });
      if (frame.width !== size.width || frame.height !== size.height) {
        frame.width = size.width;
        frame.height = size.height;
      }
      frame.getContext("2d").drawImage(video, 0, 0, frame.width, frame.height);
      // Enrollment descriptors are built on the server from a pixel tensor
      // (float face box + cropAndResize). A canvas input takes a different
      // extraction path (integer box + drawImage) and lands ~0.06 away from the
      // enrolled descriptor for the very same pixels. Feed the network the same
      // kind of tensor so a live scan is compared against a like-for-like probe.
      input = faceapi.tf.browser.fromPixels(frame);
      const detections = await faceapi.detectAllFaces(input, detectorRef.current);
      if (detections.length > 1) {
        probeRef.current = null;
        holdUntilRef.current = Date.now() + 1500;
        showResult({ kind: "warn", name: "One person at a time",
          meta: "Only the student checking in should be visible to the camera." });
        return;
      }
      if (!detections.length) { probeRef.current = null; report({ stage: "No face detected", reason: "Face the camera in even lighting." }); return; }
      const quality = (qualityRef.current ??= document.createElement("canvas"));
      quality.width = 32; quality.height = 32;
      const context = quality.getContext("2d", { willReadFrequently: true });
      const box = detections[0].box;
      context.drawImage(frame, box.x, box.y, box.width, box.height, 0, 0, 32, 32);
      const pixels = context.getImageData(0, 0, 32, 32).data;
      let brightness = 0;
      for (let i = 0; i < pixels.length; i += 4) brightness += 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
      const issue = faceScanIssue(detections[0], frame.width, frame.height, brightness / 1024);
      if (issue) { probeRef.current = null; report({ stage: "Image-quality check stopped the scan", reason: issue }); showResult({ kind: "info", name: "Adjust your position", meta: issue }); return; }

      // Reuse the single detected face and run the same full landmark and
      // recognition models as before. Crowded frames need neither model.
      const landmarks = new faceapi.DetectAllFaceLandmarksTask(
        Promise.resolve([{ detection: detections[0] }]), input, false
      );
      report({ stage: "Processing face signature", reason: "" });
      const [match] = await landmarks.withFaceDescriptors();
      if (!match?.descriptor || capturedState !== stateRef.current || capturedMode !== modeRef.current || !["open", "late"].includes(stateRef.current)) { probeRef.current = null; return; }

      const descriptor = Array.from(match.descriptor);
      const previous = probeRef.current;
      const current = { descriptor, at: capturedAt, token, state: capturedState, mode: capturedMode };
      probeRef.current = current;
      if (!canPairFaceScans(previous, current) || Date.now() - capturedAt > MAX_SCAN_PAIR_AGE_MS) {
        report({ stage: "Waiting for a second fresh scan" });
        showResult({ kind: "info", name: "Hold still—confirming your face", meta: "Keep looking at the camera for one more scan." });
        return;
      }
      probeRef.current = null;
      submitting = true;
      report({ stage: "Sending face-match POST" });
      const { data } = await api.post(`/checkin/${token}`, { descriptors: [previous.descriptor, descriptor] });
      await applyResult(data);
    } catch (err) {
      probeRef.current = null;
      if (!submitting) {
        report({ stage: "Local face processing failed", reason: "The camera/model processing failed before a request could be sent." });
        if (await tryCompatibility()) showResult({ kind: "info", name: "Compatibility mode", meta: "Look at the camera while the scanner retries." });
        else showResult({ kind: "warn", name: "Scanner processing failed", meta: "Reload this station or use supervised manual attendance." });
      } else if (err.response?.status === 429) {
        holdUntilRef.current = Date.now() + 3000;
        showResult({
          kind: "warn",
          name: "Slow down a moment",
          meta: "Too many scans. Try again in a few seconds.",
        });
      } else if (err.response?.status === 400) {
        holdUntilRef.current = Date.now() + 1500;
        showResult({ kind: "warn", name: "Please retry the scan", meta: err.response?.data?.error || "Hold still and look at the camera." });
      } else if (!err.response) {
        report({ stage: "Face-match request could not reach the server", reason: "Connection failure after sending the request." });
        setError("Connection lost. Reconnecting…");
      } else {
        console.error("Check-in scan failed:", err);
      }
    } finally {
      input?.dispose();
      busyRef.current = false;
    }
  }, [applyResult, token, showResult, report, tryCompatibility]);

  useEffect(() => {
    if (boot !== "ready") return undefined;
    if (!["open", "late"].includes(station?.state)) return undefined;

    let stopped = false;
    let timer;
    const scan = async () => {
      const start = performance.now();
      await scanOnce();
      if (stopped) return;
      const delay = Math.max(
        SCAN_REST_MS,
        SCAN_INTERVAL_MS - (performance.now() - start),
        holdUntilRef.current - Date.now(),
      );
      timer = setTimeout(scan, delay);
    };
    scan();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [boot, station?.state, scanOnce]);

  // Clear a transient result even when no new face appears.
  useEffect(() => {
    if (!result) return undefined;
    const timer = setTimeout(() => setResult(null), RESULT_HOLD_MS);
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
  const stationOpen = state === "open" || state === "late";
  const scanning = boot === "ready" && stationOpen && cameraReady;
  const starting = !cameraError && boot !== "error" && (
    boot === "loading" || (!station && !error) || (stationOpen && !cameraReady)
  );

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
          <span className="rounded-full border border-brand/40 bg-brand/15 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-brand">
            {MODE_LABEL[station?.mode] || "Attendance not open"}
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
          {/* Selfie mirror on the display only. drawImage below reads the raw
              frame, so the scanner's probe stays unmirrored and matches the
              unmirrored enrolled reference. */}
          <video
            key={cameraNonce}
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onPlaying={() => { setCameraReady(true); setCameraError(""); }}
            onWaiting={() => setCameraReady(false)}
            className="aspect-[4/3] w-full scale-x-[-1] object-contain"
          />

          {/* Corner brackets make the framing obvious on a kiosk screen. */}
          <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-dashed border-white/15 sm:inset-10" />

          {station?.state === "before" && (
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
                onClick={() => {
                  setCameraReady(false);
                  setCameraNonce((n) => n + 1);
                }}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white"
              >
                <FaRedo /> Try again
              </button>
            </div>
          )}


          {boot === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#070b12]/95 px-6 text-center">
              <FaExclamationTriangle className="text-3xl text-amber-400" />
              <p className="text-xl font-semibold">Face scanner unavailable</p>
              <p className="max-w-md text-sm text-white/65">{startupError}</p>
              <button type="button" onClick={() => window.location.reload()} className="rounded-xl bg-brand px-4 py-2">Reload scanner</button>
            </div>
          )}
          {starting && (
            <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#070b12]/90 px-5 text-center">
              <TrackMark className="h-10 w-10 animate-pulse text-brand" />
              <p className="text-base font-semibold">Please wait while the face scanner gets ready.</p>
              <p className="max-w-md text-sm text-white/70">{boot === "loading" ? startupDetail : !station ? "Connecting to the attendance station…" : "Waiting for the camera. Allow camera access in your browser."}</p>
              {slowStartup && <p className="max-w-md text-sm text-amber-200">Taking longer than usual. Keep this tab open and check your internet connection.</p>}
            </div>
          )}

          {['warn', 'ok', 'late'].includes(result?.kind) && (
            <div
              role="status"
              aria-live="polite"
              className={`absolute inset-x-3 top-3 rounded-2xl border px-5 py-4 shadow-2xl backdrop-blur sm:inset-x-6 sm:top-6 ${
                result.kind === "ok" || result.kind === "late"
                  ? "border-emerald-400/40 bg-emerald-500/95 text-emerald-950"
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

        <p role="status" aria-live="polite" className="min-h-6 text-center text-sm text-white/70">
          {result?.kind === 'info' ? result.meta || result.name : scanning ? `${station?.mode === 'time_out' ? 'Time Out' : 'Time In'} · Look at the camera` : ''}
        </p>

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
        <details className="rounded-xl border border-white/10 px-4 py-3" onToggle={event => setDiagnosticsOpen(event.currentTarget.open)}>
          <summary className="cursor-pointer text-xs font-medium text-white/60">Scanner status</summary>
          {diagnosticsOpen && <ScannerDiagnostics statusRef={diagnosticsRef} />}
        </details>
      </main>
    </div>
  );
};

export default CheckInKiosk;

import React, { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import api from "../../api/axios";
import { FaCamera, FaTimes, FaCheck, FaExclamationTriangle } from "react-icons/fa";
import { describeCameraError } from "../../utils/camera";

const statusLabel = (status) =>
  status ? status.charAt(0).toUpperCase() + status.slice(1) : "";

const QRScanner = ({ eventId, onScanSuccess }) => {
  const [isScanning, setIsScanning] = useState(false);
  // True between clicking Start Scanner and the scanner actually running.
  // The #qr-reader element must be in the DOM before Html5Qrcode is
  // constructed, so we render the container first and start on the next render.
  const [isStarting, setIsStarting] = useState(false);
  const [lastScan, setLastScan] = useState(null);
  const [sessionCount, setSessionCount] = useState(0);
  const [error, setError] = useState("");
  // Transient confirmation popup shown for every scanned QR (recorded or failed).
  const [feedback, setFeedback] = useState(null);
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);
  const mountedRef = useRef(true);
  // Guards against the camera firing several decodes for the same QR before it
  // is paused — without this, scan #2 hits "already marked attendance" and the
  // success message is replaced by an error.
  const scanLockRef = useRef(false);
  const resumeTimerRef = useRef(null);
  const feedbackTimerRef = useRef(null);

  const showReader = isScanning || isStarting;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimeout(resumeTimerRef.current);
      clearTimeout(feedbackTimerRef.current);
      const scanner = html5QrCodeRef.current;
      if (scanner) {
        Promise.resolve(scanner.stop())
          .catch(() => {})
          .then(() => {
            try {
              scanner.clear();
            } catch {
              // scanner may not have started
            }
          });
      }
    };
  }, []);

  const showFeedback = (payload) => {
    setFeedback(payload);
    clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => {
      if (mountedRef.current) setFeedback(null);
    }, 2800);
  };

  const pauseScanner = () => {
    const scanner = html5QrCodeRef.current;
    if (!scanner) return;
    try {
      scanner.pause(true);
    } catch {
      // already paused or not running
    }
  };

  // Unlock and resume the camera a moment after a decode so the organizer has
  // time to read the confirmation and move to the next student.
  const scheduleResume = () => {
    clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      scanLockRef.current = false;
      const scanner = html5QrCodeRef.current;
      if (scanner) {
        try {
          scanner.resume();
        } catch {
          // not paused
        }
      }
    }, 1800);
  };

  const startScanner = () => {
    setError("");
    setFeedback(null);
    setSessionCount(0);
    scanLockRef.current = false;
    // Render #qr-reader first; the effect below starts the scanner once it exists.
    setIsStarting(true);
  };

  useEffect(() => {
    if (!isStarting) return;
    let cancelled = false;

    const run = async () => {
      try {
        const html5QrCode = new Html5Qrcode("qr-reader");
        html5QrCodeRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          async (decodedText) => {
            // Ignore extra frames for the same QR while one is being processed.
            if (scanLockRef.current) return;
            scanLockRef.current = true;
            // Pause the camera up-front so no other frame slips through before
            // the network round-trip completes.
            pauseScanner();

            let qrData;
            try {
              qrData = JSON.parse(decodedText);
            } catch {
              showFeedback({ ok: false, message: "Invalid QR code format" });
              scheduleResume();
              return;
            }

            if (!qrData.eventId || !qrData.studentId) {
              showFeedback({ ok: false, message: "Invalid QR code format" });
              scheduleResume();
              return;
            }

            if (qrData.eventId !== eventId) {
              showFeedback({ ok: false, message: "QR code is not for this event" });
              scheduleResume();
              return;
            }

            await handleScan(qrData.studentId);
          },
          () => {}
        );

        if (cancelled || !mountedRef.current) {
          await html5QrCode.stop().catch(() => {});
          try {
            html5QrCode.clear();
          } catch {
            // nothing rendered to clear
          }
          return;
        }

        setIsScanning(true);
      } catch (err) {
        if (!cancelled && mountedRef.current) setError(describeCameraError(err));
      } finally {
        if (!cancelled) setIsStarting(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStarting]);

  const stopScanner = async () => {
    clearTimeout(resumeTimerRef.current);
    scanLockRef.current = false;
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
        html5QrCodeRef.current = null;
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
    }
    setIsScanning(false);
    setIsStarting(false);
  };

  const handleScan = async (studentId) => {
    try {
      const res = await api.post(`/events/${eventId}/attendance/scan`, {
        studentId,
      });

      const attendance = res.data?.attendance || {};
      const studentName = attendance.student?.name || "Student";
      const status = attendance.status || "present";

      setLastScan({
        name: studentName,
        status,
        time: new Date().toLocaleTimeString(),
      });
      setSessionCount((c) => c + 1);
      showFeedback({
        ok: true,
        name: studentName,
        status,
        message: res.data?.message,
      });

      if (onScanSuccess) {
        onScanSuccess(attendance);
      }
    } catch (err) {
      showFeedback({
        ok: false,
        message: err.response?.data?.error || "Failed to mark attendance",
      });
    } finally {
      scheduleResume();
    }
  };

  return (
    <div className="rounded-xl border border-line bg-card p-6">
      {feedback && (
        <div className="fixed inset-x-0 top-6 z-[100] flex justify-center px-4 pointer-events-none">
          <div
            className={`pointer-events-auto flex items-center gap-3 rounded-xl border px-5 py-4 shadow-2xl backdrop-blur ${
              feedback.ok
                ? "bg-green-600/95 border-green-400 text-white"
                : "bg-red-600/95 border-red-400 text-white"
            }`}
          >
            <span className="text-2xl shrink-0">
              {feedback.ok ? <FaCheck /> : <FaExclamationTriangle />}
            </span>
            {feedback.ok ? (
              <div>
                <p className="font-bold leading-tight">Attendance recorded</p>
                <p className="text-sm">
                  {feedback.name} — {statusLabel(feedback.status)}
                </p>
              </div>
            ) : (
              <p className="font-semibold text-sm">{feedback.message}</p>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-on flex items-center gap-2">
          <FaCamera className="text-indigo-500" />
          Scan Student QR
        </h3>
        {isScanning && (
          <button
            onClick={stopScanner}
            className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
          >
            <FaTimes />
          </button>
        )}
      </div>

      {!showReader ? (
        <button
          onClick={startScanner}
          className="w-full rounded-lg bg-indigo-600 py-2.5 text-white shadow-sm transition-colors hover:bg-indigo-700 active:bg-indigo-800 inline-flex items-center justify-center gap-2 font-medium"
        >
          <FaCamera />
          Start Scanner
        </button>
      ) : (
        <div className="space-y-4">
          <div id="qr-reader" className="rounded-xl overflow-hidden bg-black" ref={scannerRef} />
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 dark:text-gray-400 text-on-muted">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
              </span>
              {isScanning
                ? "Scanning — point camera at student's QR code"
                : "Starting camera…"}
            </span>
            {sessionCount > 0 && (
              <span className="shrink-0 text-on-dim font-medium">
                {sessionCount} scanned this session
              </span>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl flex items-center gap-2 text-red-400">
          <FaExclamationTriangle />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {lastScan && (
        <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500/20 text-green-500 text-lg">
            <FaCheck />
          </span>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-on-muted">Last recorded</p>
            <p className="font-bold text-on truncate">{lastScan.name}</p>
            <p
              className={`text-sm font-medium ${
                lastScan.status === "present" ? "text-green-500" : "text-yellow-500"
              }`}
            >
              {statusLabel(lastScan.status)} · {lastScan.time}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default QRScanner;

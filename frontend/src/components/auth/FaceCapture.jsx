import React, { useState, useRef, useEffect, useCallback } from "react";
import { FaCamera, FaRedo, FaCheck, FaExclamationTriangle } from "react-icons/fa";
import Button from "../ui/Button";
import { dataUrlToBlob } from "../../utils/image";
import { describeCameraError } from "../../utils/camera";

const releaseStream = (stream) => {
  stream?.getTracks().forEach((t) => t.stop());
};

const FaceCapture = ({
  onCapture,
  onCancel,
  // Optional: called when the student starts over. The parent uses it to clear
  // the message from the previous attempt, which is about the photo (a face
  // mismatch), not about the camera.
  onRetake,
  title = "Face photo",
  loading = false,
  loadingLabel = "Checking...",
  error: attemptError = "",
}) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const [cameraError, setCameraError] = useState("");
  const [preview, setPreview] = useState(null);
  // Two very different failures share one alert: the camera is unavailable
  // (hardware/permission) and the last photo was rejected by the server. Only
  // the first one may hide the feed or disable the shutter — treating a face
  // mismatch as "no camera" is what left people stuck after a failed attempt.
  const error = cameraError || attemptError;

  const stopCamera = useCallback(() => {
    requestIdRef.current += 1;
    releaseStream(streamRef.current);
    streamRef.current = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopCamera();
    };
  }, [stopCamera]);

  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError("");
    const id = requestIdRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      if (!mountedRef.current || id !== requestIdRef.current) {
        releaseStream(stream);
        return;
      }
      releaseStream(streamRef.current);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setPreview(null);
      setCameraError("");
    } catch (err) {
      if (mountedRef.current && id === requestIdRef.current) {
        setCameraError(describeCameraError(err));
      }
    }
  }, [stopCamera]);

  const handleVideoRef = useCallback(
    (node) => {
      videoRef.current = node;
      if (!node) return;
      if (streamRef.current) {
        node.srcObject = streamRef.current;
        node.play().catch(() => {});
        return;
      }
      startCamera();
    },
    [startCamera]
  );

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setCameraError("Camera isn't ready yet. Try again.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    setPreview(canvas.toDataURL("image/jpeg", 0.92));
    stopCamera();
  };

  // Retake / Try again: clear the previous attempt's message, then reopen the
  // camera. The stream is always released before this, so it is a fresh start.
  const retake = () => {
    onRetake?.();
    startCamera();
  };

  const usePhoto = () => {
    if (!preview) return;
    onCapture(dataUrlToBlob(preview));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-on-dim">
        {preview
          ? "Take another photo or use this one."
          : "Position your face inside the frame and look directly at the camera."}
      </p>

      {error && (
        <div role="alert" className="alert alert-danger alert-sm">
          <span aria-hidden="true">!</span>
          <p>{error}</p>
        </div>
      )}

      {preview ? (
        <div className="overflow-hidden rounded-xl border border-line">
          <img src={preview} alt="Captured face preview" className="w-full object-cover" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-black">
          {cameraError ? (
            <div className="flex aspect-[4/3] w-full items-center justify-center gap-2 text-sm text-white/70">
              <FaExclamationTriangle /> No camera feed
            </div>
          ) : (
            <video
              ref={handleVideoRef}
              autoPlay
              playsInline
              muted
              className="aspect-[4/3] w-full object-cover"
            />
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        {onCancel ? (
          <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          {cameraError && !preview && (
            <Button type="button" variant="secondary" size="sm" onClick={retake}>
              <FaRedo className="text-xs" /> Try again
            </Button>
          )}
          {preview && (
            <Button type="button" variant="secondary" size="sm" onClick={retake}>
              <FaRedo className="text-xs" /> Retake
            </Button>
          )}
          {preview ? (
            <Button type="button" size="sm" onClick={usePhoto} loading={loading}>
              {loading ? loadingLabel : "Use this photo"}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={capture}
              disabled={!!cameraError || loading}
            >
              <FaCamera className="text-xs" /> {title}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FaceCapture;
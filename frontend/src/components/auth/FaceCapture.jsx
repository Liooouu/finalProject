import React, { useState, useRef, useEffect, useCallback } from "react";
import { FaCamera, FaRedo, FaCheck, FaExclamationTriangle } from "react-icons/fa";
import Button from "../ui/Button";
import { dataUrlToBlob } from "../../utils/image";
import { describeCameraError } from "../../utils/camera";

const FaceCapture = ({ onCapture, onCancel, title = "Face photo", loading = false }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setPreview(null);
      setError("");
    } catch (err) {
      setError(describeCameraError(err));
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

  useEffect(() => stopCamera, [stopCamera]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setError("Camera isn't ready yet. Try again.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    setPreview(canvas.toDataURL("image/jpeg", 0.92));
    stopCamera();
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
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400"
        >
          {error}
        </div>
      )}

      {preview ? (
        <div className="overflow-hidden rounded-xl border border-line">
          <img src={preview} alt="Captured face preview" className="w-full object-cover" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-black">
          {error ? (
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
          <Button variant="ghost" onClick={onCancel} className="border border-line">
            Cancel
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          {error && !preview && (
            <Button variant="ghost" onClick={startCamera} className="border border-line">
              <FaRedo className="text-xs" /> Try again
            </Button>
          )}
          {preview && (
            <Button variant="ghost" onClick={startCamera} className="border border-line">
              <FaRedo className="text-xs" /> Retake
            </Button>
          )}
          {preview ? (
            <Button onClick={usePhoto} disabled={loading}>
              {loading ? "Uploading..." : "Use this photo"}
            </Button>
          ) : (
            <Button onClick={capture} disabled={!!error || loading}>
              <FaCamera className="text-xs" /> {title}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FaceCapture;
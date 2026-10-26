import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import FaceCapture from "./components/auth/FaceCapture";
import "./index.css";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitFor = async (check, label, timeout = 15000) => {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = check();
    if (value) return value;
    await sleep(100);
  }
  throw new Error(`timed out: ${label}`);
};

const buttonByText = (text) =>
  [...document.querySelectorAll("button")].find((button) =>
    button.textContent.replace(/\s+/g, " ").trim().toLowerCase().includes(text.toLowerCase())
  );

const liveVideo = () => {
  const video = document.querySelector("video");
  return video && video.videoWidth > 0 ? video : null;
};

// Temporary probe: drives the real FaceCapture the way a student does after a
// rejected attempt, so the retake path is exercised against a real camera feed.
function Probe() {
  const mode = new URLSearchParams(location.search).get("mode") === "b" ? "b" : "a";
  const [attemptError, setAttemptError] = useState("");
  const [results, setResults] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const record = (patch) => {
      if (!cancelled) setResults((prev) => ({ ...(prev || {}), ...patch }));
    };

    (async () => {
      try {
        await waitFor(liveVideo, "first camera frame");
        record({ cameraStarts: true });

        const shutter = await waitFor(() => buttonByText("Scan my face"), "capture button");
        shutter.click();
        await waitFor(
          () => document.querySelector('img[alt="Captured face preview"]'),
          "captured preview"
        );
        record({ cameraStopsAfterCapture: !document.querySelector("video") });

        setAttemptError("Face does not match the enrolled photo (2 attempts left).");
        await waitFor(() => document.querySelector('[role="alert"]'), "attempt error alert");
        record({
          retakeVisibleAfterFailure: Boolean(buttonByText("Retake")),
          noDeadFeedPlaceholder: !document.body.textContent.includes("No camera feed"),
        });

        buttonByText("Retake").click();
        const video = await waitFor(liveVideo, "camera after retake");
        const shutterAgain = buttonByText("Scan my face");
        record({
          videoBackAfterRetake: Boolean(video),
          shutterEnabledAfterRetake: Boolean(shutterAgain) && !shutterAgain.disabled,
          alertAfterRetake: document.querySelector('[role="alert"]')
            ? "still shown"
            : "cleared",
        });

        // Second capture proves the reopened stream is actually usable.
        shutterAgain.click();
        await waitFor(
          () => document.querySelector('img[alt="Captured face preview"]'),
          "second preview"
        );
        record({ secondCaptureWorks: true });
      } catch (err) {
        record({ failure: err.message });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!results) return;
    const done = "failure" in results || "secondCaptureWorks" in results;
    if (!done) return;
    const passed = !results.failure && results.secondCaptureWorks;
    document.title = passed ? `probe ${mode}: pass` : `probe ${mode}: FAIL`;
    window.__probeResults = { mode, passed, results };
  }, [results, mode]);

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-lg font-bold">FaceCapture probe ({mode})</h1>
      <FaceCapture
        title="Scan my face"
        onCapture={() => {
          setResults((prev) => ({ ...(prev || {}), onCaptureCalled: true }));
        }}
        onRetake={mode === "a" ? () => setAttemptError("") : undefined}
        error={attemptError}
      />
      <pre id="probe-result" className="mt-6 text-xs">
        {JSON.stringify(results, null, 2)}
      </pre>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Probe />);

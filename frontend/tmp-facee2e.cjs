// TEMPORARY — end-to-end check of the face-recovery screen: a rejected selfie
// must not kill the camera, and Retake must give a working feed again.
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9334;
const SHOTS = path.join(os.tmpdir(), "opencode", "shots");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch() {
  const profile = path.join(os.tmpdir(), "opencode", "chrome-face-e2e");
  fs.rmSync(profile, { recursive: true, force: true });
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      "--window-size=520,1000",
      "http://localhost:5173/auth",
    ],
    { stdio: "ignore" }
  );

  let page = null;
  for (let i = 0; i < 80; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const targets = await res.json();
      page = targets.find((t) => t.type === "page" && t.url.includes("/auth"));
      if (page) break;
    } catch {
      // endpoint not up yet
    }
    await sleep(250);
  }
  if (!page) throw new Error("no auth page target");
  return { chrome, wsUrl: page.webSocketDebuggerUrl };
}

function cdp(ws, method, params = {}, timeoutMs = 60000) {
  const id = Math.floor(Math.random() * 1e6);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("cdp timeout")), timeoutMs);
    const onMessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id !== id) return;
      clearTimeout(timer);
      ws.removeEventListener("message", onMessage);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    };
    ws.addEventListener("message", onMessage);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(ws, expression, timeoutMs = 60000) {
  const result = await cdp(
    ws,
    "Runtime.evaluate",
    { expression, awaitPromise: true, returnByValue: true },
    timeoutMs
  );
  return result.result.value;
}

async function evaluateWithRetry(ws, expression) {
  for (let i = 0; i < 40; i += 1) {
    try {
      return await evaluate(ws, expression);
    } catch (err) {
      const message = String(err.message || "");
      if (!message.includes("context was destroyed") && !message.includes("Cannot find context")) {
        throw err;
      }
      await sleep(500);
    }
  }
  throw new Error("execution context never settled");
}

async function shot(ws, name) {
  const { data } = await cdp(ws, "Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(SHOTS, `${name}.png`), Buffer.from(data, "base64"));
}

// Shared page-side helpers, injected into each evaluation.
const PAGE_HELPERS = `
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitFor = async (check, label, timeout = 40000) => {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const value = check();
      if (value) return value;
      await sleep(120);
    }
    throw new Error("timed out: " + label);
  };
  const byText = (text, scope = document) =>
    [...scope.querySelectorAll("button, a")].find((node) =>
      node.textContent.replace(/\\s+/g, " ").trim().toLowerCase().includes(text.toLowerCase())
    );
  const liveVideo = () => {
    const v = document.querySelector("video");
    return v && v.videoWidth > 0 ? v : null;
  };
`;

(async () => {
  const { chrome, wsUrl } = await launch();
  const out = {};
  try {
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve);
      ws.addEventListener("error", reject);
    });

    const phase1 = await evaluateWithRetry(
      ws,
      `(async () => {
        ${PAGE_HELPERS}
        const setInput = (el, value) => {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
          setter.call(el, value);
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        };
        const out = {};
        try {
          const email = await waitFor(() => document.getElementById("email"), "login email");
          setInput(email, "review.face@tracked.test");
          setInput(document.getElementById("password"), "ReviewPass123!");
          await sleep(250);

          byText("Forgot your security PIN?").click();
          const forgotEmail = await waitFor(() => document.getElementById("forgot-email"), "forgot email");
          out.emailPrefilled = forgotEmail.value === "review.face@tracked.test";
          byText("Check my identity").click();

          const shutter = await waitFor(() => byText("Scan my face"), "capture stage");
          out.captureStageReached = true;

          await waitFor(liveVideo, "camera frame");
          out.cameraStarts = true;
          shutter.click();
          await waitFor(() => document.querySelector('img[alt="Captured face preview"]'), "preview");
          out.previewAfterCapture = true;

          byText("Use this photo").click();
          const alert = await waitFor(() => document.querySelector('[role="alert"]'), "rejection alert");
          out.rejectionMessage = alert.textContent.replace(/\\s+/g, " ").trim().slice(0, 90);
          out.retakeOffered = Boolean(byText("Retake"));
          out.deadFeedPlaceholder = document.body.textContent.includes("No camera feed");
        } catch (err) {
          out.failure = err.message;
          out.body = document.body.innerText.slice(0, 500);
        }
        return out;
      })()`
    );
    Object.assign(out, phase1);
    await sleep(400);
    await shot(ws, "face-rejected");

    const phase2 = await evaluate(
      ws,
      `(async () => {
        ${PAGE_HELPERS}
        const out = {};
        try {
          byText("Retake").click();
          await waitFor(liveVideo, "camera after retake");
          const shutterAgain = byText("Scan my face");
          out.videoBackAfterRetake = true;
          out.shutterEnabledAfterRetake = Boolean(shutterAgain) && !shutterAgain.disabled;
          out.alertClearedAfterRetake = !document.querySelector('[role="alert"]');
          shutterAgain.click();
          await waitFor(() => document.querySelector('img[alt="Captured face preview"]'), "second preview");
          out.secondCaptureWorks = true;
        } catch (err) {
          out.secondFailure = err.message;
        }
        return out;
      })()`
    );
    Object.assign(out, phase2);
    await sleep(400);
    await shot(ws, "face-retaken");

    ws.close();
  } finally {
    chrome.kill();
  }

  fs.writeFileSync(path.join(SHOTS, "face-e2e.json"), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

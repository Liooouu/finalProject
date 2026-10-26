// TEMPORARY — drives the FaceCapture probe in a real headless Chrome with a
// fake camera over CDP, so async camera frames are awaited in real time.
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9333;
const dir = path.join(os.tmpdir(), "opencode", "shots");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openTarget(mode) {
  const url = `http://localhost:5173/__faceprobe.html?mode=${mode}`;
  const profile = path.join(os.tmpdir(), "opencode", `chrome-face-cdp-${mode}`);
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
      "--window-size=520,900",
      url,
    ],
    { stdio: "ignore" }
  );

  // Wait for the debugging endpoint, then find the page target.
  let targets = null;
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      targets = await res.json();
      if (targets.some((t) => t.type === "page" && t.url.includes("__faceprobe"))) break;
    } catch {
      // not up yet
    }
    await sleep(250);
  }
  const page = (targets || []).find((t) => t.type === "page");
  if (!page) throw new Error("no page target");
  return { chrome, wsUrl: page.webSocketDebuggerUrl };
}

async function evaluate(ws, expression, timeoutMs = 45000) {
  const id = Math.floor(Math.random() * 1e6);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("cdp timeout")), timeoutMs);
    const onMessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id !== id) return;
      clearTimeout(timer);
      ws.removeEventListener("message", onMessage);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result.result.value);
    };
    ws.addEventListener("message", onMessage);
    ws.send(
      JSON.stringify({
        id,
        method: "Runtime.evaluate",
        params: { expression, awaitPromise: true, returnByValue: true },
      })
    );
  });
}

// The dev server can still be loading (and Vite may swap the execution
// context), so evaluations are retried until the page settles.
async function evaluateWithRetry(ws, expression, attempts = 40) {
  for (let i = 0; i < attempts; i += 1) {
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

(async () => {
  const out = {};
  for (const mode of ["a", "b"]) {
    const { chrome, wsUrl } = await openTarget(mode);
    try {
      const ws = new WebSocket(wsUrl);
      await new Promise((resolve, reject) => {
        ws.addEventListener("open", resolve);
        ws.addEventListener("error", reject);
      });

      const result = await evaluateWithRetry(
        ws,
        `(async () => {
          const started = Date.now();
          while (Date.now() - started < 40000) {
            if (window.__probeResults) return window.__probeResults;
            await new Promise((r) => setTimeout(r, 200));
          }
          return { timeout: true, body: document.body.innerText.slice(0, 400) };
        })()`
      );
      out[mode] = result;
      ws.close();
    } finally {
      chrome.kill();
      await sleep(800);
    }
  }
  fs.writeFileSync(path.join(dir, "faceprobe-results.json"), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

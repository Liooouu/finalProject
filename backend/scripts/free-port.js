// Frees the server port so the backend never dies with "EADDRINUSE". If
// something (usually a stale TrackED backend) is listening on the port, it is
// identified and stopped. Used by the predev/prestart npm hooks and by
// server.js, which retries the bind after freeing the port itself.
const { execSync } = require("child_process");

function findListeners(port) {
  const pids = new Set();

  if (process.platform === "win32") {
    const netstat = execSync("netstat -ano", { encoding: "utf8", windowsHide: true });
    for (const line of netstat.split(/\r?\n/)) {
      if (!line.toLowerCase().includes(`:${port}`)) continue;
      if (!line.toUpperCase().includes("LISTENING")) continue;
      const m = line.match(/(\d+)\s*$/);
      if (m) pids.add(m[1]);
    }
    return [...pids];
  }

  try {
    const out = execSync(`lsof -ti tcp:${port}`, { encoding: "utf8" });
    for (const pid of out.split(/\r?\n/)) {
      if (pid.trim()) pids.add(pid.trim());
    }
  } catch {
    // no listener found
  }
  return [...pids];
}

function describePid(pid) {
  if (process.platform !== "win32") return pid;
  try {
    const cols = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, {
      encoding: "utf8",
      windowsHide: true,
    })
      .trim()
      .split(",");
    return cols[0] ? cols[0].replace(/"/g, "") : pid;
  } catch {
    return pid;
  }
}

// Stops every process listening on `port`. Returns the PIDs that were stopped.
// Honours TRACKED_NO_AUTO_FREE=1 for anyone who would rather see the manual
// instructions than have a process killed for them.
function freePort(port = process.env.PORT || 5000, { log = console.log } = {}) {
  if (process.env.TRACKED_NO_AUTO_FREE === "1") {
    log(`Port ${port} is in use and TRACKED_NO_AUTO_FREE=1, so nothing was stopped.`);
    return [];
  }

  const killed = [];
  for (const pid of findListeners(port)) {
    log(`Port ${port} is in use by ${describePid(pid)} (PID ${pid}). Freeing it...`);
    execSync(process.platform === "win32" ? `taskkill /F /PID ${pid}` : `kill -9 ${pid}`, {
      stdio: "ignore",
      windowsHide: true,
    });
    log(`Stopped PID ${pid}.`);
    killed.push(pid);
  }
  return killed;
}

module.exports = { findListeners, freePort };

if (require.main === module) {
  try {
    const port = process.env.PORT || 5000;
    const killed = freePort(port);
    if (killed.length === 0 && process.env.TRACKED_NO_AUTO_FREE !== "1") {
      console.log(`Port ${port} is free.`);
    }
  } catch (err) {
    console.error(`Could not free port: ${err.message}`);
    process.exit(1);
  }
}
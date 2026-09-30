// Frees the server port so `npm run dev` / `npm run start` never hit
// "EADDRINUSE". If something (usually a stale TrackED backend) is listening on
// the port, it is identified and killed before the server starts.
const { execSync } = require("child_process");

const port = process.env.PORT || 5000;
const pids = new Set();

if (process.platform === "win32") {
  const netstat = execSync("netstat -ano", { encoding: "utf8", windowsHide: true });
  for (const line of netstat.split(/\r?\n/)) {
    if (!line.toLowerCase().includes(`:${port}`)) continue;
    if (!line.toUpperCase().includes("LISTENING")) continue;
    const m = line.match(/(\d+)\s*$/);
    if (m) pids.add(m[1]);
  }
} else {
  try {
    const out = execSync(`lsof -ti tcp:${port}`, { encoding: "utf8" });
    for (const pid of out.split(/\r?\n/)) {
      if (pid.trim()) pids.add(pid.trim());
    }
  } catch {
    // no listener found
  }
}

if (pids.size === 0) {
  console.log(`Port ${port} is free.`);
  process.exit(0);
}

for (const pid of pids) {
  let name = pid;
  try {
    if (process.platform === "win32") {
      const cols = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, {
        encoding: "utf8",
        windowsHide: true,
      })
        .trim()
        .split(",");
      if (cols[0]) name = cols[0].replace(/"/g, "");
    }
  } catch {
    // process already gone
  }

  console.log(`Port ${port} is in use by ${name} (PID ${pid}). Freeing it...`);
  try {
    execSync(process.platform === "win32" ? `taskkill /F /PID ${pid}` : `kill -9 ${pid}`, {
      stdio: "ignore",
      windowsHide: true,
    });
    console.log(`Killed ${pid}.`);
  } catch (err) {
    console.error(`Could not kill PID ${pid}: ${err.message}`);
    process.exit(1);
  }
}
#!/usr/bin/env node
/*
 * Deploy TrackED through Coolify and wait for the result.
 *
 * Coolify builds the configured branch from the remote repository, so this only
 * *triggers* a deployment — it does not commit or push. It refuses to run when
 * you have unpushed commits, so a deploy can never ship stale code.
 *
 *   npm run deploy                  # both applications, api first
 *   npm run deploy -- api           # tracked-api only  (backend/)
 *   npm run deploy -- web           # tracked-web only  (frontend/)
 *   npm run deploy -- --dry-run     # preflight only, triggers nothing
 *
 * The two applications are independent, so deploying only the one whose
 * directory changed is usually enough — a frontend change does not require the
 * API to be rebuilt, and vice versa.
 *
 * Requires the `coolify` CLI on PATH and authenticated (it uses its own stored
 * context, so no token lives in this repository).
 *
 * Environment:
 *   COOLIFY_APP_API     Coolify UUID for tracked-api (default: production)
 *   COOLIFY_APP_WEB     Coolify UUID for tracked-web (default: production)
 *   COOLIFY_TIMEOUT_S   Max seconds to wait per application (default 1200)
 */
import { spawnSync } from "node:child_process";

const APPS = {
  api: { uuid: process.env.COOLIFY_APP_API ?? "eflvv8s2turwoceyhqwidt5z", dir: "backend/" },
  web: { uuid: process.env.COOLIFY_APP_WEB ?? "wch2xf2obvaazogtim1advqu", dir: "frontend/" },
};
const TIMEOUT_S = Number(process.env.COOLIFY_TIMEOUT_S ?? 1200);
const POLL_MS = 5000;
const DONE = new Set(["finished", "failed", "cancelled"]);

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes("--dry-run");
const flags = argv.filter((a) => a.startsWith("-"));
const targets = argv.filter((a) => !a.startsWith("-"));

const log = (...a) => console.log(...a);
const warn = (...a) => console.warn(...a);
const die = (msg) => {
  console.error(`deploy: ${msg}`);
  process.exit(1);
};

function exec(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  if (r.error) return { missing: true, error: r.error, status: null, stdout: "", stderr: "" };
  return {
    status: r.status,
    stdout: (r.stdout ?? "").trim(),
    stderr: (r.stderr ?? "").trim(),
  };
}

function coolify(args) {
  const r = exec("coolify", args);
  if (r.missing) die("`coolify` CLI not found on PATH. Install and authenticate it first.");
  return r;
}

// The CLI prints a version banner on some commands but this one is quiet.
function deployments(name, uuid) {
  const r = coolify(["app", "deployments", "list", uuid, "--format", "json"]);
  if (r.status !== 0) die(`could not list deployments for ${name}:\n${r.stderr || r.stdout}`);
  try {
    const parsed = JSON.parse(r.stdout);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    die(`unexpected CLI output for ${name} (expected JSON):\n${r.stdout.slice(0, 300)}`);
  }
}

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

function usage() {
  log(`Usage: npm run deploy [-- api|web|both] [--dry-run]

  api        redeploy tracked-api  (backend/)
  web        redeploy tracked-web  (frontend/)
  both       redeploy both, api first (default)
  --dry-run  run the preflight checks without triggering anything`);
}

async function deployApp(name, uuid) {
  const before = new Set(deployments(name, uuid).map((d) => d.deployment_uuid));

  const trigger = coolify(["deploy", "uuid", uuid]);
  if (trigger.status !== 0) {
    die(`failed to trigger ${name}:\n${trigger.stderr || trigger.stdout}`);
  }

  const deadline = Date.now() + TIMEOUT_S * 1000;
  let dep = null;
  let last = "";

  while (Date.now() < deadline) {
    await sleep(POLL_MS);
    const list = deployments(name, uuid);

    if (!dep) {
      dep = list.find((d) => !before.has(d.deployment_uuid));
      if (dep) log(`  ${name}: ${dep.deployment_uuid} queued`);
      continue;
    }

    const d = list.find((x) => x.deployment_uuid === dep.deployment_uuid);
    if (!d) continue;

    if (d.status !== last) {
      log(`  ${name}: ${d.status}`);
      last = d.status;
    }

    if (DONE.has(d.status)) {
      if (d.status === "finished") {
        return { name, status: d.status, uuid: dep.deployment_uuid, commit: (d.commit ?? "").slice(0, 7) };
      }

      // Logs need the read:sensitive token ability, so this may be empty; the
      // deployment URL still points at the right page in the Coolify UI.
      const logs = coolify(["app", "deployments", "logs", uuid]);
      const tail = (logs.stdout || "").split("\n").slice(-25).join("\n");
      if (tail) log(`\n${tail}`);
      if (d.deployment_url) log(`Deployment page: ${d.deployment_url}`);
      return { name, status: d.status, uuid: dep.deployment_uuid, commit: (d.commit ?? "").slice(0, 7) };
    }
  }

  return { name, status: "timed out", uuid: dep?.deployment_uuid ?? "?", commit: "?" };
}

async function main() {
  if (flags.some((f) => f === "--help" || f === "-h")) return usage();

  const unknown = flags.filter((f) => f !== "--dry-run");
  if (unknown.length) die(`unknown option(s): ${unknown.join(", ")}`);

  const requested = targets.length === 0 || targets[0] === "both" ? ["api", "web"] : targets;
  for (const t of requested) {
    if (!APPS[t]) die(`unknown target '${t}' (expected api, web or both)`);
  }

  if (coolify(["version"]).status !== 0) {
    die("`coolify version` failed; check the CLI context and authentication.");
  }

  // Coolify deploys what is on the remote branch, so local commits that are not
  // pushed yet would silently not be included.
  const branch = exec("git", ["rev-parse", "--abbrev-ref", "HEAD"]).stdout || "(unknown)";
  const ahead = Number(exec("git", ["rev-list", "--count", "origin/main..HEAD"]).stdout || "0");
  if (ahead > 0) {
    die(
      `you have ${ahead} unpushed commit(s) on '${branch}'.\n` +
        "Coolify builds the remote branch, so push first (then merge, if you are not on main)."
    );
  }
  if (exec("git", ["status", "--porcelain"]).stdout) {
    warn("warning: working tree has uncommitted changes; they will NOT be deployed.");
  }

  const commit = exec("git", ["rev-parse", "--short", "origin/main"]).stdout || "?";
  log(`Deploying ${requested.join(" + ")} from origin/main (${commit})`);

  if (DRY_RUN) {
    log("Dry run: preflight passed, nothing triggered.");
    return;
  }

  const results = [];
  for (const t of requested) results.push(await deployApp(t, APPS[t].uuid));

  log("");
  for (const r of results) {
    log(`  ${r.name}: ${r.status}${r.commit !== "?" ? ` (${r.commit})` : ""} — ${r.uuid}`);
  }

  const failed = results.filter((r) => r.status !== "finished");
  if (failed.length) die(`${failed.map((r) => r.name).join(", ")} did not deploy successfully.`);
  log("\nDeployed.");
}

main().catch((e) => die(e?.message ?? String(e)));

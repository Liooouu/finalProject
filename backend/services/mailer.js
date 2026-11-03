// backend/services/mailer.js
// Thin wrapper around nodemailer. Mail is entirely optional: when no SMTP
// configuration is present (local dev, or a deploy that hasn't set a sending
// account yet) every send becomes a silent no-op. Failures are logged and
// swallowed so a mail problem can never break an API request.
//
// Configure SMTP in backend/.env locally or the API hosting environment in
// production. services/appSettings.js retains read-only legacy DB fallback.
// Message wording/layout lives in emailTemplate.js. See docs/EMAIL.md.
const nodemailer = require("nodemailer");
const { getEmailSettings } = require("./appSettings");
const { open } = require("../utils/secretBox");

let transporter = null;
let initPromise = null;
let activeSmtp = null;

function resetTransporter() {
  transporter?.close();
  transporter = null;
  initPromise = null;
  activeSmtp = null;
}

async function isMailEnabled() {
  // Kept async so callers don't need to know whether the answer came from env
  // or DB; every existing call site already awaits it or uses it in async
  // handlers. Mirrors the old env-only check: host + user + password all
  // required, password from DB (sealed) or SMTP_PASS env fallback.
  const { smtp } = await getEmailSettings();
  const password = smtp.passEncrypted ? open(smtp.passEncrypted) : process.env.SMTP_PASS || "";
  return Boolean(smtp.host && smtp.user && password);
}

function buildTransporter(smtp) {
  const port = Number(smtp.port) || 465;
  const secure =
    smtp.secure !== null && smtp.secure !== undefined
      ? Boolean(smtp.secure)
      : port === 465;

  return nodemailer.createTransport({
    host: smtp.host,
    port,
    secure,
    requireTLS: !secure,
    pool: true,
    maxConnections: 2,
    maxMessages: 50,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
    auth: {
      user: smtp.user,
      pass: smtp.password || "",
    },
  });
}

async function getTransporter() {
  if (transporter) return transporter;
  // Share one in-flight init so concurrent first sends don't race.
  if (!initPromise) {
    initPromise = (async () => {
      const { smtp } = await getEmailSettings();
      // appSettings has already chosen one coherent configuration. A sealed
      // password is present only when using the legacy migration fallback.
      const password = smtp.passEncrypted ? open(smtp.passEncrypted) : process.env.SMTP_PASS || "";

      if (!smtp.host || !smtp.user || !password) {
        return null;
      }

      transporter = buildTransporter({ ...smtp, password });
      activeSmtp = { ...smtp };
      console.log(`[mail] SMTP transport ready (${smtp.host}:${smtp.port})`);
      return transporter;
    })().catch((err) => {
      // Don't cache a failed init forever — the next send should retry.
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

async function sendMail({ to, subject, html, text }) {
  if (!to) return false;
  let tx;
  try {
    tx = await getTransporter();
  } catch (err) {
    console.error("[mail] Could not initialise SMTP:", err.code || "SMTP_ERROR");
    return false;
  }
  if (!tx) return false; // Mail not configured — nothing to do.

  try {
    // Keep the From identity paired with the cached transport credentials.
    const smtp = activeSmtp;
    const from = String(smtp.from || smtp.user).trim();
    const result = await tx.sendMail({
      from: from.includes("<") ? from : { name: "TrackED", address: from },
      ...(process.env.MAIL_REPLY_TO?.trim() ? { replyTo: process.env.MAIL_REPLY_TO.trim() } : {}),
      to,
      subject: String(subject || "TrackED notification").replace(/[\r\n]+/g, " ").trim(),
      html,
      text: text || undefined,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    // SMTP acceptance is not proof of inbox placement or that a person read it.
    if (Array.isArray(result.accepted) && result.accepted.length === 0) {
      console.error("[mail] SMTP did not accept any recipients.");
      return false;
    }
    return true;
  } catch (err) {
    // Do not log rendered messages, recipient addresses or verification codes.
    console.error("[mail] SMTP submission failed:", err.code || "SMTP_ERROR", err.responseCode || "");
    return false;
  }
}

module.exports = { sendMail, isMailEnabled, resetTransporter };

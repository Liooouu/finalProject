// backend/services/mailer.js
// Thin wrapper around nodemailer. Mail is entirely optional: when no SMTP
// configuration is present (local dev, or a deploy that hasn't set a sending
// account yet) every send becomes a silent no-op. Failures are logged and
// swallowed so a mail problem can never break an API request.
//
// Configuration comes from services/appSettings.js, which merges the admin
// Email Settings page (DB) over the SMTP_* environment variables. The
// transporter is cached; call resetTransporter() after saving settings so the
// next send picks up the new values.
const nodemailer = require("nodemailer");
const { getEmailSettings } = require("./appSettings");
const { open } = require("../utils/secretBox");

let transporter = null;
let initPromise = null;

function resetTransporter() {
  transporter = null;
  initPromise = null;
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
      // DB-sealed password wins; plain SMTP_PASS env is the fallback for deploys
      // that have never saved the Settings page.
      const password = smtp.passEncrypted ? open(smtp.passEncrypted) : process.env.SMTP_PASS || "";

      if (!smtp.host || !smtp.user || !password) {
        return null;
      }

      transporter = buildTransporter({ ...smtp, password });
      console.log(`[mail] SMTP transport ready (${smtp.host}:${smtp.port})`);
      return transporter;
    })();
  }
  return initPromise;
}

async function sendMail({ to, subject, html, text }) {
  if (!to) return false;
  const tx = await getTransporter();
  if (!tx) return false; // Mail not configured — nothing to do.

  try {
    const { smtp } = await getEmailSettings();
    await tx.sendMail({
      from: smtp.from || smtp.user,
      to,
      subject,
      html,
      text: text || undefined,
    });
    return true;
  } catch (err) {
    console.error(`[mail] Failed to send "${subject}" to ${to}:`, err.message);
    return false;
  }
}

module.exports = { sendMail, isMailEnabled, resetTransporter };

// backend/services/mailer.js
// Thin wrapper around nodemailer. Mail is entirely optional: when the SMTP
// environment variables are absent (local dev, or a deploy that hasn't set a
// sending account yet) every send becomes a silent no-op. Failures are logged
// and swallowed so a mail problem can never break an API request.
const nodemailer = require("nodemailer");

let transporter = null;
let initialized = false;

function isMailEnabled() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (initialized) return transporter;
  initialized = true;
  if (!isMailEnabled()) return null;

  const port = Number(process.env.SMTP_PORT) || 465;
  const secure =
    process.env.SMTP_SECURE !== undefined
      ? process.env.SMTP_SECURE === "true"
      : port === 465;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  console.log(`[mail] SMTP transport ready (${process.env.SMTP_HOST}:${port})`);
  return transporter;
}

async function sendMail({ to, subject, html, text }) {
  if (!to) return false;
  const tx = getTransporter();
  if (!tx) return false; // Mail not configured — nothing to do.

  try {
    await tx.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
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

module.exports = { sendMail, isMailEnabled };

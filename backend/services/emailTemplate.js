// Outgoing message wording and layout live here; SMTP credentials do not.
// Keep HTML and plain-text versions together so all email clients show the
// same dates, instructions, and security information.
const { getEmailSettings } = require("./appSettings");
const { eventStartsAt, eventEndAt, eventWindow, parseClock } = require("./eventLifecycle");

const APP_NAME = "TrackED";
const TIME_ZONE = "Asia/Manila";
const TIME_ZONE_NOTE = "All event times are in Philippine time (UTC+8).";
const HELP_NOTE = "For help, contact your event organizer or department administrator.";

const DEFAULT_TEMPLATES = {
  verification: {
    subject: `${APP_NAME}: verify your email address`,
    title: "Verify your email address",
    body: "Hi {name}, enter this code on the TrackED verification page to finish creating your account.",
  },
  passwordReset: {
    subject: `${APP_NAME}: reset your password`,
    title: "Reset your password",
    body: "Hi {name}, enter this code on the TrackED password-reset page to choose a new password.",
  },
  notification: {
    subject: `${APP_NAME}: {title}`,
    title: "{title}",
    body: "{message}",
  },
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fillTemplate(text, vars) {
  return String(text ?? "").replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key] ?? "") : match
  );
}

function newlinesToHtml(value) {
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

function safeAppUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return "";
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    const loopback = host === "localhost" || host.endsWith(".localhost") ||
      host === "localhost.localdomain" || host === "0.0.0.0" || host === "::" ||
      host === "::1" || /^127(?:\.|$)/.test(host);
    if (process.env.NODE_ENV === "production" && (url.protocol !== "https:" || loopback)) return "";
    return url.href;
  } catch {
    return "";
  }
}

function subjectLine(value) {
  return String(value ?? "").replace(/[\r\n]+/g, " ").trim();
}

function validDate(value) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value) {
  const parsed = validDate(value);
  return parsed ? new Intl.DateTimeFormat("en-PH", {
    timeZone: TIME_ZONE,
    weekday: "short", year: "numeric", month: "short", day: "numeric",
  }).format(parsed) : "";
}

function formatDateTime(value) {
  const parsed = validDate(value);
  return parsed ? new Intl.DateTimeFormat("en-PH", {
    timeZone: TIME_ZONE,
    weekday: "short", year: "numeric", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  }).format(parsed) : "";
}

function formatClock(value) {
  const clock = parseClock(value);
  if (!clock) return "";
  return `${clock.hours % 12 || 12}:${String(clock.minutes).padStart(2, "0")} ${clock.hours >= 12 ? "PM" : "AM"}`;
}

function eventDetailRows(event) {
  if (!event) return [];
  const rows = [];
  if (event.title) rows.push(["Event", event.title]);
  const date = formatDate(event.date);
  if (date) {
    rows.push(parseClock(event.time)
      ? ["Starts", formatDateTime(eventStartsAt(event))]
      : ["Date", date]);
  }
  if (validDate(event.endDate || event.date) && parseClock(event.endTime)) {
    rows.push(["Ends", formatDateTime(eventEndAt(event))]);
  }
  if (event.attendanceSessions?.length) {
    for (const session of event.attendanceSessions) {
      const prefix = event.attendanceSessions.length > 1 ? `${session.name} · ` : '';
      rows.push([`${prefix}Time In`, `${formatDateTime(session.timeInOpen)} – ${formatDateTime(session.timeInCutoff)}`]);
      rows.push([`${prefix}Time Out`, `${formatDateTime(session.timeOutOpen)} – ${formatDateTime(session.timeOutClose)}`]);
    }
  } else {
    const window = eventWindow(event);
    if (window) rows.push(["Time In", `${formatDateTime(window.start)} – ${formatDateTime(window.end)}`]);
    rows.push(["Time Out", "Not required for this older event"]);
  }
  if (event.location) rows.push(["Venue", event.location]);
  return rows;
}

// Existing saved template overrides remain supported, field by field.
function resolveTemplate(kind, settings) {
  const stored = settings.templates?.[kind] || {};
  const defaults = DEFAULT_TEMPLATES[kind];
  return Object.fromEntries(["subject", "title", "body"].map((key) => [
    key, String(stored[key] ?? "").trim() || defaults[key],
  ]));
}

function paragraph(value, color = "#374151") {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${color};overflow-wrap:anywhere;">${newlinesToHtml(value)}</p>`;
}

function wrapCard({ title, bodyHtml, middleHtml = "", appUrl, footer, preheader }) {
  const link = appUrl
    ? `<p style="margin:22px 0 0;"><a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;line-height:1.4;padding:12px 22px;border-radius:8px;">Open ${APP_NAME}</a></p>`
    : "";
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${APP_NAME}</title></head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(String(preheader || title).replace(/\s+/g, " ").slice(0, 160))}</div>
    <table role="presentation" style="width:100%;border-collapse:collapse;background:#f3f4f6;"><tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" style="width:100%;max-width:560px;border-collapse:collapse;"><tr><td style="background:#ffffff;border:1px solid #dfe3eb;border-radius:12px;padding:26px 22px;">
        <p style="margin:0 0 18px;font-size:15px;line-height:1.4;color:#4f46e5;font-weight:700;">${APP_NAME}</p>
        <h1 style="margin:0 0 16px;font-size:23px;line-height:1.3;color:#111827;overflow-wrap:anywhere;">${newlinesToHtml(title)}</h1>
        ${bodyHtml}
        ${middleHtml}
        ${link}
      </td></tr><tr><td style="padding:16px 8px 0;">${paragraph(footer, "#596273")}</td></tr></table>
    </td></tr></table>
  </body>
</html>`;
}

async function renderNotificationEmail({ title, message, event }) {
  const settings = await getEmailSettings();
  const appUrl = safeAppUrl(settings.smtp?.appUrl);
  const tpl = resolveTemplate("notification", settings);
  const start = formatClock(event?.time);
  const end = formatClock(event?.endTime);
  const vars = {
    title: String(title || "Account notification"),
    message: message ?? "",
    url: appUrl,
    eventTitle: event?.title ?? "",
    eventDate: formatDate(event?.date),
    eventTime: start && end ? `${start} – ${end}` : start,
    eventEndDate: formatDate(event?.endDate || event?.date),
    eventEndTime: end,
    eventLocation: event?.location ?? "",
  };
  const subject = subjectLine(fillTemplate(tpl.subject, vars));
  const finalTitle = fillTemplate(tpl.title, vars);
  const body = fillTemplate(tpl.body, vars);
  const details = eventDetailRows(event);
  const timeNote = details.some(([label]) => ["Starts", "Ends"].includes(label) || label.includes("Time In")) ? TIME_ZONE_NOTE : "";
  const recordNote = "Open TrackED to view your latest notifications and attendance records.";
  const footer = `This notification was sent for your ${APP_NAME} account. ${HELP_NOTE}`;
  const rowsHtml = details.map(([label, value]) => `<tr>
    <th scope="row" style="padding:7px 12px 7px 0;text-align:left;color:#596273;font-size:14px;line-height:1.5;font-weight:400;vertical-align:top;">${escapeHtml(label)}</th>
    <td style="padding:7px 0;color:#111827;font-size:14px;line-height:1.5;vertical-align:top;overflow-wrap:anywhere;">${escapeHtml(value)}</td>
  </tr>`).join("");
  const html = wrapCard({
    title: finalTitle,
    bodyHtml: body ? paragraph(body) : "",
    middleHtml: `${rowsHtml ? `<table style="margin:12px 0 16px;border-collapse:collapse;width:100%;">${rowsHtml}</table>` : ""}${timeNote ? paragraph(timeNote, "#596273") : ""}${paragraph(recordNote, "#596273")}`,
    appUrl, footer, preheader: body,
  });
  const text = [
    finalTitle, body,
    details.map(([label, value]) => `${label}: ${value}`).join("\n"),
    timeNote, recordNote, appUrl && `Open ${APP_NAME}: ${appUrl}`, footer,
  ].filter(Boolean).join("\n\n");
  return { subject, html, text };
}

async function renderCodeEmail(kind, { name, code }) {
  const settings = await getEmailSettings();
  const appUrl = safeAppUrl(settings.smtp?.appUrl);
  const tpl = resolveTemplate(kind, settings);
  const vars = { name: String(name || "there"), code: String(code ?? ""), url: appUrl };
  const subject = subjectLine(fillTemplate(tpl.subject, vars));
  const title = fillTemplate(tpl.title, vars);
  const body = fillTemplate(tpl.body, vars);
  const codeInCopy = /\{code\}/.test(tpl.title) || /\{code\}/.test(tpl.body);
  const expiry = "This code expires in 10 minutes. Use only the most recent code you requested.";
  const security = "Do not share this code. TrackED organizers and administrators do not need your verification or password-reset code.";
  const ignore = kind === "passwordReset"
    ? "If you did not request a password reset, ignore this email. Your password will stay unchanged."
    : "If you did not try to create a TrackED account, ignore this email.";
  const footer = kind === "passwordReset"
    ? `This email was sent because a password reset was requested for your ${APP_NAME} account. ${HELP_NOTE}`
    : `This email was sent because this address was used to register for ${APP_NAME}. ${HELP_NOTE}`;
  const codeHtml = codeInCopy ? "" : `<div style="margin:20px 0;padding:18px 12px;border:1px solid #c7d2fe;border-radius:8px;background:#eef2ff;text-align:center;"><span style="font-family:Consolas,monospace;font-size:32px;line-height:1.3;font-weight:700;letter-spacing:5px;color:#312e81;">${escapeHtml(vars.code)}</span></div>`;
  const html = wrapCard({
    title,
    bodyHtml: paragraph(body),
    middleHtml: `${codeHtml}${paragraph(expiry)}${paragraph(security, "#596273")}${paragraph(ignore, "#596273")}`,
    appUrl, footer, preheader: kind === "passwordReset"
      ? "A password-reset code was requested for your TrackED account."
      : "Confirm your email address to create your TrackED account.",
  });
  const text = [title, body, !codeInCopy && vars.code, expiry, security, ignore, appUrl && `Open ${APP_NAME}: ${appUrl}`, footer].filter(Boolean).join("\n\n");
  return { subject, html, text };
}

async function renderVerificationEmail(data) {
  return renderCodeEmail("verification", data);
}

async function renderPasswordResetEmail(data) {
  return renderCodeEmail("passwordReset", data);
}

module.exports = {
  renderNotificationEmail,
  renderVerificationEmail,
  renderPasswordResetEmail,
  DEFAULT_TEMPLATES,
};

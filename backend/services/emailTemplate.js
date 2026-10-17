// backend/services/emailTemplate.js
// Shared HTML/text bodies for outgoing emails. The card chrome (white card,
// TrackED eyebrow, indigo CTA, dashed code box, footer) is fixed; the admin
// Email Settings page can edit each email's subject, heading (title), and
// intro paragraph (body) with {placeholder} tokens. Unset/empty fields fall
// back to the built-in defaults below, which reproduce the original wording.
// Styling is inline because most email clients strip <style> blocks.
const { getEmailSettings } = require("./appSettings");

const APP_NAME = "TrackED";

const DEFAULT_TEMPLATES = {
  verification: {
    subject: `Your ${APP_NAME} verification code`,
    title: "Verify your email address",
    body: "Hi {name}, use the code below to finish creating your account.",
  },
  passwordReset: {
    subject: `Your ${APP_NAME} password reset code`,
    title: "Reset your password",
    body: "Hi {name}, use the code below to choose a new password for your account.",
  },
  notification: {
    subject: `[${APP_NAME}] {title}`,
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

// Substitute {placeholder} tokens. Unknown tokens are left as-is so a typo is
// visible instead of silently becoming empty.
function fillTemplate(text, vars) {
  return String(text ?? "").replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key] ?? "") : match
  );
}

function newlinesToHtml(value) {
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

function formatDate(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function eventDetailRows(event) {
  if (!event) return [];
  const rows = [];
  if (event.title) rows.push(["Event", event.title]);
  const date = formatDate(event.date);
  if (date) rows.push(["Date", date]);
  if (event.time) {
    rows.push(["Time", event.endTime ? `${event.time} – ${event.endTime}` : event.time]);
  }
  if (event.location) rows.push(["Location", event.location]);
  return rows;
}

// Merge a stored template block over the built-in default (field-by-field).
async function resolveTemplate(kind) {
  const { templates } = await getEmailSettings();
  const stored = templates?.[kind] || {};
  const defaults = DEFAULT_TEMPLATES[kind];
  return {
    subject: (stored.subject || "").trim() || defaults.subject,
    title: (stored.title || "").trim() || defaults.title,
    body: (stored.body || "").trim() || defaults.body,
  };
}

function ctaButton(appUrl) {
  return appUrl
    ? `<a href="${escapeHtml(appUrl)}" style="display:inline-block;margin-top:22px;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 22px;border-radius:10px;">Open ${APP_NAME}</a>`
    : "";
}

function wrapCard({ eyebrow, titleHtml, bodyHtml, middleHtml, appUrl, footer }) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;padding:28px 16px;">
      <div style="background:#ffffff;border-radius:16px;padding:28px;border:1px solid #e5e7eb;">
        <p style="margin:0 0 18px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#4f46e5;font-weight:700;">${eyebrow}</p>
        <h1 style="margin:0 0 12px;font-size:20px;color:#111827;">${titleHtml}</h1>
        ${bodyHtml}
        ${middleHtml || ""}
        ${ctaButton(appUrl)}
      </div>
      <p style="margin:16px 0 0;text-align:center;font-size:12px;color:#9ca3af;">${footer || `You are receiving this because you have a ${APP_NAME} account. Please do not reply to this email.`}</p>
    </div>
  </body>
</html>`;
}

// General notification email (event live, marked late/absent, excuses, ...).
async function renderNotificationEmail({ title, message, event }) {
  const tpl = await resolveTemplate("notification");
  const vars = {
    title: title ?? "",
    message: message ?? "",
    url: "",
    eventTitle: event?.title ?? "",
    eventDate: event?.date ? formatDate(event.date) : "",
    eventTime: event?.endTime && event?.time ? `${event.time} – ${event.endTime}` : event?.time ?? "",
    eventLocation: event?.location ?? "",
  };

  const subject = fillTemplate(tpl.subject, vars);
  const finalTitle = fillTemplate(tpl.title, vars);
  const body = fillTemplate(tpl.body, vars);

  const details = eventDetailRows(event);
  const rowsHtml = details
    .map(
      ([label, value]) => `
          <tr>
            <td style="padding:6px 14px 6px 0;color:#6b7280;font-size:14px;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
            <td style="padding:6px 0;color:#111827;font-size:14px;">${escapeHtml(value)}</td>
          </tr>`
    )
    .join("");

  const html = wrapCard({
    eyebrow: APP_NAME,
    titleHtml: newlinesToHtml(finalTitle),
    bodyHtml: body ? `<p style="margin:0;font-size:15px;line-height:1.6;color:#374151;">${newlinesToHtml(body)}</p>` : "",
    middleHtml: rowsHtml ? `<table style="margin-top:18px;border-collapse:collapse;width:100%;">${rowsHtml}</table>` : "",
    appUrl: (await getEmailSettings()).smtp.appUrl,
  });

  const textDetails = details.map(([label, value]) => `${label}: ${value}`).join("\n");
  const appUrl = (await getEmailSettings()).smtp.appUrl;
  const text = `${finalTitle}\n\n${body}${textDetails ? `\n\n${textDetails}` : ""}${
    appUrl ? `\n\nOpen ${APP_NAME}: ${appUrl}` : ""
  }`;

  return { subject, html, text };
}

// Signup email-verification email. The code is only ever shown here, so it must
// survive as readable text (no images, no JS).
async function renderVerificationEmail({ name, code }) {
  const tpl = await resolveTemplate("verification");
  const { smtp } = await getEmailSettings();
  const vars = { name: name ?? "", code: code ?? "", url: smtp.appUrl || "" };

  const subject = fillTemplate(tpl.subject, vars);
  const title = fillTemplate(tpl.title, vars);
  const body = fillTemplate(tpl.body, vars);
  const greeting = vars.name ? `Hi ${escapeHtml(vars.name)},` : "Hi,";

  const html = wrapCard({
    eyebrow: APP_NAME,
    titleHtml: newlinesToHtml(title),
    bodyHtml: body
      ? `<p style="margin:0;font-size:15px;line-height:1.6;color:#374151;">${newlinesToHtml(body)}</p>`
      : `<p style="margin:0;font-size:15px;line-height:1.6;color:#374151;">${greeting} use the code below to finish creating your ${APP_NAME} account.</p>`,
    middleHtml: `
        <div style="margin:22px 0;padding:16px;border-radius:12px;border:1px dashed #a5b4fc;background:#eef2ff;text-align:center;">
          <span style="font-size:32px;font-weight:700;letter-spacing:.35em;color:#312e81;">${escapeHtml(code)}</span>
        </div>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#6b7280;">This code expires in 10 minutes. If you didn't try to create an account, you can ignore this email.</p>`,
    appUrl: smtp.appUrl,
    footer: `You are receiving this because someone used this address to sign up for ${APP_NAME}. Please do not reply to this email.`,
  });

  const text = `${title}\n\n${body || `${greeting} use the code below to finish creating your ${APP_NAME} account.`}\n\n    ${code}\n\nThis code expires in 10 minutes. If you didn't try to create an account, you can ignore this email.${
    smtp.appUrl ? `\n\nOpen ${APP_NAME}: ${smtp.appUrl}` : ""
  }`;

  return { subject, html, text };
}

// Password-reset email ("Forgot Password?"). Shares the code layout with the
// verification email, but the copy tells the recipient this is a password
// change and what to do if they didn't ask for it.
async function renderPasswordResetEmail({ name, code }) {
  const tpl = await resolveTemplate("passwordReset");
  const { smtp } = await getEmailSettings();
  const vars = { name: name ?? "", code: code ?? "", url: smtp.appUrl || "" };

  const subject = fillTemplate(tpl.subject, vars);
  const title = fillTemplate(tpl.title, vars);
  const body = fillTemplate(tpl.body, vars);
  const greeting = vars.name ? `Hi ${escapeHtml(vars.name)},` : "Hi,";

  const html = wrapCard({
    eyebrow: APP_NAME,
    titleHtml: newlinesToHtml(title),
    bodyHtml: body
      ? `<p style="margin:0;font-size:15px;line-height:1.6;color:#374151;">${newlinesToHtml(body)}</p>`
      : `<p style="margin:0;font-size:15px;line-height:1.6;color:#374151;">${greeting} use the code below to choose a new password for your ${APP_NAME} account.</p>`,
    middleHtml: `
        <div style="margin:22px 0;padding:16px;border-radius:12px;border:1px dashed #a5b4fc;background:#eef2ff;text-align:center;">
          <span style="font-size:32px;font-weight:700;letter-spacing:.35em;color:#312e81;">${escapeHtml(code)}</span>
        </div>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#6b7280;">This code expires in 10 minutes. If you didn't try to reset your password, you can safely ignore this email — your password stays unchanged.</p>`,
    appUrl: smtp.appUrl,
    footer: `You are receiving this because a password reset was requested for this ${APP_NAME} account. Please do not reply to this email.`,
  });

  const text = `${title}\n\n${body || `${greeting} use the code below to choose a new password for your ${APP_NAME} account.`}\n\n    ${code}\n\nThis code expires in 10 minutes. If you didn't try to reset your password, you can safely ignore this email — your password stays unchanged.${
    smtp.appUrl ? `\n\nOpen ${APP_NAME}: ${smtp.appUrl}` : ""
  }`;

  return { subject, html, text };
}

module.exports = {
  renderNotificationEmail,
  renderVerificationEmail,
  renderPasswordResetEmail,
  DEFAULT_TEMPLATES,
};

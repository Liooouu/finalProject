// backend/services/emailTemplate.js
// Shared HTML/text body for notification emails. Styling is inline because most
// email clients strip <style> blocks.
const APP_NAME = "TrackED";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function appUrl() {
  return (process.env.APP_URL || "").replace(/\/+$/, "");
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

function renderNotificationEmail({ title, message, event }) {
  const url = appUrl();
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

  const ctaHtml = url
    ? `<a href="${url}" style="display:inline-block;margin-top:22px;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 22px;border-radius:10px;">Open ${APP_NAME}</a>`
    : "";

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;padding:28px 16px;">
      <div style="background:#ffffff;border-radius:16px;padding:28px;border:1px solid #e5e7eb;">
        <p style="margin:0 0 18px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#4f46e5;font-weight:700;">${APP_NAME}</p>
        <h1 style="margin:0 0 12px;font-size:20px;color:#111827;">${escapeHtml(title)}</h1>
        <p style="margin:0;font-size:15px;line-height:1.6;color:#374151;">${escapeHtml(message)}</p>
        ${rowsHtml ? `<table style="margin-top:18px;border-collapse:collapse;width:100%;">${rowsHtml}</table>` : ""}
        ${ctaHtml}
      </div>
      <p style="margin:16px 0 0;text-align:center;font-size:12px;color:#9ca3af;">You are receiving this because you have a ${APP_NAME} account. Please do not reply to this email.</p>
    </div>
  </body>
</html>`;

  const textDetails = details.map(([label, value]) => `${label}: ${value}`).join("\n");
  const text = `${title}\n\n${message}${textDetails ? `\n\n${textDetails}` : ""}${
    url ? `\n\nOpen ${APP_NAME}: ${url}` : ""
  }`;

  return { html, text };
}

// Signup email-verification email. The code is only ever shown here, so it must
// survive as readable text (no images, no JS).
function renderVerificationEmail({ name, code }) {
  const url = appUrl();
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  const safeCode = escapeHtml(code);

  const ctaHtml = url
    ? `<a href="${url}" style="display:inline-block;margin-top:22px;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 22px;border-radius:10px;">Open ${APP_NAME}</a>`
    : "";

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;padding:28px 16px;">
      <div style="background:#ffffff;border-radius:16px;padding:28px;border:1px solid #e5e7eb;">
        <p style="margin:0 0 18px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#4f46e5;font-weight:700;">${APP_NAME}</p>
        <h1 style="margin:0 0 12px;font-size:20px;color:#111827;">Verify your email address</h1>
        <p style="margin:0;font-size:15px;line-height:1.6;color:#374151;">${greeting} Use the code below to finish creating your ${APP_NAME} account.</p>
        <div style="margin:22px 0;padding:16px;border-radius:12px;border:1px dashed #a5b4fc;background:#eef2ff;text-align:center;">
          <span style="font-size:32px;font-weight:700;letter-spacing:.35em;color:#312e81;">${safeCode}</span>
        </div>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#6b7280;">This code expires in 10 minutes. If you didn't try to create an account, you can ignore this email.</p>
        ${ctaHtml}
      </div>
      <p style="margin:16px 0 0;text-align:center;font-size:12px;color:#9ca3af;">You are receiving this because someone used this address to sign up for ${APP_NAME}. Please do not reply to this email.</p>
    </div>
  </body>
</html>`;

  const text = `Verify your email address\n\n${greeting} Use the code below to finish creating your ${APP_NAME} account.\n\n    ${code}\n\nThis code expires in 10 minutes. If you didn't try to create an account, you can ignore this email.${
    url ? `\n\nOpen ${APP_NAME}: ${url}` : ""
  }`;

  return { html, text };
}

// Password-reset email ("Forgot Password?"). Shares the code layout with the
// verification email, but the copy tells the recipient this is a password
// change and what to do if they didn't ask for it.
function renderPasswordResetEmail({ name, code }) {
  const url = appUrl();
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  const safeCode = escapeHtml(code);

  const ctaHtml = url
    ? `<a href="${url}" style="display:inline-block;margin-top:22px;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 22px;border-radius:10px;">Open ${APP_NAME}</a>`
    : "";

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;padding:28px 16px;">
      <div style="background:#ffffff;border-radius:16px;padding:28px;border:1px solid #e5e7eb;">
        <p style="margin:0 0 18px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#4f46e5;font-weight:700;">${APP_NAME}</p>
        <h1 style="margin:0 0 12px;font-size:20px;color:#111827;">Reset your password</h1>
        <p style="margin:0;font-size:15px;line-height:1.6;color:#374151;">${greeting} Use the code below to choose a new password for your ${APP_NAME} account.</p>
        <div style="margin:22px 0;padding:16px;border-radius:12px;border:1px dashed #a5b4fc;background:#eef2ff;text-align:center;">
          <span style="font-size:32px;font-weight:700;letter-spacing:.35em;color:#312e81;">${safeCode}</span>
        </div>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#6b7280;">This code expires in 10 minutes. If you didn't try to reset your password, you can safely ignore this email — your password stays unchanged.</p>
        ${ctaHtml}
      </div>
      <p style="margin:16px 0 0;text-align:center;font-size:12px;color:#9ca3af;">You are receiving this because a password reset was requested for this ${APP_NAME} account. Please do not reply to this email.</p>
    </div>
  </body>
</html>`;

  const text = `Reset your password\n\n${greeting} Use the code below to choose a new password for your ${APP_NAME} account.\n\n    ${code}\n\nThis code expires in 10 minutes. If you didn't try to reset your password, you can safely ignore this email — your password stays unchanged.${
    url ? `\n\nOpen ${APP_NAME}: ${url}` : ""
  }`;

  return { html, text };
}

module.exports = { renderNotificationEmail, renderVerificationEmail, renderPasswordResetEmail };

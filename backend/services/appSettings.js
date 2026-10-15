// backend/services/appSettings.js
// Loads the admin-editable email settings (models/Setting.js, key "email") and
// merges them over the SMTP_* / MAIL_FROM / APP_URL environment variables.
// Empty DB fields fall through to env, so the page is additive: a deploy that
// never saves keeps the old behavior. The document is cached for a short TTL
// and invalidated explicitly via invalidateEmailSettings() after a save.
const Setting = require("../models/Setting");

const CACHE_TTL_MS = 30 * 1000;
const EMAIL_KEY = "email";

let cache = null;
let cacheAt = 0;

function invalidateEmailSettings() {
  cache = null;
  cacheAt = 0;
}

async function loadEmailSettingDoc() {
  const now = Date.now();
  if (cache && now - cacheAt < CACHE_TTL_MS) return cache;
  cache = await Setting.findOne({ key: EMAIL_KEY });
  cacheAt = now;
  return cache;
}

// Effective SMTP + template settings, env-backed. `templates` always contains
// all three blocks (possibly empty strings meaning "use built-in default").
async function getEmailSettings() {
  const doc = await loadEmailSettingDoc();
  const s = doc?.smtp || {};
  const t = doc?.templates || {};

  return {
    smtp: {
      host: s.host || process.env.SMTP_HOST || "",
      port: s.port ?? (Number(process.env.SMTP_PORT) || 465),
      secure:
        s.secure !== null && s.secure !== undefined
          ? Boolean(s.secure)
          : process.env.SMTP_SECURE !== undefined
            ? process.env.SMTP_SECURE === "true"
            : (Number(process.env.SMTP_PORT) || 465) === 465,
      user: s.user || process.env.SMTP_USER || "",
      // Sealed AES value from the DB; empty when only env is configured
      // (env passwords are plain and handled by the caller as a fallback).
      passEncrypted: s.passEncrypted || "",
      from: s.from || process.env.MAIL_FROM || "",
      appUrl: s.appUrl || process.env.APP_URL || "",
    },
    templates: {
      verification: t.verification || {},
      passwordReset: t.passwordReset || {},
      notification: t.notification || {},
    },
    updatedBy: doc?.updatedBy || null,
    updatedAt: doc?.updatedAt || null,
  };
}

// Raw DB values (no env merge) for the settings page, with the secret stripped.
async function getRawEmailSetting() {
  const doc = await loadEmailSettingDoc();
  if (!doc) {
    return {
      smtp: { host: "", port: null, secure: null, user: "", from: "", appUrl: "" },
      templates: { verification: {}, passwordReset: {}, notification: {} },
      hasSmtpPassword: false,
      updatedBy: null,
      updatedAt: null,
    };
  }
  return {
    smtp: {
      host: doc.smtp?.host || "",
      port: doc.smtp?.port ?? null,
      secure: doc.smtp?.secure ?? null,
      user: doc.smtp?.user || "",
      from: doc.smtp?.from || "",
      appUrl: doc.smtp?.appUrl || "",
    },
    templates: {
      verification: doc.templates?.verification || {},
      passwordReset: doc.templates?.passwordReset || {},
      notification: doc.templates?.notification || {},
    },
    hasSmtpPassword: Boolean(doc.smtp?.passEncrypted),
    updatedBy: doc.updatedBy || null,
    updatedAt: doc.updatedAt || null,
  };
}

// Persist partial updates. `passEncrypted` is passed pre-sealed (or "" to
// clear). Returns the sanitized raw view afterwards.
async function saveEmailSetting(patch, updatedBy) {
  const update = { $set: { updatedBy } };
  const set = {};

  for (const field of ["host", "port", "secure", "user", "from", "appUrl", "passEncrypted"]) {
    if (patch.smtp && patch.smtp[field] !== undefined) {
      set[`smtp.${field}`] = patch.smtp[field];
    }
  }
  for (const key of ["verification", "passwordReset", "notification"]) {
    const block = patch.templates?.[key];
    if (!block) continue;
    for (const field of ["subject", "title", "body"]) {
      if (block[field] !== undefined) {
        set[`templates.${key}.${field}`] = block[field];
      }
    }
  }
  if (Object.keys(set).length) update.$set = { ...update.$set, ...set };

  await Setting.findOneAndUpdate(
    { key: EMAIL_KEY },
    { $setOnInsert: { key: EMAIL_KEY }, ...update },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  invalidateEmailSettings();
  return getRawEmailSetting();
}

module.exports = {
  EMAIL_KEY,
  getEmailSettings,
  getRawEmailSetting,
  saveEmailSetting,
  invalidateEmailSettings,
};

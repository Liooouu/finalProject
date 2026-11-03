// backend/services/appSettings.js
// Email configuration is maintained in backend/.env locally and in the API's
// hosting environment in production. A complete environment configuration wins
// as one unit, so a saved database override cannot silently replace it.
// Previously saved SMTP credentials remain a read-only migration fallback;
// existing installations keep sending until their maintainer moves them.
// Historical template overrides are still supported. See docs/EMAIL.md.
const Setting = require("../models/Setting");
const mongoose = require("mongoose");

const CACHE_TTL_MS = 30 * 1000;
const EMAIL_KEY = "email";

let cache = null;
let cacheAt = 0;
// Distinguishes "loaded and found nothing" from "never loaded". Without it a
// null cache re-queries on every call.
let cacheLoaded = false;

function invalidateEmailSettings() {
  cache = null;
  cacheAt = 0;
  cacheLoaded = false;
}

async function loadEmailSettingDoc() {
  const now = Date.now();
  if (cacheLoaded && now - cacheAt < CACHE_TTL_MS) return cache;

  // Skip the query entirely when the connection isn't ready. Mongoose would
  // otherwise buffer the findOne for ~10s and then reject, stalling the
  // /api/health probe past its timeout. Env fallback applies instead, and
  // nothing is cached so the read resumes once the database is back.
  if (mongoose.connection.readyState !== 1) {
    return null;
  }

  try {
    cache = await Setting.findOne({ key: EMAIL_KEY });
  } catch (err) {
    // The database dropped mid-query. Never let this rejection escape: it would
    // propagate into isMailEnabled() and the async /api/health handler, which
    // Express 4 does not catch, leaving the probe hanging until it times out.
    // Falling back to an empty doc means settings resolve from env vars only.
    console.error(
      "[settings] Could not read email settings from the database:",
      err.message
    );
    cache = null;
  }
  cacheAt = now;
  cacheLoaded = true;
  return cache;
}

// Do not combine a legacy SMTP host/user with another provider's env password.
// APP_URL is independent: the hosting variable always wins over a saved URL.
async function getEmailSettings() {
  const doc = await loadEmailSettingDoc();
  const s = doc?.smtp || {};
  const t = doc?.templates || {};
  const envHost = (process.env.SMTP_HOST || "").trim();
  const envUser = (process.env.SMTP_USER || "").trim();
  const envPort = Number(process.env.SMTP_PORT) || 465;
  const completeEnvironment = Boolean(envHost && envUser && process.env.SMTP_PASS);
  const useLegacy = !completeEnvironment && Boolean(s.host && s.user && s.passEncrypted);
  const port = useLegacy ? s.port ?? envPort : envPort;

  return {
    smtp: {
      host: useLegacy ? s.host : envHost,
      port,
      secure:
        useLegacy && s.secure !== null && s.secure !== undefined
          ? Boolean(s.secure)
          : !useLegacy && process.env.SMTP_SECURE !== undefined
            ? process.env.SMTP_SECURE === "true"
            : port === 465,
      user: useLegacy ? s.user : envUser,
      // Sealed AES value from the DB; empty when only env is configured
      // (env passwords are plain and handled by the caller as a fallback).
      passEncrypted: useLegacy ? s.passEncrypted : "",
      from: useLegacy ? s.from || s.user : (process.env.MAIL_FROM || "").trim(),
      appUrl: (process.env.APP_URL || "").trim() || s.appUrl || "",
    },
    configurationSource: useLegacy ? "legacy-database" : "environment",
    templates: {
      verification: t.verification || {},
      passwordReset: t.passwordReset || {},
      notification: t.notification || {},
    },
    updatedBy: doc?.updatedBy || null,
    updatedAt: doc?.updatedAt || null,
  };
}

module.exports = {
  EMAIL_KEY,
  getEmailSettings,
  invalidateEmailSettings,
};

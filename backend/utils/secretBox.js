// backend/utils/secretBox.js
// AES-256-GCM encryption for small secrets at rest (currently the SMTP
// password saved from the admin Email Settings page). The key is derived from
// the existing JWT_SECRET so no new environment variable is needed. Format of
// a sealed value: "iv:authTag:ciphertext", all base64.
const crypto = require("crypto");

function getKey() {
  const secret = process.env.JWT_SECRET || "";
  if (!secret) throw new Error("JWT_SECRET is required to encrypt secrets");
  return crypto.createHash("sha256").update(secret).digest();
}

function seal(plain) {
  if (!plain) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

function open(sealed) {
  if (!sealed) return "";
  try {
    const [ivB64, tagB64, dataB64] = String(sealed).split(":");
    if (!ivB64 || !tagB64 || !dataB64) return "";
    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // Wrong key or corrupted value — treat as "not set" rather than crashing.
    return "";
  }
}

module.exports = { seal, open };

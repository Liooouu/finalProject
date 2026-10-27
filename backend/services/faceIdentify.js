// services/faceIdentify.js
// 1:N face identification for the attendance kiosk.
//
// The 1:1 verifier (faceMatcher.descriptorsMatch) answers "is this the person
// we already think it is?" — a loose threshold is safe there because the
// identity is known. Identification is the opposite question: "which of every
// enrolled student is this?" A single loose threshold would eventually mark a
// lookalike present. So a match must clear two bars:
//
//   1. distance <= FACE_IDENTIFY_THRESHOLD (default 0.45, stricter than 0.5)
//   2. the runner-up must be further away by FACE_IDENTIFY_MARGIN (default 0.06)
//
// When the second bar fails the face is "ambiguous" and the kiosk tells the
// student to see the organizer instead of guessing.
const User = require("../models/User");

const DESCRIPTOR_LENGTH = 128;
const INDEX_MAX_AGE_MS = 5 * 60 * 1000;

const threshold = () => parseFloat(process.env.FACE_IDENTIFY_THRESHOLD || "0.45");
const margin = () => parseFloat(process.env.FACE_IDENTIFY_MARGIN || "0.06");

let index = new Map();
let loadedAt = 0;
let refreshPromise = null;

function toEntry(user) {
  return {
    id: String(user._id),
    name: user.name,
    program: user.program || "",
    yearLevel: user.yearLevel ?? null,
    section: user.section || "",
    enrollmentVersion: user.faceEnrollmentVersion || 0,
    descriptor: Float64Array.from(user.faceDescriptor),
  };
}

async function refresh() {
  const users = await User.find({
    role: "student",
    faceEnrolledAt: { $ne: null },
    faceConsentAt: { $ne: null },
    "faceDescriptor.127": { $exists: true },
  })
    .select("_id name program yearLevel section faceDescriptor faceEnrollmentVersion")
    .lean();

  const next = new Map();
  for (const user of users) {
    if (!Array.isArray(user.faceDescriptor) || user.faceDescriptor.length !== DESCRIPTOR_LENGTH) {
      continue;
    }
    if (!user.faceDescriptor.every((n) => Number.isFinite(n))) continue;
    next.set(String(user._id), toEntry(user));
  }

  index = next;
  loadedAt = Date.now();
  return index.size;
}

// Reload when the cache is older than five minutes. Enrollments also call
// upsert() so a newly registered face is usable immediately.
async function ensureFresh() {
  if (index.size > 0 && Date.now() - loadedAt < INDEX_MAX_AGE_MS) return index.size;
  if (refreshPromise) return refreshPromise;
  refreshPromise = refresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

function upsert(user) {
  if (!user || !Array.isArray(user.faceDescriptor)) return remove(user?._id);
  if (user.role !== "student" || !user.faceEnrolledAt || !user.faceConsentAt) return remove(user._id);
  if (user.faceDescriptor.length !== DESCRIPTOR_LENGTH) return remove(user._id);
  if (!user.faceDescriptor.every((n) => Number.isFinite(n))) return remove(user._id);
  index.set(String(user._id), toEntry(user));
}

function remove(userId) {
  if (!userId) return;
  index.delete(String(userId));
}

function distance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

function isValidDescriptor(value) {
  return (
    Array.isArray(value) &&
    value.length === DESCRIPTOR_LENGTH &&
    value.every((n) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) < 20)
  );
}

// Identify a probe descriptor. Returns:
//   { result: "match", student, distance, secondDistance }
//   { result: "ambiguous", distance, secondDistance }
//   { result: "unknown", distance }
//   { result: "empty" }
async function identify(descriptor) {
  if (!isValidDescriptor(descriptor)) {
    return { result: "invalid" };
  }
  await ensureFresh();

  if (index.size === 0) return { result: "empty" };

  const probe = Float64Array.from(descriptor);
  let best = null;
  let secondDistance = Infinity;

  for (const entry of index.values()) {
    const d = distance(probe, entry.descriptor);
    if (!best || d < best.distance) {
      secondDistance = best ? best.distance : Infinity;
      best = { entry, distance: d };
    } else if (d < secondDistance) {
      secondDistance = d;
    }
  }

  if (!best) return { result: "unknown" };
  if (best.distance > threshold()) {
    return { result: "unknown", distance: best.distance };
  }
  if (secondDistance !== Infinity && secondDistance - best.distance < margin()) {
    return { result: "ambiguous", distance: best.distance, secondDistance };
  }

  return {
    result: "match",
    student: {
      id: best.entry.id,
      name: best.entry.name,
      program: best.entry.program,
      yearLevel: best.entry.yearLevel,
      section: best.entry.section,
      enrollmentVersion: best.entry.enrollmentVersion,
    },
    distance: best.distance,
    secondDistance,
  };
}

function size() {
  return index.size;
}

function clear() {
  index = new Map();
  loadedAt = 0;
}

module.exports = {
  DESCRIPTOR_LENGTH,
  isValidDescriptor,
  refresh,
  ensureFresh,
  upsert,
  remove,
  identify,
  size,
  clear,
};

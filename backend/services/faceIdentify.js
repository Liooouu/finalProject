// services/faceIdentify.js
// 1:N face identification for the attendance kiosk.
//
// The 1:1 verifier (faceMatcher.descriptorsMatch) answers "is this the person
// we already think it is?" Identification is a different question: "which of every
// enrolled student is this?" A single loose threshold would eventually mark a
// lookalike present. So a match must clear two bars:
//
//   1. distance <= FACE_IDENTIFY_THRESHOLD (default and maximum 0.40)
//   2. runner-up separation >= FACE_IDENTIFY_MARGIN (default/minimum 0.10)
//   3. refuse near-colliding enrolled references; require two stable probes
//
// When the second bar fails the face is "ambiguous" and the kiosk tells the
// student to see the organizer instead of guessing.
const User = require("../models/User");
const { activeStudentFilter, isActiveStudent } = require("./studentEligibility");

const DESCRIPTOR_LENGTH = 128;
const INDEX_MAX_AGE_MS = 5 * 60 * 1000;

// Invalid or permissive deployment values must never disable rejection.
function safeSetting(name, fallback, minimum, maximum) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= minimum && value <= maximum ? value : fallback;
}
const threshold = () => safeSetting("FACE_IDENTIFY_THRESHOLD", 0.40, 0.1, 0.40);
const margin = () => safeSetting("FACE_IDENTIFY_MARGIN", 0.10, 0.10, 1);

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
    ...activeStudentFilter(),
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
  if (loadedAt && Date.now() - loadedAt < INDEX_MAX_AGE_MS) return index.size;
  if (refreshPromise) return refreshPromise;
  refreshPromise = refresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

function upsert(user) {
  if (!user || !Array.isArray(user.faceDescriptor)) return remove(user?._id);
  if (!isActiveStudent(user) || !user.faceEnrolledAt || !user.faceConsentAt) return remove(user._id);
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
  if (secondDistance !== Infinity && (secondDistance - best.distance < margin() || best.distance / secondDistance > 0.80)) {
    return { result: "ambiguous", distance: best.distance, secondDistance };
  }

  // A probe can sit closer to the WRONG member of a lookalike pair and still
  // clear a probe-only margin. Refuse near-colliding enrollment references too.
  for (const entry of index.values()) {
    if (entry.id !== best.entry.id && distance(best.entry.descriptor, entry.descriptor) < 0.35) {
      return { result: "ambiguous", distance: best.distance, secondDistance };
    }
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

async function identifyBatch(descriptors) {
  if (!Array.isArray(descriptors) || descriptors.length !== 2 || !descriptors.every(isValidDescriptor)) return { result: "invalid" };
  if (distance(descriptors[0], descriptors[1]) > 0.18) return { result: "unstable" };
  const first = await identify(descriptors[0]);
  if (first.result !== "match") return first;
  const second = await identify(descriptors[1]);
  if (second.result !== "match") return second;
  if (first.student.id !== second.student.id || first.student.enrollmentVersion !== second.student.enrollmentVersion) return { result: "ambiguous" };
  return { ...second, distance: Math.max(first.distance, second.distance) };
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
  identifyBatch,
  size,
  clear,
};

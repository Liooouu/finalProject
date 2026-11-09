// routes/checkinRoutes.js
// Face check-in station.
//
// The organizer mints a short-lived token while signed in, opens the kiosk
// page, and students simply look at the camera. The public endpoints below are
// the only unauthenticated part of the system, so they expose nothing beyond
// the event title, the window state and a confirmed student's display name.
const express = require("express");
const crypto = require("crypto");
const { isValidObjectId } = require("mongoose");
const router = express.Router();

const Event = require("../models/Event");
const User = require("../models/User");
const Attendance = require("../models/Attendance");
const CheckInSession = require("../models/CheckInSession");
const { protect } = require("../middleware/authMiddleware");
const { canViewEventAttendance, canRecordAttendance } = require("../services/eventAccess");
const {
  isTerminal,
  eventWindow,
  eventLastCheckInAt,
  attendanceWindowPayload,
} = require("../services/eventLifecycle");
const faceIdentify = require("../services/faceIdentify");
const { recordAttendance, recordSessionAction } = require("../services/attendanceMarking");
const { isActiveStudent } = require("../services/studentEligibility");
const { setBrowserCookie, browserMatches } = require("../services/stationBrowser");

const SESSION_MAX_MS = 12 * 60 * 60 * 1000;
const SESSION_GRACE_MS = 15 * 60 * 1000;

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function newToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function publicStudent(student) {
  return {
    name: student.name,
    program: student.program || "",
    yearLevel: student.yearLevel ?? null,
    section: student.section || "",
  };
}

// The kiosk only needs to know whether it may accept faces right now. The same
// gate the write path uses is applied here so the screen and the API agree.
// Determine the station mode (time_in / time_out / closed) and state from the
// event's sessions (or legacy single window). Returns { state, mode, session }.
function stationModeAndState(station, event, now = new Date()) {
  if (station.closedAt) return { state: "closed", mode: "closed", session: null };
  if (now >= station.expiresAt) return { state: "expired", mode: "closed", session: null };
  if (!event) return { state: "closed", mode: "closed", session: null };

  const sessions = Array.isArray(event.attendanceSessions) ? event.attendanceSessions : [];
  // Finished/closed event: still allow an open Time Out window.
  const terminal = isTerminal(event.status);

  if (sessions.length) {
    const selected = sessions.find(row => String(row._id) === String(station.session));
    if (!selected || event.status === "closed") return { state: "closed", mode: "closed", session: selected || null };
    const mode = require("../services/sessionAttendance").modeFor(event, selected, now);
    if (mode !== "closed") return { state: mode === "time_in" && now > new Date(selected.onTimeDeadline) ? "late" : "open", mode, session: selected };
    return { state: now <= new Date(selected.timeOutClose) ? "before" : "closed", mode: "closed", session: selected };
  }

  // Legacy time-in-only
  if (terminal) return { state: "closed", mode: "closed", session: null };
  const window = eventWindow(event);
  const last = eventLastCheckInAt(event);
  if (!window || !last) return { state: "unavailable", mode: "closed", session: null };
  if (now < window.start) return { state: "before", mode: "closed", session: null };
  if (now > last) return { state: "closed", mode: "closed", session: null };
  if (now > window.end) return { state: "late", mode: "time_in", session: null };
  return { state: "open", mode: "time_in", session: null };
}

function stationState(session, event, now = new Date()) {
  return stationModeAndState(session, event, now).state;
}

// A tiny in-memory limiter: the public endpoint accepts a 128-number vector,
// so it cannot be used to upload files, but it still must not be hammered.
const buckets = new Map();
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 10 * 1000;

function rateLimited(key) {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) {
    for (const [k, value] of buckets) {
      if (!value.some((t) => now - t < RATE_WINDOW_MS)) buckets.delete(k);
    }
  }
  return hits.length > RATE_LIMIT;
}

async function loadStation(token, req) {
  const tokenHash = sha256(token);
  const session = await CheckInSession.findOne({ tokenHash });
  if (!session) return { error: "not-found" };
  if (!browserMatches(req, session)) return { error: "browser", message: "Reopen the face station from the organizer dashboard on this browser." };
  const operator = await User.findById(session.openedBy).select("role organizerAccess organizerAccessVersion sessionVersion");
  if (!operator || !(operator.role === "organizer" || (operator.role === "student" && operator.organizerAccess && (operator.organizerAccessVersion || 0) === (session.organizerAccessVersion || 0)))) return { error: "not-found" };
  if ((operator.sessionVersion || 0) !== (session.authSessionVersion || 0)) return { error: "not-found", message: "Your organizer session changed. Reopen the face station from the dashboard." };
  const event = await Event.findById(session.event);
  if (!event) return { error: "not-found" };
  return { session, event, tokenHash };
}

// ── Organizer endpoints (authenticated) ───────────────────────────────────────

// Open a check-in station for an event.
router.post("/sessions", protect, async (req, res) => {
  try {
    const { eventId, stationLabel, sessionId } = req.body || {};
    if (!isValidObjectId(eventId)) return res.status(400).json({ error: "A valid eventId is required" });
    if (req.user.role !== "organizer") return res.status(403).json({ error: "Only event organizers can open attendance stations" });
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: "Event not found" });
    if (!(await canRecordAttendance(event, req.user))) {
      return res.status(403).json({ error: "You are not allowed to manage this event" });
    }

    const now = new Date();
    const sessions = event.attendanceSessions || [];
    const selected = sessions.length ? require("../services/sessionAttendance").sessionFor(event, sessionId || (sessions.length === 1 ? sessions[0]._id : null)) : null;
    const sessionRef = selected?._id || null;
    if ((!selected && isTerminal(event.status)) || event.status === "closed") return res.status(400).json({ error: "This event is closed." });
    const lastCheckIn = selected ? new Date(selected.timeOutClose) : eventLastCheckInAt(event);
    if (!lastCheckIn || !Number.isFinite(+lastCheckIn) || now > lastCheckIn) return res.status(400).json({ error: "This attendance period has ended or has no valid closing time. Choose another session." });

    if (selected) await require("../services/sessionAttendance").lockSchedule(event, now, selected._id, { prepareForMs: 30000 });
    const token = newToken();
    // A session station covers BOTH arrival and departure. The old 12-hour
    // cap could expire a station before its configured Time Out even opened.
    const expiresAt = new Date(selected ? lastCheckIn.getTime() + SESSION_GRACE_MS
      : Math.min(lastCheckIn.getTime() + SESSION_GRACE_MS, now.getTime() + SESSION_MAX_MS));

    const session = await CheckInSession.create({
      event: event._id,
      session: sessionRef,
      openedBy: req.user._id,
      organizerAccessVersion: req.user.organizerAccessVersion || 0,
      authSessionVersion: req.user.sessionVersion || 0,
      browserSecretHash: setBrowserCookie(res, sha256(token), expiresAt),
      tokenHash: sha256(token),
      stationLabel: String(stationLabel || "").trim().slice(0, 80),
      expiresAt,
    });

    res.status(201).json({
      id: session._id,
      token,
      eventId: event._id,
      eventTitle: event.title,
      expiresAt,
    });
  } catch (err) {
    console.error("CHECK-IN SESSION CREATE ERROR:", err.message);
    res.status(err.status || 500).json({ error: err.status ? err.message : "Could not open the check-in station" });
  }
});

// Active stations across permitted events, or a single event when requested.
router.get("/sessions", protect, async (req, res) => {
  try {
    const { eventId } = req.query;
    let events;
    if (eventId !== undefined) {
      if (!isValidObjectId(eventId)) return res.status(400).json({ error: "A valid eventId is required" });
      const event = await Event.findById(eventId);
      if (!event) return res.status(404).json({ error: "Event not found" });
      if (!canViewEventAttendance(event, req.user)) {
        return res.status(403).json({ error: "You are not allowed to manage this event" });
      }
      events = [event];
    } else {
      if (!["organizer", "admin"].includes(req.user.role)) {
        return res.status(403).json({ error: "Organizer access is required" });
      }
      // All organizers can help operate attendance for every shared event.
      events = await Event.find({})
        .select("_id title").lean();
    }
    const eventTitles = new Map(events.map(event => [String(event._id), event.title]));
    const sessions = await CheckInSession.find({
      event: { $in: events.map(event => event._id) },
      closedAt: null,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1, _id: -1 }).lean();
    res.json(sessions.map(session => ({
      id: session._id,
      eventId: session.event,
      eventTitle: eventTitles.get(String(session.event)) || "Event",
      stationLabel: session.stationLabel,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      lastUsedAt: session.lastUsedAt,
      matchCount: session.matchCount,
      failedCount: session.failedCount,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Close a station immediately.
router.delete("/sessions/:id", protect, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid station ID" });
    const session = await CheckInSession.findById(req.params.id);
    if (!session) return res.status(404).json({ error: "Check-in station not found" });

    const event = await Event.findById(session.event);
    if (!event) return res.status(404).json({ error: "Event not found" });
    if (!canViewEventAttendance(event, req.user)) {
      return res.status(403).json({ error: "You are not allowed to manage this event" });
    }

    if (!session.closedAt) {
      session.closedAt = new Date();
      await session.save();
    }
    res.json({ id: session._id, closedAt: session.closedAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Kiosk endpoints (station token plus issuing-browser cookie) ──────────────

// What the kiosk should show: event name, window state, live count.
router.get("/:token", async (req, res) => {
  try {
    const { session, event, error, message } = await loadStation(req.params.token, req);
    if (error) return res.status(error === "browser" ? 403 : 404).json({ error: message || "Check-in station not found" });

    const now = new Date();
    const info = stationModeAndState(session, event, now);
    const [checkedIn, faceCheckedIn] = await Promise.all([
      Attendance.countDocuments({
        event: event._id,
        ...(session.session ? { session: session.session } : { session: null }),
        status: { $in: ["present", "late"] },
      }),
      Attendance.countDocuments({ event: event._id, session: session.session || null, method: "face" }),
    ]);

    res.json({
      event: {
        id: event._id,
        title: event.title,
        location: event.location || "",
      },
      station: {
        label: session.stationLabel || "",
        expiresAt: session.expiresAt,
      },
      state: info.state,
      mode: info.mode, // "time_in" | "time_out" | "closed"
      session: info.session ? { id: info.session._id || null, name: info.session.name || "" } : null,
      window: info.session ? { start: info.mode === "time_out" ? info.session.timeOutOpen : info.session.timeInOpen, end: info.mode === "time_out" ? info.session.timeOutClose : info.session.onTimeDeadline, cutoff: info.session.timeInCutoff, timeOutOpen: info.session.timeOutOpen, timeOutClose: info.session.timeOutClose } : attendanceWindowPayload(event),
      counts: { checkedIn, faceCheckedIn },
    });
  } catch (err) {
    console.error("CHECK-IN STATUS ERROR:", err.message);
    res.status(500).json({ error: "Could not load the check-in station" });
  }
});

// Identify one face and record attendance.
router.post("/:token", async (req, res) => {
  try {
    const rateKey = sha256(req.params.token);
    if (rateLimited(rateKey)) {
      return res.status(429).json({ error: "Too many scans. Wait a moment and try again." });
    }

    const { session, event, error, tokenHash, message } = await loadStation(req.params.token, req);
    if (error) return res.status(error === "browser" ? 403 : 404).json({ error: message || "Check-in station not found" });

    const now = new Date();
    const state = stationState(session, event, now);
    if (state !== "open" && state !== "late") {
      return res.json({ ok: false, result: state });
    }

    const match = await faceIdentify.identifyBatch(req.body?.descriptors);

    if (match.result === "invalid") {
      return res.status(400).json({ error: "Two clear face scans are required. Reload the station and try again." });
    }

    if (match.result !== "match") {
      await CheckInSession.updateOne(
        { _id: session._id },
        { $inc: { failedCount: 1 }, $set: { lastUsedAt: now } }
      );
      return res.json({
        ok: false,
        result: match.result === "empty" ? "no-enrollments" : match.result,
        message:
          match.result === "ambiguous"
            ? "Two enrolled faces are too similar — ask the organizer to verify you."
            : match.result === "empty"
              ? "No students have enrolled a face yet."
              : "Face not recognised. Please see the organizer.",
      });
    }

    const student = await User.findById(match.student.id).select(
      "name role program yearLevel section enrollmentStatus emailVerified faceEnrolledAt faceConsentAt faceEnrollmentVersion"
    );
    if (!isActiveStudent(student) || !student.faceEnrolledAt || !student.faceConsentAt ||
        (student.faceEnrollmentVersion || 0) !== match.student.enrollmentVersion) {
      faceIdentify.remove(match.student.id);
      await CheckInSession.updateOne(
        { _id: session._id },
        { $inc: { failedCount: 1 }, $set: { lastUsedAt: now } }
      );
      return res.json({
        ok: false,
        result: "not-enrolled",
        message: "Face not recognised. Please see the organizer.",
      });
    }

    const info = stationModeAndState(session, event, now);
    const stationSession = session.session ? event.attendanceSessions.find(s => String(s._id) === String(session.session)) : null;

    let outcome;
    try {
      if (stationSession) {
        outcome = await recordSessionAction({
          event,
          session: stationSession,
          student,
          action: info.mode === "time_out" ? "time_out" : "time_in",
          now,
          method: "face",
          matchDistance: Number(match.distance.toFixed(4)),
          checkInSession: session._id,
        });
      } else {
        outcome = await recordAttendance({
          event,
          student,
          now,
          method: "face",
          matchDistance: Number(match.distance.toFixed(4)),
          checkInSession: session._id,
        });
      }
    } catch (err) {
      // Two kiosks can identify the same student at the same instant; the
      // unique index lets exactly one win.
      if (err.code === 11000) {
        const existing = await Attendance.findOne(
          stationSession
            ? { event: event._id, session: stationSession._id, student: student._id }
            : { event: event._id, student: student._id }
        );
        outcome = { ok: false, reason: "already", attendance: existing };
      } else {
        throw err;
      }
    }

    await CheckInSession.updateOne(
      { _id: session._id },
      {
        $inc: outcome.ok ? { matchCount: 1 } : { failedCount: 0 },
        $set: { lastUsedAt: now },
      }
    );

    if (outcome.reason === "already") {
      return res.json({
        ok: true,
        result: "already",
        student: publicStudent(student),
        status: outcome.attendance?.status || "present",
        action: info.mode,
        completionStatus: outcome.attendance?.completionStatus,
        message: info.mode === "time_out" ? "Time Out already recorded" : "Time In already recorded",
      });
    }

    if (!outcome.ok) {
      return res.json({
        ok: false,
        result: outcome.reason,
        message: outcome.message || (
          outcome.reason === "before"
            ? "Attendance is not open yet."
            : outcome.reason === "no_time_in"
            ? "Time In required before Time Out."
            : "Attendance is closed for this event."),
      });
    }

    res.json({
      ok: true,
      result: "marked",
      student: publicStudent(student),
      status: outcome.status,
      hours: outcome.hours,
      action: outcome.action || "time_in",
      completionStatus: outcome.completionStatus || null,
      distance: match.distance,
      replacedExcuse: outcome.replacedExcuse,
      message:
        outcome.action === "time_out"
          ? `Time Out recorded (${outcome.completionStatus || "completed"})`
          : outcome.status === "late"
          ? "Checked in late — 4 community service hours recorded."
          : "Attendance recorded",
    });
  } catch (err) {
    console.error("CHECK-IN IDENTIFY ERROR:", err.message);
    res.status(500).json({ error: "Could not record attendance" });
  }
});

module.exports = router;

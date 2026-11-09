const cors = require("cors");
const compression = require("compression");
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const connectDB = require("./config/db");
const { freePort } = require("./scripts/free-port");
const { ensureAdmin } = require("./seedAdmin");
const { repairUserIndexes } = require("./services/repairUserIndexes");
const Event = require("./models/Event");
const User = require("./models/User");
const { activeStudentFilter } = require("./services/studentEligibility");
const Attendance = require("./models/Attendance");
const CheckInSession = require("./models/CheckInSession");
const ManualAttendanceRequest = require("./models/ManualAttendanceRequest");
const { notifyUsers, eventRecipients } = require("./services/notify");
const { isMailEnabled } = require("./services/mailer");
const faceIdentify = require("./services/faceIdentify");
const {
  STATUS,
  OPEN_STATUS_FILTER,
  manilaDayRange,
  eventEndAt,
  eventStartsAt,
  eventLastCheckInAt,
  attendanceNoticeState,
  manilaDateTimeLabel,
  ATTENDANCE_NOTICES_VERSION,
  shouldAutoGoLive,
  shouldAutoFinish,
  multiSessionStatus,
  eventLiveNotification,
} = require("./services/eventLifecycle");

const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const eventRoutes = require("./routes/eventRoutes");
const accountRoutes = require("./routes/accountRoutes");
const reportRoutes = require("./routes/reportRoutes");
const studentRoutes = require("./routes/studentRoutes");
const organizerRoutes = require("./routes/organizerRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const checkinRoutes = require("./routes/checkinRoutes");
const manualAttendanceRoutes = require("./routes/manualAttendanceRoutes");

const app = express();
// Attendance rosters are internal eligibility snapshots, never directory data.
app.set("json replacer", (key, value) => key === "eligibleStudents" ? undefined : value);
const PORT = process.env.PORT || 5000;
let serverHandle = null;

// ✅ MIDDLEWARES
app.use(cors());
// JSON is the bulk of what this API sends (the attendance report alone is more
// than 150 KB of it) and it compresses around ten to one. nginx already gzips
// the two-container deployment, but the single-container image and a direct
// API URL get nothing without this.
app.use(compression());
app.use(express.json());

const { observeRecordWrites, streamRecordUpdates } = require('./services/recordUpdates');
app.use('/api', observeRecordWrites);
app.get('/api/record-updates', require('./middleware/authMiddleware').protect, streamRecordUpdates);

// Face photos are biometric data: never serve the private directory directly.
app.use("/uploads/private-faces", (req, res) => {
  res.status(404).end();
});

app.use("/uploads", require("./routes/uploadRoutes"));

// ✅ ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/organizer", organizerRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/checkin", checkinRoutes);
app.use("/api/manual-attendance", manualAttendanceRoutes);
app.use("/api/id-photo-attendance", require("./routes/idPhotoAttendanceRoutes"));
app.use("/api/academic-periods", require("./routes/academicPeriodRoutes"));
app.use("/api/files", require("./routes/fileRoutes"));

// ✅ HEALTH CHECK — used by the container HEALTHCHECK and by Coolify's health
// probe. Reports database state without failing on it: the process only starts
// listening after a successful connect, so a failing probe here would only
// produce restart loops around a database that is already coming back up.
app.get("/api/health", async (req, res) => {
  res.json({
    ok: true,
    db: mongoose.connection.readyState === 1 ? "up" : "down",
    mail: (await isMailEnabled()) ? "on" : "off",
    uptime: Math.round(process.uptime()),
  });
});

app.use("/api", (req, res) => {
  res.status(404).json({ message: "Not found" });
});

const clientDist = path.join(__dirname, "..", "frontend-dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist, { index: false }));
  app.get(/^\/(?!api(?:\/|$)|uploads(?:\/|$)).*/, (req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.send("TrackED Backend Running");
  });
}

// ✅ GLOBAL ERROR HANDLER (VERY IMPORTANT)
app.use((err, req, res, next) => {
  console.error("GLOBAL ERROR:", err.stack);

  // Malformed JSON body is a client error, not a server fault.
  if (err.type === "entity.parse.failed" || err instanceof SyntaxError) {
    return res.status(400).json({ message: "Invalid JSON in request body" });
  }
  // Multer: file too large / rejected type.
  if (err.name === "MulterError") {
    return res.status(400).json({
      message: err.code === "LIMIT_FILE_SIZE" ? "File is too large" : err.message,
    });
  }

  const status = err.status || err.statusCode || 500;
  // Never leak internal messages for an unexpected 500.
  res.status(status).json({
    message: status >= 500 ? "Server error" : err.message || "Request failed",
  });
});

// ✅ CONNECT DB THEN START SERVER
connectDB()
  .then(async () => {
    console.log("MongoDB Connected ✅");

    // ✅ INDEX REPAIRS — a database that ran an older schema keeps indexes whose
    // definition has since been corrected. Dropping them here means a deploy
    // heals the database without a manual migration step. Runs before accounts
    // are created so a first-run admin is never the only account that can exist.
    await repairUserIndexes();
    // Establish the duplicate-request guard before accepting attendance work.
    await ManualAttendanceRequest.init();

    // Build the 1:N face index once at boot so the first student at a check-in
    // station isn't waiting on a full student scan. Failure is not fatal: the
    // index refreshes lazily on first use and every five minutes after that.
    faceIdentify
      .refresh()
      .then((count) => console.log(`[faceIdentify] indexed ${count} enrolled student(s)`))
      .catch((err) => console.error("[faceIdentify] initial index failed:", err.message));

    // ✅ FIRST-RUN ADMIN — only when explicitly configured (Coolify sets
    // ADMIN_EMAIL/ADMIN_PASSWORD). Idempotent: it never touches an existing
    // admin, so restarts are harmless. Locally these vars are unset and the
    // manual `npm run seed:admin` remains the way in.
    if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
      try {
        await ensureAdmin({
          email: process.env.ADMIN_EMAIL,
          password: process.env.ADMIN_PASSWORD,
          name: process.env.ADMIN_NAME,
        });
      } catch (err) {
        // A bad seed must not take the API down: the app is still usable by
        // existing accounts, and the error is visible in the logs.
        console.error("[seed] Could not create the admin account:", err.message);
      }
    }

    // ✅ BACKGROUND JOB — keeps event statuses honest and handles attendance.
    //
    // Step 1  upcoming -> live    when the event's start time arrives
    // Step 2  absence marking + attendance-window notices
    // Step 3  -> finished          when the event's end time arrives
    //
    // Step 2 must run before step 3: an event leaves the "still open" query the
    // moment it finishes, so the absences for its last day would never be
    // written otherwise.
    let lifecycleRunning = false;
    const runLifecycleJob = async () => {
      // A run can outlast the 60s tick (large student lists). Overlapping runs
      // used to race on the same events and duplicate notifications.
      if (lifecycleRunning) return;
      lifecycleRunning = true;
      try {
        const now = new Date();

        // Kiosk station tokens are only a convenience: the window check is what
        // actually refuses late scans. Closing the expired rows keeps the
        // organizer's station list honest and stops old links from polling.
        await CheckInSession.updateMany(
          { closedAt: null, expiresAt: { $lt: now } },
          { $set: { closedAt: now } }
        );

        // Day boundaries and the clock come from the school's zone (Asia/Manila),
        // not the container's UTC — otherwise a 5:45 PM window notifies at 1:45 AM.
        const { start: today, end: todayEnd } = manilaDayRange(now);

        // ── STEP 1: go live automatically at the start time ──────────────
        const toGoLive = await Event.find({
          status: STATUS.UPCOMING,
          manualOverride: { $ne: true },
          date: { $lte: todayEnd },
        });

        for (const event of toGoLive) {
          try {
            if (!shouldAutoGoLive(event, now)) continue;

            await Event.findByIdAndUpdate(event._id, { status: STATUS.LIVE });

            const recipients = await eventRecipients(event);
            if (recipients.length > 0) {
              const { type, title, message } = eventLiveNotification(event);
              await notifyUsers(recipients, {
                type,
                title,
                message,
                relatedEvent: event._id,
                event,
              });
            }
            console.log(`[lifecycle] "${event.title}" is now live (auto)`);
          } catch (err) {
            // One bad event must not stop the rest of the pass.
            console.error(`[lifecycle] go-live failed for "${event.title}":`, err.message);
          }
        }

        // ── STEP 2: absence marking for events that are over ─────────────
        // Reconcile every run so students registered after an earlier pass
        // still get their absent record + hours.
        const candidateEvents = await Event.find({
          date: { $lte: todayEnd },
          ...OPEN_STATUS_FILTER,
          manualOverride: { $ne: true },
          $or: [{ attendanceSessions: { $exists: false } }, { attendanceSessions: { $size: 0 } }],
        });

        for (const event of candidateEvents) {
          // Absences are written once the check-in window (plus grace) is over,
          // not merely when the event end passes — otherwise an event whose end
          // is earlier than its window would penalize students mid-window.
          const lastCheckIn = eventLastCheckInAt(event) || eventEndAt(event);
          if (!lastCheckIn || now < lastCheckIn) continue;

          try {
            // Get all students
            const students = await User.find(activeStudentFilter());
            const pendingManualStudents = new Set((await ManualAttendanceRequest.find({
              event: event._id, status: "pending",
            }).distinct("student")).map(String));

            const deletedStudents = new Set((await require("./models/DeletedAttendance").find({ event: event._id }).distinct("student")).map(String));
            for (const student of students) {
              if (deletedStudents.has(String(student._id))) continue;
              try {
                // Check if student already has attendance (idempotent — no duplicates)
                const existingAttendance = await Attendance.findOne({
                  event: event._id,
                  student: student._id,
                });

                if (!existingAttendance) {
                  // Create absent attendance with 8 hours community service
                  const attendance = new Attendance({
                    event: event._id,
                    student: student._id,
                    attendedAt: now,
                    status: "absent",
                    method: "auto",
                    communityServiceHours: 8,
                    communityServiceLog: [
                      { action: "penalty", hours: 8, note: "Marked absent (auto)" },
                    ],
                  });
                  await attendance.save();

                  // Notify the student (in-app + email)
                  // Pending manual check-ins have a provisional absence, not a
                  // final penalty notice. Review resolves this event's balance.
                  if (!pendingManualStudents.has(String(student._id))) await notifyUsers([student], {
                    type: "penalty",
                    title: "Attendance recorded as absent",
                    message: `No attendance was recorded for "${event.title}" before check-in closed. You were marked absent, and an 8-hour penalty has been added to your required community service balance. Open TrackED to review the record or submit an eligible excuse letter.`,
                    relatedEvent: event._id,
                    event,
                  });
                }
              } catch (err) {
                // A unique-index race (two replicas / a late self-mark) is fine;
                // anything else is logged and skipped so the pass continues.
                if (err.code !== 11000) {
                  console.error(
                    `[lifecycle] absence failed for "${event.title}" / ${student.email}:`,
                    err.message
                  );
                }
              }
            }
          } catch (err) {
            console.error(`[lifecycle] absence pass failed for "${event.title}":`, err.message);
          }
        }

        // Session finalization is retry-safe and keeps staff balance adjustments.
        const sessionEvents = await Event.find({ attendanceSessions: { $exists: true, $ne: [] } });
        for (const event of sessionEvents) {
          try { await require("./services/sessionAttendance").finalize(event, now); }
          catch (error) { console.error("[lifecycle] session finalization:", error.message); }
        }

        // ✅ EVENT DAY REMINDERS — attendance-window notices for events dated
        // today, plus the tail of a window that crossed midnight (dated
        // yesterday). Every check uses real instants from eventLifecycle. The
        // old minute-of-day math wrapped any clock before the window start into
        // "tomorrow", so on the morning of an event it fired "open", "closing
        // soon" and "missed" all at once and then silenced the real notices.

        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        const noticeEvents = await Event.find({
          date: { $gte: yesterday, $lte: todayEnd },
          ...OPEN_STATUS_FILTER,
        });

        for (const event of noticeEvents) {
          let changed = false;

          // Events stored before this fix still carry flags the old job set
          // hours early. Clear them once so the corrected phases can fire.
          if (
            !event.noticesVersion ||
            event.noticesVersion < ATTENDANCE_NOTICES_VERSION
          ) {
            event.attendanceUpcomingNotified = false;
            event.openNotified = false;
            event.closingSoonNotified = false;
            event.closedNotified = false;
            event.noticesVersion = ATTENDANCE_NOTICES_VERSION;
            changed = true;
          }

          const notice = attendanceNoticeState(event, now);
          if (!notice) {
            if (changed) await event.save();
            continue;
          }

          const allStudents = await User.find(activeStudentFilter()).select("_id name email");

          const notifyNonAttendees = async (title, message, type) => {
            const attendeeIds = new Set(
              (
                await Attendance.find({ event: event._id }).select("student")
              ).map((a) => a.student.toString())
            );
            const pendingStudents = await ManualAttendanceRequest.find({ event: event._id, status: "pending" }).distinct("student");
            pendingStudents.forEach(id => attendeeIds.add(String(id)));
            const missing = allStudents.filter(
              (s) => !attendeeIds.has(s._id.toString())
            );
            if (missing.length === 0) return;
            await notifyUsers(missing, {
              type,
              title,
              message,
              relatedEvent: event._id,
              event,
            });
          };

          // One hour before the window: a heads-up, never a "missed" claim.
          if (!event.attendanceUpcomingNotified && notice.upcoming) {
            if (allStudents.length > 0) {
              await notifyUsers(allStudents, {
                type: "attendance",
                title: "Attendance opens soon",
                message: `Check-in for "${event.title}" opens at ${manilaDateTimeLabel(notice.window.start)} (Philippine time). Visit an organizer-operated face station to record your attendance.`,
                relatedEvent: event._id,
                event,
              });
            }
            event.attendanceUpcomingNotified = true;
            changed = true;
          }

          // Window is open right now. Gating on the open window (not merely
          // "start has passed") means a server that was down all day never
          // announces a window that is already closed.
          let openedThisPass = false;
          if (!event.openNotified && notice.open) {
            if (allStudents.length > 0) {
              await notifyUsers(allStudents, {
                type: "attendance",
                title: "Attendance is open",
                message: `Check-in is now open for "${event.title}". Visit an organizer-operated face station by ${manilaDateTimeLabel(notice.window.end)} (Philippine time) to be marked present.`,
                relatedEvent: event._id,
                event,
              });
            }
            event.openNotified = true;
            changed = true;
            openedThisPass = true;
          }

          // Closing soon. Skip it when "open" just went out in this same pass:
          // that email already states the closing time, and two messages in one
          // minute read like spam.
          if (!event.closingSoonNotified && notice.closingSoon) {
            if (!openedThisPass) {
              await notifyNonAttendees(
                "On-time check-in ends soon",
                `The on-time check-in deadline for "${event.title}" is ${manilaDateTimeLabel(notice.window.end)} (Philippine time). Visit an organizer-operated face station before the deadline to avoid a late mark.`,
                "attendance"
              );
            }
            event.closingSoonNotified = true;
            changed = true;
          }

          // Window is past its due time but a late check-in still counts.
          if (!event.closedNotified && notice.late) {
            await notifyNonAttendees(
              "On-time check-in has ended",
              `The on-time check-in deadline for "${event.title}" passed at ${manilaDateTimeLabel(notice.window.end)}. Check-in remains available at an organizer-operated face station until ${manilaDateTimeLabel(notice.lastCheckIn)} (Philippine time). A late check-in adds a 4-hour penalty to your required community service balance.`,
              "attendance"
            );
            event.closedNotified = true;
            changed = true;
          }

          if (changed) {
            await event.save();
          }
        }

        // ✅ UPCOMING EVENT REMINDER — 24 hours before the event starts
        const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        // `date` is date-only (midnight), so comparing it to `now` fired the
        // reminder at the wrong time. Use the real start instant for the check.
        const upcomingEvents = await Event.find({
          date: { $gte: new Date(now.getTime() - 48 * 60 * 60 * 1000), $lte: in24h },
          ...OPEN_STATUS_FILTER,
          manualOverride: { $ne: true },
          upcomingNotified: false,
        });

        for (const event of upcomingEvents) {
          try {
            const startsAt = eventStartsAt(event);
            if (!startsAt || startsAt < now || startsAt > in24h) continue;

            const students = await User.find(activeStudentFilter()).select("_id name email");
            if (students.length > 0) {
              await notifyUsers(students, {
                type: "info",
                title: "Upcoming event reminder",
                message: `"${event.title}" starts at ${manilaDateTimeLabel(startsAt)} (Philippine time)${event.location ? ` at ${event.location}` : ""}. Open the event to check its Time In and Time Out schedule before you arrive.`,
                relatedEvent: event._id,
                event,
              });
            }
            event.upcomingNotified = true;
            await event.save();
          } catch (err) {
            console.error(`[lifecycle] reminder failed for "${event.title}":`, err.message);
          }
        }

        // ── STEP 3: finish automatically at the end time ─────────────────
        // Silent on purpose: the status label in the UI already tells the story,
        // and these events are in the past, so there is nothing to act on.
        const toFinish = await Event.find({
          ...OPEN_STATUS_FILTER,
          manualOverride: { $ne: true },
        });

        for (const event of toFinish) {
          if (!shouldAutoFinish(event, now)) continue;
          await Event.findByIdAndUpdate(event._id, {
            status: STATUS.FINISHED,
            autoFinishedAt: now,
          });
          console.log(`[lifecycle] "${event.title}" finished (auto)`);
        }

        // Reconcile days independently, including the gap before the next day.
        const toReopen = await Event.find({
          status: { $nin: [STATUS.CLOSED] },
          manualOverride: { $ne: true },
          'attendanceSessions.1': { $exists: true },
        });
        for (const event of toReopen) {
          try {
            const status = multiSessionStatus(event, now);
            if (!status || status === event.status) continue;
            const reopened = await Event.findOneAndUpdate({
              _id: event._id, __v: event.__v,
              status: event.status, manualOverride: { $ne: true },
            }, { $set: { status, autoFinishedAt: status === STATUS.FINISHED ? now : null } });
            if (!reopened) continue;
            require('./services/recordUpdates').publishRecordChange();
            console.log(`[lifecycle] "${event.title}" is now ${status} (session schedule)`);
          } catch (err) {
            console.error(`[lifecycle] reopen failed for "${event.title}":`, err.message);
          }
        }
      } catch (err) {
        console.error("Error in attendance processing job:", err.message);
      } finally {
        lifecycleRunning = false;
      }
    };

    // Run once at boot so a restart immediately repairs statuses, then every minute.
    runLifecycleJob();
    setInterval(runLifecycleJob, 60000);
    const cleanIdPhotos = () => require("./services/idPhotoAttendance").cleanup().catch(error => console.error("ID evidence cleanup:", error.message));
    cleanIdPhotos();
    setInterval(cleanIdPhotos, 60 * 60 * 1000);

    // A stale TrackED backend on this port should never block startup: free it
    // and bind again. This is what makes "node server.js" behave like
    // "npm run dev" / "npm run start".
    let attempt = 0;
    const listen = () => {
      serverHandle = app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on port ${PORT}`);
      });

      serverHandle.on("error", (err) => {
        if (err.code !== "EADDRINUSE") throw err;

        if (attempt < 1 && process.env.TRACKED_NO_AUTO_FREE !== "1") {
          attempt += 1;
          console.warn(`Port ${PORT} is already in use — freeing it and retrying...`);
          try {
            freePort(PORT);
          } catch (freeErr) {
            console.error(`Could not free port ${PORT}: ${freeErr.message}`);
          }
          setTimeout(listen, 500);
          return;
        }

        console.error(`\nPort ${PORT} is already in use.`);
        console.error("Free it and try again:");
        console.error(`  Windows (PowerShell): Get-NetTCPConnection -LocalPort ${PORT} -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`);
        console.error(`  Windows (Git Bash):  netstat -ano | grep :${PORT} && taskkill //F //PID <pid>`);
        console.error(`  macOS/Linux:         lsof -ti tcp:${PORT} | xargs kill -9`);
        console.error(`\nOr set TRACKED_NO_AUTO_FREE=1 to skip the automatic stop.`);
        process.exit(1);
      });
    };

    const shutdown = () => {
      const finish = () =>
        mongoose.connection.close(false).finally(() => process.exit(0));

      if (serverHandle) {
        serverHandle.close(finish);
      } else {
        finish();
      }

      setTimeout(() => process.exit(1), 25000).unref();
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);

    listen();
  })
  .catch((err) => {
    console.error("DB CONNECTION FAILED ❌", err);
  });

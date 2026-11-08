const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const Excuse = require("../models/Excuse");
const Event = require("../models/Event");
const Attendance = require("../models/Attendance");
const academicPeriods = require("../services/academicPeriods");
const { excuseWindow } = require("../services/excuseWindow");
const { excuseReviewIssue, submissionRevisionFilter, excuseReviewFilter, canReviewExcuse } = require("../services/excuseReview");
const fileStore = require("../services/fileStore");
const { notifyUsers } = require("../services/notify");

// Event IDs an organizer owns; null means "all" (admins).
async function ownedEventIds(user) {
  if (user.role === "admin") return null;
  return Event.find({ organizer: user._id }).distinct("_id");
}

const canManageExcuse = (excuse, user) => {
  if (!excuse) return false;
  if (user.role === "admin") return true;
  if (user.role !== "organizer") return false;
  const event = excuse.event;
  const organizerId = event && typeof event === "object" ? event.organizer : null;
  return !!organizerId && String(organizerId) === String(user._id);
};

router.get("/academic-calendar", protect, async (req, res) => {
  if (!["organizer", "admin"].includes(req.user.role)) return res.status(403).json({ error: "Not authorized" });
  try { res.json(await academicPeriods.read()); } catch { res.status(503).json({ error: "School terms unavailable. Please try again." }); }
});

router.get("/excuses", protect, async (req, res) => {
  try {
    if (req.user.role !== "organizer" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Own letters stay visible; review permission is returned separately.
    const filter = {};

    const excuses = await Excuse.find(filter)
      .populate("student", "name email program yearLevel section enrollmentStatus")
      .populate("event", "title date time endDate endTime organizer academicYearStart semester attendanceSessions")
      .populate("reviewedBy", "name")
      .sort({ createdAt: -1 });

    res.json(excuses.map(excuse => ({ ...excuse.toObject(), canReview: canReviewExcuse(excuse, req.user), canDelete: canManageExcuse(excuse, req.user), approvalIssue: excuseReviewIssue(excuse), submissionDeadline: excuse.event ? excuseWindow(excuse.event, new Date(), excuse.event.attendanceSessions?.find(row => String(row._id) === String(excuse.sessions?.[0]))).deadline : null })));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get("/stats", protect, async (req, res) => {
  try {
    if (req.user.role !== "organizer" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }

    let events;
    if (req.user.role === "admin") {
      events = await Event.find();
    } else {
      events = await Event.find({ organizer: req.user._id });
    }

    const eventIds = events.map(e => e._id);
    const counts = await Attendance.aggregate([
      { $match: { event: { $in: eventIds }, status: { $in: ["present", "late"] } } },
      { $group: { _id: "$event", count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(
      counts.map(c => [c._id.toString(), c.count])
    );

    const totalAttendees = counts.reduce((sum, c) => sum + c.count, 0);
    // Officers review other students across events; admins review every letter.
    const pendingExcuses = await Excuse.countDocuments({
      ...excuseReviewFilter(req.user),
      status: "pending",
    });
    const totalEvents = events.length;

    const attendeesPerEvent = events
      .map(e => ({
        _id: e._id,
        title: e.title,
        date: e.date,
        status: e.status,
        attendeeCount: countMap[e._id.toString()] || 0,
      }))
      .sort((a, b) => b.attendeeCount - a.attendeeCount);

    res.json({
      totalEvents,
      totalAttendees,
      pendingExcuses,
      attendeesPerEvent,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.patch("/excuses/:id", protect, async (req, res) => {
  try {
    if (req.user.role !== "organizer" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { status, responseNote, removal } = req.body;
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid review status" });
    }

    // Check the reviewer identity before any status, penalty or notification change.
    const loaded = await Excuse.findById(req.params.id).populate("event", "title date time endDate endTime organizer academicYearStart semester attendanceSessions");
    if (!loaded) return res.status(404).json({ error: "Excuse not found" });
    if (!canReviewExcuse(loaded, req.user)) {
      return res.status(403).json({ error: "You cannot approve or reject your own excuse letter" });
    }
    if (loaded.status !== "pending") {
      return res.status(400).json({ error: `This excuse was already ${loaded.status}` });
    }

    const attendance = await Attendance.findOne({ event: loaded.event._id, student: loaded.student, session: loaded.sessions?.[0] || null });
    if (status === "approved") {
      const issue = excuseReviewIssue(loaded, attendance?.status === "excused" && String(attendance.excusedBy) === String(loaded._id) ? { status: "absent" } : attendance);
      if (issue) return res.status(400).json({ error: issue });
      if (removal !== undefined && removal !== "complete") return res.status(400).json({ error: "Approval only removes the penalty for this event" });
    }

    if (req.body.expectedVersion !== undefined && Number(req.body.expectedVersion) !== (loaded.submissionVersion || 1)) return res.status(409).json({ error: "This letter was resubmitted. Refresh and review the latest version." });

    // Claim the excuse atomically. A second (double-click / concurrent reviewer)
    // request finds it non-pending and is refused, so hours can't be deducted
    // twice.
    const excuse = await Excuse.findOneAndUpdate(
      { _id: req.params.id, status: "pending", ...submissionRevisionFilter(loaded) },
      { status, responseNote, reviewedBy: req.user._id },
      { new: true }
    )
      .populate("student", "name email program yearLevel section enrollmentStatus")
      .populate("event", "title date time endDate endTime organizer academicYearStart semester attendanceSessions")
      .populate("reviewedBy", "name");

    if (!excuse) {
      return res.status(409).json({ error: "This letter was changed or reviewed. Refresh and review the latest version." });
    }

    try {
      if (status === "approved") {
        const alreadyApplied = attendance.status === "excused" && String(attendance.excusedBy) === String(loaded._id);
        const removedHours = alreadyApplied ? attendance.excuseRemovedHours || 0 : attendance.communityServiceHours || 0;
        if (!alreadyApplied) {
          const saved = await Attendance.updateOne({ _id: attendance._id, status: "absent", communityServiceHours: attendance.communityServiceHours || 0,
            ...(attendance.updatedAt ? { updatedAt: attendance.updatedAt } : { updatedAt: { $exists: false } }) }, {
            $set: { status: "excused", communityServiceHours: 0, excusedBy: loaded._id, excuseRemovedHours: removedHours,
              ...(attendance.session ? { completionStatus: "excused", sessionPenaltyHours: 0 } : {}) },
            $inc: { __v: 1 }, ...(removedHours > 0 ? { $push: { communityServiceLog: { action: "removed", hours: removedHours, note: "Excuse approved", at: new Date() } } } : {})
          });
          if (!saved.modifiedCount) throw Object.assign(new Error("Attendance changed while reviewing. Refresh before trying again."), { status: 409 });
        }

        await Excuse.findByIdAndUpdate(excuse._id, { removedHours });
        excuse.removedHours = removedHours;

        const sessionName = attendance?.session ? (excuse.event.attendanceSessions?.find(row => String(row._id) === String(attendance.session))?.name || "") : "";
        const message = `Your excuse for "${excuse.event.title}"${sessionName ? ` (${sessionName})` : ""} was approved. ${removedHours} community service hours for ${sessionName ? "this session" : "this event"} were removed.`;

        await notifyUsers([excuse.student], {
          type: "excuse",
          title: "Excuse Approved",
          message,
          relatedEvent: excuse.event._id,
          event: excuse.event,
        }).catch(error => {
          console.error("Excuse review notification failed:", error.message);
          excuse.set("notificationWarning", "Review saved, but the student notification could not be delivered.", { strict: false });
        });
      } else {
        await notifyUsers([excuse.student], {
          type: "excuse",
          title: "Excuse Rejected",
          message: `Your excuse for "${excuse.event.title}" was rejected.${responseNote ? ` Note: ${responseNote}` : ""}`,
          relatedEvent: excuse.event._id,
          event: excuse.event,
        }).catch(error => {
          console.error("Excuse review notification failed:", error.message);
          excuse.set("notificationWarning", "Review saved, but the student notification could not be delivered.", { strict: false });
        });
      }
    } catch (sideEffectErr) {
      // Undo the claim so the reviewer can retry instead of being stuck.
      await Excuse.findByIdAndUpdate(excuse._id, {
        status: "pending",
        reviewedBy: null,
        responseNote: "",
      });
      throw sideEffectErr;
    }

    res.json({ ...(excuse.toObject ? excuse.toObject() : excuse), canReview: canReviewExcuse(excuse, req.user), canDelete: canManageExcuse(excuse, req.user) });
  } catch (err) {
    res.status(err.status || err.statusCode || 500).json({ error: err.message });
  }
});

// Delete all reviewed (approved/rejected) excuse letters at once.
router.delete("/excuses", protect, async (req, res) => {
  try {
    if (req.user.role !== "organizer" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }

    const ids = await ownedEventIds(req.user);
    const filter = {
      status: { $in: ["approved", "rejected"] },
      ...(ids === null ? {} : { event: { $in: ids } }),
    };
    const excuses = await Excuse.find(filter).select("attachments attachmentUrl submissionHistory");
    const result = await Excuse.deleteMany(filter);
    await fileStore.deleteByUrls(
      excuses.flatMap((e) => [...(e.attachments || []), e.attachmentUrl, ...(e.submissionHistory || []).flatMap(revision => revision.attachments || [])])
    );
    res.json({ deleted: result.deletedCount });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Delete a single excuse letter.
router.delete("/excuses/:id", protect, async (req, res) => {
  try {
    if (req.user.role !== "organizer" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }

    const excuse = await Excuse.findById(req.params.id).populate("event", "organizer academicYearStart semester");
    if (!excuse) {
      return res.status(404).json({ error: "Excuse not found" });
    }
    if (!canManageExcuse(excuse, req.user)) {
      return res.status(403).json({ error: "You are not the organizer of this event" });
    }

    const files = [...(excuse.attachments || []), excuse.attachmentUrl, ...(excuse.submissionHistory || []).flatMap(revision => revision.attachments || [])];
    await excuse.deleteOne();
    await fileStore.deleteByUrls(files);
    res.json({ message: "Excuse deleted" });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;

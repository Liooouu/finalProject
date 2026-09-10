const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const Excuse = require("../models/Excuse");
const Event = require("../models/Event");
const Attendance = require("../models/Attendance");
const Notification = require("../models/Notification");

// Spreads a flat hour removal across a student's other penalty records so the
// "Remove 16 hrs" approval option reduces their total CS hours, not the goal.
async function removeAcrossRecords(studentId, excludeAttendanceId, amount, note) {
  if (amount <= 0) return 0;
  let remaining = amount;
  const records = await Attendance.find({
    student: studentId,
    _id: { $ne: excludeAttendanceId },
    communityServiceHours: { $gt: 0 },
  }).sort({ attendedAt: 1 });

  for (const rec of records) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, rec.communityServiceHours || 0);
    if (take <= 0) continue;
    rec.communityServiceHours = (rec.communityServiceHours || 0) - take;
    rec.communityServiceLog.push({ action: "removed", hours: take, note });
    await rec.save();
    remaining -= take;
  }
  return amount - remaining;
}

router.get("/excuses", protect, async (req, res) => {
  try {
    if (req.user.role !== "organizer" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }

    const excuses = await Excuse.find()
      .populate("student", "name email")
      .populate("event", "title date organizer")
      .populate("reviewedBy", "name")
      .sort({ createdAt: -1 });

    res.json(excuses);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    const totalAttendees = await Attendance.countDocuments({ event: { $in: eventIds } });
    const pendingExcuses = await Excuse.countDocuments({ status: "pending" });
    const totalEvents = events.length;

    res.json({
      totalEvents,
      totalAttendees,
      pendingExcuses,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/excuses/:id", protect, async (req, res) => {
  try {
    if (req.user.role !== "organizer" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { status, responseNote, removal } = req.body;

    const excuse = await Excuse.findByIdAndUpdate(
      req.params.id,
      { status, responseNote, reviewedBy: req.user._id },
      { new: true }
    )
      .populate("student", "name email")
      .populate("event", "title date")
      .populate("reviewedBy", "name");

    if (!excuse) {
      return res.status(404).json({ error: "Excuse not found" });
    }

    if (status === "approved") {
      // Approved excuses clear the event's CS penalty from the student's
      // community service hours. removal "16" additionally removes a flat
      // 16 hours spread across the student's other penalty records. The goal
      // (requiredServiceHours) is never touched — it stays fixed at the value
      // the organizer/admin set.
      if (excuse.type === "advance") {
        // Pre-create the attendance as excused BEFORE the event happens,
        // so the auto-absent background job never penalizes this student.
        const attendance = await Attendance.findOneAndUpdate(
          { event: excuse.event._id, student: excuse.student._id },
          { status: "excused", communityServiceHours: 0 },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        if (removal === "16") {
          await removeAcrossRecords(
            excuse.student._id,
            attendance._id,
            16,
            "Advance excuse approved (16 hrs removed from CS)"
          );
        }

        const notification = new Notification({
          user: excuse.student._id,
          type: "excuse",
          title: "Advance Excuse Approved",
          message:
            `Your advance excuse for "${excuse.event.title}" was approved. You won't receive community service hours if you miss this event.` +
            (removal === "16" ? " 16 hours were removed from your community service hours." : ""),
          relatedEvent: excuse.event._id,
        });
        await notification.save();
      } else {
        const existing = await Attendance.findOne({
          event: excuse.event._id,
          student: excuse.student._id,
        });
        const previousHours = (existing && existing.communityServiceHours) || 0;

        const attendance = await Attendance.findOneAndUpdate(
          { event: excuse.event._id, student: excuse.student._id },
          { status: "excused", communityServiceHours: 0 },
          { new: true }
        );

        if (previousHours > 0 && attendance) {
          attendance.communityServiceLog.push({
            action: "removed",
            hours: previousHours,
            note: "Excuse approved",
          });
          await attendance.save();
        }

        if (removal === "16") {
          await removeAcrossRecords(
            excuse.student._id,
            attendance._id,
            16,
            "Excuse approved (16 hrs removed from CS)"
          );
        }

        const notification = new Notification({
          user: excuse.student._id,
          type: "excuse",
          title: "Excuse Approved",
          message:
            removal === "16"
              ? `Your excuse for "${excuse.event.title}" was approved. The community service hours for this event were removed, plus an additional 16 hours were removed from your community service hours.`
              : `Your excuse for "${excuse.event.title}" was approved. Any community service hours for this event have been removed.`,
          relatedEvent: excuse.event._id,
        });
        await notification.save();
      }
    } else if (status === "rejected") {
      const notification = new Notification({
        user: excuse.student._id,
        type: "excuse",
        title: "Excuse Rejected",
        message: `Your excuse for "${excuse.event.title}" was rejected.${responseNote ? ` Note: ${responseNote}` : ""}`,
        relatedEvent: excuse.event._id,
      });
      await notification.save();
    }

    res.json(excuse);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete all reviewed (approved/rejected) excuse letters at once.
router.delete("/excuses", protect, async (req, res) => {
  try {
    if (req.user.role !== "organizer" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }

    const result = await Excuse.deleteMany({
      status: { $in: ["approved", "rejected"] },
    });
    res.json({ deleted: result.deletedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a single excuse letter.
router.delete("/excuses/:id", protect, async (req, res) => {
  try {
    if (req.user.role !== "organizer" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }

    const excuse = await Excuse.findByIdAndDelete(req.params.id);
    if (!excuse) {
      return res.status(404).json({ error: "Excuse not found" });
    }
    res.json({ message: "Excuse deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

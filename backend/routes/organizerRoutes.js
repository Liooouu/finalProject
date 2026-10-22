const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const Excuse = require("../models/Excuse");
const Event = require("../models/Event");
const Attendance = require("../models/Attendance");
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

// Removes a flat number of hours from a student's CS balance. The excuse
// event's own record (priorityAttendanceId) is consumed first, then any
// remaining amount is spread across the student's other penalty records, so
// the "Remove 16 hrs" option never takes more than the requested amount.
async function removeFlatHours(studentId, priorityAttendanceId, amount, note) {
  if (amount <= 0) return 0;
  let remaining = amount;

  if (priorityAttendanceId) {
    const priority = await Attendance.findById(priorityAttendanceId);
    if (priority && (priority.communityServiceHours || 0) > 0) {
      const take = Math.min(remaining, priority.communityServiceHours || 0);
      priority.communityServiceHours = (priority.communityServiceHours || 0) - take;
      priority.communityServiceLog.push({ action: "removed", hours: take, note });
      await priority.save();
      remaining -= take;
    }
  }

  if (remaining > 0) {
    const records = await Attendance.find({
      student: studentId,
      _id: { $ne: priorityAttendanceId },
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
  }

  return amount - remaining;
}

router.get("/excuses", protect, async (req, res) => {
  try {
    if (req.user.role !== "organizer" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }

    const ids = await ownedEventIds(req.user);
    const filter = ids === null ? {} : { event: { $in: ids } };

    const excuses = await Excuse.find(filter)
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
    const counts = await Attendance.aggregate([
      { $match: { event: { $in: eventIds }, status: { $in: ["present", "late"] } } },
      { $group: { _id: "$event", count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(
      counts.map(c => [c._id.toString(), c.count])
    );

    const totalAttendees = counts.reduce((sum, c) => sum + c.count, 0);
    // Only this organizer's pending letters are actionable for them (admins
    // own the whole queue).
    const pendingExcuses = await Excuse.countDocuments({
      event: { $in: eventIds },
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
    res.status(500).json({ error: err.message });
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

    // Load with the event so ownership can be checked before any side effect.
    const loaded = await Excuse.findById(req.params.id).populate("event", "title date organizer");
    if (!loaded) return res.status(404).json({ error: "Excuse not found" });
    if (!canManageExcuse(loaded, req.user)) {
      return res.status(403).json({ error: "You are not the organizer of this event" });
    }
    if (loaded.status !== "pending") {
      return res.status(400).json({ error: `This excuse was already ${loaded.status}` });
    }

    // Never replace a genuine present/late record with "excused".
    const attendance = await Attendance.findOne({
      event: loaded.event._id,
      student: loaded.student,
    });
    if (status === "approved" && attendance && ["present", "late"].includes(attendance.status)) {
      return res.status(400).json({ error: "The student already attended this event" });
    }

    // Claim the excuse atomically. A second (double-click / concurrent reviewer)
    // request finds it non-pending and is refused, so hours can't be deducted
    // twice.
    const excuse = await Excuse.findOneAndUpdate(
      { _id: req.params.id, status: "pending" },
      { status, responseNote, reviewedBy: req.user._id },
      { new: true }
    )
      .populate("student", "name email")
      .populate("event", "title date organizer")
      .populate("reviewedBy", "name");

    if (!excuse) {
      return res.status(409).json({ error: "This excuse was already reviewed" });
    }

    try {
      if (status === "approved") {
        const removalMode = removal === "16" ? "16" : "complete";
        let removedHours = 0;

        if (excuse.type === "advance") {
          // Create/mark the excuse attendance BEFORE the event happens so the
          // auto-absent job never penalizes this student.
          const hadHours = attendance ? attendance.communityServiceHours || 0 : 0;
          const updated = await Attendance.findOneAndUpdate(
            { event: excuse.event._id, student: excuse.student._id },
            { status: "excused" },
            { new: true, upsert: true, setDefaultsOnInsert: true }
          );

          if (removalMode === "complete") {
            if (hadHours > 0 && updated) {
              updated.communityServiceHours = 0;
              updated.communityServiceLog.push({
                action: "removed",
                hours: hadHours,
                note: "Excuse approved (advance)",
              });
              await updated.save();
              removedHours = hadHours;
            }
          } else {
            removedHours = await removeFlatHours(
              excuse.student._id,
              updated._id,
              16,
              "Advance excuse approved (16 hrs removed from CS)"
            );
          }
        } else if (!attendance) {
          const err = new Error("Attendance record not found");
          err.statusCode = 404;
          throw err;
        } else if (removalMode === "complete") {
          // Forgive this event's penalty entirely.
          const hadHours = attendance.communityServiceHours || 0;
          attendance.status = "excused";
          attendance.communityServiceHours = 0;
          if (hadHours > 0) {
            attendance.communityServiceLog.push({
              action: "removed",
              hours: hadHours,
              note: "Excuse approved",
            });
          }
          await attendance.save();
          removedHours = hadHours;
        } else {
          attendance.status = "excused";
          await attendance.save();
          removedHours = await removeFlatHours(
            excuse.student._id,
            attendance._id,
            16,
            "Excuse approved (16 hrs removed from CS)"
          );
        }

        await Excuse.findByIdAndUpdate(excuse._id, { removedHours });

        const message =
          excuse.type === "advance"
            ? `Your advance excuse for "${excuse.event.title}" was approved. You won't receive community service hours if you miss this event.` +
              (removedHours > 0
                ? ` ${removedHours} hours were removed from your community service total.`
                : "")
            : removalMode === "16"
              ? `Your excuse for "${excuse.event.title}" was approved. 16 hours were removed from your community service total.`
              : `Your excuse for "${excuse.event.title}" was approved. Any community service hours for this event have been removed.`;

        await notifyUsers([excuse.student], {
          type: "excuse",
          title: excuse.type === "advance" ? "Advance Excuse Approved" : "Excuse Approved",
          message,
          relatedEvent: excuse.event._id,
          event: excuse.event,
        });
      } else {
        await notifyUsers([excuse.student], {
          type: "excuse",
          title: "Excuse Rejected",
          message: `Your excuse for "${excuse.event.title}" was rejected.${responseNote ? ` Note: ${responseNote}` : ""}`,
          relatedEvent: excuse.event._id,
          event: excuse.event,
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

    res.json(excuse);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
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
    const excuses = await Excuse.find(filter).select("attachments attachmentUrl");
    const result = await Excuse.deleteMany(filter);
    await fileStore.deleteByUrls(
      excuses.flatMap((e) => [...(e.attachments || []), e.attachmentUrl])
    );
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

    const excuse = await Excuse.findById(req.params.id).populate("event", "organizer");
    if (!excuse) {
      return res.status(404).json({ error: "Excuse not found" });
    }
    if (!canManageExcuse(excuse, req.user)) {
      return res.status(403).json({ error: "You are not the organizer of this event" });
    }

    const files = [...(excuse.attachments || []), excuse.attachmentUrl];
    await excuse.deleteOne();
    await fileStore.deleteByUrls(files);
    res.json({ message: "Excuse deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

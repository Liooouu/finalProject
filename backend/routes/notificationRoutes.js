const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const Notification = require("../models/Notification");
const { protect } = require("../middleware/authMiddleware");

const notFound = (res) => res.status(404).json({ error: "Notification not found" });

router.get("/", protect, async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .populate("relatedEvent", "title date")
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (err) {
    console.error("Error fetching notifications:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/unread-count", protect, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      user: req.user._id,
      isRead: false,
    });
    res.json({ count });
  } catch (err) {
    console.error("Error fetching unread count:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/:id/read", protect, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { isRead: true },
      { new: true }
    );
    if (!notification) return notFound(res);
    res.json(notification);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/read-all", protect, async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, isRead: false },
      { isRead: true }
    );
    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/", protect, async (req, res) => {
  try {
    const result = await Notification.deleteMany({ user: req.user._id });
    res.json({
      message: "All notifications deleted",
      deleted: result.deletedCount || 0,
    });
  } catch (err) {
    console.error("Error deleting notifications:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:id", protect, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!notification) return notFound(res);
    res.json({ message: "Notification deleted" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;

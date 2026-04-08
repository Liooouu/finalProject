const express = require("express");
const router = express.Router();

const User = require("../models/User");
const bcrypt = require("bcryptjs");

// ✅ FIX: destructure protect from middleware
const { protect } = require("../middleware/authMiddleware");

// =======================
// GET ACCOUNT INFO
// =======================
router.get("/", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// UPDATE ACCOUNT INFO
// =======================
router.patch("/", protect, async (req, res) => {
  try {
    const { name, email } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, email },
      { new: true }
    ).select("-password");

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// CHANGE PASSWORD
// =======================
router.patch("/password", protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isMatch = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!isMatch) {
      return res
        .status(400)
        .json({ error: "Current password incorrect" });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
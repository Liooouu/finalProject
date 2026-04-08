const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { protect, authorize } = require("../middleware/authMiddleware");

// Admin creates organizer
router.post(
  "/create-organizer",
  protect,
  authorize("admin"),
  async (req, res) => {
    try {
      const { name, email, password } = req.body;

      if (!name || !email || !password)
        return res.status(400).json({ message: "Missing fields" });

      const existing = await User.findOne({ email });
      if (existing)
        return res.status(400).json({ message: "User already exists" });

      const hashedPassword = await bcrypt.hash(password, 10);

      const organizer = new User({
        name,
        email,
        password: hashedPassword,
        role: "organizer",
      });

      await organizer.save();

      res.json({
        message: "Organizer created successfully",
        organizer: {
          id: organizer._id,
          email: organizer.email,
          role: organizer.role,
        },
      });

    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;
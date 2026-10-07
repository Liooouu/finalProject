const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const User = require("../models/User");

// GET USERS (admin/organizer) - optionally filter by ?role=student
router.get("/users", protect, authorize("admin", "organizer"), async (req, res) => {
  try {
    const { role } = req.query;
    const query = {};
    if (role) {
      const roles = String(role)
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean);
      if (roles.length) query.role = roles.length > 1 ? { $in: roles } : roles[0];
    }

    const users = await User.find(query)
      .select("-password -pinHash -pinPlain -trustedDevices")
      .sort({ name: 1 });

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PATCH USER (admin only) - allow editing basic details + program/year/section
router.patch("/users/:id", protect, authorize("admin"), async (req, res) => {
  try {
    const { name, email, program, yearLevel, section, role } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (role !== undefined) user.role = role;
    if (program !== undefined) user.program = String(program).trim().toUpperCase();
    if (section !== undefined) user.section = String(section).trim().toUpperCase();
    if (yearLevel !== undefined) user.yearLevel = Number(yearLevel);

    if (user.role === "student") {
      const allowedPrograms = ["BSIT", "BSCS", "IT", "BSIS", "BSEMC", "OTHER"];
      if (user.program && !allowedPrograms.includes(user.program)) {
        return res.status(400).json({ message: "Invalid program" });
      }
      if (user.yearLevel !== null && user.yearLevel !== undefined) {
        if (!Number.isFinite(user.yearLevel) || user.yearLevel < 1 || user.yearLevel > 4) {
          return res.status(400).json({ message: "Year level must be between 1 and 4" });
        }
      }
      if (user.section && !/^[A-Z]{1,2}$/.test(user.section)) {
        return res.status(400).json({ message: "Section must be 1-2 letters" });
      }
    }

    await user.save();
    const sanitized = user.toObject();
    delete sanitized.password;
    delete sanitized.pinHash;
    res.json(sanitized);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

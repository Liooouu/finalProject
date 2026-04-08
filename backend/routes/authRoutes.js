// backend/routes/authRoutes.js
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// -------------------- REGISTER (STUDENT ONLY) --------------------
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Please fill all fields" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "Email already exists" });

    const user = new User({
      name,
      email,
      password, // ✅ plain (model will hash)
      role: "student",
    });

    await user.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// -------------------- LOGIN (ALL ROLES) --------------------
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: "Please fill all fields" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    // ✅ use model method
    const isMatch = await user.comparePassword(password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid password" });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    console.log("Login successful:", email, "| Role:", user.role);

    res.json({
      token,
      role: user.role,
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// -------------------- ADMIN LOGIN (OPTIONAL) --------------------
router.post("/admin-login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const admin = await User.findOne({ email, role: "admin" });
    if (!admin) return res.status(400).json({ message: "Admin not found" });

    const isMatch = await admin.comparePassword(password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid password" });

    const token = jwt.sign(
      { id: admin._id, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({ token, role: admin.role });
  } catch (err) {
    console.error("ADMIN LOGIN ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
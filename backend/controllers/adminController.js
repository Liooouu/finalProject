const User = require("../models/User");
const bcrypt = require("bcrypt");

const createOrganizer = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: "Missing fields" });

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const organizer = new User({
      name,
      email,
      password: hashedPassword,
      role: "organizer", // ⭐ FORCE ORGANIZER ROLE
    });

    await organizer.save();

    res.status(201).json({
      message: "Organizer account created successfully",
    });
  } catch (err) {
    console.error("Create organizer error:", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createOrganizer };
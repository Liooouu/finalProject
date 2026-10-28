const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { availableRoles } = require("../services/accountRoles");

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) return res.status(401).json({ message: "Not authorized, no token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Exclude every credential secret, not just the password: the code hashes
    // and legacy authentication fields must never enter a response.
    const user = await User.findById(decoded.id).select(
      "-password -pinHash -pinPlain -trustedDevices -emailVerificationCodeHash -passwordResetCodeHash"
    );
    if (!user) {
      return res.status(401).json({ message: "Not authorized, user no longer exists" });
    }
    const activeRole = decoded.role || user.role;
    if (!availableRoles(user).includes(activeRole) || (activeRole === "organizer" && user.role === "student" && (decoded.organizerVersion || 0) !== (user.organizerAccessVersion || 0))) {
      return res.status(401).json({ message: "Your account access has changed. Please sign in again." });
    }
    // Never modify the Mongoose document's stored student role for a portal switch.
    req.user = activeRole === user.role ? user : { ...(user.toObject ? user.toObject() : user), accountRole: user.role, role: activeRole };
    req.authRole = activeRole;
    next();
  } catch (err) {
    console.error(err);
    res.status(401).json({ message: "Not authorized, token failed" });
  }
};

// Role-based access
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: Insufficient permissions" });
    }
    next();
  };
};

module.exports = { protect, authorize };
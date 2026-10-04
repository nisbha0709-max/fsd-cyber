const jwt = require("jsonwebtoken");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { str } = require("../utils/validate");

const signToken = (user) =>
  jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "1d" });

const EMAIL_RE = /^\S+@\S+\.\S+$/;

// POST /api/auth/register  (first account becomes admin, later ones are analysts)
exports.register = asyncHandler(async (req, res) => {
  const userCount = await User.countDocuments();
  if (process.env.ALLOW_PUBLIC_REGISTRATION === "false" && userCount > 0) {
    throw new ApiError(403, "Public registration is disabled. Ask an admin to create your account.");
  }

  const name = str(req.body.name, "Name", { min: 2, max: 80 });
  const email = str(req.body.email, "Email", { max: 120 }).toLowerCase();
  const password = str(req.body.password, "Password", { min: 8, max: 128 });
  if (!EMAIL_RE.test(email)) throw new ApiError(400, "Invalid email address");
  if (await User.findOne({ email })) throw new ApiError(409, "Email already registered");

  const user = await User.create({ name, email, password, role: userCount === 0 ? "admin" : "analyst" });
  res.status(201).json({ success: true, token: signToken(user), user });
});

// POST /api/auth/login
exports.login = asyncHandler(async (req, res) => {
  const email = str(req.body.email, "Email", { max: 120 }).toLowerCase();
  const password = str(req.body.password, "Password", { max: 128 });

  const user = await User.findOne({ email }).select("+password");
  // Same message for unknown email / wrong password / disabled account
  if (!user || !user.isActive || !(await user.comparePassword(password))) {
    throw new ApiError(401, "Invalid email or password");
  }

  user.lastLoginAt = new Date();
  await user.save();
  res.json({ success: true, token: signToken(user), user });
});

// GET /api/auth/me
exports.me = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user });
});

// PATCH /api/auth/password
exports.changePassword = asyncHandler(async (req, res) => {
  const currentPassword = str(req.body.currentPassword, "Current password", { max: 128 });
  const newPassword = str(req.body.newPassword, "New password", { min: 8, max: 128 });

  const user = await User.findById(req.user._id).select("+password");
  if (!(await user.comparePassword(currentPassword))) throw new ApiError(401, "Current password is incorrect");

  user.password = newPassword;
  await user.save();
  res.json({ success: true, message: "Password updated" });
});

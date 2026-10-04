const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { ROLES } = require("../utils/constants");
const { str, oneOf } = require("../utils/validate");

// GET /api/users?role=responder&active=true   (admin, analyst - needed for the "assign to" dropdown)
exports.listUsers = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.role) filter.role = oneOf(String(req.query.role), ROLES, "role");
  if (req.query.active !== undefined) filter.isActive = String(req.query.active) === "true";

  const users = await User.find(filter).sort("name");
  res.json({ success: true, count: users.length, data: users });
});

// POST /api/users   (admin creates an account with any role)
exports.createUser = asyncHandler(async (req, res) => {
  const name = str(req.body.name, "Name", { min: 2, max: 80 });
  const email = str(req.body.email, "Email", { max: 120 }).toLowerCase();
  const password = str(req.body.password, "Password", { min: 8, max: 128 });
  const role = oneOf(req.body.role || "analyst", ROLES, "role");

  if (!/^\S+@\S+\.\S+$/.test(email)) throw new ApiError(400, "Invalid email address");
  if (await User.findOne({ email })) throw new ApiError(409, "Email already registered");

  const user = await User.create({ name, email, password, role });
  res.status(201).json({ success: true, data: user });
});

// PATCH /api/users/:id   (admin: change name / role / active flag)
exports.updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, "User not found");

  const isSelf = String(user._id) === String(req.user._id);
  const { role, isActive } = req.body;
  const name = str(req.body.name, "Name", { min: 2, max: 80, required: false });

  if (name) user.name = name;
  if (role !== undefined) {
    oneOf(role, ROLES, "role");
    if (isSelf && role !== "admin") throw new ApiError(400, "You cannot remove your own admin role");
    user.role = role;
  }
  if (isActive !== undefined) {
    if (typeof isActive !== "boolean") throw new ApiError(400, "isActive must be true or false");
    if (isSelf && !isActive) throw new ApiError(400, "You cannot deactivate your own account");
    user.isActive = isActive;
  }

  await user.save();
  res.json({ success: true, data: user });
});

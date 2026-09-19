const mongoose = require("mongoose");
const { getRoleName, hasPermission } = require("./adminPermissions");

const asyncHandler = require("express-async-handler");

const canUpdateUser = asyncHandler(async (req, res, next) => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    res.status(400);
    throw new Error("Request body must be an object");
  }
  const id = req.params.id;

  if (!mongoose.isValidObjectId(id)) {
    res.status(404);
    throw new Error("User not found");
  }

  if (req.body._id !== undefined && req.body._id !== id) {
    res.status(400);
    throw new Error("User ID must match the request");
  }

  if (req.route.path === "/userOne/:id" && req.body._id !== id) {
    res.status(400);
    throw new Error("Please include the user ID");
  }

  if (req.route.path === "/user/:id" && req.body.password !== undefined) {
    res.status(403);
    throw new Error("Use the password update route to change a password");
  }

  for (const field of Object.keys(req.body)) {
    if (
      field.startsWith("$") ||
      field.includes(".") ||
      ["resetPasswordToken", "resetPasswordExpires", "okrRole"].includes(field)
    ) {
      res.status(403);
      throw new Error("You cannot update this account field");
    }
  }

  if (
    req.body.roles !== undefined &&
    (!Array.isArray(req.body.roles) ||
      req.body.roles.some((role) => typeof role !== "string" || !role.trim()))
  ) {
    res.status(400);
    throw new Error("Roles must be a list of role names");
  }

  if (
    getRoleName(req.user) === "Admin" &&
    (await hasPermission(req.user, "Manage Users"))
  ) {
    next();
    return;
  }

  if (req.user._id.toString() !== id) {
    res.status(403);
    throw new Error("You can only update your own account");
  }

  const allowedFields = [
    "_id",
    "firstName",
    "lastName",
    "email",
    "phoneNumber",
    "roles",
  ];

  if (req.route.path === "/userOne/:id") {
    allowedFields.push("password");
  }

  const fields = Object.keys(req.body);

  for (let i = 0; i < fields.length; i++) {
    if (!allowedFields.includes(fields[i])) {
      res.status(403);
      throw new Error("You cannot update this account field");
    }
  }

  // The account page sends roles even when only a name is changed.
  if (
    req.body.roles !== undefined &&
    JSON.stringify(req.body.roles) !== JSON.stringify(req.user.roles)
  ) {
    res.status(403);
    throw new Error("Only admins or executives can change roles");
  }

  next();
});

module.exports = { canUpdateUser };

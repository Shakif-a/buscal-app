const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const OkrObjective = require("../models/okrObjectiveModel");
const { getRoleName, hasPermission } = require("./adminPermissions");

const canCreateObjective = asyncHandler(async (req, res, next) => {
  const role = getRoleName(req.user);

  if (role === "Employee") {
    res.status(403);
    throw new Error("You do not have permission to create objectives");
  }

  const allowed = await hasPermission(req.user, "Create Objectives");

  if (!allowed) {
    res.status(403);
    throw new Error("You do not have permission to create objectives");
  }

  next();
});

const canManageObjective = asyncHandler(async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(404);
    throw new Error("Objective not found");
  }

  const objective = await OkrObjective.findById(req.params.id);

  if (!objective) {
    res.status(404);
    throw new Error("Objective not found");
  }

  const isOwner = objective.owner.toString() === req.user._id.toString();

  if (isOwner) {
    next();
    return;
  }

  const role = getRoleName(req.user);

  if (role === "Employee") {
    res.status(403);
    throw new Error("You do not have permission to manage this objective");
  }

  const allowed = await hasPermission(req.user, "Edit Objectives");

  if (!allowed) {
    res.status(403);
    throw new Error("You do not have permission to manage this objective");
  }

  next();
});

module.exports = {
  canCreateObjective,
  canManageObjective,
};

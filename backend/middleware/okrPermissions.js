const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const OkrGroup = require("../models/okrGroupModel");
const OkrObjective = require("../models/okrObjectiveModel");
const {
  getRoleName,
  hasPermission,
  hasRolePermission,
} = require("./adminPermissions");

async function managesGroup(user, groupName) {
  if (!groupName) {
    return false;
  }

  const group = await OkrGroup.findOne({
    name: groupName,
    manager: user._id,
  });

  return Boolean(group);
}

const canCreateObjective = asyncHandler(async (req, res, next) => {
  const role = getRoleName(req.user);

  if (role === "Employee") {
    const groupName = req.body ? req.body.group : "";
    const isGroupManager = await managesGroup(req.user, groupName);

    if (!isGroupManager) {
      res.status(403);
      throw new Error("You do not have permission to create objectives");
    }

    const allowed = await hasRolePermission("Manager", "Create Objectives");

    if (!allowed) {
      res.status(403);
      throw new Error("You do not have permission to create objectives");
    }

    next();
    return;
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
    const isGroupManager = await managesGroup(req.user, objective.group);

    if (!isGroupManager) {
      res.status(403);
      throw new Error("You do not have permission to manage this objective");
    }

    if (
      req.body &&
      typeof req.body.group === "string" &&
      req.body.group.trim() !== objective.group
    ) {
      const managesNewGroup = await managesGroup(
        req.user,
        req.body.group.trim()
      );

      if (!managesNewGroup) {
        res.status(403);
        throw new Error("You do not have permission to move this objective");
      }
    }

    const allowed = await hasRolePermission("Manager", "Edit Objectives");

    if (!allowed) {
      res.status(403);
      throw new Error("You do not have permission to manage this objective");
    }

    next();
    return;
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

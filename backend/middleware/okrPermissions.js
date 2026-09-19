const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const OkrGroup = require("../models/okrGroupModel");
const OkrObjective = require("../models/okrObjectiveModel");
const {
  getRoleName,
  hasPermission,
  hasRolePermission,
} = require("./adminPermissions");

async function managesGroup(user, groupName, session) {
  if (typeof groupName !== "string" || !groupName.trim()) {
    return false;
  }

  const group = await OkrGroup.findOne(
    {
      name: groupName.trim(),
      manager: user._id,
    },
    null,
    { session },
  );

  return Boolean(group);
}

async function canUserManageObjective(user, objective, session) {
  const ownerId = objective.owner && (objective.owner._id || objective.owner);
  const isOwner = ownerId && ownerId.toString() === user._id.toString();

  if (isOwner) {
    return true;
  }

  const role = getRoleName(user);

  if (role === "Employee") {
    const isGroupManager = await managesGroup(user, objective.group, session);

    if (!isGroupManager) {
      return false;
    }

    return hasRolePermission("Manager", "Edit Objectives", session);
  }

  return hasPermission(user, "Edit Objectives", session);
}

const canCreateObjective = asyncHandler(async (req, res, next) => {
  if (
    req.body &&
    req.body.group !== undefined &&
    typeof req.body.group !== "string"
  ) {
    res.status(400);
    throw new Error("Please select a valid group");
  }
  const allowed = await canUserCreateObjective(req.user, req.body?.group);

  if (!allowed) {
    res.status(403);
    throw new Error("You do not have permission to create objectives");
  }

  next();
});

async function canUserCreateObjective(user, groupName, session) {
  const role = getRoleName(user);

  if (role === "Employee") {
    const isGroupManager = await managesGroup(user, groupName, session);

    if (!isGroupManager) {
      return false;
    }

    return hasRolePermission("Manager", "Create Objectives", session);
  }

  return hasPermission(user, "Create Objectives", session);
}

async function hasObjectivePermission(user, objective, permission, session) {
  let role = getRoleName(user);
  if (
    role === "Employee" &&
    (await managesGroup(user, objective.group, session))
  ) {
    role = "Manager";
  }
  return hasRolePermission(role, permission, session);
}

async function assertObjectiveAccess(req, res, objective, session, permission) {
  const allowed = await canUserManageObjective(req.user, objective, session);
  if (
    !allowed ||
    (permission &&
      !(await hasObjectivePermission(req.user, objective, permission, session)))
  ) {
    res.status(403);
    throw new Error("You do not have permission to manage this objective");
  }
  const ownerId = objective.owner && (objective.owner._id || objective.owner);
  const isOwner = ownerId && ownerId.toString() === req.user._id.toString();
  if (
    !isOwner &&
    getRoleName(req.user) === "Employee" &&
    req.body &&
    typeof req.body.group === "string" &&
    req.body.group.trim() !== objective.group &&
    !(await managesGroup(req.user, req.body.group, session))
  ) {
    res.status(403);
    throw new Error("You do not have permission to move this objective");
  }
}

function objectiveAccess(permission) {
  return asyncHandler(async (req, res, next) => {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) {
      res.status(404);
      throw new Error("Objective not found");
    }
    const objective = await OkrObjective.findById(req.params.id);
    if (!objective) {
      res.status(404);
      throw new Error("Objective not found");
    }
    await assertObjectiveAccess(req, res, objective, undefined, permission);
    next();
  });
}

const canManageObjective = objectiveAccess();
const canCreateKeyResult = objectiveAccess("Create Key Results");
const canApproveKeyResult = objectiveAccess("Approve Key Results");

module.exports = {
  assertObjectiveAccess,
  hasObjectivePermission,
  canUserManageObjective,
  canUserCreateObjective,
  canCreateObjective,
  canManageObjective,
  canCreateKeyResult,
  canApproveKeyResult,
};

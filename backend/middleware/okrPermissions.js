const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const OkrObjective = require("../models/okrObjectiveModel");

function hasManagementAccess(user) {
  if (user.roles && user.roles.includes("admin")) {
    return true;
  }

  if (user.exec === "yes") {
    return true;
  }

  if (user.companyRoles) {
    for (let i = 0; i < user.companyRoles.length; i++) {
      const level = user.companyRoles[i].managementLevel;

      if (level >= 1 && level <= 3) {
        return true;
      }
    }
  }

  return false;
}

const canCreateObjective = (req, res, next) => {
  if (!hasManagementAccess(req.user)) {
    res.status(403);
    throw new Error("You do not have permission to create objectives");
  }

  next();
};

const canManageObjective = asyncHandler(async (req, res, next) => {
  
  const objectiveId = req.params.id || req.params.objectiveId;

  if (!mongoose.isValidObjectId(objectiveId)) {
    res.status(404);
    throw new Error("Objective not found");
  }

  const objective = await OkrObjective.findById(objectiveId);

  if (!objective) {
    res.status(404);
    throw new Error("Objective not found");
  }

  const isOwner = objective.owner.toString() === req.user._id.toString();

  if (!hasManagementAccess(req.user) && !isOwner) {
    res.status(403);
    throw new Error("You do not have permission to manage this objective");
  }

  next();
});

module.exports = {
  canCreateObjective,
  canManageObjective,
};

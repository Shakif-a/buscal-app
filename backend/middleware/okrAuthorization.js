const asyncHandler = require("express-async-handler");

const OKR_MANAGER_ROLES = new Set(["admin", "qm", "manager"]);

// Merges account roles and company roles into one lowercase list.
function normaliseRoles(user) {
  if (!user) return [];
  const accountRoles = Array.isArray(user.roles) ? user.roles : [];
  const companyRoles = Array.isArray(user.companyRoles)
    ? user.companyRoles.map((entry) => entry?.role)
    : [];
  return [...accountRoles, ...companyRoles]
    .filter(Boolean)
    .map((role) => String(role).trim().toLowerCase());
}

function isOkrManager(user) {
  return normaliseRoles(user).some((role) => OKR_MANAGER_ROLES.has(role));
}

// Blocks the route unless the user is a manager/admin.
const requireOkrManager = asyncHandler(async (req, res, next) => {
  if (!isOkrManager(req.user)) {
    res.status(403);
    throw new Error("This action requires an OKR manager or administrator role");
  }
  next();
});

const ADMIN_ROLES = new Set(["admin"]);

function isAdmin(user) {
  return normaliseRoles(user).some((role) => ADMIN_ROLES.has(role));
}

// Handles both a raw owner id and a populated owner document.
function isObjectiveOwner(objective, user) {
  if (!objective || !user) return false;
  const ownerId =
    objective.owner && objective.owner._id ? objective.owner._id : objective.owner;
  return String(ownerId) === String(user.id || user._id);
}

// admin, owner, manager, or staff.
function accessTierFor(objective, user) {
  if (isAdmin(user)) return "admin";
  if (isObjectiveOwner(objective, user)) return "owner";
  if (isOkrManager(user)) return "manager";
  return "staff";
}

// Owners and managers can edit an objective, staff cannot.
function canEditObjective(objective, user) {
  return isAdmin(user) || isObjectiveOwner(objective, user) || isOkrManager(user);
}

// Managers can approve, but never their own submission (unless admin).
function canApprove(keyResult, objective, user) {
  if (isAdmin(user)) return true;
  if (!isOkrManager(user)) return false;
  const submitterIsReviewer =
    keyResult.submittedBy && String(keyResult.submittedBy) === String(user.id || user._id);
  return !submitterIsReviewer;
}

// Blocks the route unless the user is an admin.
const requireAdmin = asyncHandler(async (req, res, next) => {
  if (!isAdmin(req.user)) {
    res.status(403);
    throw new Error("This action requires an administrator role");
  }
  next();
});

module.exports = {
  isOkrManager,
  requireOkrManager,
  isAdmin,
  requireAdmin,
  isObjectiveOwner,
  accessTierFor,
  canEditObjective,
  canApprove,
  normaliseRoles,
};

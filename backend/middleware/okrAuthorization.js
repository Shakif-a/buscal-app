const asyncHandler = require("express-async-handler");

const OKR_MANAGER_ROLES = new Set(["admin", "qm", "manager"]);

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

const requireOkrManager = asyncHandler(async (req, res, next) => {
  if (!isOkrManager(req.user)) {
    res.status(403);
    throw new Error("This action requires an OKR manager or administrator role");
  }
  next();
});

// Four access tiers:
// admin  - everything, including other people's objectives
// manager - creates/edits objectives, approves key results
// owner  - the person accountable for one objective, full control of just that one
// staff  - any signed-in employee, reads what they can see and updates their own work
//
// Ownership is per record rather than a role, so the check takes the
// document as well as the user.

const ADMIN_ROLES = new Set(["admin"]);

function isAdmin(user) {
  return normaliseRoles(user).some((role) => ADMIN_ROLES.has(role));
}

// Does this user own this objective?
// objective.owner may be a raw id or a populated user document (if the
// caller populated it to read the owner's name); handle both.
function isObjectiveOwner(objective, user) {
  if (!objective || !user) return false;
  const ownerId =
    objective.owner && objective.owner._id ? objective.owner._id : objective.owner;
  return String(ownerId) === String(user.id || user._id);
}

// The tier to report back to the frontend so it can show the right controls.
function accessTierFor(objective, user) {
  if (isAdmin(user)) return "admin";
  if (isObjectiveOwner(objective, user)) return "owner";
  if (isOkrManager(user)) return "manager";
  return "staff";
}

// Can this user change the objective itself (title, dates, weights, lifecycle)?
// Owners and managers can. Staff cannot.
function canEditObjective(objective, user) {
  return isAdmin(user) || isObjectiveOwner(objective, user) || isOkrManager(user);
}

// Approving your own work defeats the point of an approval step, so an owner
// cannot sign off their own key result unless they are also an admin. This is
// the one rule people push back on, and it is the one worth keeping.
function canApprove(keyResult, objective, user) {
  if (isAdmin(user)) return true;
  if (!isOkrManager(user)) return false;
  const submitterIsReviewer =
    keyResult.submittedBy && String(keyResult.submittedBy) === String(user.id || user._id);
  return !submitterIsReviewer;
}

// Middleware form for routes that only admins may touch.
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

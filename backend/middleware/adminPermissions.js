const OkrRolePermission = require("../models/okrRolePermissionModel");

const defaultPermissions = {
  Admin: [
    "Create Objectives",
    "Edit Objectives",
    "Create Key Results",
    "Approve Key Results",
    "View Reports",
    "Manage Users",
    "Manage Roles",
    "Manage Groups",
  ],
  Manager: [
    "Create Objectives",
    "Edit Objectives",
    "Create Key Results",
    "Approve Key Results",
    "View Reports",
  ],
  Employee: ["View Reports"],
};

function isAdminOrExec(user) {
  if (user.roles && user.roles.includes("admin")) {
    return true;
  }

  return user.exec === "yes";
}

function getRoleName(user) {
  if (isAdminOrExec(user)) {
    return "Admin";
  }

  if (user.companyRoles) {
    for (let i = 0; i < user.companyRoles.length; i++) {
      const level = user.companyRoles[i].managementLevel;

      if (level >= 1 && level <= 3) {
        return "Manager";
      }
    }
  }

  return "Employee";
}

async function hasPermission(user, permission) {
  const role = getRoleName(user);
  const savedRole = await OkrRolePermission.findOne({ role });

  if (savedRole) {
    return savedRole.permissions.includes(permission);
  }

  return defaultPermissions[role].includes(permission);
}

function adminOrExec(req, res, next) {
  if (!isAdminOrExec(req.user)) {
    res.status(403);
    throw new Error("Admin or executive access is required");
  }

  next();
}

module.exports = {
  adminOrExec,
  defaultPermissions,
  hasPermission,
};

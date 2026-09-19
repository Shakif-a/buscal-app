const asyncHandler = require("express-async-handler");
const OkrRolePermission = require("../models/okrRolePermissionModel");

const {
  defaultPermissions,
  isSystemRole,
  allowedPermissions,
} = require("../config/okrPermissions");

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

  if (user.okrRole) return user.okrRole;

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

async function hasRolePermission(role, permission, session) {
  const savedRole = await OkrRolePermission.findOne({ role }, null, {
    session,
  });

  if (savedRole) {
    return (
      allowedPermissions(role).includes(permission) &&
      savedRole.permissions.includes(permission)
    );
  }

  return isSystemRole(role) && defaultPermissions[role].includes(permission);
}

async function hasPermission(user, permission, session) {
  const role = getRoleName(user);
  return hasRolePermission(role, permission, session);
}

function adminOrExec(req, res, next) {
  if (!isAdminOrExec(req.user)) {
    res.status(403);
    throw new Error("Admin or executive access is required");
  }

  next();
}

function requirePermission(...permissions) {
  return asyncHandler(async (req, res, next) => {
    for (const permission of permissions) {
      if (await hasPermission(req.user, permission)) {
        next();
        return;
      }
    }
    res.status(403);
    throw new Error("Permission required: " + permissions.join(" or "));
  });
}

module.exports = {
  requirePermission,
  adminOrExec,
  defaultPermissions,
  getRoleName,
  hasPermission,
  hasRolePermission,
};

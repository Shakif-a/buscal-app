const asyncHandler = require("express-async-handler");
const OkrRolePermission = require("../models/okrRolePermissionModel");

const {
  defaultPermissions,
  newDefaultPermissions,
  isSystemRole,
  allowedPermissions,
  lockedPermissionsFor,
} = require("../config/okrPermissions");

function isAdminOrExec(user) {
  if (user.roles && user.roles.includes("admin")) {
    return true;
  }

  return user.exec === "yes";
}

// A QM (quality manager) is a level 1 manager.
const roleManagementLevels = { qm: 1 };

function getManagementLevels(user) {
  const levels = [];

  if (user.companyRoles) {
    for (let i = 0; i < user.companyRoles.length; i++) {
      levels.push(user.companyRoles[i].managementLevel);
    }
  }

  if (user.roles) {
    for (let i = 0; i < user.roles.length; i++) {
      if (Object.hasOwn(roleManagementLevels, user.roles[i])) {
        levels.push(roleManagementLevels[user.roles[i]]);
      }
    }
  }

  return levels;
}

function getRoleName(user) {
  if (isAdminOrExec(user)) {
    return "Admin";
  }

  if (user.okrRole) return user.okrRole;

  const levels = getManagementLevels(user);

  for (let i = 0; i < levels.length; i++) {
    if (levels[i] >= 1 && levels[i] <= 3) {
      return "Manager";
    }
  }

  return "Employee";
}

async function hasRolePermission(role, permission, session) {
  if (lockedPermissionsFor(role).includes(permission)) {
    return true;
  }

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

// Give saved system roles any default permission added since they were saved, once
async function seedNewDefaults() {
  for (const permission of newDefaultPermissions) {
    for (const role of Object.keys(defaultPermissions)) {
      if (!defaultPermissions[role].includes(permission)) continue;
      await OkrRolePermission.updateOne(
        { role, seededPermissions: { $ne: permission } },
        {
          $addToSet: {
            permissions: permission,
            seededPermissions: permission,
          },
        },
      );
    }
  }
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
  isAdminOrExec,
  seedNewDefaults,
  defaultPermissions,
  getRoleName,
  hasPermission,
  hasRolePermission,
};

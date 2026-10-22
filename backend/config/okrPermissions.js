const permissionNames = [
  "Create Objectives",
  "Edit Objectives",
  "Create Key Results",
  "Edit Key Results",
  "Approve Key Results",
  "View Reports",
  "Manage Users",
  "Manage Roles",
  "Manage Groups",
];

const defaultPermissions = {
  Admin: [...permissionNames],
  Manager: permissionNames.filter((name) => !name.startsWith("Manage ")),
  Employee: ["View Reports"],
};

// Permissions a role can never lose. Admins keep access to the role editor
// and reports so a saved change cannot lock every administrator out.
const lockedPermissions = {
  Admin: ["Manage Roles", "View Reports"],
};

function lockedPermissionsFor(role) {
  return Object.hasOwn(lockedPermissions, role) ? lockedPermissions[role] : [];
}

function isSystemRole(role) {
  return Object.hasOwn(defaultPermissions, role);
}

// Only Admins can have manage permissions
// Managers can't manage users, roles, or groups
// Employees cannot Create or Edit Objectives
function allowedPermissions(role) {
  return permissionNames.filter((permission) => {
    if (role !== "Admin" && permission.startsWith("Manage ")) return false;
    if (
      role === "Employee" &&
      ["Create Objectives", "Edit Objectives"].includes(permission)
    )
      return false;
    return true;
  });
}

module.exports = {
  permissionNames,
  defaultPermissions,
  isSystemRole,
  allowedPermissions,
  lockedPermissionsFor,
};

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
  // Employees don't get reports by default
  Employee: [],
};

// Permissions a role can never lose. Admins keep access to the role editor,
// user management and reports so a saved change cannot lock every administrator out.
const lockedPermissions = {
  Admin: ["Manage Roles", "Manage Users", "View Reports"],
};

function lockedPermissionsFor(role) {
  return Object.hasOwn(lockedPermissions, role) ? lockedPermissions[role] : [];
}

function isSystemRole(role) {
  return Object.hasOwn(defaultPermissions, role);
}

// Only Admins can manage roles
// Managers can't manage users, roles, or groups
// Employees cannot Create or Edit Objectives
function allowedPermissions(role) {
  return permissionNames.filter((permission) => {
    if (role !== "Admin" && permission.startsWith("Manage ")) {
      if (isSystemRole(role) || permission === "Manage Roles") return false;
    }
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

const permissionNames = [
  "Create Objectives",
  "Edit Objectives",
  "Create Key Results",
  "Edit Key Results",
  "Approve Key Results",
  "View Reports",
  "View All OKRs",
  "Manage Users",
  "Manage Roles",
  "Manage Groups",
];

const defaultPermissions = {
  Admin: [...permissionNames],
  // Only Admins see every objective by default
  Manager: permissionNames.filter(
    (name) => !name.startsWith("Manage ") && name !== "View All OKRs",
  ),
  // Employees don't get reports by default
  Employee: [],
};

// Defaults added after roles were already being saved. Saved system roles get each
// of these once (see seedNewDefaults), then they can be turned off like any other.
const newDefaultPermissions = ["View All OKRs"];

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

// Admins and custom roles can manage roles
// Managers can manage groups but not users or roles
// Employees cannot Create or Edit Objectives or manage anything
function allowedPermissions(role) {
  return permissionNames.filter((permission) => {
    if (role !== "Admin" && permission.startsWith("Manage ")) {
      if (role === "Manager" && permission === "Manage Groups") return true;
      if (isSystemRole(role)) return false;
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
  newDefaultPermissions,
  isSystemRole,
  allowedPermissions,
  lockedPermissionsFor,
};

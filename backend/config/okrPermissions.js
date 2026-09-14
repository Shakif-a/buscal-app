const permissionNames = [
  "Create Objectives",
  "Edit Objectives",
  "Create Key Results",
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

function isSystemRole(role) {
  return Object.hasOwn(defaultPermissions, role);
}

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
};

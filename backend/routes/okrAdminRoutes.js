const express = require("express");
const router = express.Router();
const { requireObjectBody } = require("../middleware/errorMiddleware");
router.use(requireObjectBody);
const {
  createGroup,
  getAdminUsers,
  getGroups,
  getRolePermissions,
  updateGroup,
  updateRolePermissions,
  getRoles,
  createRole,
  renameRole,
  deleteRole,
  assignRole,
  deleteGroup,
} = require("../controllers/okrAdminController");
const { protect } = require("../middleware/authMiddleware");
const {
  adminOrExec,
  requirePermission,
} = require("../middleware/adminPermissions");

router.use(protect, adminOrExec);

router.get(
  "/users",
  requirePermission("Manage Users", "Manage Groups"),
  getAdminUsers,
);
router.get("/groups", requirePermission("Manage Groups"), getGroups);
router.post("/groups", requirePermission("Manage Groups"), createGroup);
router.put("/groups/:id", requirePermission("Manage Groups"), updateGroup);
router.delete("/groups/:id", requirePermission("Manage Groups"), deleteGroup);
router.get(
  "/roles",
  requirePermission("Manage Roles", "Manage Users"),
  getRoles,
);
router.post("/roles", requirePermission("Manage Roles"), createRole);
router.put("/roles/:role", requirePermission("Manage Roles"), renameRole);
router.delete("/roles/:role", requirePermission("Manage Roles"), deleteRole);
router.put("/users/:id/role", requirePermission("Manage Users"), assignRole);
router.get(
  "/permissions",
  requirePermission("Manage Roles"),
  getRolePermissions,
);
router.put(
  "/permissions/:role",
  requirePermission("Manage Roles"),
  updateRolePermissions,
);

module.exports = router;

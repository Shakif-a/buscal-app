const express = require("express");
const router = express.Router();
const {
  createGroup,
  getAdminUsers,
  getGroups,
  getRolePermissions,
  updateGroup,
  updateRolePermissions,
} = require("../controllers/okrAdminController");
const { protect } = require("../middleware/authMiddleware");
const { adminOrExec } = require("../middleware/adminPermissions");

router.use(protect, adminOrExec);

router.get("/users", getAdminUsers);
router.get("/groups", getGroups);
router.post("/groups", createGroup);
router.put("/groups/:id", updateGroup);
router.get("/permissions", getRolePermissions);
router.put("/permissions/:role", updateRolePermissions);

module.exports = router;

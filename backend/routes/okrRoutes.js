const express = require("express");
const router = express.Router();
const { requireObjectBody } = require("../middleware/errorMiddleware");
router.use(requireObjectBody);

const {
  linkCalendar,
  getReport,
  approveKeyResult,
  getObjectives,
  getObjectiveGroups,
  getObjective,
  createObjective,
  updateObjective,
  deleteObjective,
  createKeyResult,
} = require("../controllers/okrController");

const { protect } = require("../middleware/authMiddleware");
const {
  canCreateObjective,
  canManageObjective,
  canApproveKeyResult,
  canCreateKeyResult,
} = require("../middleware/okrPermissions");

router.get("/", (req, res) => {
  res.json({ message: "OKR Tracker API endpoint" });
});

const {
  requirePermission,
  adminOrExec,
} = require("../middleware/adminPermissions");
router.put(
  "/objectives/:id/calendar-link",
  protect,
  adminOrExec,
  requirePermission("Edit Objectives"),
  linkCalendar,
);
router.get("/reports", protect, requirePermission("View Reports"), getReport);
router.put(
  "/objectives/:id/key-results/:keyResultId/approval",
  protect,
  canApproveKeyResult,
  approveKeyResult,
);

router.get("/objectives", protect, getObjectives);
router.post("/objectives", protect, canCreateObjective, createObjective);
router.get("/objectives/groups", protect, getObjectiveGroups);
router.get("/objectives/:id", protect, getObjective);
router.put("/objectives/:id", protect, canManageObjective, updateObjective);
router.delete("/objectives/:id", protect, canManageObjective, deleteObjective);
router.post(
  "/objectives/:id/key-results",
  protect,
  canCreateKeyResult,
  createKeyResult,
);

module.exports = router;

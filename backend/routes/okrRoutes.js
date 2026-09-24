const express = require("express");
const router = express.Router();
const { requireObjectBody } = require("../middleware/errorMiddleware");
router.use(requireObjectBody);

const evidenceUpload = express.raw({
  type: "application/octet-stream",
  limit: "5mb",
});

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
const {
  uploadEvidence,
  getEvidence,
  downloadEvidence,
  deleteEvidence,
} = require("../controllers/okrEvidenceController");

const { protect } = require("../middleware/authMiddleware");
const { evidenceUploadLimiter } = require("../middleware/evidenceUploadLimiter");
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
router.post(
  "/objectives/:id/key-results/:keyResultId/evidence",
  protect,
  evidenceUploadLimiter,
  evidenceUpload,
  uploadEvidence,
);
router.get(
  "/objectives/:id/key-results/:keyResultId/evidence",
  protect,
  getEvidence,
);
router.get(
  "/objectives/:id/key-results/:keyResultId/evidence/:evidenceId/download",
  protect,
  downloadEvidence,
);
router.delete(
  "/objectives/:id/key-results/:keyResultId/evidence/:evidenceId",
  protect,
  deleteEvidence,
);

module.exports = router;

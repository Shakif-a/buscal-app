const express = require("express");
const router = express.Router();
const { requireObjectBody } = require("../middleware/errorMiddleware");
router.use(requireObjectBody);

const {
  getReport,
  approveKeyResult,
  getObjectives,
  getObjectiveGroups,
  getObjective,
  createObjective,
  updateObjective,
  deleteObjective,
  getKeyResults,
  getKeyResult,
  createKeyResult,
  updateKeyResult,
  deleteKeyResult,
} = require("../controllers/okrController");

const { protect } = require("../middleware/authMiddleware");
const {
  canCreateObjective,
  canManageObjective,
  canApproveKeyResult,
  canCreateKeyResult,
} = require("../middleware/okrPermissions");
const { requirePermission } = require("../middleware/adminPermissions");

router.get("/", (req, res) => {
  res.json({ message: "OKR Tracker API endpoint" });
});

router.get("/reports", protect, requirePermission("View Reports"), getReport);
router.put(
  "/objectives/:id/key-results/:keyResultId/approval",
  protect,
  canApproveKeyResult,
  approveKeyResult,
);

//Objectives
console.log("OKR ROUTES FILE LOADED");

//Key Results
console.log("protect =", typeof protect);
console.log("getKeyResults =", typeof getKeyResults);
router.get("/objectives/:objectiveId/key-results", protect, getKeyResults);
router.post(
  "/objectives/:objectiveId/key-results",
  protect,
  canCreateKeyResult,
  createKeyResult,
);
router.get(
  "/objectives/:objectiveId/key-results/:keyResultId",
  protect,
  getKeyResult,
);
router.put(
  "/objectives/:objectiveId/key-results/:keyResultId",
  protect,
  updateKeyResult,
);
router.delete(
  "/objectives/:objectiveId/key-results/:keyResultId",
  protect,
  deleteKeyResult,
);

//Objectives
router.get("/objectives", protect, getObjectives);
router.post("/objectives", protect, canCreateObjective, createObjective);
router.get("/objectives/groups", protect, getObjectiveGroups);
router.get("/objectives/:id", protect, getObjective);
router.put("/objectives/:id", protect, canManageObjective, updateObjective);
router.delete("/objectives/:id", protect, canManageObjective, deleteObjective);

module.exports = router;
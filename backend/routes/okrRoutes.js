const express = require("express");
const router = express.Router();

const {
  createObjective: createObjectiveCalendar,
  getObjectives: getObjectivesCalendar,
} = require("../controllers/calendarController");

const {
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
} = require("../middleware/okrPermissions");

router.get("/", (req, res) => {
  res.json({ message: "OKR Tracker API endpoint" });
});

//Key Results
router.get("/objectives/:objectiveId/key-results", protect, getKeyResults);
router.post("/objectives/:objectiveId/key-results", protect, canManageObjective, createKeyResult);
router.get("/objectives/:objectiveId/key-results/:keyResultId", protect, getKeyResult);
router.put("/objectives/:objectiveId/key-results/:keyResultId", protect, canManageObjective, updateKeyResult);
router.delete("/objectives/:objectiveId/key-results/:keyResultId", protect, canManageObjective, deleteKeyResult);

//Objectives
router.get("/objectives", protect, getObjectives);
router.post("/objectives", protect, canCreateObjective, createObjective);
router.get("/objectives/groups", protect, getObjectiveGroups);
router.get("/objectives/:id", protect, getObjective);
router.put("/objectives/:id", protect, canManageObjective, updateObjective);
router.delete("/objectives/:id", protect, canManageObjective, deleteObjective);

module.exports = router;

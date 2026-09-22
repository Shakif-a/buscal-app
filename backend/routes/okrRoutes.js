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
  createKeyResult,
} = require("../controllers/okrController");

const { protect } = require("../middleware/authMiddleware");
const {
  canCreateObjective,
  canManageObjective,
} = require("../middleware/okrPermissions");

router.get("/", (req, res) => {
  res.json({ message: "OKR Tracker API endpoint" });
});

router.get("/objectives", protect, getObjectives);
router.post("/objectives", protect, canCreateObjective, createObjective);
router.get("/objectives/groups", protect, getObjectiveGroups);
router.get("/objectives/:id", protect, getObjective);
router.put("/objectives/:id", protect, canManageObjective, updateObjective);
router.delete("/objectives/:id", protect, canManageObjective, deleteObjective);
router.post(
  "/objectives/:id/key-results",
  protect,
  canManageObjective,
  createKeyResult
);

module.exports = router;

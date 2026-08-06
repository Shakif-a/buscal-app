const express = require("express");
const router = express.Router();
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

router.get("/objectives", protect, getObjectives);
router.post("/objectives", protect, createObjective);
router.get("/objectives/groups", protect, getObjectiveGroups);
router.get("/objectives/:id", protect, getObjective);
router.put("/objectives/:id", protect, updateObjective);
router.delete("/objectives/:id", protect, deleteObjective);
router.post("/objectives/:id/key-results", protect, createKeyResult);

module.exports = router;

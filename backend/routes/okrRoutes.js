const express = require("express");
const router = express.Router();
const {
  getObjectives,
  getObjectiveGroups,
  getObjective,
} = require("../controllers/okrController");
const { protect } = require("../middleware/authMiddleware");

router.get("/objectives", protect, getObjectives);
router.get("/objectives/groups", protect, getObjectiveGroups);
router.get("/objectives/:id", protect, getObjective);

module.exports = router;

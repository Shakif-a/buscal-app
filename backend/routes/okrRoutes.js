const express = require("express");
const router = express.Router();
const {
  getObjectives,
  getObjective,
} = require("../controllers/okrController");
const { protect } = require("../middleware/authMiddleware");

router.get("/objectives", protect, getObjectives);
router.get("/objectives/:id", protect, getObjective);

module.exports = router;

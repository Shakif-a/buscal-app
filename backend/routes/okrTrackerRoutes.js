const express = require("express");
const router = express.Router();
const {
  createObjective
} = require("../controllers/calendarController");

const { protect } = require("../middleware/authMiddleware");

// router.post("/objectives", protect, createObjective);

// Default route
router.get("/", (req, res) => {
  res.json({ message: "OKR Tracker API endpoint" });
});

module.exports = router;

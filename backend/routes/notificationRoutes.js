const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
  getUserNotifications,
  updateNotificationStatus,
} = require("../controllers/notificationController");

const router = express.Router();

router.get("/user-notifications", protect, getUserNotifications);
router.patch("/:id/status", protect, updateNotificationStatus);

module.exports = router;

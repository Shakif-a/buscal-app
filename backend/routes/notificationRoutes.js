const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { requireOkrManager } = require("../middleware/okrAuthorization");
const {
  validateObjectId,
  sanitizeBody,
  rateLimit,
} = require("../middleware/okrSecurityMiddleware");
const {
  getUserNotifications,
  updateNotificationStatus,
  pushNotification,
} = require("../controllers/notificationController");

const router = express.Router();

router.use(sanitizeBody);
router.use(rateLimit({ windowMs: 60 * 1000, max: 300 }));

// The controller already existed but had no HTTP boundary in this stripped
// repository. These routes expose only the safe web-notification operations.
router.get("/", protect, getUserNotifications);
router.patch(
  "/:id/read",
  protect,
  validateObjectId("id"),
  updateNotificationStatus
);
router.post("/push", protect, requireOkrManager, pushNotification);

module.exports = router;

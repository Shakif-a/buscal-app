const express = require("express");
const router = express.Router();
const {
  createEntry,
  getAllEntry,
  getEntryById,
  updateEntry,
  updateRecurringEntries,
  reassignEntry,
  deleteEntry,
  deleteRecurringEntries,
  getUserEntries,
  getSupervisorEntries,
  getAllHistory,
  getHistoryById, // Import the new function
} = require("../controllers/calendarController");

const { protect } = require("../middleware/authMiddleware");

router.post("/entries", protect, createEntry);
router.get("/entries", protect, getAllEntry);
router.get("/histories", protect, getAllHistory);
router.get("/histories/:historyId", protect, getHistoryById);
router.put("/entries/:entryId", protect, updateEntry);
router.put("/entries/recur/:entryId", protect, updateRecurringEntries);
router.put("/entries/:entryId/reassign", protect, reassignEntry);
router.delete("/entries/:entryId", protect, deleteEntry);
router.delete("/entries/recur/:entryId", protect, deleteRecurringEntries);
router.get("/entries/user/:id", protect, getUserEntries);
router.get("/entries/supervisor/:id", protect, getSupervisorEntries);
router.get("/entries/:entryId", protect, getEntryById);

// Default route
router.get("/", (req, res) => {
  res.json({ message: "Calendar API endpoint" });
});

module.exports = router;

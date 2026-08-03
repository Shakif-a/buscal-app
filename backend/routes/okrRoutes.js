const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { requireOkrManager } = require("../middleware/okrAuthorization");
const {
  validateObjectId,
  sanitizeBody,
  rateLimit,
} = require("../middleware/okrSecurityMiddleware");
const {
  ping,
  getObjectives,
  getObjective,
  getObjectiveGroups,
  createObjective,
  deleteObjective,
  createKeyResult,
  updateKeyResultProgress,
  approveKeyResult,
  checkWeights,
  getSummary,
  getMyKeyResults,
  checkIn,
  getKeyResultHistory,
  getForecast,
  getInsights,
  getActivity,
  getTrend,
  getLeaderboard,
  updateObjective,
  updateKeyResult,
  deleteKeyResult,
  linkCalendarEntries,
  unlinkCalendarEntry,
  syncKeyResultCalendar,
  syncObjectiveCalendar,
  getObjectiveTree,
} = require("../controllers/okrController");
const {
  activateObjective,
  closeObjective,
  getReadiness,
  addEvidence,
  submitForApproval,
  reviewKeyResult,
  getAuditTrail,
  getResilienceStatus,
  flushCalendarQueue,
} = require("../controllers/okrGovernanceController");
const { selfHeal } = require("../middleware/okrSelfHealingMiddleware");

// Cleans and rate-limits every request handled by this router.
router.use(sanitizeBody);
router.use(
  rateLimit({
    windowMs: Number(process.env.OKR_RATE_LIMIT_WINDOW_MS || 60 * 1000),
    max: Number(process.env.OKR_RATE_LIMIT_MAX || 600),
  })
);

// Checks the id format on every :id route before touching the database.
router.param("id", (req, res, next, value) => validateObjectId("id")(req, res, next));

// Public check used by the Dev Playground to confirm the API is up.
router.get("/ping", ping);

// Dashboard and personal views.
router.get("/summary", protect, getSummary);
router.get("/my-key-results", protect, getMyKeyResults);

// Insights, activity feed and contributor leaderboard.
router.get("/insights", protect, getInsights);
router.get("/activity", protect, getActivity);
router.get("/leaderboard", protect, getLeaderboard);

// Objectives.
router
  .route("/objectives")
  .get(protect, getObjectives)
  .post(protect, requireOkrManager, createObjective);

// Registered before "/objectives/:id" so these words are not read as an id.
router.get("/objectives/tree", protect, getObjectiveTree);
router.get("/objectives/groups", protect, getObjectiveGroups);
// Runs the self-healing pass before returning one objective.
router
  .route("/objectives/:id")
  .get(protect, selfHeal("id"), getObjective)
  .put(protect, requireOkrManager, updateObjective)
  .delete(protect, requireOkrManager, deleteObjective);
router.get("/objectives/:id/weight-check", protect, checkWeights);
router.post(
  "/objectives/:id/key-results",
  protect,
  requireOkrManager,
  createKeyResult
);

// Forecast and progress trend for one objective.
router.get("/objectives/:id/forecast", protect, getForecast);
router.get("/objectives/:id/trend", protect, getTrend);

// Updates this objective's progress from the latest calendar completion.
router.post("/objectives/:id/sync-calendar", protect, selfHeal("id"), syncObjectiveCalendar);

// Lifecycle. Activating requires the weights to total exactly 100.
router.get("/objectives/:id/readiness", protect, getReadiness);
router.post("/objectives/:id/activate", protect, activateObjective);
router.post("/objectives/:id/close", protect, closeObjective);

// Audit trail for one objective.
router.get("/objectives/:id/audit", protect, getAuditTrail);

// Key results.
router.put("/key-results/:id", protect, requireOkrManager, updateKeyResult);
router.delete("/key-results/:id", protect, requireOkrManager, deleteKeyResult);
router.patch("/key-results/:id/progress", protect, updateKeyResultProgress);
router.patch(
  "/key-results/:id/approve",
  protect,
  requireOkrManager,
  approveKeyResult
);
router.post("/key-results/:id/check-in", protect, checkIn);
router.get("/key-results/:id/history", protect, getKeyResultHistory);

// Calendar links, which tie a key result to calendar work.
router
  .route("/key-results/:id/calendar-links")
  .post(protect, requireOkrManager, linkCalendarEntries)
  .delete(protect, requireOkrManager, unlinkCalendarEntry);
router.post("/key-results/:id/sync-calendar", protect, syncKeyResultCalendar);

// Evidence and the approval workflow.
router.post("/key-results/:id/evidence", protect, addEvidence);
router.post("/key-results/:id/submit", protect, submitForApproval);
router.post("/key-results/:id/review", protect, requireOkrManager, reviewKeyResult);

// Status and manual retry for the calendar connection.
router.get("/system/resilience", protect, getResilienceStatus);
router.post("/system/flush-calendar-queue", protect, requireOkrManager, flushCalendarQueue);

module.exports = router;

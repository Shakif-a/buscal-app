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

// OKR routes, mounted at /api/okr in server.js. "ping" is public so the Dev
// Playground can confirm the API is up without logging in. Everything else
// needs a valid token (protect middleware).

// Module-wide guards: strip NoSQL operator keys out of every request body and
// keep request volume within sane bounds (generous enough for real use, tight
// enough to blunt brute-force scripts).
router.use(sanitizeBody);
router.use(
  rateLimit({
    windowMs: Number(process.env.OKR_RATE_LIMIT_WINDOW_MS || 60 * 1000),
    max: Number(process.env.OKR_RATE_LIMIT_MAX || 600),
  })
);

// Every route with an :id gets the format checked before any database work,
// so malformed ids return a clean 400 instead of a CastError 500.
router.param("id", (req, res, next, value) => validateObjectId("id")(req, res, next));

// Public reachability check.
router.get("/ping", ping);

// Personal / dashboard views.
router.get("/summary", protect, getSummary);
router.get("/my-key-results", protect, getMyKeyResults);

// Smart features: insights, activity feed and the contributor leaderboard.
router.get("/insights", protect, getInsights);
router.get("/activity", protect, getActivity);
router.get("/leaderboard", protect, getLeaderboard);

// Objectives.
router
  .route("/objectives")
  .get(protect, getObjectives)
  .post(protect, requireOkrManager, createObjective);

// The top-down strategy tree, and the list of group names already in use.
// Both registered before "/objectives/:id" so the words are never mistaken
// for an object id.
router.get("/objectives/tree", protect, getObjectiveTree);
router.get("/objectives/groups", protect, getObjectiveGroups);
// Reading one objective runs the self-healing pass first, so dead calendar
// links and missing users are cleaned up before the data is served rather than
// blowing up in the handler.
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

// Forecasting and the chart-ready progress trend for one objective.
router.get("/objectives/:id/forecast", protect, getForecast);
router.get("/objectives/:id/trend", protect, getTrend);

// Pull the latest calendar completion through into this objective's progress.
router.post("/objectives/:id/sync-calendar", protect, selfHeal("id"), syncObjectiveCalendar);

// Lifecycle: publishing requires weights to total exactly 100.
router.get("/objectives/:id/readiness", protect, getReadiness);
router.post("/objectives/:id/activate", protect, activateObjective);
router.post("/objectives/:id/close", protect, closeObjective);

// The audit trail for one objective.
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

// Calendar links: tie a key result to calendar work so finishing that work
// moves the objective automatically.
router
  .route("/key-results/:id/calendar-links")
  .post(protect, requireOkrManager, linkCalendarEntries)
  .delete(protect, requireOkrManager, unlinkCalendarEntry);
router.post("/key-results/:id/sync-calendar", protect, syncKeyResultCalendar);

// Evidence and the approval cycle. Anyone doing the work can attach evidence
// and submit; only a manager who did not submit it can review.
router.post("/key-results/:id/evidence", protect, addEvidence);
router.post("/key-results/:id/submit", protect, submitForApproval);
router.post("/key-results/:id/review", protect, requireOkrManager, reviewKeyResult);

// Operational visibility for the resilience layer.
router.get("/system/resilience", protect, getResilienceStatus);
router.post("/system/flush-calendar-queue", protect, requireOkrManager, flushCalendarQueue);

module.exports = router;

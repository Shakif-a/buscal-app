const OkrAuditLog = require("../models/okrAuditLogModel");

// ---------------------------------------------------------------------------
// Audit service.
//
// One place that writes audit rows, so controllers stay readable and every
// entry comes out the same shape. Writing an audit row must never be the reason
// a user's request fails, so failures are logged to the console and swallowed.
// If the audit collection is down we would rather lose a log line than block
// someone from updating their progress.
// ---------------------------------------------------------------------------

async function record({
  actor = null,
  action,
  entityType,
  entityId = null,
  objective = null,
  before = null,
  after = null,
  message,
  severity = "info",
}) {
  try {
    return await OkrAuditLog.create({
      actor,
      action,
      entityType,
      entityId,
      objective,
      before,
      after,
      message,
      severity,
    });
  } catch (error) {
    console.log("Audit write skipped:", error.message);
    return null;
  }
}

// Convenience wrapper for the self-healing layer, which always writes the same
// severity and rarely has a user attached.
async function recordRepair({ action, entityType, entityId, objective, before, after, message }) {
  return record({
    actor: null,
    action,
    entityType,
    entityId,
    objective,
    before,
    after,
    message,
    severity: "repair",
  });
}

// Read the trail for one objective, newest first.
async function forObjective(objectiveId, limit = 50) {
  return OkrAuditLog.find({ objective: objectiveId })
    .populate("actor", "firstName lastName")
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(Number(limit) || 50, 1), 200));
}

module.exports = { record, recordRepair, forObjective };

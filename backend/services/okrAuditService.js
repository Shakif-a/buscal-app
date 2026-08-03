const OkrAuditLog = require("../models/okrAuditLogModel");

// Writes an audit row. A failure here is logged and never blocks the request.
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

// Wrapper for the self-healing layer, which always writes severity "repair".
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

// Reads the audit trail for one objective, newest first.
async function forObjective(objectiveId, limit = 50) {
  return OkrAuditLog.find({ objective: objectiveId })
    .populate("actor", "firstName lastName")
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(Number(limit) || 50, 1), 200));
}

module.exports = { record, recordRepair, forObjective };

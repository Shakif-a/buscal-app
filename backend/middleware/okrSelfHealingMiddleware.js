const mongoose = require("mongoose");
const OkrObjective = require("../models/okrObjectiveModel");
const OkrKeyResult = require("../models/okrKeyResultModel");
const CalendarEntry = require("../models/calendarEntryModel");
const audit = require("../services/okrAuditService");

// ---------------------------------------------------------------------------
// Self-healing layer.
//
// Data drifts. Somebody deletes a calendar entry that a key result was pointing
// at, a user is removed while still assigned work, an import leaves a parent id
// that goes nowhere. None of that should turn into a 500 in front of a customer.
//
// This middleware runs before the read handlers for a single objective. It
// looks for references that no longer resolve, detaches them, recalculates the
// numbers that depended on them, and writes a repair entry to the audit log.
// The request then carries on and returns clean data.
//
// Two deliberate choices:
//
//   Repairs never fail the request. If the repair itself throws, we log it and
//   let the original request through. A broken healer must not be worse than
//   the problem it was healing.
//
//   Repairs are recorded, not silent. Quietly changing someone's numbers is
//   how you lose trust in a system. Every detachment is auditable.
// ---------------------------------------------------------------------------

// Strip calendar references that no longer exist from one key result.
// Returns a description of what changed, or null when it was already clean.
async function healKeyResultCalendarLinks(keyResult) {
  const linked = keyResult.calendarEntries || [];
  if (linked.length === 0) return null;

  // Which of those ids actually still resolve?
  const alive = await CalendarEntry.find({ _id: { $in: linked } }).select("_id");
  const aliveIds = new Set(alive.map((e) => String(e._id)));
  const orphans = linked.filter((id) => !aliveIds.has(String(id)));

  if (orphans.length === 0) return null;

  const before = linked.map(String);
  keyResult.calendarEntries = linked.filter((id) => aliveIds.has(String(id)));

  // If every link is gone the key result cannot be calendar-driven any more.
  // Hand it back to manual updates and keep the last known progress rather than
  // dropping someone's reported figure to zero.
  if (keyResult.calendarEntries.length === 0 && keyResult.progressSource === "calendar") {
    keyResult.progressSource = "manual";
  }

  await keyResult.save();

  await audit.recordRepair({
    action: "calendar.link.orphaned",
    entityType: "keyresult",
    entityId: keyResult._id,
    objective: keyResult.objective,
    before: { calendarEntries: before },
    after: { calendarEntries: keyResult.calendarEntries.map(String) },
    message: `Detached ${orphans.length} deleted calendar item(s) from "${keyResult.title}"`,
  });

  return { keyResultId: String(keyResult._id), detached: orphans.length };
}

// Clear a parent that points at an objective which no longer exists, so the
// strategy tree does not lose the branch entirely.
async function healObjectiveParent(objective) {
  if (!objective.parent) return null;

  const parentExists = await OkrObjective.exists({ _id: objective.parent });
  if (parentExists) return null;

  const before = String(objective.parent);
  objective.parent = null;
  await objective.save();

  await audit.recordRepair({
    action: "objective.parent.orphaned",
    entityType: "objective",
    entityId: objective._id,
    objective: objective._id,
    before: { parent: before },
    after: { parent: null },
    message: `"${objective.title}" pointed at a deleted parent objective, so it is now top level`,
  });

  return { objectiveId: String(objective._id), clearedParent: true };
}

// Clear assignees who no longer have an account.
async function healMissingAssignee(keyResult) {
  if (!keyResult.assignedTo) return null;

  const User = mongoose.model("User");
  const exists = await User.exists({ _id: keyResult.assignedTo });
  if (exists) return null;

  const before = String(keyResult.assignedTo);
  keyResult.assignedTo = null;
  await keyResult.save();

  await audit.recordRepair({
    action: "keyresult.assignee.orphaned",
    entityType: "keyresult",
    entityId: keyResult._id,
    objective: keyResult.objective,
    before: { assignedTo: before },
    after: { assignedTo: null },
    message: `"${keyResult.title}" was assigned to a deleted user, so it is now unassigned`,
  });

  return { keyResultId: String(keyResult._id), clearedAssignee: true };
}

// Run every repair for one objective and report what was fixed.
async function healObjective(objectiveId) {
  const repairs = [];

  const objective = await OkrObjective.findById(objectiveId);
  if (!objective) return repairs;

  const parentFix = await healObjectiveParent(objective);
  if (parentFix) repairs.push(parentFix);

  const keyResults = await OkrKeyResult.find({ objective: objectiveId });
  for (const keyResult of keyResults) {
    const calendarFix = await healKeyResultCalendarLinks(keyResult);
    if (calendarFix) repairs.push(calendarFix);

    const assigneeFix = await healMissingAssignee(keyResult);
    if (assigneeFix) repairs.push(assigneeFix);
  }

  return repairs;
}

// The Express middleware. Attach it to routes that read one objective by id.
// It never blocks the request: any failure inside the healer is logged and the
// handler runs regardless.
function selfHeal(paramName = "id") {
  return async (req, res, next) => {
    const objectiveId = req.params[paramName];

    if (!mongoose.Types.ObjectId.isValid(objectiveId)) {
      return next();
    }

    try {
      const repairs = await healObjective(objectiveId);
      if (repairs.length > 0) {
        // Let the handler mention it in the response if it wants to, and tell
        // the frontend something was cleaned up.
        req.okrRepairs = repairs;
        res.set("X-OKR-Repairs", String(repairs.length));
      }
    } catch (error) {
      console.log("Self-healing pass skipped:", error.message);
    }

    next();
  };
}

module.exports = {
  selfHeal,
  healObjective,
  healKeyResultCalendarLinks,
  healObjectiveParent,
  healMissingAssignee,
};

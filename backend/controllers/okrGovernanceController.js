const asyncHandler = require("express-async-handler");
const OkrObjective = require("../models/okrObjectiveModel");
const OkrKeyResult = require("../models/okrKeyResultModel");
const CalendarEntry = require("../models/calendarEntryModel");
const audit = require("../services/okrAuditService");
const maxbox = require("../services/maxboxCalendarService");
const {
  accessTierFor,
  canEditObjective,
  canApprove,
} = require("../middleware/okrAuthorization");

// ---------------------------------------------------------------------------
// Governance controller.
//
// The parts of the OKR module that decide whether something is allowed rather
// than what it contains: publishing an objective once its weights add up,
// attaching evidence, and the submit / approve / reject cycle. Kept apart from
// okrController so the day-to-day CRUD file stays readable.
// ---------------------------------------------------------------------------

const WEIGHT_TOLERANCE = 0.01;

function sumWeights(keyResults) {
  return keyResults.reduce((total, kr) => total + Number(kr.weight || 0), 0);
}

// Load the objective and confirm the caller may act on it. Returns null and
// sends the response when access is refused, so callers just return.
async function loadEditable(req, res) {
  const objective = await OkrObjective.findById(req.params.id);
  if (!objective) {
    res.status(404).json({ success: false, message: "Objective not found" });
    return null;
  }
  if (!canEditObjective(objective, req.user)) {
    res.status(403).json({
      success: false,
      message: "You do not have permission to change this objective",
    });
    return null;
  }
  return objective;
}

// @desc    Publish a draft objective once its key result weights total 100
// @route   POST /api/okr/objectives/:id/activate
// @access  Owner, manager or admin
//
// This is where the client's "weights must equal 100%" rule is enforced. While
// an objective is a draft the weights can be anything, because you have to be
// able to add the first key result. Publishing is the gate.
const activateObjective = asyncHandler(async (req, res) => {
  const objective = await loadEditable(req, res);
  if (!objective) return;

  if (objective.lifecycle === "active") {
    return res.status(400).json({ success: false, message: "This objective is already active" });
  }

  const keyResults = await OkrKeyResult.find({ objective: objective.id });

  if (keyResults.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Add at least one key result before activating this objective",
      code: "NO_KEY_RESULTS",
    });
  }

  const total = sumWeights(keyResults);
  if (Math.abs(total - 100) > WEIGHT_TOLERANCE) {
    return res.status(400).json({
      success: false,
      message: `Key result weights total ${total}%. They must total exactly 100% before this objective can be activated.`,
      code: "WEIGHTS_NOT_100",
      currentTotal: total,
      difference: Math.round((100 - total) * 100) / 100,
    });
  }

  const before = objective.lifecycle;
  objective.lifecycle = "active";
  await objective.save();

  await audit.record({
    actor: req.user.id,
    action: "objective.activated",
    entityType: "objective",
    entityId: objective._id,
    objective: objective._id,
    before: { lifecycle: before },
    after: { lifecycle: "active" },
    message: `Activated "${objective.title}" with weights totalling ${total}%`,
  });

  res.status(200).json({ success: true, objective, weightTotal: total });
});

// @desc    Close an objective
// @route   POST /api/okr/objectives/:id/close
// @access  Owner, manager or admin
const closeObjective = asyncHandler(async (req, res) => {
  const objective = await loadEditable(req, res);
  if (!objective) return;

  const before = objective.lifecycle;
  objective.lifecycle = "closed";
  await objective.save();

  await audit.record({
    actor: req.user.id,
    action: "objective.closed",
    entityType: "objective",
    entityId: objective._id,
    objective: objective._id,
    before: { lifecycle: before },
    after: { lifecycle: "closed" },
    message: `Closed "${objective.title}" at ${objective.progress}% complete`,
  });

  res.status(200).json({ success: true, objective });
});

// @desc    Readiness check: can this objective be activated yet?
// @route   GET /api/okr/objectives/:id/readiness
// @access  Any signed-in user who can see the objective
//
// Lets the frontend show "80% of 100 allocated, 20% left" and keep the publish
// button disabled, instead of letting someone hit an error.
const getReadiness = asyncHandler(async (req, res) => {
  const objective = await OkrObjective.findById(req.params.id);
  if (!objective) {
    return res.status(404).json({ success: false, message: "Objective not found" });
  }

  const keyResults = await OkrKeyResult.find({ objective: objective.id });
  const total = sumWeights(keyResults);
  const blockers = [];

  if (keyResults.length === 0) {
    blockers.push("No key results have been added yet");
  } else if (Math.abs(total - 100) > WEIGHT_TOLERANCE) {
    const gap = Math.round((100 - total) * 100) / 100;
    blockers.push(
      gap > 0
        ? `Weights total ${total}%, ${gap}% still to allocate`
        : `Weights total ${total}%, ${Math.abs(gap)}% over the limit`
    );
  }
  if (!objective.dueDate) {
    blockers.push("No due date set");
  }

  res.status(200).json({
    objectiveId: objective.id,
    lifecycle: objective.lifecycle,
    weightTotal: total,
    weightRemaining: Math.max(0, Math.round((100 - total) * 100) / 100),
    keyResultCount: keyResults.length,
    canActivate: blockers.length === 0 && objective.lifecycle !== "active",
    blockers,
    yourAccess: accessTierFor(objective, req.user),
  });
});

// @desc    Attach evidence to a key result
// @route   POST /api/okr/key-results/:id/evidence
// @access  Anyone who can update the key result
// Body: { kind, ref, value, label }
const addEvidence = asyncHandler(async (req, res) => {
  const { kind, ref, value, label } = req.body;

  if (!["calendar", "file", "link", "note"].includes(kind)) {
    return res.status(400).json({
      success: false,
      message: "Evidence kind must be calendar, file, link or note",
    });
  }

  const keyResult = await OkrKeyResult.findById(req.params.id);
  if (!keyResult) {
    return res.status(404).json({ success: false, message: "Key result not found" });
  }

  // Calendar evidence has to point at something real, otherwise the audit trail
  // is worthless.
  if (kind === "calendar") {
    const exists = ref ? await CalendarEntry.exists({ _id: ref }) : null;
    if (!exists) {
      return res.status(404).json({
        success: false,
        message: "That calendar entry does not exist",
      });
    }
  }
  if ((kind === "link" || kind === "note") && !value) {
    return res.status(400).json({
      success: false,
      message: `Evidence of kind "${kind}" needs a value`,
    });
  }

  keyResult.evidence.push({
    kind,
    ref: ref || null,
    value: value || "",
    label: label || "",
    addedBy: req.user.id,
    addedAt: new Date(),
  });
  await keyResult.save();

  await audit.record({
    actor: req.user.id,
    action: "keyresult.evidence.added",
    entityType: "keyresult",
    entityId: keyResult._id,
    objective: keyResult.objective,
    after: { kind, label: label || value || "" },
    message: `Added ${kind} evidence to "${keyResult.title}"`,
  });

  res.status(201).json({ success: true, keyResult });
});

// @desc    Submit a key result for approval
// @route   POST /api/okr/key-results/:id/submit
// @access  Anyone who can update the key result
//
// Evidence is required. That is the whole point of an evidence-backed OKR: you
// cannot mark work complete on your word alone.
const submitForApproval = asyncHandler(async (req, res) => {
  const keyResult = await OkrKeyResult.findById(req.params.id);
  if (!keyResult) {
    return res.status(404).json({ success: false, message: "Key result not found" });
  }

  if (!keyResult.evidence || keyResult.evidence.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Attach at least one piece of evidence before submitting for approval",
      code: "EVIDENCE_REQUIRED",
    });
  }

  if (keyResult.approvalState === "approved") {
    return res.status(400).json({ success: false, message: "This key result is already approved" });
  }

  const before = keyResult.approvalState;
  keyResult.approvalState = "pending";
  keyResult.submittedBy = req.user.id;
  keyResult.submittedAt = new Date();
  keyResult.reviewNote = "";
  await keyResult.save();

  await audit.record({
    actor: req.user.id,
    action: "keyresult.submitted",
    entityType: "keyresult",
    entityId: keyResult._id,
    objective: keyResult.objective,
    before: { approvalState: before },
    after: { approvalState: "pending" },
    message: `Submitted "${keyResult.title}" for approval with ${keyResult.evidence.length} piece(s) of evidence`,
  });

  res.status(200).json({ success: true, keyResult });
});

// @desc    Approve or reject a submitted key result
// @route   POST /api/okr/key-results/:id/review
// @access  Manager or admin, and never the person who submitted it
// Body: { decision: "approved" | "rejected", note }
const reviewKeyResult = asyncHandler(async (req, res) => {
  const { decision, note } = req.body;

  if (!["approved", "rejected"].includes(decision)) {
    return res.status(400).json({
      success: false,
      message: 'Decision must be either "approved" or "rejected"',
    });
  }

  const keyResult = await OkrKeyResult.findById(req.params.id);
  if (!keyResult) {
    return res.status(404).json({ success: false, message: "Key result not found" });
  }

  const objective = await OkrObjective.findById(keyResult.objective);
  if (!objective) {
    return res.status(404).json({ success: false, message: "Objective not found" });
  }

  if (!canApprove(keyResult, objective, req.user)) {
    return res.status(403).json({
      success: false,
      message: "You cannot review this key result. Approvals need a manager who did not submit it.",
      code: "SELF_APPROVAL_BLOCKED",
    });
  }

  if (keyResult.approvalState !== "pending") {
    return res.status(400).json({
      success: false,
      message: `This key result is "${keyResult.approvalState}", so there is nothing waiting to be reviewed`,
    });
  }

  // A rejection without a reason just creates another conversation.
  if (decision === "rejected" && !note) {
    return res.status(400).json({
      success: false,
      message: "Please give a reason when rejecting a key result",
      code: "REVIEW_NOTE_REQUIRED",
    });
  }

  const before = keyResult.approvalState;
  keyResult.approvalState = decision;
  keyResult.approved = decision === "approved";
  keyResult.approvedBy = req.user.id;
  keyResult.approvedAt = new Date();
  keyResult.reviewNote = note || "";
  await keyResult.save();

  await audit.record({
    actor: req.user.id,
    action: decision === "approved" ? "keyresult.approved" : "keyresult.rejected",
    entityType: "keyresult",
    entityId: keyResult._id,
    objective: keyResult.objective,
    before: { approvalState: before },
    after: { approvalState: decision },
    message:
      decision === "approved"
        ? `Approved "${keyResult.title}"`
        : `Rejected "${keyResult.title}": ${note}`,
    severity: decision === "rejected" ? "warning" : "info",
  });

  res.status(200).json({ success: true, keyResult });
});

// @desc    Audit trail for one objective
// @route   GET /api/okr/objectives/:id/audit
// @access  Anyone who can see the objective
const getAuditTrail = asyncHandler(async (req, res) => {
  const objective = await OkrObjective.findById(req.params.id);
  if (!objective) {
    return res.status(404).json({ success: false, message: "Objective not found" });
  }

  const entries = await audit.forObjective(objective.id, req.query.limit);
  res.status(200).json({ count: entries.length, entries });
});

// @desc    Resilience status: circuit breaker, queued writes, repairs
// @route   GET /api/okr/system/resilience
// @access  Any signed-in user
//
// What an operator looks at when someone says "the numbers look stale".
const getResilienceStatus = asyncHandler(async (req, res) => {
  res.status(200).json({
    calendar: maxbox.status(),
    checkedAt: new Date().toISOString(),
  });
});

// @desc    Retry queued calendar writes now
// @route   POST /api/okr/system/flush-calendar-queue
// @access  Manager or admin
const flushCalendarQueue = asyncHandler(async (req, res) => {
  const result = await maxbox.flushQueue();
  res.status(200).json({ success: true, ...result });
});

module.exports = {
  activateObjective,
  closeObjective,
  getReadiness,
  addEvidence,
  submitForApproval,
  reviewKeyResult,
  getAuditTrail,
  getResilienceStatus,
  flushCalendarQueue,
};

const asyncHandler = require("express-async-handler");
const OkrObjective = require("../models/okrObjectiveModel");
const OkrKeyResult = require("../models/okrKeyResultModel");
const OkrCheckin = require("../models/okrCheckinModel");
const OkrActivity = require("../models/okrActivityModel");
const CalendarEntry = require("../models/calendarEntryModel");
const { isOkrManager } = require("../middleware/okrAuthorization");

// Main OKR controller. Two rules matter most: key result weights under one
// objective can never total more than 100%, and an objective's progress is
// the weighted average of its key results. Also has a small "ping" route so
// the Dev Playground can check the API is up.

// helpers

const OBJECTIVE_TYPES = new Set([
  "company",
  "department",
  "team",
  "individual",
]);

function cleanText(value, fieldName, maxLength, required = false) {
  const text = value === undefined || value === null ? "" : String(value).trim();
  if (required && !text) {
    const error = new Error(`${fieldName} is required`);
    error.statusCode = 400;
    throw error;
  }
  if (text.length > maxLength) {
    const error = new Error(`${fieldName} must be ${maxLength} characters or fewer`);
    error.statusCode = 400;
    throw error;
  }
  return text;
}

function parsePercent(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    const error = new Error(`${fieldName} must be a number from 0 to 100`);
    error.statusCode = 400;
    throw error;
  }
  return parsed;
}

function parseDate(value, fieldName) {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) {
    const error = new Error(`${fieldName} must be a valid date`);
    error.statusCode = 400;
    throw error;
  }
  return parsed;
}

function respondWithInputError(res, error) {
  res.status(error.statusCode || 400);
  throw error;
}

function ownsObjective(objective, user) {
  // objective.owner may be a raw id or, if the caller populated it (e.g. to
  // read the owner's name), a full user document. Handle both so populating
  // for display never silently breaks the ownership check.
  const ownerId =
    objective.owner && objective.owner._id ? objective.owner._id : objective.owner;
  return String(ownerId) === String(user.id);
}

async function canViewObjective(objective, user) {
  if (isOkrManager(user) || ownsObjective(objective, user)) return true;
  return Boolean(
    await OkrKeyResult.exists({
      objective: objective._id,
      assignedTo: user.id,
    })
  );
}

async function assertCanViewObjective(objective, req, res) {
  if (!(await canViewObjective(objective, req.user))) {
    res.status(403);
    throw new Error("You do not have access to this objective");
  }
}

async function assertCanUpdateKeyResult(keyResult, req, res) {
  if (isOkrManager(req.user) || String(keyResult.assignedTo) === String(req.user.id)) {
    return;
  }
  const objective = await OkrObjective.findById(keyResult.objective);
  if (objective && ownsObjective(objective, req.user)) return;
  res.status(403);
  throw new Error("You can only update key results assigned to you");
}

// Add up the weights of a list of key results.
function sumWeights(keyResults) {
  return keyResults.reduce((sum, kr) => sum + Number(kr.weight || 0), 0);
}

// Weighted roll-up: each key result contributes (weight/100) * its progress.
function calcObjectiveProgress(keyResults) {
  if (!keyResults.length) return 0;
  const weighted = keyResults.reduce(
    (sum, kr) => sum + (Number(kr.weight || 0) / 100) * Number(kr.progress || 0),
    0
  );
  return Math.round(Math.max(0, Math.min(100, weighted)));
}

// Turn a progress number + due date into a status label for colour coding.
function deriveStatus(progress, dueDate, startDate = null) {
  if (progress >= 100) return "completed";
  const now = new Date();
  const due = dueDate ? new Date(dueDate) : null;
  if (due && due < now) return "overdue";

  if (due) {
    const start = startDate ? new Date(startDate) : new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const totalMs = due - start;
    const elapsedMs = now - start;
    if (totalMs > 0 && elapsedMs > 0) {
      const expectedProgress = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));
      if (expectedProgress - progress >= 20) return "at-risk";
    }

    const daysRemaining = (due - now) / (24 * 60 * 60 * 1000);
    if (daysRemaining <= 14 && progress < 70) return "at-risk";
  }
  return "on-track";
}

// Write one row to the activity feed. Deliberately fire-and-forget in spirit:
// a failed log line should never break the actual request, so we swallow
// errors here.
async function logActivity(userId, action, objectiveId, message) {
  try {
    await OkrActivity.create({ user: userId, action, objective: objectiveId, message });
  } catch (e) {
    console.log("Activity log skipped:", e.message);
  }
}

// Calendar-driven progress: a key result can be tied to one or more calendar
// entries, and its progress becomes the average completion of those entries,
// which then rolls up into the objective as usual. A completed entry counts
// as 100 even if nobody typed a progress number on it.

// Work out a single calendar entry's contribution, 0 to 100.
function entryCompletion(entry) {
  if (!entry) return 0;
  if (entry.completionStatus === "completed") return 100;
  if (entry.completionStatus === "cancelled") return 0;
  const raw = Number(entry.progress);
  if (!Number.isFinite(raw)) return 0;
  return Math.max(0, Math.min(100, raw));
}

// Average completion across a key result's linked calendar entries. Returns
// null when nothing is linked, so callers can leave progress untouched.
async function calendarProgressFor(keyResult) {
  const ids = keyResult.calendarEntries || [];
  if (ids.length === 0) return null;
  const entries = await CalendarEntry.find({ _id: { $in: ids } });
  if (entries.length === 0) return null;
  const total = entries.reduce((sum, e) => sum + entryCompletion(e), 0);
  return {
    progress: Math.round(total / entries.length),
    linked: entries.length,
    completed: entries.filter((e) => e.completionStatus === "completed").length,
  };
}

// Recalculate one key result from its calendar entries and save it. Used by the
// sync endpoints. Returns a small summary, or null when nothing is linked.
async function syncKeyResultFromCalendar(keyResult) {
  const result = await calendarProgressFor(keyResult);
  if (!result) return null;
  keyResult.progress = result.progress;
  keyResult.status = deriveStatus(result.progress, keyResult.dueDate);
  keyResult.progressSource = "calendar";
  await keyResult.save();
  return result;
}

// Reload an objective's key results, recompute its progress/status and save.
async function recalcObjective(objectiveId) {
  const objective = await OkrObjective.findById(objectiveId);
  if (!objective) return null;
  const keyResults = await OkrKeyResult.find({ objective: objectiveId });
  objective.progress = calcObjectiveProgress(keyResults);
  objective.status = deriveStatus(
    objective.progress,
    objective.dueDate,
    objective.startDate
  );
  await objective.save();
  return objective;
}

// controllers

// @desc    Simple reachability check for the Dev Playground
// @route   GET /api/okr/ping
// @access  Public
const ping = asyncHandler(async (req, res) => {
  // 1 means connected; anything else means the database is not usable, which
  // an ops dashboard or the Maxbox monitoring agent needs to know about.
  const mongoose = require("mongoose");
  const dbConnected = mongoose.connection.readyState === 1;

  res.status(dbConnected ? 200 : 503).json({
    ok: dbConnected,
    module: "okr",
    message: dbConnected ? "OKR API is reachable" : "OKR API is up but the database is unreachable",
    db: dbConnected ? "connected" : "disconnected",
    uptimeSeconds: Math.round(process.uptime()),
  });
});

// @desc    List the distinct group names already used on objectives, so a
//          frontend dropdown can offer real values instead of hard-coding a
//          list. Empty until someone actually sets a group on an objective.
// @route   GET /api/okr/objectives/groups
// @access  Private
const getObjectiveGroups = asyncHandler(async (req, res) => {
  const groups = await OkrObjective.distinct("group", { group: { $ne: "" } });
  res.status(200).json(groups.sort());
});

// @desc    List the logged-in user's objectives
// @route   GET /api/okr/objectives
// @access  Private
// Adds a plain `manager` string (the owner's name) alongside the existing
// `owner` reference, so a frontend can show a name without doing its own
// lookup. The underlying data still only stores the real user reference.
function withManagerName(objective) {
  const plain = objective.toObject ? objective.toObject() : objective;
  const owner = plain.owner;
  const manager =
    owner && typeof owner === "object" && (owner.firstName || owner.lastName)
      ? [owner.firstName, owner.lastName].filter(Boolean).join(" ")
      : "";
  return { ...plain, manager };
}

const getObjectives = asyncHandler(async (req, res) => {
  const teamScope = req.query.scope === "team" && isOkrManager(req.user);
  const filter = teamScope ? {} : { owner: req.user.id };
  const objectives = await OkrObjective.find(filter)
    .populate("owner", "firstName lastName email")
    .sort({ dueDate: 1 });
  res.status(200).json(objectives.map(withManagerName));
});

// @desc    Get one objective with its key results attached
// @route   GET /api/okr/objectives/:id
// @access  Private
const getObjective = asyncHandler(async (req, res) => {
  const objective = await OkrObjective.findById(req.params.id).populate(
    "owner",
    "firstName lastName email"
  );
  if (!objective) {
    res.status(404);
    throw new Error("Objective not found");
  }
  await assertCanViewObjective(objective, req, res);
  const keyResults = await OkrKeyResult.find({ objective: objective.id });
  res.status(200).json({ objective: withManagerName(objective), keyResults });
});

// @desc    Create an objective
// @route   POST /api/okr/objectives
// @access  Private
const COMMITMENT_TYPES = new Set(["committed", "aspirational"]);

const createObjective = asyncHandler(async (req, res) => {
  const { title, description, type, group, commitmentType, startDate, dueDate, parent } = req.body;
  try {
    const safeTitle = cleanText(title, "Title", 140, true);
    const safeDescription = cleanText(description, "Description", 2000);
    const safeType = type || "company";
    if (!OBJECTIVE_TYPES.has(safeType)) {
      throw Object.assign(new Error("Type must be company, department, team, or individual"), {
        statusCode: 400,
      });
    }
    const safeGroup = cleanText(group, "Group", 100);
    const safeCommitmentType = commitmentType || "committed";
    if (!COMMITMENT_TYPES.has(safeCommitmentType)) {
      throw Object.assign(new Error("Commitment type must be committed or aspirational"), {
        statusCode: 400,
      });
    }
    const safeStartDate = startDate ? parseDate(startDate, "Start date") : new Date();
    const safeDueDate = parseDate(dueDate, "Due date");
    if (safeDueDate < safeStartDate) {
      throw Object.assign(new Error("Due date must be on or after the start date"), {
        statusCode: 400,
      });
    }

    // A parent makes this objective part of a top-down cascade. It has to be an
    // objective the caller can actually see, so nobody can attach their goal
    // under someone else's strategy.
    let safeParent = null;
    if (parent) {
      const parentObjective = await OkrObjective.findById(parent);
      if (!parentObjective || !(await canViewObjective(parentObjective, req.user))) {
        throw Object.assign(new Error("Parent objective not found"), { statusCode: 404 });
      }
      safeParent = parentObjective._id;
    }

    const objective = await OkrObjective.create({
      owner: req.user.id,
      title: safeTitle,
      description: safeDescription,
      type: safeType,
      group: safeGroup,
      commitmentType: safeCommitmentType,
      parent: safeParent,
      startDate: safeStartDate,
      dueDate: safeDueDate,
    });
    await logActivity(
      req.user.id,
      "objective.created",
      objective.id,
      `Created objective "${safeTitle}"`
    );
    return res.status(201).json(objective);
  } catch (error) {
    return respondWithInputError(res, error);
  }
});

// @desc    Delete an objective and its key results
// @route   DELETE /api/okr/objectives/:id
// @access  Private
const deleteObjective = asyncHandler(async (req, res) => {
  const objective = await OkrObjective.findById(req.params.id);
  if (!objective) {
    res.status(404);
    throw new Error("Objective not found");
  }
  await assertCanViewObjective(objective, req, res);
  await OkrCheckin.deleteMany({ objective: objective.id });
  await OkrKeyResult.deleteMany({ objective: objective.id });
  await logActivity(
    req.user.id,
    "objective.deleted",
    objective.id,
    `Deleted objective "${objective.title}"`
  );
  await objective.deleteOne();
  res.status(200).json({ id: req.params.id });
});

// @desc    Add a key result to an objective (enforces the 100% weight ceiling)
// @route   POST /api/okr/objectives/:id/key-results
// @access  Private
const createKeyResult = asyncHandler(async (req, res) => {
  const { title, weight, progress, assignedTo, dueDate } = req.body;
  let safeTitle;
  let safeWeight;
  let safeProgress;
  let safeDueDate;
  try {
    safeTitle = cleanText(title, "Title", 180, true);
    safeWeight = parsePercent(weight, "Weight");
    safeProgress = parsePercent(progress === undefined ? 0 : progress, "Progress");
    safeDueDate = parseDate(dueDate, "Due date");
    if (safeWeight <= 0) {
      throw Object.assign(new Error("Weight must be greater than 0"), {
        statusCode: 400,
      });
    }
  } catch (error) {
    return respondWithInputError(res, error);
  }

  const objective = await OkrObjective.findById(req.params.id);
  if (!objective) {
    res.status(404);
    throw new Error("Objective not found");
  }
  await assertCanViewObjective(objective, req, res);
  if (safeDueDate > new Date(objective.dueDate)) {
    res.status(400);
    throw new Error("Key result due date cannot be after the objective due date");
  }

  // RULE 1: the new total weight must not exceed 100.
  const existing = await OkrKeyResult.find({ objective: objective.id });
  const newTotal = sumWeights(existing) + safeWeight;
  if (newTotal > 100.01) {
    res.status(400);
    throw new Error(
      `Weights would total ${newTotal}%, over 100%. Only ${100 - sumWeights(existing)}% is left.`
    );
  }

  const keyResult = await OkrKeyResult.create({
    objective: objective.id,
    title: safeTitle,
    weight: safeWeight,
    progress: safeProgress,
    status: deriveStatus(safeProgress, safeDueDate, objective.startDate),
    assignedTo: assignedTo || null,
    dueDate: safeDueDate,
  });

  // RULE 2: refresh the objective roll-up.
  await recalcObjective(objective.id);

  await logActivity(
    req.user.id,
    "keyresult.created",
    objective.id,
    `Added key result "${safeTitle}" (weight ${safeWeight}%)`
  );

  res.status(201).json(keyResult);
});

// @desc    Update a key result's progress (and re-roll the objective)
// @route   PATCH /api/okr/key-results/:id/progress
// @access  Private
const updateKeyResultProgress = asyncHandler(async (req, res) => {
  const { progress } = req.body;
  let safeProgress;
  try {
    safeProgress = parsePercent(progress, "Progress");
  } catch (error) {
    return respondWithInputError(res, error);
  }
  const keyResult = await OkrKeyResult.findById(req.params.id);
  if (!keyResult) {
    res.status(404);
    throw new Error("Key result not found");
  }
  await assertCanUpdateKeyResult(keyResult, req, res);
  keyResult.progress = safeProgress;
  keyResult.status = deriveStatus(safeProgress, keyResult.dueDate);
  await keyResult.save();

  await recalcObjective(keyResult.objective);
  res.status(200).json(keyResult);
});

// @desc    Approve / request changes on a key result
// @route   PATCH /api/okr/key-results/:id/approve
// @access  Private
const approveKeyResult = asyncHandler(async (req, res) => {
  const { approved, completionJustification } = req.body;
  const keyResult = await OkrKeyResult.findById(req.params.id);
  if (!keyResult) {
    res.status(404);
    throw new Error("Key result not found");
  }
  const objective = await OkrObjective.findById(keyResult.objective);
  if (!objective) {
    res.status(404);
    throw new Error("Objective not found");
  }
  await assertCanViewObjective(objective, req, res);
  keyResult.approved = approved === true;
  keyResult.approvedBy = keyResult.approved ? req.user.id : null;
  keyResult.approvedAt = keyResult.approved ? new Date() : null;
  if (completionJustification !== undefined) {
    try {
      keyResult.completionJustification = cleanText(
        completionJustification,
        "Completion justification",
        1000
      );
    } catch (error) {
      return respondWithInputError(res, error);
    }
  }
  await keyResult.save();

  await logActivity(
    req.user.id,
    keyResult.approved ? "keyresult.approved" : "keyresult.changes-requested",
    keyResult.objective,
    keyResult.approved
      ? `Approved key result "${keyResult.title}"`
      : `Requested changes on key result "${keyResult.title}"`
  );

  res.status(200).json(keyResult);
});

// @desc    Read-only weight check for an objective (for the frontend UI)
// @route   GET /api/okr/objectives/:id/weight-check
// @access  Private
const checkWeights = asyncHandler(async (req, res) => {
  const objective = await OkrObjective.findById(req.params.id);
  if (!objective) {
    res.status(404);
    throw new Error("Objective not found");
  }
  await assertCanViewObjective(objective, req, res);
  const keyResults = await OkrKeyResult.find({ objective: req.params.id });
  const total = sumWeights(keyResults);
  res.status(200).json({
    total,
    isValid: keyResults.length > 0 && Math.abs(total - 100) <= 0.01,
    remaining: Math.max(0, 100 - total),
  });
});

// @desc    Dashboard summary of the logged-in user's OKRs
// @route   GET /api/okr/summary
// @access  Private
// Gives the dashboard everything it needs in one call: how many objectives
// there are, how they break down by status, the average progress, and a short
// list of the objectives that need attention (overdue or at-risk).
const getSummary = asyncHandler(async (req, res) => {
  const objectives = await OkrObjective.find({ owner: req.user.id });
  const ids = objectives.map((o) => o._id);
  const keyResults = await OkrKeyResult.find({ objective: { $in: ids } });

  // Count objectives by status.
  const statusCounts = { "on-track": 0, "at-risk": 0, overdue: 0, completed: 0 };
  objectives.forEach((o) => {
    if (statusCounts[o.status] !== undefined) statusCounts[o.status] += 1;
  });

  // Average progress across all objectives (0 when there are none).
  const averageProgress = objectives.length
    ? Math.round(objectives.reduce((sum, o) => sum + o.progress, 0) / objectives.length)
    : 0;

  // The objectives a manager would want to look at first.
  const needsAttention = objectives
    .filter((o) => o.status === "overdue" || o.status === "at-risk")
    .map((o) => ({
      id: o.id,
      title: o.title,
      progress: o.progress,
      status: o.status,
      dueDate: o.dueDate,
    }));

  res.status(200).json({
    totalObjectives: objectives.length,
    totalKeyResults: keyResults.length,
    approvedKeyResults: keyResults.filter((kr) => kr.approved).length,
    averageProgress,
    statusCounts,
    needsAttention,
  });
});

// @desc    Key results assigned to the logged-in user
// @route   GET /api/okr/my-key-results
// @access  Private
// A personal "what am I responsible for" view. Each item carries its parent
// objective's title and due date so the frontend can show context.
const getMyKeyResults = asyncHandler(async (req, res) => {
  const keyResults = await OkrKeyResult.find({ assignedTo: req.user.id })
    .populate("objective", "title dueDate")
    .sort({ dueDate: 1 });
  res.status(200).json(keyResults);
});

// @desc    Record a progress check-in on a key result
// @route   POST /api/okr/key-results/:id/check-in
// @access  Private
// This is the preferred way to move progress. It stores a dated history row
// (with an optional note), updates the key result, re-rolls the objective and
// drops a line in the activity feed. The history is what powers the trend
// chart and the forecast.
const checkIn = asyncHandler(async (req, res) => {
  const { progress, note } = req.body;
  let safeProgress;
  let safeNote;
  try {
    safeProgress = parsePercent(progress, "Progress");
    safeNote = cleanText(note, "Check-in note", 500);
  } catch (error) {
    return respondWithInputError(res, error);
  }

  const keyResult = await OkrKeyResult.findById(req.params.id);
  if (!keyResult) {
    res.status(404);
    throw new Error("Key result not found");
  }
  await assertCanUpdateKeyResult(keyResult, req, res);

  const checkin = await OkrCheckin.create({
    keyResult: keyResult.id,
    objective: keyResult.objective,
    user: req.user.id,
    progress: safeProgress,
    note: safeNote,
  });

  keyResult.progress = safeProgress;
  keyResult.status = deriveStatus(safeProgress, keyResult.dueDate);
  await keyResult.save();
  await recalcObjective(keyResult.objective);

  await logActivity(
    req.user.id,
    "keyresult.checkin",
    keyResult.objective,
    `Checked in "${keyResult.title}" at ${safeProgress}%${
      safeNote ? ` - "${safeNote}"` : ""
    }`
  );

  res.status(201).json({ checkin, keyResult });
});

// @desc    Progress history for a key result (for trend charts)
// @route   GET /api/okr/key-results/:id/history
// @access  Private
const getKeyResultHistory = asyncHandler(async (req, res) => {
  const keyResult = await OkrKeyResult.findById(req.params.id);
  if (!keyResult) {
    res.status(404);
    throw new Error("Key result not found");
  }
  const objective = await OkrObjective.findById(keyResult.objective);
  if (!objective) {
    res.status(404);
    throw new Error("Objective not found");
  }
  await assertCanViewObjective(objective, req, res);
  const history = await OkrCheckin.find({ keyResult: req.params.id })
    .populate("user", "firstName lastName")
    .sort({ createdAt: 1 });
  res.status(200).json(history);
});

// @desc    Forecast for an objective: will it land on time at the current pace?
// @route   GET /api/okr/objectives/:id/forecast
// @access  Private
// Simple velocity model: work out progress-per-day since the objective
// started, project it forward, and compare against the due date. Also
// returns the weekly pace needed to land exactly on time.
const getForecast = asyncHandler(async (req, res) => {
  const objective = await OkrObjective.findById(req.params.id);
  if (!objective) {
    res.status(404);
    throw new Error("Objective not found");
  }
  await assertCanViewObjective(objective, req, res);

  const now = new Date();
  const start = objective.startDate ? new Date(objective.startDate) : new Date(objective.createdAt);
  const due = new Date(objective.dueDate);
  const msPerDay = 24 * 60 * 60 * 1000;

  const daysElapsed = Math.max((now - start) / msPerDay, 0.5); // avoid divide-by-zero on day one
  const daysRemaining = Math.max((due - now) / msPerDay, 0);
  const remainingProgress = 100 - objective.progress;

  // How fast has it actually moved, in percent per day?
  const velocityPerDay = objective.progress / daysElapsed;

  // Project the finish date at the current pace. If nothing has moved yet the
  // velocity is zero and there is no meaningful projection.
  let projectedFinish = null;
  if (velocityPerDay > 0 && remainingProgress > 0) {
    projectedFinish = new Date(now.getTime() + (remainingProgress / velocityPerDay) * msPerDay);
  }

  // The pace needed from today to land exactly on the due date.
  const requiredPerWeek =
    daysRemaining > 0 ? Math.round((remainingProgress / daysRemaining) * 7 * 10) / 10 : null;

  // Verdict: done, overdue, no-data, on-pace, or behind.
  let verdict;
  if (objective.progress >= 100) {
    verdict = "completed";
  } else if (daysRemaining === 0) {
    verdict = "overdue";
  } else if (!projectedFinish) {
    verdict = "no-progress-yet";
  } else if (projectedFinish <= due) {
    verdict = "on-pace";
  } else {
    verdict = "behind-pace";
  }

  res.status(200).json({
    objectiveId: objective.id,
    title: objective.title,
    progress: objective.progress,
    dueDate: objective.dueDate,
    daysRemaining: Math.round(daysRemaining),
    velocityPerWeek: Math.round(velocityPerDay * 7 * 10) / 10,
    requiredPerWeek,
    projectedFinish,
    verdict,
  });
});

// @desc    Plain-English insights across the logged-in user's OKRs
// @route   GET /api/okr/insights
// @access  Private
// Scans everything and writes short findings with a severity, so the
// frontend can colour them: stale key results, bad weight setups, overdue
// and behind-pace objectives, and finished work waiting on approval.
const getInsights = asyncHandler(async (req, res) => {
  const objectives = await OkrObjective.find({ owner: req.user.id });
  const ids = objectives.map((o) => o._id);
  const keyResults = await OkrKeyResult.find({ objective: { $in: ids } });
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  const insights = [];

  for (const o of objectives) {
    const krs = keyResults.filter((kr) => String(kr.objective) === String(o._id));
    const totalWeight = sumWeights(krs);

    // Setup problems first: an objective whose weights do not reach 100 can
    // never hit 100% progress, which usually surprises people.
    if (krs.length === 0) {
      insights.push({
        severity: "warning",
        objectiveId: o.id,
        text: `"${o.title}" has no key results yet, so its progress cannot move.`,
      });
    } else if (Math.abs(totalWeight - 100) > 0.01) {
      insights.push({
        severity: "warning",
        objectiveId: o.id,
        text: `"${o.title}" has weights totalling ${totalWeight}%, not 100%. Its progress will top out early.`,
      });
    }

    // Deadline problems.
    if (o.status === "overdue") {
      insights.push({
        severity: "critical",
        objectiveId: o.id,
        text: `"${o.title}" is past its due date at ${o.progress}% complete.`,
      });
    } else if (o.progress < 100 && o.dueDate > now) {
      // Behind pace? Reuse the forecast maths inline.
      const start = o.startDate ? new Date(o.startDate) : new Date(o.createdAt);
      const daysElapsed = Math.max((now - start) / msPerDay, 0.5);
      const daysRemaining = (new Date(o.dueDate) - now) / msPerDay;
      const velocity = o.progress / daysElapsed;
      const projectedDays = velocity > 0 ? (100 - o.progress) / velocity : Infinity;
      if (projectedDays > daysRemaining) {
        const needed = Math.round(((100 - o.progress) / daysRemaining) * 7 * 10) / 10;
        insights.push({
          severity: "warning",
          objectiveId: o.id,
          text: `"${o.title}" is behind pace. It needs about ${needed}% per week to land on time.`,
        });
      }
    }
  }

  // Key-result level findings.
  for (const kr of keyResults) {
    // Finished but waiting for a manager.
    if (kr.progress >= 100 && !kr.approved) {
      insights.push({
        severity: "info",
        keyResultId: kr.id,
        text: `"${kr.title}" is at 100% and waiting for approval.`,
      });
    }

    // Stale: no check-in for over a week on an unfinished key result.
    if (kr.progress < 100) {
      const lastCheckin = await OkrCheckin.findOne({ keyResult: kr._id }).sort({ createdAt: -1 });
      const lastTouch = lastCheckin ? lastCheckin.createdAt : kr.createdAt;
      const daysQuiet = Math.floor((now - lastTouch) / msPerDay);
      if (daysQuiet >= 7) {
        insights.push({
          severity: "info",
          keyResultId: kr.id,
          text: `"${kr.title}" has had no check-in for ${daysQuiet} days.`,
        });
      }
    }
  }

  // Most serious first, so the top of the list is always the priority.
  const order = { critical: 0, warning: 1, info: 2 };
  insights.sort((a, b) => order[a.severity] - order[b.severity]);

  res.status(200).json({ count: insights.length, insights });
});

// @desc    Recent activity feed
// @route   GET /api/okr/activity
// @access  Private
const getActivity = asyncHandler(async (req, res) => {
  const requestedLimit = Number(req.query.limit);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.floor(requestedLimit), 1), 100)
    : 20;
  const filter =
    req.query.scope === "team" && isOkrManager(req.user)
      ? {}
      : { user: req.user.id };
  const activity = await OkrActivity.find(filter)
    .populate("user", "firstName lastName")
    .sort({ createdAt: -1 })
    .limit(limit);
  res.status(200).json(activity);
});

// @desc    Update an objective's editable fields
// @route   PUT /api/okr/objectives/:id
// @access  Private (managers)
// Progress and status stay read-only here because they are calculated from
// the key results; letting clients set them would break the roll-up contract.
const updateObjective = asyncHandler(async (req, res) => {
  const objective = await OkrObjective.findById(req.params.id);
  if (!objective) {
    res.status(404);
    throw new Error("Objective not found");
  }
  await assertCanViewObjective(objective, req, res);

  const editable = [
    "title",
    "description",
    "type",
    "group",
    "commitmentType",
    "parent",
    "startDate",
    "dueDate",
    "approvalState",
  ];
  for (const field of editable) {
    if (req.body[field] !== undefined) objective[field] = req.body[field];
  }
  await objective.save();

  // Due date changes can flip the status, so refresh the roll-up.
  await recalcObjective(objective.id);
  await logActivity(req.user.id, "objective.updated", objective.id, `Updated objective "${objective.title}"`);

  res.status(200).json(await OkrObjective.findById(objective.id));
});

// @desc    Update a key result (title, weight, assignee, due date)
// @route   PUT /api/okr/key-results/:id
// @access  Private (managers)
// Re-runs the 100% weight ceiling when the weight changes: the other key
// results' weights plus the new value may not pass 100.
const updateKeyResult = asyncHandler(async (req, res) => {
  const keyResult = await OkrKeyResult.findById(req.params.id);
  if (!keyResult) {
    res.status(404);
    throw new Error("Key result not found");
  }
  const objective = await OkrObjective.findById(keyResult.objective);
  if (!objective) {
    res.status(404);
    throw new Error("Objective not found");
  }
  await assertCanViewObjective(objective, req, res);

  if (req.body.weight !== undefined) {
    const siblings = await OkrKeyResult.find({ objective: objective.id, _id: { $ne: keyResult.id } });
    const newTotal = sumWeights(siblings) + Number(req.body.weight);
    if (Number.isNaN(newTotal) || newTotal > 100.01) {
      res.status(400);
      throw new Error(`Weights would total ${newTotal}%, over 100%. Only ${100 - sumWeights(siblings)}% is available.`);
    }
  }

  const editable = ["title", "weight", "assignedTo", "dueDate", "completionJustification"];
  for (const field of editable) {
    if (req.body[field] !== undefined) keyResult[field] = req.body[field];
  }
  keyResult.status = deriveStatus(keyResult.progress, keyResult.dueDate);
  await keyResult.save();
  await recalcObjective(objective.id);
  await logActivity(req.user.id, "keyresult.updated", objective.id, `Updated key result "${keyResult.title}"`);

  res.status(200).json(keyResult);
});

// @desc    Delete a key result (and its check-in history)
// @route   DELETE /api/okr/key-results/:id
// @access  Private (managers)
const deleteKeyResult = asyncHandler(async (req, res) => {
  const keyResult = await OkrKeyResult.findById(req.params.id);
  if (!keyResult) {
    res.status(404);
    throw new Error("Key result not found");
  }
  const objective = await OkrObjective.findById(keyResult.objective);
  if (!objective) {
    res.status(404);
    throw new Error("Objective not found");
  }
  await assertCanViewObjective(objective, req, res);

  await OkrCheckin.deleteMany({ keyResult: keyResult.id });
  await keyResult.deleteOne();
  await recalcObjective(objective.id);
  await logActivity(req.user.id, "keyresult.deleted", objective.id, `Deleted key result "${keyResult.title}"`);

  res.status(200).json({ id: req.params.id });
});

// @desc    Link calendar entries to a key result
// @route   POST /api/okr/key-results/:id/calendar-links
// @access  Private (managers)
// Body: { entryIds: ["<calendarEntryId>", ...] }
// Once linked, the key result's progress is driven by how much of that calendar
// work is done. Linking immediately syncs, so the dashboard updates on the spot.
const linkCalendarEntries = asyncHandler(async (req, res) => {
  const { entryIds } = req.body;
  if (!Array.isArray(entryIds) || entryIds.length === 0) {
    res.status(400);
    throw new Error("Provide entryIds as a non-empty array of calendar entry ids");
  }

  const keyResult = await OkrKeyResult.findById(req.params.id);
  if (!keyResult) {
    res.status(404);
    throw new Error("Key result not found");
  }
  const objective = await OkrObjective.findById(keyResult.objective);
  if (!objective) {
    res.status(404);
    throw new Error("Objective not found");
  }
  await assertCanViewObjective(objective, req, res);

  // Only link entries that actually exist, so a typo cannot poison the maths.
  const found = await CalendarEntry.find({ _id: { $in: entryIds } }).select("_id");
  if (found.length === 0) {
    res.status(404);
    throw new Error("None of those calendar entries exist");
  }

  // Merge without duplicates.
  const existing = new Set((keyResult.calendarEntries || []).map(String));
  found.forEach((e) => existing.add(String(e._id)));
  keyResult.calendarEntries = Array.from(existing);

  const summary = await syncKeyResultFromCalendar(keyResult);
  await recalcObjective(objective.id);
  await logActivity(
    req.user.id,
    "keyresult.calendar-linked",
    objective.id,
    `Linked ${found.length} calendar item(s) to "${keyResult.title}"`
  );

  res.status(200).json({ keyResult, calendar: summary });
});

// @desc    Unlink a calendar entry from a key result
// @route   DELETE /api/okr/key-results/:id/calendar-links
// @access  Private (managers)
// Body: { entryId }
// If the last entry is removed the key result goes back to manual progress and
// keeps whatever number it had, rather than silently dropping to zero.
const unlinkCalendarEntry = asyncHandler(async (req, res) => {
  const { entryId } = req.body;
  if (!entryId) {
    res.status(400);
    throw new Error("Provide entryId");
  }

  const keyResult = await OkrKeyResult.findById(req.params.id);
  if (!keyResult) {
    res.status(404);
    throw new Error("Key result not found");
  }
  const objective = await OkrObjective.findById(keyResult.objective);
  if (!objective) {
    res.status(404);
    throw new Error("Objective not found");
  }
  await assertCanViewObjective(objective, req, res);

  keyResult.calendarEntries = (keyResult.calendarEntries || []).filter(
    (id) => String(id) !== String(entryId)
  );

  if (keyResult.calendarEntries.length === 0) {
    keyResult.progressSource = "manual";
    await keyResult.save();
  } else {
    await syncKeyResultFromCalendar(keyResult);
  }
  await recalcObjective(objective.id);

  res.status(200).json(keyResult);
});

// @desc    Recalculate one key result from its calendar entries
// @route   POST /api/okr/key-results/:id/sync-calendar
// @access  Private
const syncKeyResultCalendar = asyncHandler(async (req, res) => {
  const keyResult = await OkrKeyResult.findById(req.params.id);
  if (!keyResult) {
    res.status(404);
    throw new Error("Key result not found");
  }
  await assertCanUpdateKeyResult(keyResult, req, res);

  const summary = await syncKeyResultFromCalendar(keyResult);
  if (!summary) {
    res.status(400);
    throw new Error("This key result has no linked calendar entries to sync from");
  }
  await recalcObjective(keyResult.objective);

  res.status(200).json({ keyResult, calendar: summary });
});

// @desc    Recalculate every calendar-linked key result under an objective
// @route   POST /api/okr/objectives/:id/sync-calendar
// @access  Private
// The endpoint a scheduled job (or a Refresh button) calls to pull the latest
// calendar completion through into objective progress.
const syncObjectiveCalendar = asyncHandler(async (req, res) => {
  const objective = await OkrObjective.findById(req.params.id);
  if (!objective) {
    res.status(404);
    throw new Error("Objective not found");
  }
  await assertCanViewObjective(objective, req, res);

  const keyResults = await OkrKeyResult.find({ objective: objective.id });
  const synced = [];
  for (const kr of keyResults) {
    const summary = await syncKeyResultFromCalendar(kr);
    if (summary) {
      synced.push({
        keyResultId: kr.id,
        title: kr.title,
        progress: summary.progress,
        linked: summary.linked,
        completed: summary.completed,
      });
    }
  }
  const updated = await recalcObjective(objective.id);

  res.status(200).json({
    objectiveId: objective.id,
    progress: updated ? updated.progress : objective.progress,
    status: updated ? updated.status : objective.status,
    syncedKeyResults: synced,
  });
});

// @desc    Top-down objective tree
// @route   GET /api/okr/objectives/tree
// @access  Private
// Returns the caller's objectives nested by parent, so the UI can show the
// plan cascading from company level down to individual level.
const getObjectiveTree = asyncHandler(async (req, res) => {
  const objectives = await OkrObjective.find({ owner: req.user.id }).sort({ dueDate: 1 });

  // Build a lookup, then hang each objective off its parent.
  const nodes = new Map();
  objectives.forEach((o) => {
    nodes.set(String(o._id), {
      id: o.id,
      title: o.title,
      type: o.type,
      progress: o.progress,
      status: o.status,
      dueDate: o.dueDate,
      parent: o.parent ? String(o.parent) : null,
      children: [],
    });
  });

  const roots = [];
  nodes.forEach((node) => {
    if (node.parent && nodes.has(node.parent)) {
      nodes.get(node.parent).children.push(node);
    } else {
      // No parent, or a parent the caller cannot see: treat as a top-level goal.
      roots.push(node);
    }
  });

  res.status(200).json({ count: objectives.length, tree: roots });
});

// @desc    Chart-ready progress trend for an objective
// @route   GET /api/okr/objectives/:id/trend
// @access  Private
// Replays the check-in history in date order and recomputes weighted progress
// at each step, so the frontend gets a {date, progress} series to chart.
const getTrend = asyncHandler(async (req, res) => {
  const objective = await OkrObjective.findById(req.params.id);
  if (!objective) {
    res.status(404);
    throw new Error("Objective not found");
  }
  await assertCanViewObjective(objective, req, res);

  const keyResults = await OkrKeyResult.find({ objective: objective.id });
  const checkins = await OkrCheckin.find({ objective: objective.id }).sort({ createdAt: 1 });

  // Start every key result at zero, then replay each check-in and record the
  // weighted total as it stood at that moment.
  const progressByKr = {};
  keyResults.forEach((kr) => {
    progressByKr[String(kr._id)] = 0;
  });

  const series = [
    { date: objective.startDate || objective.createdAt, progress: 0 },
  ];
  for (const c of checkins) {
    progressByKr[String(c.keyResult)] = c.progress;
    const weighted = keyResults.reduce(
      (sum, kr) => sum + (Number(kr.weight) / 100) * (progressByKr[String(kr._id)] || 0),
      0
    );
    series.push({
      date: c.createdAt,
      progress: Math.round(Math.max(0, Math.min(100, weighted))),
    });
  }

  res.status(200).json({
    objectiveId: objective.id,
    title: objective.title,
    current: objective.progress,
    points: series,
  });
});

// @desc    Contributor leaderboard across the caller's objectives
// @route   GET /api/okr/leaderboard
// @access  Private
// Ranks people by key results assigned to them: approved ones count double,
// average progress breaks ties. Scoped to the caller's own objectives.
const getLeaderboard = asyncHandler(async (req, res) => {
  const objectives = await OkrObjective.find({ owner: req.user.id }).select("_id");
  const ids = objectives.map((o) => o._id);
  const keyResults = await OkrKeyResult.find({
    objective: { $in: ids },
    assignedTo: { $ne: null },
  }).populate("assignedTo", "firstName lastName");

  // Group by assignee and tally.
  const byUser = new Map();
  for (const kr of keyResults) {
    if (!kr.assignedTo) continue;
    const key = String(kr.assignedTo._id);
    const entry = byUser.get(key) || {
      userId: key,
      name: `${kr.assignedTo.firstName || ""} ${kr.assignedTo.lastName || ""}`.trim(),
      keyResults: 0,
      approved: 0,
      totalProgress: 0,
    };
    entry.keyResults += 1;
    if (kr.approved) entry.approved += 1;
    entry.totalProgress += Number(kr.progress) || 0;
    byUser.set(key, entry);
  }

  const leaderboard = Array.from(byUser.values())
    .map((e) => ({
      ...e,
      averageProgress: Math.round(e.totalProgress / e.keyResults),
      // Approved work counts double; steady progress fills in the rest.
      score: e.approved * 200 + Math.round(e.totalProgress / e.keyResults),
    }))
    .sort((a, b) => b.score - a.score)
    .map((e, i) => ({ rank: i + 1, ...e }));

  res.status(200).json({ count: leaderboard.length, leaderboard });
});

module.exports = {
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
};

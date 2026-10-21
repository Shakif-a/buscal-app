const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const OkrObjective = require("../models/okrObjectiveModel");
const OkrKeyResult = require("../models/okrKeyResultModel");
const User = require("../models/userModel");
const writes = require("../services/okrWrites");
const {
  assertObjectiveAccess,
  hasObjectivePermission,
  canUserManageObjective,
} = require("../middleware/okrPermissions");
const {
  OBJECTIVE_CATEGORY,
  KEY_RESULT_CATEGORY,
  createLinkedCalendarEntry,
  updateLinkedCalendarEntry,
  deleteLinkedCalendarEntry,
} = require("../services/okrCalendarSyncService");

const CalendarEntry = require("../models/calendarEntryModel");

function getName(user) {
  let name = "";
  if (user && user.firstName) {
    name = user.firstName;
  }
  if (user && user.lastName) {
    name = name + " " + user.lastName;
  }
  return name.trim();
}

// UI Permissions flags
async function addPermissionFlags(objectiveData, objective, user) {
  objectiveData.canManage = false;
  objectiveData.canCreateKeyResult = false;
  objectiveData.canApproveKeyResult = false;

  if (user) {
    objectiveData.canManage = await canUserManageObjective(user, objective);
    objectiveData.canCreateKeyResult =
      objectiveData.canManage &&
      (await hasObjectivePermission(user, objective, "Create Key Results"));
    objectiveData.canApproveKeyResult =
      objectiveData.canManage &&
      (await hasObjectivePermission(user, objective, "Approve Key Results"));
  }
}

async function loadObjective(objective, user) {
  const keyResultDocuments = await OkrKeyResult.find({
    objective: objective._id,
  })
    .populate("assignedTo", "firstName lastName")
    .sort({ createdAt: 1 });

  const keyResults = [];
  let totalWeight = 0;
  for (let i = 0; i < keyResultDocuments.length; i++) {
    const keyResult = keyResultDocuments[i].toObject();
    keyResult.id = keyResult._id.toString();
    if (keyResult.assignedTo) {
      keyResult.assigned = getName(keyResult.assignedTo);
    } else {
      keyResult.assigned = "Unassigned";
    }
    totalWeight = totalWeight + keyResult.weight;
    keyResults.push(keyResult);
  }

  const objectiveData = objective.toObject();
  objectiveData.id = objectiveData._id.toString();
  objectiveData.manager = getName(objectiveData.owner);

  if (!objectiveData.commitmentType) {
    objectiveData.commitmentType = "committed";
  }

  if (objectiveData.commitmentType === "aspirational") {
    objectiveData.type = "Aspirational";
  } else {
    objectiveData.type = "Committed";
  }

  await addPermissionFlags(objectiveData, objective, user);

  return {
    objective: objectiveData,
    keyResults: keyResults,
  };
}

function compareObjectives(firstObjective, secondObjective) {
  const firstOwner = firstObjective.manager.toLowerCase();
  const secondOwner = secondObjective.manager.toLowerCase();
  if (firstOwner < secondOwner) {
    return -1;
  }
  if (firstOwner > secondOwner) {
    return 1;
  }
  const firstDueDate = new Date(firstObjective.dueDate);
  const secondDueDate = new Date(secondObjective.dueDate);
  return firstDueDate - secondDueDate;
}

// ============================================
// OBJECTIVE CONTROLLER
// ============================================

const getObjectives = asyncHandler(async (req, res) => {
  const objectives = await OkrObjective.find().populate(
    "owner",
    "firstName lastName",
  );
  const result = [];
  for (let i = 0; i < objectives.length; i++) {
    const data = await loadObjective(objectives[i], req.user);
    data.objective.keyResults = data.keyResults;
    result.push(data.objective);
  }
  result.sort(compareObjectives);
  res.status(200).json(result);
});

const getObjectiveGroups = asyncHandler(async (req, res) => {
  const groups = await OkrObjective.distinct("group", { group: { $ne: "" } });
  res.status(200).json(groups.sort());
});

const getObjective = asyncHandler(async (req, res) => {
  const objective = await OkrObjective.findById(req.params.id).populate(
    "owner",
    "firstName lastName",
  );
  if (!objective) {
    res.status(404);
    throw new Error("Objective not found");
  }

  const data = await loadObjective(objective, req.user);
  res.status(200).json(data);
});

const createObjective = asyncHandler(async (req, res) => {
  if (!req.body.title) {
    res.status(400);
    throw new Error("Please add a title");
  }
  if (!req.body.owner) {
    res.status(400);
    throw new Error("Please add an owner");
  }
  if (!req.body.dueDate) {
    res.status(400);
    throw new Error("Please add a due date");
  }

  let commitmentType = req.body.commitmentType;
  if (!commitmentType) {
    commitmentType = "committed";
  }

  // Create the calendar entry first before Objective is attempted
  const calendarEntry = await createLinkedCalendarEntry({
    title: req.body.title,
    description: req.body.description,
    dueDate: req.body.dueDate,
    ownerId: req.user.id,
    assignedId: req.body.owner,
    category: OBJECTIVE_CATEGORY,
    actorUser: req.user,
  });

  let objective;
  try {
    objective = await OkrObjective.create({
      title: req.body.title,
      description: req.body.description,
      group: req.body.group,
      owner: req.body.owner,
      dueDate: req.body.dueDate,
      commitmentType: commitmentType,
      calendarEntry: calendarEntry._id,
    });
  } catch (error) {
    // Roll back the calendar entry if objective fails
    await deleteLinkedCalendarEntry({
      entryId: calendarEntry._id,
      actorUser: req.user,
    });
    throw error;
  }

  calendarEntry.linkedObjective = objective._id;
  await calendarEntry.save();

  const objectiveData = objective.toObject();
  await addPermissionFlags(objectiveData, objective, req.user);

  res.status(201).json(objectiveData);
});

const updateObjective = asyncHandler(async (req, res) => {
  const objective = await OkrObjective.findById(req.params.id);
  if (!objective) {
    res.status(404);
    throw new Error("Objective not found");
  }

  if (req.body.title !== undefined) {
    if (typeof req.body.title !== "string") {
      res.status(400);
      throw new Error("Please add a valid title");
    }
    const title = req.body.title.trim();
    if (!title) {
      res.status(400);
      throw new Error("Please add a title");
    }
    objective.title = title;
  }

  if (req.body.description !== undefined) {
    if (typeof req.body.description !== "string") {
      res.status(400);
      throw new Error("Please add a valid description");
    }
    objective.description = req.body.description;
  }

  if (req.body.group !== undefined) {
    if (typeof req.body.group !== "string") {
      res.status(400);
      throw new Error("Please select a valid group");
    }
    const group = req.body.group.trim();
    if (!group) {
      res.status(400);
      throw new Error("Please select a group");
    }
    objective.group = group;
  }

  if (req.body.owner !== undefined) {
    if (!mongoose.isValidObjectId(req.body.owner)) {
      res.status(400);
      throw new Error("Please select a valid owner");
    }
    const ownerExists = await User.exists({ _id: req.body.owner });
    if (!ownerExists) {
      res.status(400);
      throw new Error("Selected owner was not found");
    }
    objective.owner = req.body.owner;
  }

  if (req.body.dueDate !== undefined) {
    if (!req.body.dueDate) {
      res.status(400);
      throw new Error("Please add a valid due date");
    }
    const dueDate = new Date(req.body.dueDate);
    if (isNaN(dueDate.getTime())) {
      res.status(400);
      throw new Error("Please add a valid due date");
    }
    objective.dueDate = dueDate;
  }

  let type = req.body.commitmentType;
  if (req.body.type !== undefined) {
    type = req.body.type;
  }

  if (type !== undefined) {
    if (typeof type !== "string") {
      res.status(400);
      throw new Error("Please select a valid objective type");
    }
    type = type.toLowerCase();
    if (type !== "committed" && type !== "aspirational") {
      res.status(400);
      throw new Error("Please select a valid objective type");
    }
    objective.commitmentType = type;
  }

  if (objective.calendarEntry) {
    await updateLinkedCalendarEntry({
      entryId: objective.calendarEntry,
      title: objective.title,
      description: objective.description,
      dueDate: objective.dueDate,
      assignedId: objective.owner,
      actorUser: req.user,
    });
  }

  await objective.save();
  await objective.populate("owner", "firstName lastName");

  const data = await loadObjective(objective, req.user);
  data.objective.keyResults = data.keyResults;

  res.status(200).json(data.objective);
});

const deleteObjective = asyncHandler(async (req, res) => {
  const objective = await OkrObjective.findById(req.params.id);

  if (!objective) {
    res.status(404);
    throw new Error("Objective not found");
  }

  const keyResults = await OkrKeyResult.find({ objective: objective._id });

  //find Objectives linked calendar entries
  const objectiveEntries = await CalendarEntry.find({
    $or: [
      { _id: objective.calendarEntry || null },
      { linkedObjective: objective._id },
    ],
  });

  for (const entry of objectiveEntries) {
    await deleteLinkedCalendarEntry({
      entryId: entry._id,
      actorUser: req.user,
    });
  }

  //find and delete each KR calendar entry
  for (const kr of keyResults) {
    const keyResultEntries = await CalendarEntry.find({
      $or: [{ _id: kr.calendarEntry || null }, { linkedKeyResult: kr._id }],
    });

    for (const entry of keyResultEntries) {
      await deleteLinkedCalendarEntry({
        entryId: entry._id,
        actorUser: req.user,
      });
    }
  }

  console.log("Starting OKR database deletion");

  await OkrKeyResult.deleteMany({
    objective: objective._id,
  });

  console.log("Key Results deleted");

  await objective.deleteOne();

  console.log("Objective deleted", objective.title);

  res.status(200).json({ id: req.params.id });
});

// ============================================
// KEY RESULT CONTROLLER
// ============================================

const getKeyResults = asyncHandler(async (req, res) => {
  const { objectiveId } = req.params;
  if (!mongoose.isValidObjectId(objectiveId)) {
    res.status(400);
    throw new Error("Invalid objective ID");
  }

  const objective = await OkrObjective.findById(objectiveId);
  if (!objective) {
    res.status(404);
    throw new Error("Objective not found by ID");
  }

  const keyResults = await OkrKeyResult.find({ objective: objectiveId })
    .populate("assignedTo", "firstName lastName")
    .sort({ createdAt: 1 });

  const formattedKeyResults = keyResults.map((keyResult) => {
    const kr = keyResult.toObject();
    kr.id = kr._id.toString();
    if (kr.assignedTo) {
      kr.assigned = getName(kr.assignedTo);
    } else {
      kr.assigned = "Unassigned";
    }
    return kr;
  });

  res.status(200).json(formattedKeyResults);
});

const getKeyResult = asyncHandler(async (req, res) => {
  const { objectiveId, keyResultId } = req.params;
  if (
    !mongoose.isValidObjectId(objectiveId) ||
    !mongoose.isValidObjectId(keyResultId)
  ) {
    res.status(400);
    throw new Error("Invalid ID");
  }

  const objective = await OkrObjective.findById(objectiveId);
  if (!objective) {
    res.status(404);
    throw new Error("Objective not found");
  }

  const keyResult = await OkrKeyResult.findById(keyResultId).populate(
    "assignedTo",
    "firstName lastName",
  );
  if (!keyResult) {
    res.status(404);
    throw new Error("Key result not found");
  }

  if (keyResult.objective.toString() !== objectiveId) {
    res.status(400);
    throw new Error("Key result does not belong to this objective");
  }

  const kr = keyResult.toObject();
  kr.id = kr._id.toString();
  kr.assigned = kr.assignedTo ? getName(kr.assignedTo) : "Unassigned";

  res.status(200).json(kr);
});

const createKeyResult = asyncHandler(async (req, res) => {
  const { objectiveId } = req.params;
  if (!mongoose.isValidObjectId(objectiveId)) {
    res.status(400);
    throw new Error("Invalid objective ID");
  }

  const objective = await OkrObjective.findById(objectiveId);
  if (!objective) {
    res.status(404);
    throw new Error("Objective not found");
  }

  if (!req.body.title) {
    res.status(400);
    throw new Error("Please add a title");
  }

  if (!req.body.weight) {
    res.status(400);
    throw new Error("Please add a weight");
  }

  if (!req.body.dueDate) {
    res.status(400);
    throw new Error("Please add a due date");
  }

  // Validate weight doesn't exceed 100
  const existingKeyResults = await OkrKeyResult.find({
    objective: objectiveId,
  });

  let usedWeight = 0;
  for (let i = 0; i < existingKeyResults.length; i++) {
    usedWeight += existingKeyResults[i].weight;
  }

  const newWeight = Number(req.body.weight);
  const weightLeft = 100 - usedWeight;

  if (newWeight > weightLeft) {
    res.status(400);
    throw new Error(
      "Weights cannot go over 100. Only " + weightLeft + " is left.",
    );
  }

  const keyResult = await OkrKeyResult.create({
    objective: objectiveId,
    title: req.body.title,
    weight: newWeight,
    assignedTo: req.body.assignedTo || null,
    dueDate: req.body.dueDate,
    progress: req.body.progress ?? 0,
    status: req.body.status || "on-track",
    approved: req.body.approved ?? false,
  });

  await keyResult.populate("assignedTo", "firstName lastName");
  const kr = keyResult.toObject();
  kr.id = kr._id.toString();
  kr.assigned = kr.assignedTo ? getName(kr.assignedTo) : "Unassigned";

  res.status(201).json(kr);
});

const updateKeyResult = asyncHandler(async (req, res) => {
  const { objectiveId, keyResultId } = req.params;
  if (
    !mongoose.isValidObjectId(objectiveId) ||
    !mongoose.isValidObjectId(keyResultId)
  ) {
    res.status(400);
    throw new Error("Invalid ID");
  }

  const objective = await OkrObjective.findById(objectiveId);
  if (!objective) {
    res.status(404);
    throw new Error("Objective not found");
  }

  const keyResult = await OkrKeyResult.findById(keyResultId);
  if (!keyResult) {
    res.status(404);
    throw new Error("Key result not found");
  }

  if (keyResult.objective.toString() !== objectiveId) {
    res.status(400);
    throw new Error("Key result does not belong to this objective");
  }

  // Update title
  if (req.body.title !== undefined) {
    const title = req.body.title.trim();
    if (!title) {
      res.status(400);
      throw new Error("Please add a title");
    }
    keyResult.title = title;
  }

  // Update weight
  if (req.body.weight !== undefined) {
    const newWeight = Number(req.body.weight);
    if (isNaN(newWeight) || newWeight < 1 || newWeight > 100) {
      res.status(400);
      throw new Error("Weight must be between 1 and 100");
    }

    const otherKeyResults = await OkrKeyResult.find({
      objective: objectiveId,
      _id: { $ne: keyResultId },
    });

    let usedWeight = 0;
    for (let i = 0; i < otherKeyResults.length; i++) {
      usedWeight += otherKeyResults[i].weight;
    }

    const weightLeft = 100 - usedWeight;
    if (newWeight > weightLeft) {
      res.status(400);
      throw new Error(
        "Weights cannot go over 100. Only " + weightLeft + " is left.",
      );
    }
    keyResult.weight = newWeight;
  }

  // Update dueDate
  if (req.body.dueDate !== undefined) {
    if (!req.body.dueDate) {
      res.status(400);
      throw new Error("Please add a valid due date");
    }
    const dueDate = new Date(req.body.dueDate);
    if (isNaN(dueDate.getTime())) {
      res.status(400);
      throw new Error("Please add a valid due date");
    }
    keyResult.dueDate = dueDate;
  }

  // Update assignedTo
  if (req.body.assignedTo !== undefined) {
    if (req.body.assignedTo === null) {
      keyResult.assignedTo = null;
    } else {
      if (!mongoose.isValidObjectId(req.body.assignedTo)) {
        res.status(400);
        throw new Error("Invalid user ID");
      }
      const userExists = await User.exists({ _id: req.body.assignedTo });
      if (!userExists) {
        res.status(400);
        throw new Error("User not found");
      }
      keyResult.assignedTo = req.body.assignedTo;
    }
  }

  //Update Progress
  if (req.body.progress !== undefined) {
    const progress = Number(req.body.progress);

    if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
      res.status(400);
      throw new Error("Progress must be between 0 and 100");
    }

    keyResult.progress = progress;
  }

  //Update status
  if (req.body.status !== undefined) {
    const allowedStatuses = [
      "on-track",
      "at-risk",
      "overdue",
      "completed"
    ];

    if (!allowedStatuses.includes(req.body.status)) {
      res.status(400);
      throw new Error("Invalid key result status");
    }

    keyResult.status = req.body.status;
  }

  //Update approval
  if (req.body.approved !== undefined) {
    keyResult.approved = req.body.approved;
  }

  await keyResult.save();

  await keyResult.populate("assignedTo", "firstName lastName");

  const kr = keyResult.toObject();
  kr.id = kr._id.toString();
  kr.assigned = kr.assignedTo ? getName(kr.assignedTo) : "Unassigned";

  res.status(200).json(kr);
});

const deleteKeyResult = asyncHandler(async (req, res) => {
  const { objectiveId, keyResultId } = req.params;
  if (
    !mongoose.isValidObjectId(objectiveId) ||
    !mongoose.isValidObjectId(keyResultId)
  ) {
    res.status(400);
    throw new Error("Invalid ID");
  }

  const objective = await OkrObjective.findById(objectiveId);
  if (!objective) {
    res.status(404);
    throw new Error("Objective not found");
  }

  const keyResult = await OkrKeyResult.findById(keyResultId);
  if (!keyResult) {
    res.status(404);
    throw new Error("Key result not found");
  }

  if (keyResult.objective.toString() !== objectiveId) {
    res.status(400);
    throw new Error("Key result does not belong to this objective");
  }

  // Delete old key result calendar entries
  if (keyResult.calendarEntry) {
    await deleteLinkedCalendarEntry({
      entryId: keyResult.calendarEntry,
      actorUser: req.user,
    });
  }

  await keyResult.deleteOne();
  res.status(200).json({ id: keyResultId });
});


const approveKeyResult = asyncHandler(async (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.keyResultId)) {
    res.status(404);
    throw new Error("Key result not found");
  }
  if (typeof req.body.approved !== "boolean") {
    res.status(400);
    throw new Error("Approved must be true or false");
  }
  const result = await writes.transaction(async (session) => {
    const objective = await writes.lockObjective(req.params.id, session);
    if (!objective) {
      res.status(404);
      throw new Error("Objective not found");
    }
    await assertObjectiveAccess(
      req,
      res,
      objective,
      session,
      "Approve Key Results",
    );
    const keyResult = await OkrKeyResult.findOne(
      { _id: req.params.keyResultId, objective: objective._id },
      null,
      { session },
    );
    if (!keyResult) {
      res.status(404);
      throw new Error("Key result not found");
    }
    keyResult.approved = req.body.approved;
    keyResult.approvedBy = req.body.approved ? req.user._id : null;
    keyResult.approvedAt = req.body.approved ? new Date() : null;
    await keyResult.save({ session });
    return keyResult;
  });
  res.json(result);
});

const linkCalendar = asyncHandler(async (req, res) => {
  if (
    !mongoose.isObjectIdOrHexString(req.params.id) ||
    !mongoose.isObjectIdOrHexString(req.body.calendarEntry)
  ) {
    res.status(400);
    throw new Error("Please supply valid objective and calendar IDs");
  }
  const result = await writes.transaction(async (session) => {
    const objective = await writes.lockObjective(req.params.id, session);
    if (!objective) {
      res.status(404);
      throw new Error("Objective not found");
    }
    if (
      objective.calendarEntry &&
      objective.calendarEntry.toString() !== req.body.calendarEntry
    ) {
      res.status(409);
      throw new Error("This objective already has a calendar link");
    }
    const entry = await CalendarEntry.findOneAndUpdate(
      { _id: req.body.calendarEntry, category: "OKR Objective" },
      { $inc: { __v: 1 } },
      { new: true, session },
    );
    if (!entry) {
      res.status(404);
      throw new Error("OKR calendar entry not found");
    }
    if (
      await OkrObjective.exists({
        calendarEntry: entry._id,
        _id: { $ne: objective._id },
      }).session(session)
    ) {
      res.status(409);
      throw new Error("Calendar entry is already linked to another objective");
    }
    objective.calendarEntry = entry._id;
    await writes.syncCalendar(objective, req.user, session);
    return { id: objective.id, calendarEntry: entry.id };
  });
  res.json(result);
});

const getReport = asyncHandler(async (req, res) => {
  const objectives = await OkrObjective.find().populate(
    "owner",
    "firstName lastName",
  );
  const groups = [];
  let totalProgress = 0;
  let onTrack = 0;
  for (const objective of objectives) {
    const data = await loadObjective(objective);
    const progress = data.objective.progress || 0;
    totalProgress += progress;
    if (objective.status === "on-track") onTrack++;
    let group = groups.find((item) => item.name === objective.group);
    if (!group) {
      group = { name: objective.group, objectives: 0, progress: 0 };
      groups.push(group);
    }
    group.objectives++;
    group.progress += progress;
  }
  for (const group of groups)
    group.progress = Math.round(group.progress / group.objectives);
  groups.sort((a, b) => a.name.localeCompare(b.name));
  res.json({
    totalObjectives: objectives.length,
    onTrack,
    averageProgress: objectives.length
      ? Math.round(totalProgress / objectives.length)
      : 0,
    groups,
  });
});

module.exports = {
  // Objectives
  getObjectives,
  getObjectiveGroups,
  getObjective,
  createObjective,
  updateObjective,
  deleteObjective,
  // Key Results
  getKeyResults,
  getKeyResult,
  createKeyResult,
  updateKeyResult,
  deleteKeyResult,
  linkCalendar,
  approveKeyResult,
  getReport,
};
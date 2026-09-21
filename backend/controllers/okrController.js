const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const OkrObjective = require("../models/okrObjectiveModel");
const OkrKeyResult = require("../models/okrKeyResultModel");
const CalendarEntry = require("../models/calendarEntryModel");
const User = require("../models/userModel");
const OkrGroup = require("../models/okrGroupModel");
const OkrEvidence = require("../models/okrEvidenceModel");
const writes = require("../services/okrWrites");
const {
  assertObjectiveAccess,
  hasObjectivePermission,
  canUserCreateObjective,
  canUserManageObjective,
} = require("../middleware/okrPermissions");

function requireText(value, message, res) {
  if (typeof value !== "string" || !value.trim()) {
    res.status(400);
    throw new Error(message);
  }
  return value.trim();
}

function validateDueDate(value, res) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    isNaN(new Date(value).getTime())
  ) {
    res.status(400);
    throw new Error("Please add a valid due date");
  }
}

async function validateUser(value, label, res) {
  if (typeof value !== "string" || !mongoose.isObjectIdOrHexString(value)) {
    res.status(400);
    throw new Error("Please select a valid " + label);
  }
  if (!(await User.exists({ _id: value }))) {
    res.status(400);
    throw new Error("Selected " + label + " was not found");
  }
}

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

async function loadObjective(objective, user) {
  const userCanManage = user
    ? await canUserManageObjective(user, objective)
    : false;
  const keyResultDocuments = await OkrKeyResult.find({
    objective: objective._id,
  })
    .populate("assignedTo", "firstName lastName")
    .sort({ createdAt: 1 });

  const keyResults = [];
  let totalWeight = 0;
  let totalProgress = 0;

  for (let i = 0; i < keyResultDocuments.length; i++) {
    const keyResult = keyResultDocuments[i].toObject();

    keyResult.id = keyResult._id.toString();

    if (keyResult.assignedTo) {
      keyResult.assigned = getName(keyResult.assignedTo);
    } else {
      keyResult.assigned = "Unassigned";
    }

    if (user) {
      const assignedId =
        keyResult.assignedTo &&
        (keyResult.assignedTo._id || keyResult.assignedTo);
      const isAssigned =
        assignedId && assignedId.toString() === user._id.toString();
      keyResult.canManageEvidence = isAssigned || userCanManage;
    }

    totalWeight = totalWeight + keyResult.weight;
    totalProgress = totalProgress + keyResult.progress * keyResult.weight;
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

  objectiveData.progress = 0;

  if (totalWeight > 0) {
    objectiveData.progress = Math.round(totalProgress / totalWeight);
  }

  objectiveData.canManage = false;

  if (user) {
    objectiveData.canManage = userCanManage;
    objectiveData.canCreateKeyResult =
      objectiveData.canManage &&
      (await hasObjectivePermission(user, objective, "Create Key Results"));
    objectiveData.canApproveKeyResult =
      objectiveData.canManage &&
      (await hasObjectivePermission(user, objective, "Approve Key Results"));
  }

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
  const objectiveGroups = await OkrObjective.distinct("group", {
    group: { $nin: ["", "none"] },
  });
  const savedGroups = await OkrGroup.find().select("name");
  const groups = [...objectiveGroups];

  for (let i = 0; i < savedGroups.length; i++) {
    if (!groups.includes(savedGroups[i].name)) {
      groups.push(savedGroups[i].name);
    }
  }

  res.status(200).json(groups.sort());
});

const getObjective = asyncHandler(async (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    res.status(404);
    throw new Error("Objective not found");
  }

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
  const title = requireText(req.body.title, "Please add a title", res);
  await validateUser(req.body.owner, "owner", res);
  validateDueDate(req.body.dueDate, res);

  if (
    req.body.description !== undefined &&
    typeof req.body.description !== "string"
  ) {
    res.status(400);
    throw new Error("Please add a valid description");
  }

  let group = "none";
  if (req.body.group !== undefined) {
    group = requireText(req.body.group, "Please select a valid group", res);
  }

  const commitmentType =
    req.body.commitmentType === undefined
      ? "committed"
      : req.body.commitmentType;
  if (!["committed", "aspirational"].includes(commitmentType)) {
    res.status(400);
    throw new Error("Please select a valid objective type");
  }

  const objective = await writes.transaction(async (session) => {
    await writes.requireGroup(group, session);
    if (!(await canUserCreateObjective(req.user, group, session))) {
      res.status(403);
      throw new Error("You do not have permission to create objectives");
    }
    const created = new OkrObjective({
      title,
      description: req.body.description,
      group,
      owner: req.body.owner,
      dueDate: req.body.dueDate,
      commitmentType,
    });
    await writes.syncCalendar(created, req.user, session);
    return created;
  });

  const objectiveData = objective.toObject();
  objectiveData.canManage = await canUserManageObjective(req.user, objective);

  res.status(201).json(objectiveData);
});

const updateObjective = asyncHandler(async (req, res) => {
  const objective = await writes.transaction(async (session) => {
    const objective = await writes.lockObjective(req.params.id, session);

    if (!objective) {
      res.status(404);
      throw new Error("Objective not found");
    }

    await assertObjectiveAccess(req, res, objective, session);
    await writes.linkLegacyCalendar(objective, session);

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

      await writes.requireGroup(group, session);
      objective.group = group;
    }

    if (req.body.owner !== undefined) {
      if (
        typeof req.body.owner !== "string" ||
        !mongoose.isObjectIdOrHexString(req.body.owner)
      ) {
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
      validateDueDate(req.body.dueDate, res);
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

    await writes.syncCalendar(objective, req.user, session);
    return objective;
  });
  await objective.populate("owner", "firstName lastName");

  const data = await loadObjective(objective, req.user);
  data.objective.keyResults = data.keyResults;

  res.status(200).json(data.objective);
});

const deleteObjective = asyncHandler(async (req, res) => {
  await writes.transaction(async (session) => {
    const objective = await writes.lockObjective(req.params.id, session);
    if (!objective) {
      res.status(404);
      throw new Error("Objective not found");
    }
    await assertObjectiveAccess(req, res, objective, session);
    await writes.linkLegacyCalendar(objective, session);
    await OkrEvidence.deleteMany({ objective: objective._id }, { session });
    await OkrKeyResult.deleteMany({ objective: objective._id }, { session });
    await writes.removeCalendar(objective, session);
    await objective.deleteOne({ session });
  });
  res.status(200).json({ id: req.params.id });
});

const createKeyResult = asyncHandler(async (req, res) => {
  const title = requireText(req.body.title, "Please add a title", res);
  validateDueDate(req.body.dueDate, res);

  if (!["string", "number"].includes(typeof req.body.weight)) {
    res.status(400);
    throw new Error("Weight must be a number between 1 and 100");
  }
  const newWeight = Number(req.body.weight);
  if (!Number.isFinite(newWeight) || newWeight < 1 || newWeight > 100) {
    res.status(400);
    throw new Error("Weight must be a number between 1 and 100");
  }

  if (req.body.assignedTo !== undefined && req.body.assignedTo !== null) {
    await validateUser(req.body.assignedTo, "assignee", res);
  }

  const keyResult = await writes.transaction(async (session) => {
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
      "Create Key Results",
    );
    const keyResults = await OkrKeyResult.find(
      { objective: objective._id },
      null,
      { session },
    );

    let usedWeight = 0;

    for (let i = 0; i < keyResults.length; i++) {
      usedWeight = usedWeight + keyResults[i].weight;
    }

    const weightLeft = 100 - usedWeight;

    if (newWeight > weightLeft) {
      res.status(400);
      throw new Error(
        "Weights cannot go over 100. Only " + weightLeft + " is left.",
      );
    }

    const keyResult = new OkrKeyResult({
      objective: objective._id,
      title: title,
      weight: newWeight,
      assignedTo: req.body.assignedTo,
      dueDate: req.body.dueDate,
    });

    await keyResult.save({ session });
    return keyResult;
  });
  res.status(201).json(keyResult);
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
    const progress = data.objective.progress;
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
  linkCalendar,
  approveKeyResult,
  getReport,
  getObjectives,
  getObjectiveGroups,
  getObjective,
  createObjective,
  updateObjective,
  deleteObjective,
  createKeyResult,
};

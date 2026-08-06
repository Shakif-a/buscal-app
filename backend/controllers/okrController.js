const asyncHandler = require("express-async-handler");
const OkrObjective = require("../models/okrObjectiveModel");
const OkrKeyResult = require("../models/okrKeyResultModel");

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

async function loadObjective(objective) {
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

  return {
    objective: objectiveData,
    keyResults: keyResults,
  };
}

const getObjectives = asyncHandler(async (req, res) => {
  const objectives = await OkrObjective.find()
    .populate("owner", "firstName lastName")
    .sort({ dueDate: 1 });

  const result = [];

  for (let i = 0; i < objectives.length; i++) {
    const data = await loadObjective(objectives[i]);

    data.objective.keyResults = data.keyResults;
    result.push(data.objective);
  }

  res.status(200).json(result);
});

const getObjectiveGroups = asyncHandler(async (req, res) => {
  const groups = await OkrObjective.distinct("group", { group: { $ne: "" } });

  res.status(200).json(groups.sort());
});

const getObjective = asyncHandler(async (req, res) => {
  const objective = await OkrObjective.findById(req.params.id).populate(
    "owner",
    "firstName lastName"
  );

  if (!objective) {
    res.status(404);
    throw new Error("Objective not found");
  }

  const data = await loadObjective(objective);
  res.status(200).json(data);
});

const createObjective = asyncHandler(async (req, res) => {
  const { title, dueDate, group, commitmentType, owner } = req.body;

  if (!title || !dueDate || !group || !owner) {
    res.status(400);
    throw new Error("Please fill in the title, group, owner and due date");
  }

  const objective = await OkrObjective.create({
    title: title,
    description: req.body.description || "",
    dueDate: dueDate,
    group: group,
    commitmentType: commitmentType || "committed",
    owner: owner,
  });

  res.status(201).json(objective);
});

const updateObjective = asyncHandler(async (req, res) => {
  const objective = await OkrObjective.findById(req.params.id);

  if (!objective) {
    res.status(404);
    throw new Error("Objective not found");
  }

  const fields = [
    "title",
    "description",
    "group",
    "commitmentType",
    "owner",
    "dueDate",
  ];

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];

    if (req.body[field] !== undefined) {
      objective[field] = req.body[field];
    }
  }

  await objective.save();

  res.status(200).json(objective);
});

const deleteObjective = asyncHandler(async (req, res) => {
  const objective = await OkrObjective.findById(req.params.id);

  if (!objective) {
    res.status(404);
    throw new Error("Objective not found");
  }

  await OkrKeyResult.deleteMany({ objective: objective._id });
  await objective.deleteOne();

  res.status(200).json({ id: req.params.id });
});

const createKeyResult = asyncHandler(async (req, res) => {
  const { title, weight, assignedTo, dueDate } = req.body;

  const objective = await OkrObjective.findById(req.params.id);

  if (!objective) {
    res.status(404);
    throw new Error("Objective not found");
  }

  if (!title || !weight || !dueDate) {
    res.status(400);
    throw new Error("Please fill in the title, weight and due date");
  }

  const existing = await OkrKeyResult.find({ objective: objective._id });

  let usedWeight = 0;

  for (let i = 0; i < existing.length; i++) {
    usedWeight = usedWeight + existing[i].weight;
  }

  if (usedWeight + Number(weight) > 100) {
    res.status(400);
    throw new Error(
      "Weights cannot go over 100. Only " + (100 - usedWeight) + " is left."
    );
  }

  const keyResult = await OkrKeyResult.create({
    objective: objective._id,
    title: title,
    weight: weight,
    assignedTo: assignedTo || null,
    dueDate: dueDate,
    progress: req.body.progress || 0,
  });

  res.status(201).json(keyResult);
});

module.exports = {
  getObjectives,
  getObjectiveGroups,
  getObjective,
  createObjective,
  updateObjective,
  deleteObjective,
  createKeyResult,
};

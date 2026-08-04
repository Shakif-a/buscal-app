const asyncHandler = require("express-async-handler");
const OkrObjective = require("../models/okrObjectiveModel");
const OkrKeyResult = require("../models/okrKeyResultModel");

const getFullName = (user) => {
  if (!user) {
    return "";
  }

  return `${user.firstName || ""} ${user.lastName || ""}`.trim();
};

const formatKeyResult = (keyResult) => {
  const data = keyResult.toObject();

  data.id = data._id.toString();
  data.assigned = getFullName(data.assignedTo) || "Unassigned";

  return data;
};

const calculateProgress = (keyResults) => {
  let totalWeight = 0;
  let totalProgress = 0;

  for (const keyResult of keyResults) {
    totalWeight += keyResult.weight;
    totalProgress += keyResult.progress * keyResult.weight;
  }

  if (totalWeight === 0) {
    return 0;
  }

  return Math.round(totalProgress / totalWeight);
};

const formatObjective = (objective, keyResults = []) => {
  const data = objective.toObject();
  const type = data.commitmentType || "committed";

  data.id = data._id.toString();
  data.manager = getFullName(data.owner);
  data.commitmentType = type;
  data.type = type.charAt(0).toUpperCase() + type.slice(1);
  data.progress = calculateProgress(keyResults);

  return data;
};

const getKeyResults = async (objectiveId) => {
  const keyResults = await OkrKeyResult.find({ objective: objectiveId })
    .populate("assignedTo", "firstName lastName")
    .sort({ createdAt: 1 });

  const result = [];

  for (const keyResult of keyResults) {
    result.push(formatKeyResult(keyResult));
  }

  return result;
};

const getObjectives = asyncHandler(async (req, res) => {
  const objectives = await OkrObjective.find()
    .populate("owner", "firstName lastName")
    .sort({ dueDate: 1 });

  const result = [];

  for (const objective of objectives) {
    const keyResults = await getKeyResults(objective._id);
    const objectiveData = formatObjective(objective, keyResults);

    objectiveData.keyResults = keyResults;
    result.push(objectiveData);
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

  const keyResults = await getKeyResults(objective._id);

  res.status(200).json({
    objective: formatObjective(objective, keyResults),
    keyResults,
  });
});

module.exports = { getObjectives, getObjectiveGroups, getObjective };

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
  const totalWeight = keyResults.reduce(
    (total, keyResult) => total + keyResult.weight,
    0
  );

  if (totalWeight === 0) {
    return 0;
  }

  const weightedProgress = keyResults.reduce(
    (total, keyResult) => total + keyResult.progress * keyResult.weight,
    0
  );

  return Math.round(weightedProgress / totalWeight);
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

const getObjectives = asyncHandler(async (req, res) => {
  const objectives = await OkrObjective.find()
    .populate("owner", "firstName lastName")
    .sort({ dueDate: 1 });

  const keyResults = await OkrKeyResult.find({
    objective: { $in: objectives.map((objective) => objective._id) },
  })
    .populate("assignedTo", "firstName lastName")
    .sort({ createdAt: 1 });

  const keyResultsByObjective = {};

  keyResults.forEach((keyResult) => {
    const objectiveId = keyResult.objective.toString();

    if (!keyResultsByObjective[objectiveId]) {
      keyResultsByObjective[objectiveId] = [];
    }

    keyResultsByObjective[objectiveId].push(formatKeyResult(keyResult));
  });

  const result = objectives.map((objective) => {
    const objectiveKeyResults =
      keyResultsByObjective[objective._id.toString()] || [];

    return {
      ...formatObjective(objective, objectiveKeyResults),
      keyResults: objectiveKeyResults,
    };
  });

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

  const keyResults = await OkrKeyResult.find({ objective: objective._id })
    .populate("assignedTo", "firstName lastName")
    .sort({ createdAt: 1 });

  const formattedKeyResults = keyResults.map(formatKeyResult);

  res.status(200).json({
    objective: formatObjective(objective, formattedKeyResults),
    keyResults: formattedKeyResults,
  });
});

module.exports = { getObjectives, getObjectiveGroups, getObjective };

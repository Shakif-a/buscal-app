const asyncHandler = require("express-async-handler");
const OkrObjective = require("../models/okrObjectiveModel");
const OkrKeyResult = require("../models/okrKeyResultModel");

function getName(user) {
  if (!user) {
    return "";
  }

  const firstName = user.firstName || "";
  const lastName = user.lastName || "";
  return (firstName + " " + lastName).trim();
}

async function getKeyResults(objectiveId) {
  const keyResults = await OkrKeyResult.find({ objective: objectiveId })
    .populate("assignedTo", "firstName lastName")
    .sort({ createdAt: 1 });

  const result = [];

  for (let i = 0; i < keyResults.length; i++) {
    const keyResult = keyResults[i].toObject();
    keyResult.id = keyResult._id.toString();
    keyResult.assigned = getName(keyResult.assignedTo);

    if (!keyResult.assigned) {
      keyResult.assigned = "Unassigned";
    }

    result.push(keyResult);
  }

  return result;
}

function getObjectiveData(objective, keyResults) {
  const data = objective.toObject();
  let totalWeight = 0;
  let totalProgress = 0;

  for (let i = 0; i < keyResults.length; i++) {
    totalWeight += keyResults[i].weight;
    totalProgress += keyResults[i].progress * keyResults[i].weight;
  }

  data.id = data._id.toString();
  data.manager = getName(data.owner);

  if (!data.commitmentType) {
    data.commitmentType = "committed";
  }

  data.type =
    data.commitmentType.charAt(0).toUpperCase() +
    data.commitmentType.slice(1);
  data.progress = 0;

  if (totalWeight > 0) {
    data.progress = Math.round(totalProgress / totalWeight);
  }

  return data;
}

const getObjectives = asyncHandler(async (req, res) => {
  const objectives = await OkrObjective.find()
    .populate("owner", "firstName lastName")
    .sort({ dueDate: 1 });

  const result = [];

  for (let i = 0; i < objectives.length; i++) {
    const keyResults = await getKeyResults(objectives[i]._id);
    const objectiveData = getObjectiveData(objectives[i], keyResults);

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
    objective: getObjectiveData(objective, keyResults),
    keyResults,
  });
});

module.exports = { getObjectives, getObjectiveGroups, getObjective };

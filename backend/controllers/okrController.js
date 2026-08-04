const asyncHandler = require("express-async-handler");
const OkrObjective = require("../models/okrObjectiveModel");
const OkrKeyResult = require("../models/okrKeyResultModel");

const addManagerName = (objective) => {
  const item = objective.toObject();
  const owner = item.owner;

  item.manager = owner
    ? [owner.firstName, owner.lastName].filter(Boolean).join(" ")
    : "";

  return item;
};

const getObjectives = asyncHandler(async (req, res) => {
  const objectives = await OkrObjective.find()
    .populate("owner", "firstName lastName")
    .sort({ dueDate: 1 });

  res.status(200).json(objectives.map(addManagerName));
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

  const keyResults = await OkrKeyResult.find({ objective: objective.id })
    .populate("assignedTo", "firstName lastName")
    .sort({ createdAt: 1 });

  res.status(200).json({
    objective: addManagerName(objective),
    keyResults,
  });
});

module.exports = { getObjectives, getObjective };

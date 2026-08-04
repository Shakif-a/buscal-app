const asyncHandler = require("express-async-handler");
const OkrObjective = require("../models/okrObjectiveModel");
const OkrKeyResult = require("../models/okrKeyResultModel");

const formatObjective = (objective) => {
  const data = objective.toObject();

  if (!data.owner) {
    data.manager = "";
    return data;
  }

  const firstName = data.owner.firstName || "";
  const lastName = data.owner.lastName || "";
  data.manager = `${firstName} ${lastName}`.trim();

  return data;
};

const getObjectives = asyncHandler(async (req, res) => {
  const objectives = await OkrObjective.find()
    .populate("owner", "firstName lastName")
    .sort({ dueDate: 1 });

  res.status(200).json(objectives.map(formatObjective));
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

  res.status(200).json({
    objective: formatObjective(objective),
    keyResults,
  });
});

module.exports = { getObjectives, getObjectiveGroups, getObjective };

const { ApiError } = require("../utils/ApiError");
const mongoose = require("mongoose");
const OkrObjective = require("../models/okrObjectiveModel");
const CalendarEntry = require("../models/calendarEntryModel");
const OkrGroup = require("../models/okrGroupModel");

async function transaction(work) {
  let result;
  await mongoose.connection.transaction(async (session) => {
    result = await work(session);
  });
  return result;
}

async function lockObjective(id, session) {
  // Every objective write takes the same database lock, including key-result writes.
  return OkrObjective.findOneAndUpdate(
    { _id: id },
    { $inc: { __v: 1 } },
    { new: true, session },
  );
}

async function requireGroup(groupName, session) {
  if (groupName === "none") {
    return;
  }

  const group = await OkrGroup.findOneAndUpdate(
    { name: groupName },
    { $inc: { __v: 1 } },
    { new: true, session },
  );

  if (!group) {
    const legacyGroup = await OkrObjective.exists({ group: groupName }).session(
      session,
    );

    if (!legacyGroup) {
      throw new ApiError(400, "Selected group was not found");
    }
  }
}

async function linkLegacyCalendar(objective, session) {
  if (objective.calendarEntry || !objective.createdAt) return;
  const filter = {
    category: "OKR Objective",
    title: objective.title,
    endTime: objective.dueDate,
    userAssigned: [objective.owner],
    description: { $in: [objective.description || "", null] },
  };
  const candidates = await CalendarEntry.find(filter, null, { session });
  if (!candidates.length) return;
  const matchingObjectives = await OkrObjective.countDocuments({
    title: objective.title,
    owner: objective.owner,
    dueDate: objective.dueDate,
    description: objective.description,
  }).session(session);
  const candidate = candidates[0];
  const delay = candidate.createdAt - objective.createdAt;
  const alreadyLinked = await OkrObjective.exists({
    calendarEntry: candidate._id,
    _id: { $ne: objective._id },
  }).session(session);
  if (
    candidates.length !== 1 ||
    matchingObjectives !== 1 ||
    alreadyLinked ||
    delay < 0 ||
    delay > 60000
  ) {
    throw new ApiError(
      409,
      "This legacy objective has an ambiguous calendar link. An administrator must link it before editing or deleting it.",
    );
  }
  objective.calendarEntry = candidate._id;
}

async function syncCalendar(objective, user, session) {
  let entry = null;
  if (objective.calendarEntry) {
    entry = await CalendarEntry.findById(objective.calendarEntry, null, {
      session,
    });
  }
  if (!entry) {
    entry = new CalendarEntry({
      userOwner: user._id,
      category: "OKR Objective",
      priority: "normal",
      completionStatus: "not started",
    });
  }
  entry.title = objective.title;
  entry.description = objective.description;
  entry.userAssigned = [objective.owner];
  entry.endTime = objective.dueDate;
  await entry.save({ session });
  objective.calendarEntry = entry._id;
  await objective.save({ session });
}

async function removeCalendar(objective, session) {
  if (objective.calendarEntry) {
    await CalendarEntry.findOneAndDelete(
      { _id: objective.calendarEntry },
      { session },
    );
  }
}

module.exports = {
  linkLegacyCalendar,
  lockObjective,
  removeCalendar,
  requireGroup,
  syncCalendar,
  transaction,
};

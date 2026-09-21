const CalendarEntry = require("../models/calendarEntryModel");
const CalendarHistory = require("../models/calendarHistoryModel");
const { runBusCalService } = require("./busCalendarServices");

// Categories locked for user edits (via clanader)
const OBJECTIVE_CATEGORY = "OKR Objective";
const KEY_RESULT_CATEGORY = "OKR Key Result";

function getActorName(user) {
  if (!user) {
    return "Unknown User";
  }

  const name = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  return name || "Unknown User";
}

function sameId(a, b) {}

function sameTime(a, b) {}


//Creates CalendarEntry + CalendarHistory pair for a new Objectives and KRs + assign busCal notification
async function createLinkedCalendarEntry({
  title,
  description,
  dueDate,
  ownerId,
  assignedId,
  category,
  actorUser,
}) {
  const actorName = getActorName(actorUser);

  const entryData = {
    title,
    userOwner: ownerId,
    userAssigned: [assignedId],
    endTime: dueDate,
    completionStatus: "not started",
    category,
    priority: "normal",
  };

  if (description) {
    entryData.description = description;
  }

  const entry = await CalendarEntry.create(entryData);

  try {
    await CalendarHistory.create({
      ref: entry._id,
      assignments: [
        {
          user: assignedId,
          notes: `${actorName} created this entry via the OKR Tracker.`,
        },
      ],
    });
  } catch (historyError) {
    await CalendarEntry.findByIdAndDelete(entry._id);
    throw historyError;
  }

  const additionalObject = { title, endTime: dueDate };
  if (description) {
    additionalObject.description = description;
  }

  await runBusCalService("assign", entry._id, actorName, additionalObject);

  return entry;
}

module.exports = {
  OBJECTIVE_CATEGORY,
  KEY_RESULT_CATEGORY,
  createLinkedCalendarEntry,
  updateLinkedCalendarEntry,
  deleteLinkedCalendarEntry,
};
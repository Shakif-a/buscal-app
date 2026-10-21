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

function sameId(a, b) {
  if (!a || !b) {
    return false;
  }
  return a.toString() === b.toString();
}
 
function sameTime(a, b) {
  if (!a || !b) {
    return a === b;
  }
  return new Date(a).getTime() === new Date(b).getTime();
}


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

// Sync calander entry with Objective or KR when updated
async function updateLinkedCalendarEntry({
  entryId,
  title,
  description,
  dueDate,
  assignedId,
  actorUser,
}) {
  const actorName = getActorName(actorUser);

  const entry = await CalendarEntry.findById(entryId);
  if (!entry) {
    throw new Error(
      `Linked calendar entry ${entryId} not found - OKR item and calendar are out of sync.`
    );
  }

  const history = await CalendarHistory.findOne({ ref: entryId });
  if (!history) {
    throw new Error(
      `Calendar history for entry ${entryId} not found - OKR item and calendar are out of sync.`
    );
  }

  const changedFields = [];
  let reassigned = false;

  if (title !== undefined && title !== entry.title) {
    entry.title = title;
    changedFields.push("title");
  }

  if (description !== undefined && description !== entry.description) {
    entry.description = description;
    changedFields.push("description");
  }

  if (dueDate !== undefined && !sameTime(dueDate, entry.endTime)) {
    entry.endTime = dueDate;
    changedFields.push("due date");
  }

  if (
    assignedId !== undefined &&
    (entry.userAssigned.length !== 1 || !sameId(entry.userAssigned[0], assignedId))
  ) {
    entry.userAssigned = [assignedId];
    reassigned = true;
  }

  if (changedFields.length === 0 && !reassigned) {
    return entry;
  }

  if (changedFields.length > 0) {
    history.edits.push({
      user: assignedId || entry.userAssigned[0],
      notes: `${actorName} edited ${changedFields.join(", ")} via the OKR Tracker.`,
    });
  }

  if (reassigned) {
    history.reassignments.push({
      user: assignedId,
      notes: `${actorName} reassigned this entry via the OKR Tracker.`,
    });
  }

  await entry.save();
  await history.save();

  const additionalObject = { title: entry.title, endTime: entry.endTime };
  if (entry.description) {
    additionalObject.description = entry.description;
  }

  if (reassigned) {
    await runBusCalService("reassign", entry._id, actorName, additionalObject);
  } else {
    await runBusCalService("edit", entry._id, actorName, additionalObject);
  }

  return entry;
}

// Deletes calandar entry and handles history
async function deleteLinkedCalendarEntry({ entryId, actorUser }) {
  if (!entryId) {
    return;
  }

  const actorName = getActorName(actorUser);
  const entry = await CalendarEntry.findById(entryId);
  if (!entry) {
    return;
  }

  await runBusCalService("cancel", entryId, actorName, {
    completionStatus: "cancelled",
  });

  await CalendarEntry.findByIdAndDelete(entryId);
  await CalendarHistory.findOneAndDelete({ ref: entryId });
}

module.exports = {
  OBJECTIVE_CATEGORY,
  KEY_RESULT_CATEGORY,
  createLinkedCalendarEntry,
  updateLinkedCalendarEntry,
  deleteLinkedCalendarEntry,
};
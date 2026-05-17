const RRule = require("rrule").RRule;
const CalendarEntry = require("../models/calendarEntryModel");
const CalendarHistory = require("../models/calendarHistoryModel");

// Get first Sunday of a given month and year
const getFirstSunday = (year, month) => {
  const date = new Date(Date.UTC(year, month, 1));
  while (date.getUTCDay() !== 0) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return date;
};

// Check if a UTC date falls within DST period for Australia/Sydney
const isDateInDST = (utcDate) => {
  const year = utcDate.getUTCFullYear();

  const aprilFirst = getFirstSunday(year, 3); // April is month 3
  const octoberFirst = getFirstSunday(year, 9); // October is month 9

  aprilFirst.setUTCHours(16, 0, 0, 0); // 3:00 AM AEDT = 16:00 UTC previous day
  octoberFirst.setUTCHours(16, 0, 0, 0); // 2:00 AM AEST = 16:00 UTC previous day

  const inDST = !(utcDate >= aprilFirst && utcDate < octoberFirst);
  return inDST;
};

// Calculate required UTC adjustment to maintain consistent local time
const calculateUTCAdjustment = (originalUTCDate, newUTCDate) => {
  const originalInDST = isDateInDST(originalUTCDate);
  const newInDST = isDateInDST(newUTCDate);

  if (!originalInDST && newInDST) {
    console.log("Adjusting UTC -1 hour: Transitioning into DST");
    return -60 * 60 * 1000;
  }

  if (originalInDST && !newInDST) {
    console.log("Adjusting UTC +1 hour: Transitioning out of DST");
    return 60 * 60 * 1000;
  }

  console.log("No UTC adjustment needed - both dates in same DST state");
  return 0;
};

function createBaseCopy(entry) {
  const {
    _id,
    notes,
    createdAt,
    updatedAt,
    whenAlarm,
    startTime,
    endTime,
    ...copyFields
  } = entry;
  const baseCopy = {
    ...copyFields,
    originalEntry: entry._id,
    completionStatus: "not started",
    progress: 0,
    file: null,
  };
  return baseCopy;
}

function determineTimeDecider(entry, firstDate) {
  if (firstDate.getTime() === new Date(entry.startTime).getTime()) {
    return "startTime";
  }
  if (firstDate.getTime() === new Date(entry.endTime).getTime()) {
    return "endTime";
  }
  const timeDecider = ["meeting", "general", "event"].includes(entry.category)
    ? "startTime"
    : "endTime";
  return timeDecider;
}

async function handleRecurringEntries() {
  try {
    console.log("Fetching recurring entries...");
    const recurringEntries = await CalendarEntry.find({
      recurrence: { $ne: null },
      originalEntry: { $eq: null },
      completionStatus: { $ne: "cancelled" },
    }).lean();

    const COPIES_TO_MAINTAIN = 4;
    const today = new Date();

    for (const entry of recurringEntries) {
      const rrule = RRule.fromString(entry.recurrence);
      const rdates = rrule.all();
      const dates = [
        rdates[0],
        ...rdates.slice(1).filter((date) => date >= today),
      ];

      const timeDecider = determineTimeDecider(entry, dates[0]);

      const recurrentCopies = await CalendarEntry.find({
        originalEntry: entry._id,
      }).lean();

      const activeCopies = recurrentCopies.filter(
        (copy) => !["completed", "cancelled"].includes(copy.completionStatus)
      );

      const ONE_AND_HALF_HOURS_MS = 1.5 * 60 * 60 * 1000;

      const datesToAdd = dates
        .slice(1)
        .filter((date) => {
          const isDateRepresented = recurrentCopies.some((copy) => {
            const copyTime = copy[timeDecider].getTime();
            const dateTime = date.getTime();
            return Math.abs(copyTime - dateTime) <= ONE_AND_HALF_HOURS_MS;
          });

          return !isDateRepresented;
        })
        .slice(0, COPIES_TO_MAINTAIN - activeCopies.length);

      if (datesToAdd && datesToAdd.length > 0) {
        console.log(
          "Dates to add:",
          datesToAdd.map((d) => d.toISOString())
        );
      }

      const copiesToAdd = datesToAdd.map((date) => {
        const copy = createBaseCopy(entry);
        const referenceTime = new Date(entry[timeDecider]);

        const timeDiff = date.getTime() - referenceTime.getTime();
        const utcAdjustment = calculateUTCAdjustment(referenceTime, date);

        if (entry.startTime) {
          copy.startTime = new Date(
            new Date(entry.startTime).getTime() + timeDiff + utcAdjustment
          );
        }
        if (entry.endTime) {
          copy.endTime = new Date(
            new Date(entry.endTime).getTime() + timeDiff + utcAdjustment
          );
        }
        if (entry.whenAlarm) {
          copy.whenAlarm = new Date(
            new Date(entry.whenAlarm).getTime() + timeDiff + utcAdjustment
          );
        }

        return copy;
      });

      if (copiesToAdd.length > 0) {
        for (const copyToAdd of copiesToAdd) {
          const savedCopy = await CalendarEntry.create(copyToAdd);
          console.log("Saved copy:", {
            id: savedCopy._id,
            startTime: savedCopy.startTime,
            endTime: savedCopy.endTime,
          });

          await CalendarHistory.create({
            ref: savedCopy._id,
            assignments:
              Array.isArray(entry.userAssigned) && entry.userAssigned.length > 0
                ? entry.userAssigned.map((userId) => ({
                    user: userId,
                    notes: "System created this recurrent copy of the entry.",
                  }))
                : [
                    {
                      user: entry.userAssigned || entry.createdBy,
                      notes: "System created this recurrent copy of the entry.",
                    },
                  ],
          });
          console.log("History created for copy:", savedCopy._id);
        }
      }
    }
    console.log("Finished processing all recurring entries.");
  } catch (error) {
    console.error("Error handling recurring entries:", error);
    throw error;
  }
}

module.exports = handleRecurringEntries;

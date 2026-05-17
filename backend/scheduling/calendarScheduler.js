// calendarScheduler.js

const cron = require("node-cron");
const mongoose = require("mongoose");

const CalendarEntry = require("../models/calendarEntryModel");
const handleRecurringEntries = require("./handleRecurringEntries");
const {
  runBusCalService,
} = require("../services/busCalendarServices");
const {
  scheduleAllEntries,
  listCurrentSchedules,
  processSchedules,
} = require("../services/reminderService");

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getUpcomingEntries() {
  try {
    if (!isMongoConnected()) {
      console.warn("MongoDB not connected, skipping getUpcomingEntries");
      return [];
    }

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);

    // Entries ending in the next 24 hours
    const upcomingEntries = await CalendarEntry.find({
      endTime: { $gte: now, $lt: tomorrow },
      completionStatus: { $nin: ["completed", "cancelled"] },
    }).select("_id");

    // Entries that have already ended but are not completed/cancelled/overdue
    const overdueEntries = await CalendarEntry.find({
      endTime: { $lt: now },
      completionStatus: { $nin: ["completed", "cancelled", "overdue"] },
    }).select("_id");

    // Entries marked overdue but whose end time is now in the future
    const futureOverdueEntries = await CalendarEntry.find({
      endTime: { $gte: now },
      completionStatus: "overdue",
    }).select("_id");

    return [
      ...upcomingEntries.map((entry) => entry._id),
      ...overdueEntries.map((entry) => entry._id),
      ...futureOverdueEntries.map((entry) => entry._id),
    ];
  } catch (error) {
    console.error("Error fetching entries:", error);
    return [];
  }
}

async function makeEntriesOverdue(entryIds) {
  try {
    if (!isMongoConnected()) {
      console.warn("MongoDB not connected, skipping makeEntriesOverdue");
      return;
    }

    const now = new Date();

    for (const entryId of entryIds) {
      const entry = await CalendarEntry.findById(entryId);

      if (!entry) {
        continue;
      }

      // Mark overdue
      if (
        entry.endTime < now &&
        !["completed", "cancelled"].includes(entry.completionStatus)
      ) {
        entry.completionStatus = "overdue";
        await entry.save();

        await runBusCalService("overdue", entryId, "System");
      }
      // Restore if entry is no longer overdue
      else if (
        entry.endTime >= now &&
        entry.completionStatus === "overdue"
      ) {
        entry.completionStatus = "in progress";
        await entry.save();
      }
    }
  } catch (error) {
    console.error("Error updating entries:", error);
  }
}

// -----------------------------------------------------------------------------
// Cron Jobs
// -----------------------------------------------------------------------------

// Run every day at midnight and noon
cron.schedule("0 0,12 * * *", async () => {
  try {
    if (!isMongoConnected()) {
      console.warn("MongoDB not connected, skipping daily cron job");
      return;
    }

    await getUpcomingEntries();
    await delay(1000);
    await handleRecurringEntries();

    listCurrentSchedules();
  } catch (error) {
    console.error("Error in daily cron job:", error);
  }
});

// Run every 20 minutes
cron.schedule("*/20 * * * *", async () => {
  try {
    if (!isMongoConnected()) {
      console.warn("MongoDB not connected, skipping 20-minute cron job");
      return;
    }

    const upcomingEntries = await getUpcomingEntries();
    await makeEntriesOverdue(upcomingEntries);
  } catch (error) {
    console.error("Error in 20-minute cron job:", error);
  }
});

// Run every minute
cron.schedule("* * * * *", async () => {
  try {
    if (!isMongoConnected()) {
      console.warn("MongoDB not connected, skipping minute cron job");
      return;
    }

    await processSchedules();
  } catch (error) {
    console.error("Error in minute cron job:", error);
  }
});

// -----------------------------------------------------------------------------
// Initialisation
// -----------------------------------------------------------------------------

async function initializeCalendarScheduler() {
  try {
    if (!isMongoConnected()) {
      console.warn(
        "MongoDB not connected, skipping calendar scheduler initialisation",
      );
      return;
    }

    console.log("Initialising calendar scheduler...");

    const upcomingEntries = await getUpcomingEntries();

    await scheduleAllEntries();
    await delay(1000);

    await handleRecurringEntries();
    await delay(1000);

    await makeEntriesOverdue(upcomingEntries);

    await delay(2000);

    listCurrentSchedules();

    console.log("Calendar scheduler initialised successfully");
  } catch (error) {
    console.error("Error initialising calendar scheduler:", error);
  }
}

module.exports = {
  initializeCalendarScheduler,
};
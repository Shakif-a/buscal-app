const schedule = require("node-schedule");
const moment = require("moment-timezone");
const Scheduler = require("../models/schedulerModel");
const CalendarEntry = require("../models/calendarEntryModel");
const { runBusCalService } = require("./busCalendarServices");

const TIMEZONE = "Australia/Sydney";
/**
 * Adjusts a given time to fit within standard work hours (9am-5pm) in Australia/Sydney timezone
 * @param {Date} time - Input datetime to be adjusted
 * @returns {Date} Adjusted datetime within work hours
 */
function adjustWorkHours(time) {
  const sydneyTime = moment(time).tz(TIMEZONE);

  // Check if it's a weekend (Saturday or Sunday)
  if (sydneyTime.day() === 0 || sydneyTime.day() === 6) {
    const fridayAtFivePM = sydneyTime
      .clone()
      .day(5)
      .hours(17)
      .minutes(0)
      .seconds(0);
    return fridayAtFivePM.toDate();
  }

  const workdayStart = sydneyTime.clone().hours(8).minutes(0).seconds(0);
  const workdayEnd = sydneyTime.clone().hours(17).minutes(0).seconds(0);

  // Adjust for early morning hours (0000 to 0800)
  if (sydneyTime.isBefore(workdayStart)) {
    return workdayStart.toDate();
  }

  // Adjust for late evening hours (1700 to 2359)
  if (sydneyTime.isAfter(workdayEnd)) {
    return workdayEnd.toDate();
  }

  return time;
}

/**
 * Cancels all scheduled jobs for a specific calendar entry
 * @param {string} entryId - ID of the calendar entry
 */
function cancelSchedule(entryId) {
  const jobs = schedule.scheduledJobs;
  // console.log("Cancel this schedule, ", entryId);

  for (const jobName in jobs) {
    if (jobName.startsWith(entryId.toString())) {
      jobs[jobName].cancel();
      // console.log(`Cancelled schedule for entry: ${entryId}`);
    }
  }
}

/**
 * Cancels all existing scheduled jobs
 */
function cancelAllSchedules() {
  const jobs = schedule.scheduledJobs;
  for (const jobName in jobs) {
    jobs[jobName].cancel();
    // console.log(`Cancelled job: ${jobName}`);
  }
}

/**
 * Schedules reminders for calendar entries based on the Scheduler model
 */
async function processSchedules() {
  try {
    // Check database connection
    const mongoose = require("mongoose");
    if (mongoose.connection.readyState !== 1) {
      console.warn("MongoDB not connected, skipping processSchedules");
      return;
    }

    const scheduler = await Scheduler.findOne({ name: "calendarschedule" });
    if (!scheduler) {
      console.error("No Scheduler document found.");
      return;
    }

    const { toschedule, tocancel } = scheduler;

    // Cancel schedules for entries in tocancel
    for (const entryId of tocancel) {
      cancelSchedule(entryId);
    }

    scheduler.tocancel = []; // Clear tocancel array

    for (const entryId of toschedule) {
      const calendarEntry = await CalendarEntry.findById(entryId);

      if (!calendarEntry) {
        console.error(`CalendarEntry not found for ID: ${entryId}`);
        continue;
      }

      if (["completed", "cancelled"].includes(calendarEntry.completionStatus)) {
        // console.log(`Skipping completed/cancelled entry: ${calendarEntry._id}`);
        continue;
      }

      // console.log("Scheduling reminders for entry:", calendarEntry);

      cancelSchedule(entryId); // Cancel existing schedules
      scheduleEntryReminders(calendarEntry); // Schedule new reminders
    }

    scheduler.toschedule = []; // Clear toschedule array
    await scheduler.save();
  } catch (error) {
    console.error("Error processing schedules:", error);
  }
}

/**
 * Schedules reminders for a single calendar entry
 * @param {Object} calendarEntry - The calendar entry to schedule reminders for
 */
function scheduleEntryReminders(calendarEntry) {
  const {
    _id,
    category,
    startTime,
    endTime,
    whenAlarm,
    completionStatus,
    priority,
  } = calendarEntry;

  // Skip scheduling for completed or cancelled entries
  if (["completed", "cancelled"].includes(completionStatus)) {
    return;
  }

  // Use moment for consistent timezone and immutable operations
  const now = moment().tz(TIMEZONE);

  let dueTime = moment(
    category === "general" || category === "meeting" || category === "event"
      ? startTime
      : endTime
  ).tz(TIMEZONE);

  // Skip if the dueTime is not valid or is in the past
  if (!dueTime.isValid()) {
    return;
  }
  if (dueTime.isBefore(now) && completionStatus !== "overdue") {
    return;
  }

  // Immutably adjust due time
  const adjustedDueTime = moment(adjustWorkHours(dueTime.toDate())).tz(
    TIMEZONE
  );

  // Handle overdue entries with immutable date operations
  if (completionStatus === "overdue") {
    const originalDueTime = moment(
      category === "general" || category === "meeting" || category === "event"
        ? startTime
        : endTime
    ).tz(TIMEZONE);

    let startScheduleDate = adjustedDueTime.isBefore(now)
      ? moment(adjustWorkHours(now.toDate())).tz(TIMEZONE)
      : adjustedDueTime;

    // Apply the time from adjustedDueTime to startScheduleDate
    startScheduleDate.set({
      hour: adjustedDueTime.hour(),
      minute: adjustedDueTime.minute(),
      second: adjustedDueTime.second(),
      millisecond: adjustedDueTime.millisecond(),
    });

    const scheduleOverdueReminders = (priorityConfig) => {
      const { intervals, jobPrefix } = priorityConfig;

      intervals.forEach((interval, index) => {
        const reminderTime = startScheduleDate
          .clone()
          .add(interval.unit, interval.value);

        if (reminderTime.isValid() && reminderTime.isAfter(now)) {
          const jobName = `${_id}_${jobPrefix}_${index + 1}`;

          schedule.scheduleJob(jobName, reminderTime.toDate(), async () => {
            try {
              await runBusCalService("overdue2", _id, "System");
            } catch (error) {
              console.error(
                `Error triggering overdue reminder for entry ${_id}:`,
                error
              );
            }
          });
        }
      });
    };

    const overdueConfigs = {
      high: {
        intervals: [
          { unit: "days", value: 0 },
          { unit: "days", value: 1 },
          { unit: "days", value: 2 },
          { unit: "days", value: 3 },
          { unit: "days", value: 4 },
        ],
        jobPrefix: "overdue_day",
      },
      normal: {
        intervals: [
          { unit: "weeks", value: 0 },
          { unit: "weeks", value: 1 },
          { unit: "weeks", value: 2 },
          { unit: "weeks", value: 3 },
        ],
        jobPrefix: "overdue_week",
      },
    };

    if (overdueConfigs[priority]) {
      scheduleOverdueReminders(overdueConfigs[priority]);
    }
    return;
  }

  // Similar immutable approach for other reminder scheduling
  if (!["not started", "in progress"].includes(completionStatus)) {
    return;
  }

  const scheduleReminder = (type, timeCalculation) => {
    if (!whenAlarm) {
      return;
    }

    const alarmTime = moment(whenAlarm).tz(TIMEZONE);
    const reminderTime = timeCalculation(alarmTime, adjustedDueTime);

    if (reminderTime.isAfter(now)) {
      schedule.scheduleJob(
        `${_id}_${type}`,
        reminderTime.toDate(),
        async () => {
          try {
            await runBusCalService(type, _id, "System");
          } catch (error) {
            console.error(
              `Error triggering ${type} reminder for entry ${_id}:`,
              error
            );
          }
        }
      );
    }
  };

  // Schedule main alarm reminder
  scheduleReminder("reminder", (alarmTime) =>
    moment(adjustWorkHours(alarmTime.toDate()))
  );

  // Schedule midpoint reminder
  scheduleReminder("reminder2", (alarmTime, dueTime) => {
    const midpointTime = moment(alarmTime).add(
      dueTime.diff(alarmTime) / 2,
      "milliseconds"
    );
    return moment(adjustWorkHours(midpointTime.toDate()));
  });
}

/**
 * Schedules reminders for all calendar entries
 */
async function scheduleAllEntries() {
  try {
    cancelAllSchedules(); // Cancel all existing schedules

    const calendarEntries = await CalendarEntry.find({
      completionStatus: { $nin: ["completed", "cancelled"] }, // Exclude completed/cancelled
    });

    // console.log(`Scheduling reminders for ${calendarEntries.length} entries`);

    for (const entry of calendarEntries) {
      scheduleEntryReminders(entry);
    }

    // console.log("All entries scheduled successfully");
  } catch (error) {
    console.error("Error scheduling all entries:", error);
  }
}

/**
 * Lists all currently scheduled jobs in the console
 * Provides details about each scheduled job
 */
function listCurrentSchedules() {
  const jobs = schedule.scheduledJobs;

  for (const jobName in jobs) {
    const job = jobs[jobName];
    if (job.nextInvocation()) {
      const nextRun = job.nextInvocation();
      // console.log(`Scheduling job: ${jobName} at ${nextRun}`);
    }
  }
}

module.exports = {
  processSchedules,
  cancelSchedule,
  scheduleAllEntries,
  cancelAllSchedules,
  listCurrentSchedules,
};

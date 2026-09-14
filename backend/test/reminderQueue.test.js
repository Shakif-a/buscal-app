const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Scheduler = require("../models/schedulerModel");
const Calendar = require("../models/calendarEntryModel");
const schedule = require("node-schedule");
const { processSchedules } = require("../services/reminderService");

const originalState = mongoose.connection.readyState;
const takeBatch = Scheduler.findOneAndUpdate;
const requeue = Scheduler.updateOne;
const readEntry = Calendar.findById;
test.beforeEach(() => {
  mongoose.connection.readyState = 1;
});
test.afterEach(() => {
  mongoose.connection.readyState = originalState;
  Scheduler.findOneAndUpdate = takeBatch;
  Scheduler.updateOne = requeue;
  Calendar.findById = readEntry;
});

test("calendar changes queued while reminders are processed are not cleared", async () => {
  const queue = { toschedule: ["first"], tocancel: [] };
  Scheduler.findOneAndUpdate = async (filter, update, options) => {
    assert.deepEqual(update, { $set: { toschedule: [], tocancel: [] } });
    assert.equal(options.new, false);
    const batch = {
      toschedule: [...queue.toschedule],
      tocancel: [...queue.tocancel],
    };
    queue.toschedule = [];
    queue.tocancel = [];
    return batch;
  };
  Calendar.findById = async () => {
    queue.toschedule.push("new-arrival");
    return { completionStatus: "completed" };
  };
  await processSchedules();
  assert.deepEqual(queue.toschedule, ["new-arrival"]);
});

test("a failed reminder batch is requeued and reports failure", async () => {
  Scheduler.findOneAndUpdate = async () => ({
    toschedule: ["first"],
    tocancel: ["deleted"],
  });
  Calendar.findById = async () => {
    throw new Error("Read failed");
  };
  let update;
  Scheduler.updateOne = async (filter, changes) => {
    update = changes;
  };
  await assert.rejects(processSchedules(), /Read failed/);
  assert.deepEqual(update, {
    $addToSet: {
      toschedule: { $each: ["first"] },
      tocancel: { $each: ["deleted"] },
    },
  });
});

test("completed entries cancel their old reminders", async () => {
  Scheduler.findOneAndUpdate = async () => ({
    toschedule: ["completed-entry"],
    tocancel: [],
  });
  Calendar.findById = async () => ({ completionStatus: "completed" });
  let cancelled = false;
  schedule.scheduledJobs["completed-entry_reminder"] = {
    cancel() {
      cancelled = true;
    },
  };
  try {
    await processSchedules();
    assert.equal(cancelled, true);
  } finally {
    delete schedule.scheduledJobs["completed-entry_reminder"];
  }
});

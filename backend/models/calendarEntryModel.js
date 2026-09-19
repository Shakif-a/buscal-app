const mongoose = require("mongoose");
const Scheduler = require("./schedulerModel");

// Define the CalendarEntry schema
const calendarEntrySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    userOwner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    userAssigned: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    description: String,
    startTime: {
      type: Date,
    },
    endTime: {
      type: Date,
      required: true,
    },
    whenAlarm: {
      type: Date,
    },
    recurrence: String,
    originalEntry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CalendarEntry",
    },
    completionStatus: {
      type: String,
      enum: ["not started", "in progress", "completed", "overdue", "cancelled"],
    },
    progress: {
      type: Number,
      default: 0,
    },
    priority: {
      type: String,
      enum: ["normal", "high"],
    },
    notes: String,
    category: String,
    completionDate: {
      type: Date,
    },
    file: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "File",
      },
    ],
  },
  { timestamps: true },
);

async function queueCalendarChange(entryId, field, session) {
  await Scheduler.updateOne(
    { name: "calendarschedule" },
    { $addToSet: { [field]: entryId } },
    { upsert: true, session },
  );
}

calendarEntrySchema.post("save", async function (doc) {
  await queueCalendarChange(doc._id, "toschedule", doc.$session());
});

calendarEntrySchema.post("findOneAndDelete", async function (doc) {
  if (doc) {
    await queueCalendarChange(doc._id, "tocancel", this.getOptions().session);
  }
});

// Create and export the CalendarEntry model
const CalendarEntry = mongoose.model("CalendarEntry", calendarEntrySchema);

module.exports = CalendarEntry;

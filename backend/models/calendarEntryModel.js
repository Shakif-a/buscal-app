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
  { timestamps: true }
);

// Post-save middleware
calendarEntrySchema.post("save", async function (doc) {
  try {
    // Find or create the calendarschedule document in Scheduler
    let scheduler = await Scheduler.findOne({ name: "calendarschedule" });
    if (!scheduler) {
      scheduler = new Scheduler({
        name: "calendarschedule",
        toschedule: [],
        tocancel: [],
      });
    }

    // Add the saved calendar entry ID to the toschedule array
    if (!scheduler.toschedule.includes(doc._id)) {
      scheduler.toschedule.push(doc._id);
      await scheduler.save();
    }
  } catch (error) {
    console.error("Error in post-save middleware:", error);
  }
});

// Post-delete middleware
calendarEntrySchema.post("findOneAndDelete", async function (doc) {
  try {
    if (doc) {
      // Find or create the calendarschedule document in Scheduler
      let scheduler = await Scheduler.findOne({ name: "calendarschedule" });
      if (!scheduler) {
        scheduler = new Scheduler({
          name: "calendarschedule",
          toschedule: [],
          tocancel: [],
        });
      }

      // Add the deleted calendar entry ID to the tocancel array
      if (!scheduler.tocancel.includes(doc._id)) {
        scheduler.tocancel.push(doc._id);
        await scheduler.save();
      }
    }
  } catch (error) {
    console.error("Error in post-delete middleware:", error);
  }
});

// Create and export the CalendarEntry model
const CalendarEntry = mongoose.model("CalendarEntry", calendarEntrySchema);

module.exports = CalendarEntry;

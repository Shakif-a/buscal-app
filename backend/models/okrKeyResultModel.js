const mongoose = require("mongoose");
// Stores one Key Result belonging to an objective.
const okrKeyResultSchema = new mongoose.Schema(
  {
    objective: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "OkrObjective",
    },
    title: {
      type: String,
      required: [true, "Please add a key result title"],
      trim: true,
      maxlength: 180,
    },
    // Share of the objective as a percentage. All weights under one objective must total 100.
    weight: {
      type: Number,
      required: [true, "Please add a weight"],
      min: 0,
      max: 100,
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    status: {
      type: String,
      enum: ["on-track", "at-risk", "overdue", "completed"],
      default: "on-track",
    },
    // The user responsible for delivering this key result.
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    dueDate: {
      type: Date,
      required: [true, "Please add a due date"],
    },
    // Note added by the manager explaining why the work is complete.
    completionJustification: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
    // Proof the work was done, usually pointing at a calendar entry or file.
    evidence: [
      {
        kind: {
          type: String,
          enum: ["calendar", "file", "link", "note"],
          required: true,
        },
        // Id of the calendar entry or file the evidence points at.
        ref: {
          type: mongoose.Schema.Types.ObjectId,
          default: null,
        },
        // A URL for "link", or free text for "note".
        value: {
          type: String,
          default: "",
          trim: true,
          maxlength: 1000,
        },
        label: {
          type: String,
          default: "",
          trim: true,
          maxlength: 200,
        },
        addedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // draft = not submitted, pending = waiting on a manager, approved = signed off, rejected = sent back
    approvalState: {
      type: String,
      enum: ["draft", "pending", "approved", "rejected"],
      default: "draft",
      index: true,
    },
    // Kept in step with approvalState for older code that reads this boolean.
    approved: {
      type: Boolean,
      default: false,
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    // Reason given when a key result is rejected.
    reviewNote: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
    // Calendar entries whose completion drives this key result's progress.
    calendarEntries: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CalendarEntry",
      },
    ],
    // manual = someone enters the number, calendar = worked out from the linked entries
    progressSource: {
      type: String,
      enum: ["manual", "calendar"],
      default: "manual",
    },
    // Older single-task reference, kept so existing records still load.
    calendarTaskId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);
// Helps the dashboard and "my key results" queries run faster.
okrKeyResultSchema.index({ objective: 1, dueDate: 1 });
okrKeyResultSchema.index({ assignedTo: 1, status: 1 });
module.exports = mongoose.model("OkrKeyResult", okrKeyResultSchema);

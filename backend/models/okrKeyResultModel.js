const mongoose = require("mongoose");

// One key result under an objective. Weights of all key results under one objective must add up to 100.
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
    // Share of the objective, 0-100.
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
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    dueDate: {
      type: Date,
      required: [true, "Please add a due date"],
    },
    // Note added on manager review.
    completionJustification: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
    // Proof it's actually done.
    evidence: [
      {
        kind: {
          type: String,
          enum: ["calendar", "file", "link", "note"],
          required: true,
        },
        ref: {
          type: mongoose.Schema.Types.ObjectId,
          default: null,
        },
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
    // draft, pending, approved, or rejected.
    approvalState: {
      type: String,
      enum: ["draft", "pending", "approved", "rejected"],
      default: "draft",
      index: true,
    },
    // Mirrors approvalState for older code that reads this boolean.
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
    // Reason for rejection.
    reviewNote: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
    // Linked calendar entries that drive this key result's progress.
    calendarEntries: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CalendarEntry",
      },
    ],
    // manual or calendar.
    progressSource: {
      type: String,
      enum: ["manual", "calendar"],
      default: "manual",
    },
    // Old single-task reference, kept for older records.
    calendarTaskId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

okrKeyResultSchema.index({ objective: 1, dueDate: 1 });
okrKeyResultSchema.index({ assignedTo: 1, status: 1 });

module.exports = mongoose.model("OkrKeyResult", okrKeyResultSchema);

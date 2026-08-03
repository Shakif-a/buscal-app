const mongoose = require("mongoose");

// Stores one key result under an objective. Weight is its share of the
// objective (0-100), and all weights under one objective must add up to 100.
const okrKeyResultSchema = new mongoose.Schema(
  {
    // The objective this key result belongs to.
    objective: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "OkrObjective",
    },

    // What the key result measures.
    title: {
      type: String,
      required: [true, "Please add a key result title"],
      trim: true,
      maxlength: 180,
    },

    // Share of the objective, 0-100. Controller checks all weights under one
    // objective never go over 100.
    weight: {
      type: Number,
      required: [true, "Please add a weight"],
      min: 0,
      max: 100,
    },

    // How far along this key result is, 0-100.
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

    // Who's responsible for delivering this key result.
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    dueDate: {
      type: Date,
      required: [true, "Please add a due date"],
    },

    // Short note explaining why it's complete, filled in during manager review.
    completionJustification: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },

    // Proof the key result is actually done. Most evidence lives in the
    // calendar backend (a completed entry, a file), so we just keep a
    // reference to it instead of copying it over.
    evidence: [
      {
        kind: {
          type: String,
          enum: ["calendar", "file", "link", "note"],
          required: true,
        },
        // Id of the calendar entry or file, when the evidence lives elsewhere.
        ref: {
          type: mongoose.Schema.Types.ObjectId,
          default: null,
        },
        // URL for "link", free text for "note".
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

    // Owner submits, manager decides. Four states so "never submitted" is
    // different from "submitted and waiting":
    // draft = not submitted yet, pending = waiting on a manager,
    // approved = signed off, rejected = sent back with a reason.
    approvalState: {
      type: String,
      enum: ["draft", "pending", "approved", "rejected"],
      default: "draft",
      index: true,
    },

    // Mirrors approvalState so anything still reading this boolean keeps working.
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

    // Who approved/rejected this, and when.
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },

    // Why it got rejected. Required on rejection, since "no" with no reason
    // just means another meeting.
    reviewNote: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },

    // Calendar entries whose completion drives this key result's progress.
    // Finishing the calendar work moves the key result, which rolls up into
    // the objective. Only used when progressSource is "calendar".
    calendarEntries: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CalendarEntry",
      },
    ],

    // manual = someone types a number or checks in (default)
    // calendar = calculated from the linked calendar entries
    progressSource: {
      type: String,
      enum: ["manual", "calendar"],
      default: "manual",
    },

    // Old single-task reference, kept so older records still load.
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

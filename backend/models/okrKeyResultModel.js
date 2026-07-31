const mongoose = require("mongoose");

// ---------------------------------------------------------------------------
// OKR Key Result model.
// A key result is a measurable outcome under an objective (e.g. "Sign 20 new
// customers"). Each carries a weight (its share of the objective; all weights
// under one objective must total 100%) and its own progress. It also holds the
// approval fields a manager sets, and a link to a calendar task in the Micromax
// calendar backend (mocked for now).
// ---------------------------------------------------------------------------

const okrKeyResultSchema = mongoose.Schema(
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

    // Weight as a percentage of its objective (0-100). The controller enforces
    // that all weights under an objective never exceed 100.
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

    // Simple status label for this individual key result.
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

    // The deadline for this key result.
    dueDate: {
      type: Date,
      required: [true, "Please add a due date"],
    },

    // A short note explaining why the key result is complete (manager review).
    completionJustification: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },

    // ---- Evidence ----
    // Micromax will not accept "it's done because I said so". Before a key
    // result can go for approval it needs something to point at. Most evidence
    // lives in the calendar backend (a completed entry, an uploaded file), so
    // we store a reference rather than copying the artefact.
    evidence: [
      {
        // What kind of proof this is.
        kind: {
          type: String,
          enum: ["calendar", "file", "link", "note"],
          required: true,
        },
        // The id of the calendar entry or file, when the evidence lives in
        // another collection.
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
        // What to show in the list.
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

    // ---- Approval workflow ----
    // The owner submits, a manager decides. Four states rather than three, so
    // "never submitted" is distinguishable from "submitted and waiting".
    //   draft    - being worked on, not submitted
    //   pending  - submitted, waiting on a manager
    //   approved - signed off
    //   rejected - sent back with a reason, owner can revise and resubmit
    approvalState: {
      type: String,
      enum: ["draft", "pending", "approved", "rejected"],
      default: "draft",
      index: true,
    },

    // Kept in step with approvalState so older code and any frontend already
    // reading this boolean keeps working.
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

    // The manager who approved or rejected, and when.
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },

    // Why it was rejected. Required by the controller on rejection, because
    // "no" without a reason just generates another meeting.
    reviewNote: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },

    // Link to the calendar task in the Micromax calendar backend (mocked).
    // Calendar entries whose completion drives this key result's progress.
    // This is the link the client brief asks for: finishing calendar work
    // moves the key result, which rolls up into the objective. Progress is
    // computed from these entries whenever progressSource is "calendar".
    calendarEntries: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CalendarEntry",
      },
    ],

    // Where this key result's progress comes from.
    //   "manual"   - someone types a number or checks in (default)
    //   "calendar" - calculated from the linked calendar entries
    progressSource: {
      type: String,
      enum: ["manual", "calendar"],
      default: "manual",
    },

    // Legacy single-task reference kept so older records still load.
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

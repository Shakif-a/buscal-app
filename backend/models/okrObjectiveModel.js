const mongoose = require("mongoose");

// ---------------------------------------------------------------------------
// OKR Objective model.
// An objective is a high-level business goal (e.g. "Grow Q3 revenue"). It owns
// a set of key results that live in their own collection and link back by
// objectiveId. We cache the rolled-up progress and status here so the dashboard
// can read them without recalculating every time.
// ---------------------------------------------------------------------------

const okrObjectiveSchema = mongoose.Schema(
  {
    // The user who created / owns the objective.
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },

    // Short title of the goal.
    title: {
      type: String,
      required: [true, "Please add an objective title"],
      trim: true,
      maxlength: 140,
    },

    // Longer description / context.
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },

    // Where the objective is in its life.
    //   draft  - still being built. Weights may be partial while the owner
    //            adds key results one at a time.
    //   active - published and being tracked. Getting here requires the key
    //            result weights to total exactly 100, which is the client's
    //            rule. Once active, edits that would break the total are
    //            refused.
    //   closed - finished or abandoned, kept for the record.
    //
    // Splitting this out is what lets us honour "weights must equal 100%"
    // without making it impossible to save the first key result.
    lifecycle: {
      type: String,
      enum: ["draft", "active", "closed"],
      default: "draft",
      index: true,
    },

    // The objective this one sits under, which is what makes the plan
    // top-down: a company goal is the parent of department goals, which parent
    // team goals, and so on. Null means this is a top-level strategic goal.
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OkrObjective",
      default: null,
    },

    // The "level" of the objective in the OKR model.
    type: {
      type: String,
      enum: ["company", "department", "team", "individual"],
      default: "company",
    },

    // When work started (used to estimate expected pace) and the deadline.
    startDate: {
      type: Date,
      default: Date.now,
    },
    dueDate: {
      type: Date,
      required: [true, "Please add a due date"],
    },

    // Cached progress 0-100, recalculated from the key results.
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // Cached status label matching the progress.
    status: {
      type: String,
      enum: ["on-track", "at-risk", "overdue", "completed"],
      default: "on-track",
    },

    // Approval workflow state for the objective as a whole.
    approvalState: {
      type: String,
      enum: ["draft", "pending", "approved", "changes-requested"],
      default: "draft",
    },
  },
  {
    timestamps: true,
  }
);

okrObjectiveSchema.index({ owner: 1, dueDate: 1 });
okrObjectiveSchema.index({ status: 1, dueDate: 1 });

module.exports = mongoose.model("OkrObjective", okrObjectiveSchema);

const mongoose = require("mongoose");

// One OKR objective. Key results are stored separately and link back to this.
const okrObjectiveSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: [true, "Objective title is required"],
      trim: true,
      maxlength: 140,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    // draft, active, or closed.
    lifecycle: {
      type: String,
      enum: ["draft", "active", "closed"],
      default: "draft",
      index: true,
    },
    // Parent objective, for the company > department > team hierarchy.
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OkrObjective",
      default: null,
    },
    type: {
      type: String,
      enum: ["company", "department", "team", "individual"],
      default: "company",
    },
    // Team/department name, e.g. "R&D".
    group: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },
    // Committed = must hit it, aspirational = stretch goal.
    commitmentType: {
      type: String,
      enum: ["committed", "aspirational"],
      default: "committed",
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    dueDate: {
      type: Date,
      required: [true, "Due date is required"],
    },
    // Rolled-up progress from the key results.
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    status: {
      type: String,
      enum: ["on-track", "at-risk", "overdue", "completed"],
      default: "on-track",
    },
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

// Speeds up dashboard queries.
okrObjectiveSchema.index({ owner: 1, dueDate: 1 });
okrObjectiveSchema.index({ status: 1, dueDate: 1 });

module.exports = mongoose.model("OkrObjective", okrObjectiveSchema);

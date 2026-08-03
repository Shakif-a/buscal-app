const mongoose = require("mongoose");

// Stores one OKR objective. Key Results are stored separately and linked to it.
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
    // draft = still being prepared, active = being tracked, closed = finished
    lifecycle: {
      type: String,
      enum: ["draft", "active", "closed"],
      default: "draft",
      index: true,
    },
    // Used to build the OKR hierarchy, such as company > department > team.
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
    // Which team/department this belongs to, e.g. "R&D". Separate from type
    // above, which is the hierarchy level, not a department name.
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
    // Cached value used by dashboards and reports.
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

// Helps common dashboard and alert queries run faster.
okrObjectiveSchema.index({ owner: 1, dueDate: 1 });
okrObjectiveSchema.index({ status: 1, dueDate: 1 });

module.exports = mongoose.model("OkrObjective", okrObjectiveSchema);

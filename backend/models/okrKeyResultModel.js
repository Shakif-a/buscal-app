const mongoose = require("mongoose");

const keyResultSchema = new mongoose.Schema(
  {
    objective: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OkrObjective",
      required: true,
    },
    title: {
      type: String,
      required: [true, "Please add a key result title"],
    },
    weight: {
      type: Number,
      required: [true, "Please add a weight"],
      min: 1,
      max: 100,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    dueDate: {
      type: Date,
      required: [true, "Please add a due date"],
    },
    status: {
      type: String,
      enum: ["on-track", "at-risk", "overdue", "completed"],
      default: "on-track",
    },
    evidence: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("OkrKeyResult", keyResultSchema);

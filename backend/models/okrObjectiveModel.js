const mongoose = require("mongoose");

const objectiveSchema = new mongoose.Schema(
  {
    calendarEntry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CalendarEntry",
    },
    title: {
      type: String,
      required: [true, "Please add an objective title"],
    },
    description: {
      type: String,
      default: "",
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    group: {
      type: String,
      default: "none",
    },
    commitmentType: {
      type: String,
      enum: ["committed", "aspirational"],
      default: "committed",
    },
    dueDate: {
      type: Date,
      required: [true, "Please add a due date"],
    },
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
  },
  { timestamps: true },
);

objectiveSchema.index(
  { calendarEntry: 1 },
  {
    unique: true,
    partialFilterExpression: {
      calendarEntry: { $type: "objectId" },
    },
  },
);

module.exports = mongoose.model("OkrObjective", objectiveSchema);

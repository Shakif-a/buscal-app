const mongoose = require("mongoose");
// Stores activity shown in the OKR recent activity feed.
const okrActivitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    // Machine-readable action name, such as "objective.created".
    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    // The related objective, if the activity belongs to one.
    objective: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OkrObjective",
      default: null,
    },
    // Text displayed to users in the activity feed.
    message: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);
// Shows newest activities first.
okrActivitySchema.index({ createdAt: -1 });
module.exports = mongoose.model("OkrActivity", okrActivitySchema);

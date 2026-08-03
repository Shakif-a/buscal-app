const mongoose = require("mongoose");

// One row per meaningful action, for the recent activity feed.
const okrActivitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    // e.g. "objective.created".
    action: {
      type: String,
      required: true,
    },
    // Null for module-wide events.
    objective: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OkrObjective",
      default: null,
    },
    // Human-readable line for the feed.
    message: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

okrActivitySchema.index({ createdAt: -1 });

module.exports = mongoose.model("OkrActivity", okrActivitySchema);

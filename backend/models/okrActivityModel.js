const mongoose = require("mongoose");

// Lightweight activity feed. Every meaningful write (objective created, key
// result added, progress checked in, approval given) drops one row here, so
// the frontend can show a "recent activity" list.
const okrActivitySchema = new mongoose.Schema(
  {
    // Who did it.
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },

    // Short machine-readable action name, e.g. "objective.created".
    action: {
      type: String,
      required: true,
    },

    // The objective this relates to (null for module-wide events).
    objective: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OkrObjective",
      default: null,
    },

    // Human-readable one-liner for the feed,
    // e.g. 'Added key result "Sign 20 customers" (weight 60%)'.
    message: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Feed reads newest-first.
okrActivitySchema.index({ createdAt: -1 });

module.exports = mongoose.model("OkrActivity", okrActivitySchema);

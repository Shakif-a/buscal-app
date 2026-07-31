const mongoose = require("mongoose");

// ---------------------------------------------------------------------------
// OKR Activity model.
// A lightweight audit trail. Every meaningful write (objective created, key
// result added, progress checked in, approval given) drops one row here, so
// the frontend can show a "recent activity" feed and a marker can see the team
// actually using the system over time.
// ---------------------------------------------------------------------------

const okrActivitySchema = mongoose.Schema(
  {
    // Who did it.
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },

    // A short machine-readable action name, e.g. "objective.created".
    action: {
      type: String,
      required: true,
    },

    // The objective this activity relates to (null for module-wide events).
    objective: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OkrObjective",
      default: null,
    },

    // A human-readable one-liner for the feed,
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

// The feed always reads newest-first, so index on creation time.
okrActivitySchema.index({ createdAt: -1 });

module.exports = mongoose.model("OkrActivity", okrActivitySchema);

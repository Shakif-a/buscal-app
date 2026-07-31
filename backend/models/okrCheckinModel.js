const mongoose = require("mongoose");

// ---------------------------------------------------------------------------
// OKR Check-in model.
// A check-in is a dated progress update on a key result, with an optional note
// like "signed 3 more customers this week". Storing every check-in (instead of
// only the latest number) gives us a history we can chart, and the raw data the
// forecasting engine uses to work out how fast a key result is moving.
// ---------------------------------------------------------------------------

const okrCheckinSchema = mongoose.Schema(
  {
    // The key result this check-in belongs to.
    keyResult: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "OkrKeyResult",
    },

    // Denormalised copy of the parent objective id so we can pull a whole
    // objective's history in one query without joins.
    objective: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "OkrObjective",
    },

    // Who reported the update.
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },

    // The progress value at this check-in (0-100).
    progress: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },

    // Optional short note giving context for the number.
    note: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

okrCheckinSchema.index({ keyResult: 1, createdAt: 1 });
okrCheckinSchema.index({ objective: 1, createdAt: -1 });

module.exports = mongoose.model("OkrCheckin", okrCheckinSchema);

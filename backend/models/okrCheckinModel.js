const mongoose = require("mongoose");
// Stores a dated progress update on a key result, used for history and trend charts.
const okrCheckinSchema = new mongoose.Schema(
  {
    keyResult: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "OkrKeyResult",
    },
    // Copied from the key result so one objective's history can be read in a single query.
    objective: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "OkrObjective",
    },
    // The user who reported the update.
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    // Progress reported at this check-in, from 0 to 100.
    progress: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    // Optional note giving context for the number.
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
// Helps the history and trend queries run faster.
okrCheckinSchema.index({ keyResult: 1, createdAt: 1 });
okrCheckinSchema.index({ objective: 1, createdAt: -1 });
module.exports = mongoose.model("OkrCheckin", okrCheckinSchema);

const mongoose = require("mongoose");

// A dated progress update on a key result, used for history/trend charts.
const okrCheckinSchema = new mongoose.Schema(
  {
    keyResult: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "OkrKeyResult",
    },
    // Copied here so we can query one objective's whole history at once.
    objective: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "OkrObjective",
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    progress: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
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

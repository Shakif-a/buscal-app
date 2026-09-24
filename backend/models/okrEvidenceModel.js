const mongoose = require("mongoose");
const maximumEvidenceSize = 5 * 1024 * 1024;

const evidenceSchema = new mongoose.Schema(
  {
    objective: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OkrObjective",
      required: true,
      index: true,
    },
    keyResult: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OkrKeyResult",
      required: true,
      index: true,
    },
    filename: {
      type: String,
      required: true,
      maxlength: 255,
    },
    mimetype: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
      min: 1,
      max: maximumEvidenceSize,
    },
    note: {
      type: String,
      default: "",
      maxlength: 1000,
    },
    data: {
      type: Buffer,
      required: true,
      select: false,
      validate: {
        validator(value) {
          return value.length <= maximumEvidenceSize;
        },
        message: "Evidence files cannot be larger than 5 MB",
      },
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    deleted: {
      type: Boolean,
      default: false,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

evidenceSchema.pre("validate", function setEvidenceSize(next) {
  if (this.data) {
    this.size = this.data.length;
  }
  next();
});

module.exports = mongoose.model("OkrEvidence", evidenceSchema);

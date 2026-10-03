const mongoose = require("mongoose");

const retentionMilliseconds = 14 * 24 * 60 * 60 * 1000;

const blockedUploadSchema = new mongoose.Schema(
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
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    senderName: { type: String, default: "" },
    senderEmail: { type: String, default: "" },
    senderRoles: { type: [String], default: [] },
    ip: { type: String, default: "" },
    objectiveTitle: { type: String, default: "" },
    keyResultTitle: { type: String, default: "" },
    filename: { type: String, required: true },
    extension: { type: String, default: "" },
    claimedType: { type: String, default: "" },
    detectedType: { type: String, default: "" },
    size: { type: Number, required: true },
    sha256: { type: String, required: true },
    threat: { type: String, required: true },
    reviewable: { type: Boolean, default: false },
    attempts: { type: Number, default: 1 },
    lastAttemptAt: { type: Date, default: Date.now },
    escalated: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["blocked", "approved", "declined", "used"],
      default: "blocked",
    },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    decidedByName: { type: String, default: "" },
    decidedAt: { type: Date },
    approvalExpiresAt: { type: Date },
    usedAt: { type: Date },
    usedEvidence: { type: mongoose.Schema.Types.ObjectId, ref: "OkrEvidence" },
    hexHead: { type: String, default: "" },
    preview: { type: mongoose.Schema.Types.Mixed, default: { kind: "none" } },
    expireAt: {
      type: Date,
      default: () => new Date(Date.now() + retentionMilliseconds),
      index: { expireAfterSeconds: 0 },
    },
  },
  { timestamps: true },
);

blockedUploadSchema.index({
  sha256: 1,
  keyResult: 1,
  uploadedBy: 1,
  status: 1,
});
blockedUploadSchema.index({ uploadedBy: 1, createdAt: -1 });
blockedUploadSchema.index({ createdAt: -1 });

module.exports = mongoose.model("OkrBlockedUpload", blockedUploadSchema);

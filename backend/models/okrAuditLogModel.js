const mongoose = require("mongoose");

// Append-only log of changes: weight edits, progress, approvals, rejections, and self-healing repairs.
const okrAuditLogSchema = new mongoose.Schema(
  {
    // Null for background repair entries.
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // e.g. "keyresult.weight.changed".
    action: {
      type: String,
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      enum: ["objective", "keyresult", "checkin", "calendar-link", "system"],
      required: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    objective: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OkrObjective",
      default: null,
      index: true,
    },
    // Value before the change.
    before: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // Value after the change.
    after: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    message: {
      type: String,
      required: true,
      maxlength: 500,
    },
    // info, repair, or warning.
    severity: {
      type: String,
      enum: ["info", "repair", "warning"],
      default: "info",
    },
  },
  {
    timestamps: true,
  }
);

okrAuditLogSchema.index({ createdAt: -1 });

// Blocks edits so audit entries can't be changed once written.
function refuseEdit(next) {
  next(new Error("Audit log entries cannot be modified once written"));
}

// Blocks deletes unless { allowAuditPurge: true } is passed on purpose.
function refuseDelete(next) {
  const options = typeof this.getOptions === "function" ? this.getOptions() : {};
  if (options && options.allowAuditPurge === true) {
    return next();
  }
  next(
    new Error(
      "Audit log entries cannot be deleted. Pass { allowAuditPurge: true } if this is an intentional retention purge."
    )
  );
}

okrAuditLogSchema.pre("updateOne", refuseEdit);
okrAuditLogSchema.pre("updateMany", refuseEdit);
okrAuditLogSchema.pre("findOneAndUpdate", refuseEdit);
okrAuditLogSchema.pre("deleteOne", refuseDelete);
okrAuditLogSchema.pre("deleteMany", refuseDelete);
okrAuditLogSchema.pre("findOneAndDelete", refuseDelete);

// Saving over an existing doc counts as an edit too.
okrAuditLogSchema.pre("save", function guardSave(next) {
  if (!this.isNew) {
    return next(new Error("Audit log entries cannot be modified once written"));
  }
  next();
});

module.exports = mongoose.model("OkrAuditLog", okrAuditLogSchema);

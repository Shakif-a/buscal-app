const mongoose = require("mongoose");
// Stores a record of every change made to an objective or key result.
const okrAuditLogSchema = new mongoose.Schema(
  {
    // The user who made the change, or null when a background repair made it.
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // Machine-readable event name, such as "keyresult.weight.changed".
    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      index: true,
    },
    // The kind of record that was changed.
    entityType: {
      type: String,
      enum: ["objective", "keyresult", "checkin", "calendar-link", "system"],
      required: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    // The related objective, so one goal's history can be read in a single query.
    objective: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OkrObjective",
      default: null,
      index: true,
    },
    // Value before the change. Mixed because it can be a number, string or id.
    before: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // Value after the change.
    after: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // Text displayed to users in the audit view.
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    // info = normal activity, repair = fixed automatically, warning = needs a look
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
// Shows newest entries first.
okrAuditLogSchema.index({ createdAt: -1 });
// Blocks any attempt to change an entry after it has been written.
function refuseEdit(next) {
  next(new Error("Audit log entries cannot be modified once written"));
}
// Blocks deletes unless the caller passes { allowAuditPurge: true } on purpose.
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
// Saving over an existing document counts as an edit, but new ones are fine.
okrAuditLogSchema.pre("save", function guardSave(next) {
  if (!this.isNew) {
    return next(new Error("Audit log entries cannot be modified once written"));
  }
  next();
});
module.exports = mongoose.model("OkrAuditLog", okrAuditLogSchema);

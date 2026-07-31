const mongoose = require("mongoose");

// ---------------------------------------------------------------------------
// Audit log.
//
// Every state change worth defending in a review lands here: weight edits,
// progress changes, approvals and rejections, and anything the self-healing
// layer quietly repaired. Micromax needs to be able to answer "who changed this
// number, when, and what was it before" months after the fact, so the rows are
// append-only. The hooks below refuse updates and deletes outright rather than
// trusting everyone to remember not to touch them.
// ---------------------------------------------------------------------------

const okrAuditLogSchema = mongoose.Schema(
  {
    // Who did it. Null is allowed because some entries come from background
    // repair work rather than a person.
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Machine-readable event name, e.g. "keyresult.weight.changed".
    action: {
      type: String,
      required: true,
      index: true,
    },

    // What was touched. entityType is the collection, entityId the document.
    entityType: {
      type: String,
      enum: ["objective", "keyresult", "checkin", "calendar-link", "system"],
      required: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    // The objective the change ultimately affects, so a reviewer can pull the
    // whole story for one goal in a single query.
    objective: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OkrObjective",
      default: null,
      index: true,
    },

    // Before and after values. Kept loose on purpose: a weight change stores
    // numbers, an approval stores strings, a repair stores ids.
    before: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    after: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // A sentence a human can read in the audit view without decoding fields.
    message: {
      type: String,
      required: true,
      maxlength: 500,
    },

    // "info" for ordinary activity, "repair" for self-healing events,
    // "warning" for things somebody should look at.
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

// Newest first is how the audit screen reads it.
okrAuditLogSchema.index({ createdAt: -1 });

// ---- Immutability ---------------------------------------------------------
// Mongoose has several ways to change a document, so each one gets blocked.
// This is defence against a future developer's honest mistake, not against an
// attacker with database access.
//
// Edits are refused outright: an audit entry that can be rewritten is not an
// audit entry. Deletes are refused too, but with one deliberate exception.
// Retention policies are real, and so are test fixtures, so a caller who
// genuinely means it can pass { allowAuditPurge: true } and get through. The
// flag has to be typed on purpose, which is the point: nobody deletes an audit
// trail by accident, but a scheduled retention job is still possible.

function refuseEdit(next) {
  next(new Error("Audit log entries cannot be modified once written"));
}

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

// Saving an existing document is an edit too. A brand new one is fine.
okrAuditLogSchema.pre("save", function guardSave(next) {
  if (!this.isNew) {
    return next(new Error("Audit log entries cannot be modified once written"));
  }
  next();
});

module.exports = mongoose.model("OkrAuditLog", okrAuditLogSchema);

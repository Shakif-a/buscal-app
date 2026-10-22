const { createHash } = require("crypto");
const OkrBlockedUpload = require("../../models/okrBlockedUploadModel");

const approvalWindowHours = 48;
const auditRetentionMilliseconds = 90 * 24 * 60 * 60 * 1000;

function fingerprint(body) {
  return createHash("sha256").update(body).digest("hex");
}

function claimApproval(body, target, user) {
  const now = new Date();

  return OkrBlockedUpload.findOneAndUpdate(
    {
      sha256: fingerprint(body),
      keyResult: target.keyResult._id,
      uploadedBy: user._id,
      status: "approved",
      reviewable: true,
      approvalExpiresAt: { $gt: now },
    },
    { $set: { status: "used", usedAt: now } },
    { new: true },
  );
}

function releaseApproval(record) {
  return OkrBlockedUpload.updateOne(
    { _id: record._id, status: "used" },
    { $set: { status: "approved" }, $unset: { usedAt: "", usedEvidence: "" } },
  );
}

function attachEvidence(record, evidenceId) {
  return OkrBlockedUpload.updateOne(
    { _id: record._id },
    { $set: { usedEvidence: evidenceId } },
  );
}

function recordDecision(report, decider, decision) {
  const now = Date.now();
  const approve = decision === "approve";
  const update = {
    status: approve ? "approved" : "declined",
    decidedBy: decider.id,
    decidedByName: decider.name,
    decidedAt: new Date(now),
    expireAt: new Date(now + auditRetentionMilliseconds),
  };

  if (approve) {
    update.approvalExpiresAt = new Date(
      now + approvalWindowHours * 60 * 60 * 1000,
    );
  }

  return OkrBlockedUpload.findOneAndUpdate(
    { _id: report._id, status: "blocked", reviewable: true },
    { $set: update },
    { new: true },
  );
}

module.exports = {
  approvalWindowHours,
  fingerprint,
  claimApproval,
  releaseApproval,
  attachEvidence,
  recordDecision,
};

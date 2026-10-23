const OkrBlockedUpload = require("../../models/okrBlockedUploadModel");
const { fingerprint } = require("./approval");

const dayMilliseconds = 24 * 60 * 60 * 1000;
const declinedMemoryMilliseconds = 30 * dayMilliseconds;
const historyLimit = 5;

const since = (milliseconds) => new Date(Date.now() - milliseconds);

function findRecentBlock(body, target, user) {
  return OkrBlockedUpload.findOne({
    sha256: fingerprint(body),
    keyResult: target.keyResult._id,
    uploadedBy: user._id,
    status: "blocked",
    createdAt: { $gt: since(dayMilliseconds) },
  });
}

function findDeclinedBlock(body, user) {
  return OkrBlockedUpload.findOne({
    sha256: fingerprint(body),
    uploadedBy: user._id,
    status: "declined",
    decidedAt: { $gt: since(declinedMemoryMilliseconds) },
  });
}

function recordAttempt(record) {
  return OkrBlockedUpload.findOneAndUpdate(
    { _id: record._id },
    { $inc: { attempts: 1 }, $set: { lastAttemptAt: new Date() } },
    { new: true },
  );
}

function countRecentFiles(userId) {
  return OkrBlockedUpload.countDocuments({
    uploadedBy: userId,
    status: { $in: ["blocked", "declined"] },
    createdAt: { $gt: since(dayMilliseconds) },
  });
}

async function wasEscalatedRecently(userId) {
  const found = await OkrBlockedUpload.exists({
    uploadedBy: userId,
    escalated: true,
    lastAttemptAt: { $gt: since(dayMilliseconds) },
  });

  return Boolean(found);
}

function claimEscalation(record) {
  return OkrBlockedUpload.findOneAndUpdate(
    { _id: record._id, escalated: false },
    { $set: { escalated: true } },
    { new: true },
  );
}

function findSenderHistory(report) {
  return OkrBlockedUpload.find({
    uploadedBy: report.uploadedBy,
    _id: { $ne: report._id },
  })
    .sort({ createdAt: -1 })
    .limit(historyLimit)
    .select("filename threat status reviewable attempts createdAt")
    .lean();
}

module.exports = {
  findRecentBlock,
  findDeclinedBlock,
  recordAttempt,
  countRecentFiles,
  wasEscalatedRecently,
  claimEscalation,
  findSenderHistory,
};

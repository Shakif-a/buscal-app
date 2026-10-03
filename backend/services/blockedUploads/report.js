const OkrBlockedUpload = require("../../models/okrBlockedUploadModel");
const { inspectFile, canBeApproved } = require("../evidenceScanner");

function fullName(user, fallback) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || fallback;
}

function cleanIp(ip) {
  return String(ip || "").replace(/^::ffff:/i, "");
}

function saveBlockedUpload({ user, ip, target, file, body, threat }) {
  return OkrBlockedUpload.create({
    objective: target.objective._id,
    keyResult: target.keyResult._id,
    uploadedBy: user._id,
    senderName: fullName(user, "Unknown user"),
    senderEmail: user.email || "",
    senderRoles: Array.isArray(user.roles) ? user.roles : [],
    ip: cleanIp(ip),
    objectiveTitle: target.objective.title,
    keyResultTitle: target.keyResult.title,
    filename: file.filename,
    extension: file.extension,
    claimedType: file.mimetype,
    size: body.length,
    threat,
    reviewable: canBeApproved(threat),
    ...inspectFile(file.extension, body),
  });
}

module.exports = {
  fullName,
  cleanIp,
  saveBlockedUpload,
};

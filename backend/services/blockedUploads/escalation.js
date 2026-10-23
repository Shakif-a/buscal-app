const {
  recordAttempt,
  countRecentFiles,
  wasEscalatedRecently,
  claimEscalation,
} = require("./history");
const { escapeHtml } = require("./pages");
const { findAdminIds } = require("./access");
const { auditUrl } = require("./links");
const { anchor } = require("./messages");
const { generateNotifications } = require("../../controllers/notificationController");

const repeatedFiles = 3;
const repeatedAttempts = 5;

async function countRepeat(record) {
  const updated = await recordAttempt(record);

  if (updated) {
    await escalateIfNeeded(updated);
  }
}

async function escalateIfNeeded(record) {
  const files = await countRecentFiles(record.uploadedBy);

  if (record.attempts < repeatedAttempts && files < repeatedFiles) {
    return;
  }

  if (await wasEscalatedRecently(record.uploadedBy)) {
    return;
  }

  if (!(await claimEscalation(record))) {
    return;
  }

  const lines = [
    "<strong>Security alert: repeated blocked uploads.</strong>",
    `Sent by: ${escapeHtml(record.senderName)} (${escapeHtml(record.senderEmail)})`,
    `Files blocked in the last 24 hours: ${files}`,
    `Attempts with the latest file: ${record.attempts}`,
    `Latest file: ${escapeHtml(record.filename)}`,
    `Reason: ${escapeHtml(record.threat)}`,
  ];

  for (const adminId of await findAdminIds(record.uploadedBy)) {
    await generateNotifications(
      [adminId],
      [...lines, anchor(auditUrl(adminId), "View all blocked uploads")].join("<br>"),
      ["web"],
      "error",
      null,
    );
  }
}

module.exports = { countRepeat, escalateIfNeeded };

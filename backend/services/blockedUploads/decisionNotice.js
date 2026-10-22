const { approvalWindowHours } = require("./approval");
const { escapeHtml } = require("./pages");
const { findReportManagerIds } = require("./access");
const { generateNotifications } = require("../../controllers/notificationController");

const objectivesPage = "/dashboard/okrtracker/objectives";

function noticeForSender(report, approved) {
  const name = escapeHtml(report.decidedByName);
  const where = `"${escapeHtml(report.filename)}" for the key result "${escapeHtml(report.keyResultTitle)}" on "${escapeHtml(report.objectiveTitle)}"`;

  if (approved) {
    return [
      "<strong>Your file was approved.</strong>",
      `${name} approved ${where}.`,
      `Upload the same file again within ${approvalWindowHours} hours. The approval works once.`,
    ];
  }

  return [
    "<strong>Your file was declined.</strong>",
    `${name} did not approve ${where}.`,
    "Please send a different file or talk to them.",
  ];
}

async function tellAboutDecision(report, decider, decision) {
  try {
    const approved = decision === "approve";

    await generateNotifications(
      [String(report.uploadedBy)],
      noticeForSender(report, approved).join("<br>"),
      ["web"],
      "okr",
      objectivesPage,
    );

    const others = (await findReportManagerIds(report)).filter(
      (managerId) => managerId !== String(decider._id),
    );

    if (others.length > 0) {
      const verb = approved ? "approved" : "declined";
      const name = escapeHtml(report.decidedByName);

      await generateNotifications(
        others,
        `${name} ${verb} the blocked upload "${escapeHtml(report.filename)}" from ${escapeHtml(report.senderName)}.`,
        ["web"],
        "okr",
        objectivesPage,
      );
    }
  } catch (error) {
    console.error("Could not create decision notification:", error.message);
  }
}

module.exports = { tellAboutDecision };

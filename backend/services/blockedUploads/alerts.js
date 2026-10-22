const { canBeApproved } = require("../evidenceScanner");
const { findRecentBlock, findDeclinedBlock } = require("./history");
const { findManagerIds } = require("./access");
const { reportUrl, auditUrl } = require("./links");
const { saveBlockedUpload } = require("./report");
const { blockedMessage, anchor, alertLines } = require("./messages");
const { countRepeat, escalateIfNeeded } = require("./escalation");
const { tellAboutDecision } = require("./decisionNotice");
const { generateNotifications } = require("../../controllers/notificationController");

const queues = new Map();

function oneAtATime(key, task) {
  const next = (queues.get(key) || Promise.resolve()).then(task);
  queues.set(key, next);
  next.then(() => {
    if (queues.get(key) === next) {
      queues.delete(key);
    }
  });
  return next;
}

function alertManagers(req, target, file, threat) {
  return oneAtATime(String(req.user._id), () =>
    sendAlerts(req, target, file, threat),
  );
}

function saveReport(req, target, file, threat) {
  return saveBlockedUpload({
    user: req.user,
    ip: req.ip,
    target,
    file,
    body: req.body,
    threat,
  }).catch((error) => {
    console.error("Could not save blocked upload report:", error.message);
    return null;
  });
}

async function notifyManagers(managerIds, lines, record, reviewable) {
  const label = reviewable
    ? "Review this file and approve or decline it"
    : "Open the safe report";

  for (const managerId of managerIds) {
    const links = [anchor(auditUrl(managerId), "View all blocked uploads")];

    if (record) {
      links.unshift(anchor(reportUrl(record._id, managerId), label));
    }

    await generateNotifications(
      [managerId],
      [...lines, ...links].join("<br>"),
      ["web"],
      "error",
      null,
    );
  }
}

async function sendAlerts(req, target, file, threat) {
  const reviewable = canBeApproved(threat);
  const outcome = { reviewable, told: false, pending: false, declined: false };

  try {
    const declined = await findDeclinedBlock(req.body, req.user);
    if (declined) {
      outcome.declined = true;
      await countRepeat(declined);
      return outcome;
    }

    const managerIds = await findManagerIds(req.user, target.objective);
    if (managerIds.length === 0) {
      return outcome;
    }

    const recent = await findRecentBlock(req.body, target, req.user);
    if (recent) {
      outcome.told = true;
      outcome.pending = true;
      await countRepeat(recent);
      return outcome;
    }

    const record = await saveReport(req, target, file, threat);
    const lines = alertLines(req, target, file, threat);

    await notifyManagers(managerIds, lines, record, reviewable);
    outcome.told = true;

    if (record) {
      await escalateIfNeeded(record);
    }
  } catch (error) {
    console.error("Could not create blocked upload notification:", error.message);
  }

  return outcome;
}

module.exports = { blockedMessage, alertManagers, tellAboutDecision };

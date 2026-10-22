const { escapeHtml, readableSize } = require("./pages");
const { fullName, cleanIp } = require("./report");

function blockedMessage(threat, outcome) {
  const message = `This file was blocked by the security scan because ${threat}.`;

  if (outcome.declined) {
    return `${message} A manager has already declined it.`;
  }

  if (!outcome.reviewable || !outcome.told) {
    return message;
  }

  return outcome.pending
    ? `${message} A manager has already been told and can approve it.`
    : `${message} A manager has been told and can approve it.`;
}

const linkStyle = "color:#1b4fd6;font-weight:600;text-decoration:underline";

function anchor(url, text) {
  return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="${linkStyle}">${text}</a>`;
}

function alertLines(req, target, file, threat) {
  return [
    "<strong>Security alert: an evidence upload was blocked.</strong>",
    `File: ${escapeHtml(file.filename)} (${readableSize(req.body.length)})`,
    `Reason: ${escapeHtml(threat)}`,
    `Sent by: ${escapeHtml(fullName(req.user, "Unknown user"))} (${escapeHtml(req.user.email)})`,
    `Objective: ${escapeHtml(target.objective.title)}`,
    `Key result: ${escapeHtml(target.keyResult.title)}`,
    `IP address: ${escapeHtml(cleanIp(req.ip) || "unknown")}`,
  ];
}

module.exports = { blockedMessage, anchor, alertLines };

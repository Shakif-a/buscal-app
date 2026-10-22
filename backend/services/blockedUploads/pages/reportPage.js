const { approvalWindowHours } = require("../approval");
const { adviceFor } = require("../../evidenceScanner");
const {
  escapeHtml,
  readableSize,
  readableTime,
  page,
  card,
  field,
  fields,
} = require("./layout");
const { renderPreview } = require("./preview");
const { renderBanner, chip } = require("./status");

function renderHistory(history) {
  if (!Array.isArray(history)) {
    return "";
  }

  if (history.length === 0) {
    return card(
      "Earlier blocks from this sender",
      '<p class="muted">No other blocked uploads from this sender are on record.</p>',
    );
  }

  const rows = history
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.filename)}</td><td>${escapeHtml(item.threat)}</td><td>${chip(item)}</td><td>${escapeHtml(readableTime(item.createdAt))}</td></tr>`,
    )
    .join("");

  return card(
    "Earlier blocks from this sender",
    `<div class="table-box"><table><thead><tr><th>File</th><th>Reason</th><th>Outcome</th><th>When</th></tr></thead><tbody>${rows}</tbody></table></div><p class="muted">Only reports that are still kept are shown.</p>`,
  );
}

function renderDecision(report, decisionToken) {
  if ((report.status || "blocked") !== "blocked") {
    return "";
  }

  if (!report.reviewable) {
    return card(
      "This block is final",
      `<p>The scan does not allow files like this to be approved. Ask ${escapeHtml(report.senderName)} to send a different file.</p>`,
    );
  }

  if (!decisionToken) {
    return card(
      "Waiting for a decision",
      "<p>Only the managers for this objective can approve or decline this file.</p>",
    );
  }

  return card(
    "Your decision",
    `<p>Approving lets <strong>${escapeHtml(report.senderName)}</strong> upload this exact file once in the next ${approvalWindowHours} hours. The scan will not stop it, so only approve it if you know what it is and why it is needed.</p>
<form method="post" action="${escapeHtml(String(report._id))}/decision">
<input type="hidden" name="token" value="${escapeHtml(decisionToken)}">
<label class="check"><input type="checkbox" name="confirm" value="yes" required> I have read this report and I want to let this exact file through once.</label>
<div class="actions">
<button class="approve" type="submit" name="decision" value="approve">Approve this file</button>
<button class="decline" type="submit" name="decision" value="decline" formnovalidate>Decline</button>
</div></form>`,
  );
}

function renderReportPage(report, options = {}) {
  const decisionToken = options.decisionToken || "";
  const canDecide = Boolean(decisionToken) && Boolean(report.reviewable);
  const warnType = /program|script/i.test(report.detectedType || "")
    ? "warn"
    : "";
  const keptUntil = new Date(report.expireAt).toISOString().slice(0, 10);
  const tip = report.reviewable ? adviceFor(report.threat) : "";
  const advice = tip
    ? `<p class="advice"><strong>What to check:</strong> ${escapeHtml(tip)}</p>`
    : "";
  const attempts =
    report.attempts > 1
      ? [
          field(
            "Attempts",
            `${report.attempts}, the latest on ${readableTime(report.lastAttemptAt)}`,
            "warn",
          ),
        ]
      : [];

  return page(
    "Blocked upload report",
    `<p class="eyebrow">Security report</p>
<h1>Upload blocked: ${escapeHtml(report.filename)}</h1>
${renderBanner(report, canDecide)}
${card("Why it was blocked", `<p>The scan found that ${escapeHtml(report.threat)}.</p>${advice}`)}
${card(
  "The file",
  fields([
    field("Name", report.filename),
    field("Size", readableSize(report.size)),
    field("Type it claimed", report.claimedType || report.extension),
    field("Type it really is", report.detectedType || "Unknown", warnType),
    field("SHA-256 fingerprint", report.sha256),
    field("Received", readableTime(report.createdAt)),
    ...attempts,
  ]),
)}
${card(
  "Who sent it",
  fields([
    field("Name", report.senderName),
    field("Email", report.senderEmail),
    field("Roles", (report.senderRoles || []).join(", ") || "none"),
    field("IP address", report.ip || "unknown"),
  ]),
)}
${card(
  "Where it was sent",
  fields([
    field("Objective", report.objectiveTitle),
    field("Key result", report.keyResultTitle),
  ]),
)}
${renderHistory(options.history)}
${card("Inside the file", renderPreview(report.preview))}
${card("First bytes of the file", `<pre class="box hex">${escapeHtml(report.hexHead || "")}</pre>`)}
${renderDecision(report, decisionToken)}
<p class="foot">This report is kept until ${escapeHtml(keptUntil)} and then deleted.</p>`,
  );
}

module.exports = { renderReportPage };

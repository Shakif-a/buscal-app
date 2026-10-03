const { escapeHtml, readableTime } = require("./layout");

function banner(kind, title, text) {
  return `<div class="banner ${kind}"><strong>${escapeHtml(title)}</strong>${text}</div>`;
}

function renderBanner(report, canDecide) {
  const status = report.status || "blocked";
  const sender = escapeHtml(report.senderName);
  const decider = escapeHtml(report.decidedByName || "A manager");
  const decidedAt = report.decidedAt ? escapeHtml(readableTime(report.decidedAt)) : "";

  if (status === "approved" && new Date(report.approvalExpiresAt) > new Date()) {
    const until = escapeHtml(readableTime(report.approvalExpiresAt));
    return banner(
      "ok",
      "A manager approved this file.",
      `${decider} approved it on ${decidedAt}. ${sender} can upload this exact file once before ${until}. Nothing has been saved yet.`,
    );
  }

  if (status === "approved") {
    const ranOut = escapeHtml(readableTime(report.approvalExpiresAt));
    return banner(
      "wait",
      "The approval has expired.",
      `It ran out on ${ranOut}. The file was never saved. ${sender} can upload it again to ask for a new review.`,
    );
  }

  if (status === "used") {
    const usedAt = escapeHtml(readableTime(report.usedAt));
    return banner(
      "ok",
      "Approved and uploaded.",
      `${decider} approved it on ${decidedAt}. ${sender} uploaded it on ${usedAt}.`,
    );
  }

  if (status === "declined") {
    return banner(
      "",
      "This file was declined.",
      `${decider} declined it on ${decidedAt}. It was never saved.`,
    );
  }

  const hint = canDecide
    ? " Review the details below, then approve or decline at the bottom of the page."
    : "";
  return banner(
    "",
    "The security scan stopped this file.",
    `It was never saved and cannot be downloaded. This page is a safe summary, and nothing on it can run.${hint}`,
  );
}

function statusLook(record) {
  const status = record.status || "blocked";

  if (status === "blocked") {
    return record.reviewable
      ? ["Waiting for a decision", "wait"]
      : ["Blocked for good", "final"];
  }

  if (status === "approved") {
    return ["Approved", "ok"];
  }

  return status === "used" ? ["Approved and used", "ok"] : ["Declined", ""];
}

function chip(record) {
  const [text, kind] = statusLook(record);
  return `<span class="chip ${kind}">${escapeHtml(text)}</span>`;
}

module.exports = { renderBanner, chip };

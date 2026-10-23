const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const OkrBlockedUpload = require("../models/okrBlockedUploadModel");
const User = require("../models/userModel");
const {
  approvalWindowHours,
  recordDecision,
} = require("../services/blockedUploads/approval");
const { tellAboutDecision } = require("../services/blockedUploads/alerts");
const { findSenderHistory } = require("../services/blockedUploads/history");
const { buildAuditView } = require("../services/blockedUploads/audit");
const {
  readReportToken,
  readDecisionToken,
  readAuditToken,
  signDecisionToken,
} = require("../services/blockedUploads/links");
const {
  canDecideReport,
  canViewReport,
  findAuditScope,
} = require("../services/blockedUploads/access");
const { fullName } = require("../services/blockedUploads/report");
const {
  renderReportPage,
  renderAuditPage,
} = require("../services/blockedUploads/pages");
const {
  sendPage,
  sendMessage,
  refuse,
  notFound,
} = require("../services/blockedUploads/responses");

const viewBlockedUpload = asyncHandler(async (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.reportId)) {
    return refuse(res);
  }

  const userId = readReportToken(req.query.token, req.params.reportId);
  if (!userId) {
    return refuse(res);
  }

  const report = await OkrBlockedUpload.findById(req.params.reportId);
  if (!report) {
    return notFound(res);
  }

  if (!(await canViewReport(report, userId))) {
    return refuse(res);
  }

  const canDecide =
    report.reviewable &&
    report.status === "blocked" &&
    (await canDecideReport(report, userId));

  const options = { history: await findSenderHistory(report) };

  if (canDecide) {
    options.decisionToken = signDecisionToken(report._id, userId);
  }

  sendPage(res, 200, renderReportPage(report, options));
});

const viewAuditLog = asyncHandler(async (req, res) => {
  const userId = readAuditToken(req.query.token);
  const scope = userId && (await findAuditScope(userId));

  if (!scope) {
    return refuse(res);
  }

  const view = await buildAuditView({
    userId,
    scope,
    token: req.query.token,
    status: req.query.status,
    q: req.query.q,
    page: req.query.page,
  });

  sendPage(res, 200, renderAuditPage(view));
});

function findDecisionProblem(body, report) {
  if (body.decision !== "approve" && body.decision !== "decline") {
    return [
      400,
      "Choose approve or decline",
      "Go back to the report and use one of the two buttons.",
    ];
  }

  if (body.decision === "approve" && body.confirm !== "yes") {
    return [
      400,
      "Please confirm first",
      "Go back to the report and tick the box to confirm that you have read it.",
    ];
  }

  if (!report.reviewable) {
    return [
      409,
      "This block is final",
      "The scan does not allow this kind of file to be approved.",
    ];
  }

  return null;
}

const decideBlockedUpload = asyncHandler(async (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.reportId)) {
    return refuse(res);
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const userId = readDecisionToken(body.token, req.params.reportId);
  if (!userId) {
    return sendMessage(
      res,
      403,
      "This page has expired",
      "Open the link from your alert again, then make your decision.",
    );
  }

  const report = await OkrBlockedUpload.findById(req.params.reportId);
  if (!report) {
    return notFound(res);
  }

  const isSender = String(report.uploadedBy) === userId;
  if (isSender || !(await canDecideReport(report, userId))) {
    return refuse(res);
  }

  const problem = findDecisionProblem(body, report);
  if (problem) {
    return sendMessage(res, ...problem);
  }

  const user = await User.findById(userId).select("firstName lastName");
  const decider = { id: user._id, name: fullName(user, "A manager") };
  const updated = await recordDecision(report, decider, body.decision);

  if (!updated) {
    const current = await OkrBlockedUpload.findById(report._id);
    if (!current) {
      return notFound(res);
    }

    return sendMessage(
      res,
      409,
      "Already decided",
      `This file was already handled by ${current.decidedByName || "someone"} (${current.status}).`,
    );
  }

  await tellAboutDecision(updated, user, body.decision);

  if (body.decision === "decline") {
    return sendMessage(
      res,
      200,
      "File declined",
      `${updated.senderName} has been told that the file was not approved.`,
    );
  }

  sendMessage(
    res,
    200,
    "File approved",
    `${updated.senderName} can now upload this exact file once in the next ${approvalWindowHours} hours. They have been told.`,
  );
});

module.exports = { viewBlockedUpload, viewAuditLog, decideBlockedUpload };

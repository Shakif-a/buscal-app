const jwt = require("jsonwebtoken");

const reportPurpose = "blocked-upload-report";
const decisionPurpose = "blocked-upload-decision";
const auditPurpose = "blocked-upload-audit";
const auditSubject = "all";

function signToken(purpose, lifetime, reportId, userId, options = {}) {
  return jwt.sign(
    { purpose, report: String(reportId), user: String(userId) },
    process.env.JWT_SECRET + ":" + purpose,
    { expiresIn: lifetime, ...options },
  );
}

function readToken(purpose, token, reportId) {
  if (typeof token !== "string" || !token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET + ":" + purpose);
    const valid =
      payload.purpose === purpose &&
      payload.report === String(reportId) &&
      typeof payload.user === "string";

    return valid ? payload.user : null;
  } catch {
    return null;
  }
}

const signReportToken = (reportId, userId, options) =>
  signToken(reportPurpose, "7d", reportId, userId, options);

const readReportToken = (token, reportId) =>
  readToken(reportPurpose, token, reportId);

const signDecisionToken = (reportId, userId, options) =>
  signToken(decisionPurpose, "1h", reportId, userId, options);

const readDecisionToken = (token, reportId) =>
  readToken(decisionPurpose, token, reportId);

const signAuditToken = (userId, options) =>
  signToken(auditPurpose, "7d", auditSubject, userId, options);

const readAuditToken = (token) => readToken(auditPurpose, token, auditSubject);

function publicBaseUrl() {
  const fallback = "http://localhost:" + (process.env.PORT || 5000);

  try {
    const url = new URL(process.env.PUBLIC_API_URL);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.origin
      : fallback;
  } catch {
    return fallback;
  }
}

function reportUrl(reportId, userId) {
  const token = encodeURIComponent(signReportToken(reportId, userId));
  return `${publicBaseUrl()}/api/okr/blocked-uploads/${reportId}?token=${token}`;
}

function auditUrl(userId, filters = {}) {
  const query = new URLSearchParams({
    ...filters,
    token: signAuditToken(userId),
  });
  return `${publicBaseUrl()}/api/okr/blocked-uploads?${query}`;
}

module.exports = {
  signReportToken,
  readReportToken,
  signDecisionToken,
  readDecisionToken,
  signAuditToken,
  readAuditToken,
  reportUrl,
  auditUrl,
};

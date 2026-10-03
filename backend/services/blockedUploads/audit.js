const OkrBlockedUpload = require("../../models/okrBlockedUploadModel");
const { auditUrl, reportUrl } = require("./links");

const pageSize = 25;
const searchFields = ["filename", "senderName", "senderEmail", "threat"];
const rowFields =
  "filename senderName senderEmail threat status reviewable attempts createdAt decidedByName";

const choices = [
  { key: "all", label: "All", filter: {} },
  { key: "waiting", label: "Waiting", filter: { status: "blocked", reviewable: true } },
  { key: "final", label: "Blocked for good", filter: { status: "blocked", reviewable: false } },
  { key: "approved", label: "Approved", filter: { status: { $in: ["approved", "used"] } } },
  { key: "declined", label: "Declined", filter: { status: "declined" } },
];

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanQuery(value) {
  return typeof value === "string" ? value.trim().slice(0, 80) : "";
}

function searchFilter(query) {
  if (!query) {
    return {};
  }

  return {
    $or: searchFields.map((name) => ({
      [name]: { $regex: escapeRegex(query), $options: "i" },
    })),
  };
}

async function buildAuditView({ userId, scope, token, status, q, page }) {
  const choice = choices.find((item) => item.key === status) || choices[0];
  const query = cleanQuery(q);
  const search = searchFilter(query);
  const where = (filter) => ({ $and: [scope, filter, search] });

  const counts = await Promise.all(
    choices.map((item) => OkrBlockedUpload.countDocuments(where(item.filter))),
  );
  const total = counts[choices.indexOf(choice)];
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const asked = Number.parseInt(page, 10);
  const pageNumber = Math.min(Math.max(asked || 1, 1), pageCount);

  const records = await OkrBlockedUpload.find(where(choice.filter))
    .sort({ createdAt: -1 })
    .skip((pageNumber - 1) * pageSize)
    .limit(pageSize)
    .select(rowFields)
    .lean();

  function link(key, number) {
    return auditUrl(userId, {
      ...(key !== "all" && { status: key }),
      ...(query && { q: query }),
      ...(number > 1 && { page: String(number) }),
    });
  }

  return {
    token,
    status: choice.key,
    query,
    pageNumber,
    pageCount,
    previousUrl: pageNumber > 1 ? link(choice.key, pageNumber - 1) : "",
    nextUrl: pageNumber < pageCount ? link(choice.key, pageNumber + 1) : "",
    filters: choices.map((item, index) => ({
      label: item.label,
      count: counts[index],
      active: item === choice,
      url: link(item.key, 1),
    })),
    rows: records.map((record) => ({
      ...record,
      url: reportUrl(record._id, userId),
    })),
  };
}

module.exports = { buildAuditView };

const OkrGroup = require("../../models/okrGroupModel");
const OkrObjective = require("../../models/okrObjectiveModel");
const User = require("../../models/userModel");

const isAdminUser = (user) =>
  Boolean(user) &&
  (user.exec === "yes" ||
    (Array.isArray(user.roles) && user.roles.includes("admin")));

async function findAdminIds(exceptId) {
  const admins = await User.find({
    $or: [{ roles: "admin" }, { exec: "yes" }],
    _id: { $ne: exceptId },
  }).select("_id");

  return admins.map((admin) => admin._id.toString());
}

async function findManagerIds(user, objective) {
  const senderId = user._id.toString();
  const ids = new Set();

  function add(value) {
    const id = value && (value._id || value).toString();
    if (id && id !== senderId) {
      ids.add(id);
    }
  }

  add(objective.owner);
  add(user.supervisor);

  if (typeof objective.group === "string" && objective.group.trim()) {
    const group = await OkrGroup.findOne({
      name: objective.group.trim(),
    }).select("manager");

    if (group) {
      add(group.manager);
    }
  }

  if (ids.size === 0) {
    (await findAdminIds(user._id)).forEach(add);
  }

  return [...ids];
}

async function findReportManagerIds(report) {
  const objective = await OkrObjective.findById(report.objective);

  if (!objective) {
    return [];
  }

  const sender = await User.findById(report.uploadedBy).select("supervisor");

  return findManagerIds(
    { _id: report.uploadedBy, supervisor: sender && sender.supervisor },
    objective,
  );
}

async function canDecideReport(report, userId) {
  const viewer = await User.findById(userId).select("_id");

  if (!viewer) {
    return false;
  }

  const managerIds = await findReportManagerIds(report);
  return managerIds.includes(String(userId));
}

async function canViewReport(report, userId) {
  if (String(report.uploadedBy) === String(userId)) {
    return false;
  }

  if (await canDecideReport(report, userId)) {
    return true;
  }

  return isAdminUser(await User.findById(userId).select("roles exec"));
}

async function findAuditScope(userId) {
  const viewer = await User.findById(userId).select("roles exec");

  if (!viewer) {
    return null;
  }

  const notOwn = { uploadedBy: { $ne: viewer._id } };

  if (isAdminUser(viewer)) {
    return notOwn;
  }

  const [owned, groups, reports] = await Promise.all([
    OkrObjective.find({ owner: viewer._id }).select("_id"),
    OkrGroup.find({ manager: viewer._id }).select("name"),
    User.find({ supervisor: viewer._id }).select("_id"),
  ]);
  const inGroups = groups.length
    ? await OkrObjective.find({
        group: { $in: groups.map((group) => group.name) },
      }).select("_id")
    : [];

  return {
    ...notOwn,
    $or: [
      { objective: { $in: [...owned, ...inGroups].map((item) => item._id) } },
      { uploadedBy: { $in: reports.map((user) => user._id) } },
    ],
  };
}

module.exports = {
  findAdminIds,
  findManagerIds,
  findReportManagerIds,
  canDecideReport,
  canViewReport,
  findAuditScope,
};

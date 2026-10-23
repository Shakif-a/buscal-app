// Fills the database with the fictional OKR sample data in seed/okrSampleData.json.
//   yarn seed:sample                       add the sample data
//   yarn seed:sample --reset               remove the sample data first, then add it again
//   yarn seed:sample --password <password> login password for every sample user
require("dotenv").config();
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/userModel");
const OkrGroup = require("../models/okrGroupModel");
const OkrObjective = require("../models/okrObjectiveModel");
const OkrKeyResult = require("../models/okrKeyResultModel");
const OkrEvidence = require("../models/okrEvidenceModel");
const OkrRolePermission = require("../models/okrRolePermissionModel");
const CalendarEntry = require("../models/calendarEntryModel");
const CalendarHistory = require("../models/calendarHistoryModel");
const { recalculateObjective } = require("../services/okrObjectiveProgressService");
const {
  OBJECTIVE_CATEGORY,
  KEY_RESULT_CATEGORY,
} = require("../services/okrCalendarSyncService");

const data = require(path.join(__dirname, "../seed/okrSampleData.json"));
const DEFAULT_PASSWORD = "SamplePass123!";

// Sample work is backdated so time based statuses (at risk, overdue) look realistic
const SAMPLE_START = new Date("2026-07-01T00:00:00Z");

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

// Calendar entry and history pair, like the app makes for objectives and key results.
// No notifications are sent, the sample email addresses aren't real.
async function createCalendarEntry({ title, description, dueDate, ownerId, assignedId, category, completed }) {
  const entry = await CalendarEntry.create({
    title,
    description,
    userOwner: ownerId,
    userAssigned: [assignedId],
    endTime: dueDate,
    completionStatus: completed ? "completed" : "not started",
    category,
    priority: "normal",
  });
  await CalendarHistory.create({
    ref: entry._id,
    assignments: [{ user: assignedId, notes: "Created by the sample data script." }],
  });
  return entry;
}

async function removeSampleData() {
  const emails = data.users.map((user) => user.email);
  const users = await User.find({ email: { $in: emails } }, "_id");
  const objectives = await OkrObjective.find(
    {
      $or: [
        { owner: { $in: users.map((user) => user._id) } },
        { title: { $in: data.objectives.map((objective) => objective.title) } },
      ],
    },
    "_id",
  );
  const objectiveIds = objectives.map((objective) => objective._id);
  const entries = await CalendarEntry.find(
    {
      $or: [
        { linkedObjective: { $in: objectiveIds } },
        { _id: { $in: await OkrObjective.distinct("calendarEntry", { _id: { $in: objectiveIds } }) } },
        { _id: { $in: await OkrKeyResult.distinct("calendarEntry", { objective: { $in: objectiveIds } }) } },
      ],
    },
    "_id",
  );
  const entryIds = entries.map((entry) => entry._id);

  await CalendarHistory.deleteMany({ ref: { $in: entryIds } });
  await CalendarEntry.deleteMany({ _id: { $in: entryIds } });
  await OkrEvidence.deleteMany({ objective: { $in: objectiveIds } });
  await OkrKeyResult.deleteMany({ objective: { $in: objectiveIds } });
  await OkrObjective.deleteMany({ _id: { $in: objectiveIds } });
  await OkrGroup.deleteMany({ name: { $in: data.groups.map((group) => group.name) } });
  await OkrRolePermission.deleteMany({ role: { $in: data.roles.map((role) => role.role) } });
  await User.deleteMany({ _id: { $in: users.map((user) => user._id) } });

  console.log(
    `Removed ${users.length} users, ${objectiveIds.length} objectives and ${entryIds.length} calendar entries from earlier sample data.`,
  );
}

async function addSampleData(password) {
  const hashedPassword = await bcrypt.hash(password, await bcrypt.genSalt(10));

  const userIds = {};
  for (const user of data.users) {
    const saved = await User.create({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      password: hashedPassword,
      roles: user.roles,
      companyRoles: user.companyRoles,
      exec: user.exec,
      okrRole: user.okrRole || null,
    });
    userIds[user.email] = saved._id;
  }
  const userId = (email) => {
    if (!userIds[email]) throw new Error(`Unknown user in sample data: ${email}`);
    return userIds[email];
  };

  for (const role of data.roles) {
    await OkrRolePermission.create({
      role: role.role,
      roleKey: role.role.toLowerCase(),
      permissions: role.permissions,
    });
  }

  for (const group of data.groups) {
    await OkrGroup.create({
      name: group.name,
      manager: userId(group.managerEmail),
      members: group.memberEmails.map(userId),
    });
  }

  let keyResultCount = 0;
  for (const item of data.objectives) {
    const ownerId = userId(item.ownerEmail);
    const objectiveEntry = await createCalendarEntry({
      title: item.title,
      description: item.description,
      dueDate: item.dueDate,
      ownerId,
      assignedId: ownerId,
      category: OBJECTIVE_CATEGORY,
    });
    const objective = await OkrObjective.create({
      title: item.title,
      description: item.description,
      owner: ownerId,
      group: item.group,
      commitmentType: item.commitmentType,
      dueDate: item.dueDate,
      calendarEntry: objectiveEntry._id,
      createdAt: SAMPLE_START,
    });
    objectiveEntry.linkedObjective = objective._id;
    await objectiveEntry.save();

    for (const kr of item.keyResults) {
      const assignedId = userId(kr.assignedToEmail);
      const entry = await createCalendarEntry({
        title: kr.title,
        description: "Key result for the objective: " + item.title,
        dueDate: kr.dueDate,
        ownerId,
        assignedId,
        category: KEY_RESULT_CATEGORY,
        completed: kr.status === "completed",
      });
      const keyResult = await OkrKeyResult.create({
        objective: objective._id,
        title: kr.title,
        weight: kr.weight,
        assignedTo: assignedId,
        progress: kr.progress,
        dueDate: kr.dueDate,
        status: kr.status,
        evidence: kr.evidence,
        approved: kr.approved,
        calendarEntry: entry._id,
        createdAt: SAMPLE_START,
      });
      entry.linkedObjective = objective._id;
      entry.linkedKeyResult = keyResult._id;
      await entry.save();
      keyResultCount += 1;
    }

    // Works out the objective's progress and status the same way the app does
    await recalculateObjective(objective._id);
  }

  console.log(
    `Added ${data.users.length} users, ${data.groups.length} groups, ${data.objectives.length} objectives and ${keyResultCount} key results.`,
  );
}

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not set. Copy backend/.env.example to backend/.env first.");
  }
  const password = argument("--password") || DEFAULT_PASSWORD;

  await mongoose.connect(process.env.MONGO_URI);
  try {
    if (process.argv.includes("--reset")) {
      await removeSampleData();
    } else if (await User.exists({ email: { $in: data.users.map((user) => user.email) } })) {
      console.log("Sample data is already loaded. Run with --reset to replace it.");
      return;
    } else if (await OkrGroup.exists({ name: { $in: data.groups.map((group) => group.name) } })) {
      console.log("Groups with the sample group names already exist. Run with --reset to replace them.");
      return;
    }

    await addSampleData(password);
    console.log(`Sign in as any sample user, e.g. ${data.users[0].email} (admin), with the password: ${password}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

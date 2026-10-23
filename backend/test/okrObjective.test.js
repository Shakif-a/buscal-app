const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const OkrObjective = require("../models/okrObjectiveModel");
const OkrKeyResult = require("../models/okrKeyResultModel");
const OkrEvidence = require("../models/okrEvidenceModel");
const User = require("../models/userModel");
const originalUserExists = User.exists;
const OkrGroup = require("../models/okrGroupModel");
const writes = require("../services/okrWrites");
const Permission = require("../models/okrRolePermissionModel");
const originalWrites = { ...writes };
const originalPermission = Permission.findOne;
const originalKeySave = OkrKeyResult.prototype.save;
const CalendarEntry = require("../models/calendarEntryModel");
const CalendarHistory = require("../models/calendarHistoryModel");
const {
  getObjectives,
  getObjective,
  createObjective,
  updateObjective,
  deleteObjective,
  createKeyResult,
} = require("../controllers/okrController");

const originalFindObjectives = OkrObjective.find;
const originalFindObjective = OkrObjective.findById;
const originalFindKeyResults = OkrKeyResult.find;
const originalDeleteKeyResults = OkrKeyResult.deleteMany;
const originalDeleteEvidence = OkrEvidence.deleteMany;
const originalCreateKeyResult = OkrKeyResult.create;
const originalFindGroup = OkrGroup.findOne;
const originalFindGroups = OkrGroup.find;
const originalCreateObjective = OkrObjective.create;
const originalCreateCalendarEntry = CalendarEntry.create;
const originalFindCalendarEntry = CalendarEntry.findById;
const originalCreateCalendarHistory = CalendarHistory.create;

test.beforeEach(() => {
  OkrGroup.findOne = async () => null;
  OkrGroup.find = () => mockQuery([]);
  Permission.findOne = async () => null;
  writes.transaction = async (work) => work(undefined);
  writes.lockObjective = async (id) => OkrObjective.findById(id);
  writes.syncCalendar = async (objective) => {
    if (objective.saveCount !== undefined) await objective.save();
  };
  writes.removeCalendar = async () => {};
  writes.requireGroup = async () => {};
  writes.linkLegacyCalendar = async () => {};
  OkrKeyResult.prototype.save = async function () {
    return OkrKeyResult.create(this);
  };
  OkrEvidence.deleteMany = async () => {};
});

test.afterEach(() => {
  Object.assign(writes, originalWrites);
  Permission.findOne = originalPermission;
  OkrKeyResult.prototype.save = originalKeySave;
  User.exists = originalUserExists;
  OkrObjective.find = originalFindObjectives;
  OkrObjective.findById = originalFindObjective;
  OkrKeyResult.find = originalFindKeyResults;
  OkrKeyResult.deleteMany = originalDeleteKeyResults;
  OkrEvidence.deleteMany = originalDeleteEvidence;
  OkrKeyResult.create = originalCreateKeyResult;
  OkrGroup.findOne = originalFindGroup;
  OkrGroup.find = originalFindGroups;
  OkrObjective.create = originalCreateObjective;
  CalendarEntry.create = originalCreateCalendarEntry;
  CalendarEntry.findById = originalFindCalendarEntry;
  CalendarHistory.create = originalCreateCalendarHistory;
});

function runController(controller, req) {
  req.user = req.user || {
    _id: new mongoose.Types.ObjectId(),
    roles: ["admin"],
  };
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        resolve({ data, statusCode: this.statusCode });
      },
    };

    controller(req, res, (error) => {
      resolve({ error, statusCode: res.statusCode });
    });
  });
}

function mockQuery(result) {
  return {
    populate() {
      return this;
    },
    sort() {
      return this;
    },
    select() {
      return this;
    },
    then(resolve, reject) {
      return Promise.resolve(result).then(resolve, reject);
    },
  };
}

function noKeyResults() {
  return mockQuery([]);
}

function mockObjectiveList(objectives) {
  OkrObjective.find = () => mockQuery(objectives);
  OkrObjective.findById = (id) =>
    mockQuery(
      objectives.find((objective) => objective._id.toString() === id.toString()),
    );
}

function makeObjective(options = {}) {
  const objective = {
    _id: options.id || new mongoose.Types.ObjectId(),
    title: options.title || "Objective",
    description: options.description || "Description",
    group: options.group || "Sales",
    owner: options.owner || {
      _id: new mongoose.Types.ObjectId(),
      firstName: "Alex",
      lastName: "Smith",
    },
    dueDate: options.dueDate || new Date("2026-12-01"),
    commitmentType: "committed",
    saveCount: 0,
    deleteCount: 0,
    async save() {
      this.saveCount++;
    },
    async populate() {
      return this;
    },
    async deleteOne() {
      this.deleteCount++;
    },
    toObject() {
      return {
        _id: this._id,
        title: this.title,
        description: this.description,
        group: this.group,
        owner: this.owner,
        dueDate: this.dueDate,
        commitmentType: this.commitmentType,
      };
    },
  };

  return objective;
}

function mockPartialKeyResults(objective) {
  const keyResults = [
    new OkrKeyResult({
      objective: objective._id,
      title: "First key result",
      weight: 60,
      progress: 20,
      approved: false,
      dueDate: "2026-11-01",
    }),
    new OkrKeyResult({
      objective: objective._id,
      title: "Second key result",
      weight: 40,
      progress: 80,
      approved: false,
      dueDate: "2026-11-01",
    }),
  ];

  OkrKeyResult.find = (filter) => {
    assert.equal(filter.objective.toString(), objective._id.toString());

    return {
      populate() {
        return this;
      },
      async sort() {
        return keyResults;
      },
    };
  };

  return keyResults;
}

test("the objective list counts partial progress before approval", async () => {
  const objective = makeObjective();
  const keyResults = mockPartialKeyResults(objective);

  OkrObjective.find = () => ({
    async populate() {
      return [objective];
    },
  });

  const result = await runController(getObjectives, {});

  assert.equal(result.statusCode, 200);
  assert.equal(result.data[0].progress, 44);
  assert.equal(result.data[0].keyResults.length, 2);
  assert.equal(result.data[0].keyResults[0].approved, false);
  assert.equal(result.data[0].keyResults[1].approved, false);
  assert.equal(keyResults[0].progress, 20);
  assert.equal(keyResults[1].progress, 80);
  assert.equal(objective.saveCount, 0);
});

test("objective responses say if the current user can manage them", async () => {
  const objective = makeObjective();
  const owner = {
    _id: objective.owner._id,
    roles: ["employee"],
    exec: "no",
    companyRoles: [],
  };
  const otherEmployee = {
    _id: new mongoose.Types.ObjectId(),
    roles: ["employee"],
    exec: "no",
    companyRoles: [],
  };

  mockObjectiveList([objective]);
  OkrKeyResult.find = noKeyResults;
  OkrGroup.findOne = async () => null;

  const ownerResult = await runController(getObjectives, { user: owner });
  const employeeResult = await runController(getObjectives, {
    user: otherEmployee,
  });

  assert.equal(ownerResult.data[0].canManage, true);
  assert.equal(employeeResult.data[0].canManage, false);
});

test("objective details count partial progress before approval", async () => {
  const objective = makeObjective();
  mockPartialKeyResults(objective);
  const owner = {
    _id: objective.owner._id,
    roles: ["employee"],
    exec: "no",
    companyRoles: [],
  };

  OkrObjective.findById = (id) => {
    assert.equal(id, objective._id.toString());

    return {
      async populate() {
        return objective;
      },
    };
  };

  const result = await runController(getObjective, {
    params: { id: objective._id.toString() },
    user: owner,
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.data.objective.progress, 44);
  assert.equal(result.data.keyResults[0].progress, 20);
  assert.equal(result.data.keyResults[1].progress, 80);
  assert.equal(result.data.keyResults[0].approved, false);
  assert.equal(result.data.keyResults[1].approved, false);
  assert.equal(result.data.objective.canManage, true);
  assert.equal(objective.saveCount, 0);
});

test("a newly created objective includes its access flag", async () => {
  const ownerId = new mongoose.Types.ObjectId();
  const owner = {
    _id: ownerId,
    roles: ["admin"],
    exec: "no",
    companyRoles: [],
  };
  const objective = makeObjective({ owner: ownerId });

  User.exists = async () => ({ _id: ownerId });
  OkrObjective.create = async () => objective;
  CalendarEntry.create = async () => ({});

  const result = await runController(createObjective, {
    user: owner,
    body: {
      title: "New objective",
      owner: ownerId.toString(),
      group: "Sales",
      dueDate: "2026-12-01",
    },
  });

  assert.equal(result.statusCode, 201);
  assert.equal(result.data.canManage, true);
});

test("editing an objective keeps its unapproved partial progress", async () => {
  const objective = makeObjective();
  mockPartialKeyResults(objective);

  OkrObjective.findById = async () => objective;

  const result = await runController(updateObjective, {
    params: { id: objective._id.toString() },
    body: { title: "Updated objective" },
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.data.title, "Updated objective");
  assert.equal(result.data.progress, 44);
  assert.equal(result.data.keyResults[0].approved, false);
  assert.equal(result.data.keyResults[1].approved, false);
  assert.equal(objective.saveCount, 1);
});

test("an objective without key results has zero progress", async () => {
  const objective = makeObjective();

  OkrObjective.find = () => ({
    async populate() {
      return [objective];
    },
  });
  OkrKeyResult.find = noKeyResults;

  const result = await runController(getObjectives, {});

  assert.equal(result.statusCode, 200);
  assert.equal(result.data[0].progress, 0);
  assert.deepEqual(result.data[0].keyResults, []);
  assert.equal(objective.saveCount, 0);
});

test("a valid objective edit saves and returns the updated objective", async () => {
  const objective = makeObjective();
  // already matches what the recalculation works out, so only the edit saves
  objective.progress = 0;
  objective.status = "not started";
  const owner = {
    _id: objective.owner._id,
    roles: ["employee"],
    exec: "no",
    companyRoles: [],
  };

  OkrObjective.findById = () => mockQuery(objective);
  OkrKeyResult.find = noKeyResults;

  const result = await runController(updateObjective, {
    params: { id: objective._id.toString() },
    body: { title: "  Updated objective  " },
    user: owner,
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.data.title, "Updated objective");
  assert.equal(result.data.description, "Description");
  assert.equal(result.data.keyResults.length, 0);
  assert.equal(result.data.canManage, true);
  assert.equal(objective.saveCount, 1);
});

test("an invalid objective edit does not save", async () => {
  const objective = makeObjective();

  OkrObjective.findById = async () => objective;

  const result = await runController(updateObjective, {
    params: { id: objective._id.toString() },
    body: { title: "   " },
  });

  assert.equal(result.statusCode, 400);
  assert.equal(objective.saveCount, 0);
});

test("deleting an objective also deletes its key results", async () => {
  const objective = makeObjective();
  const steps = [];

  objective.deleteOne = async () => {
    steps.push("objective");
  };

  OkrObjective.findById = async () => objective;
  OkrEvidence.deleteMany = async () => {
    steps.push("evidence");
  };
  OkrKeyResult.deleteMany = async () => {
    steps.push("key results");
  };

  const result = await runController(deleteObjective, {
    params: { id: objective._id.toString() },
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.data.id, objective._id.toString());
  assert.deepEqual(steps, ["evidence", "key results", "objective"]);
});

test("objectives are sorted by owner and then due date", async () => {
  const objectives = [
    makeObjective({
      title: "Bob objective",
      owner: { firstName: "Bob", lastName: "Jones" },
      dueDate: new Date("2026-03-01"),
    }),
    makeObjective({
      title: "Alice later",
      owner: { firstName: "Alice", lastName: "Brown" },
      dueDate: new Date("2026-06-01"),
    }),
    makeObjective({
      title: "Alice earlier",
      owner: { firstName: "Alice", lastName: "Brown" },
      dueDate: new Date("2026-02-01"),
    }),
  ];

  mockObjectiveList(objectives);
  OkrKeyResult.find = noKeyResults;

  const result = await runController(getObjectives, {});

  assert.equal(result.statusCode, 200);
  assert.deepEqual(
    result.data.map((objective) => objective.title),
    ["Alice earlier", "Alice later", "Bob objective"],
  );
});

test("key result weights cannot go above 100 percent", async () => {
  const objective = makeObjective();
  let createCount = 0;

  OkrObjective.findById = async () => objective;
  OkrKeyResult.find = async () => [{ weight: 60 }, { weight: 30 }];
  OkrKeyResult.create = async () => {
    createCount++;
  };

  const result = await runController(createKeyResult, {
    params: { id: objective._id.toString() },
    body: {
      title: "New key result",
      weight: 20,
      dueDate: "2026-11-01",
    },
  });

  assert.equal(result.statusCode, 400);
  assert.equal(createCount, 0);
});

test("a key result can use the remaining weight", async () => {
  const objective = makeObjective();
  let savedKeyResult;

  OkrObjective.findById = async () => objective;
  OkrKeyResult.find = async () => [{ weight: 40 }, { weight: 35 }];
  OkrKeyResult.create = async (keyResult) => {
    savedKeyResult = keyResult;
    return keyResult;
  };

  const result = await runController(createKeyResult, {
    params: { id: objective._id.toString() },
    body: {
      title: "Final key result",
      weight: 25,
      dueDate: "2026-11-01",
    },
  });

  assert.equal(result.statusCode, 201);
  assert.equal(savedKeyResult.objective.toString(), objective._id.toString());
  assert.equal(savedKeyResult.weight, 25);
});

test("the objective list flags ownership, my groups and my key results", async () => {
  const objective = makeObjective({ group: "Sales" });
  const owner = {
    _id: objective.owner._id,
    roles: ["employee"],
    exec: "no",
    companyRoles: [],
  };
  const otherUser = { _id: new mongoose.Types.ObjectId(), roles: ["employee"] };
  const keyResults = [
    new OkrKeyResult({
      objective: objective._id,
      title: "Mine",
      weight: 50,
      progress: 50,
      assignedTo: owner._id,
      dueDate: "2099-01-01",
    }),
    new OkrKeyResult({
      objective: objective._id,
      title: "Someone else's",
      weight: 50,
      progress: 50,
      assignedTo: otherUser._id,
      dueDate: "2099-01-01",
    }),
  ];

  mockObjectiveList([objective]);
  OkrKeyResult.find = () => mockQuery(keyResults);
  OkrGroup.find = (filter) => {
    assert.deepEqual(filter, {
      $or: [{ members: owner._id }, { manager: owner._id }],
    });
    return mockQuery([{ name: "Sales" }]);
  };

  const result = await runController(getObjectives, { user: owner });

  assert.equal(result.statusCode, 200);
  assert.equal(result.data[0].isOwner, true);
  assert.equal(result.data[0].inMyGroups, true);
  assert.deepEqual(
    result.data[0].keyResults.map((kr) => kr.isAssignedToMe),
    [true, false],
  );

  OkrGroup.find = () => mockQuery([]);
  const otherResult = await runController(getObjectives, { user: otherUser });
  assert.equal(otherResult.data[0].isOwner, false);
  assert.equal(otherResult.data[0].inMyGroups, false);
  assert.deepEqual(
    otherResult.data[0].keyResults.map((kr) => kr.isAssignedToMe),
    [false, true],
  );
});

test("key results can only be assigned to the owner or the objective's group", async () => {
  const objective = makeObjective({ group: "Sales" });
  const manager = new mongoose.Types.ObjectId();
  const member = new mongoose.Types.ObjectId();
  const outsider = new mongoose.Types.ObjectId();
  const created = [];

  OkrObjective.findById = async () => objective;
  OkrKeyResult.find = async () => [];
  OkrKeyResult.create = async (data) => {
    created.push(data.assignedTo);
    return {
      populate: async () => {},
      toObject: () => ({ ...data, _id: new mongoose.Types.ObjectId() }),
    };
  };
  OkrGroup.findOne = async (filter) =>
    filter.name === "Sales" ? { manager, members: [member] } : null;
  CalendarEntry.create = async (data) => ({
    ...data,
    _id: new mongoose.Types.ObjectId(),
    save: async () => {},
  });
  CalendarEntry.findById = async () => null;
  CalendarHistory.create = async () => ({});

  const create = (assignedTo) =>
    runController(createKeyResult, {
      params: { objectiveId: objective._id.toString() },
      body: { title: "Result", weight: 10, dueDate: "2026-11-01", assignedTo: assignedTo.toString() },
    });

  for (const allowed of [objective.owner._id, manager, member]) {
    assert.equal((await create(allowed)).statusCode, 201);
  }
  const rejected = await create(outsider);
  assert.equal(rejected.statusCode, 400);
  assert.deepEqual(
    created.map(String),
    [objective.owner._id, manager, member].map(String),
  );
});

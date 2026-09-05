const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const OkrObjective = require("../models/okrObjectiveModel");
const OkrKeyResult = require("../models/okrKeyResultModel");
const {
  getObjectives,
  getObjective,
  updateObjective,
  deleteObjective,
  createKeyResult,
} = require("../controllers/okrController");

const originalFindObjectives = OkrObjective.find;
const originalFindObjective = OkrObjective.findById;
const originalFindKeyResults = OkrKeyResult.find;
const originalDeleteKeyResults = OkrKeyResult.deleteMany;
const originalCreateKeyResult = OkrKeyResult.create;

test.afterEach(() => {
  OkrObjective.find = originalFindObjectives;
  OkrObjective.findById = originalFindObjective;
  OkrKeyResult.find = originalFindKeyResults;
  OkrKeyResult.deleteMany = originalDeleteKeyResults;
  OkrKeyResult.create = originalCreateKeyResult;
});

function runController(controller, req) {
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

function noKeyResults() {
  return {
    populate() {
      return this;
    },
    async sort() {
      return [];
    },
  };
}

function makeObjective(options = {}) {
  const objective = {
    _id: options.id || new mongoose.Types.ObjectId(),
    title: options.title || "Objective",
    description: options.description || "Description",
    group: options.group || "Sales",
    owner:
      options.owner || {
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

test("objective details count partial progress before approval", async () => {
  const objective = makeObjective();
  mockPartialKeyResults(objective);

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
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.data.objective.progress, 44);
  assert.equal(result.data.keyResults[0].progress, 20);
  assert.equal(result.data.keyResults[1].progress, 80);
  assert.equal(result.data.keyResults[0].approved, false);
  assert.equal(result.data.keyResults[1].approved, false);
  assert.equal(objective.saveCount, 0);
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

  OkrObjective.findById = async () => objective;
  OkrKeyResult.find = noKeyResults;

  const result = await runController(updateObjective, {
    params: { id: objective._id.toString() },
    body: { title: "  Updated objective  " },
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.data.title, "Updated objective");
  assert.equal(result.data.description, "Description");
  assert.equal(result.data.keyResults.length, 0);
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
  OkrKeyResult.deleteMany = async () => {
    steps.push("key results");
  };

  const result = await runController(deleteObjective, {
    params: { id: objective._id.toString() },
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.data.id, objective._id.toString());
  assert.deepEqual(steps, ["key results", "objective"]);
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

  OkrObjective.find = () => ({
    async populate() {
      return objectives;
    },
  });
  OkrKeyResult.find = noKeyResults;

  const result = await runController(getObjectives, {});

  assert.equal(result.statusCode, 200);
  assert.deepEqual(
    result.data.map((objective) => objective.title),
    ["Alice earlier", "Alice later", "Bob objective"]
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
  assert.equal(savedKeyResult.objective, objective._id);
  assert.equal(savedKeyResult.weight, 25);
});

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const OkrGroup = require("../models/okrGroupModel");
const OkrObjective = require("../models/okrObjectiveModel");
const OkrRolePermission = require("../models/okrRolePermissionModel");
const {
  adminOrExec,
  getRoleName,
} = require("../middleware/adminPermissions");
const {
  canCreateObjective,
  canManageObjective,
} = require("../middleware/okrPermissions");

const originalFindObjective = OkrObjective.findById;
const originalFindGroup = OkrGroup.findOne;
const originalFindPermission = OkrRolePermission.findOne;

test.afterEach(() => {
  OkrObjective.findById = originalFindObjective;
  OkrGroup.findOne = originalFindGroup;
  OkrRolePermission.findOne = originalFindPermission;
});

function makeUser(type) {
  const user = {
    _id: new mongoose.Types.ObjectId(),
    roles: ["employee"],
    exec: "no",
    companyRoles: [],
  };

  if (type === "admin") {
    user.roles = ["admin"];
  }

  if (type === "exec") {
    user.exec = "yes";
  }

  if (type === "manager") {
    user.companyRoles = [{ managementLevel: 2 }];
  }

  return user;
}

function runMiddleware(middleware, req) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
    };

    function next(error) {
      resolve({ error, statusCode: res.statusCode });
    }

    try {
      middleware(req, res, next);
    } catch (error) {
      next(error);
    }
  });
}

test("role names match the user access level", () => {
  assert.equal(getRoleName(makeUser("admin")), "Admin");
  assert.equal(getRoleName(makeUser("exec")), "Admin");
  assert.equal(getRoleName(makeUser("manager")), "Manager");
  assert.equal(getRoleName(makeUser("employee")), "Employee");
});

test("only admins and executives can use admin routes", async () => {
  const admin = await runMiddleware(adminOrExec, { user: makeUser("admin") });
  const exec = await runMiddleware(adminOrExec, { user: makeUser("exec") });
  const manager = await runMiddleware(adminOrExec, {
    user: makeUser("manager"),
  });
  const employee = await runMiddleware(adminOrExec, {
    user: makeUser("employee"),
  });

  assert.equal(admin.error, undefined);
  assert.equal(exec.error, undefined);
  assert.equal(manager.statusCode, 403);
  assert.equal(employee.statusCode, 403);
});

test("admins executives and managers can create objectives", async () => {
  OkrRolePermission.findOne = async () => null;

  const admin = await runMiddleware(canCreateObjective, {
    user: makeUser("admin"),
  });
  const exec = await runMiddleware(canCreateObjective, {
    user: makeUser("exec"),
  });
  const manager = await runMiddleware(canCreateObjective, {
    user: makeUser("manager"),
  });

  assert.equal(admin.error, undefined);
  assert.equal(exec.error, undefined);
  assert.equal(manager.error, undefined);
});

test("employees cannot create objectives", async () => {
  OkrGroup.findOne = async () => null;
  OkrRolePermission.findOne = async () => ({
    permissions: ["Create Objectives"],
  });

  const result = await runMiddleware(canCreateObjective, {
    user: makeUser("employee"),
  });

  assert.equal(result.statusCode, 403);
});

test("a group manager can create objectives only for their group", async () => {
  const groupManager = makeUser("employee");
  OkrGroup.findOne = async (query) => {
    if (
      query.name === "Sales" &&
      query.manager.toString() === groupManager._id.toString()
    ) {
      return { name: "Sales" };
    }

    return null;
  };
  OkrRolePermission.findOne = async () => null;

  const ownGroup = await runMiddleware(canCreateObjective, {
    user: groupManager,
    body: { group: "Sales" },
  });
  const otherGroup = await runMiddleware(canCreateObjective, {
    user: groupManager,
    body: { group: "Marketing" },
  });

  assert.equal(ownGroup.error, undefined);
  assert.equal(otherGroup.statusCode, 403);
});

test("saved permissions can stop a manager from creating objectives", async () => {
  OkrRolePermission.findOne = async () => ({ permissions: ["View Reports"] });

  const result = await runMiddleware(canCreateObjective, {
    user: makeUser("manager"),
  });

  assert.equal(result.statusCode, 403);
});

test("admins executives managers and owners can manage objectives", async () => {
  OkrRolePermission.findOne = async () => null;
  const owner = makeUser("employee");
  const objectiveOwner = owner._id;

  OkrObjective.findById = async () => ({ owner: objectiveOwner });

  const admin = await runMiddleware(canManageObjective, {
    user: makeUser("admin"),
    params: { id: new mongoose.Types.ObjectId().toString() },
  });
  const exec = await runMiddleware(canManageObjective, {
    user: makeUser("exec"),
    params: { id: new mongoose.Types.ObjectId().toString() },
  });
  const manager = await runMiddleware(canManageObjective, {
    user: makeUser("manager"),
    params: { id: new mongoose.Types.ObjectId().toString() },
  });
  const ownerResult = await runMiddleware(canManageObjective, {
    user: owner,
    params: { id: new mongoose.Types.ObjectId().toString() },
  });

  assert.equal(admin.error, undefined);
  assert.equal(exec.error, undefined);
  assert.equal(manager.error, undefined);
  assert.equal(ownerResult.error, undefined);
});

test("an unrelated employee cannot manage an objective", async () => {
  const employee = makeUser("employee");
  const otherOwner = new mongoose.Types.ObjectId();

  OkrObjective.findById = async () => ({ owner: otherOwner });
  OkrGroup.findOne = async () => null;
  OkrRolePermission.findOne = async () => ({
    permissions: ["Edit Objectives"],
  });

  const result = await runMiddleware(canManageObjective, {
    user: employee,
    params: { id: new mongoose.Types.ObjectId().toString() },
  });

  assert.equal(result.statusCode, 403);
});

test("a group manager can manage objectives only in their group", async () => {
  const groupManager = makeUser("employee");
  const objectiveId = new mongoose.Types.ObjectId().toString();
  OkrObjective.findById = async () => ({
    owner: new mongoose.Types.ObjectId(),
    group: "Sales",
  });
  OkrGroup.findOne = async (query) => {
    if (
      query.name === "Sales" &&
      query.manager.toString() === groupManager._id.toString()
    ) {
      return { name: "Sales" };
    }

    return null;
  };
  OkrRolePermission.findOne = async () => null;

  const allowed = await runMiddleware(canManageObjective, {
    user: groupManager,
    params: { id: objectiveId },
  });

  OkrObjective.findById = async () => ({
    owner: new mongoose.Types.ObjectId(),
    group: "Marketing",
  });
  const rejected = await runMiddleware(canManageObjective, {
    user: groupManager,
    params: { id: objectiveId },
  });

  assert.equal(allowed.error, undefined);
  assert.equal(rejected.statusCode, 403);
});

test("saved manager permissions also apply to group managers", async () => {
  const groupManager = makeUser("employee");
  OkrObjective.findById = async () => ({
    owner: new mongoose.Types.ObjectId(),
    group: "Sales",
  });
  OkrGroup.findOne = async () => ({ name: "Sales" });
  OkrRolePermission.findOne = async () => ({ permissions: ["View Reports"] });

  const result = await runMiddleware(canManageObjective, {
    user: groupManager,
    params: { id: new mongoose.Types.ObjectId().toString() },
  });

  assert.equal(result.statusCode, 403);
});

test("a group manager cannot move an objective to another group", async () => {
  const groupManager = makeUser("employee");
  OkrObjective.findById = async () => ({
    owner: new mongoose.Types.ObjectId(),
    group: "Sales",
  });
  OkrGroup.findOne = async (query) => {
    if (query.name === "Sales") {
      return { name: "Sales" };
    }

    return null;
  };
  OkrRolePermission.findOne = async () => null;

  const result = await runMiddleware(canManageObjective, {
    user: groupManager,
    params: { id: new mongoose.Types.ObjectId().toString() },
    body: { group: "Marketing" },
  });

  assert.equal(result.statusCode, 403);
});

test("saved permissions can stop a manager from managing an objective", async () => {
  OkrObjective.findById = async () => ({
    owner: new mongoose.Types.ObjectId(),
  });
  OkrRolePermission.findOne = async () => ({ permissions: ["View Reports"] });

  const result = await runMiddleware(canManageObjective, {
    user: makeUser("manager"),
    params: { id: new mongoose.Types.ObjectId().toString() },
  });

  assert.equal(result.statusCode, 403);
});

test("invalid and missing objectives return 404", async () => {
  OkrObjective.findById = async () => null;

  const invalid = await runMiddleware(canManageObjective, {
    user: makeUser("admin"),
    params: { id: "wrong-id" },
  });
  const missing = await runMiddleware(canManageObjective, {
    user: makeUser("admin"),
    params: { id: new mongoose.Types.ObjectId().toString() },
  });

  assert.equal(invalid.statusCode, 404);
  assert.equal(missing.statusCode, 404);
});

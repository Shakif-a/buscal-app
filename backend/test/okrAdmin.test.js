const test = require("node:test");
const assert = require("node:assert/strict");
const writes = require("../services/okrWrites");
const originalTransaction = writes.transaction;
test.beforeEach(() => {
  writes.transaction = async (work) => work(undefined);
});
test.afterEach(() => {
  writes.transaction = originalTransaction;
});
const mongoose = require("mongoose");
const OkrGroup = require("../models/okrGroupModel");
const OkrRolePermission = require("../models/okrRolePermissionModel");
const User = require("../models/userModel");
const {
  createGroup,
  updateGroup,
  updateRolePermissions,
  assignRole,
  deleteRole,
} = require("../controllers/okrAdminController");

const originalCreateGroup = OkrGroup.create;
const originalFindGroup = OkrGroup.findOne;
const originalFindGroupById = OkrGroup.findById;
const originalFindUserById = User.findById;
const originalFindPermission = OkrRolePermission.findOneAndUpdate;
const originalDeletePermission = OkrRolePermission.deleteOne;
const originalUserExists = User.exists;
const originalUpdateUsers = User.updateMany;

test.afterEach(() => {
  OkrGroup.create = originalCreateGroup;
  OkrGroup.findOne = originalFindGroup;
  OkrGroup.findById = originalFindGroupById;
  User.findById = originalFindUserById;
  OkrRolePermission.findOneAndUpdate = originalFindPermission;
  OkrRolePermission.deleteOne = originalDeletePermission;
  User.exists = originalUserExists;
  User.updateMany = originalUpdateUsers;
});

function runHandler(handler, req) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        resolve({ body, statusCode: this.statusCode });
      },
    };

    function next(error) {
      resolve({ error, statusCode: error?.statusCode || res.statusCode });
    }

    try {
      handler(req, res, next);
    } catch (error) {
      next(error);
    }
  });
}

test("a group needs a name", async () => {
  const result = await runHandler(createGroup, {
    body: {},
    user: { _id: new mongoose.Types.ObjectId() },
  });

  assert.equal(result.statusCode, 400);
});

test("a new group can be created", async () => {
  OkrGroup.findOne = async () => null;
  OkrGroup.create = async (data) => data;

  const result = await runHandler(createGroup, {
    body: { name: "Sales" },
  });

  assert.equal(result.statusCode, 201);
  assert.equal(result.body.name, "Sales");
});

test("a duplicate group name is rejected", async () => {
  OkrGroup.findOne = async () => ({ name: "Sales" });

  const result = await runHandler(createGroup, {
    body: { name: "Sales" },
    user: { _id: new mongoose.Types.ObjectId() },
  });

  assert.equal(result.statusCode, 400);
});

test("a group can receive one manager and unique members", async () => {
  const groupId = new mongoose.Types.ObjectId();
  const managerId = new mongoose.Types.ObjectId();
  const memberId = new mongoose.Types.ObjectId();
  let saved = false;

  const group = {
    name: "Sales",
    manager: null,
    members: [],
    async save() {
      saved = true;
    },
    async populate() {},
  };

  OkrGroup.findById = async () => group;
  User.findById = async () => ({ _id: managerId });

  const result = await runHandler(updateGroup, {
    params: { id: groupId.toString() },
    body: {
      manager: managerId.toString(),
      members: [memberId.toString(), memberId.toString()],
    },
  });

  assert.equal(result.statusCode, 200);
  assert.equal(saved, true);
  assert.equal(group.manager, managerId.toString());
  assert.equal(group.members.length, 1);
});

test("an invalid group id returns 404", async () => {
  const result = await runHandler(updateGroup, {
    params: { id: "wrong-id" },
    body: { name: "Sales" },
  });

  assert.equal(result.statusCode, 404);
});

test("group members must be a list", async () => {
  const group = {
    async save() {},
    async populate() {},
  };

  OkrGroup.findById = async () => group;

  const result = await runHandler(updateGroup, {
    params: { id: new mongoose.Types.ObjectId().toString() },
    body: { members: "wrong-value" },
  });

  assert.equal(result.statusCode, 400);
});

test("a group manager must be an existing user", async () => {
  const group = {
    async save() {},
    async populate() {},
  };

  OkrGroup.findById = async () => group;
  User.findById = async () => null;

  const result = await runHandler(updateGroup, {
    params: { id: new mongoose.Types.ObjectId().toString() },
    body: { manager: new mongoose.Types.ObjectId().toString() },
  });

  assert.equal(result.statusCode, 400);
});

test("unknown permissions are rejected", async () => {
  const result = await runHandler(updateRolePermissions, {
    params: { role: "Manager" },
    body: { permissions: ["Unknown Permission"] },
  });

  assert.equal(result.statusCode, 400);
});

test("valid role permissions are saved without duplicates", async () => {
  OkrRolePermission.findOneAndUpdate = async (query, data) => ({
    role: query.role,
    permissions: data.permissions,
  });

  const result = await runHandler(updateRolePermissions, {
    params: { role: "Manager" },
    body: {
      permissions: ["Edit Objectives", "Edit Objectives", "View Reports"],
    },
  });

  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body.permissions, [
    "Edit Objectives",
    "View Reports",
  ]);
});

test("the Admin role cannot lose Manage Roles, Manage Users or View Reports", async () => {
  let saved = false;
  OkrRolePermission.findOneAndUpdate = async (query, data) => {
    saved = true;
    return { role: query.role, permissions: data.permissions };
  };

  for (const permissions of [
    [],
    ["Manage Roles"],
    ["View Reports", "Manage Users"],
    ["Manage Roles", "View Reports"],
  ]) {
    const result = await runHandler(updateRolePermissions, {
      params: { role: "Admin" },
      body: { permissions },
    });
    assert.equal(result.statusCode, 400);
  }
  assert.equal(saved, false);

  const result = await runHandler(updateRolePermissions, {
    params: { role: "Admin" },
    body: {
      permissions: ["Manage Roles", "Manage Users", "View Reports", "View All OKRs"],
    },
  });
  assert.equal(result.statusCode, 200);
});

for (const account of [{ roles: ["admin"] }, { roles: [], exec: "yes" }]) {
  test("admins and executives cannot be given a custom role", async () => {
    const user = {
      _id: new mongoose.Types.ObjectId(),
      ...account,
      okrRole: null,
      save: async () => {
        throw new Error("should not save");
      },
    };
    OkrRolePermission.findOneAndUpdate = async () => ({ role: "Reviewer" });
    User.findById = async () => user;

    const result = await runHandler(assignRole, {
      params: { id: user._id.toString() },
      body: { role: "Reviewer" },
    });

    assert.equal(result.statusCode, 400);
    assert.equal(user.okrRole, null);
  });
}

test("a stale custom role on an admin does not block deleting it", async () => {
  let existsQuery;
  let clearedQuery;
  let deleted = false;
  OkrRolePermission.findOneAndUpdate = async () => ({
    _id: "role-1",
    role: "Reviewer",
  });
  User.exists = (query) => {
    existsQuery = query;
    return { session: async () => null };
  };
  User.updateMany = async (query) => {
    clearedQuery = query;
  };
  OkrRolePermission.deleteOne = async () => {
    deleted = true;
  };

  const result = await runHandler(deleteRole, {
    params: { role: "Reviewer" },
  });

  assert.equal(result.statusCode, 200);
  assert.deepEqual(existsQuery, {
    okrRole: "Reviewer",
    roles: { $ne: "admin" },
    exec: { $ne: "yes" },
  });
  assert.deepEqual(clearedQuery, { okrRole: "Reviewer" });
  assert.equal(deleted, true);
});

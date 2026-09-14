const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, rm, writeFile } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const net = require("node:net");
const express = require("express");
const mongoose = require("mongoose");
mongoose.set("autoCreate", false);
mongoose.set("autoIndex", false);
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../../models/userModel");
const Objective = require("../../models/okrObjectiveModel");
const KeyResult = require("../../models/okrKeyResultModel");
const Group = require("../../models/okrGroupModel");
const Permission = require("../../models/okrRolePermissionModel");
const Calendar = require("../../models/calendarEntryModel");
const Scheduler = require("../../models/schedulerModel");
const { errorHandler } = require("../../middleware/errorMiddleware");
const {
  hasRolePermission,
  getRoleName,
} = require("../../middleware/adminPermissions");
const { canUserManageObjective } = require("../../middleware/okrPermissions");
let mongo, directory, server, base, users, objective, sales;
const secret = "isolated-backend-investigation-only";
const oldSecret = process.env.JWT_SECRET;
const routeCoverage = {};
const id = () => new mongoose.Types.ObjectId().toString();

async function unusedPort() {
  const listener = net.createServer();
  await new Promise((resolve, reject) => {
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", resolve);
  });
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  return port;
}

test.before(async () => {
  directory = await mkdtemp(join(tmpdir(), "buscal-investigation-"));
  const port = await unusedPort();
  mongo = spawn(
    process.env.MONGOD_BINARY || "mongod",
    [
      "--dbpath",
      directory,
      "--port",
      String(port),
      "--bind_ip",
      "127.0.0.1",
      "--quiet",
      "--replSet",
      "buscalTest",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Temporary MongoDB did not start")),
      15000,
    );
    mongo.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    mongo.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error("Temporary MongoDB exited: " + code));
    });
    mongo.stdout.on("data", (data) => {
      if (data.toString().includes("Waiting for connections")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    mongo.stderr.on("data", () => {});
  });
  await mongoose.connect(
    "mongodb://127.0.0.1:" +
      port +
      "/buscal_investigation?directConnection=true",
  );
  await mongoose.connection.db.admin().command({
    replSetInitiate: {
      _id: "buscalTest",
      members: [{ _id: 0, host: "127.0.0.1:" + port }],
    },
  });
  for (let attempt = 0; attempt < 100; attempt++) {
    const state = await mongoose.connection.db.admin().command({ hello: 1 });
    if (state.isWritablePrimary) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  for (const model of [
    User,
    Objective,
    Group,
    Permission,
    KeyResult,
    Calendar,
    Scheduler,
  ]) {
    await model.createCollection();
    await model.createIndexes();
  }
  process.env.JWT_SECRET = secret;
  const app = express();
  app.use((req, res, next) => {
    res.on("finish", () => {
      const prefix = [
        "/api/okr/admin",
        "/api/okrTracker",
        "/api/okr",
        "/api/users",
        "/api/calendar",
      ].find((path) => req.originalUrl.startsWith(path));
      const route =
        req.method +
        " " +
        (req.route
          ? prefix + req.route.path
          : req.originalUrl.replace(/[a-f0-9]{24}/g, ":id"));
      routeCoverage[route] = routeCoverage[route] || {};
      routeCoverage[route][res.statusCode] =
        (routeCoverage[route][res.statusCode] || 0) + 1;
    });
    next();
  });
  app.use(express.json());
  app.use("/api/users", require("../../routes/userRoutes"));
  app.use("/api/calendar", require("../../routes/calendarRoutes"));
  app.use("/api/okr/admin", require("../../routes/okrAdminRoutes"));
  app.use("/api/okr", require("../../routes/okrRoutes"));
  app.use("/api/okrTracker", require("../../routes/okrRoutes"));
  app.use(errorHandler);
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  base = "http://127.0.0.1:" + server.address().port;
});

test.after(async () => {
  if (process.env.ROUTE_COVERAGE_FILE)
    await writeFile(
      process.env.ROUTE_COVERAGE_FILE,
      JSON.stringify(routeCoverage, null, 2) + "\n",
    );
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  await mongoose.disconnect();
  if (mongo && mongo.exitCode === null) {
    const stopped = new Promise((resolve) => mongo.once("exit", resolve));
    mongo.kill("SIGTERM");
    await stopped;
  }
  if (directory) await rm(directory, { recursive: true, force: true });
  if (oldSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = oldSecret;
});

test.beforeEach(async () => {
  for (const model of [
    User,
    Objective,
    KeyResult,
    Group,
    Permission,
    Calendar,
    Scheduler,
  ])
    await model.deleteMany({});
  users = {};
  for (const role of [
    "admin",
    "exec",
    "manager",
    "employee",
    "owner",
    "groupManager",
  ]) {
    users[role] = await User.create({
      firstName: role,
      lastName: "Test",
      email: role + "@example.test",
      password: "test-hash",
      roles: role === "admin" ? ["admin"] : ["employee"],
      exec: role === "exec" ? "yes" : "no",
      companyRoles:
        role === "manager"
          ? [{ role: "Team Manager", managementLevel: 2 }]
          : [],
    });
  }
  sales = await Group.create({
    name: "Sales",
    manager: users.groupManager._id,
    members: [users.employee._id],
  });
  await Group.create({ name: "Marketing" });
  objective = await Objective.create({
    title: "Original",
    owner: users.owner._id,
    group: "Sales",
    dueDate: "2026-12-01",
  });
});

async function request(method, path, body, role = "admin", authorization) {
  const headers = { "Content-Type": "application/json" };
  if (authorization !== null)
    headers.Authorization =
      authorization === undefined
        ? "Bearer " + jwt.sign({ id: users[role].id }, secret)
        : authorization;
  const response = await fetch(base + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (response.status === 500)
    console.error("HTTP failure:", method, path, data.message);
  return { status: response.status, body: data };
}
function objectiveBody(extra = {}) {
  return {
    title: "New",
    owner: users.owner.id,
    dueDate: "2026-12-01",
    group: "Sales",
    ...extra,
  };
}
function keyBody(extra = {}) {
  return { title: "Result", weight: 25, dueDate: "2026-11-01", ...extra };
}
const pathForObjective = () => "/api/okr/objectives/" + objective.id;

test("array request bodies cannot become database update pipelines or silent admin no-ops", async () => {
  for (const [method, path] of [
    ["PUT", "/api/users/user/" + users.owner.id],
    ["PUT", "/api/users/userOne/" + users.owner.id],
    ["PUT", "/api/okr/admin/groups/" + sales.id],
    ["POST", "/api/okr/admin/roles"],
    ["PUT", pathForObjective()],
    ["POST", pathForObjective() + "/key-results"],
  ])
    assert.equal(
      (
        await request(method, path, [
          { $set: { password: "plaintext", title: "Bypass" } },
        ])
      ).status,
      400,
    );
  assert.equal((await User.findById(users.owner.id)).password, "test-hash");
  assert.equal((await Objective.findById(objective.id)).title, "Original");
});

test("reminder processing preserves concurrent calendar changes in MongoDB", async () => {
  const { processSchedules } = require("../../services/reminderService");
  await Calendar.create({
    title: "First",
    category: "general",
    endTime: "2026-12-01",
    completionStatus: "completed",
  });
  const read = Calendar.findById;
  let nextEntry;
  Calendar.findById = async function (...args) {
    const entry = await read.apply(this, args);
    nextEntry = await Calendar.create({
      title: "Arriving during processing",
      category: "general",
      endTime: "2026-12-01",
      completionStatus: "completed",
    });
    return entry;
  };
  try {
    await processSchedules();
  } finally {
    Calendar.findById = read;
  }
  const queue = await Scheduler.findOne({ name: "calendarschedule" });
  assert.deepEqual(queue.toschedule.map(String), [nextEntry.id]);
});

test("reminder read failure restores its database batch for retry", async () => {
  const { processSchedules } = require("../../services/reminderService");
  const entry = await Calendar.create({
    title: "First",
    category: "general",
    endTime: "2026-12-01",
    completionStatus: "completed",
  });
  const read = Calendar.findById;
  Calendar.findById = async () => {
    throw new Error("Injected reminder read failure");
  };
  try {
    await assert.rejects(processSchedules(), /Injected reminder read failure/);
  } finally {
    Calendar.findById = read;
  }
  const queue = await Scheduler.findOne({ name: "calendarschedule" });
  assert.deepEqual(queue.toschedule.map(String), [entry.id]);
});

test("calendar write routes cannot independently change an OKR calendar entry", async () => {
  const created = await request("POST", "/api/okr/objectives", objectiveBody());
  assert.equal(created.status, 201);
  const calendarId = created.body.calendarEntry;
  for (const role of ["admin", "employee", "owner"]) {
    for (const [method, path] of [
      ["PUT", "/entries/" + calendarId],
      ["PUT", "/entries/" + calendarId + "/reassign"],
      ["PUT", "/entries/recur/" + calendarId],
      ["DELETE", "/entries/" + calendarId],
      ["DELETE", "/entries/recur/" + calendarId],
    ])
      assert.equal(
        (
          await request(
            method,
            "/api/calendar" + path,
            { title: "Bypass", category: "general", userAssigned: [] },
            role,
          )
        ).status,
        409,
      );
  }
  assert.equal((await Calendar.findById(calendarId)).title, "New");
  assert.equal((await Objective.findById(created.body._id)).title, "New");
  assert.equal(
    (
      await request("POST", "/api/calendar/entries", {
        title: "Fake",
        category: "OKR Objective",
        endTime: "2026-12-01",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(
        "PUT",
        "/api/calendar/entries/" + calendarId,
        {},
        "admin",
        null,
      )
    ).status,
    401,
  );
});

test("legacy OKR calendar entries and mixed recurring series remain protected", async () => {
  const original = await Calendar.create({
    title: "General",
    category: "general",
    endTime: "2026-12-01",
  });
  const legacy = await Calendar.create({
    title: "Legacy",
    category: "OKR Objective",
    originalEntry: original._id,
    endTime: "2026-12-01",
  });
  assert.equal(
    (await request("DELETE", "/api/calendar/entries/" + legacy.id, {})).status,
    409,
  );
  assert.equal(
    (await request("DELETE", "/api/calendar/entries/recur/" + original.id, {}))
      .status,
    409,
  );
  assert.equal(await Calendar.countDocuments(), 2);
});

test("calendar guard validates IDs and permits ordinary calendar requests", async () => {
  for (const entryId of ["bad", "000000000000000000000000"])
    assert.equal(
      (await request("PUT", "/api/calendar/entries/" + entryId, {})).status,
      404,
    );
  const entry = await Calendar.create({
    title: "Ordinary",
    category: "general",
    endTime: "2026-12-01",
  });
  const response = await request("PUT", "/api/calendar/entries/" + entry.id, {
    title: "Updated",
  });
  assert.equal(response.status, 404);
  assert.equal(response.body.error, "Calendar history not found.");
});

require("./roleScenarios")({
  test,
  assert,
  request,
  users: () => users,
  objectiveBody,
  pathForObjective,
  Group,
  Permission,
  User,
  Objective,
  sales: () => sales,
});

for (const role of [
  "admin",
  "exec",
  "manager",
  "employee",
  "owner",
  "groupManager",
]) {
  test(
    "role matrix: " + role + " create/read/edit/delete/key result",
    async () => {
      const canCreate = ["admin", "exec", "manager", "groupManager"].includes(
        role,
      );
      const canManage = role !== "employee";
      assert.equal(
        (await request("POST", "/api/okr/objectives", objectiveBody(), role))
          .status,
        canCreate ? 201 : 403,
      );
      const detail = await request("GET", pathForObjective(), undefined, role);
      assert.equal(detail.status, 200);
      assert.equal(detail.body.objective.canManage, canManage);
      assert.equal(
        (await request("PUT", pathForObjective(), { title: "Edited" }, role))
          .status,
        canManage ? 200 : 403,
      );
      assert.equal(
        (
          await request(
            "POST",
            pathForObjective() + "/key-results",
            keyBody(),
            role,
          )
        ).status,
        canManage && role !== "owner" ? 201 : 403,
      );
      assert.equal(
        (await request("DELETE", pathForObjective(), undefined, role)).status,
        canManage ? 200 : 403,
      );
      assert.equal(
        await Objective.countDocuments({ _id: objective._id }),
        canManage ? 0 : 1,
      );
      assert.equal(
        await KeyResult.countDocuments({ objective: objective._id }),
        0,
      );
    },
  );
  test("admin route matrix: " + role, async () => {
    const allowed = ["admin", "exec"].includes(role);
    for (const route of ["users", "groups", "permissions"])
      assert.equal(
        (await request("GET", "/api/okr/admin/" + route, undefined, role))
          .status,
        allowed ? 200 : 403,
      );
    assert.equal(
      (await request("POST", "/api/okr/admin/groups", { name: "New" }, role))
        .status,
      allowed ? 201 : 403,
    );
    assert.equal(
      (
        await request(
          "PUT",
          "/api/okr/admin/groups/" + sales.id,
          { members: [] },
          role,
        )
      ).status,
      allowed ? 200 : 403,
    );
    assert.equal(
      (
        await request(
          "PUT",
          "/api/okr/admin/permissions/Employee",
          { permissions: [] },
          role,
        )
      ).status,
      allowed ? 200 : 403,
    );
  });
}
for (const role of ["admin", "exec", "manager", "groupManager"]) {
  test("saved Create/Edit overrides deny non-owner " + role, async () => {
    await Permission.create({
      role: ["admin", "exec"].includes(role) ? "Admin" : "Manager",
      permissions: [],
    });
    assert.equal(
      (await request("POST", "/api/okr/objectives", objectiveBody(), role))
        .status,
      403,
    );
    assert.equal(
      (await request("PUT", pathForObjective(), { title: "Forbidden" }, role))
        .status,
      403,
    );
    assert.equal(
      (await request("DELETE", pathForObjective(), undefined, role)).status,
      403,
    );
    assert.equal(
      (await request("GET", pathForObjective(), undefined, role)).body.objective
        .canManage,
      false,
    );
    assert.equal((await Objective.findById(objective._id)).title, "Original");
  });
}
test("documented owner exception survives empty Employee permissions", async () => {
  await Permission.create({ role: "Employee", permissions: [] });
  assert.equal(
    (await request("PUT", pathForObjective(), { title: "Owner edit" }, "owner"))
      .status,
    200,
  );
});
test("documented Employee grants do not bypass group scope", async () => {
  await Permission.create({
    role: "Employee",
    permissions: ["Create Objectives", "Edit Objectives"],
  });
  assert.equal(
    (await request("POST", "/api/okr/objectives", objectiveBody(), "employee"))
      .status,
    403,
  );
  assert.equal(
    (await request("PUT", pathForObjective(), { title: "No" }, "employee"))
      .status,
    403,
  );
});
for (const [permission, method, path] of [
  ["Manage Groups", "POST", "/api/okr/admin/groups"],
  ["Manage Users", "DELETE", "/api/users/user/"],
  ["Create Key Results", "POST", "/api/okr/objectives/"],
]) {
  test("saved permission is enforced: " + permission, async () => {
    await Permission.create({
      role: "Admin",
      permissions: ["Edit Objectives"],
    });
    let url = path;
    if (permission === "Manage Users") url += users.employee.id;
    if (permission === "Create Key Results")
      url += objective.id + "/key-results";
    const body =
      method === "POST"
        ? permission === "Manage Groups"
          ? { name: "Forbidden" }
          : keyBody()
        : undefined;
    assert.equal((await request(method, url, body)).status, 403);
    assert.equal(await KeyResult.countDocuments(), 0);
  });
}
test("Manage Roles revocation blocks administration until database recovery", async () => {
  await Permission.create({ role: "Admin", permissions: [] });
  const response = await request("GET", "/api/okr/admin/permissions");
  assert.equal(response.status, 403);
  assert.equal(
    (await request("POST", "/api/okr/admin/roles", { role: "Reviewer" }))
      .status,
    403,
  );
  await Permission.updateOne(
    { role: "Admin" },
    { $addToSet: { permissions: "Manage Roles" } },
  );
  assert.equal(
    (await request("GET", "/api/okr/admin/permissions")).status,
    200,
  );
});
test("permission reads hide old role settings which cannot take effect", async () => {
  await Permission.create({
    role: "Manager",
    permissions: ["Edit Objectives", "Manage Users"],
  });
  await Permission.create({
    role: "Employee",
    permissions: ["Create Objectives", "View Reports"],
  });
  const response = await request("GET", "/api/okr/admin/permissions");
  assert.equal(response.status, 200);
  assert.deepEqual(
    response.body.find((role) => role.role === "Manager").permissions,
    ["Edit Objectives"],
  );
  assert.deepEqual(
    response.body.find((role) => role.role === "Employee").permissions,
    ["View Reports"],
  );
});
test("permissions which cannot take effect are rejected", async () => {
  assert.equal(
    (
      await request("PUT", "/api/okr/admin/permissions/Manager", {
        permissions: ["Manage Users"],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("PUT", "/api/okr/admin/permissions/Employee", {
        permissions: ["Create Objectives"],
      })
    ).status,
    400,
  );
});
for (const [label, authorization] of [
  ["missing", null],
  ["invalid", "Bearer invalid"],
  ["wrong scheme", "Basic value"],
  ["empty", "Bearer "],
]) {
  test("authentication rejects " + label, async () => {
    for (const [method, path, body] of [
      ["GET", "/api/okr/objectives"],
      ["POST", "/api/okr/objectives", {}],
      ["PUT", pathForObjective(), {}],
      ["DELETE", pathForObjective()],
      ["POST", pathForObjective() + "/key-results", {}],
      ["GET", "/api/okr/admin/users"],
      ["PUT", "/api/okr/admin/permissions/Admin", {}],
    ])
      assert.equal(
        (await request(method, path, body, "admin", authorization)).status,
        401,
      );
  });
}
for (const tokenType of [
  "expired",
  "unknown user",
  "malformed subject",
  "missing subject",
]) {
  test("authentication rejects signed token: " + tokenType, async () => {
    let payload = { id: users.admin.id };
    if (tokenType === "expired") payload.exp = 1;
    if (tokenType === "unknown user") payload.id = id();
    if (tokenType === "malformed subject") payload.id = { $ne: null };
    if (tokenType === "missing subject") payload = {};
    assert.equal(
      (
        await request(
          "GET",
          "/api/okr/objectives",
          undefined,
          "admin",
          "Bearer " + jwt.sign(payload, secret),
        )
      ).status,
      401,
    );
  });
}
for (const badId of ["bad-id", "abcdefghijkl", "000000000000000000000000"]) {
  for (const method of ["GET", "PUT", "DELETE"])
    test(
      method + " objective rejects missing/malformed ID " + badId,
      async () => {
        assert.equal(
          (
            await request(
              method,
              "/api/okr/objectives/" + badId,
              method === "PUT" ? { title: "Edit" } : undefined,
            )
          ).status,
          404,
        );
      },
    );
}
for (const [label, body] of [
  ["blank title", { title: " " }],
  ["object title", { title: {} }],
  ["number title", { title: 42 }],
  ["bad owner", { owner: "bad-id" }],
  ["missing owner", { owner: "000000000000000000000000" }],
  ["invalid date", { dueDate: "wrong" }],
  ["array date", { dueDate: [] }],
  ["bad type", { commitmentType: "wrong" }],
  ["object group", { group: { $ne: null } }],
  ["object description", { description: {} }],
]) {
  test("create validation: " + label, async () => {
    assert.equal(
      (await request("POST", "/api/okr/objectives", objectiveBody(body)))
        .status,
      400,
    );
    assert.equal(await Objective.countDocuments(), 1);
    assert.equal(await Calendar.countDocuments(), 0);
  });
}
for (const [label, body] of [
  ["blank title", { title: " " }],
  ["object description", { description: {} }],
  ["bad owner", { owner: "bad-id" }],
  ["missing owner", { owner: "000000000000000000000000" }],
  ["invalid date", { dueDate: "wrong" }],
  ["array date", { dueDate: [] }],
  ["invalid type", { type: "wrong" }],
  ["blank group", { group: " " }],
  ["object group", { group: {} }],
]) {
  test("edit validation leaves database unchanged: " + label, async () => {
    assert.equal(
      (
        await request("PUT", pathForObjective(), {
          title: "Must not save",
          ...body,
        })
      ).status,
      400,
    );
    assert.equal((await Objective.findById(objective._id)).title, "Original");
  });
}
for (const body of [[], null, "text"])
  test("malformed JSON body " + JSON.stringify(body), async () => {
    assert.equal(
      (await request("POST", "/api/okr/objectives", body)).status,
      400,
    );
  });
test("JSON syntax errors return 400", async () => {
  const response = await fetch(base + "/api/okr/objectives", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });
  assert.equal(response.status, 400);
});
test("orphaned populated owner does not break objective list or detail", async () => {
  await User.deleteOne({ _id: users.owner._id });
  assert.equal((await request("GET", "/api/okr/objectives")).status, 200);
  const detail = await request("GET", pathForObjective());
  assert.equal(detail.status, 200);
  assert.equal(detail.body.objective.canManage, true);
});
test("group manager can create with surrounding group whitespace", async () => {
  assert.equal(
    (
      await request(
        "POST",
        "/api/okr/objectives",
        objectiveBody({ group: " Sales " }),
        "groupManager",
      )
    ).status,
    201,
  );
  assert.equal(await Objective.countDocuments({ group: "Sales" }), 2);
});
test("group query operators cannot be used to create objectives", async () => {
  assert.equal(
    (
      await request(
        "POST",
        "/api/okr/objectives",
        objectiveBody({ group: { $ne: "Marketing" } }),
        "groupManager",
      )
    ).status,
    400,
  );
});
test("objective creation rejects a group which does not exist", async () => {
  assert.equal(
    (
      await request(
        "POST",
        "/api/okr/objectives",
        objectiveBody({ group: "Missing Group" }),
      )
    ).status,
    400,
  );
  assert.equal(await Objective.countDocuments(), 1);
  assert.equal(await Calendar.countDocuments(), 0);
});
test("objective move rejects a group which does not exist", async () => {
  assert.equal(
    (
      await request("PUT", pathForObjective(), {
        group: "Missing Group",
      })
    ).status,
    400,
  );
  assert.equal((await Objective.findById(objective._id)).group, "Sales");
});
test("group manager cannot move to an unmanaged group but can move to another managed group", async () => {
  assert.equal(
    (
      await request(
        "PUT",
        pathForObjective(),
        { group: "Marketing" },
        "groupManager",
      )
    ).status,
    403,
  );
  assert.equal((await Objective.findById(objective._id)).group, "Sales");
  await Group.updateOne(
    { name: "Marketing" },
    { manager: users.groupManager._id },
  );
  assert.equal(
    (
      await request(
        "PUT",
        pathForObjective(),
        { group: " Marketing " },
        "groupManager",
      )
    ).status,
    200,
  );
});
test("owner can move own objective under documented owner exception", async () => {
  assert.equal(
    (await request("PUT", pathForObjective(), { group: "Marketing" }, "owner"))
      .status,
    200,
  );
});
test("renaming a group with objectives cannot silently break manager access", async () => {
  assert.equal(
    (
      await request("PUT", "/api/okr/admin/groups/" + sales.id, {
        name: "Renamed",
      })
    ).status,
    200,
  );
  assert.equal((await Group.findById(sales._id)).name, "Renamed");
  assert.equal((await Objective.findById(objective._id)).group, "Renamed");
  assert.equal(
    (await request("GET", pathForObjective(), undefined, "groupManager")).body
      .objective.canManage,
    true,
  );
});
test("unused group can be renamed", async () => {
  const group = await Group.findOne({ name: "Marketing" });
  assert.equal(
    (
      await request("PUT", "/api/okr/admin/groups/" + group.id, {
        name: "Renamed",
      })
    ).status,
    200,
  );
});
test("duplicate groups, including concurrent requests, return client errors", async () => {
  assert.equal(
    (await request("POST", "/api/okr/admin/groups", { name: " Sales " }))
      .status,
    400,
  );
  const results = await Promise.all(
    Array.from({ length: 5 }, () =>
      request("POST", "/api/okr/admin/groups", { name: "Concurrent" }),
    ),
  );
  assert.equal(results.filter((result) => result.status === 201).length, 1);
  assert.ok(results.every((result) => [201, 400, 409].includes(result.status)));
  assert.equal(await Group.countDocuments({ name: "Concurrent" }), 1);
});
for (const body of [
  { manager: "bad-id" },
  { manager: "000000000000000000000000" },
  { manager: false },
  { members: "bad" },
  { members: ["000000000000000000000000"] },
  { members: [{}] },
  { name: "Marketing" },
  { name: {} },
])
  test("group rejects invalid update " + JSON.stringify(body), async () => {
    assert.equal(
      (await request("PUT", "/api/okr/admin/groups/" + sales.id, body)).status,
      400,
    );
    assert.equal((await Group.findById(sales._id)).name, "Sales");
  });
test("group assignment saves unique members and permits manager removal", async () => {
  const response = await request("PUT", "/api/okr/admin/groups/" + sales.id, {
    manager: null,
    members: [users.owner.id, users.owner.id],
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.manager, null);
  assert.equal(response.body.members.length, 1);
  assert.equal((await Group.findById(sales._id)).members.length, 1);
});
for (const role of ["Unknown", "toString", "constructor", "__proto__"])
  test("invalid permission role: " + role, async () => {
    assert.equal(
      (
        await request("PUT", "/api/okr/admin/permissions/" + role, {
          permissions: [],
        })
      ).status,
      400,
    );
    assert.equal(await Permission.countDocuments(), 0);
  });
for (const permissions of ["wrong", null, [42], [{}], ["Unknown"]])
  test(
    "invalid permissions payload " + JSON.stringify(permissions),
    async () => {
      assert.equal(
        (
          await request("PUT", "/api/okr/admin/permissions/Manager", {
            permissions,
          })
        ).status,
        400,
      );
      assert.equal(await Permission.countDocuments(), 0);
    },
  );
test("permission defaults, replacement, deduplication and persistence", async () => {
  assert.equal(await hasRolePermission("Manager", "Create Objectives"), true);
  assert.equal(
    (
      await request("PUT", "/api/okr/admin/permissions/Manager", {
        permissions: ["Edit Objectives", "Edit Objectives"],
      })
    ).status,
    200,
  );
  assert.deepEqual(
    (await Permission.findOne({ role: "Manager" })).permissions,
    ["Edit Objectives"],
  );
  assert.equal(await hasRolePermission("Manager", "Create Objectives"), false);
  assert.equal(await hasRolePermission("Manager", "Edit Objectives"), true);
});
test("permission helper safely denies unknown roles", async () => {
  assert.equal(await hasRolePermission("Unknown", "Create Objectives"), false);
});
test("role helper checks all company roles and respects admin precedence", () => {
  assert.equal(
    getRoleName({
      roles: [],
      companyRoles: [{ managementLevel: 5 }, { managementLevel: 1 }],
    }),
    "Manager",
  );
  assert.equal(
    getRoleName({ roles: ["admin"], companyRoles: [{ managementLevel: 2 }] }),
    "Admin",
  );
});
for (const [label, body] of [
  ["blank title", { title: " " }],
  ["invalid weight", { weight: "wrong" }],
  ["negative weight", { weight: -1 }],
  ["zero weight", { weight: 0 }],
  ["boolean weight", { weight: true }],
  ["array weight", { weight: [25] }],
  ["missing assignee", { assignedTo: "000000000000000000000000" }],
  ["bad assignee", { assignedTo: "bad" }],
  ["bad date", { dueDate: "bad" }],
])
  test("key result validation: " + label, async () => {
    assert.equal(
      (
        await request(
          "POST",
          pathForObjective() + "/key-results",
          keyBody(body),
        )
      ).status,
      400,
    );
    assert.equal(await KeyResult.countDocuments(), 0);
  });
test("key result weight cap, weighted progress, alias and cascade persistence", async () => {
  await KeyResult.create({
    objective: objective._id,
    title: "Existing",
    weight: 75,
    progress: 40,
    dueDate: "2026-12-01",
  });
  assert.equal(
    (
      await request(
        "POST",
        pathForObjective() + "/key-results",
        keyBody({ weight: 26 }),
      )
    ).status,
    400,
  );
  assert.equal(
    (await request("POST", pathForObjective() + "/key-results", keyBody()))
      .status,
    201,
  );
  const response = await request(
    "GET",
    "/api/okrTracker/objectives/" + objective.id,
  );
  assert.equal(response.body.objective.progress, 30);
  assert.equal(response.body.keyResults[0].approved, false);
  assert.equal((await request("DELETE", pathForObjective())).status, 200);
  assert.equal(await KeyResult.countDocuments(), 0);
});
test("objective creation persists calendar entry and scheduler hook", async () => {
  assert.equal(
    (await request("POST", "/api/okr/objectives", objectiveBody())).status,
    201,
  );
  const calendar = await Calendar.findOne();
  assert.equal(calendar.userOwner.toString(), users.admin.id);
  assert.equal(calendar.userAssigned[0].toString(), users.owner.id);
  assert.equal(
    (await Scheduler.findOne()).toschedule[0].toString(),
    calendar.id,
  );
});
for (const route of ["/api/users/", "/api/users/user/"]) {
  for (const role of ["employee", "manager", "admin", "exec"])
    test("user deletion authorization " + route + role, async () => {
      const allowed = ["admin", "exec"].includes(role);
      assert.equal(
        (await request("DELETE", route + users.owner.id, undefined, role))
          .status,
        allowed ? 200 : 403,
      );
      assert.equal(
        await User.countDocuments({ _id: users.owner._id }),
        allowed ? 0 : 1,
      );
    });
}
test("profile edit without password preserves hash", async () => {
  const response = await request(
    "PUT",
    "/api/users/userOne/" + users.owner.id,
    { _id: users.owner.id, firstName: "Changed" },
    "owner",
  );
  assert.equal(response.status, 200);
  assert.equal((await User.findById(users.owner._id)).password, "test-hash");
});
test("profile password edit hashes password and returns actor token", async () => {
  const response = await request(
    "PUT",
    "/api/users/userOne/" + users.owner.id,
    { _id: users.owner.id, password: "new-test-password" },
  );
  assert.equal(response.status, 200);
  assert.equal(
    await bcrypt.compare(
      "new-test-password",
      (await User.findById(users.owner._id)).password,
    ),
    true,
  );
  assert.equal(jwt.verify(response.body.token, secret).id, users.admin.id);
});
test("generic admin update cannot persist plaintext password or bypass required validation", async () => {
  assert.equal(
    (
      await request("PUT", "/api/users/user/" + users.owner.id, {
        password: "plaintext",
      })
    ).status,
    403,
  );
  assert.equal((await User.findById(users.owner._id)).password, "test-hash");
  assert.equal(
    (
      await request("PUT", "/api/users/user/" + users.owner.id, {
        firstName: "",
      })
    ).status,
    400,
  );
});
test("manage user requires matching route ID and valid role arrays", async () => {
  assert.equal(
    (
      await request("PUT", "/api/users/manageUserOne/" + users.owner.id, {
        _id: users.employee.id,
        roles: ["admin"],
        removedRole: [],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("PUT", "/api/users/manageUserOne/" + users.owner.id, {
        _id: users.owner.id,
        roles: "admin",
        removedRole: [],
      })
    ).status,
    400,
  );
});

test("user directory never exposes password hashes or reset credentials", async () => {
  await User.updateOne(
    { _id: users.owner._id },
    {
      resetPasswordToken: "test-reset-secret",
      resetPasswordExpires: new Date(),
    },
  );
  const response = await request(
    "GET",
    "/api/users/user",
    undefined,
    "employee",
  );
  assert.equal(response.status, 200);
  for (const user of response.body) {
    assert.equal(user.password, undefined);
    assert.equal(user.resetPasswordToken, undefined);
    assert.equal(user.resetPasswordExpires, undefined);
  }
});
test("profile response preserves executive and management fields used by frontend", async () => {
  const response = await request(
    "PUT",
    "/api/users/userOne/" + users.exec.id,
    { _id: users.exec.id, firstName: "Changed", password: "" },
    "exec",
  );
  assert.equal(response.status, 200);
  assert.equal(response.body.exec, "yes");
  assert.deepEqual(response.body.companyRoles, []);
});
test("admin account payload used by ManageAccounts persists and is sanitized", async () => {
  const response = await request(
    "PUT",
    "/api/users/manageUserOne/" + users.owner.id,
    {
      _id: users.owner.id,
      roles: ["employee"],
      removedRole: [],
      exec: "no",
      phoneNumber: "",
      startDate: null,
      terminationDate: null,
      supervisor: null,
    },
  );
  assert.equal(response.status, 200);
  assert.equal(response.body.password, undefined);
  assert.equal((await User.findById(users.owner._id)).exec, "no");
});
for (const body of [
  { roles: "admin", removedRole: [] },
  { roles: [{}], removedRole: [] },
  { roles: [], removedRole: {} },
  { roles: [], removedRole: [], exec: "invalid" },
  { roles: [], removedRole: [], phoneNumber: 10 },
  { roles: [], removedRole: [], supervisor: "000000000000000000000000" },
])
  test("manage user malformed body " + JSON.stringify(body), async () => {
    assert.equal(
      (
        await request("PUT", "/api/users/manageUserOne/" + users.owner.id, {
          _id: users.owner.id,
          ...body,
        })
      ).status,
      400,
    );
    assert.deepEqual((await User.findById(users.owner._id)).roles, [
      "employee",
    ]);
  });
for (const body of [
  { roles: {} },
  { roles: [{}] },
  { $set: { password: "plaintext" } },
  { "roles.0": "admin" },
  { resetPasswordToken: "injected" },
])
  test(
    "generic user update rejects malformed or unsafe fields " +
      JSON.stringify(body),
    async () => {
      const result = await request(
        "PUT",
        "/api/users/user/" + users.owner.id,
        body,
      );
      assert.ok([400, 403].includes(result.status));
      assert.equal(
        (await User.findById(users.owner._id)).password,
        "test-hash",
      );
    },
  );
test("model save and query validators enforce objective and key-result constraints", async () => {
  const invalidObjective = new Objective({
    owner: users.owner._id,
    dueDate: "wrong",
  });
  await assert.rejects(invalidObjective.save(), { name: "ValidationError" });
  await assert.rejects(
    Objective.findByIdAndUpdate(
      objective._id,
      { commitmentType: "wrong" },
      { runValidators: true },
    ),
    { name: "ValidationError" },
  );
  await assert.rejects(
    new KeyResult({
      objective: objective._id,
      title: "Invalid",
      weight: -2,
      dueDate: "2026-12-01",
    }).save(),
    { name: "ValidationError" },
  );
  assert.equal(await Objective.countDocuments(), 1);
  assert.equal(await KeyResult.countDocuments(), 0);
});
test("role permission model rejects unknown labels on save and validated update", async () => {
  await assert.rejects(
    new Permission({ role: "Manager", permissions: ["Unknown"] }).save(),
    { name: "ValidationError" },
  );
  await Permission.create({ role: "Manager", permissions: [] });
  await assert.rejects(
    Permission.findOneAndUpdate(
      { role: "Manager" },
      { permissions: ["Unknown"] },
      { runValidators: true },
    ),
    { name: "ValidationError" },
  );
});
test("group names list combines saved and legacy objective groups without duplicates", async () => {
  await Objective.create({
    title: "Legacy",
    owner: users.owner._id,
    group: "Legacy",
    dueDate: "2026-12-01",
  });
  const response = await request("GET", "/api/okr/objectives/groups");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, ["Legacy", "Marketing", "Sales"]);
});
test("group missing and malformed IDs return 404", async () => {
  for (const groupId of ["bad-id", id()])
    assert.equal(
      (
        await request("PUT", "/api/okr/admin/groups/" + groupId, {
          members: [],
        })
      ).status,
      404,
    );
});
test("changing group manager immediately transfers objective access", async () => {
  assert.equal(
    (
      await request("PUT", "/api/okr/admin/groups/" + sales.id, {
        manager: users.employee.id,
      })
    ).status,
    200,
  );
  assert.equal(
    (await request("GET", pathForObjective(), undefined, "groupManager")).body
      .objective.canManage,
    false,
  );
  assert.equal(
    (await request("GET", pathForObjective(), undefined, "employee")).body
      .objective.canManage,
    true,
  );
});
test("a failed objective save propagates an error without reporting success", async () => {
  const original = Objective.prototype.save;
  Objective.prototype.save = async function () {
    throw new Error("injected test write failure");
  };
  try {
    assert.equal(
      (await request("PUT", pathForObjective(), { title: "Not saved" })).status,
      500,
    );
    assert.equal((await Objective.findById(objective._id)).title, "Original");
  } finally {
    Objective.prototype.save = original;
  }
});
test("a failed permission read denies access instead of falling back to defaults", async () => {
  const original = Permission.findOne;
  Permission.findOne = async () => {
    throw new Error("injected permission read failure");
  };
  try {
    assert.equal(
      (await request("POST", "/api/okr/objectives", objectiveBody())).status,
      500,
    );
    assert.equal(await Objective.countDocuments(), 1);
  } finally {
    Permission.findOne = original;
  }
});

{
  test("concurrent key-result requests must not exceed total weight", async () => {
    const responses = await Promise.all([
      request(
        "POST",
        pathForObjective() + "/key-results",
        keyBody({ weight: 60 }),
      ),
      request(
        "POST",
        pathForObjective() + "/key-results",
        keyBody({ weight: 60 }),
      ),
    ]);
    assert.deepEqual(
      responses.map((response) => response.status).sort(),
      [201, 400],
    );
    const results = await KeyResult.find({ objective: objective._id });
    const total = results.reduce((sum, result) => sum + result.weight, 0);
    assert.ok(total <= 100, "Concurrent requests saved total weight " + total);
  });
  test("objective deletion failure must not partially remove key results", async () => {
    await KeyResult.create({
      objective: objective._id,
      title: "Existing",
      weight: 50,
      dueDate: "2026-12-01",
    });
    const original = Objective.prototype.deleteOne;
    Objective.prototype.deleteOne = async () => {
      throw new Error("injected objective delete failure");
    };
    try {
      assert.equal((await request("DELETE", pathForObjective())).status, 500);
    } finally {
      Objective.prototype.deleteOne = original;
    }
    assert.equal(await Objective.countDocuments(), 1);
    assert.equal(await KeyResult.countDocuments(), 1);
  });
  test("objective edit and deletion must maintain its linked calendar entry", async () => {
    const created = await request(
      "POST",
      "/api/okr/objectives",
      objectiveBody(),
    );
    assert.equal(created.status, 201);
    await request("PUT", "/api/okr/objectives/" + created.body._id, {
      title: "Renamed objective",
    });
    const title = (await Calendar.findOne()).title;
    await request("DELETE", "/api/okr/objectives/" + created.body._id);
    assert.deepEqual(
      { title, remaining: await Calendar.countDocuments() },
      { title: "Renamed objective", remaining: 0 },
    );
  });
}

test("approval permission, scope, malformed payload and persisted actor", async () => {
  const key = await KeyResult.create({
    objective: objective._id,
    title: "Result",
    weight: 30,
    dueDate: "2026-12-01",
  });
  const path = pathForObjective() + "/key-results/" + key.id + "/approval";
  assert.equal(
    (await request("PUT", path, { approved: true }, "employee")).status,
    403,
  );
  assert.equal((await request("PUT", path, { approved: "yes" })).status, 400);
  await Permission.create({
    role: "Admin",
    permissions: ["Edit Objectives", "Manage Roles"],
  });
  assert.equal((await request("PUT", path, { approved: true })).status, 403);
  await Permission.updateOne(
    { role: "Admin" },
    { $push: { permissions: "Approve Key Results" } },
  );
  assert.equal((await request("PUT", path, { approved: true })).status, 200);
  const saved = await KeyResult.findById(key._id);
  assert.equal(saved.approved, true);
  assert.equal(saved.approvedBy.toString(), users.admin.id);
  assert.ok(saved.approvedAt);
  assert.equal((await request("PUT", path, { approved: false })).status, 200);
  assert.equal((await KeyResult.findById(key._id)).approvedBy, null);
});
test("key-result approval rejects IDs from a different objective", async () => {
  const key = await KeyResult.create({
    objective: new mongoose.Types.ObjectId(),
    title: "Other",
    weight: 20,
    dueDate: "2026-12-01",
  });
  assert.equal(
    (
      await request(
        "PUT",
        pathForObjective() + "/key-results/" + key.id + "/approval",
        { approved: true },
      )
    ).status,
    404,
  );
  assert.equal((await KeyResult.findById(key._id)).approved, false);
});
test("reports use actual progress and enforce saved View Reports permission", async () => {
  await KeyResult.create({
    objective: objective._id,
    title: "Result",
    weight: 100,
    progress: 60,
    dueDate: "2026-12-01",
  });
  const report = await request(
    "GET",
    "/api/okr/reports",
    undefined,
    "employee",
  );
  assert.equal(report.status, 200);
  assert.deepEqual(report.body, {
    totalObjectives: 1,
    onTrack: 1,
    averageProgress: 60,
    groups: [{ name: "Sales", objectives: 1, progress: 60 }],
  });
  await Permission.create({ role: "Employee", permissions: [] });
  assert.equal(
    (await request("GET", "/api/okr/reports", undefined, "employee")).status,
    403,
  );
});
test("Admin can revoke Manage Roles and cannot edit permissions afterward", async () => {
  assert.equal(
    (
      await request("PUT", "/api/okr/admin/permissions/Admin", {
        permissions: ["Edit Objectives"],
      })
    ).status,
    200,
  );
  assert.equal(await Permission.countDocuments(), 1);
  assert.equal(
    (
      await request("PUT", "/api/okr/admin/permissions/Admin", {
        permissions: ["Manage Roles"],
      })
    ).status,
    403,
  );
});
test("Manage Users revocation blocks privileged writes but keeps self profile edits", async () => {
  await Permission.create({ role: "Admin", permissions: ["Manage Roles"] });
  assert.equal(
    (
      await request("PUT", "/api/users/user/" + users.owner.id, {
        firstName: "Denied",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("PUT", "/api/users/manageUserOne/" + users.owner.id, {
        _id: users.owner.id,
        roles: ["admin"],
        removedRole: [],
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("PUT", "/api/users/user/" + users.admin.id, {
        firstName: "Own edit",
      })
    ).status,
    200,
  );
});
test("failed calendar scheduling rolls back objective and calendar creation", async () => {
  const original = Scheduler.updateOne;
  Scheduler.updateOne = async () => {
    throw new Error("injected scheduler failure");
  };
  try {
    assert.equal(
      (await request("POST", "/api/okr/objectives", objectiveBody())).status,
      500,
    );
    assert.equal(await Objective.countDocuments(), 1);
    assert.equal(await Calendar.countDocuments(), 0);
  } finally {
    Scheduler.updateOne = original;
  }
});
test("failed calendar deletion rolls back objective and key-result deletion", async () => {
  const created = await request("POST", "/api/okr/objectives", objectiveBody());
  await KeyResult.create({
    objective: created.body._id,
    title: "Saved",
    weight: 100,
    dueDate: "2026-12-01",
  });
  const original = Calendar.findOneAndDelete;
  Calendar.findOneAndDelete = async () => {
    throw new Error("injected calendar delete failure");
  };
  try {
    assert.equal(
      (await request("DELETE", "/api/okr/objectives/" + created.body._id))
        .status,
      500,
    );
  } finally {
    Calendar.findOneAndDelete = original;
  }
  assert.equal(await Objective.countDocuments({ _id: created.body._id }), 1);
  assert.equal(
    await KeyResult.countDocuments({ objective: created.body._id }),
    1,
  );
  assert.equal(await Calendar.countDocuments(), 1);
});
test("concurrent objective deletion and key-result creation never leave orphaned key results", async () => {
  const results = await Promise.all([
    request("DELETE", pathForObjective()),
    request("POST", pathForObjective() + "/key-results", keyBody()),
  ]);
  assert.equal(results[0].status, 200);
  assert.ok([201, 404].includes(results[1].status));
  assert.equal(await Objective.countDocuments(), 0);
  assert.equal(await KeyResult.countDocuments(), 0);
});
test("legacy calendar entry is linked once and updated without duplicate events", async () => {
  const entry = await Calendar.create({
    title: objective.title,
    description: objective.description,
    userAssigned: [objective.owner],
    endTime: objective.dueDate,
    category: "OKR Objective",
  });
  assert.equal(
    (await request("PUT", pathForObjective(), { title: "Updated legacy" }))
      .status,
    200,
  );
  assert.equal(
    (await Objective.findById(objective._id)).calendarEntry.toString(),
    entry.id,
  );
  assert.equal((await Calendar.findById(entry._id)).title, "Updated legacy");
  assert.equal(await Calendar.countDocuments(), 1);
});
test("ambiguous legacy links require explicit admin selection and preserve other events", async () => {
  const entries = [];
  for (let count = 0; count < 2; count++)
    entries.push(
      await Calendar.create({
        title: objective.title,
        description: objective.description,
        userAssigned: [objective.owner],
        endTime: objective.dueDate,
        category: "OKR Objective",
      }),
    );
  assert.equal(
    (await request("PUT", pathForObjective(), { title: "Ambiguous" })).status,
    409,
  );
  assert.equal(
    (
      await request(
        "PUT",
        pathForObjective() + "/calendar-link",
        { calendarEntry: entries[0].id },
        "owner",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request("PUT", pathForObjective() + "/calendar-link", {
        calendarEntry: entries[0].id,
      })
    ).status,
    200,
  );
  assert.equal(
    (await request("PUT", pathForObjective(), { title: "Explicitly linked" }))
      .status,
    200,
  );
  assert.equal((await Calendar.findById(entries[1]._id)).title, "Original");
});

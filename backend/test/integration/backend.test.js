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
const Evidence = require("../../models/okrEvidenceModel");
const Group = require("../../models/okrGroupModel");
const Permission = require("../../models/okrRolePermissionModel");
const Calendar = require("../../models/calendarEntryModel");
const Scheduler = require("../../models/schedulerModel");
const Notification = require("../../models/notificationModel");
const BlockedUpload = require("../../models/okrBlockedUploadModel");
const blockedReports = require("../../services/blockedUploads/links");
const { createHash } = require("node:crypto");
const webService = require("../../services/webService");
const { errorHandler } = require("../../middleware/errorMiddleware");
const {
  hasRolePermission,
  getRoleName,
} = require("../../middleware/adminPermissions");
const { canUserManageObjective } = require("../../middleware/okrPermissions");
let mongo, directory, server, base, users, objective, sales;
let deliveredNotifications;
const secret = "isolated-backend-investigation-only";
const oldSecret = process.env.JWT_SECRET;
const originalEnqueueNotification = webService.enqueueNotification;
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
    Evidence,
    Calendar,
    Scheduler,
    Notification,
    BlockedUpload,
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
  app.use(express.urlencoded({ extended: false }));
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
  webService.enqueueNotification = originalEnqueueNotification;
});

test.beforeEach(async () => {
  deliveredNotifications = [];
  webService.enqueueNotification = (notification) => {
    deliveredNotifications.push(notification);
    return { success: true };
  };

  for (const model of [
    User,
    Objective,
    KeyResult,
    Evidence,
    Group,
    Permission,
    Calendar,
    Scheduler,
    Notification,
    BlockedUpload,
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

async function evidenceRequest(method, path, options = {}) {
  const role = options.role || "admin";
  const headers = {};
  if (options.authorization !== null) {
    headers.Authorization =
      options.authorization === undefined
        ? "Bearer " + jwt.sign({ id: users[role].id }, secret)
        : options.authorization;
  }
  if (options.filename !== undefined)
    headers["X-Evidence-Name"] = encodeURIComponent(options.filename);
  if (options.mimetype !== undefined)
    headers["X-Evidence-Type"] = encodeURIComponent(options.mimetype);
  if (options.note !== undefined)
    headers["X-Evidence-Note"] = encodeURIComponent(options.note);
  if (options.contentType !== null)
    headers["Content-Type"] =
      options.contentType || "application/octet-stream";

  const response = await fetch(base + path, {
    method,
    headers,
    body: options.body,
  });
  const responseType = response.headers.get("content-type") || "";
  const body = responseType.includes("application/json")
    ? await response.json()
    : Buffer.from(await response.arrayBuffer());
  if (response.status === 500)
    console.error("HTTP failure:", method, path, body.message);
  return { status: response.status, body, headers: response.headers };
}

function sampleEvidenceFile(filename) {
  const extension = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  if (extension === ".pdf") return Buffer.from("%PDF-1.4\nTest evidence");
  if (extension === ".png")
    return Buffer.from("89504e470d0a1a0a", "hex");
  if (extension === ".jpg" || extension === ".jpeg")
    return Buffer.from("ffd8ffe000104a464946", "hex");
  if (extension === ".gif") return Buffer.from("GIF89a");
  if (extension === ".webp") return Buffer.from("RIFF0000WEBP");
  if (extension === ".heic")
    return Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypheic")]);
  if ([".doc", ".xls", ".ppt"].includes(extension))
    return Buffer.from("d0cf11e0a1b11ae1", "hex");
  if (
    [".docx", ".xlsx", ".pptx", ".odt", ".ods", ".odp", ".zip"].includes(
      extension,
    )
  )
    return Buffer.from("504b0506" + "00".repeat(18), "hex");
  if (extension === ".rtf") return Buffer.from("{\\rtf1 Test evidence}");
  if (extension === ".json") return Buffer.from('{"result":"complete"}');
  return Buffer.from("test evidence");
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

test("assigned employees can upload, view, download and delete evidence", async () => {
  const key = await KeyResult.create({
    objective: objective._id,
    title: "Document the result",
    weight: 30,
    assignedTo: users.employee._id,
    dueDate: "2026-12-01",
    approved: true,
    approvedBy: users.admin._id,
    approvedAt: new Date(),
  });
  const path =
    pathForObjective() + "/key-results/" + key.id + "/evidence";
  const file = Buffer.from("%PDF-1.4\nTest evidence");
  const uploaded = await evidenceRequest("POST", path, {
    role: "employee",
    filename: "Q1 result.pdf",
    mimetype: "application/pdf",
    note: "Final figures for review",
    body: file,
  });

  assert.equal(uploaded.status, 201);
  assert.equal(uploaded.body.filename, "Q1 result.pdf");
  assert.equal(uploaded.body.mimetype, "application/pdf");
  assert.equal(uploaded.body.size, file.length);
  assert.equal(uploaded.body.note, "Final figures for review");
  assert.equal(uploaded.body.uploadedByName, "employee Test");
  assert.equal(uploaded.body.data, undefined);

  const saved = await Evidence.findById(uploaded.body._id).select("+data");
  assert.deepEqual(Buffer.from(saved.data), file);
  assert.equal(saved.uploadedBy.toString(), users.employee.id);
  const updatedKey = await KeyResult.findById(key._id);
  assert.equal(updatedKey.approved, false);
  assert.equal(updatedKey.approvedBy, null);
  assert.equal(updatedKey.approvedAt, null);

  const list = await evidenceRequest("GET", path, { role: "employee" });
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 1);
  assert.equal(list.body[0].filename, "Q1 result.pdf");
  assert.equal(list.body[0].data, undefined);

  await Evidence.collection.updateOne(
    { _id: saved._id },
    { $set: { size: file.length + 100 } },
  );

  const download = await evidenceRequest(
    "GET",
    path + "/" + uploaded.body._id + "/download",
    { role: "employee" },
  );
  assert.equal(download.status, 200);
  assert.deepEqual(download.body, file);
  assert.equal(download.headers.get("content-type"), "application/pdf");
  assert.match(
    download.headers.get("content-disposition"),
    /attachment; filename="Q1 result\.pdf"/,
  );
  assert.equal(download.headers.get("x-content-type-options"), "nosniff");
  assert.equal(download.headers.get("cache-control"), "private, no-store");
  assert.equal(download.headers.get("content-length"), String(file.length));

  await KeyResult.updateOne(
    { _id: key._id },
    {
      $set: {
        approved: true,
        approvedBy: users.admin._id,
        approvedAt: new Date(),
      },
    },
  );

  const removed = await evidenceRequest(
    "DELETE",
    path + "/" + uploaded.body._id,
    { role: "employee" },
  );
  assert.equal(removed.status, 200);
  assert.equal(removed.body.id, uploaded.body._id);
  assert.equal(await Evidence.countDocuments(), 1);
  const removedEvidence = await Evidence.findById(uploaded.body._id);
  assert.equal(removedEvidence.deleted, true);
  assert.equal(removedEvidence.deletedBy.toString(), users.employee.id);
  assert.ok(removedEvidence.deletedAt instanceof Date);

  const listAfterDelete = await evidenceRequest("GET", path, {
    role: "employee",
  });
  assert.equal(listAfterDelete.status, 200);
  assert.equal(listAfterDelete.body.length, 0);
  assert.equal(
    (
      await evidenceRequest(
        "GET",
        path + "/" + uploaded.body._id + "/download",
        { role: "employee" },
      )
    ).status,
    404,
  );
  const keyAfterDelete = await KeyResult.findById(key._id);
  assert.equal(keyAfterDelete.approved, false);
  assert.equal(keyAfterDelete.approvedBy, null);
  assert.equal(keyAfterDelete.approvedAt, null);
});

test("evidence limits count active files and a removed file frees a slot", async () => {
  const key = await KeyResult.create({
    objective: objective._id,
    title: "Supported result",
    weight: 30,
    dueDate: "2026-12-01",
  });
  const path =
    pathForObjective() + "/key-results/" + key.id + "/evidence";

  const uploadedIds = [];
  for (let index = 1; index <= 10; index++) {
    const response = await evidenceRequest("POST", path, {
      role: "owner",
      filename: "result-" + index + ".txt",
      mimetype: "text/plain",
      body: Buffer.from("done " + index),
    });
    assert.equal(response.status, 201);
    uploadedIds.push(response.body._id);
  }

  const overLimit = await evidenceRequest("POST", path, {
    role: "owner",
    filename: "result-11.txt",
    mimetype: "text/plain",
    body: Buffer.from("done 11"),
  });
  assert.equal(overLimit.status, 400);
  assert.match(overLimit.body.message, /already has 10 evidence files/);

  assert.equal(
    (
      await evidenceRequest("DELETE", path + "/" + uploadedIds[0], {
        role: "owner",
      })
    ).status,
    200,
  );

  const replacement = await evidenceRequest("POST", path, {
    role: "owner",
    filename: "replacement.txt",
    mimetype: "text/plain",
    body: Buffer.from("replacement"),
  });
  assert.equal(replacement.status, 201);
  assert.equal(
    await Evidence.countDocuments({ keyResult: key._id, deleted: true }),
    1,
  );
  assert.equal(
    await Evidence.countDocuments({
      keyResult: key._id,
      deleted: { $ne: true },
    }),
    10,
  );
});

test("deleted evidence can be restored, and restoring respects the file limit and permissions", async () => {
  users.outsider = await User.create({
    firstName: "outside",
    lastName: "Test",
    email: "outside@example.test",
    password: "test-hash",
    roles: ["employee"],
    exec: "no",
  });
  const key = await KeyResult.create({
    objective: objective._id,
    title: "Recoverable result",
    weight: 30,
    assignedTo: users.employee._id,
    dueDate: "2026-12-01",
  });
  const path = pathForObjective() + "/key-results/" + key.id + "/evidence";

  const uploaded = await evidenceRequest("POST", path, {
    role: "employee",
    filename: "Q1 result.pdf",
    mimetype: "application/pdf",
    body: Buffer.from("%PDF-1.4\nTest evidence"),
  });
  assert.equal(uploaded.status, 201);
  const evidenceId = uploaded.body._id;

  assert.equal(
    (
      await evidenceRequest("DELETE", path + "/" + evidenceId, {
        role: "employee",
      })
    ).status,
    200,
  );

  assert.equal(
    (
      await evidenceRequest("POST", path + "/" + evidenceId + "/restore", {
        role: "outsider",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await evidenceRequest("POST", path + "/" + id() + "/restore", {
        role: "employee",
      })
    ).status,
    404,
  );

  const restored = await evidenceRequest(
    "POST",
    path + "/" + evidenceId + "/restore",
    { role: "employee" },
  );
  assert.equal(restored.status, 200);
  assert.equal(restored.body.id, evidenceId);

  const restoredEvidence = await Evidence.findById(evidenceId);
  assert.equal(restoredEvidence.deleted, false);
  assert.equal(restoredEvidence.deletedBy, null);
  assert.equal(restoredEvidence.deletedAt, null);

  assert.equal(
    (
      await evidenceRequest("POST", path + "/" + evidenceId + "/restore", {
        role: "employee",
      })
    ).status,
    404,
  );

  assert.equal(
    (
      await evidenceRequest("DELETE", path + "/" + evidenceId, {
        role: "employee",
      })
    ).status,
    200,
  );

  for (let index = 1; index <= 10; index++) {
    const response = await evidenceRequest("POST", path, {
      role: "employee",
      filename: "filler-" + index + ".txt",
      mimetype: "text/plain",
      body: Buffer.from("filler " + index),
    });
    assert.equal(response.status, 201);
  }

  const overLimit = await evidenceRequest(
    "POST",
    path + "/" + evidenceId + "/restore",
    { role: "employee" },
  );
  assert.equal(overLimit.status, 400);
  assert.match(overLimit.body.message, /already has 10 evidence files/);

  const stillDeleted = await Evidence.findById(evidenceId);
  assert.equal(stillDeleted.deleted, true);
});

test("evidence uploads that fail the security scan are rejected and never stored", async () => {
  const key = await KeyResult.create({
    objective: objective._id,
    title: "Scanned result",
    weight: 30,
    dueDate: "2026-12-01",
  });
  const path = pathForObjective() + "/key-results/" + key.id + "/evidence";
  const eicar = [
    "X5O!P%@AP[4\\PZX54(P^)7CC)7}",
    "$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!",
    "$H+H*",
  ].join("");

  const blocked = [
    {
      filename: "notes.txt",
      mimetype: "text/plain",
      body: Buffer.from(eicar),
    },
    {
      filename: "form.pdf",
      mimetype: "application/pdf",
      body: Buffer.from("%PDF-1.4\n<< /S /JavaScript /JS (app.alert(1)) >>"),
    },
    {
      filename: "budget.csv",
      mimetype: "text/csv",
      body: Buffer.from("name,total\nx,=cmd|' /C calc'!A0\n"),
    },
  ];

  for (const file of blocked) {
    const response = await evidenceRequest("POST", path, {
      role: "owner",
      ...file,
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message, /blocked by the security scan/);
  }

  assert.equal(await Evidence.countDocuments({ keyResult: key._id }), 0);

  const clean = await evidenceRequest("POST", path, {
    role: "owner",
    filename: "result.pdf",
    mimetype: "application/pdf",
    body: Buffer.from("%PDF-1.4\nTest evidence"),
  });
  assert.equal(clean.status, 201);
  assert.equal(await Evidence.countDocuments({ keyResult: key._id }), 1);
});

test("a blocked upload notifies the owner, group manager and supervisor with the sender details", async () => {
  users.employee.supervisor = users.manager._id;
  await users.employee.save();
  const key = await KeyResult.create({
    objective: objective._id,
    title: "Quarterly <b>result</b>",
    weight: 30,
    assignedTo: users.employee._id,
    dueDate: "2026-12-01",
  });
  const path = pathForObjective() + "/key-results/" + key.id + "/evidence";

  const response = await evidenceRequest("POST", path, {
    role: "employee",
    filename: '<img src="x" onerror="alert(1)">.pdf',
    mimetype: "application/pdf",
    body: Buffer.from("%PDF-1.4\n<< /S /Launch /F (cmd.exe) >>"),
  });
  assert.equal(response.status, 400);
  assert.match(response.body.message, /blocked by the security scan/);

  assert.equal(await Evidence.countDocuments({ keyResult: key._id }), 0);

  const notifications = await Notification.find({});
  assert.deepEqual(
    notifications.map((notification) => notification.user.toString()).sort(),
    [users.owner.id, users.groupManager.id, users.manager.id].sort(),
  );
  assert.equal(deliveredNotifications.length, 3);

  for (const notification of notifications) {
    assert.equal(notification.channel, "web");
    assert.equal(notification.category, "error");
    assert.match(notification.content, /Security alert/);
    assert.match(notification.content, /employee Test/);
    assert.match(notification.content, /employee@example\.test/);
    assert.match(notification.content, /scripts, launch actions/);
    assert.match(notification.content, /IP address: 127\.0\.0\.1/);
    assert.equal(notification.content.includes("Time:"), false);
    assert.equal(notification.content.includes("Roles:"), false);
    assert.match(notification.content, /Quarterly &lt;b&gt;result&lt;\/b&gt;/);
    assert.match(notification.content, /&lt;img src=&quot;x&quot;/);
    assert.equal(notification.content.includes("<img"), false);
    assert.equal(notification.content.includes("<b>"), false);
  }
});

test("a blocked upload by the owner notifies the group manager but never the sender", async () => {
  const key = await KeyResult.create({
    objective: objective._id,
    title: "Owner result",
    weight: 30,
    dueDate: "2026-12-01",
  });
  const path = pathForObjective() + "/key-results/" + key.id + "/evidence";

  const response = await evidenceRequest("POST", path, {
    role: "owner",
    filename: "notes.txt",
    mimetype: "text/plain",
    body: Buffer.from(
      [
        "X5O!P%@AP[4\\PZX54(P^)7CC)7}",
        "$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!",
        "$H+H*",
      ].join(""),
    ),
  });
  assert.equal(response.status, 400);

  const notifications = await Notification.find({});
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].user.toString(), users.groupManager.id);
});

test("a blocked upload with nobody else to tell falls back to admins and executives", async () => {
  const lonely = await Objective.create({
    title: "No manager",
    owner: users.owner._id,
    group: "Marketing",
    dueDate: "2026-12-01",
  });
  const key = await KeyResult.create({
    objective: lonely._id,
    title: "Lonely result",
    weight: 30,
    dueDate: "2026-12-01",
  });
  const path =
    "/api/okr/objectives/" + lonely.id + "/key-results/" + key.id + "/evidence";

  const response = await evidenceRequest("POST", path, {
    role: "owner",
    filename: "form.pdf",
    mimetype: "application/pdf",
    body: Buffer.from("%PDF-1.4\n<< /S /JavaScript /JS (x) >>"),
  });
  assert.equal(response.status, 400);

  const notifications = await Notification.find({});
  assert.deepEqual(
    notifications.map((notification) => notification.user.toString()).sort(),
    [users.admin.id, users.exec.id].sort(),
  );
});

test("a user without access cannot trigger alerts, and ordinary rejections send none", async () => {
  users.outsider = await User.create({
    firstName: "outside",
    lastName: "Test",
    email: "outside@example.test",
    password: "test-hash",
    roles: ["employee"],
    exec: "no",
  });
  const key = await KeyResult.create({
    objective: objective._id,
    title: "Protected result",
    weight: 30,
    assignedTo: users.employee._id,
    dueDate: "2026-12-01",
  });
  const path = pathForObjective() + "/key-results/" + key.id + "/evidence";

  const unauthorised = await evidenceRequest("POST", path, {
    role: "outsider",
    filename: "form.pdf",
    mimetype: "application/pdf",
    body: Buffer.from("%PDF-1.4\n<< /S /Launch /F (cmd.exe) >>"),
  });
  assert.equal(unauthorised.status, 403);

  const mismatch = await evidenceRequest("POST", path, {
    role: "employee",
    filename: "fake.pdf",
    mimetype: "application/pdf",
    body: Buffer.from("not really a pdf"),
  });
  assert.equal(mismatch.status, 400);

  const wrongType = await evidenceRequest("POST", path, {
    role: "employee",
    filename: "tool.exe",
    mimetype: "application/octet-stream",
    body: Buffer.from("MZ"),
  });
  assert.equal(wrongType.status, 400);

  assert.equal(await Notification.countDocuments(), 0);
  assert.equal(deliveredNotifications.length, 0);
});

test("the alert links to a safe report which managers can open without any button or login", async () => {
  users.employee.supervisor = users.manager._id;
  await users.employee.save();
  const key = await KeyResult.create({
    objective: objective._id,
    title: "Report <b>key</b>",
    weight: 30,
    assignedTo: users.employee._id,
    dueDate: "2026-12-01",
  });
  const path = pathForObjective() + "/key-results/" + key.id + "/evidence";
  const fileBody = Buffer.from(
    "name,total\nx,=cmd|' /C calc'!A0\n<script>alert(1)</script>\n",
  );

  const response = await evidenceRequest("POST", path, {
    role: "employee",
    filename: "<img src=x onerror=alert(1)>.csv",
    mimetype: "text/csv",
    body: fileBody,
  });
  assert.equal(response.status, 400);
  assert.equal(await Evidence.countDocuments({ keyResult: key._id }), 0);

  const records = await BlockedUpload.find({});
  assert.equal(records.length, 1);
  assert.equal(records[0].get("data"), undefined);
  assert.equal(records[0].sha256, createHash("sha256").update(fileBody).digest("hex"));
  assert.equal(records[0].detectedType, "Plain text");

  const notifications = await Notification.find({});
  assert.equal(notifications.length, 3);

  const links = notifications.map((notification) => {
    const match = /<a href="([^"]+)" target="_blank" rel="noopener noreferrer" style="[^"]+">Review this file and approve or decline it<\/a>/.exec(
      notification.content,
    );
    assert.ok(match, "every alert carries the report link");
    return match[1].replace(/&amp;/g, "&");
  });
  assert.equal(new Set(links).size, 3);

  for (const link of links) {
    const url = new URL(link);
    assert.equal(url.pathname, "/api/okr/blocked-uploads/" + records[0].id);

    const page = await fetch(base + url.pathname + url.search);
    const html = await page.text();
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-type"), /text\/html/);
    assert.match(page.headers.get("content-security-policy"), /default-src 'none'/);
    assert.equal(page.headers.get("x-content-type-options"), "nosniff");
    assert.match(page.headers.get("cache-control"), /no-store/);
    assert.equal(page.headers.get("referrer-policy"), "no-referrer");
    assert.match(html, /Upload blocked/);
    assert.match(html, /command formula/);
    assert.match(html, /employee Test/);
    assert.match(html, /employee@example\.test/);
    assert.match(html, /Report &lt;b&gt;key&lt;\/b&gt;/);
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;\.csv/);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.match(html, new RegExp(records[0].sha256));
    assert.equal(html.includes("<img"), false);
    assert.equal(html.includes("<script"), false);
    assert.equal(html.includes("<b>"), false);
  }
});

test("report links reject missing, forged, expired, wrong-report and unauthorised tokens", async () => {
  users.outsider = await User.create({
    firstName: "outside",
    lastName: "Test",
    email: "outside@example.test",
    password: "test-hash",
    roles: ["employee"],
    exec: "no",
  });
  const key = await KeyResult.create({
    objective: objective._id,
    title: "Guarded result",
    weight: 30,
    assignedTo: users.employee._id,
    dueDate: "2026-12-01",
  });
  const path = pathForObjective() + "/key-results/" + key.id + "/evidence";

  assert.equal(
    (
      await evidenceRequest("POST", path, {
        role: "employee",
        filename: "form.pdf",
        mimetype: "application/pdf",
        body: Buffer.from("%PDF-1.4\n<< /S /Launch /F (cmd.exe) >>"),
      })
    ).status,
    400,
  );
  const report = await BlockedUpload.findOne({});
  const reportPath = "/api/okr/blocked-uploads/" + report.id;
  const open = async (token) => {
    const response = await fetch(
      base + reportPath + (token === undefined ? "" : "?token=" + encodeURIComponent(token)),
    );
    return { status: response.status, html: await response.text() };
  };

  const good = blockedReports.signReportToken(report.id, users.owner.id);
  assert.equal((await open(good)).status, 200);
  assert.equal(
    (await open(blockedReports.signReportToken(report.id, users.groupManager.id))).status,
    200,
  );

  const refused = [
    undefined,
    "",
    "garbage",
    good.slice(0, -3) + "abc",
    blockedReports.signReportToken(report.id, users.owner.id, { expiresIn: -10 }),
    blockedReports.signReportToken(id(), users.owner.id),
    blockedReports.signReportToken(report.id, users.employee.id),
    blockedReports.signReportToken(report.id, users.outsider.id),
    jwt.sign({ id: users.owner.id }, secret),
    jwt.sign({ purpose: "blocked-upload-report", report: report.id, user: users.owner.id }, secret),
  ];
  for (const token of refused) {
    const result = await open(token);
    assert.equal(result.status, 403);
    assert.equal(result.html.includes("form.pdf"), false);
  }

  const malformed = await fetch(base + "/api/okr/blocked-uploads/not-an-id?token=x");
  assert.equal(malformed.status, 403);

  const missingId = id();
  const missing = await fetch(
    base +
      "/api/okr/blocked-uploads/" +
      missingId +
      "?token=" +
      encodeURIComponent(blockedReports.signReportToken(missingId, users.owner.id)),
  );
  assert.equal(missing.status, 404);

  await Group.updateOne({ _id: sales._id }, { manager: null });
  assert.equal(
    (await open(blockedReports.signReportToken(report.id, users.groupManager.id))).status,
    403,
  );
  assert.equal((await open(good)).status, 200);
});

test("a non-owner evidence upload creates one review notification", async () => {
  const key = await KeyResult.create({
    objective: objective._id,
    title: "Customer response time",
    weight: 30,
    assignedTo: users.employee._id,
    dueDate: "2026-12-01",
  });
  const path =
    pathForObjective() + "/key-results/" + key.id + "/evidence";

  assert.equal(
    (
      await evidenceRequest("POST", path, {
        role: "employee",
        filename: "result.txt",
        mimetype: "text/plain",
        body: Buffer.from("done"),
      })
    ).status,
    201,
  );

  const notifications = await Notification.find({});
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].user.toString(), users.owner.id);
  assert.equal(notifications[0].channel, "web");
  assert.equal(notifications[0].category, "okr");
  assert.equal(
    notifications[0].link,
    "/dashboard/okrtracker/objectives",
  );
  assert.match(notifications[0].content, /Customer response time/);
  assert.match(notifications[0].content, /Original/);
  assert.equal(deliveredNotifications.length, 1);
  assert.equal(
    deliveredNotifications[0].user.toString(),
    users.owner.id,
  );

  assert.equal(
    (
      await evidenceRequest("POST", path, {
        role: "owner",
        filename: "owner-note.txt",
        mimetype: "text/plain",
        body: Buffer.from("owner review"),
      })
    ).status,
    201,
  );
  assert.equal(await Notification.countDocuments(), 1);
  assert.equal(deliveredNotifications.length, 1);
});

test("legacy evidence without deletion fields stays available", async () => {
  const key = await KeyResult.create({
    objective: objective._id,
    title: "Legacy result",
    weight: 30,
    dueDate: "2026-12-01",
  });
  const evidenceId = new mongoose.Types.ObjectId();
  const file = Buffer.from("legacy file");
  await Evidence.collection.insertOne({
    _id: evidenceId,
    objective: objective._id,
    keyResult: key._id,
    filename: "legacy.txt",
    mimetype: "text/plain",
    size: file.length,
    note: "",
    data: file,
    uploadedBy: users.admin._id,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const path =
    pathForObjective() + "/key-results/" + key.id + "/evidence";
  const list = await evidenceRequest("GET", path);
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 1);
  assert.equal(list.body[0].filename, "legacy.txt");

  const download = await evidenceRequest(
    "GET",
    path + "/" + evidenceId + "/download",
  );
  assert.equal(download.status, 200);
  assert.deepEqual(download.body, file);
});

test("rapid evidence upload attempts are rate limited per user", async () => {
  const key = await KeyResult.create({
    objective: objective._id,
    title: "Rate limited result",
    weight: 30,
    dueDate: "2026-12-01",
  });
  const invalidPath =
    "/api/okr/objectives/bad-id/key-results/" + key.id + "/evidence";
  const options = {
    filename: "result.txt",
    mimetype: "text/plain",
    body: Buffer.from("done"),
  };

  for (let attempt = 0; attempt < 30; attempt++) {
    assert.equal(
      (await evidenceRequest("POST", invalidPath, options)).status,
      404,
    );
  }

  const limited = await evidenceRequest("POST", invalidPath, options);
  assert.equal(limited.status, 429);
  assert.match(limited.body.message, /Too many evidence uploads/);
  const retryAfter = Number(limited.headers.get("retry-after"));
  assert.ok(retryAfter > 0 && retryAfter <= 300);
});

test("evidence access follows assignments, objective roles and saved permissions", async () => {
  users.outsider = await User.create({
    firstName: "outside",
    lastName: "Test",
    email: "outside@example.test",
    password: "test-hash",
    roles: ["employee"],
    exec: "no",
  });
  const key = await KeyResult.create({
    objective: objective._id,
    title: "Assigned result",
    weight: 30,
    assignedTo: users.employee._id,
    dueDate: "2026-12-01",
  });
  const path =
    pathForObjective() + "/key-results/" + key.id + "/evidence";
  const options = {
    filename: "result.txt",
    mimetype: "text/plain",
    body: Buffer.from("done"),
  };

  assert.equal(
    (await evidenceRequest("POST", path, { ...options, authorization: null }))
      .status,
    401,
  );
  assert.equal(
    (await evidenceRequest("POST", path, { ...options, role: "outsider" }))
      .status,
    403,
  );
  const uploaded = await evidenceRequest("POST", path, {
    ...options,
    role: "admin",
  });
  assert.equal(uploaded.status, 201);

  for (const role of [
    "admin",
    "exec",
    "manager",
    "owner",
    "groupManager",
    "employee",
  ]) {
    assert.equal(
      (await evidenceRequest("GET", path, { role })).status,
      200,
      role + " should have evidence access",
    );
  }
  assert.equal(
    (await evidenceRequest("GET", path, { role: "outsider" })).status,
    403,
  );
  assert.equal(
    (
      await evidenceRequest(
        "GET",
        path + "/" + uploaded.body._id + "/download",
        { role: "outsider" },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await evidenceRequest("DELETE", path + "/" + uploaded.body._id, {
        role: "outsider",
      })
    ).status,
    403,
  );
  const assignedView = await request(
    "GET",
    pathForObjective(),
    undefined,
    "employee",
  );
  const outsiderView = await request(
    "GET",
    pathForObjective(),
    undefined,
    "outsider",
  );
  assert.equal(assignedView.body.keyResults[0].canManageEvidence, true);
  assert.equal(outsiderView.body.keyResults[0].canManageEvidence, false);

  await Permission.create({ role: "Manager", permissions: [] });
  assert.equal(
    (await evidenceRequest("GET", path, { role: "manager" })).status,
    403,
  );
  assert.equal(
    (
      await evidenceRequest(
        "GET",
        path + "/" + uploaded.body._id + "/download",
        { role: "manager" },
      )
    ).status,
    403,
  );
  assert.equal(
    (await evidenceRequest("GET", path, { role: "groupManager" })).status,
    403,
  );
  assert.equal(
    (await evidenceRequest("GET", path, { role: "employee" })).status,
    200,
  );
  assert.equal(
    (await evidenceRequest("GET", path, { role: "owner" })).status,
    200,
  );
});

test("evidence routes reject malformed IDs, mismatched records and invalid files", async () => {
  const key = await KeyResult.create({
    objective: objective._id,
    title: "Result",
    weight: 30,
    assignedTo: users.employee._id,
    dueDate: "2026-12-01",
  });
  const path =
    pathForObjective() + "/key-results/" + key.id + "/evidence";
  const valid = {
    filename: "result.pdf",
    mimetype: "application/pdf",
    body: Buffer.from("%PDF-1.4"),
  };

  assert.equal(
    (
      await evidenceRequest(
        "POST",
        "/api/okr/objectives/bad-id/key-results/" + key.id + "/evidence",
        valid,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await evidenceRequest(
        "POST",
        pathForObjective() + "/key-results/bad-id/evidence",
        valid,
      )
    ).status,
    404,
  );
  const otherObjective = await Objective.create({
    title: "Other",
    owner: users.owner._id,
    group: "Sales",
    dueDate: "2026-12-01",
  });
  assert.equal(
    (
      await evidenceRequest(
        "POST",
        "/api/okr/objectives/" +
          otherObjective.id +
          "/key-results/" +
          key.id +
          "/evidence",
        valid,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await evidenceRequest("POST", path, {
        mimetype: "application/pdf",
        body: valid.body,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await evidenceRequest("POST", path, {
        filename: "program.exe",
        mimetype: "application/octet-stream",
        body: Buffer.from("not safe"),
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await evidenceRequest("POST", path, {
        filename: "result.pdf",
        mimetype: "text/plain",
        body: Buffer.from("not a PDF"),
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await evidenceRequest("POST", path, {
        filename: "result.pdf",
        mimetype: "application/pdf",
        body: Buffer.from("not a PDF"),
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await evidenceRequest("POST", path, {
        filename: "../result.pdf",
        mimetype: "application/pdf",
        body: valid.body,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await evidenceRequest("POST", path, {
        filename: "result.pdf",
        mimetype: "application/pdf",
        note: "x".repeat(1001),
        body: valid.body,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await evidenceRequest("POST", path, {
        filename: "result.pdf",
        mimetype: "application/pdf",
        body: Buffer.alloc(0),
      })
    ).status,
    400,
  );
  const tooLarge = await evidenceRequest("POST", path, {
    filename: "large.pdf",
    mimetype: "application/pdf",
    body: Buffer.alloc(5 * 1024 * 1024 + 1),
  });
  assert.equal(tooLarge.status, 413);
  assert.equal(tooLarge.body.message, "Evidence files cannot be larger than 5 MB");
  assert.equal(
    (await evidenceRequest("GET", path + "/bad-id/download")).status,
    404,
  );
  assert.equal(
    (await evidenceRequest("DELETE", path + "/" + id())).status,
    404,
  );

  const otherKey = await KeyResult.create({
    objective: objective._id,
    title: "Other result",
    weight: 20,
    dueDate: "2026-12-01",
  });
  const otherEvidence = await Evidence.create({
    objective: objective._id,
    keyResult: otherKey._id,
    filename: "other.txt",
    mimetype: "text/plain",
    size: 5,
    data: Buffer.from("other"),
    uploadedBy: users.admin._id,
  });
  assert.equal(
    (
      await evidenceRequest(
        "GET",
        path + "/" + otherEvidence.id + "/download",
      )
    ).status,
    404,
  );
  assert.equal(
    (await evidenceRequest("DELETE", path + "/" + otherEvidence.id)).status,
    404,
  );
  await Evidence.deleteOne({ _id: otherEvidence._id });
  assert.equal(await Evidence.countDocuments(), 0);
});

test("evidence accepts common presentation, archive, data and image formats", async () => {
  const files = [
    ["figures.csv", "text/csv"],
    ["report.doc", "application/msword"],
    [
      "report.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    ["chart.gif", "image/gif"],
    ["photo.heic", "image/heic"],
    ["photo.jpeg", "image/jpeg"],
    ["photo.jpg", "image/jpeg"],
    ["results.json", "application/json"],
    ["notes.md", "text/markdown"],
    ["presentation.odp", "application/vnd.oasis.opendocument.presentation"],
    ["figures.ods", "application/vnd.oasis.opendocument.spreadsheet"],
    ["notes.odt", "application/vnd.oasis.opendocument.text"],
    ["result.pdf", "application/pdf"],
    ["chart.png", "image/png"],
    ["presentation.ppt", "application/vnd.ms-powerpoint"],
    [
      "presentation.pptx",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
    ["meeting.rtf", "application/octet-stream", "application/rtf"],
    ["notes.txt", "text/plain"],
    ["photo.webp", "image/webp"],
    ["legacy.xls", "application/vnd.ms-excel"],
    [
      "figures.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
    ["records.zip", "application/zip"],
  ];

  for (const [filename, mimetype, storedMimetype = mimetype] of files) {
    const key = await KeyResult.create({
      objective: objective._id,
      title: filename,
      weight: 1,
      dueDate: "2026-12-01",
    });
    const path =
      pathForObjective() + "/key-results/" + key.id + "/evidence";
    const response = await evidenceRequest("POST", path, {
      filename,
      mimetype,
      body: sampleEvidenceFile(filename),
    });
    assert.equal(response.status, 201, filename + " should be accepted");
    assert.equal(response.body.filename, filename);
    assert.equal(response.body.mimetype, storedMimetype);
  }

  assert.equal(await Evidence.countDocuments(), files.length);
});

test("evidence accepts a file at the exact size limit", async () => {
  const key = await KeyResult.create({
    objective: objective._id,
    title: "Large result",
    weight: 30,
    dueDate: "2026-12-01",
  });
  const file = Buffer.alloc(5 * 1024 * 1024);
  file.write("%PDF-1.4");
  const response = await evidenceRequest(
    "POST",
    pathForObjective() + "/key-results/" + key.id + "/evidence",
    {
      filename: "limit.pdf",
      mimetype: "application/pdf",
      body: file,
    },
  );

  assert.equal(response.status, 201);
  assert.equal(response.body.size, file.length);
});

test("evidence model validates stored files and objective deletion removes them", async () => {
  const key = await KeyResult.create({
    objective: objective._id,
    title: "Result",
    weight: 30,
    dueDate: "2026-12-01",
  });
  await assert.rejects(
    new Evidence({
      objective: objective._id,
      keyResult: key._id,
      filename: "large.pdf",
      mimetype: "application/pdf",
      size: 5 * 1024 * 1024 + 1,
      data: Buffer.alloc(5 * 1024 * 1024 + 1),
      uploadedBy: users.admin._id,
    }).save(),
    { name: "ValidationError" },
  );

  const normalized = await Evidence.create({
    objective: objective._id,
    keyResult: key._id,
    filename: "actual-size.txt",
    mimetype: "text/plain",
    size: 5 * 1024 * 1024,
    data: Buffer.from("saved"),
    uploadedBy: users.admin._id,
  });
  assert.equal(normalized.size, 5);

  await Evidence.create({
    objective: objective._id,
    keyResult: key._id,
    filename: "saved.txt",
    mimetype: "text/plain",
    size: 5,
    data: Buffer.from("saved"),
    uploadedBy: users.admin._id,
  });
  assert.equal((await request("DELETE", pathForObjective())).status, 200);
  assert.equal(await KeyResult.countDocuments(), 0);
  assert.equal(await Evidence.countDocuments(), 0);
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
test("failed calendar deletion rolls back objective, key-result and evidence deletion", async () => {
  const created = await request("POST", "/api/okr/objectives", objectiveBody());
  const key = await KeyResult.create({
    objective: created.body._id,
    title: "Saved",
    weight: 100,
    dueDate: "2026-12-01",
  });
  await Evidence.create({
    objective: created.body._id,
    keyResult: key._id,
    filename: "saved.txt",
    mimetype: "text/plain",
    size: 5,
    data: Buffer.from("saved"),
    uploadedBy: users.admin._id,
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
  assert.equal(
    await Evidence.countDocuments({ objective: created.body._id }),
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
test("concurrent objective deletion and evidence upload never leave orphaned files", async () => {
  const key = await KeyResult.create({
    objective: objective._id,
    title: "Result",
    weight: 30,
    assignedTo: users.employee._id,
    dueDate: "2026-12-01",
  });
  const results = await Promise.all([
    request("DELETE", pathForObjective()),
    evidenceRequest(
      "POST",
      pathForObjective() + "/key-results/" + key.id + "/evidence",
      {
        role: "employee",
        filename: "result.txt",
        mimetype: "text/plain",
        body: Buffer.from("done"),
      },
    ),
  ]);
  assert.equal(results[0].status, 200);
  assert.ok([201, 404].includes(results[1].status));
  assert.equal(await Objective.countDocuments(), 0);
  assert.equal(await KeyResult.countDocuments(), 0);
  assert.equal(await Evidence.countDocuments(), 0);
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

const reviewableFile = () => ({
  filename: "form.pdf",
  mimetype: "application/pdf",
  body: Buffer.from("%PDF-1.4\n<< /S /Launch /F (cmd.exe) >>"),
});

async function assignedKey(title, assignedTo) {
  return KeyResult.create({
    objective: objective._id,
    title,
    weight: 30,
    assignedTo: assignedTo || users.employee._id,
    dueDate: "2026-12-01",
  });
}

const evidencePathFor = (key) =>
  pathForObjective() + "/key-results/" + key.id + "/evidence";

async function decide(reportId, fields) {
  const response = await fetch(
    base + "/api/okr/blocked-uploads/" + reportId + "/decision",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields).toString(),
    },
  );
  return {
    status: response.status,
    html: await response.text(),
    headers: response.headers,
  };
}

async function openReport(report, userId) {
  const response = await fetch(
    base +
      "/api/okr/blocked-uploads/" +
      report.id +
      "?token=" +
      encodeURIComponent(blockedReports.signReportToken(report.id, userId)),
  );
  return {
    status: response.status,
    html: await response.text(),
    headers: response.headers,
  };
}

const approveAs = (report, user) =>
  decide(report.id, {
    token: blockedReports.signDecisionToken(report.id, user.id),
    decision: "approve",
    confirm: "yes",
  });

test("a manager can approve a reviewable block and the sender can then upload that exact file once", async () => {
  users.employee.supervisor = users.manager._id;
  await users.employee.save();
  const key = await assignedKey("Approval key");
  const path = evidencePathFor(key);
  const file = reviewableFile();

  const blocked = await evidenceRequest("POST", path, {
    role: "employee",
    ...file,
  });
  assert.equal(blocked.status, 400);
  assert.match(
    blocked.body.message,
    /blocked by the security scan because the PDF contains scripts/,
  );
  assert.match(blocked.body.message, /A manager has been told and can approve it\./);

  const record = await BlockedUpload.findOne({});
  assert.equal(record.reviewable, true);
  assert.equal(record.status, "blocked");
  assert.equal(await Notification.countDocuments(), 3);

  const again = await evidenceRequest("POST", path, {
    role: "employee",
    ...file,
  });
  assert.equal(again.status, 400);
  assert.match(again.body.message, /already been told/);
  assert.equal(await BlockedUpload.countDocuments(), 1);
  assert.equal(await Notification.countDocuments(), 3);

  const alert = await Notification.findOne({ user: users.groupManager._id });
  assert.match(alert.content, /Review this file and approve or decline it/);

  const opened = await openReport(record, users.groupManager.id);
  assert.equal(opened.status, 200);
  assert.match(opened.headers.get("content-security-policy"), /form-action 'self'/);
  assert.match(opened.html, /Approve this file/);
  const token = /name="token" value="([^"]+)"/.exec(opened.html)[1];

  const unconfirmed = await decide(record.id, { token, decision: "approve" });
  assert.equal(unconfirmed.status, 400);
  assert.equal((await BlockedUpload.findById(record.id)).status, "blocked");

  const approved = await decide(record.id, {
    token,
    decision: "approve",
    confirm: "yes",
  });
  assert.equal(approved.status, 200);
  assert.match(approved.html, /File approved/);
  assert.match(approved.headers.get("cache-control"), /no-store/);

  const after = await BlockedUpload.findById(record.id);
  assert.equal(after.status, "approved");
  assert.equal(after.decidedBy.toString(), users.groupManager.id);
  assert.equal(after.decidedByName, "groupManager Test");
  const windowHours = (after.approvalExpiresAt - after.decidedAt) / 3600000;
  assert.ok(windowHours > 47.9 && windowHours < 48.1);
  assert.ok(after.expireAt - Date.now() > 80 * 24 * 3600000);

  const senderNotes = await Notification.find({ user: users.employee._id });
  assert.equal(senderNotes.length, 1);
  assert.equal(senderNotes[0].category, "okr");
  assert.match(senderNotes[0].content, /Your file was approved/);
  assert.match(senderNotes[0].content, /within 48 hours/);
  for (const manager of [users.owner, users.manager]) {
    const notes = await Notification.find({ user: manager._id });
    assert.equal(notes.length, 2);
    assert.match(notes[1].content, /groupManager Test approved the blocked upload/);
  }
  assert.equal(await Notification.countDocuments({ user: users.groupManager._id }), 1);

  const reopened = await openReport(record, users.groupManager.id);
  assert.match(reopened.html, /A manager approved this file/);
  assert.equal(reopened.html.includes("<form"), false);
  const twice = await decide(record.id, { token, decision: "approve", confirm: "yes" });
  assert.equal(twice.status, 409);
  assert.match(twice.html, /Already decided/);

  const uploaded = await evidenceRequest("POST", path, {
    role: "employee",
    ...file,
  });
  assert.equal(uploaded.status, 201);
  assert.equal(await Evidence.countDocuments({ keyResult: key._id }), 1);

  const used = await BlockedUpload.findById(record.id);
  assert.equal(used.status, "used");
  assert.ok(used.usedAt);
  assert.equal(used.usedEvidence.toString(), uploaded.body.id);

  const reuse = await evidenceRequest("POST", path, {
    role: "employee",
    ...file,
  });
  assert.equal(reuse.status, 400);
  assert.equal(await Evidence.countDocuments({ keyResult: key._id }), 1);
  assert.equal(await BlockedUpload.countDocuments(), 2);
});

test("an approval only works for the same file, sender, key result and time window", async () => {
  const key = await assignedKey("Bound key");
  const otherKey = await assignedKey("Other key");
  const file = reviewableFile();

  assert.equal(
    (await evidenceRequest("POST", evidencePathFor(key), { role: "employee", ...file })).status,
    400,
  );
  const record = await BlockedUpload.findOne({});
  assert.equal((await approveAs(record, users.groupManager)).status, 200);

  const changed = await evidenceRequest("POST", evidencePathFor(key), {
    role: "employee",
    ...file,
    body: Buffer.from("%PDF-1.4\n<< /S /Launch /F (other.exe) >>"),
  });
  assert.equal(changed.status, 400);

  const elsewhere = await evidenceRequest("POST", evidencePathFor(otherKey), {
    role: "employee",
    ...file,
  });
  assert.equal(elsewhere.status, 400);

  const someoneElse = await evidenceRequest("POST", evidencePathFor(key), {
    role: "owner",
    ...file,
  });
  assert.equal(someoneElse.status, 400);

  await BlockedUpload.updateOne(
    { _id: record._id },
    { approvalExpiresAt: new Date(Date.now() - 1000) },
  );
  const expired = await evidenceRequest("POST", evidencePathFor(key), {
    role: "employee",
    ...file,
  });
  assert.equal(expired.status, 400);
  assert.equal((await BlockedUpload.findById(record._id)).status, "approved");
  assert.equal(await Evidence.countDocuments({}), 0);

  await BlockedUpload.updateOne(
    { _id: record._id },
    { approvalExpiresAt: new Date(Date.now() + 3600000) },
  );
  const valid = await evidenceRequest("POST", evidencePathFor(key), {
    role: "employee",
    ...file,
  });
  assert.equal(valid.status, 201);
  assert.equal((await BlockedUpload.findById(record._id)).status, "used");
});

test("final blocks cannot be approved and say so", async () => {
  const key = await assignedKey("Final key");
  const eicar = [
    "X5O!P%@AP[4\\PZX54(P^)7CC)7}",
    "$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!",
    "$H+H*",
  ].join("");

  const blocked = await evidenceRequest("POST", evidencePathFor(key), {
    role: "employee",
    filename: "notes.txt",
    mimetype: "text/plain",
    body: Buffer.from(eicar),
  });
  assert.equal(blocked.status, 400);
  assert.match(blocked.body.message, /blocked by the security scan/);
  assert.equal(blocked.body.message.includes("can approve"), false);

  const record = await BlockedUpload.findOne({});
  assert.equal(record.reviewable, false);

  const alert = await Notification.findOne({ user: users.groupManager._id });
  assert.match(alert.content, />Open the safe report<\/a>/);
  assert.equal(alert.content.includes("approve or decline"), false);

  const page = await openReport(record, users.groupManager.id);
  assert.match(page.html, /This block is final/);
  assert.equal(page.html.includes("<form"), false);

  const forced = await approveAs(record, users.groupManager);
  assert.equal(forced.status, 409);
  assert.equal((await BlockedUpload.findById(record.id)).status, "blocked");

  const retry = await evidenceRequest("POST", evidencePathFor(key), {
    role: "employee",
    filename: "notes.txt",
    mimetype: "text/plain",
    body: Buffer.from(eicar),
  });
  assert.equal(retry.status, 400);
  assert.equal(await BlockedUpload.countDocuments(), 1);
  assert.equal((await BlockedUpload.findById(record.id)).attempts, 2);
  assert.equal(await Notification.countDocuments(), 2);
});

test("declining keeps the file blocked and tells the sender", async () => {
  const key = await assignedKey("Decline key");
  const file = reviewableFile();

  await evidenceRequest("POST", evidencePathFor(key), { role: "employee", ...file });
  const record = await BlockedUpload.findOne({});

  const declined = await decide(record.id, {
    token: blockedReports.signDecisionToken(record.id, users.groupManager.id),
    decision: "decline",
  });
  assert.equal(declined.status, 200);
  assert.match(declined.html, /File declined/);

  const after = await BlockedUpload.findById(record.id);
  assert.equal(after.status, "declined");
  assert.equal(after.decidedBy.toString(), users.groupManager.id);
  assert.equal(after.approvalExpiresAt, undefined);

  const notes = await Notification.find({ user: users.employee._id });
  assert.equal(notes.length, 1);
  assert.match(notes[0].content, /Your file was declined/);

  const reopened = await openReport(record, users.groupManager.id);
  assert.match(reopened.html, /This file was declined/);
  assert.equal(reopened.html.includes("<form"), false);

  assert.equal((await approveAs(record, users.groupManager)).status, 409);
  assert.equal((await BlockedUpload.findById(record.id)).status, "declined");

  const retry = await evidenceRequest("POST", evidencePathFor(key), {
    role: "employee",
    ...file,
  });
  assert.equal(retry.status, 400);
  assert.match(retry.body.message, /A manager has already declined it\.$/);
  assert.equal(retry.body.message.includes("can approve"), false);
  assert.equal(await BlockedUpload.countDocuments(), 1);
  assert.equal((await BlockedUpload.findById(record.id)).attempts, 2);
  assert.equal(await Evidence.countDocuments({}), 0);

  const elsewhere = await assignedKey("Another key");
  const other = await evidenceRequest("POST", evidencePathFor(elsewhere), {
    role: "employee",
    ...file,
  });
  assert.match(other.body.message, /already declined it/);
  assert.equal(await BlockedUpload.countDocuments(), 1);
});

test("decisions reject missing, forged, expired, wrong-report, sender and unauthorised tokens", async () => {
  users.outsider = await User.create({
    firstName: "outside",
    lastName: "Test",
    email: "outside@example.test",
    password: "test-hash",
    roles: ["employee"],
    exec: "no",
  });
  const key = await assignedKey("Guarded key");
  await evidenceRequest("POST", evidencePathFor(key), {
    role: "employee",
    ...reviewableFile(),
  });
  const record = await BlockedUpload.findOne({});
  const tokenFor = (user, options) =>
    blockedReports.signDecisionToken(record.id, user.id, options);

  const attempts = [
    undefined,
    "",
    "garbage",
    tokenFor(users.groupManager, { expiresIn: -10 }),
    blockedReports.signDecisionToken(id(), users.groupManager.id),
    tokenFor(users.employee),
    tokenFor(users.outsider),
    blockedReports.signReportToken(record.id, users.groupManager.id),
    jwt.sign({ id: users.groupManager.id }, secret),
  ];
  for (const token of attempts) {
    const fields = { decision: "approve", confirm: "yes" };
    if (token !== undefined) fields.token = token;
    const result = await decide(record.id, fields);
    assert.equal(result.status, 403);
  }
  assert.equal((await BlockedUpload.findById(record.id)).status, "blocked");

  const doubled = await fetch(
    base + "/api/okr/blocked-uploads/" + record.id + "/decision",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:
        "token=" +
        tokenFor(users.groupManager) +
        "&token=" +
        tokenFor(users.groupManager) +
        "&decision=approve&confirm=yes",
    },
  );
  assert.equal(doubled.status, 403);

  const maybe = await decide(record.id, {
    token: tokenFor(users.groupManager),
    decision: "maybe",
  });
  assert.equal(maybe.status, 400);

  assert.equal(
    (await fetch(base + "/api/okr/blocked-uploads/not-an-id/decision", { method: "POST" })).status,
    403,
  );
  const missingId = id();
  assert.equal(
    (
      await decide(missingId, {
        token: blockedReports.signDecisionToken(missingId, users.owner.id),
        decision: "approve",
        confirm: "yes",
      })
    ).status,
    404,
  );
  assert.equal((await BlockedUpload.findById(record.id)).status, "blocked");

  const stale = tokenFor(users.groupManager);
  await Group.updateOne({ _id: sales._id }, { manager: null });
  assert.equal(
    (await decide(record.id, { token: stale, decision: "approve", confirm: "yes" })).status,
    403,
  );
  assert.equal((await BlockedUpload.findById(record.id)).status, "blocked");
  assert.equal((await approveAs(record, users.owner)).status, 200);
  assert.equal((await BlockedUpload.findById(record.id)).decidedBy.toString(), users.owner.id);
});

test("a failed save gives the approval back so the sender can try again", async () => {
  const key = await assignedKey("Full key");
  const file = reviewableFile();

  await evidenceRequest("POST", evidencePathFor(key), { role: "employee", ...file });
  const record = await BlockedUpload.findOne({});
  assert.equal((await approveAs(record, users.groupManager)).status, 200);

  await Evidence.insertMany(
    Array.from({ length: 10 }, (_, index) => ({
      objective: objective._id,
      keyResult: key._id,
      filename: "filler-" + index + ".txt",
      mimetype: "text/plain",
      size: 1,
      data: Buffer.from("x"),
      uploadedBy: users.owner._id,
    })),
  );

  const full = await evidenceRequest("POST", evidencePathFor(key), {
    role: "employee",
    ...file,
  });
  assert.equal(full.status, 400);
  assert.match(full.body.message, /already has 10 evidence files/);
  assert.equal((await BlockedUpload.findById(record.id)).status, "approved");

  await Evidence.updateOne({ keyResult: key._id }, { deleted: true });
  const retry = await evidenceRequest("POST", evidencePathFor(key), {
    role: "employee",
    ...file,
  });
  assert.equal(retry.status, 201);
  assert.equal((await BlockedUpload.findById(record.id)).status, "used");
});

test("two uploads racing for one approval let exactly one through", async () => {
  const key = await assignedKey("Race key");
  const file = reviewableFile();

  await evidenceRequest("POST", evidencePathFor(key), { role: "employee", ...file });
  const record = await BlockedUpload.findOne({});
  assert.equal((await approveAs(record, users.groupManager)).status, 200);

  const results = await Promise.all([
    evidenceRequest("POST", evidencePathFor(key), { role: "employee", ...file }),
    evidenceRequest("POST", evidencePathFor(key), { role: "employee", ...file }),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 400]);
  assert.equal(await Evidence.countDocuments({ keyResult: key._id }), 1);
});

async function withEngine(answer, settings, run) {
  const seen = [];
  const engine = net.createServer((socket) => {
    let received = Buffer.alloc(0);
    socket.on("error", () => {});
    socket.on("data", (chunk) => {
      received = Buffer.concat([received, chunk]);
      if (received.subarray(-4).equals(Buffer.alloc(4))) {
        seen.push(received.length);
        const reply = answer(received);
        if (reply !== null) {
          socket.end(reply);
        }
      }
    });
  });
  await new Promise((resolve) => engine.listen(0, "127.0.0.1", resolve));

  const saved = { ...process.env };
  Object.assign(process.env, {
    CLAMAV_HOST: "127.0.0.1",
    CLAMAV_PORT: String(engine.address().port),
    CLAMAV_REQUIRED: "false",
    ...settings,
  });

  try {
    return await run(seen);
  } finally {
    for (const name of ["CLAMAV_HOST", "CLAMAV_PORT", "CLAMAV_REQUIRED", "CLAMAV_TIMEOUT_MS"]) {
      if (saved[name] === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = saved[name];
      }
    }
    engine.close();
  }
}

const cleanFile = () => ({
  filename: "notes.txt",
  mimetype: "text/plain",
  body: Buffer.from("weekly notes"),
});

test("a clean answer from the antivirus engine lets a normal file through", async () => {
  const key = await assignedKey("Engine clean key");

  await withEngine(() => "stream: OK\0", {}, async (seen) => {
    const response = await evidenceRequest("POST", evidencePathFor(key), {
      role: "employee",
      ...cleanFile(),
    });

    assert.equal(response.status, 201);
    assert.equal(seen.length, 1);
  });
});

test("a file found by the antivirus engine is blocked for good and managers are told", async () => {
  users.employee.supervisor = users.manager._id;
  await users.employee.save();
  const key = await assignedKey("Engine found key");

  await withEngine(() => "stream: Win.Trojan.Demo-1 FOUND\0", {}, async () => {
    const response = await evidenceRequest("POST", evidencePathFor(key), {
      role: "employee",
      ...cleanFile(),
    });

    assert.equal(response.status, 400);
    assert.equal(
      response.body.message,
      "This file was blocked by the security scan because the antivirus engine found Win.Trojan.Demo-1.",
    );
  });

  assert.equal(await Evidence.countDocuments({ keyResult: key._id }), 0);
  const record = await BlockedUpload.findOne({});
  assert.equal(record.reviewable, false);
  assert.match(record.threat, /Win\.Trojan\.Demo-1/);
  assert.equal(await Notification.countDocuments(), 3);

  const alert = await Notification.findOne({ user: users.groupManager._id });
  assert.match(alert.content, /Open the safe report/);
  assert.match(alert.content, /Win\.Trojan\.Demo-1/);
});

test("the antivirus engine still checks a file that a manager approved", async () => {
  const key = await assignedKey("Engine approved key");
  const file = reviewableFile();

  await evidenceRequest("POST", evidencePathFor(key), { role: "employee", ...file });
  const record = await BlockedUpload.findOne({});
  assert.equal((await approveAs(record, users.groupManager)).status, 200);

  await withEngine(() => "stream: Pdf.Exploit.Demo FOUND\0", {}, async () => {
    const response = await evidenceRequest("POST", evidencePathFor(key), {
      role: "employee",
      ...file,
    });

    assert.equal(response.status, 400);
    assert.match(response.body.message, /antivirus engine found Pdf\.Exploit\.Demo/);
  });

  assert.equal((await BlockedUpload.findById(record.id)).status, "approved");
  assert.equal(await Evidence.countDocuments({ keyResult: key._id }), 0);

  const retry = await evidenceRequest("POST", evidencePathFor(key), {
    role: "employee",
    ...file,
  });
  assert.equal(retry.status, 201);
});

test("an engine that is down blocks uploads only when it is required", async () => {
  const key = await assignedKey("Engine down key");

  await withEngine(() => "ERROR\0", { CLAMAV_REQUIRED: "true" }, async () => {
    const response = await evidenceRequest("POST", evidencePathFor(key), {
      role: "employee",
      ...cleanFile(),
    });

    assert.equal(response.status, 503);
    assert.match(response.body.message, /not available right now/);
    assert.equal(response.body.message.includes("blocked by the security scan"), false);
  });

  assert.equal(await BlockedUpload.countDocuments(), 0);
  assert.equal(await Notification.countDocuments(), 0);
  assert.equal(await Evidence.countDocuments({ keyResult: key._id }), 0);

  await withEngine(() => "ERROR\0", {}, async () => {
    const response = await evidenceRequest("POST", evidencePathFor(key), {
      role: "employee",
      ...cleanFile(),
    });

    assert.equal(response.status, 201);
  });
});

test("a file with a program inside never reaches the antivirus engine", async () => {
  const key = await assignedKey("Engine skipped key");

  await withEngine(() => "stream: OK\0", {}, async (seen) => {
    const response = await evidenceRequest("POST", evidencePathFor(key), {
      role: "employee",
      filename: "notes.txt",
      mimetype: "text/plain",
      body: Buffer.from("This program cannot be run in DOS mode"),
    });

    assert.equal(response.status, 400);
    assert.equal(seen.length, 0);
  });
});

const eicarText = [
  "X5O!P%@AP[4\\PZX54(P^)7CC)7}",
  "$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!",
  "$H+H*",
].join("");

const numberedFile = (number, filename = "form" + number + ".pdf") => ({
  filename,
  mimetype: "application/pdf",
  body: Buffer.from(
    "%PDF-1.4\n<< /S /Launch /F (cmd" + number + ".exe) >>",
  ),
});

const finalFile = (number = 0) => ({
  filename: "notes.txt",
  mimetype: "text/plain",
  body: Buffer.from(eicarText + number),
});

const onThisServer = (href) => {
  const url = new URL(href.replace(/&amp;/g, "&"));
  return base + url.pathname + url.search;
};

const repeatAlerts = (user) =>
  Notification.find({ user: user._id, content: /repeated blocked uploads/ });

test("three different blocked files in a day tell the admins and executives once", async () => {
  const key = await assignedKey("Spray key");

  for (const number of [1, 2]) {
    await evidenceRequest("POST", evidencePathFor(key), {
      role: "employee",
      ...numberedFile(number),
    });
  }
  assert.equal((await repeatAlerts(users.admin)).length, 0);

  await evidenceRequest("POST", evidencePathFor(key), {
    role: "employee",
    ...numberedFile(3),
  });

  for (const admin of [users.admin, users.exec]) {
    const alerts = await repeatAlerts(admin);
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].category, "error");
    assert.match(alerts[0].content, /Sent by: employee Test \(employee@example\.test\)/);
    assert.match(alerts[0].content, /Files blocked in the last 24 hours: 3/);
    const href = /href="([^"]+)"/.exec(alerts[0].content)[1];
    const audit = await fetch(onThisServer(href));
    assert.equal(audit.status, 200);
    assert.match(await audit.text(), /form3\.pdf/);
  }

  await evidenceRequest("POST", evidencePathFor(key), {
    role: "employee",
    ...numberedFile(4),
  });
  assert.equal((await repeatAlerts(users.admin)).length, 1);
  assert.equal(await BlockedUpload.countDocuments({ escalated: true }), 1);
  assert.equal((await repeatAlerts(users.owner)).length, 0);
  assert.equal(
    await Notification.countDocuments({ user: users.owner._id }),
    4,
  );
});

test("one blocked file sent again and again counts attempts and tells the admins once", async () => {
  const key = await assignedKey("Hammer key");

  for (let attempt = 1; attempt <= 4; attempt++) {
    const response = await evidenceRequest("POST", evidencePathFor(key), {
      role: "employee",
      ...finalFile(),
    });
    assert.equal(response.status, 400);
  }
  assert.equal((await repeatAlerts(users.admin)).length, 0);

  await evidenceRequest("POST", evidencePathFor(key), { role: "employee", ...finalFile() });
  await evidenceRequest("POST", evidencePathFor(key), { role: "employee", ...finalFile() });

  const record = await BlockedUpload.findOne({});
  assert.equal(await BlockedUpload.countDocuments(), 1);
  assert.equal(record.attempts, 6);
  assert.equal((await repeatAlerts(users.admin)).length, 1);
  assert.match((await repeatAlerts(users.admin))[0].content, /Attempts with the latest file: 5/);
  assert.equal(await Notification.countDocuments({ user: users.owner._id }), 1);
});

test("files that a manager approved do not count towards the repeat alert", async () => {
  const key = await assignedKey("Approved key");

  for (const number of [1, 2]) {
    const file = numberedFile(number);
    await evidenceRequest("POST", evidencePathFor(key), { role: "employee", ...file });
    const record = await BlockedUpload.findOne({ filename: file.filename });
    assert.equal((await approveAs(record, users.groupManager)).status, 200);
    assert.equal(
      (await evidenceRequest("POST", evidencePathFor(key), { role: "employee", ...file })).status,
      201,
    );
  }

  await evidenceRequest("POST", evidencePathFor(key), {
    role: "employee",
    ...numberedFile(3),
  });
  assert.equal((await repeatAlerts(users.admin)).length, 0);
});

test("a sender who is an admin never alerts themselves", async () => {
  const key = await assignedKey("Admin sender key", users.admin._id);

  for (const number of [1, 2, 3]) {
    await evidenceRequest("POST", evidencePathFor(key), {
      role: "admin",
      ...numberedFile(number),
    });
  }

  assert.equal((await repeatAlerts(users.admin)).length, 0);
  assert.equal((await repeatAlerts(users.exec)).length, 1);
});

async function openAudit(user, query = {}) {
  const params = new URLSearchParams({
    token: blockedReports.signAuditToken(user.id),
    ...query,
  });
  const response = await fetch(base + "/api/okr/blocked-uploads?" + params);
  return {
    status: response.status,
    html: await response.text(),
    headers: response.headers,
  };
}

const chipCount = (html, label) =>
  Number(new RegExp(label + " \\((\\d+)\\)").exec(html)[1]);

async function twoObjectivesWithBlocks() {
  const otherOwner = await User.create({
    firstName: "other",
    lastName: "Owner",
    email: "other-owner@example.test",
    password: "test-hash",
    roles: ["employee"],
    exec: "no",
  });
  const second = await Objective.create({
    title: "Marketing goal",
    owner: otherOwner._id,
    group: "Marketing",
    dueDate: "2026-12-01",
  });
  const mineKey = await assignedKey("Mine key");
  const otherKey = await KeyResult.create({
    objective: second._id,
    title: "Other key",
    weight: 30,
    assignedTo: users.employee._id,
    dueDate: "2026-12-01",
  });

  await evidenceRequest("POST", evidencePathFor(mineKey), {
    role: "employee",
    ...numberedFile(1, "sales-form.pdf"),
  });
  await evidenceRequest(
    "POST",
    "/api/okr/objectives/" + second.id + "/key-results/" + otherKey.id + "/evidence",
    { role: "employee", ...numberedFile(2, "marketing-form.pdf") },
  );

  return { otherOwner, mineKey, otherKey };
}

test("the audit page only shows the uploads each person is allowed to review", async () => {
  const { otherOwner } = await twoObjectivesWithBlocks();

  const seen = async (user) => {
    const page = await openAudit(user);
    assert.equal(page.status, 200);
    return [
      page.html.includes("sales-form.pdf"),
      page.html.includes("marketing-form.pdf"),
    ];
  };

  assert.deepEqual(await seen(users.groupManager), [true, false]);
  assert.deepEqual(await seen(users.owner), [true, false]);
  assert.deepEqual(await seen(otherOwner), [false, true]);
  assert.deepEqual(await seen(users.admin), [true, true]);
  assert.deepEqual(await seen(users.exec), [true, true]);
  assert.deepEqual(await seen(users.employee), [false, false]);
  assert.deepEqual(await seen(users.manager), [false, false]);
});

test("a supervisor sees the uploads of the people they supervise", async () => {
  users.employee.supervisor = users.manager._id;
  await users.employee.save();
  await twoObjectivesWithBlocks();

  const page = await openAudit(users.manager);
  assert.equal(page.status, 200);
  assert.match(page.html, /sales-form\.pdf/);
  assert.match(page.html, /marketing-form\.pdf/);
});

test("the audit page refuses missing, forged, expired and wrong-purpose tokens", async () => {
  await twoObjectivesWithBlocks();
  const record = await BlockedUpload.findOne({});
  const bad = [
    undefined,
    "",
    "garbage",
    blockedReports.signAuditToken(users.admin.id, { expiresIn: -10 }),
    blockedReports.signReportToken(record.id, users.admin.id),
    blockedReports.signDecisionToken(record.id, users.admin.id),
    blockedReports.signAuditToken(id()),
    jwt.sign({ id: users.admin.id }, secret),
  ];

  for (const token of bad) {
    const response = await fetch(
      base + "/api/okr/blocked-uploads" + (token === undefined ? "" : "?token=" + encodeURIComponent(token)),
    );
    assert.equal(response.status, 403);
    assert.equal((await response.text()).includes("sales-form.pdf"), false);
  }

  const noQuery = await fetch(base + "/api/okr/blocked-uploads?token[$ne]=x");
  assert.equal(noQuery.status, 403);
});

test("the audit page sends safe headers and escapes everything it shows", async () => {
  users.employee.firstName = "<b>Eve</b>";
  await users.employee.save();
  const key = await assignedKey("Escape key");
  await evidenceRequest("POST", evidencePathFor(key), {
    role: "employee",
    ...numberedFile(1, "<img src=x onerror=alert(1)>.pdf"),
  });

  const page = await openAudit(users.admin, { q: '"><script>alert(1)</script>' });
  assert.equal(page.status, 200);
  assert.equal(page.html.includes("<script>alert(1)"), false);
  assert.match(page.headers.get("content-security-policy"), /default-src 'none'/);
  assert.match(page.headers.get("cache-control"), /no-store/);

  const all = await openAudit(users.admin);
  assert.equal(all.html.includes("<img src=x"), false);
  assert.equal(all.html.includes("<b>Eve</b>"), false);
  assert.match(all.html, /&lt;img src=x onerror=alert\(1\)&gt;\.pdf/);
});

test("the audit page filters by outcome and searches without breaking on odd input", async () => {
  await twoObjectivesWithBlocks();
  const salesRecord = await BlockedUpload.findOne({ filename: "sales-form.pdf" });
  assert.equal((await approveAs(salesRecord, users.groupManager)).status, 200);
  await evidenceRequest("POST", evidencePathFor(await KeyResult.findById(salesRecord.keyResult)), {
    role: "employee",
    ...numberedFile(1, "sales-form.pdf"),
  });
  await evidenceRequest("POST", evidencePathFor(await assignedKey("Final key")), {
    role: "employee",
    ...finalFile(),
  });

  const all = await openAudit(users.admin);
  assert.equal(chipCount(all.html, "All"), 3);
  assert.equal(chipCount(all.html, "Waiting"), 1);
  assert.equal(chipCount(all.html, "Blocked for good"), 1);
  assert.equal(chipCount(all.html, "Approved"), 1);
  assert.equal(chipCount(all.html, "Declined"), 0);

  const waiting = await openAudit(users.admin, { status: "waiting" });
  assert.match(waiting.html, /marketing-form\.pdf/);
  assert.equal(waiting.html.includes("sales-form.pdf"), false);

  const approved = await openAudit(users.admin, { status: "approved" });
  assert.match(approved.html, /sales-form\.pdf/);
  assert.match(approved.html, /Approved and used/);
  assert.match(approved.html, /by groupManager Test/);

  const searched = await openAudit(users.admin, { q: "MARKETING" });
  assert.match(searched.html, /marketing-form\.pdf/);
  assert.equal(searched.html.includes("sales-form.pdf"), false);
  assert.equal(chipCount(searched.html, "All"), 1);

  const bySender = await openAudit(users.admin, { q: "employee@example.test" });
  assert.equal(chipCount(bySender.html, "All"), 3);

  for (const odd of ["(", ".*", "[", "\\", "a|b", "$", "x".repeat(500)]) {
    const result = await openAudit(users.admin, { q: odd });
    assert.equal(result.status, 200);
  }
  assert.equal((await openAudit(users.admin, { q: ".*" })).html.includes("sales-form.pdf"), false);

  const inject = await fetch(
    base +
      "/api/okr/blocked-uploads?token=" +
      encodeURIComponent(blockedReports.signAuditToken(users.admin.id)) +
      "&status[$ne]=x&q[$ne]=x&page[$gt]=1",
  );
  assert.equal(inject.status, 200);
  assert.equal(chipCount(await inject.text(), "All"), 3);
});

test("the audit page splits long lists into pages and keeps odd page numbers safe", async () => {
  const key = await assignedKey("Long key");
  await BlockedUpload.insertMany(
    Array.from({ length: 30 }, (_, index) => ({
      objective: objective._id,
      keyResult: key._id,
      uploadedBy: users.employee._id,
      senderName: "employee Test",
      senderEmail: "employee@example.test",
      filename: "bulk-" + String(index).padStart(2, "0") + ".pdf",
      size: 10,
      sha256: "f".repeat(63) + (index % 10),
      threat: "the PDF contains scripts, launch actions or embedded files",
      reviewable: true,
      createdAt: new Date(Date.now() - index * 60000),
    })),
  );

  const first = await openAudit(users.admin);
  assert.match(first.html, /Page 1 of 2/);
  assert.match(first.html, /bulk-00\.pdf/);
  assert.equal(first.html.includes("bulk-29.pdf"), false);
  assert.equal(first.html.includes(">Newer<"), false);
  assert.match(first.html, />Older</);

  const second = await openAudit(users.admin, { page: "2" });
  assert.match(second.html, /Page 2 of 2/);
  assert.match(second.html, /bulk-29\.pdf/);
  assert.match(second.html, />Newer</);
  assert.equal(second.html.includes(">Older<"), false);

  for (const odd of ["0", "-3", "999", "abc", "1.5", "NaN"]) {
    const result = await openAudit(users.admin, { page: odd });
    assert.equal(result.status, 200);
    assert.match(result.html, /Page \d of 2/);
  }
});

test("every blocked-upload alert links to an audit page the manager can open", async () => {
  await evidenceRequest("POST", evidencePathFor(await assignedKey("Link key")), {
    role: "employee",
    ...numberedFile(1),
  });

  const alert = await Notification.findOne({ user: users.groupManager._id });
  assert.match(alert.content, /View all blocked uploads/);
  const hrefs = [...alert.content.matchAll(/href="([^"]+)"/g)].map((match) =>
    onThisServer(match[1]),
  );
  assert.equal(hrefs.length, 2);
  assert.equal(
    [...alert.content.matchAll(/style="color:#1b4fd6;[^"]*underline"/g)].length,
    2,
  );

  const audit = await fetch(hrefs[1]);
  assert.equal(audit.status, 200);
  const html = await audit.text();
  assert.match(html, /form1\.pdf/);
  const rowLink = /href="([^"]+blocked-uploads\/[a-f0-9]{24}\?[^"]+)"/.exec(html)[1];
  assert.equal((await fetch(onThisServer(rowLink))).status, 200);
});

test("a report shows the sender's earlier blocks, the attempts and what to check", async () => {
  const key = await assignedKey("History key");
  await evidenceRequest("POST", evidencePathFor(key), { role: "employee", ...numberedFile(1, "first.pdf") });
  await evidenceRequest("POST", evidencePathFor(key), { role: "employee", ...numberedFile(2, "second.pdf") });
  await evidenceRequest("POST", evidencePathFor(key), { role: "employee", ...numberedFile(2, "second.pdf") });

  const first = await openReport(await BlockedUpload.findOne({ filename: "first.pdf" }), users.groupManager.id);
  assert.match(first.html, /Earlier blocks from this sender/);
  assert.match(first.html, /second\.pdf/);
  assert.equal(first.html.includes("Attempts"), false);

  const second = await openReport(await BlockedUpload.findOne({ filename: "second.pdf" }), users.groupManager.id);
  assert.match(second.html, /<dt>Attempts<\/dt><dd class="warn">2, the latest on /);
  assert.match(second.html, /first\.pdf/);
  assert.match(second.html, /What to check:/);
  assert.match(second.html, /\/Launch found 1 time\. The first one reads: &quot;\/Launch \/F \(cmd2\.exe\)/);

  const lonely = await openReport(await BlockedUpload.findOne({ filename: "first.pdf" }), users.owner.id);
  assert.equal(lonely.status, 200);
});

test("a final block gets no advice and a lone block says there is no history", async () => {
  await evidenceRequest("POST", evidencePathFor(await assignedKey("Lone key")), {
    role: "employee",
    ...finalFile(),
  });

  const page = await openReport(await BlockedUpload.findOne({}), users.groupManager.id);
  assert.equal(page.html.includes("What to check"), false);
  assert.match(page.html, /No other blocked uploads from this sender are on record/);
});

test("an admin can read any report but only the managers can decide", async () => {
  await evidenceRequest("POST", evidencePathFor(await assignedKey("Admin view key")), {
    role: "employee",
    ...numberedFile(1),
  });
  const record = await BlockedUpload.findOne({});

  for (const viewer of [users.admin, users.exec]) {
    const page = await openReport(record, viewer.id);
    assert.equal(page.status, 200);
    assert.match(page.html, /Waiting for a decision/);
    assert.equal(page.html.includes("<form"), false);

    const forced = await decide(record.id, {
      token: blockedReports.signDecisionToken(record.id, viewer.id),
      decision: "approve",
      confirm: "yes",
    });
    assert.equal(forced.status, 403);
  }

  assert.equal((await BlockedUpload.findById(record.id)).status, "blocked");
  assert.equal((await openReport(record, users.employee.id)).status, 403);
  assert.equal((await openReport(record, users.manager.id)).status, 403);
});

test("the same file sent many times at once is reported to managers only once", async () => {
  const key = await assignedKey("Burst key");
  const file = reviewableFile();

  const results = await Promise.all(
    Array.from({ length: 8 }, () =>
      evidenceRequest("POST", evidencePathFor(key), { role: "employee", ...file }),
    ),
  );

  assert.deepEqual([...new Set(results.map((result) => result.status))], [400]);
  assert.equal(await BlockedUpload.countDocuments({ keyResult: key._id }), 1);
  const alerts = await Notification.find({ category: "error" });
  assert.equal(
    alerts.length,
    new Set(alerts.map((alert) => String(alert.user))).size,
  );
});

test("a reviewable block with nobody to approve it makes no promise", async () => {
  await User.deleteMany({ _id: { $in: [users.admin._id, users.exec._id] } });
  const lonely = await Objective.create({
    title: "No manager",
    owner: users.owner._id,
    group: "Marketing",
    dueDate: "2026-12-01",
  });
  const key = await KeyResult.create({
    objective: lonely._id,
    title: "Lonely key",
    weight: 30,
    dueDate: "2026-12-01",
  });

  const response = await evidenceRequest(
    "POST",
    "/api/okr/objectives/" + lonely.id + "/key-results/" + key.id + "/evidence",
    { role: "owner", ...reviewableFile() },
  );
  assert.equal(response.status, 400);
  assert.match(response.body.message, /blocked by the security scan/);
  assert.equal(response.body.message.includes("can approve"), false);
  assert.equal(await BlockedUpload.countDocuments(), 0);
});

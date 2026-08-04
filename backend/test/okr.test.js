// Tests for the OKR module, run with node --test against a MongoDB from MONGO_URI.
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

// A fixed secret for tests so we can sign tokens the protect middleware trusts.
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret";

const okrRoutes = require("../routes/okrRoutes");
const { errorHandler } = require("../middleware/errorMiddleware");
const User = require("../models/userModel");
const OkrObjective = require("../models/okrObjectiveModel");
const OkrKeyResult = require("../models/okrKeyResultModel");
const OkrCheckin = require("../models/okrCheckinModel");
const OkrActivity = require("../models/okrActivityModel");
const Notification = require("../models/notificationModel");
const { app: productionApp } = require("../server");

let server;
let productionServer;
let baseUrl;
let productionBaseUrl;
let token;
let employeeToken;
let dueDate;

// Build the app, connect the database, and create a test user before any test.
before(async () => {
  const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/okr_test";
  await mongoose.connect(mongoUri);
  if (!mongoose.connection.name.toLowerCase().includes("test")) {
    throw new Error(
      `Refusing to clear non-test database "${mongoose.connection.name}". Use a MONGO_URI whose database name contains "test".`
    );
  }

  // Start clean so repeated runs are predictable.
  await Promise.all([
    User.deleteMany({}),
    OkrObjective.deleteMany({}),
    OkrKeyResult.deleteMany({}),
    OkrCheckin.deleteMany({}),
    OkrActivity.deleteMany({}),
    Notification.deleteMany({}),
  ]);

  const app = express();
  app.use(express.json());
  app.use("/api/okr", okrRoutes);
  app.use(errorHandler);

  // Listen on a random free port and remember the base URL.
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
  await new Promise((resolve) => {
    productionServer = productionApp.listen(0, () => {
      productionBaseUrl = `http://127.0.0.1:${productionServer.address().port}`;
      resolve();
    });
  });

  // A valid user for the private routes, and a matching token.
  const user = await User.create({
    firstName: "Test",
    lastName: "User",
    email: "test.user@okr.test",
    password: "hashed-not-checked-here",
    roles: ["Manager"],
  });
  token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

  const employee = await User.create({
    firstName: "Test",
    lastName: "Employee",
    email: "test.employee@okr.test",
    password: "hashed-not-checked-here",
    roles: ["employee"],
  });
  employeeToken = jwt.sign({ id: employee._id }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });

  dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
});

after(async () => {
  if (server) await new Promise((r) => server.close(r));
  if (productionServer) {
    await new Promise((r) => productionServer.close(r));
  }
  await mongoose.connection.close();
});

// Small helpers for authed and public JSON requests.
function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}
async function post(path, body) {
  return fetch(baseUrl + path, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
}

test("GET /ping is public and reports the module is up", async () => {
  const res = await fetch(`${baseUrl}/api/okr/ping`);
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.module, "okr");
});

test("production health endpoints and API boundary are machine-readable", async () => {
  let res = await fetch(`${productionBaseUrl}/api/health/live`);
  let data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.ok, true);
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("x-frame-options"), "DENY");
  assert.ok(res.headers.get("x-request-id"));

  res = await fetch(`${productionBaseUrl}/api/health/ready`);
  data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.database, "connected");

  res = await fetch(`${productionBaseUrl}/api/does-not-exist`);
  data = await res.json();
  assert.equal(res.status, 404);
  assert.equal(data.message, "API route not found");
});

test("versioned OKR alias preserves the existing API contract", async () => {
  const res = await fetch(`${productionBaseUrl}/api/v1/okr/ping`);
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.module, "okr");
  assert.ok(res.headers.get("ratelimit-limit"));
});

test("calendar and notification controllers are reachable behind authentication", async () => {
  let res = await fetch(`${productionBaseUrl}/api/calendar/entries`, {
    headers: authHeaders(),
  });
  let data = await res.json();
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(data));

  res = await fetch(`${productionBaseUrl}/api/v1/notifications`, {
    headers: authHeaders(),
  });
  data = await res.json();
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(data.notifications));
});

test("private routes are rejected without a token", async () => {
  const res = await fetch(`${baseUrl}/api/okr/objectives`);
  assert.equal(res.status, 401);
});

test("authentication only accepts the configured JWT algorithm", async () => {
  const user = await User.findOne({ email: "test.user@okr.test" });
  const wrongAlgorithmToken = jwt.sign(
    { id: user._id },
    process.env.JWT_SECRET,
    { algorithm: "HS512", expiresIn: "1h" }
  );
  const res = await fetch(`${baseUrl}/api/okr/objectives`, {
    headers: { Authorization: `Bearer ${wrongAlgorithmToken}` },
  });
  assert.equal(res.status, 401);
});

test("employees cannot create manager-owned OKR structures", async () => {
  const res = await fetch(`${baseUrl}/api/okr/objectives`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${employeeToken}`,
    },
    body: JSON.stringify({
      title: "Should be forbidden",
      type: "team",
      dueDate,
    }),
  });
  assert.equal(res.status, 403);
});

test("invalid progress is rejected at the API boundary", async () => {
  let res = await post("/api/okr/objectives", {
    title: "Validation objective",
    type: "team",
    dueDate,
  });
  const objectiveId = (await res.json())._id;
  res = await post(`/api/okr/objectives/${objectiveId}/key-results`, {
    title: "Validated KR",
    weight: 100,
    progress: 101,
    dueDate,
  });
  assert.equal(res.status, 400);
});

test("full flow: create objective, weighted key results, roll-up, approve", async () => {
  // Create an objective.
  let res = await post("/api/okr/objectives", { title: "Test objective", type: "team", dueDate });
  let objective = await res.json();
  assert.equal(res.status, 201);
  assert.equal(objective.progress, 0);
  const oid = objective._id;

  // Add two key results whose weights total 100.
  res = await post(`/api/okr/objectives/${oid}/key-results`, { title: "A", weight: 60, progress: 50, dueDate });
  assert.equal(res.status, 201);
  res = await post(`/api/okr/objectives/${oid}/key-results`, { title: "B", weight: 40, progress: 0, dueDate });
  const krB = await res.json();
  assert.equal(res.status, 201);

  // A third that breaks 100% must be rejected.
  res = await post(`/api/okr/objectives/${oid}/key-results`, { title: "C", weight: 10, progress: 0, dueDate });
  assert.equal(res.status, 400);

  // Weighted progress: 60% * 50 + 40% * 0 = 30.
  res = await fetch(`${baseUrl}/api/okr/objectives/${oid}`, { headers: authHeaders() });
  let full = await res.json();
  assert.equal(full.objective.progress, 30);
  assert.equal(full.keyResults.length, 2);

  // Move B to 100% -> objective becomes 30 + 40 = 70.
  res = await fetch(`${baseUrl}/api/okr/key-results/${krB._id}/progress`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ progress: 100 }),
  });
  assert.equal(res.status, 200);
  res = await fetch(`${baseUrl}/api/okr/objectives/${oid}`, { headers: authHeaders() });
  full = await res.json();
  assert.equal(full.objective.progress, 70);

  // Approve B and check the stamp is recorded.
  res = await fetch(`${baseUrl}/api/okr/key-results/${krB._id}/approve`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ approved: true }),
  });
  const approved = await res.json();
  assert.equal(approved.approved, true);
  assert.ok(approved.approvedBy);
});

test("GET /summary returns dashboard totals", async () => {
  const res = await fetch(`${baseUrl}/api/okr/summary`, { headers: authHeaders() });
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.ok(data.totalObjectives >= 1);
  assert.ok(typeof data.averageProgress === "number");
  assert.ok(data.statusCounts);
});

test("weight-check reports the running total", async () => {
  // Fresh objective with a single 25% key result.
  let res = await post("/api/okr/objectives", { title: "Weights", type: "team", dueDate });
  const oid = (await res.json())._id;
  await post(`/api/okr/objectives/${oid}/key-results`, { title: "Quarter", weight: 25, dueDate });

  res = await fetch(`${baseUrl}/api/okr/objectives/${oid}/weight-check`, { headers: authHeaders() });
  const data = await res.json();
  assert.equal(data.total, 25);
  assert.equal(data.remaining, 75);
  assert.equal(data.isValid, false);
});

test("check-ins store a history and move the roll-up", async () => {
  // Objective with one key result worth everything.
  let res = await post("/api/okr/objectives", { title: "Check-in objective", type: "team", dueDate });
  const oid = (await res.json())._id;
  res = await post(`/api/okr/objectives/${oid}/key-results`, { title: "The work", weight: 100, dueDate });
  const kr = await res.json();

  // Two dated check-ins with notes.
  res = await post(`/api/okr/key-results/${kr._id}/check-in`, { progress: 30, note: "first push" });
  assert.equal(res.status, 201);
  res = await post(`/api/okr/key-results/${kr._id}/check-in`, { progress: 55, note: "second push" });
  assert.equal(res.status, 201);

  // History comes back oldest-first with both entries.
  res = await fetch(`${baseUrl}/api/okr/key-results/${kr._id}/history`, { headers: authHeaders() });
  const history = await res.json();
  assert.equal(history.length, 2);
  assert.equal(history[0].progress, 30);
  assert.equal(history[1].progress, 55);

  // The objective rolled up to the latest number.
  res = await fetch(`${baseUrl}/api/okr/objectives/${oid}`, { headers: authHeaders() });
  const full = await res.json();
  assert.equal(full.objective.progress, 55);
});

test("forecast reports pace and a verdict", async () => {
  // Backdated so there is real velocity: 10 days in, 50% done, 20 days left.
  const start = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const due = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();
  let res = await post("/api/okr/objectives", { title: "Forecast objective", type: "team", startDate: start, dueDate: due });
  const oid = (await res.json())._id;
  res = await post(`/api/okr/objectives/${oid}/key-results`, { title: "Fast work", weight: 100, progress: 50, dueDate: due });
  assert.equal(res.status, 201);

  res = await fetch(`${baseUrl}/api/okr/objectives/${oid}/forecast`, { headers: authHeaders() });
  const forecast = await res.json();
  assert.equal(res.status, 200);
  assert.equal(forecast.verdict, "on-pace");
  assert.ok(forecast.projectedFinish);
  assert.ok(forecast.velocityPerWeek > 0);
  assert.ok(typeof forecast.requiredPerWeek === "number");
});

test("insights flag setup problems in plain English", async () => {
  // An objective with no key results should produce a warning about it.
  await post("/api/okr/objectives", { title: "Empty objective", type: "team", dueDate });

  const res = await fetch(`${baseUrl}/api/okr/insights`, { headers: authHeaders() });
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.ok(data.count >= 1);
  const texts = data.insights.map((i) => i.text).join(" | ");
  assert.ok(texts.includes("Empty objective"));
});

test("health check reports the database state", async () => {
  const res = await fetch(`${baseUrl}/api/okr/ping`);
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.db, "connected");
  assert.ok(typeof data.uptimeSeconds === "number");
});

test("malformed ids get a clean 400, not a crash", async () => {
  const res = await fetch(`${baseUrl}/api/okr/objectives/not-a-real-id`, { headers: authHeaders() });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.message, /Invalid id/);
});

test("another user cannot read or delete someone else's objective", async () => {
  // Create an objective as the main test user.
  let res = await post("/api/okr/objectives", { title: "Private objective", type: "team", dueDate });
  const oid = (await res.json())._id;

  // Make a second user with no admin rights and their own token.
  const outsider = await User.create({
    firstName: "Out",
    lastName: "Sider",
    email: "outsider@okr.test",
    password: "irrelevant-here",
    roles: ["Member"],
  });
  const outsiderToken = jwt.sign({ id: outsider._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
  const outsiderHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${outsiderToken}` };

  // Reading and deleting must both be refused.
  res = await fetch(`${baseUrl}/api/okr/objectives/${oid}`, { headers: outsiderHeaders });
  assert.ok(res.status === 403 || res.status === 404, `expected 403/404, got ${res.status}`);

  res = await fetch(`${baseUrl}/api/okr/objectives/${oid}`, { method: "DELETE", headers: outsiderHeaders });
  assert.ok(res.status === 403 || res.status === 404, `expected 403/404, got ${res.status}`);

  // The objective is still there for its owner.
  res = await fetch(`${baseUrl}/api/okr/objectives/${oid}`, { headers: authHeaders() });
  assert.equal(res.status, 200);
});

test("NoSQL operator keys are stripped from request bodies", async () => {
  // A body smuggling a $where key must not break anything or reach the DB.
  const res = await post("/api/okr/objectives", {
    title: "Sanitised objective",
    type: "team",
    dueDate,
    $where: "sleep(1000)",
    "nested.key": "bad",
  });
  assert.equal(res.status, 201);
  const objective = await res.json();
  assert.equal(objective.title, "Sanitised objective");
  assert.equal(objective.$where, undefined);
});

test("trend returns a chart-ready series that climbs with check-ins", async () => {
  let res = await post("/api/okr/objectives", { title: "Trend objective", type: "team", dueDate });
  const oid = (await res.json())._id;
  res = await post(`/api/okr/objectives/${oid}/key-results`, { title: "Trend work", weight: 100, dueDate });
  const kr = await res.json();

  await post(`/api/okr/key-results/${kr._id}/check-in`, { progress: 20, note: "start" });
  await post(`/api/okr/key-results/${kr._id}/check-in`, { progress: 60, note: "mid" });

  res = await fetch(`${baseUrl}/api/okr/objectives/${oid}/trend`, { headers: authHeaders() });
  const trend = await res.json();
  assert.equal(res.status, 200);
  // Baseline zero point plus one point per check-in.
  assert.equal(trend.points.length, 3);
  assert.equal(trend.points[0].progress, 0);
  assert.equal(trend.points[1].progress, 20);
  assert.equal(trend.points[2].progress, 60);
});

test("leaderboard ranks assignees with approved work first", async () => {
  const res = await fetch(`${baseUrl}/api/okr/leaderboard`, { headers: authHeaders() });
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(data.leaderboard));
  // Ranks are sequential starting at 1 when anyone is on the board.
  if (data.leaderboard.length > 0) {
    assert.equal(data.leaderboard[0].rank, 1);
    assert.ok(typeof data.leaderboard[0].score === "number");
  }
});

test("objectives and key results can be edited and key results deleted", async () => {
  // Build an objective with two key results, 60/40.
  let res = await post("/api/okr/objectives", { title: "Edit me", type: "team", dueDate });
  const oid = (await res.json())._id;
  res = await post(`/api/okr/objectives/${oid}/key-results`, { title: "Keep", weight: 60, progress: 50, dueDate });
  assert.equal(res.status, 201);
  res = await post(`/api/okr/objectives/${oid}/key-results`, { title: "Remove", weight: 40, progress: 0, dueDate });
  const krToDelete = await res.json();

  // Edit the objective title.
  res = await fetch(`${baseUrl}/api/okr/objectives/${oid}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ title: "Edited title" }),
  });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).title, "Edited title");

  // Editing a weight past the ceiling is refused, 60 stays so this cannot become 50.
  res = await fetch(`${baseUrl}/api/okr/key-results/${krToDelete._id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ weight: 50 }),
  });
  assert.equal(res.status, 400);

  // A legal edit works.
  res = await fetch(`${baseUrl}/api/okr/key-results/${krToDelete._id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ weight: 30, title: "Remove soon" }),
  });
  assert.equal(res.status, 200);

  // Deleting it leaves the 60% key result at 50%, which comes to 30.
  res = await fetch(`${baseUrl}/api/okr/key-results/${krToDelete._id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  assert.equal(res.status, 200);
  res = await fetch(`${baseUrl}/api/okr/objectives/${oid}`, { headers: authHeaders() });
  const full = await res.json();
  assert.equal(full.keyResults.length, 1);
  assert.equal(full.objective.progress, 30);
});

test("completing calendar items drives key result and objective progress", async () => {
  // This is the client brief's headline requirement, so it gets a full check.
  const CalendarEntry = require("../models/calendarEntryModel");

  // Two pieces of calendar work: one finished, one not started.
  const done = await CalendarEntry.create({
    title: "Ship the pilot",
    endTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    completionStatus: "completed",
    progress: 100,
  });
  const notDone = await CalendarEntry.create({
    title: "Write the handover pack",
    endTime: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    completionStatus: "not started",
    progress: 0,
  });

  // An objective with a single key result carrying all the weight.
  let res = await post("/api/okr/objectives", { title: "Calendar-driven", type: "team", dueDate });
  const oid = (await res.json())._id;
  res = await post(`/api/okr/objectives/${oid}/key-results`, {
    title: "Delivery work",
    weight: 100,
    dueDate,
  });
  const kr = await res.json();

  // Link both calendar entries. One of two complete, so progress becomes 50.
  res = await post(`/api/okr/key-results/${kr._id}/calendar-links`, {
    entryIds: [String(done._id), String(notDone._id)],
  });
  assert.equal(res.status, 200);
  const linked = await res.json();
  assert.equal(linked.calendar.linked, 2);
  assert.equal(linked.calendar.completed, 1);
  assert.equal(linked.keyResult.progress, 50);
  assert.equal(linked.keyResult.progressSource, "calendar");

  // The objective rolled up to match.
  res = await fetch(`${baseUrl}/api/okr/objectives/${oid}`, { headers: authHeaders() });
  assert.equal((await res.json()).objective.progress, 50);

  // Now finish the second calendar item, the way a user would in the calendar.
  notDone.completionStatus = "completed";
  notDone.progress = 100;
  await notDone.save();

  // Syncing brings that completion through to the objective.
  res = await fetch(`${baseUrl}/api/okr/objectives/${oid}/sync-calendar`, {
    method: "POST",
    headers: authHeaders(),
  });
  assert.equal(res.status, 200);
  const synced = await res.json();
  assert.equal(synced.progress, 100);
  assert.equal(synced.syncedKeyResults.length, 1);

  // Unlinking the last entry hands control back to manual updates.
  res = await fetch(`${baseUrl}/api/okr/key-results/${kr._id}/calendar-links`, {
    method: "DELETE",
    headers: authHeaders(),
    body: JSON.stringify({ entryId: String(done._id) }),
  });
  assert.equal(res.status, 200);
});

test("objectives cascade top-down through the strategy tree", async () => {
  // A company goal with a department goal under it, then a team goal under that.
  let res = await post("/api/okr/objectives", {
    title: "Company strategy",
    type: "company",
    dueDate,
  });
  const companyId = (await res.json())._id;

  res = await post("/api/okr/objectives", {
    title: "Department plan",
    type: "department",
    parent: companyId,
    dueDate,
  });
  assert.equal(res.status, 201);
  const deptId = (await res.json())._id;

  res = await post("/api/okr/objectives", {
    title: "Team goal",
    type: "team",
    parent: deptId,
    dueDate,
  });
  assert.equal(res.status, 201);

  // A bogus parent is refused rather than silently ignored.
  res = await post("/api/okr/objectives", {
    title: "Orphan",
    type: "team",
    parent: "60f000000000000000000000",
    dueDate,
  });
  assert.equal(res.status, 404);

  // The tree nests them three levels deep.
  res = await fetch(`${baseUrl}/api/okr/objectives/tree`, { headers: authHeaders() });
  assert.equal(res.status, 200);
  const { tree } = await res.json();
  const company = tree.find((n) => n.title === "Company strategy");
  assert.ok(company, "company objective should be a root node");
  const dept = company.children.find((n) => n.title === "Department plan");
  assert.ok(dept, "department objective should hang off the company objective");
  assert.ok(dept.children.some((n) => n.title === "Team goal"));
});

test("activity feed records what happened", async () => {
  const res = await fetch(`${baseUrl}/api/okr/activity?limit=50`, { headers: authHeaders() });
  const feed = await res.json();
  assert.equal(res.status, 200);
  assert.ok(feed.length >= 3);
  const actions = feed.map((a) => a.action);
  assert.ok(actions.includes("objective.created"));
  assert.ok(actions.includes("keyresult.created"));
  assert.ok(actions.includes("keyresult.checkin"));
});

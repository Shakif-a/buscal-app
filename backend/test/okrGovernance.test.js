// Tests for activation, evidence, approvals, the audit log and the self-healing pass.
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret";

const okrRoutes = require("../routes/okrRoutes");
const { errorHandler } = require("../middleware/errorMiddleware");
const User = require("../models/userModel");
const OkrObjective = require("../models/okrObjectiveModel");
const OkrKeyResult = require("../models/okrKeyResultModel");
const OkrAuditLog = require("../models/okrAuditLogModel");
const CalendarEntry = require("../models/calendarEntryModel");
const { CircuitBreaker } = require("../services/circuitBreaker");
const { healObjective } = require("../middleware/okrSelfHealingMiddleware");

let server;
let baseUrl;
let managerToken;
let staffToken;
let staffUser;
let dueDate;

before(async () => {
  await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/okr_gov_test");
  await Promise.all([
    User.deleteMany({}),
    OkrObjective.deleteMany({}),
    OkrKeyResult.deleteMany({}),
    // Audit rows refuse ordinary deletes, so a fixture reset has to say so.
    OkrAuditLog.deleteMany({}, { allowAuditPurge: true }),
    CalendarEntry.deleteMany({}),
  ]);

  const app = express();
  app.use(express.json());
  app.use("/api/okr", okrRoutes);
  app.use(errorHandler);

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });

  const manager = await User.create({
    firstName: "Mia",
    lastName: "Manager",
    email: "mia.manager@okr.test",
    password: "not-checked-here",
    roles: ["manager"],
  });
  staffUser = await User.create({
    firstName: "Sam",
    lastName: "Staff",
    email: "sam.staff@okr.test",
    password: "not-checked-here",
    roles: ["staff"],
  });

  managerToken = jwt.sign({ id: manager._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
  staffToken = jwt.sign({ id: staffUser._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
  dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
});

after(async () => {
  if (server) await new Promise((r) => server.close(r));
  await mongoose.connection.close();
});

function headers(token = managerToken) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}
function post(path, body, token) {
  return fetch(baseUrl + path, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(body || {}),
  });
}

// Build an objective with key results of the given weights. Returns ids.
async function buildObjective(title, weights) {
  let res = await post("/api/okr/objectives", { title, type: "team", dueDate });
  const objective = await res.json();
  const keyResultIds = [];
  for (const [i, weight] of weights.entries()) {
    res = await post(`/api/okr/objectives/${objective._id}/key-results`, {
      title: `${title} KR ${i + 1}`,
      weight,
      dueDate,
    });
    const kr = await res.json();
    keyResultIds.push(kr._id);
  }
  return { objectiveId: objective._id, keyResultIds };
}

test("an objective cannot be activated until weights total exactly 100", async () => {
  // 60 + 30 = 90, which is short.
  const { objectiveId } = await buildObjective("Partial weights", [60, 30]);

  let res = await fetch(`${baseUrl}/api/okr/objectives/${objectiveId}/readiness`, {
    headers: headers(),
  });
  const readiness = await res.json();
  assert.equal(readiness.weightTotal, 90);
  assert.equal(readiness.weightRemaining, 10);
  assert.equal(readiness.canActivate, false);
  assert.match(readiness.blockers.join(" "), /10% still to allocate/);

  // Activation is refused and says why.
  res = await post(`/api/okr/objectives/${objectiveId}/activate`);
  assert.equal(res.status, 400);
  const refusal = await res.json();
  assert.equal(refusal.code, "WEIGHTS_NOT_100");
  assert.equal(refusal.currentTotal, 90);
  assert.equal(refusal.difference, 10);

  // Add the missing 10 and it goes through.
  res = await post(`/api/okr/objectives/${objectiveId}/key-results`, {
    title: "The last 10",
    weight: 10,
    dueDate,
  });
  assert.equal(res.status, 201);

  res = await post(`/api/okr/objectives/${objectiveId}/activate`);
  assert.equal(res.status, 200);
  const activated = await res.json();
  assert.equal(activated.objective.lifecycle, "active");
  assert.equal(activated.weightTotal, 100);
});

test("an objective with no key results cannot be activated", async () => {
  const res0 = await post("/api/okr/objectives", { title: "Empty", type: "team", dueDate });
  const objective = await res0.json();

  const res = await post(`/api/okr/objectives/${objective._id}/activate`);
  assert.equal(res.status, 400);
  assert.equal((await res.json()).code, "NO_KEY_RESULTS");
});

test("a key result needs evidence before it can be submitted", async () => {
  const { keyResultIds } = await buildObjective("Evidence gate", [100]);
  const krId = keyResultIds[0];

  // No evidence yet.
  let res = await post(`/api/okr/key-results/${krId}/submit`, {}, staffToken);
  assert.equal(res.status, 400);
  assert.equal((await res.json()).code, "EVIDENCE_REQUIRED");

  // A note counts as evidence.
  res = await post(
    `/api/okr/key-results/${krId}/evidence`,
    { kind: "note", value: "Signed off by the client on 12 August", label: "Client sign-off" },
    staffToken
  );
  assert.equal(res.status, 201);

  // Now it submits and sits pending.
  res = await post(`/api/okr/key-results/${krId}/submit`, {}, staffToken);
  assert.equal(res.status, 200);
  const submitted = await res.json();
  assert.equal(submitted.keyResult.approvalState, "pending");
  assert.ok(submitted.keyResult.submittedAt);
});

test("calendar evidence must point at a real entry", async () => {
  const { keyResultIds } = await buildObjective("Bad evidence", [100]);

  const res = await post(
    `/api/okr/key-results/${keyResultIds[0]}/evidence`,
    { kind: "calendar", ref: "60f000000000000000000000" },
    staffToken
  );
  assert.equal(res.status, 404);
});

test("a manager can approve, and rejection requires a reason", async () => {
  const { keyResultIds } = await buildObjective("Review cycle", [100]);
  const krId = keyResultIds[0];

  await post(
    `/api/okr/key-results/${krId}/evidence`,
    { kind: "note", value: "Delivered" },
    staffToken
  );
  await post(`/api/okr/key-results/${krId}/submit`, {}, staffToken);

  // Rejecting without a note is refused.
  let res = await post(`/api/okr/key-results/${krId}/review`, { decision: "rejected" });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).code, "REVIEW_NOTE_REQUIRED");

  // Rejecting with a note works and the reason is stored.
  res = await post(`/api/okr/key-results/${krId}/review`, {
    decision: "rejected",
    note: "The evidence does not cover the second half of the quarter",
  });
  assert.equal(res.status, 200);
  const rejected = await res.json();
  assert.equal(rejected.keyResult.approvalState, "rejected");
  assert.equal(rejected.keyResult.approved, false);
  assert.match(rejected.keyResult.reviewNote, /second half/);

  // The owner revises and resubmits, then it is approved.
  await post(`/api/okr/key-results/${krId}/submit`, {}, staffToken);
  res = await post(`/api/okr/key-results/${krId}/review`, { decision: "approved" });
  assert.equal(res.status, 200);
  const approved = await res.json();
  assert.equal(approved.keyResult.approvalState, "approved");
  assert.equal(approved.keyResult.approved, true);
  assert.ok(approved.keyResult.approvedBy);
});

test("a manager cannot approve a key result they submitted themselves", async () => {
  const { keyResultIds } = await buildObjective("Self approval", [100]);
  const krId = keyResultIds[0];

  // The manager does the work and submits it.
  await post(`/api/okr/key-results/${krId}/evidence`, { kind: "note", value: "Did it myself" });
  await post(`/api/okr/key-results/${krId}/submit`, {});

  // The same manager tries to sign it off.
  const res = await post(`/api/okr/key-results/${krId}/review`, { decision: "approved" });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).code, "SELF_APPROVAL_BLOCKED");
});

test("the audit trail records state changes and cannot be edited", async () => {
  const { objectiveId, keyResultIds } = await buildObjective("Audited", [100]);
  await post(`/api/okr/key-results/${keyResultIds[0]}/evidence`, {
    kind: "note",
    value: "Proof",
  });
  await post(`/api/okr/objectives/${objectiveId}/activate`);

  const res = await fetch(`${baseUrl}/api/okr/objectives/${objectiveId}/audit`, {
    headers: headers(),
  });
  const trail = await res.json();
  assert.equal(res.status, 200);
  assert.ok(trail.count >= 2);
  const actions = trail.entries.map((e) => e.action);
  assert.ok(actions.includes("objective.activated"));
  assert.ok(actions.includes("keyresult.evidence.added"));

  // Every route to changing an entry is blocked.
  const entry = await OkrAuditLog.findOne({ objective: objectiveId });
  entry.message = "tampered";
  await assert.rejects(() => entry.save(), /cannot be modified/);
  await assert.rejects(
    () => OkrAuditLog.updateOne({ _id: entry._id }, { $set: { message: "tampered" } }),
    /cannot be modified/
  );
  await assert.rejects(() => OkrAuditLog.deleteOne({ _id: entry._id }), /cannot be deleted/);

  // A deliberate retention purge is still possible, because policies exist.
  const purge = await OkrAuditLog.deleteOne({ _id: entry._id }, { allowAuditPurge: true });
  assert.equal(purge.deletedCount, 1);
});

test("the circuit breaker opens after repeated failures and recovers", async () => {
  const breaker = new CircuitBreaker({
    name: "test-service",
    failureThreshold: 2,
    cooldownMs: 50,
    timeoutMs: 100,
  });

  const failing = () => Promise.reject(new Error("box is down"));
  const fallback = () => Promise.resolve("cached value");

  // First failure: still closed, but the fallback is served.
  let result = await breaker.run(failing, fallback);
  assert.equal(result.source, "cache");
  assert.equal(breaker.state, "closed");

  // Second failure trips it.
  result = await breaker.run(failing, fallback);
  assert.equal(breaker.state, "open");

  // While open, calls are rejected instantly and go straight to cache.
  const startedAt = Date.now();
  result = await breaker.run(failing, fallback);
  assert.equal(result.source, "cache");
  assert.ok(Date.now() - startedAt < 50, "an open breaker should not wait on the service");
  assert.ok(breaker.stats.rejections >= 1);

  // After the cool-off a working call closes it again.
  await new Promise((r) => setTimeout(r, 60));
  result = await breaker.run(() => Promise.resolve("live value"), fallback);
  assert.equal(result.source, "live");
  assert.equal(result.data, "live value");
  assert.equal(breaker.state, "closed");
});

test("a slow service is treated as a failure rather than hanging", async () => {
  const breaker = new CircuitBreaker({ name: "slow", failureThreshold: 5, timeoutMs: 40 });
  const slow = () => new Promise((resolve) => setTimeout(() => resolve("eventually"), 500));

  const startedAt = Date.now();
  const result = await breaker.run(slow, () => Promise.resolve("cached"));
  assert.ok(Date.now() - startedAt < 300, "the call should time out well before the service replies");
  assert.equal(result.source, "cache");
});

test("self-healing detaches deleted calendar links instead of failing", async () => {
  const { objectiveId, keyResultIds } = await buildObjective("Healing", [100]);
  const krId = keyResultIds[0];

  const entry = await CalendarEntry.create({
    title: "Doomed entry",
    endTime: new Date(Date.now() + 86400000),
    completionStatus: "completed",
    progress: 100,
  });

  // Link it, then delete the calendar entry behind the OKR module's back.
  let res = await post(`/api/okr/key-results/${krId}/calendar-links`, {
    entryIds: [String(entry._id)],
  });
  assert.equal(res.status, 200);
  await CalendarEntry.deleteOne({ _id: entry._id });

  // Reading the objective still works and quietly repairs the dead link.
  res = await fetch(`${baseUrl}/api/okr/objectives/${objectiveId}`, { headers: headers() });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("x-okr-repairs"), "1");

  const healed = await OkrKeyResult.findById(krId);
  assert.equal(healed.calendarEntries.length, 0);
  assert.equal(healed.progressSource, "manual");

  // The repair was written to the audit log rather than done silently.
  const repair = await OkrAuditLog.findOne({ action: "calendar.link.orphaned" });
  assert.ok(repair, "an orphaned link should leave an audit entry");
  assert.equal(repair.severity, "repair");
});

test("self-healing clears a parent objective that no longer exists", async () => {
  const parentRes = await post("/api/okr/objectives", {
    title: "Parent to delete",
    type: "company",
    dueDate,
  });
  const parentId = (await parentRes.json())._id;

  const childRes = await post("/api/okr/objectives", {
    title: "Child",
    type: "team",
    parent: parentId,
    dueDate,
  });
  const childId = (await childRes.json())._id;

  // Remove the parent directly, the way a stray script might.
  await OkrObjective.deleteOne({ _id: parentId });

  const repairs = await healObjective(childId);
  assert.ok(repairs.some((r) => r.clearedParent));

  const child = await OkrObjective.findById(childId);
  assert.equal(child.parent, null);
});

test("resilience status reports the breaker and queue", async () => {
  const res = await fetch(`${baseUrl}/api/okr/system/resilience`, { headers: headers() });
  const status = await res.json();
  assert.equal(res.status, 200);
  assert.ok(status.calendar);
  assert.ok(status.calendar.breaker);
  assert.equal(typeof status.calendar.queuedWrites, "number");
  assert.ok(["closed", "open", "half-open"].includes(status.calendar.breaker.state));
});

import test from "node:test";
import assert from "node:assert/strict";
import { getDashboardStats } from "../src/okrTracker/features/objectives/dashboardStats.js";

test("empty objectives give zeroed stats", () => {
  const stats = getDashboardStats([]);
  assert.equal(stats.total, 0);
  assert.equal(stats.groupCount, 0);
  assert.equal(stats.completedPct, 0);
  assert.equal(stats.atRisk, 0);
  assert.equal(stats.notStarted, 0);
  assert.deepEqual(stats.groups, []);
  assert.ok(stats.statusCounts.every((item) => item.count === 0));
});

test("every objective status is counted and at risk includes overdue", () => {
  const stats = getDashboardStats([
    { status: "completed", group: "Sales", progress: 100 },
    { status: "completed", group: "Sales", progress: 100 },
    { status: "on-track", group: "Tech", progress: 40 },
    { status: "at-risk", group: "Tech", progress: 10 },
    { status: "overdue", group: "Tech", progress: 5 },
    { status: "not started", group: "Ops", progress: 0 },
  ]);
  assert.equal(stats.total, 6);
  assert.equal(stats.completed, 2);
  assert.equal(stats.completedPct, 33);
  assert.equal(stats.atRisk, 2);
  assert.equal(stats.overdue, 1);
  assert.equal(stats.notStarted, 1);
  assert.deepEqual(
    Object.fromEntries(stats.statusCounts.map((item) => [item.status, item.count])),
    { completed: 2, "on-track": 1, "not started": 1, "at-risk": 1, overdue: 1 },
  );
  assert.equal(
    stats.statusCounts.reduce((total, item) => total + item.count, 0),
    stats.total,
  );
});

test("groups are averaged, rounded, sorted and ungrouped is labelled", () => {
  const stats = getDashboardStats([
    { status: "on-track", group: "Tech", progress: 33.4 },
    { status: "on-track", group: "Tech", progress: 34 },
    { status: "on-track", group: "Tech", progress: 34 },
    { status: "on-track", group: "none", progress: 20 },
    { status: "on-track", progress: 40 },
    { status: "not started", group: "Admin" },
  ]);
  assert.equal(stats.groupCount, 3);
  assert.deepEqual(
    stats.groups.map(({ name, progress }) => ({ name, progress })),
    [
      { name: "Admin", progress: 0 },
      { name: "Tech", progress: 34 },
      { name: "Ungrouped", progress: 30 },
    ],
  );
});

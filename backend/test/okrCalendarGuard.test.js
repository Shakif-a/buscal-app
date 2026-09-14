const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Calendar = require("../models/calendarEntryModel");
const Objective = require("../models/okrObjectiveModel");
const { protectOkrCalendar } = require("../middleware/okrCalendarGuard");

const findById = Calendar.findById;
const exists = Objective.exists;
test.afterEach(() => {
  Calendar.findById = findById;
  Objective.exists = exists;
});

function check(req) {
  return new Promise((resolve) => protectOkrCalendar(req, {}, resolve));
}

test("ordinary calendar entries continue to their existing controller", async () => {
  Calendar.findById = async () => ({
    _id: new mongoose.Types.ObjectId(),
    category: "general",
  });
  Objective.exists = async () => null;
  const error = await check({
    body: { title: "Meeting" },
    params: { entryId: new mongoose.Types.ObjectId().toString() },
    route: { path: "/entries/:entryId" },
  });
  assert.equal(error, undefined);
});

test("a linked calendar entry is protected even if its category is wrong", async () => {
  Calendar.findById = async () => ({
    _id: new mongoose.Types.ObjectId(),
    category: "general",
  });
  Objective.exists = async () => ({ _id: new mongoose.Types.ObjectId() });
  const error = await check({
    body: {},
    params: { entryId: new mongoose.Types.ObjectId().toString() },
    route: { path: "/entries/:entryId" },
  });
  assert.equal(error.statusCode, 409);
});

test("ordinary calendar creation is allowed and direct OKR creation is rejected", async () => {
  assert.equal(
    await check({ body: { category: "general" }, params: {} }),
    undefined,
  );
  const error = await check({
    body: { category: "OKR Objective" },
    params: {},
  });
  assert.equal(error.statusCode, 409);
});

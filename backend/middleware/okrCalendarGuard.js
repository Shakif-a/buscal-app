const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const CalendarEntry = require("../models/calendarEntryModel");
const Objective = require("../models/okrObjectiveModel");
const KeyResult = require("../models/okrKeyResultModel");

const OKR_CATEGORIES = ["OKR Objective", "OKR Key Result"];
const { ApiError } = require("../utils/ApiError");

const protectOkrCalendar = asyncHandler(async (req, res, next) => {
  if (OKR_CATEGORIES.includes(req.body?.category)) {
    throw new ApiError(
      409,
      "Create or change this entry through the OKR objective editor",
    );
  }
  if (!req.params.entryId) return next();
  if (!mongoose.isObjectIdOrHexString(req.params.entryId))
    throw new ApiError(404, "Calendar entry not found");
  const entry = await CalendarEntry.findById(req.params.entryId);
  if (!entry) throw new ApiError(404, "Calendar entry not found");

  let entries = [entry];
  if (req.route.path.includes("/recur/")) {
    const originalId = entry.originalEntry || entry._id;
    entries = await CalendarEntry.find({
      $or: [{ _id: originalId }, { originalEntry: originalId }],
    });
  }
  const ids = entries.map((item) => item._id);
  const linked =
    (await Objective.exists({ calendarEntry: { $in: ids } })) ||
    (await KeyResult.exists({ calendarEntry: { $in: ids } }));
  if (linked || entries.some((item) => OKR_CATEGORIES.includes(item.category))) {
    throw new ApiError(
      409,
      "Change this calendar entry through its OKR objective so both records stay in sync",
    );
  }
  next();
});

module.exports = { protectOkrCalendar };

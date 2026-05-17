const mongoose = require("mongoose");

const calendarHistorySchema = new mongoose.Schema({
  ref: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CalendarEntry",
    required: true,
  },
  assignments: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      timestamp: { type: Date, default: Date.now },
      notes: String,
    },
  ],
  reassignments: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      timestamp: { type: Date, default: Date.now },
      notes: String,
    },
  ],
  escalations: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      timestamp: { type: Date, default: Date.now },
      level: { type: Number },
      notes: String,
    },
  ],
  notifications: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      timestamp: { type: Date, default: Date.now },
      notes: String,
    },
  ],
  completionChanges: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      timestamp: { type: Date, default: Date.now },
      notes: String,
    },
  ],
  edits: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      timestamp: { type: Date, default: Date.now },
      notes: String,
    },
  ],
});

const CalendarHistory = mongoose.model(
  "CalendarHistory",
  calendarHistorySchema
);

module.exports = CalendarHistory;

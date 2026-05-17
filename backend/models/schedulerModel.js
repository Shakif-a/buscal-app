const mongoose = require("mongoose");

// Define the Scheduler schema
const schedulerSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, // e.g., "calendarschedule"
  toschedule: [{ type: mongoose.Schema.Types.ObjectId, ref: "CalendarEntry" }],
  tocancel: [{ type: mongoose.Schema.Types.ObjectId, ref: "CalendarEntry" }],
});

// Create Scheduler model
const Scheduler = mongoose.model("Scheduler", schedulerSchema);

module.exports = Scheduler;

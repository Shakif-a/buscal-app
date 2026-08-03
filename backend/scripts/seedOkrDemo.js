const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
// connectDB logs a colored line using the "colors" package, which only works
// once something has loaded it. server.js does that at startup, but this
// script runs standalone, so it needs its own require here too.
require("colors");
const connectDB = require("../config/db");
const User = require("../models/userModel");
const CalendarEntry = require("../models/calendarEntryModel");

dotenv.config();

async function seedOkrDemo() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.ALLOW_DEMO_SEED !== "true"
  ) {
    throw new Error(
      "Demo seeding is disabled. Set ALLOW_DEMO_SEED=true outside production."
    );
  }

  const email = String(
    process.env.DEMO_ADMIN_EMAIL || "admin@okrew.test"
  )
    .trim()
    .toLowerCase();
  const password = String(process.env.DEMO_ADMIN_PASSWORD || "");

  if (!email.endsWith("@okrew.test")) {
    throw new Error("DEMO_ADMIN_EMAIL must use the reserved @okrew.test domain");
  }
  if (password.length < 10) {
    throw new Error("DEMO_ADMIN_PASSWORD must be at least 10 characters");
  }

  await connectDB();

  // This script touches only one explicitly reserved demo identity, plus one
  // demo calendar entry owned by it. It never clears the users collection,
  // the calendar collection at large, or any customer data.
  await User.deleteOne({ email });
  const hashedPassword = await bcrypt.hash(password, 12);
  const demoUser = await User.create({
    firstName: "OKR",
    lastName: "Test Admin",
    email,
    password: hashedPassword,
    roles: ["admin", "qm"],
    exec: "no",
    supervisor: null,
  });

  // Also seed one demo calendar entry so the "link calendar to key result"
  // flow (Dev Playground button 5, and the matching Trello card) has
  // something real to link to right away, no manual setup needed first.
  await CalendarEntry.deleteMany({ title: "OKR demo calendar entry", userOwner: demoUser._id });
  const start = new Date();
  const end = new Date();
  end.setHours(end.getHours() + 1);
  await CalendarEntry.create({
    title: "OKR demo calendar entry",
    userOwner: demoUser._id,
    userAssigned: [demoUser._id],
    startTime: start,
    endTime: end,
    completionStatus: "not started",
  });

  console.log(`OKR demo account is ready: ${email}`);
  console.log("OKR demo calendar entry is ready too, no need to create one manually.");
}

seedOkrDemo()
  .catch((error) => {
    console.error(`OKR demo seed failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

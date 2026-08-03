const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
// connectDB needs the "colors" package loaded, server.js does this normally but this script runs standalone.
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

  // Only touches this one reserved demo account and its calendar entry, nothing else.
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

  // Also seed one demo calendar entry so the calendar-link button has something to link to.
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

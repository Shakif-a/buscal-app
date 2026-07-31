const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/userModel");

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

  // This script touches only one explicitly reserved demo identity. It never
  // clears the users collection or any customer data.
  await User.deleteOne({ email });
  const hashedPassword = await bcrypt.hash(password, 12);
  await User.create({
    firstName: "OKR",
    lastName: "Test Admin",
    email,
    password: hashedPassword,
    roles: ["admin", "qm"],
    exec: "no",
    supervisor: null,
  });

  console.log(`OKR demo account is ready: ${email}`);
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

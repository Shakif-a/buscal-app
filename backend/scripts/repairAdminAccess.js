require("dotenv").config();
const mongoose = require("mongoose");
const Permission = require("../models/okrRolePermissionModel");

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const admin = await Permission.findOne({ role: "Admin" });
    if (!admin || admin.permissions.includes("Manage Roles")) {
      console.log("Admin role management access is already available.");
      return;
    }
    if (!process.argv.includes("--apply")) {
      console.log(
        "Admin is missing Manage Roles. Run with --apply to restore only that permission.",
      );
      return;
    }
    await Permission.updateOne(
      { role: "Admin" },
      { $addToSet: { permissions: "Manage Roles" } },
      { runValidators: true },
    );
    console.log(
      "Restored Manage Roles. Other saved permissions were preserved.",
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

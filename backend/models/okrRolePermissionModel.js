const mongoose = require("mongoose");

const rolePermissionSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["Admin", "Manager", "Employee"],
      required: true,
      unique: true,
    },
    permissions: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("OkrRolePermission", rolePermissionSchema);

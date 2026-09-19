const mongoose = require("mongoose");
const { permissionNames } = require("../config/okrPermissions");

const rolePermissionSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      trim: true,
      maxlength: 60,
      match: /^[A-Za-z][A-Za-z0-9 ()_-]{0,59}$/,
      required: true,
      unique: true,
    },
    roleKey: { type: String },
    permissions: {
      type: [
        {
          type: String,
          enum: permissionNames,
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

rolePermissionSchema.index(
  { roleKey: 1 },
  { unique: true, partialFilterExpression: { roleKey: { $type: "string" } } },
);

module.exports = mongoose.model("OkrRolePermission", rolePermissionSchema);

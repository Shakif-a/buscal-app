const writes = require("../services/okrWrites");
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const OkrGroup = require("../models/okrGroupModel");
const OkrRolePermission = require("../models/okrRolePermissionModel");
const User = require("../models/userModel");
const OkrObjective = require("../models/okrObjectiveModel");
const {
  defaultPermissions,
  permissionNames,
  isSystemRole,
  allowedPermissions,
} = require("../config/okrPermissions");
const {
  getRoleName,
  hasPermission,
} = require("../middleware/adminPermissions");
const { ApiError } = require("../utils/ApiError");

function removeDuplicates(values) {
  const result = [];

  for (let i = 0; i < values.length; i++) {
    if (!result.includes(values[i])) {
      result.push(values[i]);
    }
  }

  return result;
}

async function usersExist(userIds, session) {
  for (let i = 0; i < userIds.length; i++) {
    if (
      typeof userIds[i] !== "string" ||
      !mongoose.isObjectIdOrHexString(userIds[i])
    ) {
      return false;
    }

    const user = await User.findById(userIds[i], null, { session });

    if (!user) {
      return false;
    }
  }

  return true;
}

async function findGroup(groupId, res, session) {
  if (!mongoose.isValidObjectId(groupId)) {
    res.status(404);
    throw new Error("Group not found");
  }

  const group = session
    ? await OkrGroup.findOneAndUpdate(
        { _id: groupId },
        { $inc: { __v: 1 } },
        { new: true, session },
      )
    : await OkrGroup.findById(groupId);

  if (!group) {
    res.status(404);
    throw new Error("Group not found");
  }

  return group;
}

const getAdminUsers = asyncHandler(async (req, res) => {
  const users = await User.find()
    .select("firstName lastName email roles exec companyRoles okrRole")
    .sort({ firstName: 1, lastName: 1 });

  res.status(200).json(users);
});

const getGroups = asyncHandler(async (req, res) => {
  const groups = await OkrGroup.find()
    .populate("manager", "firstName lastName email")
    .populate("members", "firstName lastName email")
    .sort({ name: 1 });

  res.status(200).json(groups);
});

const createGroup = asyncHandler(async (req, res) => {
  let name = "";

  if (typeof req.body.name === "string") {
    name = req.body.name.trim();
  }

  if (!name) {
    res.status(400);
    throw new Error("Please add a group name");
  }
  if (name.toLowerCase() === "none")
    throw new ApiError(
      400,
      "The name none is reserved for unassigned objectives",
    );

  const existingGroup = await OkrGroup.findOne({ name });

  if (existingGroup) {
    res.status(400);
    throw new Error("Group already exists");
  }

  const group = await OkrGroup.create({ name });
  res.status(201).json(group);
});

const updateGroup = asyncHandler(async (req, res) => {
  const group = await writes.transaction(async (session) => {
    const group = await findGroup(req.params.id, res, session);
    const oldName = group.name;

    if (req.body.name !== undefined) {
      let name = "";

      if (typeof req.body.name === "string") {
        name = req.body.name.trim();
      }

      if (!name) {
        res.status(400);
        throw new Error("Please add a group name");
      }
      if (name.toLowerCase() === "none")
        throw new ApiError(
          400,
          "The name none is reserved for unassigned objectives",
        );

      const sameName = await OkrGroup.findOne(
        { name, _id: { $ne: group._id } },
        null,
        { session },
      );

      if (sameName) {
        res.status(400);
        throw new Error("Group already exists");
      }

      group.name = name;
    }

    if (req.body.manager !== undefined) {
      if (req.body.manager !== null && typeof req.body.manager !== "string") {
        res.status(400);
        throw new Error("Manager must be a user ID or null");
      }
      if (
        req.body.manager &&
        !(await usersExist([req.body.manager], session))
      ) {
        res.status(400);
        throw new Error("Manager not found");
      }

      group.manager = req.body.manager || null;
    }

    if (req.body.members !== undefined) {
      if (!Array.isArray(req.body.members)) {
        res.status(400);
        throw new Error("Members must be a list");
      }

      const memberIds = removeDuplicates(req.body.members);

      if (!(await usersExist(memberIds, session))) {
        res.status(400);
        throw new Error("One or more members were not found");
      }

      group.members = memberIds;
    }

    if (oldName !== group.name) {
      await OkrObjective.updateMany(
        { group: oldName },
        { $set: { group: group.name } },
        { session, runValidators: true },
      );
    }
    await group.save({ session });
    return group;
  });
  await group.populate("manager", "firstName lastName email");
  await group.populate("members", "firstName lastName email");

  res.status(200).json(group);
});

const getRolePermissions = asyncHandler(async (req, res) => {
  res.status(200).json(await roleRows());
});

const updateRolePermissions = asyncHandler(async (req, res) => {
  const role = req.params.role;
  const permissions = req.body.permissions;

  validatePermissions(role, permissions);
  if (!isSystemRole(role) && !(await OkrRolePermission.exists({ role }))) {
    res.status(400);
    throw new Error("Role not found");
  }
  const uniquePermissions = removeDuplicates(permissions);
  const savedRole = await OkrRolePermission.findOneAndUpdate(
    { role },
    { role, permissions: uniquePermissions, roleKey: role.toLowerCase() },
    { new: true, upsert: isSystemRole(role), runValidators: true },
  );
  if (!savedRole) throw new ApiError(404, "Role not found");
  res.status(200).json(savedRole);
});

function validatePermissions(role, permissions) {
  if (!Array.isArray(permissions))
    throw new ApiError(400, "Permissions must be a list");
  for (const permission of permissions) {
    if (!permissionNames.includes(permission))
      throw new ApiError(400, "Invalid permission");
    if (!allowedPermissions(role).includes(permission))
      throw new ApiError(400, "Permission cannot take effect for this role");
  }
}

async function roleRows() {
  for (const role of Object.keys(defaultPermissions)) {
    await OkrRolePermission.updateOne(
      { role },
      {
        $setOnInsert: {
          role,
          roleKey: role.toLowerCase(),
          permissions: defaultPermissions[role],
        },
      },
      { upsert: true, runValidators: true },
    );
  }
  const rows = await OkrRolePermission.find().sort({ createdAt: 1, role: 1 });
  return rows.map((row) => ({
    role: row.role,
    permissions: row.permissions.filter((permission) =>
      allowedPermissions(row.role).includes(permission),
    ),
    allowedPermissions: allowedPermissions(row.role),
    defaultPermissions: isSystemRole(row.role)
      ? defaultPermissions[row.role]
      : [],
    system: isSystemRole(row.role),
  }));
}

const getRoles = asyncHandler(async (req, res) => {
  res.json({
    roles: await roleRows(),
    permissionNames,
    canManageRoles: await hasPermission(req.user, "Manage Roles"),
    canManageUsers: await hasPermission(req.user, "Manage Users"),
  });
});

function roleName(value) {
  if (typeof value !== "string")
    throw new ApiError(400, "Please add a role name");
  const name = value.trim().replace(/\s+/g, " ");
  if (!/^[A-Za-z][A-Za-z0-9 ()_-]{0,59}$/.test(name))
    throw new ApiError(
      400,
      "Use a role name of 1 to 60 letters, numbers, spaces, brackets, hyphens or underscores",
    );
  if (["constructor", "prototype", "__proto__"].includes(name.toLowerCase()))
    throw new ApiError(400, "This role name is reserved");
  return name;
}

async function checkRoleName(name, currentRole) {
  const rows = await OkrRolePermission.find({}, "role");
  const names = [
    ...Object.keys(defaultPermissions),
    ...rows.map((row) => row.role),
  ];
  if (
    names.some(
      (existing) =>
        existing !== currentRole &&
        existing.toLowerCase() === name.toLowerCase(),
    )
  )
    throw new ApiError(409, "Role already exists");
}

const createRole = asyncHandler(async (req, res) => {
  const role = roleName(req.body.role);
  const permissions =
    req.body.permissions === undefined ? [] : req.body.permissions;
  validatePermissions(role, permissions);
  await checkRoleName(role);
  const saved = await OkrRolePermission.create({
    role,
    roleKey: role.toLowerCase(),
    permissions: removeDuplicates(permissions),
  });
  res.status(201).json(saved);
});

async function lockRole(role, session) {
  const saved = await OkrRolePermission.findOneAndUpdate(
    { role },
    { $inc: { __v: 1 } },
    { new: true, session },
  );
  if (!saved) throw new ApiError(404, "Role not found");
  return saved;
}

const renameRole = asyncHandler(async (req, res) => {
  if (isSystemRole(req.params.role))
    throw new ApiError(400, "System roles cannot be renamed");
  const name = roleName(req.body.role);
  await checkRoleName(name, req.params.role);
  const saved = await writes.transaction(async (session) => {
    const role = await lockRole(req.params.role, session);
    await User.updateMany(
      { okrRole: role.role },
      { $set: { okrRole: name } },
      { session, runValidators: true },
    );
    role.role = name;
    role.roleKey = name.toLowerCase();
    await role.save({ session });
    return role;
  });
  res.json(saved);
});

const deleteRole = asyncHandler(async (req, res) => {
  if (isSystemRole(req.params.role))
    throw new ApiError(400, "System roles cannot be deleted");
  await writes.transaction(async (session) => {
    const role = await lockRole(req.params.role, session);
    if (await User.exists({ okrRole: role.role }).session(session))
      throw new ApiError(409, "Reassign users before deleting this role");
    await OkrRolePermission.deleteOne({ _id: role._id }, { session });
  });
  res.json({ role: req.params.role });
});

const assignRole = asyncHandler(async (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id))
    throw new ApiError(404, "User not found");
  const name = req.body.role === null ? null : roleName(req.body.role);
  if (name && isSystemRole(name))
    throw new ApiError(
      400,
      "System roles follow account and company settings. Select a custom role or clear the assignment",
    );
  const user = await writes.transaction(async (session) => {
    if (name) await lockRole(name, session);
    const user = await User.findById(req.params.id, null, { session });
    if (!user) throw new ApiError(404, "User not found");
    if (name && getRoleName({ roles: user.roles, exec: user.exec }) === "Admin")
      throw new ApiError(
        400,
        "Administrators and executives use the Admin role",
      );
    user.okrRole = name;
    await user.save({ session });
    return { _id: user._id, okrRole: user.okrRole };
  });
  res.json(user);
});

const deleteGroup = asyncHandler(async (req, res) => {
  await writes.transaction(async (session) => {
    const group = await findGroup(req.params.id, res, session);
    if (await OkrObjective.exists({ group: group.name }).session(session))
      throw new ApiError(409, "Move the group's objectives before deleting it");
    await OkrGroup.deleteOne({ _id: group._id }, { session });
  });
  res.json({ id: req.params.id });
});

module.exports = {
  getRoles,
  createRole,
  renameRole,
  deleteRole,
  assignRole,
  deleteGroup,
  createGroup,
  getAdminUsers,
  getGroups,
  getRolePermissions,
  updateGroup,
  updateRolePermissions,
};

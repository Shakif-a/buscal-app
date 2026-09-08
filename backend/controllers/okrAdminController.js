const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const OkrGroup = require("../models/okrGroupModel");
const OkrRolePermission = require("../models/okrRolePermissionModel");
const User = require("../models/userModel");
const { defaultPermissions } = require("../middleware/adminPermissions");

const permissionNames = [
  "Create Objectives",
  "Edit Objectives",
  "Create Key Results",
  "Approve Key Results",
  "View Reports",
  "Manage Users",
  "Manage Roles",
  "Manage Groups",
];

function removeDuplicates(values) {
  const result = [];

  for (let i = 0; i < values.length; i++) {
    if (!result.includes(values[i])) {
      result.push(values[i]);
    }
  }

  return result;
}

async function usersExist(userIds) {
  for (let i = 0; i < userIds.length; i++) {
    if (!mongoose.isValidObjectId(userIds[i])) {
      return false;
    }

    const user = await User.findById(userIds[i]);

    if (!user) {
      return false;
    }
  }

  return true;
}

async function findGroup(groupId, res) {
  if (!mongoose.isValidObjectId(groupId)) {
    res.status(404);
    throw new Error("Group not found");
  }

  const group = await OkrGroup.findById(groupId);

  if (!group) {
    res.status(404);
    throw new Error("Group not found");
  }

  return group;
}

const getAdminUsers = asyncHandler(async (req, res) => {
  const users = await User.find()
    .select("firstName lastName email roles exec companyRoles")
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

  const existingGroup = await OkrGroup.findOne({ name });

  if (existingGroup) {
    res.status(400);
    throw new Error("Group already exists");
  }

  const group = await OkrGroup.create({ name });
  res.status(201).json(group);
});

const updateGroup = asyncHandler(async (req, res) => {
  const group = await findGroup(req.params.id, res);

  if (req.body.name !== undefined) {
    let name = "";

    if (typeof req.body.name === "string") {
      name = req.body.name.trim();
    }

    if (!name) {
      res.status(400);
      throw new Error("Please add a group name");
    }

    const sameName = await OkrGroup.findOne({ name, _id: { $ne: group._id } });

    if (sameName) {
      res.status(400);
      throw new Error("Group already exists");
    }

    group.name = name;
  }

  if (req.body.manager !== undefined) {
    if (req.body.manager && !(await usersExist([req.body.manager]))) {
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

    if (!(await usersExist(memberIds))) {
      res.status(400);
      throw new Error("One or more members were not found");
    }

    group.members = memberIds;
  }

  await group.save();
  await group.populate("manager", "firstName lastName email");
  await group.populate("members", "firstName lastName email");

  res.status(200).json(group);
});

const getRolePermissions = asyncHandler(async (req, res) => {
  const roleNames = ["Admin", "Manager", "Employee"];
  const result = [];

  for (let i = 0; i < roleNames.length; i++) {
    const role = roleNames[i];
    const savedRole = await OkrRolePermission.findOne({ role });

    if (savedRole) {
      result.push(savedRole);
    } else {
      result.push({ role, permissions: defaultPermissions[role] });
    }
  }

  res.status(200).json(result);
});

const updateRolePermissions = asyncHandler(async (req, res) => {
  const role = req.params.role;
  const permissions = req.body.permissions;

  if (!defaultPermissions[role]) {
    res.status(400);
    throw new Error("Role not found");
  }

  if (!Array.isArray(permissions)) {
    res.status(400);
    throw new Error("Permissions must be a list");
  }

  for (let i = 0; i < permissions.length; i++) {
    if (!permissionNames.includes(permissions[i])) {
      res.status(400);
      throw new Error("Invalid permission");
    }
  }

  const uniquePermissions = removeDuplicates(permissions);
  const savedRole = await OkrRolePermission.findOneAndUpdate(
    { role },
    { role, permissions: uniquePermissions },
    { new: true, upsert: true, runValidators: true }
  );

  res.status(200).json(savedRole);
});

module.exports = {
  createGroup,
  getAdminUsers,
  getGroups,
  getRolePermissions,
  updateGroup,
  updateRolePermissions,
};

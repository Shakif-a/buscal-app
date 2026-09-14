const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const asyncHandler = require("express-async-handler");
const User = require("../models/userModel");
const JobDescription = require("../models/jobDescriptionsModel");
const sendEmail = require("../services/emailService");

const frontendUrl = process.env.REACT_APP_FRONTEND_URL;

// @desc    Register new user
// @route   POST /api/users
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password, roles } = req.body;

  if (!firstName || !lastName || !email || !password) {
    res.status(400);
    throw new Error("Please add all fields");
  }

  // Check if user exists
  const userExists = await User.findOne({ email });

  if (userExists) {
    res.status(400);
    throw new Error("User already exists");
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Check if this is the first user or if there are no admins
  const userCount = await User.countDocuments();
  const adminExists = await User.findOne({ roles: "admin" });

  let userRoles = ["pending"];
  if (userCount === 0 || !adminExists) {
    userRoles = ["admin", "qm"];
  }

  // Create user
  const user = await User.create({
    firstName,
    lastName,
    email,
    password: hashedPassword,
    roles: userRoles,
    exec: "no",
    supervisor: null,
  });

  if (user) {
    res.status(201).json({
      _id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      roles: user.roles,
      exec: user.exec,
      companyRoles: user.companyRoles,
      okrRole: user.okrRole,
      token: generateToken(user._id),
    });
  } else {
    res.status(400);
    throw new Error("Invalid user data");
  }
});

// @desc    Authenticate a user
// @route   POST /api/users/login
// @access  Public
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Check for user email
  const user = await User.findOne({ email });

  if (user && (await bcrypt.compare(password, user.password))) {
    res.json({
      _id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      roles: user.roles,
      exec: user.exec,
      companyRoles: user.companyRoles,
      okrRole: user.okrRole,
      token: generateToken(user._id),
      supervisor: user.supervisor,
    });
  } else {
    res.status(400);
    throw new Error("Invalid credentials");
  }
});

// @desc    Forgot password
// @route   POST /api/users/forgot-password
// @access  Public
const forgotPassword = asyncHandler(async (req, res) => {
  console.log("Forgot password request received:", req.body);

  const { email } = req.body;

  if (!email) {
    res.status(400);
    throw new Error("Please provide an email address");
  }

  // Find user by email
  const user = await User.findOne({ email });

  if (!user) {
    res.status(400);
    throw new Error("User not found");
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString("hex");

  // Hash token and set to resetPasswordToken field
  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // Set reset token and expiry (10 minutes)
  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

  await user.save();

  // Create reset URL - point to frontend

  const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

  // Email content
  const subject = "Password Reset Request - Micromax Dashboard";
  const body = `
    <p>You have requested a password reset for your Micromax Dashboard account.</p>
    <p>Please click the link below to reset your password:</p>
    <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
    <p>This link will expire in 10 minutes.</p>
    <p>If you did not request this password reset, please ignore this email.</p>
  `;

  try {
    // Send email
    const emailResult = await sendEmail([email], subject, body);

    console.log("Email send result:", emailResult);

    res.status(200).json({
      success: true,
      message: "Password reset email sent successfully",
    });
  } catch (error) {
    console.error("Email sending error:", error);

    // Clear reset token fields if email fails
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(500);
    throw new Error("Email could not be sent");
  }
});

// @desc    Reset password
// @route   PUT /api/users/reset-password/:resetToken
// @access  Public
const resetPassword = asyncHandler(async (req, res) => {
  const { password } = req.body;
  const { resetToken } = req.params;

  if (!password) {
    res.status(400);
    throw new Error("Please provide a new password");
  }

  // if (password.length < 6) {
  //   res.status(400);
  //   throw new Error("Password must be at least 6 characters long");
  // }

  // Hash the token to compare with database
  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // Find user with valid reset token and not expired
  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user) {
    res.status(400);
    throw new Error("Invalid or expired reset token");
  }

  // Hash new password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Update password and clear reset token fields
  user.password = hashedPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;

  await user.save();

  res.status(200).json({
    success: true,
    message: "Password reset successful",
    _id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    roles: user.roles,
    exec: user.exec,
    companyRoles: user.companyRoles,
    okrRole: user.okrRole,
    token: generateToken(user._id),
  });
});

// @desc    Change password for logged in user
// @route   PUT /api/users/change-password
// @access  Private
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!currentPassword || !newPassword || !confirmPassword) {
    res.status(400);
    throw new Error("Please provide all required fields");
  }

  if (newPassword !== confirmPassword) {
    res.status(400);
    throw new Error("New passwords do not match");
  }

  // Get user from token (set by auth middleware)
  const user = await User.findById(req.user.id);

  if (!user) {
    res.status(400);
    throw new Error("User not found");
  }

  // Check if current password is correct FIRST
  const isCurrentPasswordValid = await bcrypt.compare(
    currentPassword,
    user.password,
  );

  if (!isCurrentPasswordValid) {
    res.status(400);
    throw new Error("Current password is incorrect");
  }

  // Only check if new password is same as current password AFTER verifying current password is correct
  if (currentPassword === newPassword) {
    res.status(400);
    throw new Error("New password must be different from current password");
  }

  if (newPassword.length < 6) {
    res.status(400);
    throw new Error("New password must be at least 6 characters long");
  }

  // Hash new password
  const salt = await bcrypt.genSalt(10);
  const hashedNewPassword = await bcrypt.hash(newPassword, salt);

  // Update password
  user.password = hashedNewPassword;
  await user.save();

  res.status(200).json({
    success: true,
    message: "Password changed successfully",
  });
});

// @desc    Get user data
// @route   GET /api/users/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  res.status(200).json(req.user);
});

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "9000d",
  });
};

// // @desc    Delete user
// // @route   DELETE /api/users/:id
// // @access  Private
// const deleteUser = asyncHandler(async (req, res) => {
//   const user = await User.findById(req.params.id)

//   // Check for user
//   if (!req.user) {
//     res.status(401)
//     throw new Error('User not found')
//   }

//   await user.remove()

//   res.status(200).json({ id: req.params.id })
// })

//-----------------------------------------------------------------------------------
//--------------------------------------GETTERS----------------------------------
//-----------------------------------------------------------------------------------

const getUser = asyncHandler(async (req, res) => {
  const user = await User.find({}).select(
    "-password -resetPasswordToken -resetPasswordExpires",
  );
  res.status(200).json(user);
});

//-----------------------------------------------------------------------------------
//--------------------------------------UPDATERS----------------------------------
//-----------------------------------------------------------------------------------

const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById({ _id: req.params.id });

  if (!user) {
    res.status(400);
    throw new Error("User not found");
  }

  // Check for user
  if (!req.user) {
    res.status(401);
    throw new Error("User not found");
  }

  // Make sure the logged in user matches the user user
  //  if (user.user.toString() !== req.user.id) {
  //    res.status(401)
  //    throw new Error('User not authorized')
  //  }

  const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  const result = updatedUser.toObject();
  delete result.password;
  delete result.resetPasswordToken;
  delete result.resetPasswordExpires;
  res.status(200).json(result);
});

//-----------------------------------------------------------------------------------
//--------------------------------------DELETERS----------------------------------
//-----------------------------------------------------------------------------------

const deleteUser = asyncHandler(async (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    res.status(404);
    throw new Error("User not found");
  }
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(400);
    throw new Error("User not found");
  }

  // Check for user
  if (!req.user) {
    res.status(401);
    throw new Error("User not found");
  }

  await User.findByIdAndDelete(req.params.id);

  res.status(200).json({ id: req.params.id, myId: req.user.id });
});

//-----------------------------------------------------------------------------------
//--------------------------------------GET ONES----------------------------------
//-----------------------------------------------------------------------------------

const getUserOne = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        $expr: {
          $eq: [
            "$user",
            {
              $toObjectId: req.params.paramsField,
            },
          ],
        },
      },
    },
  ]);

  const userOne = await user.find((obj) => obj.user == req.user.id);

  res.status(200).json(userOne);
});

//-----------------------------------------------------------------------------------
//--------------------------------------UPDATE ONES----------------------------------
//-----------------------------------------------------------------------------------

const updateUserOne = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const fields = [
    "firstName",
    "lastName",
    "email",
    "phoneNumber",
    "roles",
    "startDate",
    "terminationDate",
  ];
  for (const field of fields) {
    if (req.body[field] !== undefined) user[field] = req.body[field];
  }

  const password = req.body.password;
  if (password !== undefined && password !== "") {
    if (typeof password !== "string" || password.length < 6) {
      res.status(400);
      throw new Error("New password must be at least 6 characters long");
    }
    user.password = await bcrypt.hash(password, 10);
  }

  await user.save();
  res.json({
    _id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    roles: user.roles,
    exec: user.exec,
    companyRoles: user.companyRoles,
    okrRole: user.okrRole,
    supervisor: user.supervisor,
    token: generateToken(req.user._id),
  });
});

const manageUserOne = asyncHandler(async (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    res.status(404);
    throw new Error("User not found");
  }
  if (req.body._id !== req.params.id) {
    res.status(400);
    throw new Error("User ID must match the request");
  }
  for (const field of ["roles", "removedRole"]) {
    if (
      !Array.isArray(req.body[field]) ||
      req.body[field].some((role) => typeof role !== "string")
    ) {
      res.status(400);
      throw new Error("Roles and removedRole must be lists of role names");
    }
  }
  if (req.body.exec !== undefined && !["yes", "no"].includes(req.body.exec)) {
    res.status(400);
    throw new Error("Executive status must be yes or no");
  }
  if (
    req.body.phoneNumber !== undefined &&
    typeof req.body.phoneNumber !== "string"
  ) {
    res.status(400);
    throw new Error("Phone number must be text");
  }
  if (
    req.body.companyRole &&
    (typeof req.body.companyRole !== "string" ||
      !Number.isInteger(Number(req.body.managementLevel)) ||
      Number(req.body.managementLevel) < 1)
  ) {
    res.status(400);
    throw new Error("Please supply a valid company role and management level");
  }
  const supervisorId = req.body.supervisor;
  if (
    supervisorId !== undefined &&
    supervisorId !== null &&
    supervisorId !== "" &&
    supervisorId !== "none"
  ) {
    if (
      !mongoose.isObjectIdOrHexString(supervisorId) ||
      !(await User.exists({ _id: supervisorId }))
    ) {
      res.status(400);
      throw new Error("Supervisor not found");
    }
  }

  const {
    _id,
    roles: rolesBeforeFilter,
    exec,
    supervisor: ss,
    removedRole,
    phoneNumber,
    companyRole,
    managementLevel,
    ref,
    startDate,
    terminationDate,
  } = req.body;

  // Find the user first
  const userOne = await User.findOne({ _id: _id });
  if (!userOne) {
    res.status(400);
    throw new Error("User not found");
  }

  // Check for admin user
  if (!req.user) {
    res.status(401);
    throw new Error("User not found");
  }

  // Handle supervisor
  let supervisor;
  if (ss !== undefined) {
    // Supervisor was provided in the request, process it
    supervisor = ss === "" || ss === "none" ? null : ss;
  } else {
    // Supervisor not provided, keep existing value
    supervisor = userOne.supervisor;
  }

  // Process roles - ensure they are unique and not empty
  let roles = [
    ...new Set(rolesBeforeFilter.filter((role) => role && role !== "")),
  ];

  // If user has "pending" role and we're assigning new roles, remove "pending"
  if (userOne.roles.includes("pending") && roles.length > 0) {
    roles = roles.filter((role) => role !== "pending");
  }

  // Remove specified roles if any
  const finalRoles = roles.filter((role) => !removedRole.includes(role));

  // If no roles are left after filtering, keep the existing roles
  if (finalRoles.length === 0) {
    const existingRolesWithoutPending = userOne.roles.filter(
      (role) => role !== "pending",
    );
    finalRoles.push(...existingRolesWithoutPending);
  }

  // Handle company roles
  let updatedCompanyRoles = [...userOne.companyRoles];

  if (companyRole) {
    // Remove existing role if it exists
    const existingRoleIndex = updatedCompanyRoles.findIndex(
      (cr) => cr.role === companyRole,
    );
    if (existingRoleIndex !== -1) {
      updatedCompanyRoles = updatedCompanyRoles.filter(
        (cr) => cr.role !== companyRole,
      );
    }

    // Add new role
    const newCompanyRole = { ref, role: companyRole, managementLevel };
    updatedCompanyRoles.push(newCompanyRole);
  }

  // Prepare update object
  const updateData = {
    roles: finalRoles,
    exec,
    supervisor,
    companyRoles: updatedCompanyRoles,
  };

  // Only add phoneNumber if it's provided and not empty
  if (phoneNumber && phoneNumber.trim() !== "") {
    updateData.phoneNumber = phoneNumber.trim();
  }

  // Add date fields if provided
  if (startDate !== undefined) {
    updateData.startDate = startDate;
  }
  if (terminationDate !== undefined) {
    updateData.terminationDate = terminationDate;
  }

  // Update the user
  const updatedUser = await User.findByIdAndUpdate(_id, updateData, {
    new: true,
    runValidators: true,
  });

  if (!updatedUser) {
    res.status(400);
    throw new Error("Failed to update user");
  }

  // Update JobDescription if ref is provided
  if (ref) {
    try {
      const jobDescription = await JobDescription.findOne({ _id: ref });
      if (jobDescription && !jobDescription.usersAssigned.includes(_id)) {
        jobDescription.usersAssigned.push(_id);
        await jobDescription.save();
      }
    } catch (error) {
      console.error("Error updating JobDescription:", error.message);
    }
  }

  const result = updatedUser.toObject();
  delete result.password;
  delete result.resetPasswordToken;
  delete result.resetPasswordExpires;
  res.status(200).json(result);
});

module.exports = {
  registerUser,
  loginUser,
  getMe,
  forgotPassword,
  resetPassword,
  changePassword,
  deleteUser,
  getUser,
  updateUser,
  getUserOne,
  updateUserOne,
  manageUserOne,
};

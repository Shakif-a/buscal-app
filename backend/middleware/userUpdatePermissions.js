const mongoose = require("mongoose");
const { getRoleName } = require("./adminPermissions");

function canUpdateUser(req, res, next) {
  const id = req.params.id;

  if (!mongoose.isValidObjectId(id)) {
    res.status(404);
    throw new Error("User not found");
  }

  if (req.body._id !== undefined && req.body._id !== id) {
    res.status(400);
    throw new Error("User ID must match the request");
  }

  if (req.route.path === "/userOne/:id" && req.body._id !== id) {
    res.status(400);
    throw new Error("Please include the user ID");
  }

  if (getRoleName(req.user) === "Admin") {
    next();
    return;
  }

  if (req.user._id.toString() !== id) {
    res.status(403);
    throw new Error("You can only update your own account");
  }

  const allowedFields = [
    "_id",
    "firstName",
    "lastName",
    "email",
    "phoneNumber",
    "roles",
  ];

  if (req.route.path === "/userOne/:id") {
    allowedFields.push("password");
  }

  const fields = Object.keys(req.body);

  for (let i = 0; i < fields.length; i++) {
    if (!allowedFields.includes(fields[i])) {
      res.status(403);
      throw new Error("You cannot update this account field");
    }
  }

  // The account page sends roles even when only a name is changed.
  if (
    req.body.roles !== undefined &&
    JSON.stringify(req.body.roles) !== JSON.stringify(req.user.roles)
  ) {
    res.status(403);
    throw new Error("Only admins or executives can change roles");
  }

  next();
}

module.exports = { canUpdateUser };

const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const User = require("../models/userModel");

const protect = asyncHandler(async (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    res.status(401);
    throw new Error("Not authorized, no token");
  }

  if (!authorization.startsWith("Bearer ")) {
    res.status(401);
    throw new Error("Not authorized");
  }

  const token = authorization.split(" ")[1];
  let decodedToken;

  try {
    decodedToken = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    res.status(401);
    throw new Error("Not authorized");
  }

  const user = await User.findById(decodedToken.id).select("-password");

  if (!user) {
    res.status(401);
    throw new Error("Not authorized");
  }

  req.user = user;
  next();
});

module.exports = {
  protect,
};

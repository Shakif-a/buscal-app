const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const User = require("../models/userModel");

const protect = asyncHandler(async (req, res, next) => {
  const authorization = String(req.headers.authorization || "");
  const match = authorization.match(/^Bearer\s+(\S+)$/i);

  if (!match) {
    res.status(401);
    throw new Error("Not authorized, no token");
  }

  const token = match[1];
  if (token.length > 4096 || !process.env.JWT_SECRET) {
    res.status(401);
    throw new Error("Not authorized");
  }

  // Belt and suspenders: check the declared algorithm ourselves before
  // handing the token to jsonwebtoken. The library's own `algorithms` option
  // below should already refuse anything but HS256, but a token's header is
  // attacker-controlled data, so we don't rely on a single layer for
  // something as easy to check as this.
  const headerSegment = token.split(".")[0];
  let declaredAlgorithm;
  try {
    declaredAlgorithm = JSON.parse(
      Buffer.from(headerSegment, "base64url").toString("utf8")
    ).alg;
  } catch (_decodeError) {
    res.status(401);
    throw new Error("Not authorized");
  }
  if (declaredAlgorithm !== "HS256") {
    res.status(401);
    throw new Error("Not authorized");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });

    req.user = await User.findById(decoded.id).select(
      "-password -resetPasswordToken -resetPasswordExpires"
    );

    if (!req.user) {
      res.status(401);
      throw new Error("Not authorized");
    }

    return next();
  } catch (_error) {
    // Authentication failures are intentionally generic and never log the
    // token or the decoded payload.
    res.status(401);
    throw new Error("Not authorized");
  }
});

module.exports = { protect };

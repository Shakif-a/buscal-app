const { ApiError } = require("../utils/ApiError");

function requireObjectBody(req, res, next) {
  if (
    ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) &&
    req.body !== undefined &&
    (req.body === null ||
      typeof req.body !== "object" ||
      Array.isArray(req.body))
  ) {
    return next(new ApiError(400, "Request body must be an object"));
  }
  next();
}

const errorHandler = (err, req, res, next) => {
  // Handle ApiError instances
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: err.success,
      message: err.message,
      data: err.data,
      errors: err.errors,
      stack: process.env.NODE_ENV === "production" ? null : err.stack,
    });
  }

  // Handle other errors
  let statusCode = res.statusCode !== 200 ? res.statusCode : 500;

  if (
    err.type === "entity.parse.failed" ||
    err.name === "ValidationError" ||
    err.name === "CastError"
  ) {
    statusCode = 400;
  } else if (err.code === 11000) {
    statusCode = 409;
  }

  res.status(statusCode).json({
    success: false,
    message: err.message || "Something went wrong",
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
};

module.exports = {
  errorHandler,
  requireObjectBody,
};

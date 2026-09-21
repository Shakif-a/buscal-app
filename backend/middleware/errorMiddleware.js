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
  let message = err.message || "Something went wrong";

  if (Number.isInteger(err.status) && err.status >= 400 && err.status <= 599) {
    statusCode = err.status;
  }

  if (
    err.type === "entity.parse.failed" ||
    err.name === "ValidationError" ||
    err.name === "CastError"
  ) {
    statusCode = 400;
  } else if (err.type === "entity.too.large") {
    statusCode = 413;
    message = req.path.includes("/evidence")
      ? "Evidence files cannot be larger than 5 MB"
      : "Request body is too large";
  } else if (err.code === 11000) {
    statusCode = 409;
  }

  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
};

module.exports = {
  errorHandler,
  requireObjectBody,
};

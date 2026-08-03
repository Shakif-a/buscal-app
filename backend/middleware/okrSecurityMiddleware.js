const mongoose = require("mongoose");
// Returns a 400 for a badly formed id instead of a database error.
function validateObjectId(paramName) {
  return (req, res, next) => {
    const value = req.params[paramName];
    if (!mongoose.Types.ObjectId.isValid(value)) {
      return res.status(400).json({
        success: false,
        message: `Invalid id format for "${paramName}"`,
      });
    }
    next();
  };
}
// Removes keys starting with "$" or containing ".", which are used for NoSQL injection.
function stripDangerousKeys(value) {
  if (Array.isArray(value)) {
    return value.map(stripDangerousKeys);
  }
  if (value && typeof value === "object") {
    const clean = {};
    for (const [key, inner] of Object.entries(value)) {
      if (key.startsWith("$") || key.includes(".")) continue;
      clean[key] = stripDangerousKeys(inner);
    }
    return clean;
  }
  return value;
}
function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === "object") {
    req.body = stripDangerousKeys(req.body);
  }
  next();
}
// Limits how many requests one IP can make in a time window.
function rateLimit({ windowMs = 60 * 1000, max = 300 } = {}) {
  const hits = new Map();
  // Clears old windows so the map does not grow forever.
  setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [key, entry] of hits) {
      if (entry.start < cutoff) hits.delete(key);
    }
  }, windowMs).unref();
  return (req, res, next) => {
    const key = req.ip || req.connection?.remoteAddress || "unknown";
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || now - entry.start > windowMs) {
      hits.set(key, { start: now, count: 1 });
      res.set("RateLimit-Limit", String(max));
      res.set("RateLimit-Remaining", String(Math.max(0, max - 1)));
      res.set("RateLimit-Reset", String(Math.ceil((now + windowMs) / 1000)));
      return next();
    }
    entry.count += 1;
    res.set("RateLimit-Limit", String(max));
    res.set("RateLimit-Remaining", String(Math.max(0, max - entry.count)));
    res.set(
      "RateLimit-Reset",
      String(Math.ceil((entry.start + windowMs) / 1000))
    );
    if (entry.count > max) {
      res.set("Retry-After", Math.ceil(windowMs / 1000));
      return res.status(429).json({
        success: false,
        message: "Too many requests. Please slow down and try again shortly.",
      });
    }
    next();
  };
}
module.exports = { validateObjectId, sanitizeBody, rateLimit };

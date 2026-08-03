const mongoose = require("mongoose");

// Three small guards for the OKR module, written by hand instead of pulling
// in a package, since this ships on customer hardware (Maxbox) and fewer
// third-party deps means less to patch.

// 1. ObjectId validation.
// Without this, GET /objectives/abc crashes Mongoose with a CastError and
// the client gets a confusing 500. With it, bad ids get a clean 400 first.
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

// 2. NoSQL-injection sanitiser.
// MongoDB operators start with "$" (like $where or $gt). If user input with
// those keys reaches a query, an attacker can change what the query does.
// This strips any key that starts with "$" or contains a ".".
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

// 3. Rate limiter.
// Small in-memory limiter keyed by client IP. Doesn't survive a restart or
// share state between instances, which is fine for a single-box deployment
// like the Maxbox. Limits are generous, just there to stop runaway scripts.
function rateLimit({ windowMs = 60 * 1000, max = 300 } = {}) {
  const hits = new Map();

  // Forget old windows now and then so the map cannot grow forever.
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

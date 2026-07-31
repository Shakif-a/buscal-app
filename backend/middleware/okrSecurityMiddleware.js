const mongoose = require("mongoose");

// ---------------------------------------------------------------------------
// Security middleware for the OKR module.
// Three small, dependency-free guards that bring the API up to commercial
// grade. Hand-rolled on purpose: the product ships on customer hardware
// (Maxbox), so every avoided third-party package is one less supply-chain
// risk and one less thing to patch.
// ---------------------------------------------------------------------------

// ---- 1. ObjectId validation ------------------------------------------------
// Without this, a request like GET /objectives/abc crashes Mongoose with a
// CastError and the client gets a confusing 500. With it, bad ids get a clean
// 400 before any database work happens.
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

// ---- 2. NoSQL-injection sanitiser ------------------------------------------
// MongoDB operators start with "$" (like $where or $gt). If user input
// containing those keys reaches a query, an attacker can change what the query
// does. This walks the request body and strips any key that starts with "$"
// or contains a ".", which removes the whole class of attack.
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

// ---- 3. Rate limiter -------------------------------------------------------
// A small in-memory limiter, keyed by client IP. It will not survive a server
// restart and does not share state between instances, which is fine for a
// single-box deployment like the Maxbox. The limits are generous; the point is
// to stop runaway scripts and brute-force loops, not to bother real users.
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

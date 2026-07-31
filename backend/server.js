/**
 * server.js — Business Calendar standalone backend
 *
 * Minimal Express server exposing only the routes this app needs.
 * Add new module routes (e.g. OKR) in the clearly marked section below.
 */

const express = require("express");
const dotenv = require("dotenv");
const colors = require("colors");
const cors = require("cors");
const crypto = require("crypto");
const mongoose = require("mongoose");
const { version } = require("./package.json");

const connectDB = require("./config/db");
const { errorHandler } = require("./middleware/errorMiddleware");

dotenv.config();

const app = express();
app.disable("x-powered-by");

if (process.env.TRUST_PROXY) {
  app.set("trust proxy", process.env.TRUST_PROXY);
}

// Middleware
const configuredOrigins = String(process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: configuredOrigins.length
      ? function allowConfiguredOrigin(origin, callback) {
          if (!origin || configuredOrigins.includes(origin)) {
            return callback(null, true);
          }
          const error = new Error("Origin is not allowed by CORS");
          error.statusCode = 403;
          return callback(error);
        }
      : true,
    credentials: configuredOrigins.length > 0,
    exposedHeaders: [
      "X-Request-Id",
      "X-Content-Type-Options",
      "RateLimit-Limit",
      "RateLimit-Remaining",
      "RateLimit-Reset",
      "Retry-After",
    ],
  })
);
app.use((req, res, next) => {
  const suppliedRequestId = String(req.headers["x-request-id"] || "");
  req.requestId = /^[A-Za-z0-9._:-]{1,128}$/.test(suppliedRequestId)
    ? suppliedRequestId
    : crypto.randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
  );
  next();
});
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));

function readinessPayload(req) {
  const databaseReady = mongoose.connection.readyState === 1;
  return {
    ok: databaseReady,
    service: "buscal-backend",
    version,
    database: databaseReady ? "connected" : "unavailable",
    uptimeSeconds: Math.round(process.uptime()),
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
  };
}

app.get("/api/health/live", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "buscal-backend",
    version,
    uptimeSeconds: Math.round(process.uptime()),
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
  });
});

app.get(["/api/health", "/api/health/ready"], (req, res) => {
  const payload = readinessPayload(req);
  res.status(payload.ok ? 200 : 503).json(payload);
});

// ── Core routes ──────────────────────────────────────────────────────────────
app.use("/api/calendar", require("./routes/calendarRoutes"));
app.use("/api/users", require("./routes/userRoutes")); // Auth + account settings
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/v1/notifications", require("./routes/notificationRoutes"));

// ── Add new module routes below this line ────────────────────────────────────
app.use("/api/okr", require("./routes/okrRoutes")); // OKR tracker (objectives, key results)
app.use("/api/v1/okr", require("./routes/okrRoutes")); // Versioned alias for new integrations

// The frontend is owned and deployed by a separate team. Keep this service
// API-only so its release cadence and security boundary stay independent.
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
    requestId: req.requestId,
  });
});

// Error handling middleware (must be after all routes)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
let server;

// Async to allow remote db connection before initialize
const startServer = async () => {
  try {
    if (
      process.env.NODE_ENV === "production" &&
      configuredOrigins.length === 0
    ) {
      throw new Error("CLIENT_ORIGIN is required in production");
    }

    // 1. Wait until MongoDB is connected
    await connectDB();

    // 2. Start the server
    server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`.cyan.underline);
    });

    // 3. Initialize
    if (process.env.SKIP_SCHEDULER !== "true") {
      // Load the scheduler only when it is actually enabled. The scheduler
      // registers cron jobs at module load, so a top-level import would keep
      // tests, health probes, and CLI tools alive unexpectedly.
      const {
        initializeCalendarScheduler,
      } = require("./scheduling/calendarScheduler");
      await initializeCalendarScheduler();
    }
  } catch (error) {
    console.error(`Failed to start server: ${error.message}`.red);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received. Closing Buscal cleanly...`);

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  process.exit(0);
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));

// Export server instance wrapper/getter (useful for testing frameworks)
module.exports = {
  app,
  startServer,
  get instance() {
    return server;
  },
};

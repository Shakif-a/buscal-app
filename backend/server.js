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
const path = require("path");

const connectDB = require("./config/db");
const {
  initializeCalendarScheduler,
} = require("./scheduling/calendarScheduler");
const { errorHandler } = require("./middleware/errorMiddleware");

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Static uploads directory
app.use("/uploads", express.static(path.join(__dirname, "../../uploads")));

// ── Core routes ──────────────────────────────────────────────────────────────
app.use("/api/calendar", require("./routes/calendarRoutes"));
app.use("/api/users", require("./routes/userRoutes")); // Auth + account settings

// ── Add new module routes below this line ────────────────────────────────────
// app.use("/api/okr", require("./routes/okrRoutes"));

// Error handling middleware (must be after all routes)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`.cyan.underline);
});

// Initialise schedulers
initializeCalendarScheduler();

// Export server instance (useful for testing)
module.exports = server;
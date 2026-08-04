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

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use("/uploads", express.static(path.join(__dirname, "../../uploads")));

app.use("/api/calendar", require("./routes/calendarRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/okr", require("./routes/okrRoutes"));

if (process.env.NODE_ENV === "production") {
  const frontendDist = path.join(__dirname, "../../frontend/dist");
  app.use(express.static(frontendDist));

  app.get("*", (req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
let server;

const startServer = async () => {
  try {
    await connectDB();

    server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`.cyan.underline);
    });

    await initializeCalendarScheduler();
  } catch (error) {
    console.error(`Failed to start server: ${error.message}`.red);
    process.exit(1);
  }
};

startServer();

module.exports = {
  get instance() {
    return server;
  },
};

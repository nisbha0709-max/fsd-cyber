require("dotenv").config();

const http = require("http");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const connectDB = require("./config/db");
const SlaRule = require("./models/SlaRule");
const realtime = require("./realtime");
const slaChecker = require("./jobs/slaChecker");
const sanitize = require("./middleware/sanitize");
const { notFound, errorHandler } = require("./middleware/errorHandler");

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is missing. Copy .env.example to .env and set it.");
  process.exit(1);
}

const app = express();
const server = http.createServer(app);

// ---- Global middleware ----
app.use(helmet());
app.use(
  cors({
    origin: (process.env.CLIENT_URL || "http://localhost:3000").split(",").map((s) => s.trim()),
    credentials: true,
    exposedHeaders: ["X-Evidence-SHA256", "Content-Disposition"],
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(sanitize);
if (process.env.NODE_ENV !== "test") app.use(morgan("dev"));

// Brute-force protection on login / register
app.use(
  "/api/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many attempts. Try again later." },
  })
);

// ---- Routes ----
app.get("/api/health", (req, res) => res.json({ success: true, status: "ok", time: new Date() }));
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/incidents", require("./routes/incidentRoutes"));
app.use("/api/evidence", require("./routes/evidenceRoutes"));
app.use("/api/dashboard", require("./routes/dashboardRoutes"));
app.use("/api/sla", require("./routes/slaRoutes"));

app.use(notFound);
app.use(errorHandler);

// ---- Boot ----
async function start() {
  await connectDB();
  await SlaRule.seedDefaults(); // makes sure every severity has an SLA rule
  realtime.init(server);
  slaChecker.start();

  const port = process.env.PORT || 5000;
  server.listen(port, () => console.log(`Server running on http://localhost:${port}`));
}

start().catch((err) => {
  console.error("Failed to start server:", err.message);
  process.exit(1);
});

process.on("unhandledRejection", (err) => console.error("Unhandled rejection:", err));

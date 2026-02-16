import "./initEnv.js";
import dotenv from "dotenv";
dotenv.config();
import { createRequire } from "module";
const require = createRequire(import.meta.url);
let result = require("dotenv").config();
if (result.error) {
  console.error("Error loading .env file:", result.error);
} else {
  console.log("Environment variables loaded successfully");
}
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import fs from "fs";
import path from "path";
import listEndpoints from "express-list-endpoints";
const rfs = require("rotating-file-stream");
const app = express();
morgan.token("status", (req, res) => res.statusCode);

morgan.token("res-body", (req, res) => res.locals.body || "-");

const logDirectory = path.join(process.cwd(), "logs");
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory);
}
const accessLogStream = rfs.createStream("attendance_api.log", {
  interval: "1d",
  path: logDirectory,
});

app.use((req, res, next) => {
  const oldSend = res.send;
  res.send = function (data) {
    try {
      // Avoid logging excessively large bodies
      const maxLen = 500;
      let out = data;
      if (Buffer.isBuffer(out)) {
        out = out.toString("utf8");
      } else if (typeof out !== "string") {
        try { out = JSON.stringify(out); } catch { out = String(out); }
      }
      if (typeof out === "string" && out.length > maxLen) {
        res.locals.body = out.slice(0, maxLen) + `... [${out.length - maxLen} chars truncated]`;
      } else {
        res.locals.body = out;
      }
    } catch {
      res.locals.body = "-";
    }
    return oldSend.call(this, data);
  };
  next();
});

app.use(
  morgan(
    "[:date[iso]] :method :url :status :response-time ms - res-body: :res-body",
    { stream: accessLogStream }
  )
);

// Create a router for the attendance-api base path
const attendanceApiRouter = express.Router();

// Apply middleware to the router
attendanceApiRouter.use(helmet());
attendanceApiRouter.use((req, res, next) => {
  if (req.originalUrl.startsWith("/facialAuth")) {
    console.log("Skipping JSON parsing for /facialAuth route");
    next();
  } else {
    express.json({ limit: '50mb' })(req, res, next);
  }
});
attendanceApiRouter.use(express.urlencoded({ limit: '50mb', extended: true }));
attendanceApiRouter.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Import routes
import activitiesRoutes from "./activityRoutes.js";
import authRoutes from "./authRoutes.js";
import userRoutes from "./userRoutes.js";
import facialAuthRoutes from "./facialAuthRoutes.js";
import projectRoutes from "./projectRoutes.js";
import siteRoutes from "./siteRoutes.js";
import payrollRoutes from "./payrollRoutes.js";
import leaveRoutes from "./leaveRoutes.js";
import scheduleRoutes from "./scheduleRoutes.js";
import faceStatusRoutes from "./faceStatusRoutes.js";
import attendanceRoutes from "./attendanceRoutes.js";
// import faceRecognitionDataRoutes from "./faceRecognitionDataRoutes.js"; // Disabled - using working version
// import testFaceRecRoutes from "./testFaceRecRoutes.js"; // Disabled - using clean version
import cleanFaceRecRoutes from "./cleanFaceRecRoutes.js";
import simpleSitesRoutes from "./simpleSitesRoutes.js";
import settingsRoutes from "./settingsRoutes.js";
import companyRoutes from "./companyRoutes.js";
import surveyRoutes from "./surveyRoutes.js";
import feedbackRoutes from "./feedbackRoutes.js";

// Mount routes on the attendanceApiRouter
attendanceApiRouter.use("/activities", activitiesRoutes);
attendanceApiRouter.use("/auth", authRoutes);
attendanceApiRouter.use("/users", userRoutes);
attendanceApiRouter.use("/facialAuth", facialAuthRoutes);
attendanceApiRouter.use("/projects", projectRoutes);
attendanceApiRouter.use("/sites", siteRoutes);
attendanceApiRouter.use("/leave", leaveRoutes);
attendanceApiRouter.use("/payroll", payrollRoutes);
attendanceApiRouter.use("/schedule", scheduleRoutes);
attendanceApiRouter.use("/face", faceStatusRoutes);
attendanceApiRouter.use("/attendance", attendanceRoutes);
attendanceApiRouter.use("/faceRecognition", cleanFaceRecRoutes); // Using clean working version
attendanceApiRouter.use("/api", simpleSitesRoutes); // Simple sites endpoint
attendanceApiRouter.use("/settings", settingsRoutes);
attendanceApiRouter.use("/company", companyRoutes);
attendanceApiRouter.use("/surveys", surveyRoutes);
attendanceApiRouter.use("/feedback", feedbackRoutes);

// Health check endpoint
attendanceApiRouter.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy" });
});

// Use the router with the base path
app.use("/", attendanceApiRouter);

// List all available endpoints
console.log("Available routes:");
console.table(
  listEndpoints(app).map((route) => ({
    ...route,
    path: `${route.path}`,
  }))
);

// Global JSON-safe error handler (kept after routes)
app.use((err, req, res, next) => {
  try {
    console.error("Global error handler:", err?.message || err);
    if (res.headersSent) return next(err);
    const isJsonParse = err?.type === "entity.parse.failed" || (err instanceof SyntaxError && "body" in err);
    const status = err?.status || err?.statusCode || (isJsonParse ? 400 : 500);
    const message = isJsonParse ? "Invalid JSON payload" : (err?.message || "Internal server error");
    const body = {
      success: false,
      message,
    };
    if (process.env.NODE_ENV !== "production") {
      body.error = err?.stack || err?.message;
    }
    res.status(status).type("application/json").send(JSON.stringify(body));
  } catch (e) {
    // Last resort
    res.status(500).type("application/json").send(JSON.stringify({ success: false, message: "Internal server error" }));
  }
});

const port = process.env.SERVER_PORT;
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
  console.log(`Local: http://localhost:${port}/`);
  console.log(`Production: ${process.env.DOMAIN || 'https://cx.brk.sg/attendance_api_mobile'}`);
  console.log(`Network: http://<your-ip>:${port}/`);
  console.log('\nTo access from mobile, use your computer\'s IP address or production domain');
});

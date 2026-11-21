import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import profileRouter from "./routes/profile.js";
import authRouter from "./routes/auth.js";
import usersRouter from "./routes/users.js";
import deadlinesRouter from "./routes/deadlines.js";
import eventsRouter from "./routes/events.js";
import securityGateRouter from "./routes/securityGate.js";
import resourcesRouter from "./routes/resources.js";
import { verifyFirebaseToken } from "./middleware/auth.js";
import { verifyGateTokenHeader } from "./middleware/gateAuth.js";

const app = express();

// Trust proxy for reverse proxies and Vercel
app.set("trust proxy", 1);

// Apply security headers to every API response.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        connectSrc: [
          "'self'",
          "https://*.vercel.app",
          "https://*.onrender.com",
          "https://kanbankc-oday.onrender.com",
          "https://apis.google.com",
          "https://*.google.com",
          "https://*.googleapis.com",
          "https://*.firebaseio.com",
          "https://*.firebaseapp.com"
        ],
      },
    },
    frameguard: { action: "deny" },
    noSniff: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// Configure CORS
const getOrigins = () => {
  const frontendOrigin = process.env.FRONTEND_ORIGIN || "";
  const rawOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    ...(frontendOrigin ? frontendOrigin.split(",") : []),
  ];
  return rawOrigins
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
};

app.use(
  cors({
    origin: (requestOrigin, callback) => {
      if (!requestOrigin) return callback(null, true);
      const allowedOrigins = getOrigins();
      if (allowedOrigins.includes(requestOrigin)) return callback(null, true);
      // Allow Vercel preview/production deployments
      if (/\.vercel\.app$/.test(requestOrigin)) return callback(null, true);
      console.warn(`CORS blocked for origin: ${requestOrigin}`);
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-gate-token", "x-file-name"],
    optionsSuccessStatus: 200,
    preflightContinue: false,
    maxAge: 86400,
  })
);

// Handle OPTIONS preflight explicitly
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-gate-token, x-file-name");
    res.header("Access-Control-Max-Age", "86400");
    return res.sendStatus(200);
  }
  next();
});

// Parse JSON request bodies.
app.use(express.json());

// CORS Error Handler
const errorHandler = (err, req, res, next) => {
  if (err?.message?.startsWith("CORS origin denied")) {
    return res.status(403).json({
      error: err.message,
      origin: req.headers.origin || null,
    });
  }
  return next(err);
};
app.use(errorHandler);

// Public / Health Routes
app.get("/", (req, res) => {
  res.status(200).json({ status: "ok", name: "Confused CSE 6CF API", version: "2.0.0" });
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", uptime: process.uptime ? process.uptime() : 0 });
});

// Rate limiters
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skip: (req) => {
    const path = req.path || "/";
    return path === "/health" || path === "/";
  },
});
app.use(limiter);

// Security gate
app.use("/api", (req, res, next) => {
  if (
    req.path === "/security-gate/question" ||
    req.path === "/security-gate/verify"
  ) {
    return next();
  }
  return verifyGateTokenHeader(req, res, next);
});

// API Routes
app.use("/api/auth", verifyFirebaseToken, authRouter);
app.use("/api/users", verifyFirebaseToken, usersRouter);
app.use("/api/deadlines", verifyFirebaseToken, deadlinesRouter);
app.use("/api/profile", verifyFirebaseToken, profileRouter);
app.use("/api/events", verifyFirebaseToken, eventsRouter);
app.use("/api/resources", verifyFirebaseToken, resourcesRouter);
app.use("/api/security-gate", securityGateRouter);

export default app;

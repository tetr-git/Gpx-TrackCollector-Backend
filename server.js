require("dotenv").config();
const express = require("express");
const cors = require("cors");
const enforceSSL = require("express-enforces-ssl");
const cookieParser = require("cookie-parser");
const gpxRoutes = require("./routes/gpxRoutes");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const userRoutes = require("./routes/userRoutes");
const https = require("https");
const fs = require("fs");

const app = express();
const port = process.env.PORT;

const privateKey = fs.readFileSync("./ssl/key.pem", "utf8");
const certificate = fs.readFileSync("./ssl/cert.pem", "utf8");
const credentials = { key: privateKey, cert: certificate };

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests, please try again later.",
});

// Middleware
const corsOptions = {
  origin: process.env.CORS_ORIGIN,
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(helmet());
app.use("/api", apiLimiter);
app.use(enforceSSL());

// Routes
app.use("/api/gpx", gpxRoutes);
app.use("/api", userRoutes);

const httpsServer = https.createServer(credentials, app);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

httpsServer.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const express = require("express");
const GPXParser = require("gpxparser");
const cors = require("cors");
const multer = require("multer");
const port = 3003;
const cookieParser = require("cookie-parser");
const { User } = require("./db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "maps");
  },
  filename: (req, file, cb) => {
    const mapsFolderPath = path.join(__dirname, "maps");
    fs.readdir(mapsFolderPath, (err, files) => {
      if (err) {
        cb(err);
        return;
      }

      if (files.includes(file.originalname)) {
        cb(new Error("File with the same name already exists"));
      } else {
        cb(null, file.originalname);
      }
    });
  },
});

const upload = multer({ storage }).single("file");

app.post("/api/upload", (req, res) => {
  upload(req, res, (err) => {
    if (err) {
      if (err.message === "File with the same name already exists") {
        res.status(409).json({ message: err.message });
      } else {
        res.status(400).json({ message: err.message });
      }
      return;
    }

    if (!req.file) {
      res.status(400).json({ message: "No file was provided" });
      return;
    }

    if (path.extname(req.file.originalname).toLowerCase() !== ".gpx") {
      res.status(400).json({ message: "Only GPX files are allowed" });
      return;
    }

    res.status(200).json({ message: "File uploaded successfully" });
  });
});

app.delete("/api/gpx/:fileName", (req, res) => {
  const fileName = req.params.fileName;
  const mapsFolderPath = path.join(__dirname, "maps");
  const filePath = path.join(mapsFolderPath, fileName);

  fs.unlink(filePath, (err) => {
    if (err) {
      console.error(err);
      res.status(500).send("Error deleting the file");
      return;
    }
    res.status(200).json({ message: "File deleted successfully" });
  });
});

// Send the number of tracks
app.get("/api/gpx/all", (req, res) => {
  const mapsFolderPath = path.join(__dirname, "maps");
  fs.readdir(mapsFolderPath, (err, files) => {
    if (err) {
      console.error(err);
      res.status(500).send("Error reading maps folder");
      return;
    }
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({ count: files.length });
  });
});

// Use the index for the GET request
app.get("/api/gpx/:index", (req, res) => {
  const index = req.params.index;
  const mapsFolderPath = path.join(__dirname, "maps");

  fs.readdir(mapsFolderPath, async (err, files) => {
    if (err) {
      console.error(err);
      res.status(500).send("Error reading maps folder");
      return;
    }

    if (index < 0 || index >= files.length) {
      res.status(404).send("Track not found");
      return;
    }

    const fileName = files[index];
    const filePath = path.join(mapsFolderPath, fileName);

    fs.readFile(filePath, "utf8", (err, gpxData) => {
      if (err) {
        console.error(err);
        res.status(500).send("Error reading GPX file");
        return;
      }

      const parser = new GPXParser();
      parser.parse(gpxData);
      res.json({ fileName, data: parser.tracks });
    });
  });
});

// Register user (for testing purposes)
app.post("/api/register", async (req, res) => {
  console.log(req.body); // Add this line to log the request body
  const { email, password } = req.body;
  const passwordHash = await bcrypt.hash(password, 10);
  console.log(passwordHash, password, email);
  try {
    const newUser = await User.create({ email, passwordHash });
    res
      .status(201)
      .json({ message: "User created successfully", user: newUser });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error creating user", error: error.message });
  }
});

// Login user
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ where: { email } });
  if (!user) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  res.cookie("token", token, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.status(200).json({ message: "Login successful", user });
});

// Logout user
app.post("/api/logout", (req, res) => {
  res.clearCookie("token");
  res.status(200).json({ message: "Logout successful" });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

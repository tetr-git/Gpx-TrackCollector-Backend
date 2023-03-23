require("dotenv").config();
const fs = require("fs");
const path = require("path");
const express = require("express");
const GPXParser = require("gpxparser");
const cors = require("cors");
const multer = require("multer");
const cookieParser = require("cookie-parser");
const { User } = require("./db");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const app = express();
const port = 3003;

// Middleware
const corsOptions = {
  origin: "http://localhost:3000",
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Authentication Middleware
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: "Unauthorized" });
  }
};

// Routes
// Upload GPX file
app.post("/api/upload", authenticate, (req, res) => {
  const userStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const userFolderPath = path.join(__dirname, "maps", req.user.folderHash);
      fs.mkdirSync(userFolderPath, { recursive: true });
      cb(null, userFolderPath);
    },
    filename: (req, file, cb) => {
      const userFolderPath = path.join(__dirname, "maps", req.user.folderHash);
      fs.readdir(userFolderPath, (err, files) => {
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

  const userUpload = multer({ storage: userStorage }).single("file");

  userUpload(req, res, (err) => {
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

// Delete one GPX file
app.delete("/api/gpx/:fileName", authenticate, (req, res) => {
  const fileName = req.params.fileName;
  const userFolderPath = path.join(__dirname, "maps", req.user.folderHash);
  const filePath = path.join(userFolderPath, fileName);

  fs.unlink(filePath, (err) => {
    if (err) {
      console.error(err);
      res.status(500).send("Error deleting the file");
      return;
    }
    res.status(200).json({ message: "File deleted successfully" });
  });
});

// Geth the number of tracks
app.get("/api/gpx/all", authenticate, (req, res) => {
  const userFolderPath = path.join(__dirname, "maps", req.user.folderHash);

  fs.access(userFolderPath, fs.constants.F_OK, (err) => {
    if (err) {
      if (err.code === "ENOENT") {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.json({ count: 0 });
      } else {
        console.error(err);
        res.status(500).send("Error accessing maps folder");
      }
      return;
    }

    fs.readdir(userFolderPath, (err, files) => {
      if (err) {
        console.error(err);
        res.status(500).send("Error reading maps folder");
        return;
      }
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.json({ count: files.length });
    });
  });
});

// Use the index for the GET request
app.get("/api/gpx/:index", authenticate, (req, res) => {
  const index = req.params.index;
  const userFolderPath = path.join(__dirname, "maps", req.user.folderHash);

  fs.readdir(userFolderPath, async (err, files) => {
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
    const filePath = path.join(userFolderPath, fileName);

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

//Download GPX file
app.get("/api/gpx/download/:fileName", authenticate, (req, res) => {
  console.log(req);
  const fileName = req.params.fileName;

  const userFolderPath = path.join(__dirname, "maps", req.user.folderHash);

  fs.readdir(userFolderPath, (err, files) => {
    if (err) {
      console.error(err);
      res.status(500).send("Error reading maps folder");
      return;
    }

    if (!files.includes(fileName)) {
      res.status(404).send("Track not found");
      return;
    }

    const filePath = path.join(userFolderPath, fileName);

    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error(err);
        res.status(500).send("Error downloading GPX file");
      }
    });
  });
});

// Register user
app.post("/api/register", async (req, res) => {
  const { email, password } = req.body;
  const passwordHash = await bcrypt.hash(password, 10);
  const folderHash = crypto.randomBytes(16).toString("hex");
  try {
    const newUser = await User.create({ email, passwordHash, folderHash });
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

  res.status(200).json({ message: "Login successful", user, token });
});

// Logout user
app.post("/api/logout", (req, res) => {
  res.clearCookie("token");
  res.status(200).json({ message: "Logout successful" });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

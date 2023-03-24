const express = require("express");
const authenticate = require("../middlewares/authenticate");
const router = express.Router();
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const GPXParser = require("gpxparser");

// Upload GPX file
router.post("/upload", authenticate, (req, res) => {
  const userStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const userFolderPath = path.resolve(
        __dirname,
        "..",
        "maps",
        req.user.folderHash
      );
      fs.mkdirSync(userFolderPath, { recursive: true });
      cb(null, userFolderPath);
    },
    filename: (req, file, cb) => {
      const userFolderPath = path.resolve(
        __dirname,
        "..",
        "maps",
        req.user.folderHash
      );
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
router.delete("/:fileName", authenticate, (req, res) => {
  const fileName = req.params.fileName;
  const userFolderPath = path.resolve(
    __dirname,
    "..",
    "maps",
    req.user.folderHash
  );
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

// Get the number of tracks
router.get("/all", authenticate, (req, res) => {
  const userFolderPath = path.resolve(
    __dirname,
    "..",
    "maps",
    req.user.folderHash
  );
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
router.get("/:index", authenticate, (req, res) => {
  const index = req.params.index;
  const userFolderPath = path.resolve(
    __dirname,
    "..",
    "maps",
    req.user.folderHash
  );
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

// Download GPX file
router.get("/download/:fileName", authenticate, (req, res) => {
  const fileName = req.params.fileName;
  const userFolderPath = path.resolve(
    __dirname,
    "..",
    "maps",
    req.user.folderHash
  );
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

module.exports = router;

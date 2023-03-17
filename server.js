const fs = require("fs");
const path = require("path");
const express = require("express");
const GPXParser = require("gpxparser");
const cors = require("cors");
const multer = require("multer");
const app = express();
const port = 3003;

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

app.use(cors());

app.get("/api/gpx", (req, res) => {
  const mapsFolderPath = path.join(__dirname, "maps");
  fs.readdir(mapsFolderPath, (err, files) => {
    if (err) {
      console.error(err);
      res.status(500).send("Error reading maps folder");
      return;
    }
    res.setHeader("Access-Control-Allow-Origin", "*");
    const responses = [];
    files.forEach((fileName) => {
      const filePath = path.join(mapsFolderPath, fileName);
      fs.readFile(filePath, "utf8", (err, gpxData) => {
        if (err) {
          console.error(err);
          responses.push({ fileName, error: "Error reading GPX file" });
        } else {
          const parser = new GPXParser();
          parser.parse(gpxData);
          responses.push({ fileName, data: parser.tracks });
        }
        if (responses.length === files.length) {
          console.log(responses);
          res.json(responses);
        }
      });
    });
  });
});

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

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

const fs = require("fs");
const path = require("path");
const express = require("express");
const GPXParser = require("gpxparser");
const cors = require("cors");
const app = express();
const port = 3003;

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

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

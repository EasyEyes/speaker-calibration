const express = require("express");
const app = express();
const path = require("path");

const port = 3000;

app.use("/", express.static(path.join(__dirname, "/example"))); // serve the html files in /example
app.use('/dist', express.static(path.join(__dirname, '../dist'))); // sere the distriution files in /dist

// Middleware to check we have all the params we need
const checkParams = (req, res, next) => {
  if (!req.query.hasOwnProperty("speakerPeerId")) {
    console.log("No peerID given."); // TODO Breaking! Serve error
    throw "No peerID given -- unable to connect to peer.";
  }
  next();
};

// Simple Routing
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/speaker", (req, res) => {
  res.sendFile(path.join(__dirname, "speaker.html"));
});

app.get("/listener", checkParams, (req, res) => {
  res.sendFile(path.join(__dirname, "listener.html"));
});

app.use((err, req, res) => {
  res.status(err.status || 500);
  res.send({
    error: err.message,
  });
});

app.use((req, res) => {
  res.status(404);
  res.send({
    error: "404 not found",
  });
});

if (!module.parent) {
  app.listen(port);
  console.log(`Express started on port ${  port}`);
}

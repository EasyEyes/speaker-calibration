// eslint-disable-next-line import/no-extraneous-dependencies
const express = require('express');
const path = require('path');

const app = express();
const port = 3000;

app.use('/', express.static(path.join(__dirname, '/../'))); // serve the distribution folder

// Middleware to check we have all the params we need
const checkParams = (req, res, next) => {
  if (!Object.prototype.hasOwnProperty.call(req.query, 'speakerPeerId')) {
    console.log('No peerID given.');
    throw new Error('No peerID given -- unable to connect to peer.');
  }
  next();
};

// Simple Routing
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/speaker', (req, res) => {
  res.sendFile(path.join(__dirname, 'speaker.html'));
});

app.get('/listener', checkParams, (req, res) => {
  res.sendFile(path.join(__dirname, 'listener.html'));
});

app.use((err, req, res, next) => {
  res.status(err.status || 500);
  res.send({
    error: err.message,
  });
});

app.use((req, res) => {
  res.status(404);
  res.send({
    error: '404 not found',
  });
});

// if (!module.parent) {
//   app.listen(port);
//   console.log(`Express started`);
// }

app.listen(process.env.PORT || port);

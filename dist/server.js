const express = require('express');
const app = express();
const path = require('path');

const port = 3000;

app.use('/', express.static(path.join(__dirname, '/')))

app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/speaker', (req, res) => {
	res.sendFile(path.join(__dirname, 'speaker.html'));
})

app.get('/listener', (req, res) => {
	res.sendFile(path.join(__dirname, 'listener.html'));
})

app.listen(port);

console.log('Express started on port ' + port);
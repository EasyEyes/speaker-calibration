const express = require('express')
const path = require('path')
const app = express()

app.use('/static', express.static(path.join(__dirname, '/example')))

app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname, 'example/', 'index.html'));
})
app.get('/speaker', (req, res) => {
	res.sendFile(path.join(__dirname, 'example/', 'speaker.html'));
})
app.get('/listener', (req, res) => {
	res.sendFile(path.join(__dirname, 'example/', 'listener.html'));
})

// export 'app'
module.exports = app

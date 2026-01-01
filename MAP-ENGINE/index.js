const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const fs = require('fs');
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Helper to flatten MongoDB objects
function flattenMongo(obj) {
  if (Array.isArray(obj)) return obj.map(flattenMongo);
  if (obj !== null && typeof obj === 'object') {
    const newObj = {};
    for (const key in obj) {
      if (key === '_id' && obj[key].$oid) {
        newObj.id = obj[key].$oid;
      } else if (typeof obj[key] === 'object' && obj[key] !== null && obj[key].$oid) {
        newObj[key] = obj[key].$oid;
      } else {
        newObj[key] = flattenMongo(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
}

// Merged Campaign Route
app.get('/campaign-state', (req, res) => {
  try {
    const characters = flattenMongo(JSON.parse(fs.readFileSync('./data/characters.json', 'utf8')));
    const locations = flattenMongo(JSON.parse(fs.readFileSync('./data/locations.json', 'utf8')));
    res.json({
      characters,
      locations
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to merge campaign data' });
  }
});

app.get('/session', (req, res) => {
  try {
    const characters = JSON.parse(fs.readFileSync('./data/characters.json', 'utf8'));
    const tokens = JSON.parse(fs.readFileSync('./data/tokens.json', 'utf8'));
    res.json({ characters, tokens });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load session data' });
  }
});

io.on('connection', (socket) => {
  console.log('⚔️ A General has joined the war room.');

  socket.on('token_move', (data) => {
    // Update session.json as source of truth
    try {
      const sessionData = JSON.parse(fs.readFileSync('./session.json', 'utf8'));
      const char = sessionData.characters.find(c => c.characterId === data.id);
      if (char) {
        char.lat = data.lat;
        char.lng = data.lng;
        fs.writeFileSync('./session.json', JSON.stringify(sessionData, null, 2));
      }
    } catch (err) {
      console.error('Error updating session.json:', err);
    }
    
    // This tells everyone else: "Hey, Washington moved!"
    socket.broadcast.emit('update_token', data);
  });
});

app.get('/api/locations', (req, res) => {
  try {
    const locations = flattenMongo(JSON.parse(fs.readFileSync('./data/locations.json', 'utf8')));
    res.json(locations);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load locations' });
  }
});

http.listen(5000, '0.0.0.0', () => { 
  console.log('🚀 Engine Online: Webview enabled at Port 5000'); 
});
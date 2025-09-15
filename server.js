const WebSocket = require('ws');
const express = require('express');
const http = require('http');

const app = express();
app.use(express.static('public'));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const pixels = [];

wss.on('connection', ws => {
  // Send existing pixels to new user
  ws.send(JSON.stringify({ type: 'init', pixels }));

  ws.on('message', message => {
    const data = JSON.parse(message);

    if (data.type === 'draw') {
      // Update or add pixel
      const idx = pixels.findIndex(p => p.x === data.x && p.y === data.y);
      if (idx >= 0) pixels[idx] = data; else pixels.push(data);

      // Broadcast to all clients
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(data));
      });
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

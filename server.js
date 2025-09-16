const WebSocket = require("ws");
const express = require("express");
const http = require("http");

const app = express();
app.use(express.static("public"));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const WORLD_WIDTH = 5000;
const WORLD_HEIGHT = 5000;
const CHUNK_SIZE = 100;

// Pixel storage
const chunks = new Map();
// Chat storage
const chatMessages = [];
// User data
const userData = new Map(); // ws => { points, lastAction }

wss.on("connection", (ws) => {
  userData.set(ws, { points: 6, lastAction: Date.now() });

  // Send init data
  ws.send(
    JSON.stringify({
      type: "init",
      chat: chatMessages,
      pixels: Array.from(chunks.values()).flat(),
    })
  );

  ws.on("message", (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch {
      return;
    }
    const user = userData.get(ws);
    const now = Date.now();

    if (data.type === "draw") {
      // Check cooldown
      if (user.points <= 0 && now - user.lastAction < 30000) return;
      if (user.points <= 0 && now - user.lastAction >= 30000) user.points = 1;

      if (user.points > 0) {
        user.points--;
        user.lastAction = now;

        const chunkX = Math.floor(data.x / CHUNK_SIZE);
        const chunkY = Math.floor(data.y / CHUNK_SIZE);
        const key = `${chunkX},${chunkY}`;
        if (!chunks.has(key)) chunks.set(key, []);
        const chunk = chunks.get(key);
        const idx = chunk.findIndex((p) => p.x === data.x && p.y === data.y);
        if (idx >= 0) chunk[idx] = data;
        else chunk.push(data);

        // Broadcast pixel
        const msg = JSON.stringify(data);
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) client.send(msg);
        });
      }
    }

    if (data.type === "chat") {
      chatMessages.push(data);
      // Keep last 50 messages
      if (chatMessages.length > 50) chatMessages.shift();
      const msg = JSON.stringify(data);
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) client.send(msg);
      });
    }
  });

  ws.on("close", () => userData.delete(ws));
});

// Restore 1 point every 30s
setInterval(() => {
  userData.forEach((user) => {
    user.points = Math.min(user.points + 1, 6);
  });
}, 30000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);

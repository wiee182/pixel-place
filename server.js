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

// Pixel chunks
const chunks = new Map();

// Chat messages
const chatMessages = [];

// User data (points + cooldown)
const userData = new Map(); // ws -> { points, lastAction }

wss.on("connection", (ws) => {
  userData.set(ws, { points: 6, lastAction: Date.now() });

  // Send initial state
  ws.send(
    JSON.stringify({
      type: "init",
      chat: chatMessages,
      chunks: Array.from(chunks.entries()),
    })
  );

  ws.on("message", (message) => {
    const data = JSON.parse(message);
    const user = userData.get(ws);
    const now = Date.now();

    if (data.type === "draw") {
      // Cooldown & points check
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
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN)
            client.send(JSON.stringify(data));
        });
      }
    }

    if (data.type === "chat") {
      chatMessages.push(data);
      // Broadcast chat
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN)
          client.send(JSON.stringify(data));
      });
    }
  });

  ws.on("close", () => userData.delete(ws));
});

// Restore 1 point every 30 seconds
setInterval(() => {
  userData.forEach((user) => {
    user.points = Math.min(user.points + 1, 6);
  });
}, 30000);

const PORT = process.env.PORT || 8080;
server.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
);

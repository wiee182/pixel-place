// server.js
// Express + ws WebSocket server for Pixel Canvas
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from public/
app.use(express.static(path.join(__dirname, "public")));

// Create HTTP server and attach WebSocket server
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// World config (should match client)
const WORLD_WIDTH = 5000;
const WORLD_HEIGHT = 5000;
const CHUNK_SIZE = 100;

// In-memory storage (simple; persist externally if you need persistence)
const chunks = new Map(); // key -> [{x,y,color}, ...]
const chatMessages = []; // { type: 'chat', text, ts }
const userData = new Map(); // ws -> { points, lastAction }

// Helpers
function chunkKeyFor(x, y) {
  return `${Math.floor(x / CHUNK_SIZE)},${Math.floor(y / CHUNK_SIZE)}`;
}

function flattenChunks() {
  // Flatten all pixel lists into one array to send to clients on init
  const result = [];
  for (const [, arr] of chunks) {
    for (const p of arr) result.push(p);
  }
  return result;
}

function broadcastJSON(obj, exceptWs = null) {
  const payload = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN && client !== exceptWs) {
      client.send(payload);
    }
  }
}

// WebSocket logic
wss.on("connection", (ws, req) => {
  // Initialize user data
  userData.set(ws, { points: 6, lastAction: Date.now() });

  // Send initial snapshot: pixels + chat + world config + points
  try {
    ws.send(JSON.stringify({
      type: "init",
      pixels: flattenChunks(),
      chat: chatMessages,
      world: { width: WORLD_WIDTH, height: WORLD_HEIGHT, gridSize: CHUNK_SIZE },
      points: 6
    }));
  } catch (err) {
    console.error("Failed to send init:", err);
  }

  ws.on("message", (raw) => {
    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      // ignore invalid JSON
      return;
    }
    const user = userData.get(ws) || { points: 6, lastAction: 0 };
    const now = Date.now();

    // === Draw event ===
    if (data && data.type === "draw" && typeof data.x === "number" && typeof data.y === "number") {
      // Rate / point check
      // If no points and too fast, drop the action
      if (user.points <= 0 && now - user.lastAction < 30000) {
        // ignore
        return;
      }
      if (user.points <= 0 && now - user.lastAction >= 30000) {
        user.points = 1; // restore 1 if enough time has passed
      }

      if (user.points > 0) {
        user.points--;
        user.lastAction = now;
        userData.set(ws, user);

        // normalize pixel to grid
        const x = Math.max(0, Math.min(WORLD_WIDTH - (data.size || 10), Math.floor(data.x / (data.size || 10)) * (data.size || 10)));
        const y = Math.max(0, Math.min(WORLD_HEIGHT - (data.size || 10), Math.floor(data.y / (data.size || 10)) * (data.size || 10)));
        const color = data.color || "#000";

        const stored = { type: "draw", x, y, color };

        const key = chunkKeyFor(x, y);
        if (!chunks.has(key)) chunks.set(key, []);
        const list = chunks.get(key);
        const idx = list.findIndex(p => p.x === x && p.y === y);
        if (idx >= 0) list[idx] = stored;
        else list.push(stored);

        // broadcast to everyone (including sender)
        broadcastJSON(stored);
      }
    }

    // === Chat event ===
    if (data && data.type === "chat" && typeof data.text === "string") {
      const msg = { type: "chat", text: data.text, ts: Date.now() };
      chatMessages.push(msg);
      // Keep chat size reasonable
      if (chatMessages.length > 200) chatMessages.shift();
      broadcastJSON(msg);
    }

    // === Optional: client asks for points update ===
    if (data && data.type === "get_points") {
      ws.send(JSON.stringify({ type: "points", points: user.points || 0 }));
    }
  });

  ws.on("close", () => {
    userData.delete(ws);
  });
});

// Restore 1 point every 30 seconds for each connected user (server-side)
setInterval(() => {
  for (const [ws, user] of userData) {
    if (!user) continue;
    const before = user.points;
    user.points = Math.min((user.points || 0) + 1, 6);
    // we don't broadcast every small change to reduce noise; clients can request points or server can send on draw.
    userData.set(ws, user);
    // optionally notify the client of their new points:
    if (ws.readyState === WebSocket.OPEN && user.points !== before) {
      try { ws.send(JSON.stringify({ type: "points", points: user.points })); } catch (e) {}
    }
  }
}, 30000);

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

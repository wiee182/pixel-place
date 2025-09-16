// ===== Dependencies =====
const WebSocket = require("ws");
const express = require("express");
const http = require("http");
const Database = require("better-sqlite3");

// ===== App Setup =====
const app = express();
app.use(express.static("public"));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ===== Database Setup =====
const db = new Database("canvas.db");

// Create tables if not exist
db.prepare(`
  CREATE TABLE IF NOT EXISTS pixels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    x INTEGER,
    y INTEGER,
    color TEXT,
    user TEXT,
    timestamp INTEGER
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS canvas_state (
    x INTEGER,
    y INTEGER,
    color TEXT,
    PRIMARY KEY (x,y)
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS chat (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user TEXT,
    message TEXT,
    timestamp INTEGER
  )
`).run();

// ===== Constants =====
const WORLD_WIDTH = 5000;
const WORLD_HEIGHT = 5000;
const CHUNK_SIZE = 100;
const MAX_POINTS = 6;
const COOLDOWN = 20000; // 20s per point

// ===== User Data =====
const userData = new Map(); // ws => { points, lastRegen }

// ===== Helper Functions =====
function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function broadcast(data) {
  const str = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(str);
    }
  });
}

// Load initial state
function loadCanvasState() {
  const rows = db.prepare("SELECT x,y,color FROM canvas_state").all();
  return rows;
}

function loadChatHistory(limit = 50) {
  return db.prepare("SELECT * FROM chat ORDER BY id DESC LIMIT ?").all(limit).reverse();
}

// ===== WebSocket Handling =====
wss.on("connection", (ws) => {
  userData.set(ws, { points: MAX_POINTS, lastRegen: Date.now() });

  // Send initial data
  send(ws, {
    type: "init",
    canvas: loadCanvasState(),
    chat: loadChatHistory(),
    points: MAX_POINTS,
  });

  ws.on("message", (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch {
      return;
    }

    const user = userData.get(ws);
    const now = Date.now();

    // Handle pixel placement
    if (data.type === "draw") {
      if (!("x" in data) || !("y" in data) || !("color" in data)) return;

      if (user.points <= 0) {
        send(ws, { type: "error", message: "No points left. Wait for cooldown." });
        return;
      }

      // Deduct point
      user.points--;
      user.lastRegen = now;

      // Insert into history
      db.prepare(
        "INSERT INTO pixels (x,y,color,user,timestamp) VALUES (?,?,?,?,?)"
      ).run(data.x, data.y, data.color, data.user || "anon", now);

      // Update current state
      db.prepare(
        "INSERT INTO canvas_state (x,y,color) VALUES (?,?,?) ON CONFLICT(x,y) DO UPDATE SET color=excluded.color"
      ).run(data.x, data.y, data.color);

      // Broadcast to all
      broadcast({
        type: "draw",
        x: data.x,
        y: data.y,
        color: data.color,
      });

      // Update user points
      send(ws, { type: "points", points: user.points });
    }

    // Handle chat
    if (data.type === "chat") {
      if (!data.message?.trim()) return;

      db.prepare(
        "INSERT INTO chat (user,message,timestamp) VALUES (?,?,?)"
      ).run(data.user || "anon", data.message, now);

      const chatMsg = {
        type: "chat",
        user: data.user || "anon",
        message: data.message,
        timestamp: now,
      };

      broadcast(chatMsg);
    }
  });

  ws.on("close", () => {
    userData.delete(ws);
  });
});

// Regenerate points every 20s
setInterval(() => {
  const now = Date.now();
  userData.forEach((user, ws) => {
    if (user.points < MAX_POINTS && now - user.lastRegen >= COOLDOWN) {
      user.points++;
      user.lastRegen = now;
      send(ws, { type: "points", points: user.points });
    }
  });
}, 1000);

// ===== Start Server =====
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

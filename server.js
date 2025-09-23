const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const { Pool } = require("pg");
const path = require("path");

// Database connection (Railway provides DATABASE_URL)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Express setup
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, "public")));

// Load pixels from DB
async function getPixels() {
  const res = await pool.query("SELECT x, y, color FROM pixels");
  return res.rows;
}

// Save a pixel
async function savePixel(x, y, color) {
  await pool.query(
    "INSERT INTO pixels (x, y, color) VALUES ($1, $2, $3) ON CONFLICT (x, y) DO UPDATE SET color = $3",
    [x, y, color]
  );
}

// Broadcast to all clients
function broadcast(data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// WebSocket handling
wss.on("connection", async (ws) => {
  const pixels = await getPixels();
  ws.send(JSON.stringify({ type: "init", pixels }));

  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === "draw") {
        await savePixel(data.x, data.y, data.color);
        broadcast({ type: "pixel", x: data.x, y: data.y, color: data.color });
      }
    } catch (err) {
      console.error("WebSocket error:", err);
    }
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

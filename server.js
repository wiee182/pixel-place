// server.js
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const cron = require("node-cron");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static("public"));

// PostgreSQL connection
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Railway requires this
});

client.connect()
  .then(() => console.log("Connected to PostgreSQL"))
  .catch(err => console.error("PostgreSQL connection error:", err));

// Create tables if they don't exist
client.query(`
CREATE TABLE IF NOT EXISTS pixels (
  x INT NOT NULL,
  y INT NOT NULL,
  color TEXT NOT NULL,
  PRIMARY KEY(x,y)
);
CREATE TABLE IF NOT EXISTS pixel_history (
  id SERIAL PRIMARY KEY,
  x INT NOT NULL,
  y INT NOT NULL,
  color TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
`).then(() => console.log("Tables ready"))
  .catch(err => console.error("Error creating tables:", err));

// Load current canvas
async function getCanvas() {
  const res = await client.query("SELECT x, y, color FROM pixels");
  return res.rows;
}

// Save pixel to both current canvas and history
async function setPixel(x, y, color) {
  await client.query(
    `INSERT INTO pixels(x,y,color) VALUES($1,$2,$3)
     ON CONFLICT(x,y) DO UPDATE SET color = EXCLUDED.color`,
    [x, y, color]
  );
  await client.query(
    `INSERT INTO pixel_history(x,y,color) VALUES($1,$2,$3)`,
    [x, y, color]
  );
}

// Connected clients
const clients = new Map();

wss.on("connection", async ws => {
  ws.send(JSON.stringify({ type: "init", pixels: await getCanvas() }));
  clients.set(ws, { points: 10, cooldown: 0 });

  ws.on("message", async msg => {
    let data;
    try { data = JSON.parse(msg); } catch { return; }

    // Drawing pixels
    if (data.type === "draw") {
      const clientData = clients.get(ws);
      if (!clientData) return;

      if (clientData.points > 0 && clientData.cooldown === 0) {
        await setPixel(data.x, data.y, data.color);
        clientData.points--;
        clientData.cooldown = 20;

        // Broadcast pixel
        wss.clients.forEach(c => {
          if (c.readyState === WebSocket.OPEN)
            c.send(JSON.stringify({ type: "pixel", x: data.x, y: data.y, color: data.color }));
        });

        ws.send(JSON.stringify({ type: "updatePoints", points: clientData.points, cooldown: clientData.cooldown }));
      }
    }

    // Chat messages
    if (data.type === "chat") {
      const message = { type: "chat", user: data.user, text: data.text };
      wss.clients.forEach(c => {
        if (c.readyState === WebSocket.OPEN) c.send(JSON.stringify(message));
      });
    }
  });

  ws.on("close", () => clients.delete(ws));
});

// Cooldown timer
setInterval(() => {
  clients.forEach((clientData, ws) => {
    if (clientData.cooldown > 0) {
      clientData.cooldown--;
      if (clientData.cooldown === 0 && clientData.points < 10) clientData.points++;
      if (ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify({ type: "updatePoints", points: clientData.points, cooldown: clientData.cooldown }));
    }
  });
}, 1000);

// --- Monthly timelapse + canvas reset ---
// Runs at 1 AM UTC on the first day of every month
cron.schedule("0 1 1 * *", async () => {
  console.log("Starting monthly timelapse generation...");

  // Create folder for frames
  const framesDir = path.join(__dirname, "frames");
  if (!fs.existsSync(framesDir)) fs.mkdirSync(framesDir, { recursive: true });

  // Export pixel_history to CSV for FFmpeg
  const res = await client.query("SELECT * FROM pixel_history ORDER BY timestamp ASC");
  const pixels = res.rows;

  // Save each frame as PNG
  // For simplicity, here we just save one PNG snapshot of full canvas
  // For real timelapse, you can expand this to multiple frames
  const { createCanvas } = require("canvas");
  const canvas = createCanvas(1000, 1000); // adjust size
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  pixels.forEach(p => {
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 10, 10);
  });

  const outputPath = path.join(__dirname, `timelapse-${Date.now()}.png`);
  const out = fs.createWriteStream(outputPath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  out.on("finish", () => console.log("Timelapse image saved:", outputPath));

  // Reset canvas
  await client.query("TRUNCATE TABLE pixels");
  console.log("Canvas reset completed.");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on port", PORT));

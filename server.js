const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
const { createCanvas } = require("canvas");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static("public"));

// PostgreSQL connection
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

client.connect().then(() => console.log("Connected to PostgreSQL"));

// Create tables
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
`);

// Load canvas
async function getCanvas() {
  const res = await client.query("SELECT x, y, color FROM pixels");
  return res.rows;
}

// Save pixel
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

    if (data.type === "draw") {
      const clientData = clients.get(ws);
      if (!clientData) return;

      if (clientData.points > 0 && clientData.cooldown === 0) {
        await setPixel(data.x, data.y, data.color);
        clientData.points--;
        clientData.cooldown = 20;

        wss.clients.forEach(c => {
          if (c.readyState === WebSocket.OPEN)
            c.send(JSON.stringify({ type: "pixel", x: data.x, y: data.y, color: data.color }));
        });

        ws.send(JSON.stringify({ type: "updatePoints", points: clientData.points, cooldown: clientData.cooldown }));
      }
    }
  });

  ws.on("close", () => clients.delete(ws));
});

// Cooldown interval
setInterval(() => {
  clients.forEach((c, ws) => {
    if (c.cooldown > 0) {
      c.cooldown--;
      if (c.cooldown === 0 && c.points < 10) c.points++;
      if (ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify({ type: "updatePoints", points: c.points, cooldown: c.cooldown }));
    }
  });
}, 1000);

// --- Monthly timelapse ---
const TIMELAPSE_DIR = "/data/timelapse"; // Railway volume mount
if (!fs.existsSync(TIMELAPSE_DIR)) fs.mkdirSync(TIMELAPSE_DIR, { recursive: true });

// Runs at 1 AM UTC on the first day of every month
cron.schedule("0 1 1 * *", async () => {
  console.log("Generating monthly timelapse...");

  const pixelsRes = await client.query("SELECT * FROM pixel_history ORDER BY timestamp ASC");
  const pixels = pixelsRes.rows;

  const canvas = createCanvas(1000, 1000);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  pixels.forEach(p => {
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 10, 10);
  });

  const outputFile = path.join(TIMELAPSE_DIR, `timelapse-${Date.now()}.png`);
  const outStream = fs.createWriteStream(outputFile);
  const stream = canvas.createPNGStream();
  stream.pipe(outStream);
  outStream.on("finish", () => console.log("Timelapse saved to Railway volume:", outputFile));

  // Reset canvas
  await client.query("TRUNCATE TABLE pixels");
  console.log("Canvas reset completed.");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on port", PORT));

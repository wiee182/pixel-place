const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const { Pool } = require("pg");
const path = require("path");

// Database connection
const pool = new Pool({
  user: process.env.PGUSER || "postgres",
  host: process.env.PGHOST || "localhost",
  database: process.env.PGDATABASE || "pixelcanvas",
  password: process.env.PGPASSWORD || "password",
  port: process.env.PGPORT || 5432,
});

// Ensure table exists
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pixels (
        x INT NOT NULL,
        y INT NOT NULL,
        color VARCHAR(10) NOT NULL,
        PRIMARY KEY (x, y)
      );
    `);
    console.log("✅ Table check complete");
  } catch (err) {
    console.error("❌ DB init error:", err.message);
  }
}
initDB();

// Express setup
const app = express();
const server = http.createServer(app);

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// WebSocket server
const wss = new WebSocket.Server({ server });

// Load all pixels
async function getPixels() {
  try {
    const res = await pool.query("SELECT x, y, color FROM pixels");
    return res.rows;
  } catch (err) {
    console.error("❌ DB getPixels error:", err.message);
    return [];
  }
}

// Save or update a pixel
async function savePixel(x, y, color) {
  try {
    await pool.query(
      "INSERT INTO pixels (x, y, color) VALUES ($1, $2, $3) ON CONFLICT (x, y) DO UPDATE SET color = $3",
      [x, y, color]
    );
  } catch (err) {
    console.error("❌ DB savePixel error:", err.message);
  }
}

// WebSocket events
wss.on("connection", async (ws) => {
  console.log("🔌 Client connected");

  // Send initial canvas state
  const pixels = await getPixels();
  ws.send(JSON.stringify({ type: "init", pixels }));

  ws.on("message", async (msg) => {
    try {
      const data = JSON.parse(msg);

      if (data.type === "draw") {
        // Save to DB
        await savePixel(data.x, data.y, data.color);

        // Broadcast to all clients
        const payload = JSON.stringify({
          type: "pixel",
          x: data.x,
          y: data.y,
          color: data.color,
        });
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
          }
        });
      }
    } catch (err) {
      console.error("❌ WS message error:", err.message);
    }
  });

  ws.on("close", () => console.log("❌ Client disconnected"));
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

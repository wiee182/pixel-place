const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Pool } = require("pg");
const path = require("path");

// Database
const pool = new Pool({
  user: "postgres",          // change if needed
  host: "localhost",
  database: "pixelcanvas",   // make sure this DB exists
  password: "password",      // change if needed
  port: 5432,
});

// Ensure users table exists
(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      points INT DEFAULT 10,
      cooldown_until TIMESTAMP NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pixels (
      x INT,
      y INT,
      color TEXT,
      PRIMARY KEY (x, y)
    );
  `);
})();

// Express setup
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

// Load pixels
async function getPixels() {
  const res = await pool.query("SELECT x, y, color FROM pixels");
  return res.rows;
}

// Save pixel
async function savePixel(x, y, color) {
  await pool.query(
    `INSERT INTO pixels (x, y, color)
     VALUES ($1, $2, $3)
     ON CONFLICT (x, y) DO UPDATE SET color = $3`,
    [x, y, color]
  );
}

// Reset points if cooldown expired
async function checkAndResetUser(userId) {
  const res = await pool.query(
    "SELECT points, cooldown_until FROM users WHERE id = $1",
    [userId]
  );

  if (res.rowCount === 0) return null;

  let { points, cooldown_until } = res.rows[0];
  const now = new Date();

  if (points <= 0 && cooldown_until && new Date(cooldown_until) <= now) {
    points = 10;
    cooldown_until = null;
    await pool.query(
      "UPDATE users SET points = $1, cooldown_until = $2 WHERE id = $3",
      [points, cooldown_until, userId]
    );
  }

  return { points, cooldown_until };
}

// Socket.io
io.on("connection", async (socket) => {
  const userId = socket.handshake.auth.userId;
  if (!userId) {
    console.log("⚠️ No userId provided, disconnecting...");
    socket.disconnect();
    return;
  }

  // Ensure user exists
  let res = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
  if (res.rowCount === 0) {
    await pool.query(
      "INSERT INTO users (id, points, cooldown_until) VALUES ($1, $2, $3)",
      [userId, 10, null]
    );
    res = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
  }

  // Sync cooldown/points
  const userState = await checkAndResetUser(userId);

  // Send canvas + user state
  const pixels = await getPixels();
  socket.emit("init", { pixels });
  socket.emit("init-points", userState);

  // Handle draw
  socket.on("draw", async ({ x, y, color }) => {
    let state = await checkAndResetUser(userId);

    if (!state) return;
    let { points, cooldown_until } = state;

    // Cooldown check
    if (cooldown_until && new Date(cooldown_until) > new Date()) {
      socket.emit("cooldown", { until: cooldown_until });
      return;
    }

    // Deduct points
    if (points > 0) {
      await savePixel(x, y, color);
      points--;

      if (points === 0) {
        cooldown_until = new Date(Date.now() + 20000); // 20s cooldown
        await pool.query(
          "UPDATE users SET points = $1, cooldown_until = $2 WHERE id = $3",
          [points, cooldown_until, userId]
        );
        socket.emit("cooldown", { until: cooldown_until });
      } else {
        await pool.query(
          "UPDATE users SET points = $1 WHERE id = $2",
          [points, userId]
        );
      }

      io.emit("pixel", { x, y, color });
      socket.emit("update-points", { points });
    }
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

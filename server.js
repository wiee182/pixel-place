const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Pool } = require("pg");
const path = require("path");
const fs = require("fs");

// Database
const pool = new Pool({
  user: "postgres",          // change if needed
  host: "localhost",
  database: "pixelcanvas",   // database name from db.sql
  password: "password",      // change if needed
  port: 5432,
});

// Express setup
const app = express();
const server = http.createServer(app);
const io = new Server(server);

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

// Socket.io
io.on("connection", async (socket) => {
  const pixels = await getPixels();
  socket.emit("init", { pixels });

  socket.on("draw", async ({ x, y, color }) => {
    await savePixel(x, y, color);
    io.emit("pixel", { x, y, color });
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

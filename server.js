const express = require("express");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // allow all origins for Railway
  },
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const usersFile = path.join(__dirname, "users.json");
let users = {};
if (fs.existsSync(usersFile)) {
  users = JSON.parse(fs.readFileSync(usersFile));
}

// === Register route ===
app.post("/register", (req, res) => {
  const { username } = req.body;
  if (!username || username.trim() === "")
    return res.json({ success: false, message: "Username cannot be empty" });

  const clean = username.trim();
  if (users[clean])
    return res.json({ success: false, message: "Username already exists" });

  users[clean] = { username: clean, points: 10 };
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  res.json({ success: true, message: "Registration successful" });
});

// === Login route ===
app.post("/login", (req, res) => {
  const { username } = req.body;
  if (!username || username.trim() === "")
    return res.json({ success: false, message: "Username cannot be empty" });

  const clean = username.trim();
  if (!users[clean])
    return res.json({ success: false, message: "Username not registered" });

  res.json({ success: true, username: clean });
});

// === Canvas pixel data ===
const pixels = {}; // { "x,y": color }

// === Socket.IO events ===
io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);
  socket.username = null;
  socket.lastPlace = 0;

  // --- Login handshake ---
  socket.on("login", (username) => {
    if (users[username]) {
      socket.username = username;
      socket.emit("login_success", { username, points: users[username].points });
      console.log(`✅ ${username} logged in`);
    } else {
      socket.emit("login_failed", "User not registered");
    }
  });

  socket.on("whoami", () => {
    if (socket.username && users[socket.username]) {
      socket.emit("login_success", {
        username: socket.username,
        points: users[socket.username].points,
      });
    }
  });

  // --- Send current pixel data ---
  socket.emit("init", pixels);

  // --- Handle new pixel placement ---
  socket.on("place_pixel", ({ x, y, color }) => {
    if (!socket.username) {
      socket.emit("place_failed", { reason: "not_logged_in" });
      return;
    }

    const now = Date.now();
    const diff = now - socket.lastPlace;
    const cooldown = 2000; // 2 seconds

    if (diff < cooldown) {
      const remaining = Math.ceil((cooldown - diff) / 1000);
      socket.emit("place_failed", { reason: "cooldown", wait: remaining });
      return;
    }

    pixels[`${x},${y}`] = color;
    socket.lastPlace = now;

    // broadcast to all clients
    io.emit("pixel", { x, y, color });

    // update player points
    if (users[socket.username]) {
      users[socket.username].points = Math.max(0, users[socket.username].points - 1);
      fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
      socket.emit("points_update", users[socket.username].points);
    }
  });

  socket.on("disconnect", () => {
    console.log("🔴 Disconnected:", socket.id);
  });
});

// === Start server ===
const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log(`✅ Server running at http://localhost:${PORT}`)
);

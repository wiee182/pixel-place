const express = require("express");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const usersFile = path.join(__dirname, "users.json");
let users = {};
if (fs.existsSync(usersFile)) {
  users = JSON.parse(fs.readFileSync(usersFile));
}

// Helper: save users
function saveUsers() {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

// === Register ===
app.post("/register", (req, res) => {
  const { username } = req.body;
  if (!username || username.trim() === "")
    return res.json({ success: false, message: "Username cannot be empty" });

  const clean = username.trim();
  if (users[clean])
    return res.json({ success: false, message: "Username already exists" });

  users[clean] = { username: clean, points: 10, cooldownEnd: 0 };
  saveUsers();
  res.json({ success: true, message: "Registration successful" });
});

// === Login ===
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

// === Socket.IO ===
io.on("connection", (socket) => {
  console.log("🟢", socket.id, "connected");
  socket.username = null;

  socket.on("login", (username) => {
    if (users[username]) {
      socket.username = username;
      const user = users[username];
      const now = Date.now();

      // Check cooldown
      if (user.cooldownEnd && user.cooldownEnd > now) {
        const remaining = Math.ceil((user.cooldownEnd - now) / 1000);
        socket.emit("cooldown_started", { wait: remaining });
        startCountdown(socket, user, remaining); // resume countdown
      }

      socket.emit("login_success", { username, points: user.points });
    } else {
      socket.emit("login_failed", "User not registered");
    }
  });

  socket.on("whoami", () => {
    if (socket.username && users[socket.username]) {
      const user = users[socket.username];
      socket.emit("login_success", { username: user.username, points: user.points });
    }
  });

  // Send current pixels
  socket.emit("init", pixels);

  // Handle draw
  socket.on("drawPixel", ({ x, y, color }) => {
    const user = users[socket.username];
    if (!socket.username || !user) {
      socket.emit("place_failed", { reason: "not_logged_in" });
      return;
    }

    const now = Date.now();
    if (user.cooldownEnd && user.cooldownEnd > now) {
      const remaining = Math.ceil((user.cooldownEnd - now) / 1000);
      socket.emit("place_failed", { reason: "cooldown", wait: remaining });
      return;
    }

    if (user.points <= 0) {
      startCooldown(socket, user);
      return;
    }

    // Place pixel
    pixels[`${x},${y}`] = color;
    io.emit("updatePixel", { x, y, color });

    // Deduct a point
    user.points -= 1;
    saveUsers();
    socket.emit("points_update", user.points);

    if (user.points <= 0) startCooldown(socket, user);
  });

  socket.on("disconnect", () => {
    console.log("🔴", socket.id, "disconnected");
  });
});

// === Cooldown Logic ===
function startCooldown(socket, user) {
  const duration = 20 * 1000;
  const now = Date.now();

  user.cooldownEnd = now + duration;
  saveUsers();

  const wait = duration / 1000;
  socket.emit("cooldown_started", { wait });
  startCountdown(socket, user, wait);

  setTimeout(() => {
    user.points = 10;
    user.cooldownEnd = 0;
    saveUsers();
    socket.emit("points_update", user.points);
    socket.emit("login_success", { username: user.username, points: user.points });
  }, duration);
}

function startCountdown(socket, user, secondsLeft) {
  let remaining = secondsLeft;
  const interval = setInterval(() => {
    const now = Date.now();
    if (!user.cooldownEnd || user.cooldownEnd <= now) {
      clearInterval(interval);
      return;
    }
    remaining = Math.ceil((user.cooldownEnd - now) / 1000);
    socket.emit("cooldown_tick", { remaining });
  }, 1000);
}

// === Start Server ===
const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
);

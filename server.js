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

let pixels = {}; // { "x,y": color }
let onlineUsers = new Set(); // track currently active usernames

// === Helper: save users ===
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

// === Socket.IO ===
io.on("connection", (socket) => {
  console.log("🟢", socket.id, "connected");
  socket.username = null;

  // Send current canvas on connect
  socket.emit("init", pixels);

  // === User login ===
  socket.on("login", (username) => {
    if (users[username]) {
      socket.username = username;
      const user = users[username];
      const now = Date.now();

      onlineUsers.add(username);
      io.emit("active_users", onlineUsers.size); // ✅ broadcast active user count

      // Resume cooldown if needed
      if (user.cooldownEnd && user.cooldownEnd > now) {
        const remaining = Math.ceil((user.cooldownEnd - now) / 1000);
        socket.emit("cooldown_started", { wait: remaining });
        startCountdown(socket, user, remaining);
      }

      socket.emit("login_success", { username, points: user.points });
    } else {
      socket.emit("login_failed", "User not registered");
    }
  });

  // === Identify ===
  socket.on("whoami", () => {
    if (socket.username && users[socket.username]) {
      const user = users[socket.username];
      socket.emit("login_success", { username: user.username, points: user.points });
    }
  });

  // === Handle drawing ===
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

    // Place pixel and broadcast to everyone
    pixels[`${x},${y}`] = color;
    io.emit("updatePixel", { x, y, color });

    // Deduct one point
    user.points -= 1;
    saveUsers();
    socket.emit("points_update", user.points);

    // If ran out of points, start cooldown
    if (user.points <= 0) startCooldown(socket, user);
  });

  // === Handle disconnect ===
  socket.on("disconnect", () => {
    if (socket.username) {
      onlineUsers.delete(socket.username);
      io.emit("active_users", onlineUsers.size); // ✅ broadcast active user count update
      console.log(`🔴 ${socket.username} disconnected`);
    } else {
      console.log("🔴 Unknown user disconnected");
    }
  });
});

// === Cooldown system ===
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

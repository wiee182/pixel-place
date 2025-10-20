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
  try {
    users = JSON.parse(fs.readFileSync(usersFile));
  } catch (err) {
    console.error("Failed to parse users.json:", err);
    users = {};
  }
}

let pixels = {}; // { "x,y": color }

// Track active logged-in users robustly:
// map username -> number of connected sockets for that username
const userSocketCount = new Map();

function saveUsers() {
  try {
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  } catch (err) {
    console.error("Failed to write users.json:", err);
  }
}

function emitActiveUsers() {
  const activeCount = userSocketCount.size;
  io.emit("active_users", activeCount);
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

// === Socket.IO ===
io.on("connection", (socket) => {
  console.log("🟢", socket.id, "connected");
  socket.username = null;

  // Send current canvas
  socket.emit("init", pixels);

  // Send current active users count (unique logged-in users)
  socket.emit("active_users", userSocketCount.size);

  // --- Login ---
  socket.on("login", (username) => {
    if (!username || !users[username]) {
      socket.emit("login_failed", "User not registered");
      return;
    }

    // if socket already associated with this username, ignore
    if (socket.username === username) {
      // still emit success to sync client state
      const user = users[username];
      socket.emit("login_success", { username, points: user.points });
      return;
    }

    // If socket was previously logged in as someone else, decrement that previous mapping
    if (socket.username) {
      const prev = socket.username;
      if (userSocketCount.has(prev)) {
        const c = userSocketCount.get(prev) - 1;
        if (c <= 0) userSocketCount.delete(prev);
        else userSocketCount.set(prev, c);
      }
    }

    socket.username = username;

    // increment count for this username
    const prevCount = userSocketCount.get(username) || 0;
    userSocketCount.set(username, prevCount + 1);

    // broadcast updated active user count (unique usernames)
    emitActiveUsers();

    const user = users[username];
    const now = Date.now();
    // Resume cooldown if needed
    if (user.cooldownEnd && user.cooldownEnd > now) {
      const remaining = Math.ceil((user.cooldownEnd - now) / 1000);
      socket.emit("cooldown_started", { wait: remaining });
      startCountdown(socket, user, remaining);
    }

    socket.emit("login_success", { username, points: user.points });
    console.log(`✅ ${username} logged in (socket: ${socket.id})`);
  });

  // --- whoami ---
  socket.on("whoami", () => {
    if (socket.username && users[socket.username]) {
      const user = users[socket.username];
      socket.emit("login_success", { username: user.username, points: user.points });
    } else {
      socket.emit("login_failed", "Not logged in");
    }
  });

  // --- Drawing ---
  socket.on("drawPixel", ({ x, y, color }) => {
    const username = socket.username;
    const user = username ? users[username] : null;
    if (!username || !user) {
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

    // Place pixel & broadcast
    pixels[`${x},${y}`] = color;
    io.emit("updatePixel", { x, y, color });

    // Deduct point
    user.points -= 1;
    saveUsers();
    socket.emit("points_update", user.points);

    if (user.points <= 0) startCooldown(socket, user);
  });

  // --- Disconnect ---
  socket.on("disconnect", () => {
    if (socket.username) {
      const name = socket.username;
      // decrement the per-user socket count
      if (userSocketCount.has(name)) {
        const c = userSocketCount.get(name) - 1;
        if (c <= 0) userSocketCount.delete(name);
        else userSocketCount.set(name, c);
      }
      // broadcast active count
      emitActiveUsers();
      console.log(`🔴 ${name} disconnected (socket: ${socket.id})`);
    } else {
      console.log("🔴 Unknown socket disconnected:", socket.id);
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

// === Start server ===
const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log(`✅ Server berjalan on http://localhost:${PORT}`)
);

const express = require("express");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // allow all origins (for Railway or local)
  },
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// === Load users ===
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

// === Socket.IO ===
io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);
  socket.username = null;
  socket.cooldownActive = false;

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

  // --- Send current user info ---
  socket.on("whoami", () => {
    if (socket.username && users[socket.username]) {
      socket.emit("login_success", {
        username: socket.username,
        points: users[socket.username].points,
      });
    }
  });

  // --- Send current canvas data ---
  socket.emit("init", pixels);

  // --- Place pixel ---
  socket.on("drawPixel", ({ x, y, color }) => {
    const user = users[socket.username];
    if (!socket.username || !user) {
      socket.emit("place_failed", { reason: "not_logged_in" });
      return;
    }

    // Check cooldown
    if (socket.cooldownActive) {
      socket.emit("place_failed", { reason: "cooldown", wait: socket.cooldownRemaining || 20 });
      return;
    }

    // Check available points
    if (user.points <= 0) {
      startCooldown(socket, user);
      return;
    }

    // Draw pixel
    pixels[`${x},${y}`] = color;
    io.emit("updatePixel", { x, y, color });

    // Decrease user points
    user.points -= 1;
    socket.emit("points_update", user.points);
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));

    // If points reach zero → start cooldown
    if (user.points <= 0) {
      startCooldown(socket, user);
    }
  });

  socket.on("disconnect", () => {
    console.log("🔴 Disconnected:", socket.id);
  });
});

// === Helper: Cooldown system ===
function startCooldown(socket, user) {
  if (socket.cooldownActive) return;

  socket.cooldownActive = true;
  socket.cooldownRemaining = 20;
  socket.emit("cooldown_started", { wait: socket.cooldownRemaining });

  const countdown = setInterval(() => {
    socket.cooldownRemaining -= 1;

    if (socket.cooldownRemaining <= 0) {
      clearInterval(countdown);
      socket.cooldownActive = false;
      user.points = 10; // Reset points after cooldown
      fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
      socket.emit("points_update", user.points);
      socket.emit("login_success", { username: user.username, points: user.points });
    }
  }, 1000);
}

// === Start server ===
const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log(`✅ Server running at http://localhost:${PORT}`)
);

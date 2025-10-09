// server.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const usersFile = path.join(__dirname, "users.json");
let users = {};
if (fs.existsSync(usersFile)) {
  users = JSON.parse(fs.readFileSync(usersFile));
}

// --- Register route ---
app.post("/register", (req, res) => {
  const { username } = req.body;
  if (!username || username.trim() === "") {
    return res.json({ success: false, message: "Username cannot be empty" });
  }
  const cleanUsername = username.trim();

  if (users[cleanUsername]) {
    return res.json({ success: false, message: "Username already exists" });
  }

  users[cleanUsername] = { username: cleanUsername };
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  res.json({ success: true, message: "Registration successful" });
});

// --- Login route ---
app.post("/login", (req, res) => {
  const { username } = req.body;
  if (!username || username.trim() === "") {
    return res.json({ success: false, message: "Username cannot be empty" });
  }
  const cleanUsername = username.trim();

  if (!users[cleanUsername]) {
    return res.json({ success: false, message: "Username not registered" });
  }

  res.json({ success: true, username: cleanUsername });
});

// --- Multiplayer canvas ---
const pixels = new Map();
const MAX_POINTS = 10;
const COOLDOWN_TIME = 20; // seconds

// Track user points and cooldown
const userData = {}; // { socketId: { username, points, cooldownUntil } }

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Send full canvas
  socket.emit("initCanvas", Object.fromEntries(pixels));

  // Handle login via socket
  socket.on("login", (username) => {
    if (users[username]) {
      userData[socket.id] = {
        username,
        points: MAX_POINTS,
        cooldownUntil: 0,
      };
      socket.emit("login_success", {
        username,
        points: MAX_POINTS,
      });
      console.log(`${username} logged in on socket ${socket.id}`);
    } else {
      socket.emit("login_failed", "Username not registered");
    }
  });

  // Handle drawing
  socket.on("drawPixel", ({ x, y, color }) => {
    const user = userData[socket.id];
    if (!user) {
      return socket.emit("place_failed", { reason: "not_logged_in" });
    }

    const now = Date.now();
    if (user.cooldownUntil > now) {
      return socket.emit("place_failed", { reason: "cooldown", wait: Math.ceil((user.cooldownUntil - now)/1000) });
    }

    if (user.points <= 0) {
      user.cooldownUntil = now + COOLDOWN_TIME * 1000;
      socket.emit("place_failed", { reason: "cooldown", wait: COOLDOWN_TIME });
      return;
    }

    // Store pixel
    pixels.set(`${x},${y}`, color);

    // Broadcast to everyone
    io.emit("updatePixel", { x, y, color });

    // Subtract points
    user.points--;
    socket.emit("points_update", { points: user.points });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    delete userData[socket.id];
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server running on port ${PORT}`));

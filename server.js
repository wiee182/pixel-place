// server.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const USERS_FILE = path.join(__dirname, "users.json");
let users = {};
if (fs.existsSync(USERS_FILE)) {
  users = JSON.parse(fs.readFileSync(USERS_FILE));
}

// --- Registration ---
app.post("/register", (req, res) => {
  const { username } = req.body;
  if (!username || username.trim() === "") {
    return res.json({ success: false, message: "Username cannot be empty" });
  }
  const cleanUsername = username.trim();
  if (users[cleanUsername]) {
    return res.json({ success: false, message: "Username already exists" });
  }

  users[cleanUsername] = { username: cleanUsername, points: 10, cooldownUntil: 0 };
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  res.json({ success: true, message: "Registration successful" });
});

// --- Login ---
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
const COOLDOWN = 20; // seconds
const POINTS_PER_COOLDOWN = 10;

io.on("connection", socket => {
  console.log("User connected:", socket.id);

  // Send full canvas to new client
  socket.emit("init", Object.fromEntries(pixels));

  let currentUser = null;

  // Login via socket
  socket.on("login", (username) => {
    if (!username || !users[username]) {
      socket.emit("login_failed", "User not registered");
      return;
    }
    currentUser = username;
    const userData = users[username];
    socket.emit("login_success", { username, points: userData.points });
  });

  // Whoami for client refresh
  socket.on("whoami", () => {
    if (!currentUser) return;
    const userData = users[currentUser];
    socket.emit("points_update", { points: userData.points });
  });

  // Draw pixel
  socket.on("drawPixel", ({ x, y, color }) => {
    if (!currentUser) {
      socket.emit("place_failed", { reason: "not_logged_in" });
      return;
    }

    const userData = users[currentUser];
    const now = Date.now();

    // Check cooldown
    if (userData.cooldownUntil && now < userData.cooldownUntil) {
      const wait = Math.ceil((userData.cooldownUntil - now) / 1000);
      socket.emit("place_failed", { reason: "cooldown", wait });
      return;
    }

    // Place pixel
    pixels.set(`${x},${y}`, color);
    io.emit("updatePixel", { x, y, color });

    // Subtract points
    userData.points--;
    if (userData.points <= 0) {
      userData.points = 0;
      userData.cooldownUntil = now + COOLDOWN * 1000;
      socket.emit("cooldown_started", { wait: COOLDOWN });
    }

    // Save users to file
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

    // Update client points
    socket.emit("points_update", { points: userData.points });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const express = require("express");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

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

// === Canvas Data ===
const pixels = {}; // { "x,y": "#hexcolor" }

// === Socket.io ===
io.on("connection", (socket) => {
  console.log("🟢 Connected:", socket.id);

  socket.username = null;
  socket.lastPlace = 0;

  // --- Login from client ---
  socket.on("login", (username) => {
    if (users[username]) {
      socket.username = username;
      console.log(`✅ ${username} logged in`);
      socket.emit("login_success", { username, points: users[username].points });
    } else {
      socket.emit("login_failed", "User not registered");
    }
  });

  // --- Send all pixels to new user ---
  socket.emit("init", pixels);

  // --- Handle pixel placement ---
  socket.on("place_pixel", ({ x, y, color }) => {
    if (!socket.username) {
      return socket.emit("place_failed", { reason: "not_logged_in" });
    }

    const now = Date.now();
    const diff = now - socket.lastPlace;
    const wait = 2000; // 2 sec cooldown

    if (diff < wait) {
      const remaining = Math.ceil((wait - diff) / 1000);
      socket.emit("place_failed", { reason: "cooldown", wait: remaining });
      return;
    }

    pixels[`${x},${y}`] = color;
    socket.lastPlace = now;

    // Broadcast to all users
    io.emit("pixel", { x, y, color });
  });

  socket.on("disconnect", () => {
    console.log("🔴 Disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
);

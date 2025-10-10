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

// === Canvas Storage ===
const pixels = {}; // store as { "x,y": color }

// === Socket.io ===
io.on("connection", (socket) => {
  console.log("New user:", socket.id);

  socket.username = null;
  socket.lastPlace = 0;

  // Login check from socket-client.js
  socket.on("login", (username) => {
    if (users[username]) {
      socket.username = username;
      socket.emit("login_success", { username, points: users[username].points });
    } else {
      socket.emit("login_failed", "User not registered");
    }
  });

  // Send all pixels to client
  socket.emit("init", pixels);

  // Client requests their info
  socket.on("whoami", () => {
    if (socket.username && users[socket.username]) {
      socket.emit("login_success", {
        username: socket.username,
        points: users[socket.username].points,
      });
    }
  });

  // Handle placing pixels
  socket.on("place_pixel", ({ x, y, color }) => {
    if (!socket.username) {
      return socket.emit("place_failed", { reason: "not_logged_in" });
    }

    const now = Date.now();
    const diff = now - socket.lastPlace;
    const wait = 2000; // 2 seconds cooldown

    if (diff < wait) {
      const remaining = Math.ceil((wait - diff) / 1000);
      socket.emit("place_failed", { reason: "cooldown", wait: remaining });
      return;
    }

    pixels[`${x},${y}`] = color;
    socket.lastPlace = now;
    io.emit("pixel", { x, y, color });
    socket.emit("points_update", users[socket.username].points);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));

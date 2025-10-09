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

io.on("connection", socket => {
  console.log("User connected:", socket.id);

  // Send existing pixels to new user
  socket.emit("init", Array.from(pixels));

  socket.on("draw", ({ x, y, color }) => {
    pixels.set(`${x},${y}`, color);
    io.emit("draw", { x, y, color });
  });

  socket.on("disconnect", () => console.log("User disconnected:", socket.id));
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server running on port ${PORT}`));

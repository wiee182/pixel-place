const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();
const server = require("http").createServer(app);
const io = require("socket.io")(server);
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(express.json());
app.use(express.static("public"));

// --- Users storage ---
const usersFile = path.join(__dirname, "users.json");
let users = {};
if (fs.existsSync(usersFile)) {
  users = JSON.parse(fs.readFileSync(usersFile));
}

// --- Canvas storage (shared pixels) ---
let pixels = {}; // key: "x,y", value: color

// --- Login route ---
app.post("/login", (req, res) => {
  const { username } = req.body;
  if (!username || username.trim() === "") {
    return res.json({ success: false, message: "Username cannot be empty" });
  }
  const cleanUsername = username.trim();
  if (!users[cleanUsername]) {
    users[cleanUsername] = { username: cleanUsername };
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  }
  res.json({ success: true, username: cleanUsername });
});

// --- Serve main page ---
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// --- Socket.IO connection ---
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Send current canvas pixels to the new client
  socket.emit("initCanvas", pixels);

  // Listen for new pixel drawing
  socket.on("drawPixel", ({ x, y, color }) => {
    const key = `${x},${y}`;
    pixels[key] = color;

    // Broadcast this pixel to all other clients
    socket.broadcast.emit("updatePixel", { x, y, color });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// --- Start server ---
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

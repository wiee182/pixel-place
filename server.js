// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ✅ Serve files from the "public" folder
app.use(express.static("public"));

// ✅ Handle WebSocket connections
io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("placePixel", (data) => {
    // Broadcast to all users except sender
    socket.broadcast.emit("placePixel", data);
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });
});

// ✅ Railway or local port
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

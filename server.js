const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve frontend from "public" folder
app.use(express.static("public"));

// WebSocket logic
io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("placePixel", (data) => {
    io.emit("placePixel", data); // send to everyone (including sender)
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });
});

// Railway or local port
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// serve static files (frontend)
app.use(express.static("public"));

// socket events
io.on("connection", (socket) => {
  console.log("a user connected");

  socket.on("placePixel", (data) => {
    io.emit("placePixel", data); // broadcast to all clients
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});

// Railway provides PORT in env
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

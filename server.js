const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let pixels = {}; // store pixels { "x,y": "#color" }

app.use(express.static("public"));

io.on("connection", (socket) => {
  console.log("a user connected");

  socket.emit("init", pixels);

  socket.on("placePixel", (data) => {
    pixels[`${data.x},${data.y}`] = data.color;
    io.emit("pixelPlaced", data);
  });
});

server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});

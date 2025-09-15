const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const socket = io(); // connects automatically to same domain

// Draw a pixel
function drawPixel(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 10, 10); // each pixel = 10x10
}

// Click to place pixel
canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / 10) * 10;
  const y = Math.floor((e.clientY - rect.top) / 10) * 10;

  const color = "#" + Math.floor(Math.random()*16777215).toString(16); // random color
  drawPixel(x, y, color);

  // Send to server
  socket.emit("placePixel", { x, y, color });
});

// Listen for others' pixels
socket.on("placePixel", (data) => {
  drawPixel(data.x, data.y, data.color);
});

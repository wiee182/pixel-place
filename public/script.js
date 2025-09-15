const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const socket = io(); // connects to same domain

// Draw pixel function
function drawPixel(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 10, 10); // 10x10 pixel block
}

// When user clicks on canvas
canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / 10) * 10;
  const y = Math.floor((e.clientY - rect.top) / 10) * 10;

  const color = "#" + Math.floor(Math.random() * 16777215).toString(16);
  drawPixel(x, y, color);

  socket.emit("placePixel", { x, y, color });
});

// Listen for other users' pixels
socket.on("placePixel", (data) => {
  drawPixel(data.x, data.y, data.color);
});

const socket = io();
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const colorPicker = document.getElementById("colorPicker");
const pixelSize = 10;

function drawPixel(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
}

canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / pixelSize);
  const y = Math.floor((e.clientY - rect.top) / pixelSize);
  const color = colorPicker.value;

  drawPixel(x, y, color);
  socket.emit("placePixel", { x, y, color });
});

socket.on("init", (pixels) => {
  for (const key in pixels) {
    const [x, y] = key.split(",");
    drawPixel(parseInt(x), parseInt(y), pixels[key]);
  }
});

socket.on("pixelPlaced", (data) => {
  drawPixel(data.x, data.y, data.color);
});

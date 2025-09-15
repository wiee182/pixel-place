const socket = io();
const canvas = document.getElementById("pixelCanvas");
const ctx = canvas.getContext("2d");

let currentColor = "#000000";

// Example palette colors
const colors = [
  "#FFFFFF", "#C0C0C0", "#808080", "#000000",
  "#FF0000", "#800000", "#FFFF00", "#808000",
  "#00FF00", "#008000", "#00FFFF", "#008080",
  "#0000FF", "#000080", "#FF00FF", "#800080"
];

// Generate palette
const paletteDiv = document.getElementById("palette");
colors.forEach((color, index) => {
  const swatch = document.createElement("div");
  swatch.classList.add("color-swatch");
  swatch.style.background = color;
  if (index === 0) swatch.classList.add("selected");
  swatch.addEventListener("click", () => {
    document.querySelectorAll(".color-swatch").forEach(el => el.classList.remove("selected"));
    swatch.classList.add("selected");
    currentColor = color;
  });
  paletteDiv.appendChild(swatch);
});

// Draw pixel on click
canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / 10);
  const y = Math.floor((e.clientY - rect.top) / 10);

  ctx.fillStyle = currentColor;
  ctx.fillRect(x * 10, y * 10, 10, 10);

  // Send to server
  socket.emit("placePixel", { x, y, color: currentColor });
});

// Receive pixels from server
socket.on("placePixel", ({ x, y, color }) => {
  ctx.fillStyle = color;
  ctx.fillRect(x * 10, y * 10, 10, 10);
});

// ====== Canvas Setup ======
const canvas = document.getElementById("pixelCanvas");
const ctx = canvas.getContext("2d");

let scale = 1;
let offsetX = 0, offsetY = 0;
let isDragging = false;
let startX, startY;

let currentColor = "#ff0000";
const gridSize = 10;

// Store all placed pixels to prevent disappearing
const pixels = [];

// Resize canvas to fill container
function resizeCanvas() {
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;
  drawGrid();
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// Draw grid and pixels
function drawGrid() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // Draw background
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, canvas.width / scale, canvas.height / scale);

  // Draw pixels
  pixels.forEach(p => {
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, gridSize, gridSize);
  });

  // Draw grid
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 1 / scale;
  for (let x = 0; x < canvas.width / scale; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height / scale);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height / scale; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width / scale, y);
    ctx.stroke();
  }

  ctx.restore();
}

// ====== Zoom (centered on mouse) ======
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;

  // Get mouse position relative to canvas
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  // Adjust offset so zoom centers on mouse
  offsetX = mx - ((mx - offsetX) * zoomFactor);
  offsetY = my - ((my - offsetY) * zoomFactor);

  scale *= zoomFactor;
  drawGrid();
});

// ====== Pan ======
canvas.addEventListener("mousedown", (e) => {
  isDragging = true;
  startX = e.clientX - offsetX;
  startY = e.clientY - offsetY;
});
canvas.addEventListener("mousemove", (e) => {
  if (isDragging) {
    offsetX = e.clientX - startX;
    offsetY = e.clientY - startY;
    drawGrid();
  }
});
canvas.addEventListener("mouseup", () => { isDragging = false; });
canvas.addEventListener("mouseleave", () => { isDragging = false; });

// ====== Place Pixel ======
canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left - offsetX) / (gridSize * scale)) * gridSize;
  const y = Math.floor((e.clientY - rect.top - offsetY) / (gridSize * scale)) * gridSize;

  pixels.push({ x, y, color: currentColor });
  drawGrid();
});

// ====== Palette ======
const palette = document.getElementById("palette");
const colors = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff", "#000000", "#ffffff"];
colors.forEach(c => {
  const swatch = document.createElement("div");
  swatch.className = "color-swatch";
  swatch.style.background = c;
  swatch.dataset.color = c;
  swatch.addEventListener("click", () => {
    document.querySelectorAll(".color-swatch").forEach(s => s.classList.remove("selected"));
    swatch.classList.add("selected");
    currentColor = c;
  });
  palette.appendChild(swatch);
});
document.querySelector(".color-swatch").classList.add("selected");

// ====== Chat Feed ======
const feed = document.getElementById("chat-feed");
const input = document.getElementById("chat-message");
const sendBtn = document.getElementById("send-message");

sendBtn.addEventListener("click", () => {
  if (input.value.trim() !== "") {
    const msg = document.createElement("div");
    msg.className = "chat-msg";
    msg.textContent = input.value;
    feed.insertBefore(msg, feed.querySelector(".chat-input"));
    input.value = "";
    feed.scrollTop = feed.scrollHeight;
  }
});

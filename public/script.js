// ====== Canvas Setup ======
const canvas = document.getElementById("pixelCanvas");
const ctx = canvas.getContext("2d");

let scale = 1, targetScale = 1;
let offsetX = 0, offsetY = 0;
let targetOffsetX = 0, targetOffsetY = 0;
let isDragging = false;
let startX, startY;
let velocityX = 0, velocityY = 0;

const gridSize = 10;
const pixels = [];
let currentColor = "#ff0000";

// ====== Resize Canvas ======
function resizeCanvas() {
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// ====== Draw Grid and Pixels ======
function drawGrid() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, canvas.width / scale, canvas.height / scale);

  // Draw pixels
  pixels.forEach(p => {
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, gridSize, gridSize);
  });

  // Grid
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

// ====== Animate Smooth Zoom, Pan, Inertia ======
function animate() {
  // Smooth scale
  scale += (targetScale - scale) * 0.15;

  // Smooth offset
  offsetX += (targetOffsetX - offsetX) * 0.15 + velocityX;
  offsetY += (targetOffsetY - offsetY) * 0.15 + velocityY;

  // Dampen velocity for inertia
  velocityX *= 0.9;
  velocityY *= 0.9;

  drawGrid();
  requestAnimationFrame(animate);
}
animate();

// ====== Zoom (Centered on Mouse) ======
canvas.addEventListener("wheel", e => {
  e.preventDefault();
  const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;

  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  targetOffsetX = mx - ((mx - targetOffsetX) * zoomFactor);
  targetOffsetY = my - ((my - targetOffsetY) * zoomFactor);

  targetScale *= zoomFactor;
  targetScale = Math.max(0.5, Math.min(10, targetScale));
});

// ====== Pan with Drag & Inertia ======
canvas.addEventListener("mousedown", e => {
  isDragging = true;
  startX = e.clientX - targetOffsetX;
  startY = e.clientY - targetOffsetY;
  velocityX = velocityY = 0;
});
canvas.addEventListener("mousemove", e => {
  if (isDragging) {
    const newX = e.clientX - startX;
    const newY = e.clientY - startY;

    velocityX = newX - targetOffsetX;
    velocityY = newY - targetOffsetY;

    targetOffsetX = newX;
    targetOffsetY = newY;
  }
});
canvas.addEventListener("mouseup", () => isDragging = false);
canvas.addEventListener("mouseleave", () => isDragging = false);

// ====== Place Pixel ======
canvas.addEventListener("click", e => {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left - offsetX) / (gridSize * scale)) * gridSize;
  const y = Math.floor((e.clientY - rect.top - offsetY) / (gridSize * scale)) * gridSize;

  pixels.push({ x, y, color: currentColor });
  drawGrid();
});

// ====== Color Palette ======
const palette = document.getElementById("palette");
const colors = ["#ff0000","#00ff00","#0000ff","#ffff00","#ff00ff","#00ffff","#000000","#ffffff"];
colors.forEach(c => {
  const swatch = document.createElement("div");
  swatch.className = "color-swatch";
  swatch.style.background = c;
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

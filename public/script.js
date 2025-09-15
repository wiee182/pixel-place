// ====== script.js (fixed) ======

// ====== Config / World bounds ======
const canvas = document.getElementById("pixelCanvas");
const ctx = canvas.getContext("2d");

const WORLD_WIDTH = 2000;   // world / grid pixel width (keeps drawing inside this)
const WORLD_HEIGHT = 2000;  // world / grid pixel height
const gridSize = 10;

let currentColor = "#ff0000";

// Smooth transform + inertia
let scale = 1, targetScale = 1;
let offsetX = 0, offsetY = 0;
let targetOffsetX = 0, targetOffsetY = 0;
let velocityX = 0, velocityY = 0;

// Interaction state
let isDragging = false;
let panStartX = 0, panStartY = 0;
let downX = 0, downY = 0;
let dragMoved = false;

// Pixel storage (world coordinates, snapped to grid)
const pixels = [];

// ====== Resize canvas to fill its container ======
function resizeCanvas() {
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// ====== Drawing ======
function drawGrid() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // Background over the full world (so everything outside the world is visually different)
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // Draw placed pixels (only those inside world)
  for (let i = 0; i < pixels.length; i++) {
    const p = pixels[i];
    if (p.x >= 0 && p.x < WORLD_WIDTH && p.y >= 0 && p.y < WORLD_HEIGHT) {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, gridSize, gridSize);
    }
  }

  // Grid lines (draw across full world)
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 1 / scale;
  for (let x = 0; x <= WORLD_WIDTH; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, WORLD_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= WORLD_HEIGHT; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD_WIDTH, y);
    ctx.stroke();
  }

  ctx.restore();
}

// ====== Animation loop (smooth transform + inertia) ======
function animate() {
  // smooth scale
  scale += (targetScale - scale) * 0.15;

  // smooth offsets + apply inertia velocity
  offsetX += (targetOffsetX - offsetX) * 0.15 + velocityX;
  offsetY += (targetOffsetY - offsetY) * 0.15 + velocityY;

  // damping velocity
  velocityX *= 0.88;
  velocityY *= 0.88;

  drawGrid();
  requestAnimationFrame(animate);
}
animate();

// ====== Helpers ======
function worldFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  // Use the current (rendered) transform (offsetX/offsetY and scale) to map screen->world
  const screenX = e.clientX - rect.left;
  const screenY = e.clientY - rect.top;
  const worldX = (screenX - offsetX) / scale;
  const worldY = (screenY - offsetY) / scale;
  return { worldX, worldY };
}

function snapToGrid(val) {
  return Math.floor(val / gridSize) * gridSize;
}

// ====== Zoom (centered on mouse) ======
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;

  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  // adjust target offsets so zoom is centered around mouse
  targetOffsetX = mx - ((mx - targetOffsetX) * zoomFactor);
  targetOffsetY = my - ((my - targetOffsetY) * zoomFactor);

  targetScale *= zoomFactor;
  targetScale = Math.max(0.5, Math.min(10, targetScale));
});

// ====== Pan with drag + inertia ======
canvas.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return; // left only
  isDragging = true;

  // For panning math: store pan start relative to target offset
  panStartX = e.clientX - targetOffsetX;
  panStartY = e.clientY - targetOffsetY;

  // For drag detection (prevent drawing while panning)
  downX = e.clientX;
  downY = e.clientY;
  dragMoved = false;

  // reset velocity while actively dragging
  velocityX = 0;
  velocityY = 0;
});

canvas.addEventListener("mousemove", (e) => {
  if (!isDragging) return;

  // detect if user moved more than a threshold (so clicks won't create pixels)
  if (!dragMoved) {
    const dx = e.clientX - downX;
    const dy = e.clientY - downY;
    if (Math.hypot(dx, dy) > 4) dragMoved = true;
  }

  const newX = e.clientX - panStartX;
  const newY = e.clientY - panStartY;

  // estimate velocity (used for inertia once user releases)
  velocityX = newX - targetOffsetX;
  velocityY = newY - targetOffsetY;

  targetOffsetX = newX;
  targetOffsetY = newY;
});

function endPan() {
  isDragging = false;
}
canvas.addEventListener("mouseup", endPan);
canvas.addEventListener("mouseleave", endPan);

// ====== Place pixel (only when not dragging) ======
canvas.addEventListener("click", (e) => {
  // If the user actually dragged, don't place a pixel
  if (dragMoved) return;

  // Map screen -> world using the *current* transform (offsetX/offsetY & scale used for rendering)
  const { worldX, worldY } = worldFromEvent(e);

  let x = snapToGrid(worldX);
  let y = snapToGrid(worldY);

  // clamp into world bounds
  x = Math.max(0, Math.min(WORLD_WIDTH - gridSize, x));
  y = Math.max(0, Math.min(WORLD_HEIGHT - gridSize, y));

  // update existing pixel in same cell or add new
  const idx = pixels.findIndex(p => p.x === x && p.y === y);
  if (idx >= 0) {
    pixels[idx].color = currentColor;
  } else {
    pixels.push({ x, y, color: currentColor });
  }

  // redraw immediate
  drawGrid();
});

// ====== Color Palette ======
const palette = document.getElementById("palette");
const colors = ["#ff0000","#00ff00","#0000ff","#ffff00","#ff00ff","#00ffff","#000000","#ffffff"];
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

// ====== Chat Feed (unchanged) ======
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

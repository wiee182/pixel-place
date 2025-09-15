// ====== script.js (Collaborative Pixel Canvas with fixed zoom) ======
const canvas = document.getElementById("pixelCanvas");
const ctx = canvas.getContext("2d");

// ====== Config ======
const WORLD_WIDTH = 10000;
const WORLD_HEIGHT = 10000;
const gridSize = 10;
let currentColor = "#fffefe";
let showGrid = true;

// Transform & inertia
let scale = 1, targetScale = 1;
let offsetX = 0, offsetY = 0;
let targetOffsetX = 0, targetOffsetY = 0;
let velocityX = 0, velocityY = 0;

// Interaction
let isDragging = false;
let panStartX = 0, panStartY = 0;
let downX = 0, downY = 0;
let dragMoved = false;

// Store all pixels
const pixels = [];

// ====== WebSocket Setup ======
const ws = new WebSocket('ws://localhost:3000');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'init') {
    pixels.push(...data.pixels);
    drawGrid();
  }
  if (data.type === 'draw') {
    pixels.push(data.pixel);
    drawGrid();
  }
};

// ====== Resize Canvas ======
function resizeCanvas() {
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;
  recalcOffsetLimits();
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// ====== Draw Grid & Pixels ======
function drawGrid() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  const viewLeft = -offsetX / scale;
  const viewTop = -offsetY / scale;
  const viewRight = viewLeft + canvas.width / scale;
  const viewBottom = viewTop + canvas.height / scale;

  // Draw pixels
  pixels.forEach(p => {
    if (p.x + gridSize >= viewLeft && p.x <= viewRight &&
        p.y + gridSize >= viewTop && p.y <= viewBottom) {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, gridSize, gridSize);
    }
  });

  // Draw grid
  if (showGrid) {
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 1 / scale;
    const startX = Math.floor(viewLeft / gridSize) * gridSize;
    const endX = Math.ceil(viewRight / gridSize) * gridSize;
    for (let x = startX; x <= endX; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, viewTop);
      ctx.lineTo(x, viewBottom);
      ctx.stroke();
    }
    const startY = Math.floor(viewTop / gridSize) * gridSize;
    const endY = Math.ceil(viewBottom / gridSize) * gridSize;
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(viewLeft, y);
      ctx.lineTo(viewRight, y);
      ctx.stroke();
    }
  }

  ctx.restore();
}

// ====== Zoom Limits ======
function recalcZoomLimits() {
  const minScaleX = canvas.width / WORLD_WIDTH;
  const minScaleY = canvas.height / WORLD_HEIGHT;
  return { min: Math.min(minScaleX, minScaleY), max: 10 };
}

// ====== Animate Smooth Pan + Zoom ======
function animate() {
  scale += (targetScale - scale) * 0.15;
  offsetX += (targetOffsetX - offsetX) * 0.15 + velocityX;
  offsetY += (targetOffsetY - offsetY) * 0.15 + velocityY;

  velocityX *= 0.88;
  velocityY *= 0.88;

  recalcOffsetLimits();
  drawGrid();
  requestAnimationFrame(animate);
}
animate();

// ====== Dynamic Pan / Clamp ======
function recalcOffsetLimits() {
  const scaledWidth = WORLD_WIDTH * scale;
  const scaledHeight = WORLD_HEIGHT * scale;

  if (scaledWidth <= canvas.width) {
    offsetX = targetOffsetX = (canvas.width - scaledWidth) / 2;
  } else {
    const minX = canvas.width - scaledWidth;
    const maxX = 0;
    offsetX = Math.max(minX, Math.min(maxX, offsetX));
    targetOffsetX = Math.max(minX, Math.min(maxX, targetOffsetX));
  }

  if (scaledHeight <= canvas.height) {
    offsetY = targetOffsetY = (canvas.height - scaledHeight) / 2;
  } else {
    const minY = canvas.height - scaledHeight;
    const maxY = 0;
    offsetY = Math.max(minY, Math.min(maxY, offsetY));
    targetOffsetY = Math.max(minY, Math.min(maxY, targetOffsetY));
  }
}

// ====== Helpers ======
function worldFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    worldX: (e.clientX - rect.left - offsetX) / scale,
    worldY: (e.clientY - rect.top - offsetY) / scale
  };
}

function snapToGrid(val) {
  return Math.floor(val / gridSize) * gridSize;
}

// ====== Zoom (centered on cursor) ======
canvas.addEventListener("wheel", e => {
  e.preventDefault();

  const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
  const { min, max } = recalcZoomLimits();
  const newScale = Math.max(min, Math.min(max, targetScale * zoomFactor));

  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  // World coordinates under cursor before zoom
  const worldX = (mouseX - targetOffsetX) / targetScale;
  const worldY = (mouseY - targetOffsetY) / targetScale;

  targetScale = newScale;

  // Recalculate offsets to keep cursor world point fixed
  targetOffsetX = mouseX - worldX * targetScale;
  targetOffsetY = mouseY - worldY * targetScale;
});

// ====== Pan ======
canvas.addEventListener("mousedown", e => {
  if (e.button !== 0) return;
  isDragging = true;
  panStartX = e.clientX - targetOffsetX;
  panStartY = e.clientY - targetOffsetY;
  downX = e.clientX; downY = e.clientY;
  dragMoved = false;
  velocityX = 0; velocityY = 0;
});

canvas.addEventListener("mousemove", e => {
  if (!isDragging) return;
  if (!dragMoved && Math.hypot(e.clientX - downX, e.clientY - downY) > 4) dragMoved = true;

  const newX = e.clientX - panStartX;
  const newY = e.clientY - panStartY;
  velocityX = newX - targetOffsetX;
  velocityY = newY - targetOffsetY;
  targetOffsetX = newX;
  targetOffsetY = newY;
});

function endPan() { isDragging = false; }
canvas.addEventListener("mouseup", endPan);
canvas.addEventListener("mouseleave", endPan);

// ====== Place Pixel & Send ======
canvas.addEventListener("click", e => {
  if (dragMoved) return;

  const { worldX, worldY } = worldFromEvent(e);
  let x = snapToGrid(worldX);
  let y = snapToGrid(worldY);

  x = Math.max(0, Math.min(WORLD_WIDTH - gridSize, x));
  y = Math.max(0, Math.min(WORLD_HEIGHT - gridSize, y));

  const pixel = { x, y, color: currentColor };
  const idx = pixels.findIndex(p => p.x === x && p.y === y);
  if (idx >= 0) pixels[idx] = pixel;
  else pixels.push(pixel);

  drawGrid();
  ws.send(JSON.stringify({ type: 'draw', pixel }));
});

// ====== Numbered Color Palette ======
const palette = document.getElementById("palette");

const colors = [
  "#fffefe","#b9c2ce","#767e8c","#424651","#1e1f26","#010100",
  "#382314","#7c3f20","#c16f36","#feac6d","#ffd3b0","#fea5d0",
  "#f04eb4","#e872ff","#a631d3","#531c8d","#531c8d","#0335be",
  "#149dfe","#8df4fe","#00bea5","#17777f","#044522","#18862f",
  "#60e121","#b1ff37","#fffea4","#fce011","#fe9e17","#f66e08",
  "#550123","#99011a","#f20e0c","#ff7872"
];

palette.innerHTML = "";
colors.forEach((color, index) => {
  const wrapper = document.createElement("div");
  wrapper.style.position = "relative";
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.alignItems = "center";

  const label = document.createElement("span");
  label.textContent = index;
  label.style.fontSize = "12px";
  label.style.color = "#fff";
  label.style.marginBottom = "2px";
  wrapper.appendChild(label);

  const swatch = document.createElement("div");
  swatch.className = "color-swatch";
  swatch.style.background = color;
  swatch.dataset.color = color;
  swatch.addEventListener("click", () => {
    document.querySelectorAll(".color-swatch").forEach(s => s.classList.remove("selected"));
    swatch.classList.add("selected");
    currentColor = color;
  });
  wrapper.appendChild(swatch);

  palette.appendChild(wrapper);
});
document.querySelector(".color-swatch").classList.add("selected");

// ====== Grid Toggle ======
const gridBtn = document.getElementById("toggle-grid");
gridBtn.style.background = "#fff";
gridBtn.addEventListener("click", () => {
  showGrid = !showGrid;
  gridBtn.style.background = showGrid ? "#fff" : "#222";
  drawGrid();
});

// ====== Chat Feed & Button ======
const feed = document.getElementById("chat-feed");
const input = document.getElementById("chat-message");
const sendBtn = document.getElementById("send-message");
const sidePanel = document.getElementById("side-panel");
const chatToggleBtn = document.getElementById("toggle-chat");

function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  const msg = document.createElement("div");
  msg.className = "chat-msg";
  msg.textContent = text;
  feed.insertBefore(msg, feed.querySelector(".chat-input"));
  input.value = "";
  feed.scrollTop = feed.scrollHeight;
}

sendBtn.addEventListener("click", sendMessage);
input.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    sendMessage();
    e.preventDefault();
  }
});

chatToggleBtn.addEventListener("click", () => {
  sidePanel.style.display = sidePanel.style.display === "flex" ? "none" : "flex";
});

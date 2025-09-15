const canvas = document.getElementById("pixelCanvas");
const ctx = canvas.getContext("2d");

// ===== Canvas Setup =====
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
window.addEventListener("resize", () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

// ===== View Transform State =====
let scale = 1;
let targetScale = 1;
let offsetX = 0, offsetY = 0;
let targetX = 0, targetY = 0;

let isDragging = false;
let lastMouseX = 0, lastMouseY = 0;

// Inertia
let velocityX = 0, velocityY = 0;

// Grid / Pixels
const gridSize = 20;
let currentColor = "#ff0000";
let pixels = [];

// ===== Draw Loop =====
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Smooth transition
  offsetX += (targetX - offsetX) * 0.2;
  offsetY += (targetY - offsetY) * 0.2;
  scale += (targetScale - scale) * 0.2;

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grid
  ctx.strokeStyle = "#222";
  for (let x = 0; x < canvas.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Draw Pixels
  pixels.forEach(p => {
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, gridSize, gridSize);
  });

  ctx.restore();

  requestAnimationFrame(draw);
}
draw();

// ===== Smooth Zoom at Mouse Position =====
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();

  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  // Convert to world coords
  const worldX = (mouseX - offsetX) / scale;
  const worldY = (mouseY - offsetY) / scale;

  const zoomFactor = e.deltaY < 0 ? 1.2 : 0.8;
  targetScale *= zoomFactor;
  targetScale = Math.min(Math.max(targetScale, 0.2), 10);

  // Keep zoom anchored on mouse
  targetX = mouseX - worldX * targetScale;
  targetY = mouseY - worldY * targetScale;
});

// ===== Pan with Inertia =====
canvas.addEventListener("mousedown", (e) => {
  isDragging = true;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
  velocityX = velocityY = 0;
});

canvas.addEventListener("mousemove", (e) => {
  if (isDragging) {
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;

    targetX += dx;
    targetY += dy;

    velocityX = dx;
    velocityY = dy;

    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  }
});

canvas.addEventListener("mouseup", () => {
  isDragging = false;
});
canvas.addEventListener("mouseleave", () => {
  isDragging = false;
});

// ===== Apply inertia continuously =====
function applyInertia() {
  if (!isDragging) {
    targetX += velocityX;
    targetY += velocityY;

    velocityX *= 0.9; // friction
    velocityY *= 0.9;

    if (Math.abs(velocityX) < 0.1) velocityX = 0;
    if (Math.abs(velocityY) < 0.1) velocityY = 0;
  }
  requestAnimationFrame(applyInertia);
}
applyInertia();

// ===== Place Pixel =====
canvas.addEventListener("click", (e) => {
  if (isDragging) return; // ignore if dragging

  const rect = canvas.getBoundingClientRect();
  const worldX = (e.clientX - rect.left - offsetX) / scale;
  const worldY = (e.clientY - rect.top - offsetY) / scale;

  const x = Math.floor(worldX / gridSize) * gridSize;
  const y = Math.floor(worldY / gridSize) * gridSize;

  pixels.push({ x, y, color: currentColor });
});

// ===== Double-click to reset view =====
canvas.addEventListener("dblclick", () => {
  targetX = canvas.width / 2;
  targetY = canvas.height / 2;
  targetScale = 1;
});

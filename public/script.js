const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// Full screen
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// State
let currentColor = "#000000";
let points = 10;
let cooldown = 0;
let gridEnabled = false;

// Zoom & pan state
let scale = 1;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

// Store pixels locally
let pixels = [];

// WebSocket (secure)
const ws = new WebSocket(`wss://${window.location.host}`);

// ===== Canvas Helpers =====

// Draw grid lines
function drawGridLines() {
  if (!gridEnabled) return;
  ctx.strokeStyle = "#ddd";
  const step = 10;
  const scaledStep = step * scale;

  for (let x = offsetX % scaledStep; x < canvas.width; x += scaledStep) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = offsetY % scaledStep; y < canvas.height; y += scaledStep) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

// Redraw everything
function redraw() {
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  pixels.forEach(p => {
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 10, 10);
  });

  ctx.restore();

  if (gridEnabled) drawGridLines();
}

// Update points display
function updatePointsDisplay() {
  const text = document.getElementById("points");
  text.textContent = points;

  if (currentColor.toLowerCase() === "#000000") {
    text.style.color = "#fff";
  } else {
    text.style.color = "#000";
  }
}

// ===== WebSocket Events =====
ws.onmessage = e => {
  const data = JSON.parse(e.data);
  if (data.type === "init") {
    pixels = data.pixels;
    redraw();
  }
  if (data.type === "pixel") {
    pixels.push({ x: data.x, y: data.y, color: data.color });
    redraw();
  }
  if (data.type === "updatePoints") {
    points = data.points;
    cooldown = data.cooldown;
    updatePointsDisplay();
    const overlay = document.getElementById("cooldown-overlay");
    overlay.style.transform =
      cooldown > 0 ? `scaleY(${cooldown / 20})` : "scaleY(0)";
  }
};

// ===== User Interactions =====

// Draw single pixel
canvas.addEventListener("click", e => {
  if (points <= 0 || cooldown > 0) return;

  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left - offsetX) / (10 * scale)) * 10;
  const y = Math.floor((e.clientY - rect.top - offsetY) / (10 * scale)) * 10;

  // Draw locally first
  pixels.push({ x, y, color: currentColor });
  redraw();

  // Send to server
  ws.send(JSON.stringify({ type: "draw", x, y, color: currentColor }));
});

// Zoom with scroll
canvas.addEventListener("wheel", e => {
  e.preventDefault();
  const zoom = e.deltaY < 0 ? 1.1 : 0.9;
  scale *= zoom;
  redraw();
});

// Dragging
canvas.addEventListener("mousedown", e => {
  isDragging = true;
  dragStartX = e.clientX - offsetX;
  dragStartY = e.clientY - offsetY;
});

canvas.addEventListener("mousemove", e => {
  if (isDragging) {
    offsetX = e.clientX - dragStartX;
    offsetY = e.clientY - dragStartY;
    redraw();
  }
});

canvas.addEventListener("mouseup", () => (isDragging = false));
canvas.addEventListener("mouseleave", () => (isDragging = false));

// Handle window resize
window.addEventListener("resize", () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  redraw();
});

// ===== Color Picker =====
const colors = [
  "#fffefe", "#b9c2ce", "#767e8c", "#424651", "#1e1f26", "#010100", "#382314", "#7c3f20",
  "#c16f36", "#feac6d", "#ffd3b0", "#fea5d0", "#f04eb4", "#e872ff", "#a631d3", "#531c8d",
  "#0335be", "#149dfe", "#8df4fe", "#00bea5", "#17777f", "#044522", "#18862f", "#60e121",
  "#b1ff37", "#fffea4", "#fce011", "#fe9e17", "#f66e08", "#550123", "#99011a", "#f20e0c", "#ff7872"
];

const popup = document.getElementById("color-popup");
colors.forEach(c => {
  const div = document.createElement("div");
  div.className = "color-choice";
  div.style.background = c;
  div.onclick = () => {
    currentColor = c;
    document.getElementById("color-square").style.background = c;
    popup.classList.add("hidden");
    updatePointsDisplay();
  };
  popup.appendChild(div);
});

document.getElementById("more-colors").onclick = () => {
  popup.classList.toggle("hidden");
};

// Grid toggle
document.getElementById("toggle-grid").onclick = () => {
  gridEnabled = !gridEnabled;
  redraw();
};

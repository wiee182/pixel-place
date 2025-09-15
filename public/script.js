// ====== Canvas Setup ======
const canvas = document.getElementById("pixelCanvas");
const ctx = canvas.getContext("2d");

let scale = 1;
let offsetX = 0, offsetY = 0;
let isDragging = false;
let startX, startY;

let currentColor = "#ff0000";
const gridSize = 10;

// Draw grid
function drawGrid() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#ddd";
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

  ctx.restore();
}

drawGrid();

// Zoom
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  const zoom = e.deltaY < 0 ? 1.1 : 0.9;
  scale *= zoom;
  drawGrid();
});

// Pan
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

// Place pixel
canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left - offsetX) / (gridSize * scale)) * gridSize;
  const y = Math.floor((e.clientY - rect.top - offsetY) / (gridSize * scale)) * gridSize;

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  ctx.fillStyle = currentColor;
  ctx.fillRect(x, y, gridSize, gridSize);
  ctx.restore();
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

// ====== Chat Panel ======
const sidePanel = document.getElementById("side-panel");
document.getElementById("toggle-chat").addEventListener("click", () => {
  sidePanel.classList.toggle("active");
});
document.getElementById("close-panel").addEventListener("click", () => {
  sidePanel.classList.remove("active");
});

const feed = document.getElementById("chat-feed");
const input = document.getElementById("chat-message");
const sendBtn = document.getElementById("send-message");

sendBtn.addEventListener("click", () => {
  if (input.value.trim() !== "") {
    const msg = document.createElement("div");
    msg.className = "chat-msg";
    msg.textContent = input.value;
    feed.appendChild(msg);
    input.value = "";
    feed.scrollTop = feed.scrollHeight;
  }
});

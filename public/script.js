// --- Canvas & DOM setup ---
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const gridBtn = document.getElementById("toggle-grid");
const colorSquare = document.getElementById("color-square");
const colorPopup = document.getElementById("color-popup");
const moreColorsBtn = document.getElementById("more-colors");
const pointsDisplay = document.getElementById("points");
const cooldownOverlay = document.getElementById("cooldown-overlay");

const canvasSize = 1000;
const pixels = new Map();
const colors = [
  "#fffefe","#b9c2ce","#767e8c","#424651","#1e1f26","#010100","#382314","#7c3f20",
  "#c16f36","#feac6d","#ffd3b0","#fea5d0","#f04eb4","#e872ff","#a631d3","#531c8d",
  "#0335be","#149dfe","#8df4fe","#00bea5","#17777f","#044522","#18862f","#60e121",
  "#b1ff37","#fffea4","#fce011","#fe9e17","#f66e08","#550123","#99011a","#f20e0c","#ff7872"
];

let currentColor = "#000";
let scale = 20;
let showGrid = true;
let cameraX = 0;
let cameraY = 0;
let isDrawing = false;
let isDragging = false;
let lastMouseX, lastMouseY;

let currentUser = localStorage.getItem("pp_username");

// --- Canvas setup ---
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
cameraX = (canvas.width - canvasSize * scale) / 2;
cameraY = (canvas.height - canvasSize * scale) / 2;

// Disable right-click menu
document.addEventListener("contextmenu", e => e.preventDefault());

// --- Socket.IO setup ---
const socket = io();

// --- Login auto-redirect ---
if (!currentUser) {
  console.log("Not logged in yet, drawing disabled.");
}

// --- Receive initial canvas ---
socket.on("initCanvas", (serverPixels) => {
  pixels.clear();
  Object.entries(serverPixels).forEach(([key, color]) => pixels.set(key, color));
  drawAll();
});

// --- Receive pixel updates ---
socket.on("updatePixel", ({ x, y, color }) => {
  pixels.set(`${x},${y}`, color);
  drawAll();
});

// --- Login success (from socket login) ---
socket.on("login_success", (payload) => {
  currentUser = payload.username;
  localStorage.setItem("pp_username", currentUser);
  pointsDisplay.textContent = payload.points;
  const loginBtn = document.getElementById("login-btn");
  if (loginBtn) {
    loginBtn.textContent = currentUser;
    loginBtn.disabled = true;
  }
});

// --- Points update ---
socket.on("points_update", (data) => {
  pointsDisplay.textContent = data.points ?? data;
});

// --- Cooldown handling ---
socket.on("cooldown_started", ({ wait }) => {
  cooldownOverlay.style.display = "flex";
  cooldownOverlay.textContent = wait;
  const interval = setInterval(() => {
    wait--;
    cooldownOverlay.textContent = wait;
    if (wait <= 0) {
      clearInterval(interval);
      cooldownOverlay.style.display = "none";
      pointsDisplay.textContent = 10; // reset points after cooldown
    }
  }, 1000);
});

// --- Draw everything ---
function drawAll() {
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw pixels
  for (let [key, color] of pixels) {
    const [x, y] = key.split(",").map(Number);
    ctx.fillStyle = color;
    ctx.fillRect(x * scale + cameraX, y * scale + cameraY, scale, scale);
  }

  // Draw grid & minimap
  drawGrid();
  drawMiniMap();

  // Draw user
  ctx.fillStyle = "#000";
  ctx.font = "16px Arial";
  ctx.fillText(`User: ${currentUser || "Guest"}`, 10, canvas.height - 10);
}

function drawGrid() {
  if (!showGrid) return;
  ctx.strokeStyle = "rgba(0,0,0,0.1)";
  ctx.lineWidth = 0.5;

  for (let x = 0; x <= canvasSize; x++) {
    ctx.beginPath();
    ctx.moveTo(x * scale + cameraX, cameraY);
    ctx.lineTo(x * scale + cameraX, canvasSize * scale + cameraY);
    ctx.stroke();
  }

  for (let y = 0; y <= canvasSize; y++) {
    ctx.beginPath();
    ctx.moveTo(cameraX, y * scale + cameraY);
    ctx.lineTo(canvasSize * scale + cameraX, y * scale + cameraY);
    ctx.stroke();
  }
}

// --- Draw pixel (send to server) ---
function drawPixel(e) {
  if (!currentUser) {
    alert("Please log in to draw!");
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const x = Math.floor((mouseX - cameraX) / scale);
  const y = Math.floor((mouseY - cameraY) / scale);

  if (x < 0 || y < 0 || x >= canvasSize || y >= canvasSize) return;

  socket.emit("drawPixel", { x, y, color: currentColor });
}

// --- Mouse events ---
canvas.addEventListener("mousedown", e => {
  if (e.button === 0) {
    isDrawing = true;
    drawPixel(e);
  } else {
    isDragging = true;
  }
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
});

canvas.addEventListener("mouseup", () => {
  isDrawing = false;
  isDragging = false;
});

canvas.addEventListener("mousemove", e => {
  if (isDrawing) drawPixel(e);
  if (isDragging) {
    cameraX += e.clientX - lastMouseX;
    cameraY += e.clientY - lastMouseY;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    drawAll();
  }
});

// --- Zoom ---
canvas.addEventListener("wheel", e => {
  e.preventDefault();
  const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
  const newScale = Math.max(1, Math.min(scale * zoomFactor, 40));

  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  cameraX -= (newScale - scale) * (mouseX - cameraX) / scale;
  cameraY -= (newScale - scale) * (mouseY - cameraY) / scale;

  scale = newScale;
  drawAll();
});

// --- Minimap ---
const miniMap = document.createElement("canvas");
const miniCtx = miniMap.getContext("2d");
miniMap.width = 200;
miniMap.height = 200;
miniMap.id = "minimap";
document.body.appendChild(miniMap);

function drawMiniMap() {
  miniCtx.fillStyle = "#fff";
  miniCtx.fillRect(0, 0, miniMap.width, miniMap.height);

  const factor = miniMap.width / canvasSize;
  for (let [key, color] of pixels) {
    const [x, y] = key.split(",").map(Number);
    miniCtx.fillStyle = color;
    miniCtx.fillRect(x * factor, y * factor, factor, factor);
  }

  miniCtx.strokeStyle = "#000";
  miniCtx.lineWidth = 1;
  miniCtx.strokeRect(-cameraX / scale * factor, -cameraY / scale * factor,
    canvas.width / scale * factor, canvas.height / scale * factor);
}

miniMap.addEventListener("click", e => {
  const rect = miniMap.getBoundingClientRect();
  const factor = miniMap.width / canvasSize;
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  cameraX = -x / factor * scale + canvas.width / 2;
  cameraY = -y / factor * scale + canvas.height / 2;
  drawAll();
});

// --- Color palette ---
colors.forEach(c => {
  const div = document.createElement("div");
  div.className = "color-option";
  div.style.background = c;
  div.addEventListener("click", () => {
    currentColor = c;
    colorSquare.style.background = c;
    colorPopup.classList.add("hidden");
  });
  colorPopup.appendChild(div);
});

moreColorsBtn.addEventListener("click", () => colorPopup.classList.toggle("hidden"));
gridBtn.addEventListener("click", () => {
  showGrid = !showGrid;
  drawAll();
  if (showGrid) gridBtn.classList.add("active");
  else gridBtn.classList.remove("active");
});

window.addEventListener("resize", () => drawAll());

// --- Initial draw ---
drawAll();

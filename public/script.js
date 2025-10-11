// --- User login status ---
let currentUser = localStorage.getItem("username");

// --- Canvas & DOM setup ---
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const gridBtn = document.getElementById("toggle-grid");
const colorSquare = document.getElementById("color-square");
const colorPopup = document.getElementById("color-popup");
const moreColorsBtn = document.getElementById("more-colors");
const pointsDisplay = document.getElementById("points");
const cooldownOverlay = document.getElementById("cooldown-overlay");
const loginBtn = document.getElementById("login-btn");

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

let userPoints = 10;
let isOnCooldown = false;

pointsDisplay.textContent = userPoints;
cooldownOverlay.style.display = "none";

// --- Canvas setup ---
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
cameraX = (canvas.width - canvasSize * scale) / 2;
cameraY = (canvas.height - canvasSize * scale) / 2;
document.addEventListener("contextmenu", e => e.preventDefault());

// --- Login button ---
if (currentUser) {
  loginBtn.textContent = currentUser;
  loginBtn.disabled = true;
} else {
  loginBtn.textContent = "Login";
  loginBtn.disabled = false;
  loginBtn.addEventListener("click", () => {
    window.location.href = "/login.html";
  });
}

// --- Socket.IO setup ---
const socket = io(window.location.origin, { transports: ["websocket", "polling"] });

// --- Login handshake ---
if (currentUser) {
  socket.emit("login", currentUser);
  socket.emit("whoami");
}

socket.on("login_success", (data) => {
  currentUser = data.username;
  userPoints = data.points || 10;
  pointsDisplay.textContent = userPoints;
});

socket.on("login_failed", () => { currentUser = null; });

// --- Receive initial pixels ---
socket.on("init", (serverPixels) => {
  pixels.clear();
  Object.entries(serverPixels).forEach(([key, color]) => pixels.set(key, color));
  drawAll();
});

// --- Receive pixel updates ---
socket.on("updatePixel", ({ x, y, color }) => {
  pixels.set(`${x},${y}`, color);
  drawAll();
});

// --- Handle placement errors ---
socket.on("place_failed", ({ reason, wait }) => {
  if (reason === "cooldown") startCooldown(wait);
});

// --- Points update ---
socket.on("points_update", (points) => {
  userPoints = points;
  pointsDisplay.textContent = userPoints;
});

// === Draw all ===
function drawAll() {
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let [key, color] of pixels) {
    const [x, y] = key.split(",").map(Number);
    ctx.fillStyle = color;
    ctx.fillRect(x * scale + cameraX, y * scale + cameraY, scale, scale);
  }
  if (showGrid) drawGrid();
  drawMiniMap();
}

function drawGrid() {
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

// === Pixel placement ===
function drawPixel(e) {
  if (!currentUser) {
    window.location.href = "/login.html";
    return;
  }
  if (isOnCooldown || userPoints <= 0) return;

  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const x = Math.floor((mouseX - cameraX) / scale);
  const y = Math.floor((mouseY - cameraY) / scale);
  if (x < 0 || y < 0 || x >= canvasSize || y >= canvasSize) return;

  socket.emit("drawPixel", { x, y, color: currentColor });
  userPoints--;
  pointsDisplay.textContent = userPoints;
  if (userPoints <= 0) startCooldown(20);
}

// === Cooldown ===
function startCooldown(wait = 20) {
  if (isOnCooldown) return;
  isOnCooldown = true;
  cooldownOverlay.style.display = "flex";
  let countdown = wait;
  cooldownOverlay.textContent = countdown;
  const interval = setInterval(() => {
    countdown--;
    cooldownOverlay.textContent = countdown;
    if (countdown <= 0) {
      clearInterval(interval);
      isOnCooldown = false;
      cooldownOverlay.style.display = "none";
      userPoints = 10;
      pointsDisplay.textContent = userPoints;
    }
  }, 1000);
}

// === Desktop Mouse Controls ===
canvas.addEventListener("mousedown", e => {
  if (e.button === 0) {
    isDrawing = true;
    isDragging = false;
    drawPixel(e);
  } else if (e.button === 1 || e.button === 2) {
    isDragging = true;
    isDrawing = false;
  }
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
});
canvas.addEventListener("mouseup", () => { isDrawing = false; isDragging = false; });
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
canvas.addEventListener("wheel", e => {
  e.preventDefault();
  const zoom = e.deltaY < 0 ? 1.1 : 0.9;
  const newScale = Math.max(1, Math.min(scale * zoom, 40));
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  cameraX -= (newScale - scale) * (mouseX - cameraX) / scale;
  cameraY -= (newScale - scale) * (mouseY - cameraY) / scale;
  scale = newScale;
  drawAll();
});

// === Mobile Touch Controls (Improved Stable) ===
let lastTouchDistance = 0;
let lastTouchCenter = null;
let isTouchPanning = false;
let lastTouchX = 0;
let lastTouchY = 0;

canvas.addEventListener("touchstart", (e) => {
  if (e.touches.length === 1) {
    const touch = e.touches[0];
    lastTouchX = touch.clientX;
    lastTouchY = touch.clientY;
    drawPixel({ clientX: touch.clientX, clientY: touch.clientY });
    isTouchPanning = true;
  } else if (e.touches.length === 2) {
    lastTouchDistance = getTouchDistance(e.touches);
    lastTouchCenter = getTouchCenter(e.touches);
    isTouchPanning = false;
  }
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
  if (e.touches.length === 2) {
    e.preventDefault();
    const newDistance = getTouchDistance(e.touches);
    const center = getTouchCenter(e.touches);
    const zoom = newDistance / lastTouchDistance;
    const newScale = Math.max(1, Math.min(scale * zoom, 40));

    cameraX -= (newScale - scale) * (center.x - cameraX) / scale;
    cameraY -= (newScale - scale) * (center.y - cameraY) / scale;

    scale = newScale;
    lastTouchDistance = newDistance;
    drawAll();
  } else if (e.touches.length === 1 && isTouchPanning) {
    e.preventDefault();
    const touch = e.touches[0];
    const dx = touch.clientX - lastTouchX;
    const dy = touch.clientY - lastTouchY;
    cameraX += dx;
    cameraY += dy;
    lastTouchX = touch.clientX;
    lastTouchY = touch.clientY;
    drawAll();
  }
}, { passive: false });

canvas.addEventListener("touchend", () => {
  isTouchPanning = false;
});

function getTouchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}
function getTouchCenter(touches) {
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2
  };
}

// === Mini Map ===
const miniMap = document.createElement("canvas");
miniMap.id = "minimap";
miniMap.width = 200;
miniMap.height = 200;
document.body.appendChild(miniMap);
const miniCtx = miniMap.getContext("2d");

function drawMiniMap() {
  miniCtx.fillStyle = "#fff";
  miniCtx.fillRect(0, 0, miniMap.width, miniMap.height);
  const factor = miniMap.width / canvasSize;
  for (let [key, color] of pixels) {
    const [x, y] = key.split(",").map(Number);
    miniCtx.fillStyle = color;
    miniCtx.fillRect(x * factor, y * factor, factor, factor);
  }
}

// === Active user counter ===
const activeContainer = document.createElement("div");
activeContainer.id = "active-users";
activeContainer.innerHTML = `<span style="font-size:16px;opacity:0.9">👥</span><span id="activeCount" style="font-weight:700;text-shadow:0 0 10px rgba(0,255,180,0.8);transition:all 0.25s ease-in-out">0</span>`;
Object.assign(activeContainer.style, {
  display: "flex", alignItems: "center", justifyContent: "center",
  gap: "6px", marginTop: "8px", fontFamily: "Inter, sans-serif",
  fontWeight: "600", fontSize: "14px", color: "#fff",
  textShadow: "0 0 6px rgba(0,255,180,0.6)", position: "fixed",
  bottom: "90px", left: "50%", transform: "translateX(-50%)",
  background: "rgba(0,0,0,0.35)", backdropFilter: "blur(6px)",
  padding: "6px 14px", borderRadius: "12px",
  boxShadow: "0 0 8px rgba(0,255,180,0.3)", transition: "all 0.3s ease"
});
document.body.appendChild(activeContainer);
const activeCount = document.getElementById("activeCount");

socket.on("user_count", (count) => {
  activeCount.textContent = count;
  activeCount.style.transform = "scale(1.3)";
  activeContainer.style.boxShadow = "0 0 12px rgba(0,255,180,0.6)";
  setTimeout(() => {
    activeCount.style.transform = "scale(1)";
    activeContainer.style.boxShadow = "0 0 8px rgba(0,255,180,0.3)";
  }, 200);
});

// === Color palette ===
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
  gridBtn.classList.toggle("active", showGrid);
});
window.addEventListener("resize", drawAll);
drawAll();

// ===== Constants =====
const GRID_SIZE = 10;
const WORLD_WIDTH = 5000;
const WORLD_HEIGHT = 5000;

// ===== Canvas Setup =====
const canvas = document.getElementById("pixelCanvas");
const ctx = canvas.getContext("2d");

let scale = 1, offsetX = 0, offsetY = 0;
let isDragging = false, dragStartX = 0, dragStartY = 0;

// ===== Colors =====
const colors = ["#fffefe","#b9c2ce","#767e8c","#424651","#1e1f26","#010100","#ff0000","#00ff00","#0000ff","#ffff00","#ff00ff","#00ffff"];
let currentColor = colors[0];

// ===== Palette Elements =====
const paletteDiv = document.getElementById("palette");
const moreColorsPopup = document.getElementById("more-colors-popup");
const moreBtn = document.getElementById("more-colors");

// --- Main swatch ---
const mainSwatch = document.createElement("div");
mainSwatch.className = "color-swatch selected";
mainSwatch.style.background = currentColor;
mainSwatch.dataset.color = currentColor;
mainSwatch.addEventListener("click", () => {
  currentColor = mainSwatch.dataset.color;
});
paletteDiv.appendChild(mainSwatch);

// --- Fill popup with all colors ---
colors.forEach(c => {
  const sw = document.createElement("div");
  sw.className = "color-swatch";
  sw.style.background = c;
  sw.dataset.color = c;
  sw.addEventListener("click", () => {
    currentColor = c;
    mainSwatch.style.background = c; // update main swatch
    moreColorsPopup.classList.remove("show");
  });
  moreColorsPopup.appendChild(sw);
});

// --- Toggle popup ---
moreBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  moreColorsPopup.classList.toggle("show");
});

// --- Close popup on outside click ---
document.addEventListener("click", (e) => {
  if (!moreColorsPopup.contains(e.target) && e.target !== moreBtn) {
    moreColorsPopup.classList.remove("show");
  }
});

// ===== Points =====
const pointsDisplay = document.getElementById("points-display");
let userPoints = 6;
function updatePoints(points) {
  userPoints = points;
  pointsDisplay.textContent = `${points}/6`;
}

// ===== Chat =====
const chatFeed = document.getElementById("chat-feed");
const chatInput = document.getElementById("chat-message");
const sendBtn = document.getElementById("send-message");

function addChatMessage(user, text) {
  const msg = document.createElement("div");
  msg.className = "chat-msg";
  msg.textContent = `${user}: ${text}`;
  chatFeed.appendChild(msg);
  chatFeed.scrollTop = chatFeed.scrollHeight;
}

sendBtn.addEventListener("click", sendMessage);
chatInput.addEventListener("keydown", e => {
  if (e.key === "Enter") { sendMessage(); e.preventDefault(); }
});
function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;
  ws.send(JSON.stringify({ type: "chat", user: "anon", message: text }));
  chatInput.value = "";
}

// ===== WebSocket =====
const ws = new WebSocket(location.origin.replace(/^http/, "ws"));
const chunks = new Map();

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === "init") {
    data.canvas.forEach(p => setPixel(p.x, p.y, p.color));
    drawGrid();

    chatFeed.innerHTML = "";
    data.chat.forEach(msg => addChatMessage(msg.user, msg.message));

    updatePoints(data.points);
  }

  if (data.type === "draw") {
    setPixel(data.x, data.y, data.color);
    drawGrid();
  }

  if (data.type === "chat") addChatMessage(data.user, data.message);
  if (data.type === "points") updatePoints(data.points);
  if (data.type === "error") console.warn(data.message);
};

// ===== Pixel Helpers =====
function setPixel(x, y, color) {
  const key = `${Math.floor(x/100)},${Math.floor(y/100)}`;
  if (!chunks.has(key)) chunks.set(key, []);
  const chunk = chunks.get(key);
  const idx = chunk.findIndex(p => p.x === x && p.y === y);
  if (idx >= 0) chunk[idx].color = color;
  else chunk.push({x,y,color});
}

// ===== Drawing =====
canvas.addEventListener("click", e => {
  if (isDragging) return;
  const rect = canvas.getBoundingClientRect();
  const worldX = (e.clientX-rect.left-offsetX)/scale;
  const worldY = (e.clientY-rect.top-offsetY)/scale;
  const x = Math.max(0, Math.min(WORLD_WIDTH-GRID_SIZE, Math.floor(worldX/GRID_SIZE)*GRID_SIZE));
  const y = Math.max(0, Math.min(WORLD_HEIGHT-GRID_SIZE, Math.floor(worldY/GRID_SIZE)*GRID_SIZE));

  ws.send(JSON.stringify({ type: "draw", x, y, color: currentColor, user: "anon" }));
});

// ===== Pan & Zoom =====
canvas.addEventListener("mousedown", e => {
  isDragging = true;
  dragStartX = e.clientX - offsetX;
  dragStartY = e.clientY - offsetY;
});
canvas.addEventListener("mousemove", e => {
  if (isDragging) {
    offsetX = e.clientX - dragStartX;
    offsetY = e.clientY - dragStartY;
    drawGrid();
  }
});
canvas.addEventListener("mouseup", () => isDragging=false);
canvas.addEventListener("mouseleave", () => isDragging=false);
canvas.addEventListener("wheel", e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX-rect.left-offsetX)/scale;
  const my = (e.clientY-rect.top-offsetY)/scale;
  const zoom = e.deltaY<0 ? 1.1 : 0.9;
  const newScale = Math.min(Math.max(0.1, scale*zoom),5);
  offsetX -= (mx*(newScale-scale));
  offsetY -= (my*(newScale-scale));
  scale = newScale;
  drawGrid();
});

// ===== Resize =====
function resizeCanvas() {
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;
  offsetX = (canvas.width - WORLD_WIDTH)/2;
  offsetY = (canvas.height - WORLD_HEIGHT)/2;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// ===== Draw Loop =====
function drawGrid() {
  ctx.fillStyle = "#000";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  chunks.forEach(chunk => {
    chunk.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, GRID_SIZE, GRID_SIZE);
    });
  });

  ctx.strokeStyle = "#111";
  ctx.lineWidth = 1/scale;
  for (let x=0;x<=WORLD_WIDTH;x+=GRID_SIZE){
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,WORLD_HEIGHT); ctx.stroke();
  }
  for (let y=0;y<=WORLD_HEIGHT;y+=GRID_SIZE){
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(WORLD_WIDTH,y); ctx.stroke();
  }

  ctx.restore();
}

function animate() { drawGrid(); requestAnimationFrame(animate); }
animate();

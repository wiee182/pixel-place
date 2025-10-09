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

// --- User state ---
let currentUser = localStorage.getItem("pp_username") || null;
let userPoints = 10;
let isOnCooldown = false;

// --- Canvas setup ---
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
cameraX = (canvas.width - canvasSize * scale) / 2;
cameraY = (canvas.height - canvasSize * scale) / 2;

// Disable right-click menu
document.addEventListener("contextmenu", e => e.preventDefault());

// --- Socket ---
const socket = io();

// Send login if stored
if (currentUser) socket.emit("login", currentUser);

// Receive full canvas
socket.on("init", (serverPixels) => {
  pixels.clear();
  Object.entries(serverPixels).forEach(([k,v]) => pixels.set(k,v));
  drawAll();
});

// Receive pixel updates
socket.on("updatePixel", ({x,y,color}) => {
  pixels.set(`${x},${y}`, color);
  drawAll();
});

// Login success
socket.on("login_success", ({username, points}) => {
  currentUser = username;
  localStorage.setItem("pp_username", username);
  userPoints = points;
  pointsDisplay.textContent = userPoints;

  const loginBtn = document.getElementById("login-btn");
  if (loginBtn) {
    loginBtn.textContent = currentUser;
    loginBtn.disabled = true;
  }
});

// Points update
socket.on("points_update", (data) => {
  userPoints = data.points ?? userPoints;
  pointsDisplay.textContent = userPoints;
});

// Cooldown start
socket.on("cooldown_started", ({wait}) => startCooldown(wait));

// Place failed
socket.on("place_failed", (data) => {
  if (data.reason === "not_logged_in") alert("Please login first!");
  else if (data.reason === "cooldown") startCooldown(data.wait);
});

// --- Draw functions ---
function drawAll() {
  ctx.fillStyle = "#fff";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // pixels
  for (let [key, color] of pixels) {
    const [x, y] = key.split(",").map(Number);
    ctx.fillStyle = color;
    ctx.fillRect(x*scale+cameraX, y*scale+cameraY, scale, scale);
  }

  drawGrid();
  drawMiniMap();

  ctx.fillStyle = "#000";
  ctx.font = "16px Arial";
  ctx.fillText(`User: ${currentUser || "Guest"}`, 10, canvas.height-10);
}

function drawGrid() {
  if (!showGrid) return;
  ctx.strokeStyle = "rgba(0,0,0,0.1)";
  ctx.lineWidth = 0.5;

  for (let x=0; x<=canvasSize; x++){
    ctx.beginPath();
    ctx.moveTo(x*scale+cameraX, cameraY);
    ctx.lineTo(x*scale+cameraX, canvasSize*scale+cameraY);
    ctx.stroke();
  }

  for (let y=0; y<=canvasSize; y++){
    ctx.beginPath();
    ctx.moveTo(cameraX, y*scale+cameraY);
    ctx.lineTo(canvasSize*scale+cameraX, y*scale+cameraY);
    ctx.stroke();
  }
}

// --- Drawing ---
function drawPixel(e){
  if (!currentUser) return alert("Please login to draw!");
  if (isOnCooldown) return;
  if (userPoints <= 0) return startCooldown(20);

  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left - cameraX)/scale);
  const y = Math.floor((e.clientY - rect.top - cameraY)/scale);

  if (x<0 || y<0 || x>=canvasSize || y>=canvasSize) return;

  socket.emit("drawPixel", {x,y,color: currentColor});
  userPoints--;
  pointsDisplay.textContent = userPoints;

  drawAll();
}

// --- Cooldown ---
function startCooldown(seconds){
  if (isOnCooldown) return;
  isOnCooldown = true;
  let remaining = seconds || 20;

  cooldownOverlay.style.display = "flex";
  cooldownOverlay.textContent = remaining;

  const interval = setInterval(()=>{
    remaining--;
    cooldownOverlay.textContent = remaining;
    pointsDisplay.textContent = remaining;

    if (remaining <= 0){
      clearInterval(interval);
      isOnCooldown = false;
      cooldownOverlay.style.display = "none";
      userPoints = 10;
      pointsDisplay.textContent = userPoints;
      if (currentUser) socket.emit("whoami");
    }
  }, 1000);
}

// --- Mouse events ---
canvas.addEventListener("mousedown", e=>{
  if (e.button === 0){ isDrawing = true; drawPixel(e); }
  else { isDragging = true; }
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
});

canvas.addEventListener("mouseup", ()=>{ isDrawing=false; isDragging=false; });
canvas.addEventListener("mousemove", e=>{
  if (isDrawing) drawPixel(e);
  if (isDragging){
    cameraX += e.clientX - lastMouseX;
    cameraY += e.clientY - lastMouseY;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    drawAll();
  }
});

// --- Zoom ---
canvas.addEventListener("wheel", e=>{
  e.preventDefault();
  const zoomFactor = e.deltaY<0 ? 1.1 : 0.9;
  const newScale = Math.max(1, Math.min(scale*zoomFactor,40));

  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  cameraX -= (newScale-scale)*(mouseX-cameraX)/scale;
  cameraY -= (newScale-scale)*(mouseY-cameraY)/scale;

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

function drawMiniMap(){
  miniCtx.fillStyle = "#fff";
  miniCtx.fillRect(0,0,miniMap.width,miniMap.height);

  const factor = miniMap.width/canvasSize;
  for (let [key,color] of pixels){
    const [x,y] = key.split(",").map(Number);
    miniCtx.fillStyle = color;
    miniCtx.fillRect(x*factor,y*factor,factor,factor);
  }

  miniCtx.strokeStyle = "#000";
  miniCtx.lineWidth = 1;
  miniCtx.strokeRect(-cameraX/scale*factor,-cameraY/scale*factor,
                     canvas.width/scale*factor, canvas.height/scale*factor);
}

miniMap.addEventListener("click", e=>{
  const rect = miniMap.getBoundingClientRect();
  const factor = miniMap.width/canvasSize;
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  cameraX = -x/factor*scale + canvas.width/2;
  cameraY = -y/factor*scale + canvas.height/2;
  drawAll();
});

// --- Color palette ---
colors.forEach(c=>{
  const div = document.createElement("div");
  div.className = "color-option";
  div.style.background = c;
  div.addEventListener("click", ()=>{
    currentColor = c;
    colorSquare.style.background = c;
    colorPopup.classList.add("hidden");
  });
  colorPopup.appendChild(div);
});

moreColorsBtn.addEventListener("click", ()=> colorPopup.classList.toggle("hidden"));

// --- Grid toggle ---
gridBtn.addEventListener("click", ()=>{
  showGrid = !showGrid;
  drawAll();
  gridBtn.classList.toggle("active", showGrid);
});

// --- Resize ---
window.addEventListener("resize", ()=>drawAll());

// --- Initial draw ---
drawAll();

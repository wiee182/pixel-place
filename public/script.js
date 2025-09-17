const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// Fullscreen
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// State
let currentColor = "#000000";
let points = 10;
let cooldown = 0;
let gridEnabled = false;

// Sounds
const drawSound = document.getElementById("draw-sound");
const pointSound = document.getElementById("point-sound");

// Socket.io
const socket = io();

// Draw grid
function drawGrid() {
  if (!gridEnabled) return;
  ctx.strokeStyle = "#ddd";
  for (let x = 0; x < canvas.width; x += 10) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 10) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

// Redraw canvas
function redraw(pixels) {
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  pixels.forEach(p => {
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 10, 10);
  });
  drawGrid();
}

// Update points display
function updatePointsDisplay() {
  const square = document.getElementById("color-square");
  const text = document.getElementById("points");

  text.textContent = points;
  text.style.color = currentColor.toLowerCase() === "#000000" ? "#fff" : "#000";

  const overlay = document.getElementById("cooldown-overlay");
  overlay.style.transform = cooldown > 0 ? `scaleY(${cooldown/20})` : "scaleY(0)";
}

// Handle socket messages
socket.on("init", data => redraw(data.pixels));
socket.on("pixel", data => {
  ctx.fillStyle = data.color;
  ctx.fillRect(data.x, data.y, 10, 10);
  drawSound.play();
});

// Click to draw
canvas.addEventListener("click", e => {
  if (points <= 0 || cooldown > 0) return;

  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / 10) * 10;
  const y = Math.floor((e.clientY - rect.top) / 10) * 10;

  socket.emit("draw", { x, y, color: currentColor });
  points--;
  cooldown = 20;
  updatePointsDisplay();
  drawSound.play();
  const interval = setInterval(() => {
    cooldown--;
    updatePointsDisplay();
    if (cooldown <= 0) clearInterval(interval);
  }, 1000);
});

// Color picker
const colors = [
  "#fffefe","#b9c2ce","#767e8c","#424651","#1e1f26","#010100","#382314","#7c3f20",
  "#c16f36","#feac6d","#ffd3b0","#fea5d0","#f04eb4","#e872ff","#a631d3","#531c8d",
  "#0335be","#149dfe","#8df4fe","#00bea5","#17777f","#044522","#18862f","#60e121",
  "#b1ff37","#fffea4","#fce011","#fe9e17","#f66e08","#550123","#99011a","#f20e0c","#ff7872"
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

document.getElementById("more-colors").onclick = () => popup.classList.toggle("hidden");

// Grid toggle
document.getElementById("toggle-grid").onclick = () => {
  gridEnabled = !gridEnabled;
  redraw([]);
};

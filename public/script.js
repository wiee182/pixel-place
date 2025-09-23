const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// Full screen
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// State
let currentColor = "#000000";
let gridEnabled = false;

// Zoom & Pan
let scale = 1;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let dragStart = { x: 0, y: 0 };

// Socket.io (not raw WebSocket anymore!)
const socket = io();

// Draw grid lines
function drawGridLines() {
  if (!gridEnabled) return;
  ctx.strokeStyle = "#ddd";
  for (let x = -offsetX % (10 * scale); x < canvas.width; x += 10 * scale) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = -offsetY % (10 * scale); y < canvas.height; y += 10 * scale) {
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
    ctx.fillRect(
      (p.x * scale) + offsetX,
      (p.y * scale) + offsetY,
      10 * scale,
      10 * scale
    );
  });
  if (gridEnabled) drawGridLines();
}

// Handle server messages
let pixels = [];

socket.on("init", data => {
  pixels = data.pixels;
  redraw(pixels);
});

socket.on("pixel", data => {
  pixels.push(data);
  redraw(pixels);
});

// Points system
const pointsDisplay = document.getElementById("points");
const cooldownOverlay = document.getElementById("cooldown-overlay");

socket.on("updatePoints", ({ points, cooldown }) => {
  pointsDisplay.textContent = points;
  if (!cooldown) {
    cooldownOverlay.style.transform = "scaleY(0)";
    cooldownOverlay.style.transition = "none";
  }
});

socket.on("cooldownStart", ({ duration }) => {
  cooldownOverlay.style.transition = `transform ${duration}ms linear`;
  cooldownOverlay.style.transform = "scaleY(1)";
});

// Click to draw
canvas.addEventListener("click", e => {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left - offsetX) / (10 * scale));
  const y = Math.floor((e.clientY - rect.top - offsetY) / (10 * scale));
  socket.emit("draw", { x, y, color: currentColor });
});

// Drag
canvas.addEventListener("mousedown", e => {
  isDragging = true;
  dragStart.x = e.clientX - offsetX;
  dragStart.y = e.clientY - offsetY;
});
canvas.addEventListener("mousemove", e => {
  if (isDragging) {
    offsetX = e.clientX - dragStart.x;
    offsetY = e.clientY - dragStart.y;
    redraw(pixels);
  }
});
canvas.addEventListener("mouseup", () => (isDragging = false));

// Zoom
canvas.addEventListener("wheel", e => {
  e.preventDefault();
  const zoomFactor = 1.1;
  const mouseX = e.clientX;
  const mouseY = e.clientY;

  const beforeZoomX = (mouseX - offsetX) / scale;
  const beforeZoomY = (mouseY - offsetY) / scale;

  if (e.deltaY < 0) {
    scale *= zoomFactor;
  } else {
    scale /= zoomFactor;
  }

  const afterZoomX = (mouseX - offsetX) / scale;
  const afterZoomY = (mouseY - offsetY) / scale;

  offsetX += (afterZoomX - beforeZoomX) * scale;
  offsetY += (afterZoomY - beforeZoomY) * scale;

  redraw(pixels);
});

// Resize
window.addEventListener("resize", () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  redraw(pixels);
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
  };
  popup.appendChild(div);
});

document.getElementById("more-colors").onclick = () => {
  popup.classList.toggle("hidden");
};

// Grid toggle
document.getElementById("toggle-grid").onclick = () => {
  gridEnabled = !gridEnabled;
  redraw(pixels);
};

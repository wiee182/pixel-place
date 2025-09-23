const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// Full screen
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// State
let currentColor = "#000000";
let points = 10;
let cooldownUntil = null;
let gridEnabled = false;

// ---- User ID (localStorage) ----
let userId = localStorage.getItem("pixelUserId");
if (!userId) {
  userId = crypto.randomUUID();
  localStorage.setItem("pixelUserId", userId);
}

// ---- Socket.io ----
const socket = io({
  auth: { userId }
});

// ---- Grid ----
function drawGridLines() {
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

function toggleGridLines() {
  if (gridEnabled) {
    drawGridLines();
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    redraw([]); // reapply pixels
  }
}

function redraw(pixels) {
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  pixels.forEach(p => {
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 10, 10);
  });
  if (gridEnabled) drawGridLines();
}

// ---- UI ----
function updatePointsDisplay() {
  const text = document.getElementById("points");
  const overlay = document.getElementById("cooldown-overlay");

  text.textContent = points;

  text.style.color = (currentColor.toLowerCase() === "#000000") ? "#fff" : "#000";

  if (cooldownUntil) {
    const now = Date.now();
    const total = 20000; // 20s
    const remaining = Math.max(0, cooldownUntil - now);
    const percent = 1 - remaining / total;
    overlay.style.transform = `scaleY(${percent})`;

    if (remaining > 0) {
      requestAnimationFrame(updatePointsDisplay);
    } else {
      cooldownUntil = null;
      points = 10;
      overlay.style.transform = "scaleY(0)";
      text.textContent = points;
    }
  } else {
    overlay.style.transform = "scaleY(0)";
  }
}

// ---- Socket Handlers ----
socket.on("init", (data) => {
  redraw(data.pixels);
});

socket.on("init-points", (data) => {
  points = data.points;
  cooldownUntil = data.cooldown_until ? new Date(data.cooldown_until).getTime() : null;
  updatePointsDisplay();
});

socket.on("update-points", ({ points: newPoints }) => {
  points = newPoints;
  updatePointsDisplay();
});

socket.on("cooldown", ({ until }) => {
  cooldownUntil = new Date(until).getTime();
  updatePointsDisplay();
});

socket.on("pixel", (data) => {
  ctx.fillStyle = data.color;
  ctx.fillRect(data.x, data.y, 10, 10);
});

// ---- Drawing ----
canvas.addEventListener("click", e => {
  if (points <= 0 || (cooldownUntil && cooldownUntil > Date.now())) return;

  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / 10) * 10;
  const y = Math.floor((e.clientY - rect.top) / 10) * 10;

  socket.emit("draw", { x, y, color: currentColor });
});

// ---- Window Resize ----
window.addEventListener("resize", () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  redraw([]);
});

// ---- Color Picker ----
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

document.getElementById("more-colors").onclick = () => {
  popup.classList.toggle("hidden");
};

document.getElementById("toggle-grid").onclick = () => {
  gridEnabled = !gridEnabled;
  toggleGridLines();
};

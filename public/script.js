// --- Check login ---
let currentUser = localStorage.getItem("username");

if (!currentUser) {
  // Redirect to login page if not logged in
  window.location.href = "/login.html";
}

// --- Socket.IO setup ---
const socket = io();

// Receive initial canvas from server
socket.on("initCanvas", (serverPixels) => {
  for (let key in serverPixels) {
    pixels.set(key, serverPixels[key]);
  }
  drawAll();
});

// Receive pixel updates from other users
socket.on("updatePixel", ({ x, y, color }) => {
  pixels.set(`${x},${y}`, color);
  drawAll();
});

// Send pixel when drawing
function drawPixel(e) {
  if (isOnCooldown) return;
  if (userPoints <= 0) {
    startCooldown();
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const x = Math.floor((mouseX - cameraX) / scale);
  const y = Math.floor((mouseY - cameraY) / scale);

  if (x < 0 || y < 0 || x >= canvasSize || y >= canvasSize) return;

  pixels.set(`${x},${y}`, currentColor);
  socket.emit("drawPixel", { x, y, color: currentColor }); // <-- send to server

  // Subtract points
  userPoints--;
  pointsDisplay.textContent = userPoints;

  drawAll();
}

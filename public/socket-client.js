const socket = io();
let me = {
  username: localStorage.getItem("pp_username") || null,
  points: 10,
};

// --- Connect ---
socket.on("connect", () => {
  if (me.username) socket.emit("login", me.username);
  socket.emit("whoami");
});

// --- Init pixels ---
socket.on("init", (pixelsObj) => {
  if (typeof pixels !== "undefined" && pixels instanceof Map) {
    pixels.clear();
    Object.entries(pixelsObj).forEach(([k, color]) => pixels.set(k, color));
    if (typeof drawAll === "function") drawAll();
  }
});

// --- Pixel update ---
socket.on("updatePixel", ({ x, y, color }) => {
  if (typeof pixels !== "undefined" && pixels instanceof Map) {
    pixels.set(`${x},${y}`, color);
    if (typeof drawAll === "function") drawAll();
  }
});

// --- Login success ---
socket.on("login_success", (payload) => {
  me.username = payload.username;
  me.points = payload.points;
  localStorage.setItem("pp_username", me.username);

  const btn = document.getElementById("login-btn");
  const pointsEl = document.getElementById("points");
  if (btn) { btn.textContent = me.username; btn.disabled = true; }
  if (pointsEl) pointsEl.textContent = me.points;
});

// --- Points update ---
socket.on("points_update", (points) => {
  me.points = points;
  const el = document.getElementById("points");
  if (el) el.textContent = points;
});

// --- Cooldown started ---
socket.on("cooldown_started", ({ wait }) => {
  showCooldown(wait);
});

// --- Cooldown tick (live update every second) ---
socket.on("cooldown_tick", ({ remaining }) => {
  const overlay = document.getElementById("cooldown-overlay");
  if (overlay) overlay.textContent = remaining;
});

// --- Place pixel ---
function socketEmitPlace(x, y, color) {
  if (!me.username) {
    alert("Please log in first!");
    return;
  }
  socket.emit("drawPixel", { x, y, color });
}

// --- Cooldown UI ---
function showCooldown(seconds) {
  const overlay = document.getElementById("cooldown-overlay");
  if (!overlay) return;
  overlay.style.display = "flex";
  overlay.textContent = seconds;

  const hide = () => {
    overlay.style.display = "none";
    overlay.textContent = "";
  };

  setTimeout(hide, seconds * 1000);
}

// --- Place failed ---
socket.on("place_failed", (data) => {
  if (data.reason === "cooldown") showCooldown(data.wait || 20);
  if (data.reason === "not_logged_in") alert("Please log in first!");
});

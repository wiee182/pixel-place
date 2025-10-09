// --- socket-client.js ---
const socket = io();

let me = {
  username: localStorage.getItem("pp_username") || null,
  points: 10,
};

// --- On connect ---
socket.on("connect", () => {
  if (me.username) {
    socket.emit("login", me.username);
  }
  socket.emit("whoami");
});

// --- Initialize canvas ---
socket.on("init", (pixelsObj) => {
  if (typeof pixels !== "undefined" && pixels instanceof Map) {
    pixels.clear();
    Object.entries(pixelsObj).forEach(([k, color]) => pixels.set(k, color));
    if (typeof drawAll === "function") drawAll();
  }
});

// --- Receive pixel update ---
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

  const loginBtn = document.getElementById("login-btn");
  const pointsEl = document.getElementById("points");
  if (loginBtn) {
    loginBtn.textContent = me.username;
    loginBtn.disabled = true;
  }
  if (pointsEl) pointsEl.textContent = me.points;
  console.log("Logged in as", me.username);
});

// --- Points update ---
socket.on("points_update", (data) => {
  me.points = data.points ?? data;
  const pointsEl = document.getElementById("points");
  if (pointsEl) pointsEl.textContent = me.points;
});

// --- Cooldown started ---
socket.on("cooldown_started", ({ wait }) => {
  const overlay = document.getElementById("cooldown-overlay");
  if (!overlay) return;
  overlay.style.display = "flex";
  overlay.textContent = wait;

  let remaining = wait;
  const interval = setInterval(() => {
    remaining--;
    overlay.textContent = remaining;
    if (remaining <= 0) {
      clearInterval(interval);
      overlay.style.display = "none";
      overlay.textContent = "";
      // Ask server for refreshed points
      socket.emit("whoami");
    }
  }, 1000);
});

// --- Place pixel ---
function socketEmitPlace(x, y, color) {
  if (!me.username) {
    alert("Please log in first!");
    return;
  }
  socket.emit("drawPixel", { x, y, color });
}

// Optional: handle place failures
socket.on("place_failed", (data) => {
  if (data.reason === "not_logged_in") {
    alert("Please log in first!");
  } else if (data.reason === "cooldown") {
    const wait = data.wait || 20;
    const overlay = document.getElementById("cooldown-overlay");
    if (overlay) {
      overlay.style.display = "flex";
      overlay.textContent = wait;
      let remaining = wait;
      const interval = setInterval(() => {
        remaining--;
        overlay.textContent = remaining;
        if (remaining <= 0) {
          clearInterval(interval);
          overlay.style.display = "none";
          overlay.textContent = "";
          socket.emit("whoami");
        }
      }, 1000);
    }
  }
});

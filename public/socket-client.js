// public/socket-client.js
const socket = io();

// NOTE: 'pixels' Map, drawAll(), drawPixel(), cameraX/scale etc.
// are defined in your existing script.js. We expect script.js to exist and remain unchanged.
// socket-client will integrate with that existing logic.

let me = { username: null, points: 10, cooldownUntil: 0 };
let cooldownTimerId = null;

socket.on("connect", () => {
  // ask server for status if logged in locally
  const localUser = localStorage.getItem("pp_username");
  if (localUser) {
    socket.emit("login", localUser);
  }
  socket.emit("whoami");
});

// receive full canvas
socket.on("init", (pixelsObj) => {
  // replace client pixels Map
  if (typeof pixels !== "undefined" && pixels instanceof Map) {
    pixels.clear();
    Object.entries(pixelsObj).forEach(([k, color]) => pixels.set(k, color));
    if (typeof drawAll === "function") drawAll();
  }
});

// new pixel from anyone
socket.on("pixel", ({ x, y, color }) => {
  if (typeof pixels !== "undefined" && pixels instanceof Map) {
    pixels.set(`${x},${y}`, color);
    if (typeof drawSingle === "function") {
      // optional: if you implement drawSingle to draw one pixel
      drawSingle(x, y, color);
    } else if (typeof drawAll === "function") {
      drawAll();
    }
  }
});

// login results
socket.on("login_success", (payload) => {
  me.username = payload.username || payload;
  me.points = payload.points || me.points;
  localStorage.setItem("pp_username", me.username);
  // update UI: points element
  const ptsEl = document.getElementById("points");
  if (ptsEl) ptsEl.textContent = me.points;
  // change login button text if present
  const loginBtn = document.getElementById("login-btn");
  if (loginBtn) {
    loginBtn.textContent = me.username;
    loginBtn.disabled = true;
  }
  console.log("Logged in as", me.username);
});

socket.on("login_failed", (reason) => {
  alert("Login failed: " + (reason || ""));
});

// points and cooldown messages
socket.on("points_update", (data) => {
  me.points = data.points ?? data;
  const ptsEl = document.getElementById("points");
  if (ptsEl) ptsEl.textContent = me.points;
});

socket.on("cooldown_started", ({ wait }) => {
  startLocalCooldown(wait || 20);
});

socket.on("place_failed", (data) => {
  if (data && data.reason === "not_logged_in") {
    alert("Please log in first.");
  } else if (data && data.reason === "cooldown") {
    startLocalCooldown(data.wait || 20);
  } else {
    // console.log("place failed", data);
  }
});

function startLocalCooldown(seconds) {
  const overlay = document.getElementById("cooldown-overlay");
  const ptsEl = document.getElementById("points");
  if (overlay) overlay.style.display = "flex";
  let remaining = seconds;
  if (ptsEl) ptsEl.textContent = remaining;
  if (cooldownTimerId) clearInterval(cooldownTimerId);
  cooldownTimerId = setInterval(() => {
    remaining--;
    if (ptsEl) ptsEl.textContent = remaining;
    if (overlay) overlay.textContent = remaining;
    if (remaining <= 0) {
      clearInterval(cooldownTimerId);
      cooldownTimerId = null;
      if (overlay) {
        overlay.style.display = "none";
        overlay.textContent = "";
      }
      // ask server for refreshed points
      socket.emit("whoami");
    }
  }, 1000);
}

// Expose function the drawing code should use to place pixels:
// Replace client-side direct placing with: socketEmitPlace(x,y,color)
function socketEmitPlace(x, y, color) {
  socket.emit("place_pixel", { x, y, color });
}

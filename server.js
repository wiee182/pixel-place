// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs-extra");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const USERS_FILE = path.join(__dirname, "users.json");
const PIXELS_FILE = path.join(__dirname, "pixels.json");

const CANVAS_SIZE = 1000;
const STARTING_POINTS = 10;
const COOLDOWN_MS = 20_000;

// ensure files exist
fs.ensureFileSync(USERS_FILE);
fs.ensureFileSync(PIXELS_FILE);

// load users and pixels
let usersDb = [];
try { usersDb = fs.readJsonSync(USERS_FILE); } catch(_) { usersDb = []; fs.writeJsonSync(USERS_FILE, usersDb); }
let pixelsObj = {};
try { pixelsObj = fs.readJsonSync(PIXELS_FILE); } catch(_) { pixelsObj = {}; fs.writeJsonSync(PIXELS_FILE, pixelsObj); }

app.use(express.json());
app.use(express.static(PUBLIC_DIR));

// --- HTTP API for register/login (username-only) ---
app.post("/api/register", (req, res) => {
  const username = String(req.body.username || "").trim().slice(0, 32);
  if (!username) return res.status(400).json({ ok:false, error: "invalid_username" });
  if (usersDb.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(409).json({ ok:false, error: "username_taken" });
  }
  const newUser = { username, createdAt: new Date().toISOString() };
  usersDb.push(newUser);
  fs.writeJsonSync(USERS_FILE, usersDb, { spaces: 2 });
  return res.json({ ok:true, username });
});

app.post("/api/login", (req, res) => {
  const username = String(req.body.username || "").trim().slice(0, 32);
  if (!username) return res.status(400).json({ ok:false, error: "invalid_username" });
  const found = usersDb.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!found) return res.status(404).json({ ok:false, error: "user_not_found" });
  return res.json({ ok:true, username: found.username });
});

// serve index and other static files from /public by default

// --- Socket.io realtime ---
/*
Per-socket state:
  socket.user = { username, points, cooldownUntil }
*/
const pixels = new Map(Object.entries(pixelsObj)); // Map("x,y" -> color)
const socketsState = new Map();

function now() { return Date.now(); }
function validatePlacement(x,y,color){
  if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
  if (x < 0 || y < 0 || x >= CANVAS_SIZE || y >= CANVAS_SIZE) return false;
  if (typeof color !== "string") return false;
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) return false;
  return true;
}

io.on("connection", (socket) => {
  // init per-socket state
  socketsState.set(socket.id, { username: null, points: STARTING_POINTS, cooldownUntil: 0 });
  console.log("connect:", socket.id);

  // send full canvas as object
  socket.emit("init", Object.fromEntries(pixels));

  // login via socket (client will call after successful HTTP login)
  socket.on("login", (username) => {
    if (!username) return socket.emit("login_failed", "invalid");
    const record = usersDb.find(u => u.username.toLowerCase() === String(username).toLowerCase());
    if (!record) return socket.emit("login_failed", "not_found");
    const st = socketsState.get(socket.id) || {};
    st.username = record.username;
    st.points = STARTING_POINTS;
    st.cooldownUntil = 0;
    socketsState.set(socket.id, st);
    socket.emit("login_success", { username: st.username, points: st.points });
    console.log(`socket ${socket.id} logged as ${st.username}`);
  });

  // place pixel
  socket.on("place_pixel", (payload) => {
    try {
      const st = socketsState.get(socket.id);
      if (!st || !st.username) {
        return socket.emit("place_failed", { reason: "not_logged_in" });
      }
      const nowTs = now();
      if (st.cooldownUntil && nowTs < st.cooldownUntil) {
        return socket.emit("place_failed", { reason: "cooldown", wait: Math.ceil((st.cooldownUntil - nowTs)/1000) });
      }
      if (!payload || typeof payload !== "object") return socket.emit("place_failed", "invalid");
      const x = Number(payload.x);
      const y = Number(payload.y);
      const color = String(payload.color || "").trim();
      if (!validatePlacement(x,y,color)) return socket.emit("place_failed", "invalid_pixel");

      // enforce points
      if (st.points <= 0) {
        st.cooldownUntil = nowTs + COOLDOWN_MS;
        socketsState.set(socket.id, st);
        socket.emit("place_failed", { reason: "cooldown_started", wait: Math.ceil(COOLDOWN_MS/1000) });
        return;
      }

      // apply placement
      const key = `${x},${y}`;
      pixels.set(key, color);
      // persist simple (async write)
      fs.writeJson(PIXELS_FILE, Object.fromEntries(pixels)).catch(err => console.error("save err", err));

      // decrement points; if hitting zero, start cooldown
      st.points = Math.max(0, st.points - 1);
      if (st.points === 0) {
        st.cooldownUntil = nowTs + COOLDOWN_MS;
        socket.emit("cooldown_started", { wait: Math.ceil(COOLDOWN_MS/1000) });
      }
      socketsState.set(socket.id, st);

      // broadcast pixel to all
      io.emit("pixel", { x, y, color, placedBy: st.username });

      // send updated points to the placing socket
      socket.emit("points_update", { points: st.points });

    } catch (err){
      console.error("place error", err);
      socket.emit("place_failed", "server_error");
    }
  });

  // client asks current status
  socket.on("whoami", () => {
    const st = socketsState.get(socket.id) || {};
    socket.emit("whoami", { username: st.username, points: st.points, cooldownUntil: st.cooldownUntil });
  });

  socket.on("disconnect", () => {
    socketsState.delete(socket.id);
    console.log("disconnect:", socket.id);
  });
});

// graceful save on exit
process.on("SIGINT", async () => {
  console.log("Saving pixels and exiting...");
  await fs.writeJson(PIXELS_FILE, Object.fromEntries(pixels));
  process.exit();
});

server.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));

// ====== Config ======
const GRID_SIZE = 10;
const WORLD_W = 5000, WORLD_H = 5000;

// ====== Elements ======
const canvas = document.getElementById("pixelCanvas");
const ctx = canvas.getContext("2d", { alpha: false });

const paletteDiv = document.getElementById("palette");
const extraPalette = document.getElementById("extra-palette");
const colorBtn = document.getElementById("color-popup-btn");
const colorPopup = document.getElementById("color-popup");
const pointsDisplay = document.getElementById("points-display");

const chatPopup = document.getElementById("chat-popup");
const chatHeader = document.getElementById("chat-header");
const chatFeed = document.getElementById("chat-feed");
const chatInput = document.getElementById("chat-message");
const sendBtn = document.getElementById("send-message");

const toggleGridBtn = document.getElementById("toggle-grid");
const toggleSoundBtn = document.getElementById("toggle-sound");

// ====== State ======
let scale = 1, offsetX = 0, offsetY = 0;
let isDragging = false, dragStartX = 0, dragStartY = 0;
let lastTouchDist = null;
let currentColor = "#fffefe";
let showGrid = true;
let soundOn = true;
let myPoints = 6;
const chunks = new Map(); // key -> [{x,y,color},...]

// ====== Audio ======
const drawAudio = new Audio('sounds/draw.mp3'); drawAudio.volume = 0.25;
function playSound(src) {
  if (!soundOn) return;
  try { src.cloneNode().play(); } catch(e) {}
}

// ====== WebSocket (same-origin) ======
const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
ws.addEventListener('message', ev => {
  try {
    const data = JSON.parse(ev.data);
    if (data.type === 'init') {
      // load chat
      (data.chat || []).forEach(m => addChatMessage(m.text));
      // load chunks (array of [key, pixels])
      (data.chunks || []).forEach(([k, arr]) => chunks.set(k, arr));
      drawAll();
    } else if (data.type === 'draw') {
      addPixelToChunks(data.x, data.y, data.color);
      drawAll();
    } else if (data.type === 'chat') {
      addChatMessage(data.text);
    } else if (data.type === 'points') {
      myPoints = data.points; updatePointsDisplay();
    }
  } catch (e) {
    console.warn('ws parse', e);
  }
});

// ====== Resize & init ======
function resizeCanvas() {
  canvas.width = canvas.clientWidth = canvas.parentElement.clientWidth;
  canvas.height = canvas.clientHeight = canvas.parentElement.clientHeight;
  // center world
  offsetX = (canvas.width - WORLD_W) / 2;
  offsetY = (canvas.height - WORLD_H) / 2;
  drawAll();
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ====== Drawing loop ======
function clearScreenBlack() {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawAll() {
  clearScreenBlack();
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // white world block with fixed subtle shadow (shadow done outside to avoid scaling)
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // pixels
  chunks.forEach(arr => {
    arr.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, GRID_SIZE, GRID_SIZE);
    });
  });

  // grid lines
  if (showGrid) {
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 1 / Math.max(scale, 0.01);
    for (let x = 0; x <= WORLD_W; x += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, WORLD_H); ctx.stroke();
    }
    for (let y = 0; y <= WORLD_H; y += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(WORLD_W, y + 0.5); ctx.stroke();
    }
  }

  ctx.restore();

  // subtle outer glow for the white block so it pops (draw on top, unscaled)
  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';
  // (we already have black background, glow effect is subtle and fixed in CSS for canvas shadow)
  ctx.restore();
}

// ====== Helpers: pixel storage ======
function chunkKeyFor(x,y){ return `${Math.floor(x/100)},${Math.floor(y/100)}`; }
function addPixelToChunks(x,y,color){
  const key = chunkKeyFor(x,y);
  if (!chunks.has(key)) chunks.set(key, []);
  const arr = chunks.get(key);
  const idx = arr.findIndex(p=>p.x===x && p.y===y);
  const item = { x, y, color };
  if (idx >= 0) arr[idx] = item; else arr.push(item);
}

// ====== Input math ======
function screenToWorld(screenX, screenY) {
  const rect = canvas.getBoundingClientRect();
  const sx = screenX - rect.left;
  const sy = screenY - rect.top;
  const wx = (sx - offsetX) / scale;
  const wy = (sy - offsetY) / scale;
  return { wx, wy };
}

// ====== Mouse events (desktop) ======
canvas.addEventListener('mousedown', (e) => {
  isDragging = true;
  dragStartX = e.clientX - offsetX;
  dragStartY = e.clientY - offsetY;
});
window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  offsetX = e.clientX - dragStartX;
  offsetY = e.clientY - dragStartY;
  drawAll();
});
window.addEventListener('mouseup', () => { isDragging = false; });

// click to draw (only if not dragging)
canvas.addEventListener('click', (e) => {
  // ignore clicks that were part of dragging
  if (Math.abs(e.movementX) > 6 || Math.abs(e.movementY) > 6) return;
  const { wx, wy } = screenToWorld(e.clientX, e.clientY);
  const gx = Math.floor(wx / GRID_SIZE) * GRID_SIZE;
  const gy = Math.floor(wy / GRID_SIZE) * GRID_SIZE;
  if (gx < 0 || gy < 0 || gx >= WORLD_W || gy >= WORLD_H) return;
  // send draw
  ws.send(JSON.stringify({ type: 'draw', x: gx, y: gy, color: currentColor }));
  playSound(drawAudio);
});

// wheel zoom (desktop)
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left - offsetX) / scale;
  const my = (e.clientY - rect.top - offsetY) / scale;
  const delta = e.deltaY < 0 ? 1.12 : 0.9;
  const newScale = Math.min(Math.max(0.12, scale * delta), 5);
  offsetX -= (mx * (newScale - scale));
  offsetY -= (my * (newScale - scale));
  scale = newScale;
  drawAll();
}, { passive: false });

// ====== Touch events (mobile): pan, draw (tap), pinch-to-zoom ======
let touchIsDrag = false;
let touchStartX = 0, touchStartY = 0;

canvas.addEventListener('touchstart', (ev) => {
  if (ev.touches.length === 1) {
    touchIsDrag = false;
    const t = ev.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
  } else if (ev.touches.length === 2) {
    lastTouchDist = getTouchDist(ev);
  }
}, { passive: false });

canvas.addEventListener('touchmove', (ev) => {
  if (ev.touches.length === 1) {
    const t = ev.touches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    if (Math.hypot(dx, dy) > 6) {
      touchIsDrag = true;
      offsetX += dx;
      offsetY += dy;
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      drawAll();
    }
    ev.preventDefault();
  } else if (ev.touches.length === 2) {
    // pinch zoom
    const newDist = getTouchDist(ev);
    if (lastTouchDist && newDist > 0) {
      const rect = canvas.getBoundingClientRect();
      const mid = getTouchMidpoint(ev);
      const mx = (mid.x - rect.left - offsetX) / scale;
      const my = (mid.y - rect.top - offsetY) / scale;
      const zoom = newDist / lastTouchDist;
      const newScale = Math.min(Math.max(0.12, scale * zoom), 5);
      offsetX -= mx * (newScale - scale);
      offsetY -= my * (newScale - scale);
      scale = newScale;
      drawAll();
    }
    lastTouchDist = newDist;
    ev.preventDefault();
  }
}, { passive: false });

canvas.addEventListener('touchend', (ev) => {
  if (ev.touches.length === 0) {
    // if not drag, treat as tap -> draw
    if (!touchIsDrag) {
      // use last known touch position (from changedTouches)
      const t = ev.changedTouches[0];
      const { wx, wy } = screenToWorld(t.clientX, t.clientY);
      const gx = Math.floor(wx / GRID_SIZE) * GRID_SIZE;
      const gy = Math.floor(wy / GRID_SIZE) * GRID_SIZE;
      if (gx >= 0 && gy >= 0 && gx < WORLD_W && gy < WORLD_H) {
        ws.send(JSON.stringify({ type: 'draw', x: gx, y: gy, color: currentColor }));
        playSound(drawAudio);
      }
    }
    lastTouchDist = null;
  } else {
    lastTouchDist = getTouchDist(ev);
  }
}, { passive: false });

function getTouchDist(ev){
  if (!ev.touches || ev.touches.length < 2) return null;
  const a = ev.touches[0], b = ev.touches[1];
  const dx = a.clientX - b.clientX, dy = a.clientY - b.clientY;
  return Math.hypot(dx,dy);
}
function getTouchMidpoint(ev){
  const a = ev.touches[0], b = ev.touches[1];
  return { x: (a.clientX + b.clientX)/2, y: (a.clientY + b.clientY)/2 };
}

// ====== UI: palette + extra colors ======
const baseColors = ["#fffefe","#b9c2ce","#767e8c","#424651","#1e1f26","#010100"];
const extraColors = ["#ff2b2b","#00e54f","#0053ff","#ffd400","#ff2bf2","#00e9ff","#ff8b00","#7c1aff","#8a8b00","#1fb0a3","#ff6b6b","#8b7fff"];

function makeSwatch(color, container, autoClose=false) {
  const el = document.createElement('div');
  el.className = 'color-swatch';
  el.style.background = color;
  el.addEventListener('click', () => {
    currentColor = color;
    // mark selected in main palette
    document.querySelectorAll('#palette .color-swatch').forEach(n=>n.classList.remove('selected'));
    el.classList.add('selected');
    if (autoClose) hideColorPopup();
  });
  container.appendChild(el);
  return el;
}

// main palette
baseColors.forEach(c => makeSwatch(c, paletteDiv));

// extra palette
extraColors.forEach(c => makeSwatch(c, extraPalette, true));

function showColorPopup(){
  colorPopup.classList.remove('hidden');
  colorPopup.setAttribute('aria-hidden','false');
  positionColorPopup();
}
function hideColorPopup(){
  colorPopup.classList.add('hidden');
  colorPopup.setAttribute('aria-hidden','true');
}
function positionColorPopup(){
  // anchor popup to bottom-bar center
  const bar = document.getElementById('bottom-bar');
  const rect = bar.getBoundingClientRect();
  colorPopup.style.left = (rect.left + rect.width/2) + 'px';
  // ensure popup width fits on mobile
  if (window.innerWidth < 420) colorPopup.style.left = (window.innerWidth/2) + 'px';
}

colorBtn.addEventListener('click', () => {
  if (colorPopup.classList.contains('hidden')) showColorPopup(); else hideColorPopup();
});
window.addEventListener('resize', positionColorPopup);

// ====== Chat behavior ======
// header clickable (full header) toggles minimize; center title
function setChatInitialState(){
  if (window.innerWidth <= 560) chatPopup.classList.add('minimized');
  else chatPopup.classList.remove('minimized');
}
setChatInitialState();
window.addEventListener('resize', setChatInitialState);

chatHeader.addEventListener('click', () => {
  chatPopup.classList.toggle('minimized');
});

sendBtn.addEventListener('click', sendChatFromInput);
chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { sendChatFromInput(); e.preventDefault(); }
});
function sendChatFromInput(){
  const txt = chatInput.value.trim();
  if (!txt) return;
  ws.send(JSON.stringify({ type: 'chat', text: txt }));
  chatInput.value = '';
}

// add received chat
function addChatMessage(text){
  const el = document.createElement('div');
  el.className = 'chat-msg';
  el.textContent = text;
  chatFeed.appendChild(el);
  chatFeed.scrollTop = chatFeed.scrollHeight;
}

// ====== Points & toggles ======
function updatePointsDisplay(){ pointsDisplay.textContent = `${myPoints}/6`; }
toggleGridBtn.addEventListener('click', () => { showGrid = !showGrid; drawAll(); });
toggleSoundBtn.addEventListener('click', () => { soundOn = !soundOn; toggleSoundBtn.textContent = soundOn ? '🔊' : '🔈'; });

// initial text
toggleSoundBtn.textContent = soundOn ? '🔊' : '🔈';
updatePointsDisplay();

// ====== Helpers & initial draw ======
drawAll();
positionColorPopup();

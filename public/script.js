/* global window, document, fetch, WebSocket */
/* Main frontend logic: drawing, pan/zoom, palette, chat, simple 20s cooldown (1/1) */

// CONFIG
const GRID = 10;
const WORLD_W = 5000, WORLD_H = 5000;
const COOLDOWN_MS = 20000; // 20s

// ELEMENTS
const canvas = document.getElementById('pixelCanvas');
const ctx = canvas.getContext('2d');

const paletteEl = document.getElementById('palette');
const moreBtn = document.getElementById('more-colors-btn');
const morePopup = document.getElementById('more-colors');
const morePaletteEl = document.getElementById('more-palette');
const pointsDisplay = document.getElementById('points-display');

const toggleGridBtn = document.getElementById('toggle-grid');
const toggleSoundBtn = document.getElementById('toggle-sound');

const chatPopup = document.getElementById('chat-popup');
const chatHeader = document.getElementById('chat-header');
const chatFeed = document.getElementById('chat-feed');
const chatInput = document.getElementById('chat-message');
const sendBtn = document.getElementById('send-message');

let scale = 1, offsetX = 0, offsetY = 0;
let isDragging = false, dragStartX = 0, dragStartY = 0;
let lastTouchDist = null;
let currentColor = '#fffefe';
let showGrid = true;
let soundOn = true;
let canPlace = true; // cooldown state

// in-memory pixel chunks (key -> [{x,y,color},...])
const chunks = new Map();

// audio
const drawAudio = new Audio('sounds/draw.mp3'); drawAudio.volume = 0.22;
function playDraw() { if (!soundOn) return; try { drawAudio.cloneNode().play(); } catch(e){} }

// WebSocket (same-origin)
const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
ws.addEventListener('open', ()=> console.log('ws open'));
ws.addEventListener('message', (ev) => {
  try {
    const data = JSON.parse(ev.data);
    if (data.type === 'init') {
      // accept either pixels or chunks
      if (Array.isArray(data.pixels)) {
        data.pixels.forEach(p => addPixelToChunks(p.x,p.y,p.color));
      } else if (Array.isArray(data.chunks)) {
        data.chunks.forEach(([k, arr]) => chunks.set(k, arr));
      }
      (data.chat || []).forEach(m => addChatMessage(m.text));
      drawAll();
    } else if (data.type === 'draw') {
      addPixelToChunks(data.x, data.y, data.color);
      drawAll();
    } else if (data.type === 'chat') {
      addChatMessage(data.text);
    } else if (data.type === 'points') {
      // server-side points (optional) - not required for simple client cooldown
      // we could show server points if provided
    }
  } catch(e) { console.warn('ws parse err', e); }
});

// Resize canvas & center world
function resize() {
  canvas.width = canvas.clientWidth = canvas.parentElement.clientWidth;
  canvas.height = canvas.clientHeight = canvas.parentElement.clientHeight;
  offsetX = (canvas.width - WORLD_W) / 2;
  offsetY = (canvas.height - WORLD_H) / 2;
  drawAll();
}
window.addEventListener('resize', resize);
resize();

// draw everything: black background + white world block + pixels + grid
function drawAll(){
  // black full-screen
  ctx.fillStyle = '#000';
  ctx.fillRect(0,0,canvas.width,canvas.height);

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // white world block (finite)
  ctx.fillStyle = '#fff';
  ctx.fillRect(0,0,WORLD_W,WORLD_H);

  // pixels
  chunks.forEach(arr => {
    arr.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, GRID, GRID);
    });
  });

  // grid lines (subtle, darker on white)
  if (showGrid) {
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1 / Math.max(scale, 0.01);
    for (let x=0;x<=WORLD_W;x+=GRID) {
      ctx.beginPath(); ctx.moveTo(x+0.5,0); ctx.lineTo(x+0.5,WORLD_H); ctx.stroke();
    }
    for (let y=0;y<=WORLD_H;y+=GRID) {
      ctx.beginPath(); ctx.moveTo(0,y+0.5); ctx.lineTo(WORLD_W,y+0.5); ctx.stroke();
    }
  }

  ctx.restore();
}

// pixel storage helper
function chunkKey(x,y){ return `${Math.floor(x/100)},${Math.floor(y/100)}`; }
function addPixelToChunks(x,y,color){
  const k = chunkKey(x,y);
  if (!chunks.has(k)) chunks.set(k, []);
  const arr = chunks.get(k);
  const idx = arr.findIndex(p=>p.x===x && p.y===y);
  const item = { x, y, color };
  if (idx>=0) arr[idx] = item; else arr.push(item);
}

// input helpers
function screenToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const sx = clientX - rect.left;
  const sy = clientY - rect.top;
  const wx = (sx - offsetX) / scale;
  const wy = (sy - offsetY) / scale;
  return { wx, wy };
}

// mouse events (desktop)
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
window.addEventListener('mouseup', ()=> { isDragging = false; });

// click to place (only if not a drag)
canvas.addEventListener('click', (e) => {
  // small movement => click, else was a drag
  if (Math.abs(e.movementX) > 6 || Math.abs(e.movementY) > 6) return;
  const { wx, wy } = screenToWorld(e.clientX, e.clientY);
  const gx = Math.floor(wx / GRID) * GRID;
  const gy = Math.floor(wy / GRID) * GRID;
  if (gx < 0 || gy < 0 || gx >= WORLD_W || gy >= WORLD_H) return;
  attemptPlace(gx, gy);
});

// wheel zoom (desktop)
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left - offsetX) / scale;
  const my = (e.clientY - rect.top - offsetY) / scale;
  const zoom = e.deltaY < 0 ? 1.12 : 0.9;
  const newScale = Math.min(Math.max(0.12, scale * zoom), 5);
  offsetX -= (mx * (newScale - scale));
  offsetY -= (my * (newScale - scale));
  scale = newScale;
  drawAll();
}, { passive: false });

// touch handlers (mobile): pan, tap to draw, pinch-to-zoom
let touchIsDrag = false, touchStartX=0, touchStartY=0;
canvas.addEventListener('touchstart', (ev) => {
  if (ev.touches.length === 1) {
    touchIsDrag = false;
    const t = ev.touches[0];
    touchStartX = t.clientX; touchStartY = t.clientY;
  } else if (ev.touches.length === 2) {
    lastTouchDist = getTouchDist(ev);
  }
}, { passive: false });

canvas.addEventListener('touchmove', (ev) => {
  if (ev.touches.length === 1) {
    const t = ev.touches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    if (Math.hypot(dx,dy) > 6) {
      touchIsDrag = true;
      offsetX += dx;
      offsetY += dy;
      touchStartX = t.clientX; touchStartY = t.clientY;
      drawAll();
    }
    ev.preventDefault();
  } else if (ev.touches.length === 2) {
    const newDist = getTouchDist(ev);
    if (lastTouchDist && newDist > 0) {
      const mid = getTouchMid(ev);
      const rect = canvas.getBoundingClientRect();
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
    if (!touchIsDrag) {
      const t = ev.changedTouches[0];
      const { wx, wy } = screenToWorld(t.clientX, t.clientY);
      const gx = Math.floor(wx / GRID) * GRID;
      const gy = Math.floor(wy / GRID) * GRID;
      if (gx >=0 && gy >=0 && gx < WORLD_W && gy < WORLD_H) attemptPlace(gx, gy);
    }
    lastTouchDist = null;
  } else {
    lastTouchDist = getTouchDist(ev);
  }
}, { passive: false });

function getTouchDist(ev){
  if (!ev.touches || ev.touches.length < 2) return null;
  const a = ev.touches[0], b = ev.touches[1];
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}
function getTouchMid(ev){
  const a = ev.touches[0], b = ev.touches[1];
  return { x: (a.clientX + b.clientX)/2, y: (a.clientY + b.clientY)/2 };
}

// attempt to place pixel: respects local cooldown and notifies server
function attemptPlace(x,y){
  if (!canPlace) return; // on cooldown
  // mark cooldown immediately
  canPlace = false;
  updatePointsUI();
  // send to server
  const msg = { type:'draw', x, y, color: currentColor };
  try { ws.send(JSON.stringify(msg)); } catch(e) {}
  // apply locally instantly for responsiveness
  addPixelToChunks(x,y,currentColor);
  drawAll();
  playDraw();

  // start 20s cooldown
  setTimeout(() => {
    canPlace = true;
    updatePointsUI();
  }, COOLDOWN_MS);
}

// update points UI (1/1 or 0/1)
function updatePointsUI(){
  pointsDisplay.textContent = canPlace ? '1/1' : '0/1';
  pointsDisplay.style.color = canPlace ? '#0f0' : '#ff6b6b';
}
updatePointsUI();

// palette setup (main small palette)
const baseColors = ['#fffefe','#b9c2ce','#767e8c','#424651','#1e1f26','#010100'];
baseColors.forEach((c,i) => {
  const el = document.createElement('div');
  el.className = 'color-swatch';
  el.style.background = c;
  el.title = `${i}`;
  el.dataset.index = i;
  el.dataset.color = c;
  el.addEventListener('click', ()=> {
    currentColor = c;
    document.querySelectorAll('#palette .color-swatch').forEach(n=>n.classList.remove('selected'));
    el.classList.add('selected');
  });
  paletteEl.appendChild(el);
});
// default select first swatch
const first = paletteEl.querySelector('.color-swatch');
if (first) first.classList.add('selected');

// more colors popup (numbered)
const extraColors = [
  '#ff2b2b','#ff6b6b','#ff8b00','#ffd400','#fff07a','#8cff66',
  '#00e54f','#00e9ff','#0066ff','#6b6bff','#b46bff','#ff6bf2',
  '#ff4fa8','#c55','#7c1aff','#008080','#80ffdf','#d4b68f'
];
function buildMorePalette(){
  morePaletteEl.innerHTML = '';
  extraColors.forEach((c, idx) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'more-item';
    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    thumb.style.background = c;
    thumb.dataset.color = c;
    thumb.addEventListener('click', () => {
      currentColor = c;
      // highlight in main palette: remove selection from base, but visually add border to this thumb
      document.querySelectorAll('#palette .color-swatch').forEach(n=>n.classList.remove('selected'));
      // give a quick selection highlight on chosen thumb (no permanent)
      thumb.style.outline = '3px solid rgba(255,255,255,0.12)';
      setTimeout(()=> thumb.style.outline = '', 300);
      hideMore();
    });
    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = idx + 1; // numbered
    wrapper.appendChild(thumb);
    wrapper.appendChild(label);
    morePaletteEl.appendChild(wrapper);
  });
}
buildMorePalette();

function showMore(){
  morePopup.classList.remove('hidden');
  morePopup.setAttribute('aria-hidden','false');
  positionMore();
}
function hideMore(){
  morePopup.classList.add('hidden');
  morePopup.setAttribute('aria-hidden','true');
}
moreBtn.addEventListener('click', () => {
  if (morePopup.classList.contains('hidden')) showMore(); else hideMore();
});
window.addEventListener('resize', positionMore);

// anchor popup above bottom bar center
function positionMore(){
  const bar = document.getElementById('bottom-bar');
  const rect = bar.getBoundingClientRect();
  const left = rect.left + rect.width/2;
  morePopup.style.left = `${left}px`;
  // ensure mobile center
  if (window.innerWidth < 420) morePopup.style.left = `${window.innerWidth/2}px`;
}

// grid & sound buttons
toggleGridBtn.addEventListener('click', ()=> { showGrid = !showGrid; drawAll(); });
toggleSoundBtn.addEventListener('click', ()=> { soundOn = !soundOn; toggleSoundBtn.textContent = soundOn ? '🔊' : '🔈'; });

// chat behavior (header whole clickable)
function setChatInit(){
  if (window.innerWidth <= 560) chatPopup.classList.add('minimized');
  else chatPopup.classList.remove('minimized');
}
setChatInit();
window.addEventListener('resize', setChatInit);

chatHeader.addEventListener('click', ()=> {
  chatPopup.classList.toggle('minimized');
});

// chat send over ws
sendBtn.addEventListener('click', sendChat);
chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') { sendChat(); e.preventDefault(); } });

function sendChat(){
  const txt = chatInput.value.trim();
  if (!txt) return;
  try { ws.send(JSON.stringify({ type:'chat', text: txt })); } catch(e){}
  chatInput.value = '';
}

// show messages (spaced)
function addChatMessage(text){
  const el = document.createElement('div');
  el.className = 'chat-msg';
  el.textContent = text;
  chatFeed.appendChild(el);
  chatFeed.scrollTop = chatFeed.scrollHeight;
}

// helpers for positioning and touch math done earlier
function positionMore() {
  // implemented above; ensure it runs at least once
  const bar = document.getElementById('bottom-bar');
  if (!bar) return;
  const rect = bar.getBoundingClientRect();
  morePopup.style.left = `${rect.left + rect.width/2}px`;
}
positionMore();

// helper: initial draw
drawAll();

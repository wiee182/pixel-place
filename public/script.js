// ===== Canvas Setup =====
const canvas = document.getElementById("pixelCanvas");
const ctx = canvas.getContext("2d");
let scale = 1, offsetX = 0, offsetY = 0;
let isDragging = false, dragStartX = 0, dragStartY = 0;
const GRID_SIZE = 10, WORLD_WIDTH = 5000, WORLD_HEIGHT = 5000;
const chunks = new Map();

// ===== Colors =====
const colors = ["#fffefe","#b9c2ce","#767e8c","#424651","#1e1f26","#010100",
"#ff0000","#00ff00","#0000ff","#ffff00","#ff00ff","#00ffff","#ffa500","#800080",
"#008000","#00ced1","#ff1493","#ffd700","#a52a2a","#808000"];
let currentColor = colors[0];

// ===== Points + Palette =====
const MAX_POINTS = 10;
let points = MAX_POINTS, lastPlaceTime = Date.now(), COOLDOWN = 20000;
const paletteDiv = document.getElementById("palette");
const moreColorsPopup = document.getElementById("more-colors-popup");
const moreBtn = document.getElementById("more-colors");

// Main cube
const mainSwatch = document.createElement("div");
mainSwatch.className = "color-swatch selected";
mainSwatch.style.background = currentColor;
mainSwatch.innerHTML = `<span id="points-display">${points}/${MAX_POINTS}</span>`;
paletteDiv.appendChild(mainSwatch);

// Cooldown cube border
const cooldownRing = document.createElement("div");
cooldownRing.id = "cooldown-ring";
mainSwatch.appendChild(cooldownRing);

// Update points & cooldown ring
function updatePoints(p) {
  points = p;
  mainSwatch.querySelector("#points-display").textContent = `${points}/${MAX_POINTS}`;
  const ratio = points / MAX_POINTS;
  cooldownRing.style.transform = `scale(${1+0.2*(1-ratio)})`;
  cooldownRing.style.opacity = `${0.3+0.7*ratio}`;
}
setInterval(() => { updatePoints(points); }, 50);

// Popup colors
colors.forEach(c=>{
  const sw = document.createElement("div");
  sw.className = "color-swatch";
  sw.style.background = c;
  sw.addEventListener("click", ()=>{
    currentColor = c;
    mainSwatch.style.background = c;
    moreColorsPopup.querySelectorAll(".color-swatch").forEach(s=>s.classList.remove("selected"));
    sw.classList.add("selected");
    moreColorsPopup.classList.remove("show");
  });
  moreColorsPopup.appendChild(sw);
});

// + button toggles popup
moreBtn.addEventListener("click", ()=> {
  moreColorsPopup.classList.toggle("show");
});

// ===== Grid & Sound =====
let showGrid = true, soundEnabled = true;
document.getElementById("toggle-grid").addEventListener("click", ()=>{ showGrid=!showGrid; draw(); });
document.getElementById("toggle-sound").addEventListener("click", ()=>{ soundEnabled=!soundEnabled; });

// ===== Chat =====
const chatBox = document.getElementById("chat-box");
const chatHeader = document.getElementById("chat-header");
const chatFeed = document.getElementById("chat-feed");
const chatInput = document.getElementById("chat-message");
const sendBtn = document.getElementById("send-message");

chatHeader.addEventListener("click", ()=>{
  chatBox.classList.toggle("minimized");
});

sendBtn.addEventListener("click", sendMessage);
chatInput.addEventListener("keydown", e=>{
  if(e.key==="Enter"){ sendMessage(); e.preventDefault(); }
});
function sendMessage(){
  const msg = chatInput.value.trim();
  if(!msg) return;
  const div = document.createElement("div");
  div.className="chat-msg";
  div.textContent = `You: ${msg}`;
  chatFeed.appendChild(div);
  chatFeed.scrollTop = chatFeed.scrollHeight;
  chatInput.value="";
}

// ===== Canvas Drawing =====
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  offsetX = (canvas.width-WORLD_WIDTH)/2;
  offsetY = (canvas.height-WORLD_HEIGHT)/2;
}
window.addEventListener("resize", resize);
resize();

canvas.addEventListener("mousedown", e=>{
  isDragging = true;
  dragStartX = e.clientX-offsetX;
  dragStartY = e.clientY-offsetY;
});
canvas.addEventListener("mousemove", e=>{
  if(isDragging){ offsetX=e.clientX-dragStartX; offsetY=e.clientY-dragStartY; draw(); }
});
canvas.addEventListener("mouseup", ()=>isDragging=false);
canvas.addEventListener("mouseleave", ()=>isDragging=false);

canvas.addEventListener("click", e=>{
  if(isDragging || points<=0) return;
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX-rect.left-offsetX)/GRID_SIZE)*GRID_SIZE;
  const y = Math.floor((e.clientY-rect.top-offsetY)/GRID_SIZE)*GRID_SIZE;
  setPixel(x,y,currentColor);
  points--; updatePoints(points);
  if(soundEnabled) document.getElementById("draw-sound").cloneNode().play();
});

// Zoom
canvas.addEventListener("wheel", e=>{
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mx=(e.clientX-rect.left-offsetX)/scale;
  const my=(e.clientY-rect.top-offsetY)/scale;
  const zoom=e.deltaY<0?1.1:0.9;
  const newScale=Math.min(Math.max(0.1,scale*zoom),5);
  offsetX-=(mx*(newScale-scale));
  offsetY-=(my*(newScale-scale));
  scale=newScale;
  draw();
});

// Pixel & Draw
function setPixel(x,y,color){
  const key=`${Math.floor(x/100)},${Math.floor(y/100)}`;
  if(!chunks.has(key)) chunks.set(key,[]);
  const chunk=chunks.get(key);
  const idx=chunk.findIndex(p=>p.x===x && p.y===y);
  if(idx>=0) chunk[idx].color=color; else chunk.push({x,y,color});
  draw();
}

function draw(){
  ctx.fillStyle="#fff";
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.translate(offsetX,offsetY);
  ctx.scale(scale,scale);

  chunks.forEach(chunk=>{ chunk.forEach(p=>{
    ctx.fillStyle=p.color;
    ctx.fillRect(p.x,p.y,GRID_SIZE,GRID_SIZE);
  })});

  if(showGrid){
    ctx.strokeStyle="#ccc";
    ctx.lineWidth=1/scale;
    for(let x=0;x<=WORLD_WIDTH;x+=GRID_SIZE){
      ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,WORLD_HEIGHT);ctx.stroke();
    }
    for(let y=0;y<=WORLD_HEIGHT;y+=GRID_SIZE){
      ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(WORLD_WIDTH,y);ctx.stroke();
    }
  }
  ctx.restore();
}
requestAnimationFrame(function loop(){ draw(); requestAnimationFrame(loop); });

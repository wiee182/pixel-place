// ===== Constants =====
const GRID_SIZE = 10;
const WORLD_WIDTH = 5000, WORLD_HEIGHT = 5000;

// ===== Canvas Setup =====
const canvas = document.getElementById("pixelCanvas");
const ctx = canvas.getContext("2d");

let scale = 1, offsetX = 0, offsetY = 0;
let isDragging = false, dragStartX=0, dragStartY=0;
let currentColor = "#fffefe";
let showGrid = true;
const chunks = new Map();

// ===== Palette =====
const colors = ["#fffefe","#b9c2ce","#767e8c","#424651","#1e1f26","#010100"];
const paletteDiv = document.getElementById("palette");
const moreColorsPopup = document.getElementById("more-colors-popup");
const moreBtn = document.getElementById("more-colors");

// ===== Points =====
let userPoints = 6;
let nextPointTime = null;
const pointsDisplay = document.getElementById("points-display");
const progressRing = document.querySelector(".progress-ring__progress");
const RADIUS = 22, CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// ===== Sound =====
let soundEnabled = true;
const drawAudio = new Audio("sounds/draw.mp3"); drawAudio.volume=0.2;
function playSound(a){ if(soundEnabled) a.cloneNode().play(); }

// ===== Chat =====
const chatPopup = document.getElementById("chat-popup");
const chatToggle = document.getElementById("chat-toggle");
const chatFeed = document.getElementById("chat-feed");
const chatInput = document.getElementById("chat-message");
const sendBtn = document.getElementById("send-message");

// ===== Resize =====
function resizeCanvas(){
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// ===== Draw =====
function drawGrid(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  chunks.forEach(chunk=>{
    chunk.forEach(p=>{
      ctx.fillStyle=p.color;
      ctx.fillRect(p.x,p.y,GRID_SIZE,GRID_SIZE);
    });
  });

  if(showGrid){
    ctx.strokeStyle="#000"; ctx.lineWidth=1/scale;
    for(let x=0;x<=WORLD_WIDTH;x+=GRID_SIZE){
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,WORLD_HEIGHT); ctx.stroke();
    }
    for(let y=0;y<=WORLD_HEIGHT;y+=GRID_SIZE){
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(WORLD_WIDTH,y); ctx.stroke();
    }
  }
  ctx.restore();
}

// ===== Palette =====
colors.forEach((c,i)=>{
  const sw=document.createElement("div");
  sw.className="color-swatch"; sw.style.background=c;
  sw.dataset.color=c; sw.textContent=i;
  sw.addEventListener("click",()=>{
    document.querySelectorAll(".color-swatch").forEach(s=>s.classList.remove("selected"));
    sw.classList.add("selected"); currentColor=c;
  });
  paletteDiv.appendChild(sw);
});
document.querySelector(".color-swatch").classList.add("selected");
moreBtn.addEventListener("click",()=>moreColorsPopup.classList.toggle("hidden"));

// ===== UI Toggles =====
document.getElementById("toggle-grid").addEventListener("click",()=>{showGrid=!showGrid;});
document.getElementById("toggle-sound").addEventListener("click",()=>{soundEnabled=!soundEnabled;});

// ===== Points UI =====
function updatePointsUI(points, nextCooldown=null){
  userPoints = points;
  pointsDisplay.textContent = `${userPoints}/6`;

  // Ring color
  if(points === 6) progressRing.style.stroke="#0f0";
  else if(points > 0) progressRing.style.stroke="#ff0";
  else progressRing.style.stroke="#f00";

  if(nextCooldown) nextPointTime = Date.now()+nextCooldown;
  else nextPointTime=null;
}
function updateProgressRing(){
  if(!nextPointTime){progressRing.style.strokeDashoffset=CIRCUMFERENCE; return;}
  const remaining = nextPointTime-Date.now();
  if(remaining<=0){progressRing.style.strokeDashoffset=CIRCUMFERENCE; return;}
  const percent = (20000-remaining)/20000;
  const offset = CIRCUMFERENCE-percent*CIRCUMFERENCE;
  progressRing.style.strokeDashoffset=offset;
}
setInterval(updateProgressRing,100);

// ===== Mouse =====
canvas.addEventListener("click", e=>{
  if(isDragging || userPoints<=0) return;
  const rect=canvas.getBoundingClientRect();
  const worldX=(e.clientX-rect.left-offsetX)/scale;
  const worldY=(e.clientY-rect.top-offsetY)/scale;
  const x=Math.floor(worldX/GRID_SIZE)*GRID_SIZE;
  const y=Math.floor(worldY/GRID_SIZE)*GRID_SIZE;

  ws.send(JSON.stringify({type:"draw",x,y,color:currentColor}));
});

canvas.addEventListener("mousedown", e=>{isDragging=true; dragStartX=e.clientX-offsetX; dragStartY=e.clientY-offsetY;});
canvas.addEventListener("mousemove", e=>{if(isDragging){offsetX=e.clientX-dragStartX; offsetY=e.clientY-dragStartY;}});
canvas.addEventListener("mouseup", ()=>isDragging=false);
canvas.addEventListener("mouseleave", ()=>isDragging=false);
canvas.addEventListener("wheel", e=>{
  e.preventDefault();
  const rect=canvas.getBoundingClientRect();
  const mx=(e.clientX-rect.left-offsetX)/scale;
  const my=(e.clientY-rect.top-offsetY)/scale;
  const zoom=e.deltaY<0?1.1:0.9;
  const newScale=Math.min(Math.max(0.1,scale*zoom),5);
  offsetX-=(mx*(newScale-scale)); offsetY-=(my*(newScale-scale));
  scale=newScale;
});

// ===== Chat =====
chatToggle.addEventListener("click",()=>chatPopup.classList.toggle("minimized"));
sendBtn.addEventListener("click",sendMessage);
chatInput.addEventListener("keydown",e=>{if(e.key==="Enter"){sendMessage(); e.preventDefault();}});
function sendMessage(){
  const text=chatInput.value.trim(); if(!text) return;
  ws.send(JSON.stringify({type:"chat",text}));
  chatInput.value="";
}
function renderMessage(text){
  const msg=document.createElement("div");
  msg.className="chat-msg"; msg.textContent=text;
  chatFeed.appendChild(msg);
  chatFeed.scrollTop=chatFeed.scrollHeight;
}

// ===== WebSocket =====
const ws=new WebSocket(location.origin.replace(/^http/,"ws"));
ws.onmessage=e=>{
  const data=JSON.parse(e.data);
  if(data.type==="init"){
    updatePointsUI(data.points);
    data.chat.forEach(m=>renderMessage(m.text));
  }
  if(data.type==="draw") drawPixel(data.x,data.y,data.color);
  if(data.type==="chat") renderMessage(data.text);
  if(data.type==="points") updatePointsUI(data.points,data.cooldown||null);
};

function drawPixel(x,y,color){
  const key=`${Math.floor(x/100)},${Math.floor(y/100)}`;
  if(!chunks.has(key)) chunks.set(key,[]);
  const chunk=chunks.get(key);
  const idx=chunk.findIndex(p=>p.x===x && p.y===y);
  if(idx>=0) chunk[idx]={x,y,color}; else chunk.push({x,y,color});
  playSound(drawAudio);
}

// ===== Animate =====
function animate(){ drawGrid(); requestAnimationFrame(animate); }
animate();

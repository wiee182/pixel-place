// ===== Constants =====
const WORLD_WIDTH = 5000, WORLD_HEIGHT = 5000, GRID_SIZE = 10;
const MAX_POINTS = 6, COOLDOWN = 30000;

// ===== Canvas =====
const canvas = document.getElementById("pixelCanvas");
const ctx = canvas.getContext("2d");
let scale=1, offsetX=0, offsetY=0, isDragging=false, dragStartX=0, dragStartY=0;

// ===== Palette =====
const colors = [
  "#fffefe","#b9c2ce","#767e8c","#424651","#1e1f26","#010100","#382314","#7c3f20",
  "#c16f36","#feac6d","#ffd3b0","#fea5d0","#f04eb4","#e872ff","#a631d3","#531c8d",
  "#0335be","#149dfe","#8df4fe","#00bea5","#17777f","#044522","#18862f","#60e121",
  "#b1ff37","#fffea4","#fce011","#fe9e17","#f66e08","#550123","#99011a","#f20e0c","#ff7872"
];
let currentColor = colors[0];
const paletteDiv = document.getElementById("palette");
colors.forEach((c,i)=>{
  const sw=document.createElement("div");
  sw.className="color-swatch";
  sw.style.background=c;
  sw.textContent=i;
  sw.addEventListener("click",()=>{currentColor=c; document.querySelectorAll(".color-swatch").forEach(s=>s.classList.remove("selected")); sw.classList.add("selected"); });
  paletteDiv.appendChild(sw);
});
document.querySelector(".color-swatch").classList.add("selected");

// ===== Controls =====
const toggleGridBtn = document.getElementById("toggle-grid");
const chatPopup = document.getElementById("chat-popup");
const chatFeed = document.getElementById("chat-feed");
const chatInput = document.getElementById("chat-message");
const sendBtn = document.getElementById("send-message");
const pointsDisplay = document.getElementById("points-display");
const toggleSoundBtn = document.getElementById("toggle-sound");

let showGrid=true, userPoints=MAX_POINTS, lastAction=Date.now(), soundEnabled=true;

// ===== Sounds =====
const drawAudio=new Audio('sounds/draw.mp3'), pointAudio=new Audio('sounds/point.mp3'), emptyAudio=new Audio('sounds/empty.mp3');
drawAudio.volume=0.2; pointAudio.volume=0.3; emptyAudio.volume=0.3;
function playSound(audio){ if(!soundEnabled) return; const s=audio.cloneNode(); s.play(); }

// ===== Pixels storage =====
const pixels = new Map();

// ===== Draw =====
function drawCanvas(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // Draw pixels
  pixels.forEach(p=>{ ctx.fillStyle=p.color; ctx.fillRect(p.x,p.y,GRID_SIZE,GRID_SIZE); });

  // Grid
  if(showGrid){
    ctx.strokeStyle="#222"; ctx.lineWidth=1/scale;
    for(let x=0;x<WORLD_WIDTH;x+=GRID_SIZE){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,WORLD_HEIGHT); ctx.stroke(); }
    for(let y=0;y<WORLD_HEIGHT;y+=GRID_SIZE){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(WORLD_WIDTH,y); ctx.stroke(); }
  }

  ctx.restore();
}

// ===== Canvas Events =====
canvas.addEventListener("mousedown", e=>{isDragging=true; dragStartX=e.clientX-offsetX; dragStartY=e.clientY-offsetY;});
canvas.addEventListener("mouseup", ()=>{isDragging=false;});
canvas.addEventListener("mouseleave", ()=>{isDragging=false;});
canvas.addEventListener("mousemove", e=>{if(isDragging){offsetX=e.clientX-dragStartX; offsetY=e.clientY-dragStartY; drawCanvas();}});
canvas.addEventListener("click", e=>{
  if(isDragging) return;
  const now=Date.now();
  if(userPoints<=0 && now-lastAction<COOLDOWN){ playSound(emptyAudio); return; }
  if(userPoints<=0 && now-lastAction>=COOLDOWN){ userPoints=1; lastAction=now; playSound(pointAudio); }

  const rect=canvas.getBoundingClientRect();
  const x=Math.max(0,Math.min(WORLD_WIDTH-GRID_SIZE,Math.floor((e.clientX-rect.left-offsetX)/scale/GRID_SIZE)*GRID_SIZE));
  const y=Math.max(0,Math.min(WORLD_HEIGHT-GRID_SIZE,Math.floor((e.clientY-rect.top-offsetY)/scale/GRID_SIZE)*GRID_SIZE));
  pixels.set(`${x},${y}`, {x,y,color:currentColor});
  drawCanvas();
  userPoints--; lastAction=now; updatePoints();
  playSound(drawAudio);
});

// Zoom
canvas.addEventListener("wheel", e=>{
  e.preventDefault();
  const rect=canvas.getBoundingClientRect();
  const mx=(e.clientX-rect.left-offsetX)/scale;
  const my=(e.clientY-rect.top-offsetY)/scale;
  const zoom=e.deltaY<0?1.1:0.9;
  scale=Math.min(Math.max(0.1,scale*zoom),5);
  offsetX -= mx*(scale-1); offsetY -= my*(scale-1);
  drawCanvas();
});

// ===== Controls Events =====
toggleGridBtn.addEventListener("click", ()=>{showGrid=!showGrid; drawCanvas();});
document.getElementById("toggle-chat").addEventListener("click", ()=>{chatPopup.classList.toggle("hidden");});
toggleSoundBtn.addEventListener("click", ()=>{soundEnabled=!soundEnabled; toggleSoundBtn.textContent=soundEnabled?"🔊":"🔇";});

// ===== Chat =====
sendBtn.addEventListener("click", sendChat);
chatInput.addEventListener("keydown", e=>{if(e.key==="Enter"){sendChat(); e.preventDefault();}});
function sendChat(){ const text=chatInput.value.trim(); if(!text) return; appendChat("You: "+text); chatInput.value=""; }
function appendChat(msg){ const div=document.createElement("div"); div.className="chat-msg"; div.textContent=msg; chatFeed.appendChild(div); chatFeed.scrollTop=chatFeed.scrollHeight; }

// ===== Points =====
function updatePoints(){
  if(userPoints>0){ pointsDisplay.classList.remove("red"); pointsDisplay.classList.add("green"); pointsDisplay.textContent=`${userPoints}/${MAX_POINTS}`; }
  else{ pointsDisplay.classList.remove("green"); pointsDisplay.classList.add("red"); const timeLeft=Math.max(0,Math.ceil((COOLDOWN-(Date.now()-lastAction))/1000)); pointsDisplay.textContent=`0/${MAX_POINTS} ${timeLeft}s`; }
}
setInterval(()=>{ if(userPoints<MAX_POINTS && Date.now()-lastAction>=COOLDOWN){ userPoints++; lastAction=Date.now(); playSound(pointAudio); updatePoints(); } },1000);

// ===== Animate =====
function animate(){ drawCanvas(); requestAnimationFrame(animate); }
animate();

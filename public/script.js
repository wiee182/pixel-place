// ===== Constants =====
const WORLD_WIDTH = 5000, WORLD_HEIGHT = 5000, GRID_SIZE = 10;

// ===== Canvas Setup =====
const bgCanvas = document.getElementById("bgCanvas");
const bgCtx = bgCanvas.getContext("2d");
const canvas = document.getElementById("pixelCanvas");
const ctx = canvas.getContext("2d");

let scale = 1, offsetX = 0, offsetY = 0;
let isDragging = false, dragStartX = 0, dragStartY = 0;
let currentColor = "#fffefe";
let showGrid = true;

// ===== Palette & Points =====
const colors = ["#fffefe","#b9c2ce","#767e8c","#424651","#1e1f26","#010100"];
const paletteDiv = document.getElementById("palette");
const toggleGridBtn = document.getElementById("toggle-grid");
const pointsDisplay = document.getElementById("points-display");
let userPoints = 6, lastActionTime = Date.now();

// ===== Chat Elements =====
const chatPopup = document.getElementById("chat-popup");
const minimizeBtn = document.getElementById("minimize-chat");
const chatFeed = document.getElementById("chat-feed");
const chatInput = document.getElementById("chat-message");
const sendBtn = document.getElementById("send-message");

// ===== Audio =====
const drawAudio = new Audio('sounds/draw.mp3'); drawAudio.volume = 0.2;
const pointAudio = new Audio('sounds/point.mp3'); pointAudio.volume = 0.3;
let soundEnabled = true;
const toggleSoundBtn = document.getElementById("toggle-sound");
toggleSoundBtn.addEventListener("click",()=>{ soundEnabled=!soundEnabled; toggleSoundBtn.textContent=soundEnabled?"🔊":"🔇"; });
function playSound(audio){ if(!soundEnabled) return; const s=audio.cloneNode(); s.play(); }

// ===== Palette Setup =====
colors.forEach((c,i)=>{
  const sw=document.createElement("div");
  sw.className="color-swatch"; sw.style.background=c; sw.dataset.color=c;
  sw.textContent=i;
  sw.addEventListener("click",()=>{
    document.querySelectorAll(".color-swatch").forEach(s=>s.classList.remove("selected"));
    sw.classList.add("selected"); currentColor=c;
  });
  paletteDiv.appendChild(sw);
});
document.querySelector(".color-swatch").classList.add("selected");

// ===== Chat Minimize =====
minimizeBtn.addEventListener("click",()=>{ chatPopup.classList.toggle("minimized"); });

// ===== Chat Send =====
sendBtn.addEventListener("click", sendMessage);
chatInput.addEventListener("keydown", e=>{ if(e.key==="Enter"){ sendMessage(); e.preventDefault(); } });
function sendMessage(){
  const text=chatInput.value.trim(); if(!text) return;
  // send via WebSocket (if exists)
  if(typeof ws!=="undefined") ws.send(JSON.stringify({type:"chat", message:text}));
  appendChat(text); chatInput.value='';
}
function appendChat(message){
  const msg=document.createElement("div"); msg.className="chat-msg"; msg.textContent=message;
  chatFeed.appendChild(msg); chatFeed.scrollTop=chatFeed.scrollHeight;
}

// ===== Canvas Resize =====
function resizeCanvas(){
  canvas.width = bgCanvas.width = canvas.parentElement.clientWidth;
  canvas.height = bgCanvas.height = canvas.parentElement.clientHeight;
  offsetX=(canvas.width-WORLD_WIDTH)/2;
  offsetY=0;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// ===== Draw Grid =====
function drawGrid(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.save(); ctx.translate(offsetX,offsetY); ctx.scale(scale,scale);
  if(showGrid){
    ctx.strokeStyle="#222"; ctx.lineWidth=1/scale;
    for(let x=0;x<WORLD_WIDTH;x+=GRID_SIZE){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,WORLD_HEIGHT); ctx.stroke(); }
    for(let y=0;y<WORLD_HEIGHT;y+=GRID_SIZE){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(WORLD_WIDTH,y); ctx.stroke(); }
  }
  ctx.restore();
}

// ===== Draw Pixel =====
canvas.addEventListener("click", e=>{
  if(isDragging) return;
  if(userPoints<=0) return;
  const rect=canvas.getBoundingClientRect();
  const x=Math.floor((e.clientX-rect.left-offsetX)/scale/GRID_SIZE)*GRID_SIZE;
  const y=Math.floor((e.clientY-rect.top-offsetY)/scale/GRID_SIZE)*GRID_SIZE;
  ctx.save(); ctx.translate(offsetX,offsetY); ctx.scale(scale,scale);
  ctx.fillStyle=currentColor; ctx.fillRect(x,y,GRID_SIZE,GRID_SIZE); ctx.restore();
  userPoints--; updatePointsDisplay(); playSound(drawAudio);
});

// ===== Update Points Display =====
function updatePointsDisplay(){
  if(userPoints>0){ pointsDisplay.style.color="#0f0"; pointsDisplay.textContent=`${userPoints}/6`; }
  else{ pointsDisplay.style.color="#f00"; pointsDisplay.textContent="0/6"; }
}
setInterval(()=>{
  if(userPoints<6){ userPoints++; updatePointsDisplay(); playSound(pointAudio); }
},30000);
updatePointsDisplay();

// ===== Grid Toggle =====
toggleGridBtn.addEventListener("click", ()=>{
  showGrid=!showGrid;
  toggleGridBtn.style.background=showGrid?"#fff":"#333";
  toggleGridBtn.style.color=showGrid?"#000":"#fff";
  drawGrid();
});

// ===== Pan & Zoom =====
canvas.addEventListener("mousedown", e=>{ isDragging=true; dragStartX=e.clientX-offsetX; dragStartY=e.clientY-offsetY; });
canvas.addEventListener("mousemove", e=>{ if(isDragging){ offsetX=e.clientX-dragStartX; offsetY=e.clientY-dragStartY; drawGrid(); } });
canvas.addEventListener("mouseup", ()=>{ isDragging=false; });
canvas.addEventListener("mouseleave", ()=>{ isDragging=false; });

canvas.addEventListener("wheel", e=>{
  e.preventDefault();
  const rect=canvas.getBoundingClientRect();
  const mx=(e.clientX-rect.left-offsetX)/scale;
  const my=(e.clientY-rect.top-offsetY)/scale;
  const newScale=Math.min(Math.max(0.1, scale*(e.deltaY<0?1.1:0.9)),5);
  offsetX-=(mx*(newScale-scale)); offsetY-=(my*(newScale-scale));
  scale=newScale; drawGrid();
});

// ===== Animation =====
function animate(){ drawGrid(); requestAnimationFrame(animate); }
animate();

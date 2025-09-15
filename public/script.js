// ===== Constants =====
const WORLD_WIDTH = 5000;
const WORLD_HEIGHT = 5000;
const GRID_SIZE = 10;

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
const colors = [
  "#fffefe","#b9c2ce","#767e8c","#424651","#1e1f26","#010100","#382314","#7c3f20",
  "#c16f36","#feac6d","#ffd3b0","#fea5d0","#f04eb4","#e872ff","#a631d3","#531c8d",
  "#0335be","#149dfe","#8df4fe","#00bea5","#17777f","#044522","#18862f","#60e121",
  "#b1ff37","#fffea4","#fce011","#fe9e17","#f66e08","#550123","#99011a","#f20e0c","#ff7872"
];

const paletteDiv = document.getElementById("palette");
const toggleGridBtn = document.getElementById("toggle-grid");
const chatPopup = document.getElementById("chat-popup");
const chatFeed = document.getElementById("chat-feed");
const chatInput = document.getElementById("chat-message");
const sendBtn = document.getElementById("send-message");
const pointsDisplay = document.getElementById("points-display");
const toggleSoundBtn = document.getElementById("toggle-sound");

let userPoints = 6;
let lastActionTime = Date.now();
let soundEnabled = true;

// ===== Audio =====
const drawAudio = new Audio('sounds/draw.mp3'); drawAudio.volume=0.2;
const pointAudio = new Audio('sounds/point.mp3'); pointAudio.volume=0.3;
function playSound(audio){ if(!soundEnabled) return; audio.cloneNode().play(); }

// ===== WebSocket =====
const wsProtocol = location.protocol==="https:"?"wss":"ws";
const ws = new WebSocket(`${wsProtocol}://${location.host}`);
ws.addEventListener("message", e=>{
  const data = JSON.parse(e.data);
  if(data.type==="draw") drawPixel(data);
  if(data.type==="chat") appendChat(data.message);
});

// ===== Resize =====
function resizeCanvas(){
  canvas.width = bgCanvas.width = canvas.parentElement.clientWidth;
  canvas.height = bgCanvas.height = canvas.parentElement.clientHeight;
  offsetX = (canvas.width - WORLD_WIDTH)/2;
  offsetY = 0;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// ===== Draw Grid & Pixels =====
const pixels = [];
function drawGrid(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // Draw pixels
  pixels.forEach(p=>{
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, GRID_SIZE, GRID_SIZE);
  });

  // Draw grid
  if(showGrid){
    ctx.strokeStyle="#222";
    ctx.lineWidth=1/scale;
    for(let x=0;x<WORLD_WIDTH;x+=GRID_SIZE){
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,WORLD_HEIGHT); ctx.stroke();
    }
    for(let y=0;y<WORLD_HEIGHT;y+=GRID_SIZE){
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(WORLD_WIDTH,y); ctx.stroke();
    }
  }

  ctx.restore();
}

// ===== Palette =====
colors.forEach((c,i)=>{
  const sw = document.createElement("div");
  sw.className="color-swatch";
  sw.style.background=c;
  sw.dataset.color=c;
  sw.textContent=i;
  sw.addEventListener("click",()=>{
    document.querySelectorAll(".color-swatch").forEach(s=>s.classList.remove("selected"));
    sw.classList.add("selected");
    currentColor=c;
  });
  paletteDiv.appendChild(sw);
});
document.querySelector(".color-swatch").classList.add("selected");

// ===== Grid Toggle =====
toggleGridBtn.addEventListener("click",()=>{
  showGrid=!showGrid;
  toggleGridBtn.style.background=showGrid?"#fff":"#333";
  toggleGridBtn.style.color=showGrid?"#000":"#fff";
  drawGrid();
});

// ===== Zoom & Pan =====
function zoomAt(cx,cy,factor){
  const newScale = Math.min(Math.max(0.1, scale*factor),5);
  offsetX -= (cx*(newScale-scale));
  offsetY -= (cy*(newScale-scale));
  scale = newScale;
}
canvas.addEventListener("wheel", e=>{
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX-rect.left-offsetX)/scale;
  const my = (e.clientY-rect.top-offsetY)/scale;
  zoomAt(mx,my,e.deltaY<0?1.1:0.9);
  drawGrid();
});

canvas.addEventListener("mousedown", e=>{ isDragging=true; dragStartX=e.clientX-offsetX; dragStartY=e.clientY-offsetY; });
canvas.addEventListener("mousemove", e=>{ if(isDragging){ offsetX=e.clientX-dragStartX; offsetY=e.clientY-dragStartY; drawGrid(); }});
canvas.addEventListener("mouseup", ()=>{ isDragging=false; });
canvas.addEventListener("mouseleave", ()=>{ isDragging=false; });

// ===== Draw Pixel & Points =====
canvas.addEventListener("click", e=>{
  if(isDragging) return;
  const now = Date.now();
  if(userPoints<=0 && now-lastActionTime<30000) return;
  if(userPoints<=0 && now-lastActionTime>=30000){ userPoints=1; lastActionTime=now; playSound(pointAudio); }

  const rect = canvas.getBoundingClientRect();
  const worldX = (e.clientX-rect.left-offsetX)/scale;
  const worldY = (e.clientY-rect.top-offsetY)/scale;
  const x = Math.max(0, Math.min(WORLD_WIDTH-GRID_SIZE, Math.floor(worldX/GRID_SIZE)*GRID_SIZE));
  const y = Math.max(0, Math.min(WORLD_HEIGHT-GRID_SIZE, Math.floor(worldY/GRID_SIZE)*GRID_SIZE));

  const pixel = {x,y,color:currentColor};
  pixels.push(pixel);
  playSound(drawAudio);
  ws.send(JSON.stringify({type:"draw", ...pixel}));

  userPoints--; lastActionTime=Date.now();
  updatePointsDisplay();
});

// ===== Incoming pixel =====
function drawPixel(p){
  pixels.push(p);
  drawGrid();
  playSound(drawAudio);
}

// ===== Floating Chat =====
function appendChat(message){
  const msg = document.createElement("div");
  msg.className="chat-msg"; msg.textContent=message;
  chatFeed.appendChild(msg); chatFeed.scrollTop=chatFeed.scrollHeight;
}
sendBtn.addEventListener("click", sendMessage);
chatInput.addEventListener("keydown", e=>{ if(e.key==="Enter"){ sendMessage(); e.preventDefault(); }});
function sendMessage(){
  const text = chatInput.value.trim();
  if(!text) return;
  ws.send(JSON.stringify({type:'chat', message:text}));
  chatInput.value='';
}

// ===== Show/Hide Chat =====
document.getElementById("toggle-chat-popup").addEventListener("click", ()=>{
  chatPopup.classList.toggle("hidden");
});

// ===== Toggle Sound =====
toggleSoundBtn.addEventListener("click", ()=>{ soundEnabled=!soundEnabled; toggleSoundBtn.textContent=soundEnabled?"🔊":"🔇"; });

// ===== Points Display =====
function updatePointsDisplay(){
  if(userPoints>0){ pointsDisplay.style.color="#0f0"; pointsDisplay.textContent=`${userPoints}/6`; }
  else{ const now=Date.now(); const timeLeft=Math.max(0,Math.ceil((30000-(now-lastActionTime))/1000)); pointsDisplay.style.color="#f00"; pointsDisplay.textContent=`0/6 ${timeLeft}s`; }
}
setInterval(updatePointsDisplay,1000);
setInterval(()=>{ if(userPoints<6){ userPoints++; playSound(pointAudio); updatePointsDisplay(); }},30000);

// ===== Animate =====
function animate(){ drawGrid(); requestAnimationFrame(animate); }
animate();

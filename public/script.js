// ===== Constants =====
const WORLD_WIDTH = 5000;
const WORLD_HEIGHT = 5000;
const GRID_SIZE = 10;

// ===== Canvas Setup =====
const canvas = document.getElementById("pixelCanvas");
const ctx = canvas.getContext("2d");

let scale = 1, offsetX = 0, offsetY = 0;
let isDragging = false, dragStartX=0, dragStartY=0;
let currentColor = "#fffefe";
let showGrid = true;

// ===== Palette & Points =====
const colors = ["#fffefe","#b9c2ce","#767e8c","#424651","#1e1f26","#010100"];
const paletteDiv = document.getElementById("palette");
const pointsDisplay = document.getElementById("points-display");
const moreColorsPopup = document.getElementById("more-colors-popup");
let userPoints = 6, lastActionTime = Date.now();

// ===== Chat Elements =====
const chatPopup = document.getElementById("chat-popup");
const chatToggle = document.getElementById("chat-toggle");
const chatFeed = document.getElementById("chat-feed");
const chatInput = document.getElementById("chat-message");
const sendBtn = document.getElementById("send-message");

// ===== Audio =====
const drawAudio = new Audio('sounds/draw.mp3'); drawAudio.volume=0.2;
const pointAudio = new Audio('sounds/point.mp3'); pointAudio.volume=0.3;
let soundEnabled = true;
function playSound(audio){ if(!soundEnabled) return; audio.cloneNode().play(); }

// ===== Resize =====
function resizeCanvas(){
  canvas.width = Math.min(WORLD_WIDTH, window.innerWidth);
  canvas.height = Math.min(WORLD_HEIGHT, window.innerHeight);
  offsetX = (canvas.width - WORLD_WIDTH)/2;
  offsetY = (canvas.height - WORLD_HEIGHT)/2;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// ===== Draw Grid =====
function drawGrid(){
  ctx.clearRect(0,0,canvas.width,canvas.height);

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // Canvas white background
  ctx.fillStyle="#fff";
  ctx.fillRect(0,0,WORLD_WIDTH,WORLD_HEIGHT);

  // Black grid
  if(showGrid){
    ctx.strokeStyle="#000";
    ctx.lineWidth=1/scale;
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
document.getElementById("toggle-grid").addEventListener("click", ()=>{
  showGrid=!showGrid;
  drawGrid();
});

// ===== Zoom & Pan =====
function zoomAt(cx,cy,factor){
  const newScale = Math.min(Math.max(0.1, scale*factor),5);
  offsetX -= (cx*(newScale-scale));
  offsetY -= (cy*(newScale-scale));
  scale=newScale;
  drawGrid();
}

canvas.addEventListener("wheel", e=>{
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mx=(e.clientX-rect.left-offsetX)/scale;
  const my=(e.clientY-rect.top-offsetY)/scale;
  zoomAt(mx,my,e.deltaY<0?1.1:0.9);
});

canvas.addEventListener("mousedown", e=>{isDragging=true; dragStartX=e.clientX-offsetX; dragStartY=e.clientY-offsetY;});
canvas.addEventListener("mousemove", e=>{if(isDragging){offsetX=e.clientX-dragStartX; offsetY=e.clientY-dragStartY; drawGrid();}});
canvas.addEventListener("mouseup", ()=>{isDragging=false;});
canvas.addEventListener("mouseleave", ()=>{isDragging=false;});

// ===== Draw Pixel Event =====
canvas.addEventListener("click", e=>{
  if(isDragging) return;

  const rect = canvas.getBoundingClientRect();
  let worldX = (e.clientX-rect.left-offsetX)/scale;
  let worldY = (e.clientY-rect.top-offsetY)/scale;

  // Clamp inside canvas
  worldX = Math.max(0, Math.min(WORLD_WIDTH-GRID_SIZE, worldX));
  worldY = Math.max(0, Math.min(WORLD_HEIGHT-GRID_SIZE, worldY));

  const x = Math.floor(worldX/GRID_SIZE)*GRID_SIZE;
  const y = Math.floor(worldY/GRID_SIZE)*GRID_SIZE;

  // Points logic
  const now = Date.now();
  if(userPoints<=0 && now-lastActionTime<20000) return; // 20s cooldown
  if(userPoints<=0 && now-lastActionTime>=20000){ userPoints=1; lastActionTime=now; playSound(pointAudio); }

  userPoints--; lastActionTime=Date.now();

  // Draw pixel
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  ctx.fillStyle=currentColor;
  ctx.fillRect(x,y,GRID_SIZE,GRID_SIZE);
  ctx.restore();
  playSound(drawAudio);
  updatePointsDisplay();
});

// ===== Points Display =====
function updatePointsDisplay(){
  if(userPoints>0){
    pointsDisplay.style.color="#0f0";
    pointsDisplay.textContent=`${userPoints}/6`;
  } else {
    const now=Date.now();
    const timeLeft=Math.max(0,Math.ceil((20000-(now-lastActionTime))/1000));
    pointsDisplay.style.color="#f00";
    pointsDisplay.textContent=`0/6 ${timeLeft}s`;
  }
}
setInterval(updatePointsDisplay,1000);
setInterval(()=>{
  if(userPoints<6){ userPoints++; playSound(pointAudio); updatePointsDisplay(); }
},20000);

// ===== Chat Logic =====
function appendChat(message){
  const msg = document.createElement("div");
  msg.className="chat-msg";
  msg.textContent=message;
  chatFeed.appendChild(msg);
  chatFeed.scrollTop=chatFeed.scrollHeight;
}
sendBtn.addEventListener("click", sendMessage);
chatInput.addEventListener("keydown", e=>{if(e.key==="Enter"){sendMessage(); e.preventDefault();}});
function sendMessage(){
  const text = chatInput.value.trim();
  if(!text) return;
  appendChat(text); // Local display, replace with websocket for live
  chatInput.value='';
}

// Minimize Chat
chatToggle.addEventListener("click", ()=>{
  if(chatPopup.style.height==="30px"){
    chatPopup.style.height="auto";
    chatFeed.style.display="block";
    chatInput.style.display="flex";
  } else {
    chatPopup.style.height="30px";
    chatFeed.style.display="none";
    chatInput.style.display="none";
  }
});

// ===== More Colors Popup =====
const moreColorsBtn = document.getElementById("more-colors");
moreColorsBtn.addEventListener("click", ()=>{
  moreColorsPopup.classList.toggle("hidden");
  if(!moreColorsPopup.classList.contains("hidden")){
    moreColorsPopup.innerHTML='';
    for(let i=6;i<36;i++){
      const c = i<colors.length ? colors[i] : "#000";
      const sw = document.createElement("div");
      sw.className="color-swatch";
      sw.style.background=c;
      sw.textContent=i;
      sw.dataset.color=c;
      sw.addEventListener("click",()=>{
        currentColor=c;
        document.querySelectorAll(".color-swatch").forEach(s=>s.classList.remove("selected"));
        sw.classList.add("selected");
      });
      moreColorsPopup.appendChild(sw);
    }
  }
});

// ===== Animate =====
function animate(){ drawGrid(); requestAnimationFrame(animate); }
animate();

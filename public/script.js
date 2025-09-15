// ===== Constants =====
const WORLD_WIDTH = 5000;
const WORLD_HEIGHT = 5000;
const GRID_SIZE = 10;
const CHUNK_SIZE = 100;

// ===== Canvas Setup =====
const bgCanvas = document.getElementById("bgCanvas");
const bgCtx = bgCanvas.getContext("2d");
const canvas = document.getElementById("pixelCanvas");
const ctx = canvas.getContext("2d");

let scale=1,targetScale=1;
let offsetX=0,offsetY=0;
let targetOffsetX=0,targetOffsetY=0;
let isDragging=false,dragMoved=false;
let dragStartX=0,dragStartY=0;

let currentColor="#fffefe";
let showGrid=true;
const chunks = new Map();

// ===== Palette =====
const colors = [
  "#fffefe","#b9c2ce","#767e8c","#424651","#1e1f26","#010100","#382314","#7c3f20",
  "#c16f36","#feac6d","#ffd3b0","#fea5d0","#f04eb4","#e872ff","#a631d3","#531c8d",
  "#531c8d","#0335be","#149dfe","#8df4fe","#00bea5","#17777f","#044522","#18862f",
  "#60e121","#b1ff37","#fffea4","#fce011","#fe9e17","#f66e08","#550123","#99011a",
  "#f20e0c","#ff7872"
];

// ===== DOM Elements =====
const paletteDiv = document.getElementById("palette");
const toggleGridBtn = document.getElementById("toggle-grid");
const chatPopup = document.getElementById("chat-popup");
const chatFeed = document.getElementById("chat-feed");
const chatInput = document.getElementById("chat-message");
const sendBtn = document.getElementById("send-message");
const pointsDisplay = document.getElementById("points-display");

// ===== User Points =====
let userPoints = 6;
let lastActionTime = Date.now();

// ===== WebSocket =====
const wsProtocol = location.protocol==="https:"?"wss":"ws";
const ws = new WebSocket(`${wsProtocol}://${location.host}`);
ws.addEventListener("open",()=>console.log("Connected"));
ws.addEventListener("message",e=>{
  const data=JSON.parse(e.data);
  if(data.type==="draw") handleIncomingPixel(data);
  if(data.type==="chat") appendChat(data.message);
  if(data.type==="init") data.chat.forEach(msg=>appendChat(msg.message));
});

// ===== Canvas Resize =====
function resizeCanvas(){
  canvas.width=bgCanvas.width=canvas.parentElement.clientWidth;
  canvas.height=bgCanvas.height=canvas.parentElement.clientHeight;
  offsetX=targetOffsetX=(canvas.width-WORLD_WIDTH)/2;
  offsetY=targetOffsetY=0;
}
window.addEventListener("resize",resizeCanvas);
resizeCanvas();

// ===== Draw Grid & Pixels =====
function drawGrid(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.translate(offsetX,offsetY);
  ctx.scale(scale,scale);

  const viewLeft=-offsetX/scale;
  const viewTop=-offsetY/scale;
  const viewRight=viewLeft+canvas.width/scale;
  const viewBottom=viewTop+canvas.height/scale;

  const startChunkX=Math.floor(viewLeft/CHUNK_SIZE);
  const startChunkY=Math.floor(viewTop/CHUNK_SIZE);
  const endChunkX=Math.floor(viewRight/CHUNK_SIZE);
  const endChunkY=Math.floor(viewBottom/CHUNK_SIZE);

  for(let cx=startChunkX;cx<=endChunkX;cx++){
    for(let cy=startChunkY;cy<=endChunkY;cy++){
      const key=`${cx},${cy}`;
      const chunk=chunks.get(key);
      if(!chunk) continue;
      chunk.forEach(p=>{
        if(p.x+GRID_SIZE>=viewLeft && p.x<=viewRight && p.y+GRID_SIZE>=viewTop && p.y<=viewBottom){
          ctx.fillStyle=p.color;
          ctx.fillRect(p.x,p.y,GRID_SIZE,GRID_SIZE);
        }
      });
    }
  }

  if(showGrid){
    ctx.strokeStyle="#222";
    ctx.lineWidth=1/scale;
    for(let x=Math.floor(viewLeft/GRID_SIZE)*GRID_SIZE;x<=viewRight;x+=GRID_SIZE){
      ctx.beginPath();ctx.moveTo(x,viewTop);ctx.lineTo(x,viewBottom);ctx.stroke();
    }
    for(let y=Math.floor(viewTop/GRID_SIZE)*GRID_SIZE;y<=viewBottom;y+=GRID_SIZE){
      ctx.beginPath();ctx.moveTo(viewLeft,y);ctx.lineTo(viewRight,y);ctx.stroke();
    }
  }

  ctx.restore();
}

// ===== Handle Pixel =====
function handleIncomingPixel(p){
  const chunkX=Math.floor(p.x/CHUNK_SIZE);
  const chunkY=Math.floor(p.y/CHUNK_SIZE);
  const key=`${chunkX},${chunkY}`;
  if(!chunks.has(key)) chunks.set(key,[]);
  const chunk=chunks.get(key);
  const idx=chunk.findIndex(px=>px.x===p.x && px.y===p.y);
  if(idx>=0) chunk[idx]=p; else chunk.push(p);
  drawGrid();
}

// ===== Palette Setup =====
colors.forEach((c,i)=>{
  const sw=document.createElement("div");
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

// ===== Zoom =====
canvas.addEventListener("wheel", e=>{
  e.preventDefault();
  const zoom=e.deltaY<0?1.1:0.9;
  targetScale*=zoom;
  targetScale=Math.min(Math.max(0.1,targetScale),5);
});

// ===== Pan =====
canvas.addEventListener("mousedown",e=>{isDragging=true; dragStartX=e.clientX-offsetX; dragStartY=e.clientY-offsetY;});
canvas.addEventListener("mousemove",e=>{if(isDragging){offsetX=e.clientX-dragStartX;offsetY=e.clientY-dragStartY;drawGrid();}});
canvas.addEventListener("mouseup",()=>{isDragging=false;});
canvas.addEventListener("mouseleave",()=>{isDragging=false;});

// ===== Draw Pixel & Points =====
canvas.addEventListener("click", e=>{
  if(isDragging) return;
  const now=Date.now();
  if(userPoints<=0 && now-lastActionTime<30000) return;
  if(userPoints<=0 && now-lastActionTime>=30000){ userPoints=1; lastActionTime=now; }

  let rect=canvas.getBoundingClientRect();
  let worldX=(e.clientX-rect.left-offsetX)/scale;
  let worldY=(e.clientY-rect.top-offsetY)/scale;
  let x=Math.max(0,Math.min(WORLD_WIDTH-GRID_SIZE,Math.floor(worldX/GRID_SIZE)*GRID_SIZE));
  let y=Math.max(0,Math.min(WORLD_HEIGHT-GRID_SIZE,Math.floor(worldY/GRID_SIZE)*GRID_SIZE));

  const pixel={type:'draw', x, y, color:currentColor};
  userPoints--; lastActionTime=now;
  handleIncomingPixel(pixel);
  ws.send(JSON.stringify(pixel));
  updatePointsDisplay();
});

// ===== Chat =====
function appendChat(message){
  const msg=document.createElement("div");
  msg.className="chat-msg";
  msg.textContent=message;
  chatFeed.appendChild(msg);
  chatFeed.scrollTop=chatFeed.scrollHeight;
}
sendBtn.addEventListener("click", sendMessage);
chatInput.addEventListener("keydown",e=>{if(e.key==="Enter"){sendMessage();e.preventDefault();}});
function sendMessage(){const text=chatInput.value.trim(); if(!text) return; ws.send(JSON.stringify({type:'chat', message:text})); chatInput.value='';}

// ===== Show/Hide Chat =====
document.getElementById("toggle-chat").addEventListener("click",()=>{chatPopup.classList.toggle("hidden");});
document.getElementById("close-chat").addEventListener("click",()=>{chatPopup.classList.add("hidden");});

// ===== Points Display =====
function updatePointsDisplay(){
  if(userPoints>0){ pointsDisplay.style.color="#0f0"; pointsDisplay.textContent=`Points: ${userPoints}`; }
  else{ const now=Date.now(); const timeLeft=Math.max(0,Math.ceil((30000-(now-lastActionTime))/1000)); pointsDisplay.style.color="#f00"; pointsDisplay.textContent=`Points: ${userPoints} (Cooldown ${timeLeft}s)`;}
}
setInterval(updatePointsDisplay,1000);

// ===== Restore Points =====
setInterval(()=>{if(userPoints<6){userPoints++; updatePointsDisplay();}},30000);

// ===== Animation =====
function animate(){ offsetX+=(targetOffsetX-offsetX)*0.2; offsetY+=(targetOffsetY-offsetY)*0.2; scale+=(targetScale-scale)*0.2; drawGrid(); requestAnimationFrame(animate);}
animate();

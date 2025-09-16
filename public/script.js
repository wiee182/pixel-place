// ===== Constants =====
const WORLD_WIDTH = 5000, WORLD_HEIGHT = 5000, GRID_SIZE = 10, CHUNK_SIZE = 100;

// ===== Canvas =====
const bgCanvas = document.getElementById("bgCanvas"), bgCtx = bgCanvas.getContext("2d");
const canvas = document.getElementById("pixelCanvas"), ctx = canvas.getContext("2d");

let scale=1, offsetX=0, offsetY=0, isDragging=false, dragStartX=0, dragStartY=0, pinchStartDist=null, pinchStartScale=1;
let currentColor="#fffefe", showGrid=true, chunks=new Map();

// ===== Palette & Points =====
const paletteDiv=document.getElementById("palette"), toggleGridBtn=document.getElementById("toggle-grid");
const chatPopup=document.getElementById("chat-popup"), chatFeed=document.getElementById("chat-feed"), chatInput=document.getElementById("chat-message"), sendBtn=document.getElementById("send-message"), chatToggle=document.getElementById("chat-toggle");
const pointsDisplay=document.getElementById("points-display"), toggleSoundBtn=document.getElementById("toggle-sound");

let userPoints=6, lastActionTime=Date.now(), soundEnabled=true;

// ===== Audio =====
const drawAudio=new Audio('sounds/draw.mp3'); drawAudio.volume=0.2;
const pointAudio=new Audio('sounds/point.mp3'); pointAudio.volume=0.3;
function playSound(audio){ if(!soundEnabled) return; audio.cloneNode().play(); }

// ===== WebSocket =====
const wsProtocol=location.protocol==="https:"?"wss":"ws";
const ws=new WebSocket(`${wsProtocol}://${location.host}`);
ws.addEventListener("message", e=>{
  const data=JSON.parse(e.data);
  if(data.type==="draw") handleIncomingPixel(data);
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
function drawGrid(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.save(); ctx.translate(offsetX,offsetY); ctx.scale(scale,scale);

  const viewLeft=-offsetX/scale, viewTop=-offsetY/scale, viewRight=viewLeft+canvas.width/scale, viewBottom=viewTop+canvas.height/scale;
  const startChunkX=Math.floor(viewLeft/CHUNK_SIZE), startChunkY=Math.floor(viewTop/CHUNK_SIZE), endChunkX=Math.floor(viewRight/CHUNK_SIZE), endChunkY=Math.floor(viewBottom/CHUNK_SIZE);

  for(let cx=startChunkX; cx<=endChunkX; cx++){
    for(let cy=startChunkY; cy<=endChunkY; cy++){
      const key=`${cx},${cy}`, chunk=chunks.get(key);
      if(!chunk) continue;
      chunk.forEach(p=>{ ctx.fillStyle=p.color; ctx.fillRect(p.x,p.y,GRID_SIZE,GRID_SIZE); });
    }
  }

  if(showGrid){
    ctx.strokeStyle="#222"; ctx.lineWidth=1/scale;
    for(let x=Math.floor(viewLeft/GRID_SIZE)*GRID_SIZE;x<=viewRight;x+=GRID_SIZE){ ctx.beginPath(); ctx.moveTo(x,viewTop); ctx.lineTo(x,viewBottom); ctx.stroke(); }
    for(let y=Math.floor(viewTop/GRID_SIZE)*GRID_SIZE;y<=viewBottom;y+=GRID_SIZE){ ctx.beginPath(); ctx.moveTo(viewLeft,y); ctx.lineTo(viewRight,y); ctx.stroke(); }
  }

  ctx.restore();
}

// ===== Incoming Pixel =====
function handleIncomingPixel(p){
  const chunkX=Math.floor(p.x/CHUNK_SIZE), chunkY=Math.floor(p.y/CHUNK_SIZE), key=`${chunkX},${chunkY}`;
  if(!chunks.has(key)) chunks.set(key,[]);
  const chunk=chunks.get(key);
  const idx=chunk.findIndex(px=>px.x===p.x&&px.y===p.y);
  if(idx>=0) chunk[idx]=p; else chunk.push(p);

  ctx.save(); ctx.translate(offsetX,offsetY); ctx.scale(scale,scale); ctx.fillStyle=p.color; ctx.fillRect(p.x,p.y,GRID_SIZE,GRID_SIZE); ctx.restore();
  playSound(drawAudio);
}

// ===== Palette =====
const allColors = ["#fffefe","#b9c2ce","#767e8c","#424651","#1e1f26","#010100","#382314","#7c3f20","#c16f36","#feac6d","#ffd3b0","#fea5d0","#f04eb4","#e872ff","#a631d3","#531c8d","#531c8d","#0335be","#149dfe","#8df4fe","#00bea5","#17777f","#044522","#18862f","#60e121","#b1ff37","#fffea4","#fce011","#fe9e17","#f66e08","#550123","#99011a","#f20e0c","#ff7872"];
paletteDiv.innerHTML="";

// First 6 colors
allColors.slice(0,6).forEach((c,i)=>createSwatch(c,i));

// Scrollable extra colors
const extraWrapper=document.createElement("div"); extraWrapper.style.display="flex"; extraWrapper.style.gap="4px"; extraWrapper.style.overflowX="auto"; allColors.slice(6).forEach((c,i)=>createSwatch(c,i+6,extraWrapper));
paletteDiv.appendChild(extraWrapper);

document.querySelector(".color-swatch").classList.add("selected");

function createSwatch(color,index,parent=paletteDiv){
  const sw=document.createElement("div");
  sw.className="color-swatch"; sw.style.background=color; sw.dataset.color=color; sw.textContent=index;
  sw.addEventListener("click",()=>{
    document.querySelectorAll(".color-swatch").forEach(s=>s.classList.remove("selected"));
    sw.classList.add("selected"); currentColor=color;
  });
  parent.appendChild(sw);
}

// ===== Grid Toggle =====
toggleGridBtn.addEventListener("click",()=>{ showGrid=!showGrid; toggleGridBtn.style.background=showGrid?"#fff":"#333"; toggleGridBtn.style.color=showGrid?"#000":"#fff"; drawGrid(); });

// ===== Zoom & Pan =====
function zoomAt(cx,cy,zoomFactor){ const newScale=Math.min(Math.max(0.1,scale*zoomFactor),5); offsetX-=(cx*(newScale-scale)); offsetY-=(cy*(newScale-scale)); scale=newScale; }
canvas.addEventListener("wheel", e=>{ e.preventDefault(); const rect=canvas.getBoundingClientRect(); const mx=(e.clientX-rect.left-offsetX)/scale, my=(e.clientY-rect.top-offsetY)/scale; zoomAt(mx,my,e.deltaY<0?1.1:0.9); drawGrid(); });

canvas.addEventListener("mousedown", e=>{ isDragging=true; dragStartX=e.clientX-offsetX; dragStartY=e.clientY-offsetY; });
canvas.addEventListener("mousemove", e=>{ if(isDragging){ offsetX=e.clientX-dragStartX; offsetY=e.clientY-dragStartY; drawGrid(); }});
canvas.addEventListener("mouseup", ()=>{ isDragging=false; });
canvas.addEventListener("mouseleave", ()=>{ isDragging=false; });

// ===== Draw Pixel & Points =====
canvas.addEventListener("click", e=>{
  if(isDragging) return;
  const now=Date.now();
  if(userPoints<=0 && now-lastActionTime<30000) return;
  if(userPoints<=0 && now-lastActionTime>=30000){ userPoints=1; lastActionTime=now; playSound(pointAudio); }

  const rect=canvas.getBoundingClientRect();
  const worldX=(e.clientX-rect.left-offsetX)/scale;
  const worldY=(e.clientY-rect.top-offsetY)/scale;
  const x=Math.max(0, Math.min(WORLD_WIDTH-GRID_SIZE, Math.floor(worldX/GRID_SIZE)*GRID_SIZE));
  const y=Math.max(0, Math.min(WORLD_HEIGHT-GRID_SIZE, Math.floor(worldY/GRID_SIZE)*GRID_SIZE));

  const pixel={type:'draw', x, y, color:currentColor};
  userPoints--; lastActionTime=Date.now();
  handleIncomingPixel(pixel);
  ws.send(JSON.stringify(pixel));
  updatePointsDisplay();
});

// ===== Chat =====
function appendChat(message){ const msg=document.createElement("div"); msg.className="chat-msg"; msg.textContent=message; chatFeed.appendChild(msg); chatFeed.scrollTop=chatFeed.scrollHeight; }
sendBtn.addEventListener("click", sendMessage);
chatInput.addEventListener("keydown", e=>{ if(e.key==="Enter"){ sendMessage(); e.preventDefault(); }});
function sendMessage(){ const text=chatInput.value.trim(); if(!text) return; ws.send(JSON.stringify({type:'chat',message:text})); chatInput.value=''; }

// ===== Chat Minimize =====
chatToggle.addEventListener("click", ()=>{ chatPopup.classList.toggle("minimized"); });

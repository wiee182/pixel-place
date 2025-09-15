// ====== Setup ======
const bgCanvas = document.getElementById("bgCanvas");
const bgCtx = bgCanvas.getContext("2d");

const canvas = document.getElementById("pixelCanvas");
const ctx = canvas.getContext("2d");

const WORLD_WIDTH = 2000;   // vertical canvas width
const WORLD_HEIGHT = 4000;  // vertical canvas height
const gridSize = 10;
let currentColor = "#fffefe";
let showGrid = true;

// Transform & inertia
let scale = 1, targetScale = 1;
let offsetX = 0, offsetY = 0;
let targetOffsetX = 0, targetOffsetY = 0;
let velocityX = 0, velocityY = 0;

// Interaction
let isDragging = false, dragMoved = false;
let panStartX = 0, panStartY = 0, downX = 0, downY = 0;

// Pixels array
const pixels = [];

// ====== Resize Canvases ======
function resizeCanvas() {
  canvas.width = bgCanvas.width = canvas.parentElement.clientWidth;
  canvas.height = bgCanvas.height = canvas.parentElement.clientHeight;

  offsetX = targetOffsetX = (canvas.width - WORLD_WIDTH) / 2;
  offsetY = targetOffsetY = 0;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// ====== Draw Pixels & Grid ======
function drawGrid() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  const viewLeft = -offsetX / scale;
  const viewTop = -offsetY / scale;
  const viewRight = viewLeft + canvas.width / scale;
  const viewBottom = viewTop + canvas.height / scale;

  // Draw pixels
  pixels.forEach(p => {
    if(p.x + gridSize >= viewLeft && p.x <= viewRight &&
       p.y + gridSize >= viewTop && p.y <= viewBottom) {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x,p.y,gridSize,gridSize);
    }
  });

  // Draw grid only on pixel canvas
  if(showGrid) {
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 1/scale;
    for(let x=Math.floor(viewLeft/gridSize)*gridSize; x<=viewRight; x+=gridSize){
      ctx.beginPath(); ctx.moveTo(x, viewTop); ctx.lineTo(x, viewBottom); ctx.stroke();
    }
    for(let y=Math.floor(viewTop/gridSize)*gridSize; y<=viewBottom; y+=gridSize){
      ctx.beginPath(); ctx.moveTo(viewLeft, y); ctx.lineTo(viewRight, y); ctx.stroke();
    }
  }

  ctx.restore();
}

// ====== Zoom & Pan Limits ======
function recalcZoomLimits(){
  const minScaleX = canvas.width / WORLD_WIDTH;
  const minScaleY = canvas.height / WORLD_HEIGHT;
  return { min: Math.min(minScaleX,minScaleY), max: 10 };
}
function recalcOffsetLimits(){
  const scaledWidth = WORLD_WIDTH*scale;
  const scaledHeight = WORLD_HEIGHT*scale;
  if(scaledWidth <= canvas.width){ offsetX = targetOffsetX = (canvas.width - scaledWidth)/2; }
  else{ const minX = canvas.width-scaledWidth; const maxX = 0; offsetX = Math.max(minX, Math.min(maxX, offsetX)); targetOffsetX = Math.max(minX, Math.min(maxX, targetOffsetX)); }
  if(scaledHeight <= canvas.height){ offsetY = targetOffsetY = (canvas.height - scaledHeight)/2; }
  else{ const minY = canvas.height-scaledHeight; const maxY = 0; offsetY = Math.max(minY, Math.min(maxY, offsetY)); targetOffsetY = Math.max(minY, Math.min(maxY, targetOffsetY)); }
}

// ====== Animate ======
function animate(){
  scale += (targetScale-scale)*0.15;
  offsetX += (targetOffsetX-offsetX)*0.15 + velocityX;
  offsetY += (targetOffsetY-offsetY)*0.15 + velocityY;
  velocityX *= 0.88; velocityY *= 0.88;
  recalcOffsetLimits();
  drawGrid();
  requestAnimationFrame(animate);
}
animate();

// ====== Mouse Events ======
canvas.addEventListener("wheel", e=>{
  e.preventDefault();
  const zoomFactor = e.deltaY<0 ? 1.1 : 0.9;
  const { min, max } = recalcZoomLimits();
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const worldX = (mouseX - targetOffsetX)/targetScale;
  const worldY = (mouseY - targetOffsetY)/targetScale;

  targetScale = Math.max(min, Math.min(max, targetScale * zoomFactor));
  targetOffsetX = mouseX - worldX*targetScale;
  targetOffsetY = mouseY - worldY*targetScale;
  recalcOffsetLimits();
});

canvas.addEventListener("mousedown", e=>{
  if(e.button!==0) return;
  isDragging=true; panStartX=e.clientX-targetOffsetX; panStartY=e.clientY-targetOffsetY;
  downX=e.clientX; downY=e.clientY; dragMoved=false; velocityX=0; velocityY=0;
});
canvas.addEventListener("mousemove", e=>{
  if(!isDragging) return;
  if(!dragMoved && Math.hypot(e.clientX-downX,e.clientY-downY)>4) dragMoved=true;
  const newX = e.clientX-panStartX;
  const newY = e.clientY-panStartY;
  velocityX=newX-targetOffsetX; velocityY=newY-targetOffsetY;
  targetOffsetX=newX; targetOffsetY=newY;
});
function endPan(){ isDragging=false; }
canvas.addEventListener("mouseup", endPan);
canvas.addEventListener("mouseleave", endPan);

canvas.addEventListener("click", e=>{
  if(dragMoved) return;
  const rect = canvas.getBoundingClientRect();
  let worldX = (e.clientX-rect.left-targetOffsetX)/targetScale;
  let worldY = (e.clientY-rect.top-targetOffsetY)/targetScale;
  let x = Math.max(0, Math.min(WORLD_WIDTH-gridSize, Math.floor(worldX/gridSize)*gridSize));
  let y = Math.max(0, Math.min(WORLD_HEIGHT-gridSize, Math.floor(worldY/gridSize)*gridSize));
  const pixel = {x,y,color:currentColor};
  const idx = pixels.findIndex(p=>p.x===x && p.y===y);
  if(idx>=0) pixels[idx]=pixel; else pixels.push(pixel);
  drawGrid();
});

// ====== Palette ======
const palette = document.getElementById("palette");
const colors = ["#fffefe","#b9c2ce","#767e8c","#424651","#1e1f26","#010100","#382314","#7c3f20","#c16f36","#feac6d","#ffd3b0","#fea5d0","#f04eb4","#e872ff","#a631d3","#531c8d","#531c8d","#0335be","#149dfe","#8df4fe","#00bea5","#17777f","#044522","#18862f","#60e121","#b1ff37","#fffea4","#fce011","#fe9e17","#f66e08","#550123","#99011a","#f20e0c","#ff7872"];
palette.innerHTML="";
colors.forEach((color,index)=>{
  const wrapper=document.createElement("div");
  wrapper.style.display="flex"; wrapper.style.flexDirection="column"; wrapper.style.alignItems="center";
  const label=document.createElement("span"); label.textContent=index; label.style.fontSize="12px"; label.style.color="#fff"; label.style.marginBottom="2px";
  wrapper.appendChild(label);
  const swatch=document.createElement("div"); swatch.className="color-swatch"; swatch.style.background=color; swatch.dataset.color=color;
  swatch.addEventListener("click",()=>{ document.querySelectorAll(".color-swatch").forEach(s=>s.classList.remove("selected")); swatch.classList.add("selected"); currentColor=color; });
  wrapper.appendChild(swatch);
  palette.appendChild(wrapper);
});
document.querySelector(".color-swatch").classList.add("selected");

// ====== Grid Toggle ======
const gridBtn = document.getElementById("toggle-grid");
gridBtn.style.background="#fff"; gridBtn.style.color="#000";
gridBtn.addEventListener("click",()=>{
  showGrid=!showGrid;
  if(showGrid){ gridBtn.style.background="#fff"; gridBtn.style.color="#000"; }
  else{ gridBtn.style.background="#222"; gridBtn.style.color="#fff"; }
  drawGrid();
});

// ====== Chat ======
const feed=document.getElementById("chat-feed");
const input=document.getElementById("chat-message");
const sendBtn=document.getElementById("send-message");
const sidePanel=document.getElementById("side-panel");
const chatToggleBtn=document.getElementById("toggle-chat");

function sendMessage(){ const text=input.value.trim(); if(!text) return; const msg=document.createElement("div"); msg.className="chat-msg"; msg.textContent=text; feed.insertBefore(msg,feed.querySelector(".chat-input")); input.value=""; feed.scrollTop=feed.scrollHeight; }
sendBtn.addEventListener("click",sendMessage);
input.addEventListener("keydown",e=>{ if(e.key==="Enter"){ sendMessage(); e.preventDefault(); } });

chatToggleBtn.addEventListener("click",()=>{
  if(sidePanel.style.display==="none" || sidePanel.style.display===""){
    sidePanel.style.display="flex"; chatToggleBtn.textContent="Hide Chat";
  } else {
    sidePanel.style.display="none"; chatToggleBtn.textContent="Show Chat";
  }
});

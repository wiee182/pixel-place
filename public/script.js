const canvas=document.getElementById("pixelCanvas");
const ctx=canvas.getContext("2d");
const GRID_SIZE=10;
const WORLD_WIDTH=5000, WORLD_HEIGHT=5000;

let scale=1, offsetX=0, offsetY=0, isDragging=false, startX=0, startY=0;
let currentColor="#fffefe";
let showGrid=true;

const paletteColors=["#fffefe","#b9c2ce","#767e8c","#424651","#1e1f26","#010100"];
const paletteDiv=document.getElementById("palette");

// Points
let userPoints=6;
const pointsDisplay=document.getElementById("points-display");
function updatePoints(){ pointsDisplay.textContent=`${userPoints}/6`; pointsDisplay.className=`small-btn ${userPoints>0?"green":"red"}`; }
updatePoints();

// Pixels storage
const pixels=new Map();

// ===== Draw functions =====
function drawCanvas(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // Draw pixels
  pixels.forEach(p=>ctx.fillStyle=p.color, ctx.fillRect(p.x,p.y,GRID_SIZE,GRID_SIZE));

  // Draw grid
  if(showGrid){
    ctx.strokeStyle="#222"; ctx.lineWidth=1/scale;
    for(let x=0;x<WORLD_WIDTH;x+=GRID_SIZE){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,WORLD_HEIGHT); ctx.stroke(); }
    for(let y=0;y<WORLD_HEIGHT;y+=GRID_SIZE){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(WORLD_WIDTH,y); ctx.stroke(); }
  }

  ctx.restore();
}
drawCanvas();

// ===== Palette setup =====
paletteColors.forEach((c,i)=>{
  const sw=document.createElement("div");
  sw.className="color-swatch";
  sw.style.background=c;
  sw.textContent=i;
  sw.addEventListener("click", ()=>{
    currentColor=c;
    document.querySelectorAll(".color-swatch").forEach(s=>s.classList.remove("selected"));
    sw.classList.add("selected");
  });
  paletteDiv.appendChild(sw);
});
document.querySelector(".color-swatch").classList.add("selected");

// Fade for first 6 colors
function updatePaletteFade(){
  const sws=paletteDiv.querySelectorAll(".color-swatch");
  for(let i=0;i<sws.length;i++){
    if(i<6) sws[i].style.opacity=1-(i/5)*0.75;
    else sws[i].style.opacity=1;
  }
}
updatePaletteFade();
window.addEventListener("resize", updatePaletteFade);

// ===== Canvas interactions =====
canvas.addEventListener("mousedown", e=>{ isDragging=true; startX=e.clientX-offsetX; startY=e.clientY-offsetY; });
canvas.addEventListener("mouseup", ()=>{ isDragging=false; });
canvas.addEventListener("mouseleave", ()=>{ isDragging=false; });
canvas.addEventListener("mousemove", e=>{ if(isDragging){ offsetX=e.clientX-startX; offsetY=e.clientY-startY; drawCanvas(); } });

canvas.addEventListener("click", e=>{
  if(isDragging) return;
  const rect=canvas.getBoundingClientRect();
  const x=Math.max(0, Math.min(WORLD_WIDTH-GRID_SIZE, Math.floor((e.clientX-rect.left-offsetX)/scale/GRID_SIZE)*GRID_SIZE));
  const y=Math.max(0, Math.min(WORLD_HEIGHT-GRID_SIZE, Math.floor((e.clientY-rect.top-offsetY)/scale/GRID_SIZE)*GRID_SIZE));
  pixels.set(`${x},${y}`, {x,y,color:currentColor});
  if(userPoints>0){ userPoints--; updatePoints(); }
  drawCanvas();
});

// Zoom
canvas.addEventListener("wheel", e=>{
  e.preventDefault();
  const rect=canvas.getBoundingClientRect();
  const mx=(e.clientX-rect.left-offsetX)/scale;
  const my=(e.clientY-rect.top-offsetY)/scale;
  const zoom=e.deltaY<0?1.1:0.9;
  scale=Math.max(0.1,Math.min(10,scale*zoom));
  offsetX=e.clientX-mx*scale; offsetY=e.clientY-my*scale;
  drawCanvas();
});

// ===== Grid toggle =====
document.getElementById("toggle-grid").addEventListener("click", ()=>{
  showGrid=!showGrid;
  const btn=document.getElementById("toggle-grid");
  btn.style.background=showGrid?"#fff":"#333";
  drawCanvas();
});

// ===== Chat =====
const chatInput=document.getElementById("chat-message");
const chatFeed=document.getElementById("chat-feed");
document.getElementById("send-message").addEventListener("click", sendChat);
chatInput.addEventListener("keydown", e=>{ if(e.key==="Enter") sendChat(); });
function sendChat(){
  if(chatInput.value.trim()==="") return;
  const msg=document.createElement("div");
  msg.className="chat-msg";
  msg.textContent=chatInput.value;
  chatFeed.appendChild(msg);
  chatInput.value="";
  chatFeed.scrollTop=chatFeed.scrollHeight;
}

// ===== Chat minimize =====
document.getElementById("minimize-chat").addEventListener("click", ()=>{
  const chat=document.getElementById("chat-popup");
  chat.style.display=(chat.style.display==="none")?"flex":"none";
});

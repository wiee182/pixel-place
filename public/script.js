// ===== Constants =====
const GRID_SIZE=10, MAX_POINTS=6, COOLDOWN=30000;
let scale=1, offsetX=0, offsetY=0, isDragging=false, dragStartX=0, dragStartY=0;

// ===== Canvas =====
const canvas=document.getElementById("pixelCanvas");
const ctx=canvas.getContext("2d");
const pixels=new Map();

// ===== Palette =====
const colors=["#fffefe","#b9c2ce","#767e8c","#424651","#1e1f26","#010100"];
let currentColor=colors[0];
const paletteDiv=document.getElementById("palette");
colors.forEach((c,i)=>{
  const sw=document.createElement("div");
  sw.className="color-swatch";
  sw.style.background=c;
  sw.textContent=i;
  sw.addEventListener("click",()=>{
    currentColor=c;
    document.querySelectorAll(".color-swatch").forEach(s=>s.classList.remove("selected"));
    sw.classList.add("selected");
  });
  paletteDiv.appendChild(sw);
});
document.querySelector(".color-swatch").classList.add("selected");

// ===== Dynamic fade for first 6 colors =====
function updatePaletteFade(){
  const swatches=paletteDiv.querySelectorAll(".color-swatch");
  const visibleCount=6;
  for(let i=0;i<swatches.length;i++){
    if(i<visibleCount){
      swatches[i].style.opacity=1-(i/(visibleCount-1))*0.75;
    } else swatches[i].style.opacity=1;
  }
}
updatePaletteFade();
window.addEventListener("resize", updatePaletteFade);

// ===== Points =====
let userPoints=MAX_POINTS, lastAction=Date.now();
const pointsDisplay=document.getElementById("points-display");
function updatePoints(){
  pointsDisplay.textContent=`${userPoints}/6`;
  pointsDisplay.className=`small-btn ${userPoints>0?"green":"red"}`;
}
updatePoints();

// ===== Draw =====
function drawCanvas(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.translate(offsetX,offsetY);
  ctx.scale(scale,scale);

  // Draw pixels
  pixels.forEach(p=>ctx.fillStyle=p.color, ctx.fillRect(p.x,p.y,GRID_SIZE,GRID_SIZE));

  // Draw grid
  if(document.getElementById("toggle-grid").style.background!="#333"){
    ctx.strokeStyle="#222"; ctx.lineWidth=1/scale;
    for(let x=0;x<5000;x+=GRID_SIZE){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,5000); ctx.stroke(); }
    for(let y=0;y<5000;y+=GRID_SIZE){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(5000,y); ctx.stroke(); }
  }

  ctx.restore();
}
drawCanvas();

// ===== Canvas Events =====
canvas.addEventListener("mousedown", e=>{ isDragging=true; dragStartX=e.clientX-offsetX; dragStartY=e.clientY-offsetY; });
canvas.addEventListener("mouseup", ()=>{ isDragging=false; });
canvas.addEventListener("mousemove", e=>{ if(isDragging){ offsetX=e.clientX-dragStartX; offsetY=e.clientY-dragStartY; drawCanvas(); } });
canvas.addEventListener("click", e=>{
  const rect=canvas.getBoundingClientRect();
  const x=Math.floor((e.clientX-rect.left-offsetX)/scale/GRID_SIZE)*GRID_SIZE;
  const y=Math.floor((e.clientY-rect.top-offsetY)/scale/GRID_SIZE)*GRID_SIZE;
  pixels.set(`${x},${y}`,{x,y,color:currentColor});
  drawCanvas();
  if(userPoints>0){ userPoints--; updatePoints(); }
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

// ===== Grid Toggle =====
document.getElementById("toggle-grid").addEventListener("click", ()=>{
  const btn=document.getElementById("toggle-grid");
  btn.style.background=(btn.style.background=="#333")?"#fff":"#333";
  drawCanvas();
});

// ===== Chat =====
const chatFeed=document.getElementById("chat-feed");
const chatInput=document.getElementById("chat-message");
document.getElementById("send-message").addEventListener("click", sendChat);
chatInput.addEventListener("keydown", e=>{ if(e.key==="Enter") sendChat(); });
function sendChat(){
  if(chatInput.value.trim()==="") return;
  const msg=document.createElement("div");
  msg.className="chat-msg"; msg.textContent=chatInput.value;
  chatFeed.appendChild(msg); chatInput.value=""; chatFeed.scrollTop=chatFeed.scrollHeight;
}

// ===== Chat Minimize =====
document.getElementById("minimize-chat").addEventListener("click", ()=>{
  const chat=document.getElementById("chat-popup");
  chat.style.display=(chat.style.display==="none")?"flex":"none";
});

// ===== Constants =====
const WORLD_WIDTH = 5000;
const WORLD_HEIGHT = 5000;
const GRID_SIZE = 10;

// ===== Canvas Setup =====
const canvas = document.getElementById("pixelCanvas");
const ctx = canvas.getContext("2d");
let scale=1, offsetX=0, offsetY=0;
let isDragging=false, dragStartX=0, dragStartY=0;
let currentColor="#fffefe", showGrid=true;
const chunks = new Map();

// ===== Palette & Points =====
const colors = [
  "#fffefe","#b9c2ce","#767e8c","#424651","#1e1f26","#010100",
  "#382314","#7c3f20","#c16f36","#feac6d","#ffd3b0","#fea5d0",
  "#f04eb4","#e872ff","#a631d3","#531c8d","#0335be","#149dfe",
  "#8df4fe","#00bea5","#17777f","#044522","#18862f","#60e121",
  "#b1ff37","#fffea4","#fce011","#fe9e17","#f66e08","#550123",
  "#99011a","#f20e0c","#ff7872"
];

const paletteDiv=document.getElementById("palette");
const toggleGridBtn=document.getElementById("toggle-grid");
const pointsDisplay=document.getElementById("points-display");
const toggleSoundBtn=document.getElementById("toggle-sound");
const moreColorsBtn=document.getElementById("more-colors");
const moreColorsPopup=document.getElementById("more-colors-popup");

// ===== Chat =====
const chatPopup=document.getElementById("chat-popup");
const chatToggle=document.getElementById("chat-toggle");
const chatFeed=document.getElementById("chat-feed");
const chatInput=document.getElementById("chat-message");
const sendBtn=document.getElementById("send-message");

// ===== Points =====
let userPoints=6, lastActionTime=Date.now(), soundEnabled=true;
const COOLDOWN=20000; // 20 seconds

// ===== Audio =====
const drawAudio=new Audio('sounds/draw.mp3'); drawAudio.volume=0.2;
const pointAudio=new Audio('sounds/point.mp3'); pointAudio.volume=0.3;
function playSound(audio){ if(!soundEnabled) return; const s=audio.cloneNode(); s.play(); }

// ===== Resize Canvas =====
function resizeCanvas(){
  canvas.width=canvas.parentElement.clientWidth;
  canvas.height=canvas.parentElement.clientHeight;
  offsetX=(canvas.width-WORLD_WIDTH)/2;
  offsetY=(canvas.height-WORLD_HEIGHT)/2;
}
window.addEventListener("resize",resizeCanvas);
resizeCanvas();

// ===== Draw Grid & Pixels =====
function drawGrid(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.translate(offsetX,offsetY);
  ctx.scale(scale,scale);

  // Draw pixels
  chunks.forEach(chunk=>{
    chunk.forEach(p=>{
      ctx.fillStyle=p.color;
      ctx.fillRect(p.x,p.y,GRID_SIZE,GRID_SIZE);
    });
  });

  // Draw grid
  if(showGrid){
    ctx.strokeStyle="#000";
    ctx.lineWidth=1/scale;
    for(let x=0;x<=WORLD_WIDTH;x+=GRID_SIZE){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,WORLD_HEIGHT); ctx.stroke(); }
    for(let y=0;y<=WORLD_HEIGHT;y+=GRID_SIZE){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(WORLD_WIDTH,y); ctx.stroke(); }
  }

  ctx.restore();
}

// ===== Palette =====
colors.slice(0,6).forEach((c,i)=>{
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

// ===== More Colors Popup =====
moreColorsBtn.addEventListener("click", ()=>{
  if(moreColorsPopup.classList.contains("hidden")){
    moreColorsPopup.classList.remove("hidden");
    setTimeout(()=>moreColorsPopup.classList.add("show"),10);
    moreColorsPopup.innerHTML='';
    colors.slice(6).forEach((c,i)=>{
      const sw=document.createElement("div");
      sw.className="color-swatch";
      sw.style.background=c;
      sw.dataset.color=c;
      sw.textContent=i+6;
      sw.addEventListener("click",()=>{
        currentColor=c;
        document.querySelectorAll(".color-swatch").forEach(s=>s.classList.remove("selected"));
        sw.classList.add("selected");
      });
      moreColorsPopup.appendChild(sw);
    });
  } else {
    moreColorsPopup.classList.remove("show");
    setTimeout(()=>moreColorsPopup.classList.add("hidden"),300);
  }
});

// ===== Grid Toggle =====
toggleGridBtn.addEventListener("click",()=>{
  showGrid=!showGrid;
  toggleGridBtn.style.background=showGrid?"#fff":"#333";
  toggleGridBtn.style.color=showGrid?"#000":"#fff";
  drawGrid();
});

// ===== Zoom & Pan =====
function zoomAt(cx,cy,zoomFactor){
  const newScale=Math.min(Math.max(0.1,scale*zoomFactor),5);
  offsetX-=(cx*(newScale-scale));
  offsetY-=(cy*(newScale-scale));
  scale=newScale;
}
canvas.addEventListener("wheel",e=>{
  e.preventDefault();
  const rect=canvas.getBoundingClientRect();
  const mx=(e.clientX-rect.left-offsetX)/scale;
  const my=(e.clientY-rect.top-offsetY)/scale;
  zoomAt(mx,my,e.deltaY<0?1.1:0.9);
  drawGrid();
});

// Pan
canvas.addEventListener("mousedown",e=>{isDragging=true; dragStartX=e.clientX-offsetX; dragStartY=e.clientY-offsetY;});
canvas.addEventListener("mousemove",e=>{if(isDragging){offsetX=e.clientX-dragStartX; offsetY=e.clientY-dragStartY; drawGrid();}});
canvas.addEventListener("mouseup",()=>{isDragging=false;});
canvas.addEventListener("mouseleave",()=>{isDragging=false;});

// ===== Draw Pixel =====
canvas.addEventListener("click",e=>{
  if(isDragging) return;
  const now=Date.now();
  if(userPoints<=0 && now-lastActionTime<COOLDOWN) return;
  if(userPoints<=0 && now-lastActionTime>=COOLDOWN){ userPoints=1; lastActionTime=now; playSound(pointAudio); }

  const rect=canvas.getBoundingClientRect();
  const worldX=(e.clientX-rect.left-offsetX)/scale;
  const worldY=(e.clientY-rect.top-offsetY)/scale;
  const x=Math.max(0, Math.min(WORLD_WIDTH-GRID_SIZE, Math.floor(worldX/GRID_SIZE)*GRID_SIZE));
  const y=Math.max(0, Math.min(WORLD_HEIGHT-GRID_SIZE, Math.floor(worldY/GRID_SIZE)*GRID_SIZE));

  const pixel={x,y,color:currentColor};
  userPoints--; lastActionTime=Date.now();
  if(!chunks.has("all")) chunks.set("all",[]);
  chunks.get("all").push(pixel);
  playSound(drawAudio);
  drawGrid();
});

// ===== Chat Toggle =====
chatToggle.addEventListener("click", ()=>{
  if(chatPopup.style.height==="40px"){
    chatPopup.style.height="300px";
    chatFeed.style.display="block";
  } else {
    chatPopup.style.height="40px";
    chatFeed.style.display="none";
  }
});

// ===== Chat Input =====
sendBtn.addEventListener("click", sendMessage);
chatInput.addEventListener("keydown",e=>{if(e.key==="Enter"){sendMessage(); e.preventDefault();}});
function sendMessage(){
  const text=chatInput.value.trim();
  if(!text) return;
  const msg=document.createElement("div");
  msg.className="chat-msg"; msg.textContent=text;
  chatFeed.appendChild(msg); chatFeed.scrollTop=chatFeed.scrollHeight;
  chatInput.value="";
}

// ===== Points Display =====
function updatePointsDisplay(){
  if(userPoints>0){ pointsDisplay.style.color="#0f0"; pointsDisplay.textContent=`${userPoints}/6`; }
  else{ const now=Date.now(); const timeLeft=Math.max(0,Math.ceil((COOLDOWN-(now-lastActionTime))/1000)); pointsDisplay.style.color="#f00"; pointsDisplay.textContent=`0/6 ${timeLeft}s`; }
}
setInterval(updatePointsDisplay,1000);
setInterval(()=>{
  if(userPoints<6){ userPoints++; playSound(pointAudio); updatePointsDisplay(); }
},COOLDOWN);

// ===== Animate =====
function animate(){ drawGrid(); requestAnimationFrame(animate); }
animate();

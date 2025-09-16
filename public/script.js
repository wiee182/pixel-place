// ===== Canvas Setup =====
const canvas = document.getElementById("pixelCanvas");
const ctx = canvas.getContext("2d");

let scale = 1, offsetX = 0, offsetY = 0;
let isDragging = false, dragStartX=0, dragStartY=0;

let currentColor = "#fffefe";
let showGrid = true;
let soundEnabled = true;
const chunks = new Map();

const colors = ["#fffefe","#b9c2ce","#767e8c","#424651","#1e1f26","#010100"];

// ===== DOM =====
const paletteDiv = document.getElementById("palette");
const moreBtn = document.getElementById("more-colors");
const moreColorsPopup = document.getElementById("more-colors-popup");
const pointsDisplay = document.getElementById("points-display");
const gridBtn = document.getElementById("toggle-grid");
const soundBtn = document.getElementById("toggle-sound");

// ===== Audio =====
const drawAudio = new Audio('sounds/draw.mp3'); drawAudio.volume=0.2;
function playSound(audio){ if(!soundEnabled) return; audio.cloneNode().play(); }

// ===== Resize =====
function resizeCanvas(){
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  offsetX = (canvas.width - 5000)/2;
  offsetY = (canvas.height - 5000)/2;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// ===== Grid & Draw =====
function drawGrid(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  chunks.forEach(chunk=>{
    chunk.forEach(p=>{
      ctx.fillStyle=p.color;
      ctx.fillRect(p.x,p.y,10,10);
    });
  });

  if(showGrid){
    ctx.strokeStyle="#000";
    ctx.lineWidth=1/scale;
    for(let x=0;x<=5000;x+=10){
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,5000); ctx.stroke();
    }
    for(let y=0;y<=5000;y+=10){
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(5000,y); ctx.stroke();
    }
  }

  ctx.restore();
}

// ===== Palette =====
colors.forEach(c=>{
  const sw = document.createElement("div");
  sw.className="color-swatch";
  sw.style.background=c;
  sw.dataset.color=c;
  sw.addEventListener("click",()=>{
    document.querySelectorAll(".color-swatch").forEach(s=>s.classList.remove("selected"));
    sw.classList.add("selected");
    currentColor=c;
  });
  paletteDiv.appendChild(sw);
});
document.querySelector(".color-swatch").classList.add("selected");

// ===== Interactions =====
canvas.addEventListener("click", e=>{
  if(isDragging) return;
  const rect = canvas.getBoundingClientRect();
  const worldX = (e.clientX-rect.left-offsetX)/scale;
  const worldY = (e.clientY-rect.top-offsetY)/scale;
  const x = Math.floor(worldX/10)*10;
  const y = Math.floor(worldY/10)*10;
  const key = `${Math.floor(x/100)},${Math.floor(y/100)}`;
  if(!chunks.has(key)) chunks.set(key, []);
  chunks.get(key).push({x,y,color:currentColor});
  playSound(drawAudio);
  drawGrid();
});

canvas.addEventListener("mousedown", e=>{
  isDragging=true; 
  dragStartX=e.clientX-offsetX; 
  dragStartY=e.clientY-offsetY;
});
canvas.addEventListener("mousemove", e=>{
  if(isDragging){ offsetX=e.clientX-dragStartX; offsetY=e.clientY-dragStartY; drawGrid(); }
});
canvas.addEventListener("mouseup", ()=>{isDragging=false;});
canvas.addEventListener("mouseleave", ()=>{isDragging=false;});

canvas.addEventListener("wheel", e=>{
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX-rect.left-offsetX)/scale;
  const my = (e.clientY-rect.top-offsetY)/scale;
  const zoom = e.deltaY<0?1.1:0.9;
  const newScale = Math.min(Math.max(0.1, scale*zoom),5);
  offsetX -= (mx*(newScale-scale));
  offsetY -= (my*(newScale-scale));
  scale=newScale;
  drawGrid();
});

// ===== Buttons =====
gridBtn.addEventListener("click", ()=>{ showGrid=!showGrid; drawGrid(); });
soundBtn.addEventListener("click", ()=>{ soundEnabled=!soundEnabled; soundBtn.textContent=soundEnabled?"🔊":"🔇"; });
moreBtn.addEventListener("click", ()=>{ moreColorsPopup.classList.toggle("hidden"); });

// ===== Chat =====
const chatPopup = document.getElementById("chat-popup");
const chatHeader = document.getElementById("chat-header");
const chatFeed = document.getElementById("chat-feed");
const chatInput = document.getElementById("chat-message");
const sendBtn = document.getElementById("send-message");

chatHeader.addEventListener("click", ()=> chatPopup.classList.toggle("minimized"));
sendBtn.addEventListener("click", sendMessage);
chatInput.addEventListener("keydown", e=>{ if(e.key==="Enter"){sendMessage(); e.preventDefault();} });

function sendMessage(){
  const text = chatInput.value.trim();
  if(!text) return;
  const msg = document.createElement("div");
  msg.className="chat-msg";
  msg.textContent=text;
  chatFeed.appendChild(msg);
  chatFeed.scrollTop = chatFeed.scrollHeight;
  chatInput.value='';
}

// ===== Animate =====
function animate(){ drawGrid(); requestAnimationFrame(animate); }
animate();

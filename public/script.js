// ===== Canvas Setup =====
const canvas = document.getElementById("pixelCanvas");
const ctx = canvas.getContext("2d");
let scale = 1, offsetX = 0, offsetY = 0;
let isDragging = false, dragStartX = 0, dragStartY = 0;
const GRID_SIZE = 10, WORLD_WIDTH = 5000, WORLD_HEIGHT = 5000;
const chunks = new Map();

// ===== Colors =====
const colors = [
  "#fffefe","#b9c2ce","#767e8c","#424651","#1e1f26","#010100",
  "#ff0000","#00ff00","#0000ff","#ffff00","#ff00ff","#00ffff",
  "#ffa500","#800080","#008000","#00ced1","#ff1493","#ffd700",
  "#a52a2a","#808000"
];
let currentColor = colors[0];

// ===== Palette + Points =====
const paletteDiv = document.getElementById("palette");
const moreColorsPopup = document.getElementById("more-colors-popup");
const moreBtn = document.getElementById("more-colors");

// Main swatch
const mainSwatch = document.createElement("div");
mainSwatch.className = "color-swatch selected";
mainSwatch.style.background = currentColor;
mainSwatch.innerHTML = `<span id="points-display">${6}/6</span>`;
paletteDiv.appendChild(mainSwatch);

// Cooldown ring
const cooldownRing = document.createElementNS("http://www.w3.org/2000/svg","svg");
cooldownRing.setAttribute("id","cooldown-ring");
cooldownRing.setAttribute("width","50");
cooldownRing.setAttribute("height","50");
cooldownRing.innerHTML = `
  <circle id="ring-bg" cx="25" cy="25" r="22" stroke="#333" stroke-width="4" fill="none"/>
  <circle id="ring-progress" cx="25" cy="25" r="22" stroke="#00ffff" stroke-width="4" fill="none" stroke-dasharray="138" stroke-dashoffset="138"/>
`;
mainSwatch.appendChild(cooldownRing);
const ringProgress = cooldownRing.querySelector("#ring-progress");

// Popup colors
colors.forEach(c=>{
  const sw=document.createElement("div");
  sw.className="color-swatch";
  sw.style.background=c;
  sw.addEventListener("click",()=>{
    currentColor=c;
    mainSwatch.style.background=c;
    moreColorsPopup.querySelectorAll(".color-swatch").forEach(s=>s.classList.remove("selected"));
    sw.classList.add("selected");
    moreColorsPopup.classList.remove("show");
  });
  moreColorsPopup.appendChild(sw);
});
moreBtn.addEventListener("click",e=>{e.stopPropagation();moreColorsPopup.classList.toggle("show");});
document.addEventListener("click",e=>{if(!moreColorsPopup.contains(e.target)&&e.target!==moreBtn)moreColorsPopup.classList.remove("show");});

// ===== Chat =====
const chatBox=document.getElementById("chat-box");
const chatHeader=document.getElementById("chat-header");
const chatFeed=document.getElementById("chat-feed");
const chatInput=document.getElementById("chat-message");
const sendBtn=document.getElementById("send-message");
chatHeader.addEventListener("click",()=>chatBox.classList.toggle("minimized"));
function addChatMessage(user,text){const msg=document.createElement("div");msg.className="chat-msg";msg.textContent=`${user}: ${text}`;chatFeed.appendChild(msg);chatFeed.scrollTop=chatFeed.scrollHeight;}
sendBtn.addEventListener("click",sendMessage);
chatInput.addEventListener("keydown",e=>{if(e.key==="Enter"){sendMessage();e.preventDefault();}});
function sendMessage(){const text=chatInput.value.trim();if(!text)return;ws.send(JSON.stringify({type:"chat",user:"anon",message:text}));chatInput.value="";}

// ===== Points + Cooldown =====
const MAX_POINTS=6;
let points=MAX_POINTS,lastPlaceTime=Date.now(),COOLDOWN=20000;
function updateRing(){const ratio=points/MAX_POINTS;const circumference=2*Math.PI*22;ringProgress.style.strokeDasharray=circumference;ringProgress.style.strokeDashoffset=circumference*(1-ratio);}
function updatePoints(p){points=p;mainSwatch.querySelector("#points-display").textContent=`${points}/${MAX_POINTS}`;updateRing();}
setInterval(()=>{const now=Date.now();if(points<MAX_POINTS && now-lastPlaceTime>=COOLDOWN){points++;updatePoints(points);lastPlaceTime=now;}},1000);

// ===== Audio & Grid =====
const drawAudio=document.getElementById("draw-sound");
let soundEnabled=true,showGrid=true;
document.getElementById("toggle-sound").addEventListener("click",()=>soundEnabled=!soundEnabled);
document.getElementById("toggle-grid").addEventListener("click",()=>{showGrid=!showGrid;drawGrid();});

// ===== WebSocket =====
const ws=new WebSocket(location.origin.replace(/^http/,"ws"));
ws.onmessage=event=>{const data=JSON.parse(event.data);
  if(data.type==="init"){data.canvas.forEach(p=>setPixel(p.x,p.y,p.color));drawGrid();chatFeed.innerHTML="";data.chat.forEach(m=>addChatMessage(m.user,m.message));updatePoints(data.points);}
  if(data.type==="draw"){setPixel(data.x,data.y,data.color);drawGrid();if(soundEnabled)drawAudio.cloneNode().play();}
  if(data.type==="chat") addChatMessage(data.user,data.message);
  if(data.type==="points") updatePoints(data.points);
  if(data.type==="error") console.warn(data.message);
};

// ===== Pixel Helpers =====
function setPixel(x,y,color){const key=`${Math.floor(x/100)},${Math.floor(y/100)}`;if(!chunks.has(key)) chunks.set(key,[]);const chunk=chunks.get(key);const idx=chunk.findIndex(p=>p.x===x&&p.y===y);if(idx>=0) chunk[idx].color=color;else chunk.push({x,y,color});}

// ===== Drawing =====
canvas.addEventListener("click",e=>{if(isDragging||points<=0)return;const rect=canvas.getBoundingClientRect();const worldX=(e.clientX-rect.left-offsetX)/scale;const worldY=(e.clientY-rect.top-offsetY)/scale;const x=Math.max(0,Math.min(WORLD_WIDTH-GRID_SIZE,Math.floor(worldX/GRID_SIZE)*GRID_SIZE));const y=Math.max(0,Math.min(WORLD_HEIGHT-GRID_SIZE,Math.floor(worldY/GRID_SIZE)*GRID_SIZE));ws.send(JSON.stringify({type:"draw",x,y,color:currentColor,user:"anon"}));if(soundEnabled)drawAudio.cloneNode().play();points=Math.max(0,points-1);lastPlaceTime=Date.now();updatePoints(points);});

// Pan & Zoom
canvas.addEventListener("mousedown",e=>{isDragging=true;dragStartX=e.clientX-offsetX;dragStartY=e.clientY-offsetY;});
canvas.addEventListener("mousemove",e=>{if(isDragging){offsetX=e.clientX-dragStartX;offsetY=e.clientY-dragStartY;drawGrid();}});
canvas.addEventListener("mouseup",()=>isDragging=false);
canvas.addEventListener("mouseleave",()=>isDragging=false);
canvas.addEventListener("wheel",e=>{e.preventDefault();const rect=canvas.getBoundingClientRect();const mx=(e.clientX-rect.left-offsetX)/scale;const my=(e.clientY-rect.top-offsetY)/scale;const zoom=e.deltaY<0?1.1:0.9;const newScale=Math.min(Math.max(0.1,scale*zoom),5);offsetX-=(mx*(newScale-scale));offsetY-=(my*(newScale-scale));scale=newScale;drawGrid();});

// Resize
function resizeCanvas(){canvas.width=canvas.parentElement.clientWidth;canvas.height=canvas.parentElement.clientHeight;offsetX=(canvas.width-WORLD_WIDTH)/2;offsetY=(canvas.height-WORLD_HEIGHT)/2;}
window.addEventListener("resize",resizeCanvas);resizeCanvas();

// Draw Loop
function drawGrid(){
  ctx.fillStyle="#fff";
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.save();ctx.translate(offsetX,offsetY);ctx.scale(scale,scale);
  chunks.forEach(chunk=>{chunk.forEach(p=>{ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,GRID_SIZE,GRID_SIZE);});});
  if(showGrid){ctx.strokeStyle="#ccc";ctx.lineWidth=1/scale;for(let x=0;x<=WORLD_WIDTH;x+=GRID_SIZE){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,WORLD_HEIGHT);ctx.stroke();}for(let y=0;y<=WORLD_HEIGHT;y+=GRID_SIZE){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(WORLD_WIDTH,y);ctx.stroke();}}
  ctx.restore();
}
function animate(){drawGrid();requestAnimationFrame(animate);}
animate();

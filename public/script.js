// ===== Canvas Setup =====
const canvas = document.getElementById("pixelCanvas");
const ctx = canvas.getContext("2d");

let scale = 1, offsetX = 0, offsetY = 0;
let isDragging = false, dragStartX=0, dragStartY=0;

let currentColor = "#fffefe";
let showGrid = true;
const chunks = new Map();

let userPoints = 6;
let soundEnabled = true;

// ===== WebSocket =====
const ws = new WebSocket(window.location.origin.replace(/^http/,"ws"));

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === "init") {
    data.chat.forEach(msg => addChatMessage(msg.text));
    data.chunks.forEach(([key, pixels]) => {
      chunks.set(key, pixels);
    });
    drawGrid();
  }

  if (data.type === "draw") {
    const key = `${Math.floor(data.x/100)},${Math.floor(data.y/100)}`;
    if (!chunks.has(key)) chunks.set(key, []);
    const chunk = chunks.get(key);
    const idx = chunk.findIndex(p=>p.x===data.x && p.y===data.y);
    if(idx>=0) chunk[idx]=data; else chunk.push(data);
    drawGrid();
  }

  if (data.type === "chat") {
    addChatMessage(data.text);
  }
};

// ===== Resize =====
function resizeCanvas(){
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;
  offsetX = (canvas.width - 5000)/2;
  offsetY = (canvas.height - 5000)/2;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// ===== Draw Grid =====
function drawGrid(){
  ctx.fillStyle = "#000"; // fill background black
  ctx.fillRect(0,0,canvas.width,canvas.height);

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // white canvas block
  ctx.fillStyle = "#fff";
  ctx.fillRect(0,0,5000,5000);

  // draw pixels
  chunks.forEach(chunk=>{
    chunk.forEach(p=>{
      ctx.fillStyle=p.color;
      ctx.fillRect(p.x,p.y,10,10);
    });
  });

  if(showGrid){
    ctx.strokeStyle="rgba(0,0,0,0.3)";
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
const colors = ["#fffefe","#b9c2ce","#767e8c","#424651","#1e1f26","#010100"];
const extraColors = ["#ff0000","#00ff00","#0000ff","#ffff00","#ff00ff","#00ffff","#ffa500","#800080","#808000","#008080"];

const paletteDiv = document.getElementById("palette");
colors.forEach((c,i)=>{
  const sw = document.createElement("div");
  sw.className="color-swatch";
  sw.style.background=c;
  sw.dataset.color=c;
  sw.textContent=i;
  sw.addEventListener("click",()=>selectColor(sw,c));
  paletteDiv.appendChild(sw);
});
document.querySelector(".color-swatch").classList.add("selected");

function selectColor(sw,color){
  document.querySelectorAll(".color-swatch").forEach(s=>s.classList.remove("selected"));
  sw.classList.add("selected");
  currentColor=color;
}

// ===== Extra Palette Popup =====
const colorBtn = document.getElementById("color-popup-btn");
const colorPopup = document.getElementById("color-popup");
const extraPalette = document.getElementById("extra-palette");

extraColors.forEach(c=>{
  const sw = document.createElement("div");
  sw.className="color-swatch";
  sw.style.background=c;
  sw.dataset.color=c;
  sw.addEventListener("click",()=>selectColor(sw,c));
  extraPalette.appendChild(sw);
});

colorBtn.addEventListener("click", ()=>{
  colorPopup.classList.toggle("hidden");
});

// ===== Chat =====
const chatPopup = document.getElementById("chat-popup");
const chatHeader = document.getElementById("chat-header");
const chatToggle = document.getElementById("chat-toggle");
const chatFeed = document.getElementById("chat-feed");
const chatInput = document.getElementById("chat-message");
const sendBtn = document.getElementById("send-message");

chatHeader.addEventListener("click", ()=>{
  chatPopup.classList.toggle("minimized");
  chatToggle.textContent = chatPopup.classList.contains("minimized") ? "▲" : "▼";
});

sendBtn.addEventListener("click", sendMessage);
chatInput.addEventListener("keydown", e=>{if(e.key==="Enter"){sendMessage(); e.preventDefault();}});
function sendMessage(){
  const text = chatInput.value.trim();
  if(!text) return;
  ws.send(JSON.stringify({type:"chat", text}));
  chatInput.value='';
}
function addChatMessage(text){
  const msg = document.createElement("div");
  msg.className="chat-msg";
  msg.textContent=text;
  chatFeed.appendChild(msg);
  chatFeed.scrollTop = chatFeed.scrollHeight;
}

// ===== Animate =====
function animate(){ drawGrid(); requestAnimationFrame(animate); }
animate();

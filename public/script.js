const canvas = document.getElementById("pixelCanvas");
const ctx = canvas.getContext("2d");

let canvasWidth = window.innerWidth;
let canvasHeight = window.innerHeight;
canvas.width = canvasWidth;
canvas.height = canvasHeight;

const GRID_SIZE = 10;
const WORLD_WIDTH = 500;
const WORLD_HEIGHT = 500;

let scale = 1;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let startX = 0, startY = 0;

let currentColor = "#fffefe";
let showGrid = true;

const pixels = new Map();

// ===== Draw canvas =====
function drawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Draw pixels
    pixels.forEach(p => ctx.fillStyle = p.color, ctx.fillRect(p.x, p.y, GRID_SIZE, GRID_SIZE));

    // Draw grid
    if(showGrid){
        ctx.strokeStyle = "#222"; ctx.lineWidth = 1/scale;
        for(let x=0;x<=WORLD_WIDTH;x+=GRID_SIZE){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,WORLD_HEIGHT); ctx.stroke(); }
        for(let y=0;y<=WORLD_HEIGHT;y+=GRID_SIZE){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(WORLD_WIDTH,y); ctx.stroke(); }
    }
    ctx.restore();
}
drawCanvas();

// ===== Palette =====
const paletteColors = ["#fffefe","#b9c2ce","#767e8c","#424651","#1e1f26","#010100"];
const paletteDiv = document.getElementById("palette");

paletteColors.forEach((c,i)=>{
    const sw = document.createElement("div");
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

// ===== Canvas interactions =====
canvas.addEventListener("mousedown", e=>{ isDragging=true; startX=e.clientX-offsetX; startY=e.clientY-offsetY; });
canvas.addEventListener("mouseup", ()=>{ isDragging=false; });
canvas.addEventListener("mousemove", e=>{ if(isDragging){ offsetX=e.clientX-startX; offsetY=e.clientY-startY; drawCanvas(); } });

canvas.addEventListener("click", e=>{
    if(isDragging) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX-rect.left-offsetX)/scale/GRID_SIZE)*GRID_SIZE;
    const y = Math.floor((e.clientY-rect.top-offsetY)/scale/GRID_SIZE)*GRID_SIZE;
    pixels.set(`${x},${y}`, {x,y,color:currentColor});
    drawCanvas();
});

// ===== Zoom =====
canvas.addEventListener("wheel", e=>{
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx=(e.clientX-rect.left-offsetX)/scale;
    const my=(e.clientY-rect.top-offsetY)/scale;
    const zoom = e.deltaY<0 ? 1.1 : 0.9;
    scale = Math.max(0.1, Math.min(10, scale*zoom));
    offsetX = e.clientX - mx*scale;
    offsetY = e.clientY - my*scale;
    drawCanvas();
});

// ===== Grid button =====
document.getElementById("toggle-grid").addEventListener("click", ()=>{
    showGrid = !showGrid;
    document.getElementById("toggle-grid").style.background = showGrid?"#fff":"#333";
    drawCanvas();
});

// ===== Chat =====
const chatInput = document.getElementById("chat-message");
const chatFeed = document.getElementById("chat-feed");

document.getElementById("send-message").addEventListener("click", sendChat);
chatInput.addEventListener("keydown", e=>{ if(e.key==="Enter") sendChat(); });

function sendChat(){
    if(chatInput.value.trim()==="") return;
    const msg = document.createElement("div");
    msg.className="chat-msg";
    msg.textContent = chatInput.value;
    chatFeed.appendChild(msg);
    chatInput.value="";
    chatFeed.scrollTop = chatFeed.scrollHeight;
}

// ===== Minimize chat =====
document.getElementById("minimize-chat").addEventListener("click", ()=>{
    const chat = document.getElementById("chat-popup");
    chat.style.display = (chat.style.display==="none")?"flex":"none";
});

// ===== Window resize =====
window.addEventListener("resize", ()=>{
    canvasWidth = window.innerWidth;
    canvasHeight = window.innerHeight;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    drawCanvas();
});

const WebSocket = require("ws");
const express = require("express");
const http = require("http");

const app = express();
app.use(express.static("public"));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const CHUNK_SIZE = 100;
const chunks = new Map();
const chatMessages = [];

const userData = new Map(); // ws => { points, lastAction }

wss.on("connection", ws => {
  userData.set(ws, { points: 6, lastAction: Date.now() });

  ws.send(JSON.stringify({ type:"init", chat:chatMessages, points:6 }));

  ws.on("message", msg=>{
    const data=JSON.parse(msg);
    const user=userData.get(ws);
    const now=Date.now();

    if(data.type==="draw"){
      if(user.points<=0) return;
      user.points--; user.lastAction=now;
      const chunkX=Math.floor(data.x/CHUNK_SIZE), chunkY=Math.floor(data.y/CHUNK_SIZE);
      const key=`${chunkX},${chunkY}`;
      if(!chunks.has(key)) chunks.set(key,[]);
      const chunk=chunks.get(key);
      const idx=chunk.findIndex(p=>p.x===data.x && p.y===data.y);
      if(idx>=0) chunk[idx]=data; else chunk.push(data);

      ws.send(JSON.stringify({ type:"points", points:user.points, cooldown:20000 }));
      wss.clients.forEach(c=>{if(c.readyState===WebSocket.OPEN) c.send(JSON.stringify(data));});
    }

    if(data.type==="chat"){
      chatMessages.push(data);
      wss.clients.forEach(c=>{if(c.readyState===WebSocket.OPEN) c.send(JSON.stringify(data));});
    }
  });

  ws.on("close",()=>userData.delete(ws));
});

// Regen points every second
setInterval(()=>{
  const now=Date.now();
  userData.forEach((user,ws)=>{
    if(user.points<6 && now-user.lastAction>=20000){
      user.points++; user.lastAction=now;
      if(ws.readyState===WebSocket.OPEN){
        ws.send(JSON.stringify({ type:"points", points:user.points, cooldown: user.points<6?20000:null }));
      }
    }
  });
},1000);

const PORT=process.env.PORT||8080;
server.listen(PORT,()=>console.log(`Server running on ${PORT}`));

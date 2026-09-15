import { ROADS, MANUAL_PAGES, TRAVERSAL_FEATURES } from './world-data.js';
import { drawSettlement, drawSettlementForeground, settlementInteractionNodes } from './settlement-render.js';
import { drawInteriorScene, interiorInteractionNodes } from './interior-render.js';
import { drawAsset, landmarkAsset, terrainAsset, npcAsset, playerAsset } from './assets.js';
import { cameraOffset } from './camera.js';
import { echoNodes } from './world-echoes.js';

export const WORLD = { w:96, h:72, tile:16 };
export const INTERIOR_STATIONS = [
  {id:'state',x:5,y:5,icon:'◆'}, {id:'artifacts',x:17,y:5,icon:'▣'}, {id:'history',x:27,y:5,icon:'◷'},
  {id:'quests',x:8,y:15,icon:'⚑'}, {id:'purpose',x:22,y:15,icon:'◇'}, {id:'exit',x:15,y:20,icon:'⇩'}
];
const palettes={
  obsidian:['#090a0f','#111323','#18182b','#24203b'], scrapyard:['#2f291f','#423823','#5b4727','#72572b'],
  highlands:['#17382d','#1e4a3c','#285a49','#356c57'], market:['#3b2921','#4c3429','#5b4031','#6d4d38'],
  orbital:['#1e232d','#292f3b','#333c49','#404a58']
};
const conditionTone={sealed:'#efc95f',active:'#65e38c',open:'#e6b85a',blocked:'#e65b58',dormant:'#ab8bc7',unknown:'#8d96a5',quiet:'#8bb3c7'};
const rng=(x,y)=>{const n=Math.sin(x*12.9898+y*78.233)*43758.5453;return n-Math.floor(n)};
const dist=(a,b,c,d)=>Math.hypot(a-c,b-d);
const regionAt=(projects,x,y)=>projects.find(p=>dist(x,y,p.x,p.y)<9.5)||null;
const w2s=(x,y,cx,cy,canvas)=>[(x-cx)*WORLD.tile+canvas.width/2,(y-cy)*WORLD.tile+canvas.height/2];
const viewCenter=game=>[game.camera?.x??game.state.player.x,game.camera?.y??game.state.player.y];
function line(ctx,x1,y1,x2,y2,color,w=1){ctx.strokeStyle=color;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()}

function drawBiomeTile(ctx,p,x,y,sx,sy,t,visited){
  const pal=palettes[p.biome]||palettes.highlands; ctx.fillStyle=pal[Math.floor(rng(x,y)*pal.length)];ctx.fillRect(sx,sy,WORLD.tile+1,WORLD.tile+1);
  if(p.biome==='obsidian'){
    ctx.fillStyle='#0008';ctx.fillRect(sx,sy+13,16,3);
    if(rng(x+3,y+9)>.72){ctx.strokeStyle='#3d9ce077';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(sx+rng(x,y)*16,sy);ctx.quadraticCurveTo(sx+8,sy+8,sx+rng(y,x)*16,sy+16);ctx.stroke()}
  }else if(p.biome==='scrapyard'){
    ctx.fillStyle='#b6843544';ctx.fillRect(sx+2,sy+2,1,11);ctx.fillRect(sx+2,sy+12,9,1);if(rng(x,y)>.8){ctx.fillStyle='#44d8e866';ctx.fillRect(sx+10,sy+5,2,2)}
  }else if(p.biome==='highlands'){
    ctx.fillStyle='#a9d2a51f';if(rng(x,y)>.65){ctx.fillRect(sx+3,sy+3,2,5);ctx.fillRect(sx+9,sy+7,2,4)}
  }else if(p.biome==='market'){
    ctx.strokeStyle='#d7b57422';ctx.strokeRect(sx+1,sy+1,14,14);if((x+y)%2===0)line(ctx,sx+1,sy+8,sx+15,sy+8,'#0003');  }else if(p.biome==='orbital'){
    ctx.strokeStyle='#8998ad25';ctx.strokeRect(sx+1,sy+1,14,14);ctx.fillStyle='#b7c4d511';ctx.fillRect(sx+7,sy+2,1,12);
  }
  const tex=p.biome==='market'?terrainAsset.stone:p.biome==='scrapyard'?(rng(x,y)>.45?terrainAsset.stone:terrainAsset.dirt):p.biome==='highlands'?(rng(x,y)>.76?terrainAsset.forest:terrainAsset.grass):p.biome==='orbital'?terrainAsset.stone:terrainAsset.stone;
  if(tex)drawAsset(ctx,tex,sx,sy,WORLD.tile+1,WORLD.tile+1,p.biome==='obsidian'?.28:.74);
  if(p.biome==='obsidian'){ctx.fillStyle='#05091399';ctx.fillRect(sx,sy,17,17)}
  if(visited&&rng(x+31,y+7)>.94){ctx.fillStyle='#f6ca6044';ctx.fillRect(sx+7,sy+7,2,2)}
}
function drawBaseGround(ctx,game){
  const {canvas}=game,[cx,cy]=viewCenter(game);
  const minX=Math.floor(cx-32),maxX=Math.ceil(cx+32),minY=Math.floor(cy-20),maxY=Math.ceil(cy+20);
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
    const [sx,sy]=w2s(x,y,cx,cy,canvas); const p=regionAt(game.projects,x,y);
    if(p) drawBiomeTile(ctx,p,x,y,sx,sy,game.now,game.state.visited[p.id]);
    else {const v=rng(x,y);ctx.fillStyle=v>.84?'#254d35':v<.09?'#142d20':'#1c3d2b';ctx.fillRect(sx,sy,17,17);drawAsset(ctx,v>.84?terrainAsset.flowers:terrainAsset.grass,sx,sy,17,17,.82);if(v>.9){ctx.fillStyle='#bdd99a33';ctx.fillRect(sx+4,sy+5,1,5);ctx.fillRect(sx+10,sy+8,1,4)}}
  }
}
function drawRiver(ctx,game){
  const {canvas}=game,[cx,cy]=viewCenter(game),t=game.now*.001;ctx.fillStyle='#12364a';
  for(let y=0;y<WORLD.h;y++){const x=38+Math.sin(y*.18)*3.8;const[sx,sy]=w2s(x,y,cx,cy,canvas);ctx.fillRect(sx-5,sy,30,17);drawAsset(ctx,terrainAsset.water,sx-5,sy,30,17,.92);if(y%3===0){ctx.strokeStyle='#bdefff66';ctx.beginPath();ctx.arc(sx+8+Math.sin(t+y)*7,sy+8,4+Math.sin(t*2+y)*2,0,Math.PI);ctx.stroke()}}
}
function roadPoints(a,b){const out=[];for(let i=0;i<=48;i++){const t=i/48;out.push([a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t])}return out}
function drawRoad(ctx,game,a,b,bright=false){
  const [cx,cy]=viewCenter(game);for(const [x,y] of roadPoints(a,b)){const[sx,sy]=w2s(x,y,cx,cy,game.canvas);ctx.fillStyle=bright?'#d3b75c':'#826f52';ctx.fillRect(sx+5,sy+6,bright?8:7,bright?6:5);if(bright&&rng(x,y)>.83){ctx.fillStyle='#fff4b544';ctx.fillRect(sx+7,sy+8,3,2)}}
}
function drawRoads(ctx,game){
  for(const [aId,bId] of ROADS){const a=game.projects.find(p=>p.id===aId),b=game.projects.find(p=>p.id===bId);if(a&&b)drawRoad(ctx,game,a,b,false)}
  for(const r of game.relationships){if(!game.state.expeditions[r.id]?.unlocked)continue;const a=game.projects.find(p=>p.id===r.a),b=game.projects.find(p=>p.id===r.b);if(a&&b)drawRoad(ctx,game,a,b,true)}
}
function drawElevation(ctx,game,p){
  const [cx,cy]=viewCenter(game);for(let ring=p.elevation;ring>0;ring--){const radius=7+ring*.8;ctx.strokeStyle=`rgba(7,8,12,${.13+ring*.05})`;ctx.lineWidth=3;ctx.beginPath();for(let i=0;i<=48;i++){const a=i/48*Math.PI*2,x=p.x+Math.cos(a)*radius,y=p.y+Math.sin(a)*radius*.72;const[sx,sy]=w2s(x,y,cx,cy,game.canvas);if(i===0)ctx.moveTo(sx,sy+ring*2);else ctx.lineTo(sx,sy+ring*2)}ctx.stroke()}
}
function projectStatusDecor(ctx,p,game,sx,sy){  const tone=conditionTone[p.condition]||'#aaa';const t=game.now*.001;
  if(p.condition==='blocked'){
    ctx.fillStyle='#d54843aa';for(let i=0;i<5;i++){const ox=Math.sin(t*3+i)*22,oy=-48-i*7;ctx.fillRect(ox,oy,2,10)}
    ctx.strokeStyle='#f7826b88';ctx.beginPath();ctx.moveTo(-42,-54);ctx.lineTo(-26,-70);ctx.lineTo(-10,-58);ctx.stroke();
  } else if(p.condition==='sealed'){
    ctx.fillStyle='#f6c65b55';for(let i=0;i<7;i++){const a=t*.3+i;ctx.fillRect(Math.cos(a)*38,Math.sin(a)*19-28,2,2)}
  } else if(p.condition==='unknown'){
    ctx.fillStyle='#aeb6c222';for(let i=0;i<5;i++){ctx.beginPath();ctx.arc(Math.sin(t*.2+i)*35,-20+i*7,18,0,Math.PI*2);ctx.fill()}
  } else if(p.condition==='dormant'){
    ctx.fillStyle='#a77b4d88';for(let i=0;i<6;i++)ctx.fillRect(-38+i*13,-18+Math.sin(t+i)*5,2,2);
  } else {
    ctx.fillStyle=tone;const blink=Math.sin(t*2)>0?1:.4;ctx.globalAlpha=blink;ctx.fillRect(-3,-56,6,5);ctx.globalAlpha=1;
  }
  if(game.changedIds.has(p.id)){ctx.strokeStyle='#fff28a';ctx.lineWidth=2;ctx.strokeRect(-48,-70,96,112)}
}
function drawLandmark(ctx,p,game){
  const visited=game.state.visited[p.id];ctx.save();
  const art=landmarkAsset[p.id];
  const size=p.id==='dash'?[-70,-96,140,112]:p.id==='orbital'?[-58,-112,116,128]:[-58,-110,116,116];
  if(art&&drawAsset(ctx,art,...size,1)){
    if(p.id==='starsilk'){ctx.strokeStyle='#55b8ff';ctx.lineWidth=.7;for(let i=0;i<14;i++){ctx.beginPath();ctx.moveTo(-48+i*7,-8);ctx.quadraticCurveTo(-28+Math.sin(game.now*.001+i)*36,-58,-16+i*2,-101);ctx.stroke()}}
    projectStatusDecor(ctx,p,game,0,0);ctx.fillStyle=visited?'#f8d47c':'#f2ead2';ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.fillText(p.landmark.toUpperCase(),0,38);ctx.fillStyle='#bfc8d4';ctx.font='8px monospace';ctx.fillText(p.name.toUpperCase(),0,50);ctx.restore();return;
  }
  if(p.id==='starsilk'){
    ctx.fillStyle='#05050a';ctx.fillRect(-48,-36,96,62);ctx.fillStyle='#11101e';ctx.fillRect(-24,-70,48,66);ctx.fillRect(-9,-96,18,30);ctx.fillStyle='#34507f';ctx.fillRect(-5,-112,10,18);
    ctx.strokeStyle='#49aaff';ctx.lineWidth=.8;for(let i=0;i<18;i++){ctx.beginPath();ctx.moveTo(-40+i*5,-32);ctx.quadraticCurveTo(-20+Math.sin(game.now*.001+i)*28,-62,-12+i*2,-103);ctx.stroke()}
  } else if(p.id==='screen-weasels'){
    ctx.fillStyle='#1a1b1d';ctx.fillRect(-48,-28,96,54);ctx.fillStyle='#d2a145';ctx.fillRect(-34,-18,28,21);ctx.fillStyle='#31c8df';ctx.fillRect(8,-18,28,21);ctx.fillStyle='#0a0d10';ctx.fillRect(-30,-14,20,13);ctx.fillRect(12,-14,20,13);ctx.fillStyle='#47ddf2';ctx.fillRect(-23,-9,5,5);ctx.fillStyle='#f3ad50';ctx.fillRect(21,-9,5,5);ctx.fillStyle='#666';ctx.fillRect(-40,-60,4,32);ctx.fillRect(36,-68,4,40);line(ctx,-38,-58,38,-65,'#a8a8a8');
    ctx.fillStyle='#8feeff';ctx.fillRect(-42,-68+Math.sin(game.now*.003)*2,8,2);
  } else if(p.id==='atlas'){
    ctx.fillStyle='#7f8274';ctx.fillRect(-45,-30,90,55);ctx.fillStyle='#303643';ctx.fillRect(-30,-54,60,28);ctx.fillStyle='#a6d9cf';ctx.fillRect(-5,-88,10,36);ctx.strokeStyle='#b7e9dd';ctx.beginPath();ctx.arc(0,-56,34,Math.PI,Math.PI*2);ctx.stroke();ctx.fillStyle='#68523e';ctx.fillRect(-8,-6,16,31);ctx.fillStyle='#cceee8';ctx.fillRect(-2,-104,4,18);
  } else if(p.id==='dash'){
    ctx.fillStyle='#633f2f';ctx.fillRect(-50,-30,100,56);ctx.fillStyle='#d4b35e';ctx.fillRect(-44,-22,88,10);ctx.fillStyle='#211917';ctx.fillRect(-11,-8,22,34);ctx.fillStyle='#c99f45';for(let i=0;i<5;i++)ctx.fillRect(-38+i*19,-11,8,8);ctx.fillStyle='#efe1af';ctx.fillRect(-42,-48,84,13);ctx.fillStyle='#3b2b22';ctx.font='bold 8px monospace';ctx.textAlign='center';ctx.fillText('LEDGER',0,-39);
  } else {
    ctx.fillStyle='#394250';ctx.fillRect(-52,-27,104,52);ctx.fillStyle='#77869a';ctx.fillRect(-28,-52,56,27);ctx.fillStyle='#10151e';ctx.fillRect(-10,-6,20,31);ctx.strokeStyle='#9aacbd';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,-37,36,0,Math.PI*2);ctx.stroke();ctx.save();ctx.rotate(game.now*.0003);for(let i=0;i<4;i++)line(ctx,0,0,Math.cos(i*Math.PI/2)*36,Math.sin(i*Math.PI/2)*36,'#8495aa');ctx.restore();
  }  projectStatusDecor(ctx,p,game,0,0);ctx.fillStyle=visited?'#f6c65b':'#dfe7f0';ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.fillText(p.landmark.toUpperCase(),0,42);ctx.fillStyle='#94a0af';ctx.font='8px monospace';ctx.fillText(p.name.toUpperCase(),0,54);ctx.restore();
}
function drawProjects(ctx,game){
  const [cx,cy]=viewCenter(game);for(const p of game.projects){drawElevation(ctx,game,p);drawSettlement(ctx,game,p);const[sx,sy]=w2s(p.x,p.y,cx,cy,game.canvas);if(sx<-130||sy<-140||sx>game.canvas.width+130||sy>game.canvas.height+140)continue;ctx.save();ctx.translate(sx,sy);drawLandmark(ctx,p,game);ctx.restore()}
}
function drawProjectForeground(ctx,game){
  const [cx,cy]=viewCenter(game),py=game.state.player.y;for(const p of game.projects){if(p.y<=py+.35||dist(game.state.player.x,game.state.player.y,p.x,p.y)>12)continue;const[sx,sy]=w2s(p.x,p.y,cx,cy,game.canvas);ctx.save();ctx.translate(sx,sy);drawLandmark(ctx,p,game);ctx.restore()}
}
function drawTraversal(ctx,game){
  const [cx,cy]=viewCenter(game);for(const f of TRAVERSAL_FEATURES){const[sx,sy]=w2s(f.x,f.y,cx,cy,game.canvas);ctx.fillStyle=f.kind==='climb'?'#b2a27b':'#756687';if(f.kind==='climb'){for(let i=0;i<4;i++)ctx.fillRect(sx+i*4,sy-i*3,8,3)}else{ctx.fillRect(sx,sy,16,3);ctx.fillRect(sx,sy+11,16,3);ctx.fillStyle='#0b0a0f';ctx.fillRect(sx+5,sy+3,6,8)}}
}
function artifactNodes(game){
  const nodes=[];for(const p of game.projects){(p.artifacts||[]).slice(0,4).forEach((a,i)=>{const angle=i*1.7+.4;nodes.push({id:`${p.id}:${a.rel}`,project:p,artifact:a,x:p.x+Math.cos(angle)*(5.3+i*.35),y:p.y+Math.sin(angle)*(4.2+i*.3)})})}return nodes;
}
function drawDiscoverables(ctx,game){
  const [cx,cy]=viewCenter(game),t=game.now*.001;
  for(const n of artifactNodes(game)){const d=dist(game.state.player.x,game.state.player.y,n.x,n.y);if(d>7&&!game.state.discoveredArtifacts[n.id])continue;const[sx,sy]=w2s(n.x,n.y,cx,cy,game.canvas);drawAsset(ctx,game.state.discoveredArtifacts[n.id]?'icon_verified.png':'icon_evidence.png',sx-2,sy-3,21,21,1);if(!game.state.discoveredArtifacts[n.id]){ctx.strokeStyle='#ffeaa188';ctx.beginPath();ctx.arc(sx+8,sy+8,8+Math.sin(t*3+n.x)*2,0,Math.PI*2);ctx.stroke()}}
  for(const m of MANUAL_PAGES){if(game.state.manualPages[m.id])continue;const d=dist(game.state.player.x,game.state.player.y,m.x,m.y);if(d>6)continue;const[sx,sy]=w2s(m.x,m.y,cx,cy,game.canvas);drawAsset(ctx,'icon_book.png',sx-2,sy-4,22,22,1)}
}
function drawWorldEchoes(ctx,game){
  const [cx,cy]=viewCenter(game),t=game.now*.001;for(const e of echoNodes(game.projects)){
    const discovered=!!game.state.echoes?.[e.id],d=dist(game.state.player.x,game.state.player.y,e.x,e.y);if(!discovered&&d>8)continue;
    const [sx,sy]=w2s(e.x,e.y,cx,cy,game.canvas);ctx.save();ctx.globalAlpha=discovered?.35:.95;drawAsset(ctx,discovered?'icon_verified.png':'fx_sparkle.png',sx-10,sy-13,22,22,1);ctx.strokeStyle=discovered?'#6b7583':'#8ef5e6';ctx.beginPath();ctx.arc(sx+1,sy-2,7+Math.sin(t*2+e.x)*2,0,Math.PI*2);ctx.stroke();ctx.restore();
  }
}
function drawQuestCompass(ctx,game){
  const tracked=game.state.trackedQuest;if(!tracked||game.state.mode!=='world')return;const p=game.projects.find(x=>x.id===tracked.projectId);if(!p)return;
  const dx=p.x-game.state.player.x,dy=p.y-game.state.player.y,d=Math.hypot(dx,dy);if(d<7)return;const a=Math.atan2(dy,dx),cx=game.canvas.width/2,cy=game.canvas.height/2,r=Math.min(game.canvas.width,game.canvas.height)*.38,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;
  ctx.save();ctx.translate(x,y);ctx.rotate(a+Math.PI/2);ctx.fillStyle='#f5cf72';ctx.strokeStyle='#251b0b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-11);ctx.lineTo(7,7);ctx.lineTo(0,4);ctx.lineTo(-7,7);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();ctx.fillStyle='#07101bdd';ctx.fillRect(x-24,y+12,48,12);ctx.fillStyle='#f5e3af';ctx.font='7px monospace';ctx.textAlign='center';ctx.fillText(`${Math.round(d)} TILE`,x,y+21);
}
function drawRelationshipSecrets(ctx,game){
  const [cx,cy]=viewCenter(game),t=game.now*.001;for(const r of game.relationships){if(!game.state.expeditions[r.id]?.unlocked)continue;const a=game.projects.find(p=>p.id===r.a),b=game.projects.find(p=>p.id===r.b);if(!a||!b)continue;const x=(a.x+b.x)/2,y=(a.y+b.y)/2,[sx,sy]=w2s(x,y,cx,cy,game.canvas);ctx.strokeStyle=game.state.secrets[r.id]?'#7d8b9c':'#65e9d3';ctx.beginPath();ctx.arc(sx+8,sy+8,8+Math.sin(t*2)*2,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#65e9d3';ctx.fillRect(sx+6,sy+6,4,4)}
}
function drawMessenger(ctx,game){if(!game.changes.length)return;const[cx,cy]=viewCenter(game),[sx,sy]=w2s(47,56,cx,cy,game.canvas);ctx.fillStyle='#ede0be';ctx.fillRect(sx+4,sy+3,8,11);ctx.fillStyle='#be4a45';ctx.fillRect(sx+3,sy+3,10,3);ctx.fillStyle='#f6c65b';ctx.font='bold 8px monospace';ctx.textAlign='center';ctx.fillText('!',sx+8,sy-2)}
function drawAvatar(ctx,game,screenX,screenY){
  const p=game.state.player,t=game.now*.001;const moving=Math.hypot(p.vx,p.vy)>.1;const frame=moving?Math.floor(t*8)%2:0;const hop=p.hop>0?Math.sin((1-p.hop/.38)*Math.PI)*10:0;ctx.save();ctx.translate(screenX+8,screenY+8-hop);ctx.globalAlpha=.35;ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(0,12+hop,8,4,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  const sprite=playerAsset(p.dir,moving,game.now);
  if(!drawAsset(ctx,sprite,-16,-27,32,42,1)){
    const dirs=[[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]],d=dirs[p.dir]||dirs[4];ctx.fillStyle='#171a24';ctx.fillRect(-5,-5,10,12);ctx.fillStyle='#e7cfad';ctx.fillRect(-4,-11,8,6);ctx.fillStyle='#b63f42';ctx.fillRect(-7,-3,3,8);ctx.fillRect(4,-3,3,8);ctx.fillStyle='#f2e7c7';ctx.fillRect(-4+frame*2,7,3,5);ctx.fillRect(1-frame*2,7,3,5);ctx.fillStyle='#111';ctx.fillRect(d[0]*2-2,-9+d[1],2,2);ctx.fillRect(d[0]*2+1,-9+d[1],2,2);
  }ctx.restore();
  const riverX=38+Math.sin(p.y*.18)*3.8;if(Math.abs(p.x-riverX)<2&&moving){ctx.strokeStyle='#87e0f655';ctx.beginPath();ctx.arc(screenX+8,screenY+12,8+frame*2,0,Math.PI);ctx.stroke()}
}
function drawWeather(ctx,game){
  const r=regionAt(game.projects,game.state.player.x,game.state.player.y);if(!r)return;const t=game.now*.001,cond=r.condition,w=game.canvas.width,h=game.canvas.height;ctx.save();
  if(cond==='blocked'){
    for(let i=0;i<48;i++){const x=(i*47+t*150)%w,y=(i*83+t*230)%h;line(ctx,x,y,x-7,y+16,'#a9b8d255',1)}
    if(Math.sin(t*.9)>.985){ctx.fillStyle='#dbe8ff22';ctx.fillRect(0,0,w,h)}
  }else if(cond==='unknown'){
    const g=ctx.createRadialGradient(w/2,h/2,60,w/2,h/2,Math.max(w,h)*.7);g.addColorStop(0,'#9fa9b000');g.addColorStop(1,'#c4ced844');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    for(let i=0;i<10;i++){ctx.fillStyle='#d8e0e712';ctx.beginPath();ctx.ellipse((i*117+t*8)%w,(i*67)%h,70,20,0,0,Math.PI*2);ctx.fill()}
  }else if(cond==='dormant'){
    ctx.fillStyle='#c1884b88';for(let i=0;i<28;i++){const x=(i*91+t*17)%w,y=(i*53+t*22)%h;ctx.fillRect(x+Math.sin(t+i)*8,y,2,2)}
  }else if(cond==='active'||cond==='open'){
    ctx.fillStyle=r.biome==='highlands'?'#d6f7d966':'#e9efc855';for(let i=0;i<22;i++){const x=(i*73+t*12)%w,y=(i*41+Math.sin(t+i)*18)%h;ctx.fillRect(x,y,1,4)}
  }else if(cond==='sealed'){
    ctx.fillStyle='#f7df8d55';for(let i=0;i<14;i++){const x=(i*137+t*7)%w,y=(i*89+Math.sin(t*.6+i)*22)%h;ctx.fillRect(x,y,2,2)}
  }
  if(r.biome==='highlands'&&new Date().getHours()<7){ctx.fillStyle='#e9f5ff88';for(let i=0;i<26;i++){const x=(i*67+t*8)%w,y=(i*97+t*14)%h;ctx.fillRect(x,y,2,2)}}
  ctx.restore();
}
function drawLighting(ctx,game){
  const h=new Date().getHours(),w=game.canvas.width,hh=game.canvas.height;ctx.save();
  if(h>=5&&h<8){ctx.fillStyle='#f3a46b22';ctx.fillRect(0,0,w,hh)}
  else if(h>=8&&h<17){const g=ctx.createLinearGradient(0,0,0,hh);g.addColorStop(0,'#fff6ce0d');g.addColorStop(1,'#0000');ctx.fillStyle=g;ctx.fillRect(0,0,w,hh)}
  else if(h>=17&&h<20){ctx.fillStyle='#e67d5b24';ctx.fillRect(0,0,w,hh)}
  else {ctx.fillStyle='#06112672';ctx.fillRect(0,0,w,hh);ctx.fillStyle='#dce8ff99';for(let i=0;i<60;i++){const x=(i*83)%w,y=(i*47)%Math.floor(hh*.58);ctx.fillRect(x,y,1+(i%3===0),1+(i%5===0))}}
  if(h>=19||h<6){const g=ctx.createRadialGradient(w/2,hh/2,22,w/2,hh/2,190);g.addColorStop(0,'#ffd88621');g.addColorStop(1,'#0000');ctx.fillStyle=g;ctx.fillRect(0,0,w,hh)}
  ctx.restore();
}
function drawMiniMap(ctx,game){
  const x=14,y=12,w=152,h=152;drawAsset(ctx,'ui_minimap.png',x,y,w,h,.9);
  const cx=x+w*.49,cy=y+h*.53,r=49;
  ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.clip();
  for(const p of game.projects){if(!game.state.arrivals[p.id]&&!game.state.visited[p.id])continue;const px=cx-r+(p.x/WORLD.w)*r*2,py=cy-r+(p.y/WORLD.h)*r*2;ctx.fillStyle=game.state.waystones[p.id]?'#f7d16b':'#dbe5ef';ctx.beginPath();ctx.arc(px,py,game.state.waystones[p.id]?3.3:2.2,0,Math.PI*2);ctx.fill();}
  for(const e of echoNodes(game.projects)){if(!game.state.echoes?.[e.id])continue;const ex=cx-r+(e.x/WORLD.w)*r*2,ey=cy-r+(e.y/WORLD.h)*r*2;ctx.fillStyle='#71e5d8';ctx.fillRect(ex-1,ey-1,2,2)}
  const tracked=game.state.trackedQuest&&game.projects.find(p=>p.id===game.state.trackedQuest.projectId);if(tracked){const tx=cx-r+(tracked.x/WORLD.w)*r*2,ty=cy-r+(tracked.y/WORLD.h)*r*2;ctx.strokeStyle='#ffd56f';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(tx,ty,6+Math.sin(game.now*.004),0,Math.PI*2);ctx.stroke()}
  const px=cx-r+(game.state.player.x/WORLD.w)*r*2,py=cy-r+(game.state.player.y/WORLD.h)*r*2;ctx.fillStyle='#ff5c57';ctx.beginPath();ctx.arc(px,py,3.4,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff3cf';ctx.lineWidth=1;ctx.stroke();ctx.restore();
  ctx.fillStyle='#08101bdc';ctx.fillRect(x+30,y+132,92,14);ctx.fillStyle='#ead8a5';ctx.font='7px monospace';ctx.textAlign='center';ctx.fillText((regionAt(game.projects,game.state.player.x,game.state.player.y)?.name||'THE WILDS').toUpperCase(),x+76,y+142);
}
export function renderWorld(game){
  const {ctx,canvas}=game,[cx,cy]=viewCenter(game),[shakeX,shakeY]=cameraOffset(game.camera||{shake:0},game.now);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.save();ctx.translate(shakeX,shakeY);drawBaseGround(ctx,game);drawRiver(ctx,game);drawRoads(ctx,game);drawTraversal(ctx,game);drawDiscoverables(ctx,game);drawWorldEchoes(ctx,game);drawProjects(ctx,game);drawRelationshipSecrets(ctx,game);drawMessenger(ctx,game);const[sx,sy]=w2s(game.state.player.x,game.state.player.y,cx,cy,canvas);drawAvatar(ctx,game,sx,sy);drawProjectForeground(ctx,game);drawSettlementForeground(ctx,game);ctx.restore();drawWeather(ctx,game);drawLighting(ctx,game);drawQuestCompass(ctx,game);drawMiniMap(ctx,game);
}
function interiorPalette(p){return palettes[p.biome]||palettes.highlands}
export function renderInterior(game){
  const {ctx,canvas}=game,p=game.projects.find(x=>x.id===game.state.interiorProjectId);if(!p)return;const pal=interiorPalette(p),t=game.now*.001;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle=pal[0];ctx.fillRect(0,0,canvas.width,canvas.height);
  const ox=canvas.width/2-260,oy=canvas.height/2-190,tw=520,th=360;ctx.fillStyle=pal[1];ctx.fillRect(ox,oy,tw,th);ctx.strokeStyle=p.accent;ctx.lineWidth=2;ctx.strokeRect(ox,oy,tw,th);
  drawInteriorScene(ctx,p,ox,oy,tw,th);
  if(p.biome==='obsidian'){ctx.strokeStyle='#4ea7ff88';for(let i=0;i<18;i++){ctx.beginPath();ctx.moveTo(ox+i*29,oy);ctx.quadraticCurveTo(ox+260+Math.sin(t+i)*120,oy+180,ox+(17-i)*29,oy+360);ctx.stroke()}}
  if(p.biome==='scrapyard'){ctx.fillStyle='#39d7e477';for(let i=0;i<15;i++)ctx.fillRect(ox+20+(i*71)%480,oy+25+(i*53)%300,3,3)}
  if(p.biome==='orbital'){ctx.strokeStyle='#b9c9dc33';for(let i=0;i<8;i++)line(ctx,ox+20,oy+30+i*40,ox+500,oy+30+i*40,'#b9c9dc33')}
  ctx.fillStyle='#07090db8';ctx.fillRect(ox+12,oy+10,300,30);ctx.fillStyle='#f0e6c8';ctx.font='bold 14px monospace';ctx.fillText(p.interior.toUpperCase(),ox+24,oy+30);
  for(let i=0;i<INTERIOR_STATIONS.length;i++){const s=INTERIOR_STATIONS[i],sx=ox+s.x*16,sy=oy+s.y*16;ctx.fillStyle=i===5?'#613f32':'#0b1018';ctx.fillRect(sx-18,sy-18,36,36);ctx.strokeStyle=p.accent;ctx.strokeRect(sx-18,sy-18,36,36);ctx.fillStyle=p.accent;ctx.font='16px monospace';ctx.textAlign='center';ctx.fillText(s.icon,sx,sy+5);ctx.fillStyle='#dfe6ef';ctx.font='7px monospace';ctx.fillText(i===5?'EXIT':p.zones[i]||s.id.toUpperCase(),sx,sy+29)}
  const guide=npcAsset[p.id];if(guide){drawAsset(ctx,guide,ox+404,oy+124,58,82,1);ctx.fillStyle='#08101bdc';ctx.fillRect(ox+389,oy+204,88,18);ctx.fillStyle='#f1d690';ctx.font='7px monospace';ctx.textAlign='center';ctx.fillText('LOCAL GUIDE',ox+433,oy+216)}
  drawAsset(ctx,'fx_torch.png',ox+12,oy+52,96,30,.85);drawAsset(ctx,'fx_torch.png',ox+412,oy+52,96,30,.85);
  const px=ox+game.state.player.ix*16,py=oy+game.state.player.iy*16;drawAvatar(ctx,game,px-8,py-8);ctx.textAlign='left';ctx.fillStyle='#05070bcf';ctx.fillRect(12,12,310,44);ctx.fillStyle='#d8e2ee';ctx.font='10px monospace';ctx.fillText('INTERIOR · ENTER INSPECTS · ESC LEAVES',22,29);ctx.fillStyle='#8797aa';ctx.fillText('Information has a place here.',22,44)
}
export function chronicleNodes(projects){
  const nodes=[];projects.forEach((p,row)=>{(p.git?.commits||[]).slice(0,10).forEach((c,i)=>nodes.push({id:`${p.id}:${c.hash}`,project:p,commit:c,x:7+i*7,y:5+row*4}))});return nodes;}
export function renderChronicle(game){
  const {ctx,canvas}=game,nodes=chronicleNodes(game.projects),t=game.now*.001;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#080912';ctx.fillRect(0,0,canvas.width,canvas.height);const ox=80,oy=90;
  ctx.fillStyle='#171929';ctx.fillRect(30,50,900,460);ctx.strokeStyle='#343a52';ctx.strokeRect(30,50,900,460);ctx.fillStyle='#f6c65b';ctx.font='bold 16px monospace';ctx.fillText('THE CHRONICLE · WALK THE RECENT PAST',55,78);
  game.projects.forEach((p,row)=>{const y=oy+row*64;line(ctx,90,y,880,y,'#31384b',2);ctx.fillStyle=p.accent;ctx.font='9px monospace';ctx.fillText(p.name.toUpperCase(),55,y-12)});
  for(const n of nodes){const sx=ox+n.x*10,sy=oy+(n.y-5)*16;ctx.fillStyle=n.project.accent;ctx.fillRect(sx-6,sy-6,12,12);ctx.strokeStyle='#fff5';ctx.strokeRect(sx-9,sy-9,18,18);if(Math.sin(t*2+n.x)>.6){ctx.fillStyle='#fff8';ctx.fillRect(sx-2,sy-2,4,4)}}
  const px=ox+game.state.player.cx*10,py=oy+(game.state.player.cy-5)*16;drawAvatar(ctx,game,px-8,py-8);ctx.fillStyle='#95a2b4';ctx.font='10px monospace';ctx.fillText('WASD WALK · ENTER READ COMMIT · ESC RETURN',55,490)
}
export function interactionTargets(game){
  if(game.state.mode==='interior'){
    const p=game.projects.find(x=>x.id===game.state.interiorProjectId);
    const stations=INTERIOR_STATIONS.map((s,i)=>({...s,type:'station',project:p,label:i===5?'LEAVE '+p.name:(p.zones[i]||s.id).toUpperCase(),distance:dist(game.state.player.ix,game.state.player.iy,s.x,s.y)}));
    const props=interiorInteractionNodes(p).map(n=>({...n,distance:dist(game.state.player.ix,game.state.player.iy,n.x,n.y)}));
    const guide={type:'guide',project:p,x:27,y:10.3,label:`TALK · ${p.guide||'LOCAL GUIDE'}`,distance:dist(game.state.player.ix,game.state.player.iy,27,10.3)};
    return [...stations,...props,guide].sort((a,b)=>a.distance-b.distance);
  }
  if(game.state.mode==='chronicle'){
    return chronicleNodes(game.projects).map(n=>({...n,type:'commit',label:n.commit.subject,distance:dist(game.state.player.cx,game.state.player.cy,n.x,n.y)})).sort((a,b)=>a.distance-b.distance);
  }
  const targets=[];
  for(const p of game.projects)targets.push({type:'project',project:p,label:'ENTER '+p.interior.toUpperCase(),x:p.x,y:p.y,distance:dist(game.state.player.x,game.state.player.y,p.x,p.y)});
  for(const n of settlementInteractionNodes(game))targets.push({...n,distance:dist(game.state.player.x,game.state.player.y,n.x,n.y)});
  for(const e of echoNodes(game.projects))targets.push({...e,type:'echo',label:game.state.echoes?.[e.id]?'REVISIT WORLD ECHO':'LISTEN · WORLD ECHO',distance:dist(game.state.player.x,game.state.player.y,e.x,e.y)});
  for(const f of TRAVERSAL_FEATURES)targets.push({...f,type:'traversal',distance:dist(game.state.player.x,game.state.player.y,f.x,f.y)});
  for(const n of artifactNodes(game))targets.push({...n,type:'artifact',label:game.state.discoveredArtifacts[n.id]?'INSPECT FOUND ARTIFACT':'DISCOVER ARTIFACT',distance:dist(game.state.player.x,game.state.player.y,n.x,n.y)});
  for(const m of MANUAL_PAGES)if(!game.state.manualPages[m.id])targets.push({...m,type:'manual',label:'RECOVER MANUAL PAGE',distance:dist(game.state.player.x,game.state.player.y,m.x,m.y)});
  if(game.changes.length)targets.push({type:'messenger',x:47,y:56,label:'READ WHAT CHANGED',distance:dist(game.state.player.x,game.state.player.y,47,56)});
  for(const r of game.relationships){if(!game.state.expeditions[r.id]?.unlocked)continue;const a=game.projects.find(p=>p.id===r.a),b=game.projects.find(p=>p.id===r.b);if(!a||!b)continue;const x=(a.x+b.x)/2,y=(a.y+b.y)/2;targets.push({type:'secret',relationship:r,x,y,label:game.state.secrets[r.id]?'INSPECT HIDDEN ROAD':'DISCOVER HIDDEN ROAD',distance:dist(game.state.player.x,game.state.player.y,x,y)})}
  return targets.sort((a,b)=>a.distance-b.distance);
}

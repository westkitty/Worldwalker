import { SETTLEMENTS } from './settlements.js';
import { drawAsset } from './assets.js';
const TILE=16;
const w2s=(x,y,cx,cy,canvas)=>[(x-cx)*TILE+canvas.width/2,(y-cy)*TILE+canvas.height/2];
const pathTone={starsilk:'#35506f','screen-weasels':'#76572f',atlas:'#9a8e67',dash:'#a47b50',orbital:'#667386'};
export function settlementTimeBand(hour=new Date().getHours()){return hour<6?'night':hour<10?'morning':hour<17?'day':hour<21?'evening':'night'}
function residentPosition(game,p,resident,index){
  const [name,baseX,baseY]=resident,t=game.now*.00055+index*2.7+p.x*.03,band=settlementTimeBand();
  const anchors={morning:[[0,4.4],[3.9,5.8]],day:[[baseX,baseY],[baseX,baseY]],evening:[[-1.8,5.5],[1.9,5.7]],night:[[-2.2,6.3],[2.3,6.4]]};
  const [dx,dy]=(anchors[band]||anchors.day)[index]||[baseX,baseY],roam=band==='night'?.18:band==='evening'?.42:index===0?.72:1.05;
  return {name,x:p.x+dx+Math.sin(t)*roam,y:p.y+dy+Math.cos(t*.73)*roam*.48,band};
}
export function settlementInteractionNodes(game){
  const nodes=[];for(const p of game.projects){const s=SETTLEMENTS[p.id];if(!s)continue;
    s.residents.forEach((r,i)=>{const q=residentPosition(game,p,r,i);nodes.push({type:'resident',project:p,name:q.name,x:q.x,y:q.y,label:`TALK · ${i===0?(p.guide||'LOCAL RESIDENT'):'WANDERER'}`})});
    nodes.push({type:'waystone',project:p,x:p.x+7.1,y:p.y+6.4,label:`WAYSTONE · ${p.name}`});
  }return nodes;
}
export function worldStructureBlocked(game,x,y){
  for(const p of game.projects){const s=SETTLEMENTS[p.id];if(!s)continue;
    for(const [,dx,dy,w,h] of s.structures){const cx=p.x+dx,cy=p.y+dy+.45,rx=Math.max(.8,w/50),ry=Math.max(.55,h/92);if(((x-cx)/rx)**2+((y-cy)/ry)**2<1)return true;}
  }return false;
}
export function drawSettlement(ctx,game,p){
  const s=SETTLEMENTS[p.id];if(!s)return;const cx=game.camera?.x??game.state.player.x,cy=game.camera?.y??game.state.player.y,[mx,my]=w2s(p.x,p.y,cx,cy,game.canvas);
  ctx.save();ctx.lineCap='round';
  for(const [,dx,dy] of s.structures){const[sx,sy]=w2s(p.x+dx,p.y+dy,cx,cy,game.canvas);ctx.strokeStyle=(pathTone[p.id]||'#776a54')+'bb';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(mx+8,my+8);ctx.lineTo(sx+8,sy+8);ctx.stroke();ctx.strokeStyle='#f4dda133';ctx.lineWidth=2;ctx.stroke()}
  ctx.restore();
  const band=settlementTimeBand();
  for(const [name,dx,dy,w,h] of s.structures){const[sx,sy]=w2s(p.x+dx,p.y+dy,cx,cy,game.canvas);drawAsset(ctx,name,sx-w/2,sy-h+12,w,h,1);if(band==='evening'||band==='night'){const g=ctx.createRadialGradient(sx,sy-8,2,sx,sy-8,23);g.addColorStop(0,'#ffd47a66');g.addColorStop(1,'#ffd47a00');ctx.fillStyle=g;ctx.fillRect(sx-24,sy-32,48,48)}}
  s.residents.forEach((r,i)=>{const q=residentPosition(game,p,r,i),[sx,sy]=w2s(q.x,q.y,cx,cy,game.canvas),bob=Math.sin(game.now*.004+i)*1.1;drawAsset(ctx,q.name,sx-10,sy-27+bob,20,29,.96)});
  const[sx,sy]=w2s(p.x+7.1,p.y+6.4,cx,cy,game.canvas);drawAsset(ctx,'fx_waystone.png',sx-14,sy-22,28,32,p.condition==='unknown'?.42:.9);
  const t=game.now*.001;ctx.save();
  if(p.condition==='blocked'){
    ctx.strokeStyle='#ef665dcc';ctx.lineWidth=3;for(let i=-2;i<=2;i++){const ox=mx+i*18;ctx.beginPath();ctx.moveTo(ox,my+66);ctx.lineTo(ox+11,my+50);ctx.stroke();ctx.beginPath();ctx.moveTo(ox+11,my+66);ctx.lineTo(ox,my+50);ctx.stroke();}
    drawAsset(ctx,'fx_dust.png',mx-58,my+26,116,52,.58);
  }else if(p.condition==='unknown'){
    const g=ctx.createRadialGradient(mx,my,25,mx,my,145);g.addColorStop(0,'#c7d2df08');g.addColorStop(1,'#aeb8c355');ctx.fillStyle=g;ctx.fillRect(mx-150,my-120,300,240);
  }else if(p.condition==='sealed'){
    for(let i=0;i<4;i++){const a=t*.35+i*Math.PI/2;drawAsset(ctx,'fx_sparkle.png',mx+Math.cos(a)*86-8,my+Math.sin(a)*48-34,18,18,.7)}
  }else if(p.condition==='active'||p.condition==='open'){
    ctx.fillStyle='#ffd88b66';for(let i=0;i<5;i++){const a=i*1.22+t*.08;ctx.beginPath();ctx.arc(mx+Math.cos(a)*72,my+Math.sin(a)*36+8,3,0,Math.PI*2);ctx.fill();}
  }
  ctx.restore();
}
export function drawSettlementForeground(ctx,game){
  const cx=game.camera?.x??game.state.player.x,cy=game.camera?.y??game.state.player.y,py=game.state.player.y;
  for(const p of game.projects){const s=SETTLEMENTS[p.id];if(!s)continue;
    for(const [name,dx,dy,w,h] of s.structures){const wy=p.y+dy;if(wy<=py+.2)continue;const[sx,sy]=w2s(p.x+dx,wy,cx,cy,game.canvas);drawAsset(ctx,name,sx-w/2,sy-h+12,w,h,1)}
    s.residents.forEach((r,i)=>{const q=residentPosition(game,p,r,i);if(q.y<=py+.08)return;const[sx,sy]=w2s(q.x,q.y,cx,cy,game.canvas),bob=Math.sin(game.now*.004+i)*1.1;drawAsset(ctx,q.name,sx-10,sy-27+bob,20,29,.96)});
    const wy=p.y+6.4;if(wy>py+.15){const[sx,sy]=w2s(p.x+7.1,wy,cx,cy,game.canvas);drawAsset(ctx,'fx_waystone.png',sx-14,sy-22,28,32,p.condition==='unknown'?.42:.9)}
  }
}

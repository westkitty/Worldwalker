import { drawAsset } from './assets.js';
export const INTERIOR_INTERACTIVES={
  starsilk:[{id:'archive-shelf',x:7.2,y:7.6,label:'INSPECT · CANON SHELF',kind:'archive'},{id:'archive-table',x:16,y:18.1,label:'INSPECT · CHRONOLOGY TABLE',kind:'history'},{id:'archive-crystal',x:3.5,y:18.8,label:'LISTEN · BLUE CRYSTAL',kind:'condition'}],
  'screen-weasels':[{id:'signal-bench',x:15,y:18.1,label:'INSPECT · SIGNAL BENCH',kind:'quest'},{id:'signal-lantern',x:26.2,y:8.7,label:'INSPECT · STATUS LANTERN',kind:'condition'},{id:'signal-hearth',x:4.4,y:9.5,label:'INSPECT · WORKSHOP HEARTH',kind:'history'}],
  atlas:[{id:'atlas-globe',x:5.8,y:10.1,label:'TURN · CARTOGRAPHER GLOBE',kind:'condition'},{id:'atlas-scope',x:26.1,y:10,label:'LOOK · OBSERVATORY SCOPE',kind:'quest'},{id:'atlas-table',x:16,y:18.2,label:'INSPECT · MAP TABLE',kind:'history'}],
  dash:[{id:'dash-stall',x:5.8,y:10.7,label:'INSPECT · MARKET STALL',kind:'condition'},{id:'dash-ledger',x:15.7,y:18.3,label:'READ · OPEN LEDGER',kind:'quest'},{id:'dash-lantern',x:16.2,y:7.2,label:'INSPECT · COUNTING LAMP',kind:'history'}],
  orbital:[{id:'orbital-crystal',x:3.9,y:10,label:'INSPECT · EVIDENCE CRYSTAL',kind:'condition'},{id:'orbital-scope',x:25.8,y:18.2,label:'LOOK · REVIEW SCOPE',kind:'quest'},{id:'orbital-console',x:15.7,y:18.2,label:'INSPECT · ROUTE CONSOLE',kind:'history'}]
};
const layouts={
  starsilk:{floor:'interior_floor_stone.png',rug:'interior_rug_blue.png',props:[['interior_bookshelf.png',38,48,150,78],['interior_bookcase.png',332,48,150,78],['interior_table.png',162,210,190,92],['interior_crystal_blue.png',28,242,54,76],['interior_crystal_blue.png',438,242,54,76]]},
  'screen-weasels':{floor:'interior_floor_wood.png',rug:'interior_rug_green.png',props:[['interior_fireplace.png',18,38,112,118],['interior_desk.png',162,202,150,95],['interior_lantern.png',395,62,52,78],['interior_bookcase.png',338,42,145,78]]},
  atlas:{floor:'interior_floor_stone.png',rug:'interior_rug_blue.png',props:[['interior_globe.png',52,70,82,96],['interior_telescope.png',365,70,104,96],['interior_table.png',154,204,205,92],['interior_bookshelf.png',176,42,148,72]]},
  dash:{floor:'interior_floor_gold.png',rug:'interior_rug_green.png',props:[['interior_market_stall.png',18,52,150,118],['interior_market_stall.png',350,52,150,118],['interior_desk.png',168,204,165,95],['interior_lantern.png',234,42,50,74]]},
  orbital:{floor:'interior_floor_stone.png',rug:'interior_rug_blue.png',props:[['interior_crystal_purple.png',32,62,58,82],['interior_crystal_blue.png',428,62,58,82],['interior_telescope.png',356,206,110,94],['interior_desk.png',170,204,160,94]]}
};
export function interiorBlocked(projectId,x,y){
  const boxes={
    starsilk:[[2,2,8,6],[20,2,30,6],[8,12,23,18],[1,13,5,19],[27,13,31,19]],
    'screen-weasels':[[1,2,8,8],[9,12,20,18],[24,2,31,7]],
    atlas:[[2,3,8,9],[22,3,30,9],[9,12,23,18],[10,2,20,6]],
    dash:[[1,3,10,9],[22,3,31,9],[10,12,22,18]],
    orbital:[[1,3,6,9],[26,3,31,9],[22,12,30,18],[10,12,21,18]]
  };
  return (boxes[projectId]||[]).some(([x1,y1,x2,y2])=>x>x1&&x<x2&&y>y1&&y<y2);
}
export function interiorInteractionNodes(project){return (INTERIOR_INTERACTIVES[project?.id]||[]).map(n=>({...n,type:'prop',project}))}
export function drawInteriorScene(ctx,p,ox,oy,tw,th){
  const l=layouts[p.id]||layouts.atlas;
  for(let y=0;y<th;y+=48)for(let x=0;x<tw;x+=48)drawAsset(ctx,l.floor,ox+x,oy+y,49,49,.9);
  drawAsset(ctx,l.rug,ox+tw/2-80,oy+th/2-52,160,104,.72);
  drawAsset(ctx,'interior_wall_panel.png',ox+8,oy+8,tw-16,58,.78);
  for(const [name,x,y,w,h] of l.props)drawAsset(ctx,name,ox+x,oy+y,w,h,.96);
  for(const n of INTERIOR_INTERACTIVES[p.id]||[]){
    ctx.fillStyle='#f6c65baa';ctx.fillRect(ox+n.x*16-2,oy+n.y*16-7,4,4);
    ctx.fillStyle='#fff1b455';ctx.fillRect(ox+n.x*16-1,oy+n.y*16-10,2,2);
    ctx.strokeStyle='rgba(246,198,91,0.25)';ctx.beginPath();ctx.arc(ox+n.x*16,oy+n.y*16-5,6,0,Math.PI*2);ctx.stroke();
  }
  drawAsset(ctx,'interior_door.png',ox+tw/2-33,oy+th-86,66,82,1);
}


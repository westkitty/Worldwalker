const runtimeUrl=name=>`/api/runtime-asset?name=${encodeURIComponent(name)}`;
const cache=new Map();
export function asset(name){
  if(!name)return null;
  if(!cache.has(name)){
    const img=new Image(); img.decoding='async'; img.src=runtimeUrl(name); cache.set(name,img);
  }
  return cache.get(name);
}
export function ready(name){const img=asset(name);return !!(img&&img.complete&&img.naturalWidth);}
export function drawAsset(ctx,name,x,y,w,h,alpha=1){
  const img=asset(name);if(!img||!img.complete||!img.naturalWidth)return false;
  ctx.save();ctx.globalAlpha=alpha;ctx.imageSmoothingEnabled=false;ctx.drawImage(img,x,y,w,h);ctx.restore();return true;
}
export const landmarkAsset={starsilk:'landmark_starsilk.png','screen-weasels':'landmark_screen_weasels.png',atlas:'landmark_atlas.png',dash:'landmark_dash.png',orbital:'landmark_orbital.png'};
export const terrainAsset={grass:'terrain_grass.png',flowers:'terrain_grass_flowers.png',dirt:'terrain_dirt.png',stone:'terrain_stone.png',forest:'terrain_forest.png',water:'terrain_water.png',shore:'terrain_shore.png',snow:'terrain_snow.png',sand:'terrain_sand.png'};
export const npcAsset={starsilk:'npc_archivist.png','screen-weasels':'npc_engineer.png',atlas:'npc_cartographer.png',dash:'npc_merchant.png',orbital:'npc_station_keeper.png'};
export const npcPortrait={starsilk:'portrait_archivist.png','screen-weasels':'portrait_engineer.png',atlas:'portrait_cartographer.png',dash:'portrait_merchant.png',orbital:'portrait_station_keeper.png'};
export function playerAsset(dir,moving,now){
  const card=dir===0?'up':dir===2?'right':dir===4?'down':dir===6?'left':dir===1?'up':dir===3?'right':dir===5?'down':'left';
  const frame=moving?Math.floor(now*.008)%3:0;return `player_${card}_${frame}.png`;
}
['terrain_grass.png','terrain_stone.png','terrain_water.png','landmark_starsilk.png','landmark_screen_weasels.png','landmark_atlas.png','landmark_dash.png','landmark_orbital.png','player_down_0.png'].forEach(asset);
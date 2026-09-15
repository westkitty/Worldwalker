export function createCamera(player){return{x:player.x,y:player.y,vx:0,vy:0,focus:null,shake:0,zoom:1,targetZoom:1}}
export function focusCamera(camera,x,y,duration=.8){camera.focus={x,y,until:performance.now()+duration*1000};camera.shake=Math.max(camera.shake,.9)}
export function frameTarget(camera,px,py,tx,ty,duration=1.0){
  const midX=(px+tx)/2,midY=(py+ty)/2;
  focusCamera(camera,midX,midY,duration);
}
export function bumpCamera(camera,strength=.45){camera.shake=Math.max(camera.shake,strength)}
export function updateCamera(camera,game,dt){
  if(game.state.mode!=='world'){camera.x=game.state.player.x;camera.y=game.state.player.y;camera.vx=0;camera.vy=0;return}
  const p=game.state.player,now=performance.now();let tx=p.x+p.vx*.18,ty=p.y+p.vy*.13;
  if(camera.focus&&now<camera.focus.until){const k=Math.max(0,(camera.focus.until-now)/800);tx=tx*(1-k)+camera.focus.x*k;ty=ty*(1-k)+camera.focus.y*k}else camera.focus=null;
  const stiffness=1-Math.exp(-dt*7.5);camera.x+=(tx-camera.x)*stiffness;camera.y+=(ty-camera.y)*stiffness;
  camera.shake*=Math.exp(-dt*8);
  if(camera.targetZoom&&camera.zoom!==camera.targetZoom){camera.zoom+=(camera.targetZoom-camera.zoom)*(1-Math.exp(-dt*6))}
}
export function cameraOffset(camera,now){if(camera.shake<.01)return[0,0];const s=camera.shake*5,t=now*.04;return[Math.sin(t*1.7)*s,Math.cos(t*2.1)*s*.65]}


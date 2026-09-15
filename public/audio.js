let ctx=null,master=null,muted=false,nextNote=0,nextAmbient=0,lastStepAt=0;
const THEMES={
  crossroads:[130.81,196,261.63,392],starsilk:[146.83,220,293.66,440],
  'screen-weasels':[110,164.81,220,329.63],atlas:[196,246.94,293.66,392],
  dash:[174.61,220,261.63,349.23],orbital:[98,146.83,196,293.66]
};
function gain(value){const g=ctx.createGain();g.gain.value=value;g.connect(master);return g}
function tone(freq,when,duration=.6,type='sine',volume=.025){
  if(!ctx||muted)return;const o=ctx.createOscillator(),g=gain(0);o.type=type;o.frequency.value=freq;
  g.gain.setValueAtTime(.0001,when);g.gain.exponentialRampToValueAtTime(volume,when+.03);g.gain.exponentialRampToValueAtTime(.0001,when+duration);
  o.connect(g);o.start(when);o.stop(when+duration+.04);
}
export async function initAudio(){
  if(ctx)return;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;ctx=new AC();master=ctx.createGain();master.gain.value=.42;master.connect(ctx.destination);await ctx.resume();nextNote=ctx.currentTime+.1;
}
export function setMuted(v){muted=!!v;if(master)master.gain.setTargetAtTime(muted?0:.42,ctx.currentTime,.03);return muted}
export function toggleMuted(){return setMuted(!muted)}
export function isMuted(){return muted}
function regionFor(game){return game.state.interiorProjectId?game.projects.find(x=>x.id===game.state.interiorProjectId):game.projects.find(x=>Math.hypot(game.state.player.x-x.x,game.state.player.y-x.y)<9.5)}
function themeFor(game){if(game.state.mode==='chronicle')return THEMES.crossroads;const p=regionFor(game);return THEMES[p?.id]||THEMES.crossroads}
function ambient(game){
  if(!ctx||muted||ctx.currentTime<nextAmbient)return;const p=regionFor(game),id=p?.id||'crossroads',now=ctx.currentTime+.01;
  const bank={crossroads:[196,'sine'],starsilk:[293.66,'sine'],'screen-weasels':[329.63,'square'],atlas:[392,'sine'],dash:[261.63,'triangle'],orbital:[146.83,'sawtooth']};const [f,type]=bank[id]||bank.crossroads;
  tone(f,now,.9,type,.006);if(id==='starsilk'||id==='orbital')tone(f*2,now+.22,.45,'sine',.004);nextAmbient=ctx.currentTime+4.5+Math.random()*4;
}
export function audioTick(game){
  if(!ctx||muted||ctx.state!=='running')return;ambient(game);if(ctx.currentTime<nextNote)return;
  const theme=themeFor(game),p=regionFor(game),tension=p?.condition==='blocked'?.78:p?.condition==='unknown'?.58:.34;
  const step=Math.floor((game.now/900)%theme.length),root=theme[step];
  tone(root,nextNote,.62,'triangle',.022+tension*.008);tone(root*1.5,nextNote+.12,.5,'sine',.012);
  if(step%2===0)tone(root/2,nextNote,.78,'sine',.012);nextNote=ctx.currentTime+.72;
}
export function stinger(kind='discover'){
  if(!ctx||muted)return;const now=ctx.currentTime+.01,map={discover:[523.25,659.25,783.99],waystone:[392,523.25,783.99],blocked:[220,207.65,196],enter:[261.63,329.63,392],secret:[440,554.37,659.25,880]};
  (map[kind]||map.discover).forEach((f,i)=>tone(f,now+i*.07,.32,'triangle',.035));
}
export function movementAudio(game,moving,sprint=false){
  if(!ctx||muted||!moving||ctx.currentTime-lastStepAt<(sprint?.18:.27))return;lastStepAt=ctx.currentTime;
  const p=regionFor(game),riverX=38+Math.sin(game.state.player.y*.18)*3.8,inWater=game.state.mode==='world'&&Math.abs(game.state.player.x-riverX)<1.9;
  const surface=inWater?'water':p?.biome||'wild';const bank={water:[118,'sine'],obsidian:[210,'triangle'],scrapyard:[285,'square'],highlands:[142,'sine'],market:[178,'square'],orbital:[340,'triangle'],wild:[132,'sine']};
  const [f,type]=bank[surface]||bank.wild;tone(f,ctx.currentTime+.005,.07,type,inWater?.012:.008);if(inWater)tone(f*1.7,ctx.currentTime+.018,.05,'sine',.006);
}

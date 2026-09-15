import { PROJECT_BLUEPRINTS, MANUAL_PAGES, TRAVERSAL_FEATURES, FEATURE_CONTRACT, OVERWORLD_SIGNPOSTS, RIVER_STEPPING_STONES, RIVER_FERRY, SETTLEMENT_BULLETINS } from './world-data.js';
import { WORLD, INTERIOR_STATIONS, renderWorld, renderInterior, renderChronicle, interactionTargets } from './render.js';
import { investigationStage, expeditionState, sourceChanges, explorationMilestones, technologyMatrix, calculateWalkingRoute } from './model.js';
import { worldStructureBlocked } from './settlement-render.js';
import { interiorBlocked } from './interior-render.js';
import { createCamera, updateCamera, focusCamera, bumpCamera } from './camera.js';
import { initAudio, audioTick, movementAudio, stinger, toggleMuted, setMuted, isMuted, setVolume, getVolume, previewTheme, THEMES } from './audio.js';
import { WORLD_ECHOES, echoNodes } from './world-echoes.js';
import { showDialogue, advanceDialogue, closeDialogue, isDialogueOpen, selectDialogueChoice, setDialogueSpeed } from './dialogue.js';
import { encounterFor } from './travel-encounters.js';

const $=s=>document.querySelector(s);
const canvas=$('#world'),ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
const panel=$('#panel'),body=$('#panelBody'),prompt=$('#prompt'),place=$('#place'),toast=$('#toast'),transitionEl=$('#transition'),regionCard=$('#regionCard'),questHud=$('#questHud'),weatherBadge=$('#weatherBadge');
const SAVE_KEY='worldwalker-save-v2';
const DEFAULT_PLAYER={x:47,y:59,ix:15,iy:18,cx:4,cy:5,dir:4,steps:0,vx:0,vy:0,hop:0};
const DEFAULT_STATE={version:6,mode:'world',player:DEFAULT_PLAYER,visited:{},arrivals:{},waystones:{},echoes:{},journal:[],seenShifts:{},encounters:{},propsSeen:{},travelMeters:0,nextEncounterAt:24,trackedQuest:null,audioMuted:false,masterVolume:0.85,compassVisible:true,activePins:[],completedMilestones:{},toastHistory:[],discoveredArtifacts:{},manualPages:{},stationVisits:{},commitReads:{},secrets:{},expeditions:{},lastDigests:{},lastConditions:{},interiorProjectId:null};
let projects=structuredClone(PROJECT_BLUEPRINTS),relationships=[],snapshot=null,changes=[],keys=new Set(),last=performance.now(),near=null,now=performance.now(),running=false,transitioning=false,lastRegionId=null,padButtons=[],padSprint=false;
let state=loadState();let travelLastX=state.player.x,travelLastY=state.player.y;const camera=createCamera(state.player);
const game={canvas,ctx,camera,get state(){return state},get projects(){return projects},get relationships(){return relationships},get changes(){return changes},get changedIds(){return new Set(changes.map(c=>c.id))},get now(){return now}};

function normalizeState(raw){
  const out={...structuredClone(DEFAULT_STATE),...(raw&&typeof raw==='object'?raw:{})};
  out.player={...DEFAULT_PLAYER,...(raw?.player||{})};
  for(const k of ['visited','arrivals','waystones','echoes','seenShifts','encounters','propsSeen','discoveredArtifacts','manualPages','stationVisits','commitReads','secrets','expeditions','lastDigests','lastConditions','completedMilestones']) if(!out[k]||typeof out[k]!=='object')out[k]={};
  if(!Array.isArray(out.journal))out.journal=[];out.journal=out.journal.slice(-140);
  if(!Array.isArray(out.activePins))out.activePins=[];
  if(!Array.isArray(out.toastHistory))out.toastHistory=[];
  if(!Number.isFinite(out.travelMeters))out.travelMeters=0;if(!Number.isFinite(out.nextEncounterAt))out.nextEncounterAt=24;
  if(typeof out.masterVolume!=='number'||out.masterVolume<0||out.masterVolume>1)out.masterVolume=0.85;
  if(typeof out.compassVisible!=='boolean')out.compassVisible=true;
  if(out.trackedQuest&&typeof out.trackedQuest!=='object')out.trackedQuest=null;
  if(!['world','interior','chronicle'].includes(out.mode))out.mode='world';
  out.version=6;
  return out;
}
function loadState(){try{return normalizeState(JSON.parse(localStorage.getItem(SAVE_KEY)||'null'))}catch{return structuredClone(DEFAULT_STATE)}}
function save(){
  try{
    localStorage.setItem(SAVE_KEY,JSON.stringify(state));
  }catch(err){
    if(err&&err.name==='QuotaExceededError'){
      state.journal=state.journal.slice(-40);
      state.toastHistory=state.toastHistory.slice(-10);
      try{localStorage.setItem(SAVE_KEY,JSON.stringify(state))}catch{}
    }
  }
}
function exportSave(){
  const payload={app:'Worldwalker',version:state.version,exportedAt:new Date().toISOString(),state};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`worldwalker-save-${new Date().toISOString().slice(0,10)}.json`;
  a.click();URL.revokeObjectURL(url);
  notify('Save backup exported.');
}
function importSave(jsonStr){
  try{
    const parsed=JSON.parse(jsonStr);
    const candidate=parsed.state||parsed;
    if(!candidate||typeof candidate!=='object'||!candidate.player)throw new Error('invalid');
    state=normalizeState(candidate);
    setMuted(!!state.audioMuted);
    setVolume(state.masterVolume);
    updateAudioButton();
    save();
    camera.x=state.player.x;camera.y=state.player.y;
    logEvent('shift','Save restored from backup',`Version ${state.version}`);
    notify('Save backup restored.');
    closePanel();
    updateBootSummary();
  }catch{
    notify('Import failed: invalid save format.');
  }
}
function logEvent(kind,title,detail='',projectId=null){state.journal.push({kind,title,detail,projectId,at:new Date().toISOString()});state.journal=state.journal.slice(-140);save();updateBootSummary()}
function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function formatBytes(n=0){if(n>1e6)return(n/1e6).toFixed(1)+' MB';if(n>1e3)return(n/1e3).toFixed(0)+' KB';return n+' B'}
function updateBootSummary(){const el=$('#resumeSummary'),wake=$('#wake');if(!el)return;const e=state.journal.at(-1);if(!e){el.textContent='NO JOURNEY MEMORY YET.';return}const d=new Date(e.at);el.textContent=`LAST MEMORY · ${e.title.toUpperCase()} · ${d.toLocaleDateString()} ${d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`;if(wake)wake.textContent='RESUME JOURNEY'}
function showRegionReveal(p){
  if(!regionCard)return;const vibe={obsidian:'ARCHIVE CITY',scrapyard:'SIGNAL SETTLEMENT',highlands:'CARTOGRAPHER HIGHLANDS',market:'LEDGER DISTRICT',orbital:'MERIDIAN RUIN'}[p.biome]||'PROJECT REGION',condition=String(p.condition||'unknown');
  clearTimeout(showRegionReveal.t);regionCard.className=`region-card ${condition} open`;regionCard.innerHTML=`<strong>${esc(p.landmark)}</strong><span>${esc(p.name.toUpperCase())}</span><small>${esc(vibe)} · SOURCE CONDITION ${esc(condition.toUpperCase())}</small>`;
  stinger(condition==='blocked'?'blocked':condition==='sealed'?'waystone':condition==='unknown'?'secret':'discover');bumpCamera(camera,.22);showRegionReveal.t=setTimeout(()=>regionCard.classList.remove('open'),2600);
}
function notify(msg,ms=2200){
  state.toastHistory.push({msg,at:new Date().toISOString()});
  if(state.toastHistory.length>40)state.toastHistory=state.toastHistory.slice(-40);
  if(toast){toast.textContent=msg;toast.classList.add('show');clearTimeout(notify.t);notify.t=setTimeout(()=>toast.classList.remove('show'),ms)}
  const stack=$('#toastStack');
  if(stack){
    const item=document.createElement('div');
    item.className='toast-item show';item.textContent=msg;
    stack.appendChild(item);
    setTimeout(()=>{item.classList.remove('show');setTimeout(()=>item.remove(),260)},ms);
  }
}
function updateAudioButton(){const b=$('#audioToggle');if(!b)return;b.setAttribute('aria-pressed',String(isMuted()));b.textContent=isMuted()?'♪ MUTED':'♪ SOUND'}
function panelOpen(html){if(isDialogueOpen())closeDialogue();body.innerHTML=html;panel.classList.add('open');panel.querySelector('button, [href], input')?.focus({preventScroll:true})}
function closePanel(){panel.classList.remove('open');$('#world')?.focus?.()}
function cinematic(title,subtitle,callback){
  if(transitioning)return;transitioning=true;transitionEl.innerHTML=`<strong>${esc(title)}</strong><span>${esc(subtitle||'')}</span>`;transitionEl.classList.add('active');setTimeout(()=>{callback?.();transitionEl.classList.add('reveal');setTimeout(()=>{transitionEl.classList.remove('active','reveal');transitioning=false},420)},360);
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function worldShiftCinematic(){
  if(!changes.length)return changesPanel();if(transitioning)return;closePanel();closeDialogue();transitioning=true;
  for(const c of changes){const p=projectOf(c.id);if(!p)continue;focusCamera(camera,p.x,p.y,1.15);const from=c.fromCondition?c.fromCondition.toUpperCase():'PRIOR STATE UNRECORDED',to=(p.condition||'unknown').toUpperCase();transitionEl.innerHTML=`<strong>WORLD SHIFT</strong><span>${esc(p.name.toUpperCase())} · ${esc(c.fromCondition?`${from} → ${to}`:to)}</span>`;transitionEl.classList.remove('reveal');transitionEl.classList.add('active');stinger(to==='BLOCKED'?'blocked':'discover');await wait(840);transitionEl.classList.add('reveal');await wait(320);if(state.seenShifts[p.id]!==p.digest){logEvent('shift',`${p.name} shifted`,`${c.fromCondition?`${from} → `:''}${to}${c.latest?` · ${c.latest}`:''}`,p.id);state.seenShifts[p.id]=p.digest;save()}}
  transitionEl.classList.remove('active','reveal');transitioning=false;changesPanel();
}
function artifactUrl(projectId,rel){return `/api/artifact?project=${encodeURIComponent(projectId)}&rel=${encodeURIComponent(rel)}`}
function runtimeAsset(name){return `/api/runtime-asset?name=${encodeURIComponent(name)}`}
const portraitFor={starsilk:'portrait_archivist.png','screen-weasels':'portrait_engineer.png',atlas:'portrait_cartographer.png',dash:'portrait_merchant.png',orbital:'portrait_station_keeper.png'};
function portraitBlock(p){const n=portraitFor[p.id];return n?`<div class="dialogue-card"><img class="dialogue-portrait" src="${runtimeAsset(n)}" alt="Local guide for ${esc(p.name)}"><div><p class="eyebrow">LOCAL GUIDE</p><b>${esc(p.interior)}</b><p>${esc(p.summary||'')}</p></div></div>`:''}
function projectOf(id){return projects.find(p=>p.id===id)}
function dist(a,b,c,d){return Math.hypot(a-c,b-d)}
function currentProject(){return state.interiorProjectId?projectOf(state.interiorProjectId):projects.find(p=>dist(state.player.x,state.player.y,p.x,p.y)<9.5)||null}
function journeyRecapPanel(restProject=null){
  const tracked=trackedQuestRecord(),recent=[...state.journal].slice(-6).reverse(),visited=Object.keys(state.visited).filter(k=>state.visited[k]).length;
  panelOpen(`<p class="eyebrow">${restProject?`RESTING AT ${esc(restProject.name)}`:'JOURNEY MEMORY'}</p><h2>JOURNEY RECAP</h2><div class="dialogue-card"><img class="dialogue-portrait" src="${runtimeAsset('portrait_hero_smile.png')}" alt="The Worldwalker"><div><b>${visited} / ${projects.length} regions entered</b><p>${Object.keys(state.waystones).filter(k=>state.waystones[k]).length} waystones attuned · ${Object.keys(state.echoes).filter(k=>state.echoes[k]).length} echoes remembered.</p></div></div><h3>CURRENT THREAD</h3><p>${tracked?`<b>${esc(tracked.q.title)}</b><br>${esc(tracked.p.name)} · ${esc(tracked.q.detail)}`:'No quest is currently tracked.'}</p><h3>RECENT MEMORY</h3><div class="timeline">${recent.length?recent.map(e=>`<div class="event"><b>${esc(e.title)}</b><small>${new Date(e.at).toLocaleString()}</small>${e.detail?`<p>${esc(e.detail)}</p>`:''}</div>`).join(''):'<p>The road is still blank.</p>'}</div><p class="tiny">Rest changes nothing in the source projects. This is Worldwalker remembering where you have been.</p><button class="primary" id="resumeJourney">CONTINUE JOURNEY</button>`);$('#resumeJourney').onclick=closePanel;
}
function inspectInteriorProp(n){
  const p=n.project,q=(p.quests||[]).find(x=>!['sealed','verified','closed'].includes(x.status)),latest=p.git?.commits?.[0];let lines=[];
  if(n.kind==='quest')lines=q?[`${q.title} is currently ${String(q.status).toUpperCase()}.`,q.detail]:['No unresolved source-backed quest is recorded at this object.'];
  else if(n.kind==='condition')lines=[`Worldwalker currently reads ${p.name} as ${String(p.condition||'unknown').toUpperCase()}.`,p.stateLedgerPresent?'A configured project-state ledger is present. Its contents are deliberately not exposed here.':'No configured project-state ledger is exposed here.'];
  else if(n.kind==='history')lines=latest?[`The most recent exposed commit is “${latest.subject}” (${latest.hash}).`,`A commit proves repository history, not acceptance or completion.`]:['No Git history is exposed for this project.'];
  else lines=[p.summary,`The source condition is ${String(p.condition||'unknown').toUpperCase()}.`];
  const key=`${p.id}:${n.id}`;if(!state.propsSeen[key]){state.propsSeen[key]=true;logEvent('inspection',n.label.replace(/^.*·\s*/,''),lines[0],p.id)}else save();
  showDialogue({speaker:n.label.replace(/^.*·\s*/,''),portrait:runtimeAsset(portraitFor[p.id]),lines});
}
function checkTravelEncounter(){
  if(state.mode!=='world'){travelLastX=state.player.x;travelLastY=state.player.y;return}const d=Math.hypot(state.player.x-travelLastX,state.player.y-travelLastY);travelLastX=state.player.x;travelLastY=state.player.y;if(d>0&&d<1.25)state.travelMeters+=d;
  if(state.travelMeters<state.nextEncounterAt||panel.classList.contains('open')||isDialogueOpen()||transitioning)return;const e=encounterFor(game,state.encounters);state.nextEncounterAt+=e?24:8;if(!e){save();return}state.encounters[e.key]=true;logEvent('encounter',`Road encounter · ${e.speaker}`,e.lines[2],e.project.id);stinger('discover');bumpCamera(camera,.18);showDialogue({speaker:e.speaker,portrait:runtimeAsset(e.portrait),lines:e.lines});
}
function checkRegionArrival(){
  if(state.mode!=='world')return;const p=projects.find(x=>dist(state.player.x,state.player.y,x.x,x.y)<8.7)||null;const id=p?.id||null;if(id===lastRegionId)return;lastRegionId=id;if(!p)return;
  if(!state.arrivals[p.id]){state.arrivals[p.id]=true;logEvent('arrival',`Reached ${p.name}`,p.landmark,p.id);focusCamera(camera,p.x,p.y,1.2);showRegionReveal(p);}
}
function trackedQuestRecord(){if(!state.trackedQuest)return null;const p=projectOf(state.trackedQuest.projectId),q=p?.quests?.find(x=>x.title===state.trackedQuest.title);return p&&q?{p,q}:null}
function updateQuestHud(){
  if(!questHud||state.mode!=='world'){questHud?.classList.add('hidden');return}
  const tracked=trackedQuestRecord();if(tracked){questHud.classList.remove('hidden');questHud.querySelector('span').textContent='TRACKED QUEST';questHud.querySelector('b').textContent=tracked.q.title;questHud.querySelector('small').textContent=`${tracked.p.name} · ${tracked.q.detail}`;return}
  const p=currentProject();if(!p){questHud.classList.add('hidden');return}const q=(p.quests||[]).find(x=>!['sealed','verified','closed'].includes(x.status));questHud.classList.remove('hidden');
  questHud.querySelector('span').textContent=q?'LOCAL RUMOR':'REGION SEALED';questHud.querySelector('b').textContent=q?q.title:p.landmark;questHud.querySelector('small').textContent=q?q.detail:'No unresolved source-backed quest is recorded here.';
}

function updateExpeditions(){state.expeditions=expeditionState(relationships,state);}
async function loadSnapshot(){
  try{
    const r=await fetch('/api/snapshot',{cache:'no-store'});if(!r.ok)throw new Error('snapshot');snapshot=await r.json();projects=snapshot.projects;relationships=snapshot.relationships||[];
    const priorConditions={...state.lastConditions};changes=sourceChanges(projects,state.lastDigests).map(c=>({...c,fromCondition:priorConditions[c.id]||null}));for(const p of projects){state.lastDigests[p.id]=p.digest;state.lastConditions[p.id]=p.condition}
    updateExpeditions();save();$('.status').classList.add('live');$('#syncText').textContent='WORLD READ · '+new Date(snapshot.generatedAt).toLocaleTimeString();
    if(changes.length)notify(`${changes.length} region${changes.length===1?' has':'s have'} changed. A messenger waits at the Crossroads.`,3200);
  }catch{$('#syncText').textContent='OFFLINE MANIFEST';relationships=[];}
}

function directionFrom(dx,dy){if(!dx&&!dy)return state.player.dir;const a=Math.atan2(dy,dx);return Math.round((a+Math.PI/2)/(Math.PI/4)+8)%8;}
function isRiverBlocked(nx,ny){
  const rx=38+Math.sin(ny*.18)*3.8;const inRiver=Math.abs(nx-rx)<1.55;if(!inRiver)return false;
  const bridges=[13,43,68];if(bridges.some(y=>Math.abs(ny-y)<1.4))return false;
  if(RIVER_STEPPING_STONES.some(s=>Math.hypot(nx-s.x,ny-s.y)<1.2))return false;
  return state.player.hop<=0;
}
function moveWorld(dx,dy,dt){
  const p=state.player,len=Math.hypot(dx,dy);if(!len){p.vx*=.72;p.vy*=.72;return}dx/=len;dy/=len;p.dir=directionFrom(dx,dy);
  const sprint=keys.has('shift')||padSprint,speed=(sprint?10.8:6.5)*(p.hop>0?1.08:1);p.vx=dx*speed;p.vy=dy*speed;
  const tx=Math.max(1,Math.min(WORLD.w-2,p.x+p.vx*dt)),ty=Math.max(1,Math.min(WORLD.h-2,p.y+p.vy*dt));
  const blocked=(x,y)=>isRiverBlocked(x,y)||worldStructureBlocked(game,x,y);
  if(!blocked(tx,ty)){p.x=tx;p.y=ty;p.steps+=sprint?2:1;return}
  if(!blocked(tx,p.y)){p.x=tx;p.steps++;return}if(!blocked(p.x,ty)){p.y=ty;p.steps++;return}
  if(p.hop<=0&&Math.random()<.025)notify('Something solid is in the way.');
}
function moveInterior(dx,dy,dt){
  const p=state.player,len=Math.hypot(dx,dy);if(!len){p.vx*=.72;p.vy*=.72;return}dx/=len;dy/=len;p.dir=directionFrom(dx,dy);const speed=(keys.has('shift')||padSprint)?9:6;p.vx=dx*speed;p.vy=dy*speed;
  const tx=Math.max(2,Math.min(30,p.ix+p.vx*dt)),ty=Math.max(2,Math.min(20,p.iy+p.vy*dt)),id=state.interiorProjectId;
  if(!interiorBlocked(id,tx,ty)){p.ix=tx;p.iy=ty;p.steps++;return}if(!interiorBlocked(id,tx,p.iy)){p.ix=tx;p.steps++;return}if(!interiorBlocked(id,p.ix,ty)){p.iy=ty;p.steps++;}
}
function moveChronicle(dx,dy,dt){const p=state.player,len=Math.hypot(dx,dy);if(!len)return;dx/=len;dy/=len;p.dir=directionFrom(dx,dy);const speed=(keys.has('shift')||padSprint)?8:5;p.cx=Math.max(2,Math.min(76,p.cx+dx*speed*dt));p.cy=Math.max(5,Math.min(21,p.cy+dy*speed*dt));p.steps++;}
function startHop(){
  if(state.mode!=='world'||state.player.hop>0)return;
  const sprint=keys.has('shift')||padSprint;
  state.player.hop=sprint?.48:.38;
  if(sprint){
    state.player.vx*=1.35;state.player.vy*=1.35;
    bumpCamera(camera,.12);
    notify('SPRINT STRIDE');
  }else{
    notify('HOP');
  }
}
function useTraversal(){
  if(state.mode!=='world')return;const f=TRAVERSAL_FEATURES.map(x=>({...x,d:dist(state.player.x,state.player.y,x.x,x.y)})).sort((a,b)=>a.d-b.d)[0];if(!f||f.d>2)return;
  bumpCamera(camera,.5);stinger('enter');cinematic(f.kind==='climb'?'CLIMB':'SQUEEZE',f.label,()=>{state.player.x=f.to.x;state.player.y=f.to.y;camera.x=f.to.x;camera.y=f.to.y;save();notify(`${f.label} crossed.`)});
}
function readGamepad(){
  const pad=Array.from(navigator.getGamepads?.()||[]).find(Boolean);if(!pad){padSprint=false;padButtons=[];return {dx:0,dy:0};}
  const dead=v=>Math.abs(v)<.18?0:v;const out={dx:dead(pad.axes?.[0]||0),dy:dead(pad.axes?.[1]||0)};
  const pressed=pad.buttons.map(b=>!!b.pressed),edge=i=>pressed[i]&&!padButtons[i],panelOpenNow=panel.classList.contains('open');
  if(edge(0)){if(isDialogueOpen())advanceDialogue();else if(!panelOpenNow)interact()}if(edge(1)){if(isDialogueOpen())closeDialogue();else if(!panelOpenNow)startHop()}if(edge(2)&&!isDialogueOpen()&&!panelOpenNow)useTraversal();if(edge(9)&&!isDialogueOpen()&&!panelOpenNow)mapPanel();
  padSprint=!!(pressed[10]||pressed[7]);padButtons=pressed;return out;
}
function update(dt){
  audioTick(game);const gp=readGamepad();if(panel.classList.contains('open')||isDialogueOpen()||transitioning){updateCamera(camera,game,dt);return;}
  let dx=0,dy=0;if(keys.has('arrowleft')||keys.has('a'))dx--;if(keys.has('arrowright')||keys.has('d'))dx++;if(keys.has('arrowup')||keys.has('w'))dy--;if(keys.has('arrowdown')||keys.has('s'))dy++;
  if(!dx&&!dy){dx=gp.dx;dy=gp.dy}
  if(state.mode==='world')moveWorld(dx,dy,dt);else if(state.mode==='interior')moveInterior(dx,dy,dt);else moveChronicle(dx,dy,dt);
  checkTravelEncounter();movementAudio(game,Math.hypot(state.player.vx,state.player.vy)>.15,keys.has('shift')||padSprint);
  if(state.player.hop>0)state.player.hop=Math.max(0,state.player.hop-dt);
  if(state.player.steps%90<3)save();
  const targets=interactionTargets(game),candidate=targets[0];const limit=state.mode==='world'?(candidate?.type==='project'?5.1:1.75):2.1;near=candidate&&candidate.distance<=limit?candidate:null;
  prompt.classList.toggle('hidden',!near);if(near){prompt.querySelector('b').textContent=near.type==='traversal'?'C':(near.type==='signpost'?'READ':(near.type==='ferry'?'BOARD':'ENTER'));prompt.querySelector('span').textContent=near.label||near.title||near.type.toUpperCase()}
  place.textContent=locationLabel();updateWeatherBadge();updateDiagnostics(dt);updateQuestHud();checkRegionArrival();updateCamera(camera,game,dt);
}
let fpsSmoothed=60;
function updateWeatherBadge(){
  if(!weatherBadge)return;
  if(state.mode==='chronicle'){
    weatherBadge.textContent='ATMOSPHERE: TEMPORAL STATIC';
    return;
  }
  if(state.mode==='interior'){
    const p=projectOf(state.interiorProjectId);
    weatherBadge.textContent=`SHELTER: ${p?.interior?.toUpperCase()||'INTERIOR'}`;
    return;
  }
  const cp=currentProject();
  const cond=(cp?.condition||'calm').toUpperCase();
  weatherBadge.textContent=`ATMOSPHERE: ${cond}`;
}
function updateDiagnostics(dt){
  const f=$('#f3Hud');
  if(!f||f.classList.contains('hidden'))return;
  if(dt>0){const curFps=1/dt;fpsSmoothed=fpsSmoothed*0.9+curFps*0.1}
  const pos=state.mode==='interior'
    ?`POS: (${state.player.ix}, ${state.player.iy}) [INTERIOR]`
    :state.mode==='chronicle'
      ?`POS: (${state.player.cx}, ${state.player.cy}) [CHRONICLE]`
      :`POS: (${state.player.x.toFixed(1)}, ${state.player.y.toFixed(1)}) [WORLD]`;
  f.innerHTML=`<b>DIAGNOSTICS (F3)</b><span>${Math.round(fpsSmoothed)} FPS · ${(dt*1000).toFixed(1)}ms</span><span>${pos}</span><span>STEPS: ${state.player.steps} · PINS: ${(state.activePins||[]).length}</span><span>WORLDWALKER v0.29.0</span>`;
}
function locationLabel(){if(state.mode==='chronicle')return'THE CHRONICLE';if(state.mode==='interior')return(projectOf(state.interiorProjectId)?.interior||'INTERIOR').toUpperCase();return(currentProject()?.name||'THE CROSSROADS').toUpperCase()}
function loop(t){if(!running)return;now=t;const dt=Math.min(.05,(t-last)/1000);last=t;update(dt);if(state.mode==='world')renderWorld(game);else if(state.mode==='interior')renderInterior(game);else renderChronicle(game);requestAnimationFrame(loop)}

function enterProject(p){
  const first=!state.visited[p.id];state.visited[p.id]=true;updateExpeditions();save();focusCamera(camera,p.x,p.y,.75);stinger('enter');
  cinematic(p.landmark,p.name,()=>{state.mode='interior';state.interiorProjectId=p.id;state.player.ix=15;state.player.iy=18;save();if(first)notify(`Landmark recorded: ${p.landmark}`)});
}
function leaveInterior(){const p=projectOf(state.interiorProjectId);cinematic('RETURN TO THE WORLD',p?.name||'',()=>{state.mode='world';state.interiorProjectId=null;save()})}
function enterChronicle(){cinematic('THE CHRONICLE','RECENT HISTORY BECOMES TERRAIN',()=>{state.mode='chronicle';state.interiorProjectId=null;state.player.cx=4;state.player.cy=5;save()})}
function leaveChronicle(){cinematic('THE PRESENT','THE WORLD RESUMES',()=>{state.mode='world';save()})}

function interact(){
  if(!near)return;
  if(near.type==='project')return enterProject(near.project);
  if(near.type==='traversal')return useTraversal();  if(near.type==='artifact')return discoverArtifact(near);
  if(near.type==='manual')return discoverManual(near);
  if(near.type==='messenger')return worldShiftCinematic();
  if(near.type==='secret')return discoverSecret(near.relationship);
  if(near.type==='commit')return readCommit(near);
  if(near.type==='guide')return guidePanel(near.project);
  if(near.type==='resident')return residentPanel(near.project,near.name);
  if(near.type==='waystone')return waystonePanel(near.project);
  if(near.type==='echo')return worldEchoPanel(near);
  if(near.type==='signpost')return signpostPanel(near);
  if(near.type==='bulletin')return bulletinPanel(near);
  if(near.type==='ferry')return ferryPanel(near);
  if(near.type==='prop')return inspectInteriorProp(near);
  if(near.type==='station')return useStation(near);
}
function signpostPanel(s){
  showDialogue({
    speaker:s.title||'Signpost',
    portrait:runtimeAsset('portrait_hero_neutral.png'),
    lines:['WAYFINDER SIGNPOST',s.text||'A wooden signpost points along regional roads.']
  });
}
function bulletinPanel(b){
  const bulletin=b.bulletin||(b.project?SETTLEMENT_BULLETINS[b.project.id]:null);
  const notices=bulletin?.lines||['No active notices posted.'];
  showDialogue({
    speaker:b.title||bulletin?.title||'Settlement Bulletin',
    portrait:runtimeAsset('portrait_hero_neutral.png'),
    lines:[`REGIONAL BULLETINS · ${b.project?.name?.toUpperCase()||''}`,...notices]
  });
}
function ferryPanel(f){
  const to=f.to||(f.side==='west'?RIVER_FERRY.east:RIVER_FERRY.west);
  const destX=to.x, destName=destX>38?'East Bank':'West Bank';
  showDialogue({
    speaker:'River Ferry Cable Raft',
    portrait:runtimeAsset('portrait_wanderer.png'),
    lines:['The ferry cable runs across the Great River.','Board the raft to cross to the other bank?'],
    choices:[
      {
        label:`CROSS TO ${destName.toUpperCase()}`,
        action:()=>{
          cinematic('RIVER FERRY',`CROSSING TO ${destName.toUpperCase()}`,()=>{
            state.player.x=to.x;state.player.y=to.y;
            camera.x=to.x;camera.y=to.y;
            stinger('enter');save();
            notify(`Crossed river to ${destName}.`);
          });
        }
      },
      { label:'STAY ON THIS BANK' }
    ]
  });
}
function discoverArtifact(n){const fresh=!state.discoveredArtifacts[n.id];state.discoveredArtifacts[n.id]=true;if(fresh){logEvent('artifact',`Found ${n.artifact.name}`,n.artifact.rel,n.project.id);stinger('discover');notify(`FOUND: ${n.artifact.name}`)}else save();artifactDetail(n.project,n.artifact)}
function discoverManual(m){const fresh=!state.manualPages[m.id];state.manualPages[m.id]=true;if(fresh){logEvent('manual',`Recovered ${m.title}`,m.text||'Field Manual page');stinger('discover')}else save();notify(`FIELD MANUAL RECOVERED · ${m.title}`);manualPanel(m.id)}
function discoverSecret(r){const fresh=!state.secrets[r.id];state.secrets[r.id]=true;if(fresh){logEvent('secret','Mapped a hidden road',r.evidence||`${r.a} ↔ ${r.b}`);stinger('secret');bumpCamera(camera,.35);notify('A hidden road has been mapped.')}else save();relationshipPanel(r)}
function readCommit(n){state.commitReads[n.id]=true;save();panelOpen(`<h2>${esc(n.project.name)}</h2><p class="eyebrow">CHRONICLE STONE · ${esc(n.commit.hash)}</p><h3>${esc(n.commit.subject)}</h3><p>${new Date(n.commit.date).toLocaleString()}</p><p>This proves a recorded repository event. It does not, by itself, prove deployment, acceptance or completion.</p>`)}
function useStation(s){const p=s.project;if(s.id==='exit')return leaveInterior();state.stationVisits[p.id]={...(state.stationVisits[p.id]||{}),[s.id]:true};save();if(s.id==='state')showProject(p);else if(s.id==='artifacts')projectArtifactsPanel(p);else if(s.id==='history')projectHistoryPanel(p);else if(s.id==='quests')projectQuestPanel(p);else purposePanel(p)}

function statusTags(p){const git=p.git;return `<p class="tags"><span class="tag ${esc(p.condition||'unknown')}">${esc((p.condition||'unknown').toUpperCase())}</span><span class="tag ${p.present?'sealed':'unknown'}">${p.present?'ROOT FOUND':'ROOT MISSING'}</span>${git?`<span class="tag">${esc(git.branch||'detached')}</span><span class="tag ${git.dirty?'open':'sealed'}">${git.dirty?'WORKTREE CHANGED':'WORKTREE CLEAN'}</span>`:''}</p>`}
function showProject(p){panelOpen(`<p class="eyebrow">${esc(p.landmark)} · ${esc(p.interior)}</p><h2>${esc(p.name)}</h2>${portraitBlock(p)}${statusTags(p)}<h3>WORLD CONDITION</h3><p>The region renders from source condition <b>${esc((p.condition||'unknown').toUpperCase())}</b>. Completed work repairs the landscape; blocked and unknown state remain visibly unresolved.</p><h3>TECH SIGNATURE</h3><p>${(p.techTags||[]).map(x=>`<span class="tag">${esc(x.toUpperCase())}</span>`).join('')||'No bounded signature found.'}</p><h3>STATE EVIDENCE</h3><p>${p.stateLedgerPresent?'A configured project-state ledger is present. Worldwalker records only that fact here; its contents are not exposed.':'No configured project-state ledger is exposed to Worldwalker.'}</p>`)}
function residentPanel(p,name){
  const wandering=name==='npc_wanderer.png',q=(p.quests||[]).find(x=>!['sealed','verified','closed'].includes(x.status)),speaker=wandering?'Wanderer':(p.guide||'Resident');
  const first=q?`People here keep circling back to ${q.title}.`:`Nothing unresolved is being claimed here. Quiet places are allowed to stay quiet.`;
  const second=q?q.detail:`If the source changes, the world will tell us. Until then, I would rather not invent trouble.`;
  showDialogue({speaker,portrait:runtimeAsset(wandering?'portrait_wanderer.png':portraitFor[p.id]),lines:[first,second],choices:q?[{label:'CHECK QUEST BOARD',action:()=>projectQuestPanel(p)},{label:'KEEP WALKING'}]:[{label:'KEEP WALKING'}]});
}
function worldEchoPanel(e){
  const first=!state.echoes[e.id];state.echoes[e.id]=true;if(first){logEvent('echo',`World Echo · ${e.title}`,e.text,e.project.id);stinger('secret');bumpCamera(camera,.28);notify(`World echo remembered · ${e.title}`,2200)}else save();
  const count=Object.keys(state.echoes).filter(id=>state.echoes[id]).length;
  showDialogue({speaker:e.title,portrait:runtimeAsset('portrait_hero_thinking.png'),lines:[e.text,`World Echo ${count} of ${WORLD_ECHOES.length}. This is Worldwalker's interpretive layer, not source-project evidence.`]});
}
function waystonePanel(p){
  const first=!state.waystones[p.id];state.waystones[p.id]=true;if(first){logEvent('waystone',`Attuned ${p.name} waystone`,p.landmark,p.id);stinger('waystone');notify(`Waystone attuned · ${p.name}`)}else save();
  panelOpen(`<p class="eyebrow">ATTUNED WAYSTONE</p><h2>${esc(p.name)}</h2><p>This waystone remembers a place you physically reached. Fast travel never edits the project it represents.</p><div class="dialogue-actions"><button class="primary" id="waystoneRest">REST & REVIEW JOURNEY</button><button class="primary" id="waystoneMap">OPEN WORLD MAP</button></div>`);$('#waystoneRest').onclick=()=>{stinger('waystone');journeyRecapPanel(p)};$('#waystoneMap').onclick=mapPanel;
}
function guidePanel(p){
  const unresolved=(p.quests||[]).filter(q=>!['sealed','verified','closed'].includes(q.status)),lead=unresolved[0],speaker=p.guide||'Local Guide';
  const first=lead?`The road that still matters here is ${lead.title}.`:`This place has no unresolved source-backed quest in Worldwalker.`;
  const second=lead?lead.detail:`I will not invent work just to keep the lantern lit.`;
  showDialogue({speaker,portrait:runtimeAsset(portraitFor[p.id]),lines:[first,second],choices:[{label:'ASK ABOUT WORK',action:()=>projectQuestPanel(p)},{label:'ASK ABOUT THIS PLACE',action:()=>showProject(p)}]});
}
function questCard(q,p){const stage=investigationStage(q,p,state),tracked=state.trackedQuest?.projectId===p.id&&state.trackedQuest?.title===q.title;const verbs={signal:'TRACE SIGNAL',hardware:'INSPECT HARDWARE',mapping:'MAP EVIDENCE',design:'RECONCILE DESIGN',audit:'AUDIT RECORDS',review:'WITNESS & REVIEW',engineering:'TRACE ENGINEERING',reconcile:'RECONCILE AUTHORITY'};return `<article class="card quest ${tracked?'tracked':''}"><b>${esc(q.title)}</b><small>${esc(p.name)} · ${esc(verbs[q.archetype]||q.archetype.toUpperCase())}</small><p>${esc(q.detail)}</p><span class="tag ${esc(q.status)}">SOURCE: ${esc(q.status.toUpperCase())}</span><span class="tag stage-${stage.toLowerCase()}">${stage}</span><button class="travel quest-track" data-track-project="${esc(p.id)}" data-track-title="${esc(q.title)}">${tracked?'◆ TRACKING':'◇ TRACK QUEST'}</button></article>`}
function wireQuestTrackers(){body.querySelectorAll('[data-track-project]').forEach(b=>b.onclick=()=>{const same=state.trackedQuest?.projectId===b.dataset.trackProject&&state.trackedQuest?.title===b.dataset.trackTitle;state.trackedQuest=same?null:{projectId:b.dataset.trackProject,title:b.dataset.trackTitle};if(same)save();else logEvent('quest',`Tracking ${b.dataset.trackTitle}`,'Source-backed quest selected for navigation.',b.dataset.trackProject);stinger(same?'enter':'waystone');notify(same?'Quest tracking cleared.':`Tracking · ${b.dataset.trackTitle}`,2100);questPanel()})}
function projectQuestPanel(p){panelOpen(`<p class="eyebrow">${esc(p.name)}</p><h2>QUEST BOARD</h2><p>Investigation stages are Worldwalker progress. Source status remains authoritative.</p><div class="cards">${(p.quests||[]).map(q=>questCard(q,p)).join('')}</div>`);wireQuestTrackers()}
function questPanel(){panelOpen(`<h2>QUESTS & EXPEDITIONS</h2><p>Rumor → Confirmed → Evidence → Verified is an evidence ladder, not an XP bar.</p><div class="cards">${projects.flatMap(p=>(p.quests||[]).map(q=>questCard(q,p))).join('')}</div><h3>CROSS-PROJECT EXPEDITIONS</h3>${expeditionCards()}`);wireQuestTrackers()}
function expeditionCards(){if(!relationships.length)return'<p>No source-backed cross-project roads are currently derivable.</p>';return `<div class="cards">${relationships.map(r=>{const a=projectOf(r.a),b=projectOf(r.b),ready=state.expeditions[r.id]?.unlocked;return `<article class="card"><b>${esc(a?.name)} ↔ ${esc(b?.name)}</b><small>SHARED-TECH EXPEDITION</small><p>${esc(r.evidence)}</p><span class="tag ${ready?'sealed':'unknown'}">${ready?'ROAD OPEN':'VISIT BOTH ENDS'}</span>${state.secrets[r.id]?'<span class="tag sealed">SECRET MAPPED</span>':''}</article>`}).join('')}</div>`}
function artifactList(p,items=[]){return items.length?items.slice(0,12).map(a=>{const id=`${p.id}:${a.rel}`,found=state.discoveredArtifacts[id];return `<button class="artifact-row ${found?'found':''}" data-artifact-project="${esc(p.id)}" data-artifact-rel="${esc(a.rel)}"><span><b>${found?'FOUND · ':''}${esc(a.name)}</b><code>${esc(a.rel)}</code></span><em>${esc(a.kind||'file')} · ${formatBytes(a.size)}</em></button>`}).join(''):'<p>No bounded artifact inventory available.</p>'}
function wireArtifactButtons(){body.querySelectorAll('[data-artifact-project]').forEach(b=>b.onclick=()=>{const p=projectOf(b.dataset.artifactProject),a=p?.artifacts?.find(x=>x.rel===b.dataset.artifactRel);if(p&&a)artifactDetail(p,a)})}
function projectArtifactsPanel(p){panelOpen(`<p class="eyebrow">${esc(p.name)} · GALLERY</p><h2>ARTIFACTS</h2><p>Artifacts become found objects in the world. Discovery changes Worldwalker only; source bytes remain where they are.</p>${artifactList(p,p.artifacts||[])}`);wireArtifactButtons()}
function artifactsPanel(){const all=projects.flatMap(p=>(p.artifacts||[]).slice(0,8).map(a=>({p,a}))).sort((x,y)=>y.a.mtime.localeCompare(x.a.mtime));panelOpen(`<h2>ARTIFACT VAULT</h2><p>Recent evidence from bounded source scans.</p>${all.map(({p,a})=>artifactList(p,[a])).join('')||'<p>Live artifact data requires the local server.</p>'}`);wireArtifactButtons()}
function artifactDetail(p,a){state.discoveredArtifacts[`${p.id}:${a.rel}`]=true;save();const src=artifactUrl(p.id,a.rel);const visual=a.previewable&&a.kind==='image'?`<img class="artifact-preview" src="${src}" alt="Preview of ${esc(a.name)}">`:'';panelOpen(`<p class="eyebrow">FOUND OBJECT · ${esc(p.name)}</p><h2>${esc(a.name)}</h2>${visual}<p><code>${esc(a.rel)}</code></p><p>${esc(a.kind||'file')} · ${formatBytes(a.size)} · ${new Date(a.mtime).toLocaleString()}</p>${a.previewable&&a.kind!=='image'?`<button class="primary" id="previewArtifact">OPEN READ-ONLY PREVIEW</button>`:''}`);const b=$('#previewArtifact');if(b)b.onclick=()=>window.open(src,'_blank','noopener')}
function projectHistoryPanel(p){const c=p.git?.commits||[];panelOpen(`<p class="eyebrow">${esc(p.name)}</p><h2>RECENT HISTORY</h2><div class="timeline">${c.length?c.map(x=>`<div class="event"><b>${esc(x.subject)}</b><small>${new Date(x.date).toLocaleString()} · ${esc(x.hash)}</small></div>`).join(''):'<p>No Git history exposed.</p>'}</div><button class="primary" id="walkChronicle">WALK THE CHRONICLE</button>`);$('#walkChronicle').onclick=()=>{closePanel();enterChronicle()}}
function purposePanel(p){panelOpen(`<p class="eyebrow">SHRINE · WHY THIS EXISTS</p><h2>${esc(p.name)}</h2><p>${esc(p.summary)}</p><h3>PROTECTED PURPOSE</h3><p>Worldwalker may make this project easier to remember, inspect and revisit. It must not replace the project’s own authority or silently mutate it.</p><h3>LANDMARK</h3><p><b>${esc(p.landmark)}</b> remains fixed on the world map so spatial memory survives interface changes.</p>`)}
function relationshipPanel(r){const a=projectOf(r.a),b=projectOf(r.b);panelOpen(`<p class="eyebrow">HIDDEN ROAD · SOURCE-BACKED RELATIONSHIP</p><h2>${esc(a?.name)} ↔ ${esc(b?.name)}</h2><p>${esc(r.evidence)}</p><h3>WHAT THIS PROVES</h3><p>These projects expose shared technology: <b>${esc(r.shared.join(', '))}</b>.</p><h3>WHAT IT DOES NOT PROVE</h3><p>Shared purpose, canon, authorship, dependency or chronology are not inferred.</p>`)}
function changesPanel(){panelOpen(`<p class="eyebrow">THE WORLD STIRS</p><h2>WHAT CHANGED?</h2><p>These regions differ from the source digest remembered on your previous visit. A condition transition is shown only when Worldwalker actually remembers the prior condition.</p>${changes.length?`<div class="cards">${changes.map(c=>`<article class="card"><b>${esc(c.name)}</b><p>${esc(c.latest)}</p><span class="tag ${esc(c.condition)}">${c.fromCondition?`${esc(c.fromCondition.toUpperCase())} → `:''}${esc(c.condition.toUpperCase())}</span></article>`).join('')}</div>`:'<p>No new source changes are waiting.</p>'}`)}
function manualPanel(focusId){const recovered=MANUAL_PAGES.filter(m=>state.manualPages[m.id]);const focus=MANUAL_PAGES.find(m=>m.id===focusId);panelOpen(`${focus?`<p class="eyebrow">RECOVERED FIELD NOTE</p><h2>${esc(focus.title)}</h2><p>${esc(focus.text)}</p><hr>`:''}<h2>WORLDWALKER FIELD MANUAL</h2><p>${recovered.length} / ${MANUAL_PAGES.length} pages recovered.</p><div class="cards">${MANUAL_PAGES.map(m=>state.manualPages[m.id]?`<article class="card"><b>${esc(m.title)}</b><p>${esc(m.text)}</p></article>`:`<article class="card locked"><b>UNRECOVERED PAGE</b><small>Explore the world.</small></article>`).join('')}</div>`)}
function cycleTrackedQuest(){
  const allQuests=projects.flatMap(p=>(p.quests||[]).map(q=>({p,q})));
  if(!allQuests.length)return notify('No quests available.');
  const currIdx=allQuests.findIndex(x=>state.trackedQuest?.projectId===x.p.id&&state.trackedQuest?.title===x.q.title);
  const nextIdx=(currIdx+1)%allQuests.length;
  const next=allQuests[nextIdx];
  state.trackedQuest={projectId:next.p.id,title:next.q.title};
  save();
  stinger('waystone');
  notify(`Tracking · ${next.q.title} (${next.p.name})`,2200);
  updateQuestHud();
}
function toggleCompass(){
  state.compassVisible=!state.compassVisible;
  save();
  notify(`World Compass: ${state.compassVisible?'ON':'OFF'}`);
}
function notificationsPanel(){
  const hist=[...state.toastHistory].reverse();
  panelOpen(`
    <p class="eyebrow">DISPATCH COMMUNICATIONS</p>
    <h2>NOTIFICATIONS &amp; DISPATCHES</h2>
    <p>Recent atmospheric notifications, road updates, and milestones.</p>
    <div class="timeline">
      ${hist.length?hist.slice(0,30).map(h=>`
        <div class="event">
          <b>${esc(h.msg)}</b>
          <small>${new Date(h.at).toLocaleTimeString()}</small>
        </div>
      `).join(''):'<p>No dispatches recorded yet.</p>'}
    </div>
  `);
}
function capturePostcard(){
  const p=currentProject();
  const c=document.createElement('canvas');
  c.width=canvas.width;c.height=canvas.height;
  const cctx=c.getContext('2d');
  cctx.drawImage(canvas,0,0);
  cctx.fillStyle='#07101bdd';
  cctx.fillRect(16,c.height-60,c.width-32,44);
  cctx.strokeStyle='#c8b985';cctx.lineWidth=2;
  cctx.strokeRect(16,c.height-60,c.width-32,44);
  cctx.fillStyle='#f6d27f';cctx.font='700 15px Georgia, serif';
  cctx.fillText(`WORLDWALKER · ${p?p.name.toUpperCase():'THE CROSSROADS'}`,32,c.height-32);
  cctx.fillStyle='#aab6c8';cctx.font='11px monospace';
  cctx.fillText(`${new Date().toLocaleDateString()} · X:${Math.round(state.player.x)} Y:${Math.round(state.player.y)}`,c.width-280,c.height-32);
  const data=c.toDataURL('image/png');
  const a=document.createElement('a');a.href=data;a.download=`worldwalker-postcard-${Date.now()}.png`;
  a.click();
  stinger('discover');
  notify('Expedition Postcard downloaded!');
}
function jukeboxPanel(){
  panelOpen(`
    <p class="eyebrow">ADAPTIVE AUDIO SYNTHESIS</p>
    <h2>JUKEBOX STUDIO</h2>
    <p>Audition region-specific modal scales and acoustic stingers synthesized in real-time Web Audio.</p>
    <div class="cards">
      <article class="card">
        <b>THE CROSSROADS</b>
        <small>DORIAN ROOT · 130.8 Hz</small>
        <button class="travel" data-theme="crossroads">▶ AUDITION CROSSROADS</button>
      </article>
      ${projects.map(p=>`
        <article class="card">
          <b>${esc(p.name.toUpperCase())}</b>
          <small>${esc(p.biome.toUpperCase())} THEME · ${esc(p.landmark)}</small>
          <button class="travel" data-theme="${esc(p.id)}">▶ AUDITION ${esc(p.name.toUpperCase())}</button>
        </article>
      `).join('')}
    </div>
    <h3>ACOUSTIC STINGERS</h3>
    <div class="cards" style="grid-template-columns:repeat(2,1fr);">
      <button class="travel" data-stinger="discover">✦ DISCOVERY</button>
      <button class="travel" data-stinger="waystone">◆ WAYSTONE</button>
      <button class="travel" data-stinger="secret">⌖ SECRET ROAD</button>
      <button class="travel" data-stinger="blocked">↯ BLOCKED</button>
      <button class="travel" data-stinger="enter">⚑ ENTER</button>
      <button class="travel" data-stinger="rest">☕ REST</button>
    </div>
    <h3>MASTER VOLUME</h3>
    <input type="range" id="volSlider" min="0" max="1" step="0.05" value="${getVolume()}" style="width:100%;margin:10px 0;">
  `);
  body.querySelectorAll('[data-theme]').forEach(b=>b.onclick=()=>{previewTheme(b.dataset.theme);notify(`Theme: ${b.dataset.theme}`)});
  body.querySelectorAll('[data-stinger]').forEach(b=>b.onclick=()=>{stinger(b.dataset.stinger);notify(`Stinger: ${b.dataset.stinger}`)});
  const s=$('#volSlider');if(s)s.oninput=e=>{setVolume(Number(e.target.value));state.masterVolume=getVolume();save()};
}
function techMatrixPanel(){
  const matrix=technologyMatrix(projects);
  panelOpen(`
    <p class="eyebrow">CROSS-PROJECT ARCHITECTURE</p>
    <h2>TECHNOLOGY MATRIX</h2>
    <p>Live analysis of toolchains, languages, and shared dependencies across all ${projects.length} regions.</p>
    <div class="cards">
      ${matrix.map(([tag,projs])=>`
        <article class="card">
          <b><span class="tag" style="font-size:12px;">${esc(tag.toUpperCase())}</span></b>
          <small>${projs.length} REGION${projs.length===1?'':'S'} SHARING SIGNATURE</small>
          <p>${esc(projs.join(' · '))}</p>
        </article>
      `).join('')}
    </div>
  `);
}
function milestonesPanel(){
  const list=explorationMilestones(state);
  const count=list.filter(m=>m.achieved).length;
  panelOpen(`
    <p class="eyebrow">EXPLORATION PROGRESS</p>
    <h2>EXPEDITION MILESTONES</h2>
    <p>${count} / ${list.length} milestones unlocked. These reflect genuine geographic exploration, not player levels or productivity scores.</p>
    <div class="cards">
      ${list.map(m=>`
        <article class="card ${m.achieved?'':'locked'}">
          <b>${m.achieved?'✦ ':'◇ '}${esc(m.title)}</b>
          <small>${m.achieved?'UNLOCKED':'INCOMPLETE'}</small>
          <p>${esc(m.detail)}</p>
        </article>
      `).join('')}
    </div>
  `);
}
function journalPanel(filter='all',query=''){
  const icons={arrival:'⌖',artifact:'▣',manual:'▤',secret:'✦',waystone:'◆',quest:'⚑',echo:'◌',shift:'↯',travel:'→',encounter:'☄',inspection:'◇'};
  let entries=[...state.journal].reverse();
  if(filter!=='all'){
    if(filter==='discoveries')entries=entries.filter(e=>['artifact','manual','secret'].includes(e.kind));
    else if(filter==='shifts')entries=entries.filter(e=>e.kind==='shift');
    else if(filter==='waystones')entries=entries.filter(e=>e.kind==='waystone');
    else if(filter==='encounters')entries=entries.filter(e=>e.kind==='encounter');
  }
  if(query.trim()){
    const q=query.toLowerCase().trim();
    entries=entries.filter(e=>(e.title&&e.title.toLowerCase().includes(q))||(e.detail&&e.detail.toLowerCase().includes(q)));
  }
  panelOpen(`
    <p class="eyebrow">LOCAL EXPLORATION MEMORY</p>
    <h2>EXPEDITION JOURNAL</h2>
    <p>This records what happened <b>inside Worldwalker</b>. It is not a productivity score and never writes back to source projects.</p>
    <div class="journal-summary">
      <span>${state.journal.length} recorded events</span>
      <span>${Object.keys(state.echoes).length} echoes</span>
      <span>${Object.keys(state.waystones).length} waystones</span>
    </div>
    <div class="journal-filters" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
      <button class="tag ${filter==='all'?'open':''}" data-filter="all">ALL</button>
      <button class="tag ${filter==='discoveries'?'open':''}" data-filter="discoveries">DISCOVERIES</button>
      <button class="tag ${filter==='shifts'?'open':''}" data-filter="shifts">SHIFTS</button>
      <button class="tag ${filter==='waystones'?'open':''}" data-filter="waystones">WAYSTONES</button>
      <button class="tag ${filter==='encounters'?'open':''}" data-filter="encounters">ENCOUNTERS</button>
      <button class="tag" id="openMilestones">✦ MILESTONES</button>
    </div>
    <input type="search" id="journalSearch" placeholder="Filter memories..." value="${esc(query)}" style="width:100%;padding:8px;background:#0c1119;border:1px solid #303a49;color:#fff;margin-bottom:14px;">
    <div class="timeline journal-timeline">
      ${entries.length?entries.slice(0,80).map(e=>`
        <div class="event journal-event">
          <i>${icons[e.kind]||'·'}</i>
          <b>${esc(e.title)}</b>
          <small>${new Date(e.at).toLocaleString()}${e.projectId?` · ${esc(projectOf(e.projectId)?.name||e.projectId)}`:''}</small>
          ${e.detail?`<p>${esc(e.detail)}</p>`:''}
        </div>
      `).join(''):'<p>No memories match your query.</p>'}
    </div>
  `);
  body.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>journalPanel(b.dataset.filter,s?.value||''));
  const s=$('#journalSearch');
  if(s){
    s.oninput=e=>{
      let filtered=[...state.journal].reverse();
      if(filter!=='all'){
        if(filter==='discoveries')filtered=filtered.filter(x=>['artifact','manual','secret'].includes(x.kind));
        else if(filter==='shifts')filtered=filtered.filter(x=>x.kind==='shift');
        else if(filter==='waystones')filtered=filtered.filter(x=>x.kind==='waystone');
        else if(filter==='encounters')filtered=filtered.filter(x=>x.kind==='encounter');
      }
      if(e.target.value.trim()){
        const term=e.target.value.toLowerCase().trim();
        filtered=filtered.filter(x=>(x.title&&x.title.toLowerCase().includes(term))||(x.detail&&x.detail.toLowerCase().includes(term)));
      }
      const tl=body.querySelector('.journal-timeline');
      if(tl){
        tl.innerHTML=filtered.length?filtered.slice(0,80).map(x=>`
          <div class="event journal-event">
            <i>${icons[x.kind]||'·'}</i>
            <b>${esc(x.title)}</b>
            <small>${new Date(x.at).toLocaleString()}${x.projectId?` · ${esc(projectOf(x.projectId)?.name||x.projectId)}`:''}</small>
            ${x.detail?`<p>${esc(x.detail)}</p>`:''}
          </div>
        `).join(''):'<p>No memories match your query.</p>';
      }
    };
    if(query){s.focus();s.setSelectionRange(s.value.length,s.value.length)}
  }
  const mBtn=$('#openMilestones');if(mBtn)mBtn.onclick=milestonesPanel;
}

let currentAtlasMode='atlas';
let surveyTarget=null;
function mapPanel(mode=null){
  if(mode)currentAtlasMode=mode;
  const svgW=440,svgH=320,pt=p=>[20+p.x/WORLD.w*400,20+p.y/WORLD.h*270];
  
  if(currentAtlasMode==='orrery'){
    const cx=svgW/2, cy=svgH/2;
    const rings=[45, 80, 115, 150];
    const orbProj=projects.filter(p=>p.id!=='orbital');
    const orbitalProject=projectOf('orbital')||projects[0];
    const conditionColors={sealed:'#72d888',verified:'#72d888',active:'#f2c460',open:'#f2c460',blocked:'#ef7773',unknown:'#aab3c2',quiet:'#74b9e0'};
    
    const ringSvgs=rings.map((r)=>`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#2b3b52" stroke-width="1.2" stroke-dasharray="3 3"/>`).join('');
    const planetSvgs=orbProj.map((p,i)=>{
      const r=rings[i%rings.length];
      const speed=0.0003*(i+1);
      const angle=(now*speed)+(i*Math.PI/2);
      const px=cx+Math.cos(angle)*r;
      const py=cy+Math.sin(angle)*r;
      const col=conditionColors[p.condition]||'#fff';
      return `
        <g transform="translate(${px.toFixed(1)} ${py.toFixed(1)})">
          <circle r="9" fill="${col}" filter="drop-shadow(0 0 4px ${col})"/>
          <circle r="12" fill="none" stroke="${col}" stroke-width="1" opacity=".4"/>
          <text y="-14" fill="#f4e7bf" font-size="7" font-family="monospace" text-anchor="middle">${esc(p.name.toUpperCase())}</text>
          <text y="20" fill="#8ca0af" font-size="6" font-family="monospace" text-anchor="middle">${esc((p.condition||'unknown').toUpperCase())}</text>
        </g>
      `;
    }).join('');
    
    const centerColor=conditionColors[orbitalProject.condition]||'#a8b5cc';
    const centerSvg=`
      <g transform="translate(${cx} ${cy})">
        <circle r="18" fill="#13243d" stroke="${centerColor}" stroke-width="2" filter="drop-shadow(0 0 8px ${centerColor})"/>
        <text y="3" fill="#f6d27f" font-size="7" font-family="monospace" font-weight="bold" text-anchor="middle">MERIDIAN</text>
      </g>
    `;
    
    panelOpen(`
      <p class="eyebrow">GRAND CARTOGRAPHIC INSTRUMENT</p>
      <h2>THE ECOSYSTEM ORRERY</h2>
      <p>Live cosmic model of the five monitored source projects. Orbital luminescence reflects Git freshness, and spectra encode source condition.</p>
      <div class="atlas-mode-tabs" style="display:flex;gap:6px;margin:12px 0;">
        <button class="tag" data-map-mode="atlas">🗺 GRAND ATLAS</button>
        <button class="tag" data-map-mode="surveyor">🧭 ROUTE SURVEYOR</button>
        <button class="tag open" data-map-mode="orrery">🪐 ECOSYSTEM ORRERY</button>
      </div>
      <svg class="world-map" viewBox="0 0 ${svgW} ${svgH}" role="img" aria-label="Ecosystem Orrery celestial view">
        <rect width="${svgW}" height="${svgH}" rx="8" fill="#05080e"/>
        <radialGradient id="spaceGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#142642" stop-opacity="0.8"/>
          <stop offset="100%" stop-color="#05080e" stop-opacity="1"/>
        </radialGradient>
        <rect width="${svgW}" height="${svgH}" fill="url(#spaceGrad)"/>
        ${ringSvgs}
        ${centerSvg}
        ${planetSvgs}
      </svg>
      <h3>SOURCE REGION TELEMETRY</h3>
      <div class="cards">
        ${projects.map(p=>`
          <article class="card">
            <b>${esc(p.name)}</b>
            <small>${esc(p.landmark)} · CONDITION: ${esc((p.condition||'unknown').toUpperCase())}</small>
            <p>${p.git?`Branch: <code>${esc(p.git.branch)}</code> · Commit: <code>${esc(p.git.commits?.[0]?.hash||'none')}</code>`:'No git repository exposed.'}</p>
          </article>
        `).join('')}
      </div>
    `);
    body.querySelectorAll('[data-map-mode]').forEach(b=>b.onclick=()=>mapPanel(b.dataset.mapMode));
    return;
  }
  
  const lines=[];
  const direct=[['starsilk','orbital'],['orbital','atlas'],['orbital','screen-weasels'],['orbital','dash']];
  for(const [aId,bId] of direct){
    const a=projectOf(aId),b=projectOf(bId);
    if(!a||!b)continue;
    const [x1,y1]=pt(a),[x2,y2]=pt(b);
    lines.push(`<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}" class="map-road"/>`);
  }
  for(const r of relationships){
    if(!state.expeditions[r.id]?.unlocked)continue;
    const a=projectOf(r.a),b=projectOf(r.b);
    if(!a||!b)continue;
    const [x1,y1]=pt(a),[x2,y2]=pt(b);
    lines.push(`<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}" class="map-road secret"/>`);
  }
  
  const contourLines=`
    <path d="M40 70 Q120 40 220 80 T400 60" fill="none" stroke="#687e5b" stroke-width="1" stroke-dasharray="2 2" opacity=".6"/>
    <path d="M20 120 Q180 90 280 140 T420 120" fill="none" stroke="#687e5b" stroke-width="1" stroke-dasharray="2 2" opacity=".6"/>
    <path d="M30 220 Q160 180 260 230 T410 200" fill="none" stroke="#5d7250" stroke-width="1" stroke-dasharray="2 2" opacity=".6"/>
  `;
  
  const pinSvgs=(state.activePins||[]).map(pin=>{
    const [px,py]=pt(pin);
    return `<g transform="translate(${px.toFixed(1)} ${py.toFixed(1)})"><polygon points="0,0 -4,-8 4,-8" fill="${pin.color||'#f6c65b'}"/><circle cx="0" cy="-8" r="4" fill="${pin.color||'#f6c65b'}"/><text y="-14" fill="#f6c65b" font-size="6" font-family="monospace" text-anchor="middle">${esc(pin.label)}</text></g>`;
  }).join('');
  
  const [plx,ply]=pt(state.player);
  const playerSvg=`<g transform="translate(${plx.toFixed(1)} ${ply.toFixed(1)})"><circle r="4" fill="#4bd8ff" filter="drop-shadow(0 0 3px #4bd8ff)"/><circle r="7" fill="none" stroke="#4bd8ff" stroke-width="1" opacity=".7"/><text y="-8" fill="#4bd8ff" font-size="6" font-family="monospace" text-anchor="middle">YOU</text></g>`;
  
  const marks=projects.map(p=>{
    const[x,y]=pt(p),known=state.visited[p.id];
    return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle r="${known?8:5}" class="map-mark ${known?'known':'unknown'}"/><text y="-12">${known?esc(p.landmark.toUpperCase()):'???'}</text></g>`;
  }).join('');
  
  let surveyLine='';
  let surveyInfoHtml='';
  if(currentAtlasMode==='surveyor'){
    const target=(surveyTarget?projectOf(surveyTarget):null)||projects.find(p=>p.id!==state.interiorProjectId)||projects[0];
    const route=calculateWalkingRoute({x:state.player.x,y:state.player.y},{x:target.x,y:target.y});
    const pts=route.points.map(p=>pt(p));
    const dStr='M '+pts.map(p=>`${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L ');
    surveyLine=`<path d="${dStr}" fill="none" stroke="#f6c65b" stroke-width="2.5" stroke-dasharray="4 2" filter="drop-shadow(0 0 4px #f6c65b)"/>`;
    
    surveyInfoHtml=`
      <div class="card" style="border-color:#f6c65b;margin-top:10px;">
        <b>EXPEDITION ROUTE SURVEYOR · TARGET: ${esc(target.name.toUpperCase())}</b>
        <p>Calculated path from your coordinates (${Math.round(state.player.x)}, ${Math.round(state.player.y)}) to ${esc(target.landmark)}.</p>
        <p>• <b>Distance:</b> ${route.distance} meters (~${(route.distance/400).toFixed(1)} leagues)<br>
           • <b>Estimated Travel:</b> ~${route.steps} steps<br>
           • <b>Elevation Trend:</b> ${route.elevationDelta>0?`+${route.elevationDelta} tiers (Climbing)`:route.elevationDelta<0?`${route.elevationDelta} tiers (Descending)`:'Level grade'}<br>
           • <b>River Navigation:</b> ${Math.sign(state.player.x-38)!==Math.sign(target.x-38)?'Great River crossing needed (use bridges, stepping stones, or raft ferry)':'Direct land traversal'}</p>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">
          ${projects.map(p=>`<button class="tag ${target.id===p.id?'open':''}" data-survey="${p.id}">${esc(p.name.toUpperCase())}</button>`).join('')}
        </div>
      </div>
    `;
  }
  
  panelOpen(`
    <p class="eyebrow">GRAND CARTOGRAPHIC EXPEDITION ATLAS</p>
    <h2>THE WORLD</h2>
    <p>Fixed geography. Topographic contours and road alignments derive from verified survey evidence.</p>
    <div class="atlas-mode-tabs" style="display:flex;gap:6px;margin:12px 0;">
      <button class="tag ${currentAtlasMode==='atlas'?'open':''}" data-map-mode="atlas">🗺 GRAND ATLAS</button>
      <button class="tag ${currentAtlasMode==='surveyor'?'open':''}" data-map-mode="surveyor">🧭 ROUTE SURVEYOR</button>
      <button class="tag ${currentAtlasMode==='orrery'?'open':''}" data-map-mode="orrery">🪐 ECOSYSTEM ORRERY</button>
    </div>
    <svg class="world-map" viewBox="0 0 ${svgW} ${svgH}" role="img" aria-label="Illustrated Worldwalker map">
      <defs>
        <pattern id="grain" width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M0 8L8 0" stroke="#000" opacity=".08"/>
        </pattern>
      </defs>
      <rect width="${svgW}" height="${svgH}" rx="8" fill="#c8b985"/>
      <path d="M0 185 Q110 145 190 190 T${svgW} 170 V${svgH} H0Z" fill="#7e986a"/>
      <path d="M190 0 Q210 100 184 ${svgH}" stroke="#486f78" stroke-width="12" fill="none" opacity=".8"/>
      ${contourLines}
      ${lines.join('')}
      ${surveyLine}
      ${pinSvgs}
      ${marks}
      ${playerSvg}
      <rect width="${svgW}" height="${svgH}" fill="url(#grain)"/>
    </svg>
    <div style="display:flex;gap:8px;margin-bottom:12px;">
      <button class="tag" id="addPinBtn">📍 DROP PIN AT LOCATION</button>
      <button class="tag" id="clearPinsBtn">✕ CLEAR PINS</button>
    </div>
    ${surveyInfoHtml}
    <div class="cards">
      ${projects.map(p=>`
        <article class="card">
          <b>${esc(p.name)}</b>
          <small>${state.waystones[p.id]?'WAYSTONE ATTUNED':state.visited[p.id]?'LANDMARK KNOWN':'UNVISITED'} · ${esc((p.condition||'unknown').toUpperCase())}</small>
          <button class="travel" data-travel="${p.id}" ${state.waystones[p.id]?'':'disabled'}>
            ⌖ ${state.waystones[p.id]?'FAST TRAVEL TO WAYSTONE':'UNATTUNED WAYSTONE'}
          </button>
        </article>
      `).join('')}
    </div>
  `);
  
  body.querySelectorAll('[data-map-mode]').forEach(b=>b.onclick=()=>mapPanel(b.dataset.mapMode));
  body.querySelectorAll('[data-survey]').forEach(b=>b.onclick=()=>{surveyTarget=b.dataset.survey;mapPanel('surveyor')});
  body.querySelectorAll('[data-travel]').forEach(b=>{
    b.onclick=()=>{
      const p=projectOf(b.dataset.travel);
      if(!state.waystones[p.id])return;
      state.player.x=p.x;state.player.y=p.y+5;
      camera.x=state.player.x;camera.y=state.player.y;
      stinger('waystone');
      logEvent('travel',`Waystone travel · ${p.name}`,p.landmark,p.id);
      closePanel();
      notify(`Waystone travel: ${p.name}`);
    };
  });
  const addPin=$('#addPinBtn');
  if(addPin)addPin.onclick=()=>{
    const label=window.prompt('Enter marker label:','Camp');
    if(!label)return;
    state.activePins.push({x:state.player.x,y:state.player.y,label:label.slice(0,18),color:'#f6c65b'});
    save();
    notify(`Pin placed: ${label}`);
    mapPanel(currentAtlasMode);
  };
  const clearPins=$('#clearPinsBtn');
  if(clearPins)clearPins.onclick=()=>{
    state.activePins=[];save();notify('All custom pins removed.');mapPanel(currentAtlasMode);
  };
}

function helpPanel(){
  panelOpen(`
    <h2>HOW TO WALK</h2>
    <h3>MOVEMENT &amp; SHORTCUTS</h3>
    <p><b>WASD / arrows</b> walk · <b>Shift</b> sprints · <b>Space</b> hops/strides · <b>C</b> traverses · <b>Enter</b> interacts</p>
    <p><b>T</b> cycle tracked quest · <b>O</b> toggle compass · <b>L</b> open dispatch log · <b>J</b> jukebox studio · <b>P</b> postcard snapshot · <b>M</b> mute/unmute score · <b>R</b> recenter camera · <b>F3</b> diagnostics</p>
    <h3>DIALOGUE &amp; CONTROLLER</h3>
    <p><b>Enter / A</b> advances dialogue · <b>Escape / B</b> closes it. Controller: left stick walks, A interacts, B hops, X traverses, Start opens the map and R2/stick-click sprints.</p>
    <h3>ROAD ENCOUNTERS &amp; TOWNS</h3>
    <p>Long walks can trigger non-combat travel encounters. Their narrative wrapper is Worldwalker fiction; quoted project status is source-backed. Settlement residents follow morning/day/evening/night schedules and towns light up after dusk.</p>
    <h3>INTERIORS &amp; WAYSTONES</h3>
    <p>Small gold glints mark inspectable furniture and instruments. Waystones can fast-travel or open a Journey Recap. Resting changes no source state.</p>
    <h3>QUESTS, SHIFTS &amp; ECHOES</h3>
    <p>Track any source-backed quest from the quest board to get a world compass. When real project state changes, the Crossroads messenger can trigger a <b>World Shift</b> showing only transitions Worldwalker can actually remember. Pale cyan sparks are <b>World Echoes</b>: optional interpretive scenery, explicitly not source evidence.</p>
    <h3>EXPEDITION JOURNAL</h3>
    <p>The Journal remembers exploration events, discoveries, inspections, road encounters, waystone travel and observed World Shifts. It is local exploration history, not XP or a productivity score.</p>
    <h3>WORLD RULES</h3>
    <ul>
      <li>Source projects are read-only.</li>
      <li>Unknown remains unknown.</li>
      <li>Commit history is evidence, not automatic proof of completion.</li>
      <li>Deferred work is not overdue work.</li>
      <li>Completed source state can permanently repair its region.</li>
    </ul>
    <h3>SYSTEM CONTROLS &amp; BACKUP</h3>
    <div style="display:grid;gap:8px;margin-top:10px;">
      <button class="primary" id="btnExportSave">BACKUP SAVE GAME (JSON)</button>
      <button class="primary" id="btnImportSave">RESTORE SAVE GAME</button>
      <input type="file" id="importFileInput" accept=".json" style="display:none;">
      <button class="primary" id="btnHighContrast">TOGGLE HIGH-CONTRAST ACCESSIBILITY</button>
      <button class="primary" id="btnTextSpeed">CYCLE DIALOGUE TEXT SPEED</button>
    </div>
    <p class="tiny">Feature contract loaded: ${FEATURE_CONTRACT.length}/20 systems.</p>
  `);
  const expBtn=$('#btnExportSave');if(expBtn)expBtn.onclick=exportSave;
  const impBtn=$('#btnImportSave');const impInp=$('#importFileInput');
  if(impBtn&&impInp){
    impBtn.onclick=()=>impInp.click();
    impInp.onchange=e=>{
      const file=e.target.files?.[0];
      if(!file)return;
      const reader=new FileReader();
      reader.onload=ev=>importSave(ev.target.result);
      reader.readAsText(file);
    };
  }
  const hcBtn=$('#btnHighContrast');
  if(hcBtn)hcBtn.onclick=()=>{
    document.body.classList.toggle('high-contrast');
    notify(`High-contrast: ${document.body.classList.contains('high-contrast')?'ON':'OFF'}`);
  };
  const speedBtn=$('#btnTextSpeed');
  if(speedBtn){
    speedBtn.onclick=()=>{
      const speeds=['normal','fast','instant'];
      const current=window.__dialogueSpeed||'normal';
      const next=speeds[(speeds.indexOf(current)+1)%speeds.length];
      window.__dialogueSpeed=next;
      setDialogueSpeed(next);
      notify(`Dialogue speed: ${next.toUpperCase()}`);
    };
  }
}

window.addEventListener('keydown',e=>{
  const isInput=['input','textarea','select'].includes(e.target?.tagName?.toLowerCase());
  const k=e.key.toLowerCase();
  if(isInput){
    if(k==='escape')e.target.blur();
    return;
  }
  if(['arrowup','arrowdown','arrowleft','arrowright',' ','enter'].includes(k))e.preventDefault();
  if(k==='m'){state.audioMuted=toggleMuted();updateAudioButton();save();notify(state.audioMuted?'Score muted.':'Score restored.');return}
  if(isDialogueOpen()){
    if(k==='enter'||k===' ')return advanceDialogue();
    if(k==='escape')return closeDialogue();
    if(k>='1'&&k<='9'){selectDialogueChoice(Number(k)-1);return}
    return;
  }
  if(k==='escape'){if(panel.classList.contains('open'))return closePanel();if(state.mode==='interior')return leaveInterior();if(state.mode==='chronicle')return leaveChronicle();}
  if(k==='t'){cycleTrackedQuest();return}
  if(k==='o'){toggleCompass();return}
  if(k==='l'){notificationsPanel();return}
  if(k==='j'){jukeboxPanel();return}
  if(k==='p'){capturePostcard();return}
  if(k==='r'){focusCamera(camera,state.player.x,state.player.y,1.0);notify('Camera centered.');return}
  if(k==='f3'){const f=$('#f3Hud');if(f)f.classList.toggle('hidden');return}
  if(k==='1'){mapPanel();return}
  if(k==='2'){questPanel();return}
  if(k==='3'){artifactsPanel();return}
  if(k==='4'){enterChronicle();return}
  if(k==='5'){journalPanel();return}
  if(k==='6'){manualPanel();return}
  if(k==='7'){$('#artCodexButton')?.click();return}
  if(k==='8'){helpPanel();return}
  if(k===' '){startHop();return}if(k==='c'){useTraversal();return}if(k==='enter'){interact();return}keys.add(k);
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('gamepadconnected',e=>notify(`Controller ready · ${e.gamepad.id.split('(')[0].trim()}`,2400));
window.addEventListener('gamepaddisconnected',()=>{padButtons=[];padSprint=false;notify('Controller disconnected.',1800)});
$('#wake').onclick=async()=>{if(running)return;$('#boot').classList.add('hidden');$('#app').classList.remove('hidden');await initAudio();setMuted(!!state.audioMuted);updateAudioButton();await loadSnapshot();camera.x=state.player.x;camera.y=state.player.y;running=true;last=performance.now();requestAnimationFrame(loop)};
$('#closePanel').onclick=closePanel;
$('#audioToggle').onclick=()=>{state.audioMuted=toggleMuted();updateAudioButton();save();notify(state.audioMuted?'Score muted.':'Score restored.')};
document.querySelectorAll('.dock button').forEach(b=>b.onclick=()=>{
  const fn={atlas:mapPanel,quests:questPanel,artifacts:artifactsPanel,chronicle:enterChronicle,journal:journalPanel,manual:()=>manualPanel(),help:helpPanel}[b.dataset.panel];if(fn)fn();
});
document.querySelectorAll('[data-hold]').forEach(b=>{const k=b.dataset.hold;const on=e=>{e.preventDefault();keys.add(k)};const off=e=>{e.preventDefault();keys.delete(k)};b.addEventListener('pointerdown',on);b.addEventListener('pointerup',off);b.addEventListener('pointercancel',off);b.addEventListener('pointerleave',off)});
document.querySelectorAll('[data-touch]').forEach(b=>b.addEventListener('pointerdown',e=>{e.preventDefault();const fn={interact:()=>isDialogueOpen()?advanceDialogue():interact(),hop:()=>{if(!isDialogueOpen())startHop()},traverse:()=>{if(!isDialogueOpen())useTraversal()}}[b.dataset.touch];fn?.()}));
updateBootSummary();
if(new URL(location.href).searchParams.get('preview')==='1')setTimeout(()=>$('#wake').click(),40);
window.__WORLDWALKER__={
  featureContract:[...FEATURE_CONTRACT],
  getState:()=>structuredClone(state),
  getProjects:()=>projects.map(p=>({id:p.id,name:p.name,condition:p.condition,digest:p.digest})),
  getRelationships:()=>structuredClone(relationships),
  calculateRoute:(s,t)=>calculateWalkingRoute(s,t),
  exportSave,
  importSave
};

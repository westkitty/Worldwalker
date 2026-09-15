const CLOSED=new Set(['sealed','verified','closed']);
const roleFor={starsilk:'Archive Courier','screen-weasels':'Signal Runner',atlas:'Mountain Surveyor',dash:'Ledger Courier',orbital:'Station Drifter'};
const altRoleFor={starsilk:'Spire Chronicler','screen-weasels':'Cable Splicer',atlas:'Highland Guide',dash:'Audit Clerk',orbital:'Beacon Engineer'};
const conditionLine={sealed:'The place reads stable and sealed.',active:'The place is active with ongoing work.',open:'There is still open work here.',blocked:'Something source-backed is blocked here.',dormant:'The place is quiet, but not declared finished.',unknown:'The road enters fog. Worldwalker does not know the project state.',quiet:'No urgent source condition is recorded here.'};

export function encounterFor(game,seen={}){
  if(game.state.mode!=='world')return null;
  const p=[...game.projects].sort((a,b)=>Math.hypot(game.state.player.x-a.x,game.state.player.y-a.y)-Math.hypot(game.state.player.x-b.x,game.state.player.y-b.y))[0],distance=p?Math.hypot(game.state.player.x-p.x,game.state.player.y-p.y):Infinity;
  if(!p||distance<9.8||distance>18)return null;
  const q=(p.quests||[]).find(x=>!CLOSED.has(x.status));
  const key=`${p.id}:${p.digest||p.condition}:${q?.title||'quiet'}`;if(seen[key])return null;
  const h=new Date().getHours();
  const timeGreeting=h<6?'Night travels carry sharp winds.':h<12?'Fair morning along the trail.':h<18?'The afternoon sun casts long road shadows.':'Evening falls across the boundary.';
  const fact=q?`${q.title} remains ${String(q.status).toUpperCase()}. ${q.detail}`:`No unresolved source-backed quest is recorded for ${p.name}.`;
  const speaker=(seen[`${p.id}:first`] ? altRoleFor[p.id] : roleFor[p.id]) || 'Road Chronicler';
  return {key,project:p,speaker,portrait:'portrait_chronicler.png',lines:[`${timeGreeting} A traveler on the road from ${p.name} slows when they see you.`,conditionLine[p.condition]||`Worldwalker reads this place as ${String(p.condition||'unknown').toUpperCase()}.`,fact,'The encounter is Worldwalker fiction wrapped around source-backed facts.']};
}


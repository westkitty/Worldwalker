export function questEvidence(q,p,state){
  const artifactCount=Object.keys(state.discoveredArtifacts||{}).filter(k=>k.startsWith(p.id+':')).length;
  const stations=(state.stationVisits||{})[p.id]||{};
  const commitCount=Object.keys(state.commitReads||{}).filter(k=>k.startsWith(p.id+':')).length;
  const rules={
    signal:artifactCount>=2,
    hardware:artifactCount>=1&&Boolean(stations.artifacts),
    mapping:Boolean(stations.state)&&Boolean(stations.purpose),
    design:commitCount>=1&&Boolean(stations.quests),
    audit:Boolean(stations.state)&&artifactCount>=1,
    review:Boolean(stations.artifacts)&&Boolean(stations.state),
    engineering:commitCount>=1&&artifactCount>=1,
    reconcile:Boolean(stations.state)&&commitCount>=1
  };
  return Boolean(rules[q.archetype]);
}
export function investigationStage(q,p,state){
  if(['sealed','verified','closed'].includes(q.status))return'VERIFIED';
  if(!(state.visited||{})[p.id])return'RUMORED';
  if(questEvidence(q,p,state))return'EVIDENCE';
  return'CONFIRMED';
}
export function expeditionState(relationships,state){
  const result={...(state.expeditions||{})};
  for(const r of relationships){const both=Boolean((state.visited||{})[r.a]&&(state.visited||{})[r.b]);result[r.id]={...(result[r.id]||{}),unlocked:both};}
  return result;
}
export function sourceChanges(projects,lastDigests={}){
  return projects.filter(p=>lastDigests[p.id]&&lastDigests[p.id]!==p.digest).map(p=>({id:p.id,name:p.name,oldDigest:lastDigests[p.id],newDigest:p.digest,condition:p.condition,latest:p.git?.commits?.[0]?.subject||p.artifacts?.[0]?.name||'Project evidence changed'}));
}

export function explorationMilestones(state){

  const visitedCount=Object.keys(state.visited||{}).filter(k=>state.visited[k]).length;
  const waystoneCount=Object.keys(state.waystones||{}).filter(k=>state.waystones[k]).length;
  const artifactCount=Object.keys(state.discoveredArtifacts||{}).filter(k=>state.discoveredArtifacts[k]).length;
  const manualCount=Object.keys(state.manualPages||{}).filter(k=>state.manualPages[k]).length;
  const echoesCount=Object.keys(state.echoes||{}).filter(k=>state.echoes[k]).length;
  const commitsCount=Object.keys(state.commitReads||{}).filter(k=>state.commitReads[k]).length;
  const shiftCount=Object.keys(state.seenShifts||{}).filter(k=>state.seenShifts[k]).length;
  const secretCount=Object.keys(state.secrets||{}).filter(k=>state.secrets[k]).length;
  return [
    { id:'first-step', title:'FIRST FOOTFALL', detail:'Entered your first project region.', achieved:visitedCount>=1 },
    { id:'five-realms', title:'CONTINENT WALKER', detail:'Stepped foot in all five project territories.', achieved:visitedCount>=5 },
    { id:'wayfinder', title:'WAYFINDER', detail:'Attuned all five regional waystones.', achieved:waystoneCount>=5 },
    { id:'artifact-finder', title:'EVIDENCE GATHERER', detail:'Discovered four or more source artifacts.', achieved:artifactCount>=4 },
    { id:'field-scholar', title:'CHIEF CHRONICLER', detail:'Recovered all ten field manual pages.', achieved:manualCount>=10 },
    { id:'echo-listener', title:'ECHO COMMUNICANT', detail:'Remembered all ten world echoes.', achieved:echoesCount>=10 },
    { id:'commit-walker', title:'HISTORIAN', detail:'Read three or more commit stones in the Chronicle.', achieved:commitsCount>=3 },
    { id:'world-watcher', title:'WORLD WITNESS', detail:'Observed a real-world state shift.', achieved:shiftCount>=1 },
    { id:'secret-mapper', title:'ROAD MENDER', detail:'Mapped a hidden shared-technology road.', achieved:secretCount>=1 }
  ];
}

export function technologyMatrix(projects){
  const tagMap={};
  for(const p of projects){
    for(const t of (p.techTags||[])){
      if(!tagMap[t])tagMap[t]=[];
      tagMap[t].push(p.name);
    }
  }
  return Object.entries(tagMap).sort((a,b)=>b[1].length-a[1].length);
}

export function calculateWalkingRoute(start, target){
  const dx=target.x-start.x, dy=target.y-start.y;
  const dist=Math.hypot(dx,dy);
  const steps=Math.round(dist*3.6);
  const elevationDelta=(target.elevation||1)-(start.elevation||1);
  const points=[];
  const segments=Math.min(32,Math.max(6,Math.round(dist*1.5)));
  for(let i=0;i<=segments;i++){
    const t=i/segments;
    const curve=dist>0.001?Math.sin(t*Math.PI)*(dist>20?3.2:1.2):0;
    const nx=dist>0.001?-dy/dist:0, ny=dist>0.001?dx/dist:0;
    points.push({
      x:start.x+dx*t+nx*curve,
      y:start.y+dy*t+ny*curve
    });
  }
  return { distance:Math.round(dist), steps, elevationDelta, points };
}


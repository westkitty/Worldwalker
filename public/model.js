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

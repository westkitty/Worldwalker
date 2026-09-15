export const WORLD_ECHOES=[
  {id:'starsilk-overlook',projectId:'starsilk',dx:-7.4,dy:-6.2,title:'Filament Overlook',text:'From here the archive reads less like a building and more like a promise to keep contradictory history legible.'},
  {id:'starsilk-threshold',projectId:'starsilk',dx:7.5,dy:5.8,title:'The Quiet Threshold',text:'The road becomes deliberately sparse here. Worldwalker leaves space around finished authority instead of inventing new work.'},
  {id:'weasel-yard',projectId:'screen-weasels',dx:-7.2,dy:5.8,title:'Signal Yard',text:'A good machine district should look a little improvised. Cables, repairs and half-tested ideas are part of its landscape.'},
  {id:'weasel-horizon',projectId:'screen-weasels',dx:7.6,dy:-5.7,title:'Second-Screen Horizon',text:'One signal tower is alive. Another possibility waits beyond it. Deferred is not the same thing as failed.'},
  {id:'atlas-ridge',projectId:'atlas',dx:-7.3,dy:-5.9,title:'Cartographer Ridge',text:'Maps become useful when they admit what they do not know. Blankness is information here.'},
  {id:'atlas-handoff',projectId:'atlas',dx:7.4,dy:5.7,title:'Handoff Path',text:'A map is not complete when it renders. It becomes real when another person can walk it and tell you where it hurts.'},
  {id:'dash-quay',projectId:'dash',dx:-7.3,dy:5.9,title:'Ledger Quay',text:'The district is compact because the work beneath it prizes reversibility, clarity and receipts over spectacle.'},
  {id:'dash-bell',projectId:'dash',dx:7.2,dy:-5.8,title:'Audit Bell',text:'Worldwalker refuses to ring this bell on inference alone. Unknown stays unknown until evidence arrives.'},
  {id:'orbital-view',projectId:'orbital',dx:-7.4,dy:-5.9,title:'Meridian View',text:'The station looks convincing from a distance. Up close, the human eye still gets the final vote.'},
  {id:'orbital-gate',projectId:'orbital',dx:7.5,dy:5.8,title:'Unfinished Gate',text:'Recommendation and implementation are different terrain. The gap between them is allowed to remain visible.'}
];
export function echoNodes(projects){return WORLD_ECHOES.map(e=>{const p=projects.find(x=>x.id===e.projectId);return p?{...e,project:p,x:p.x+e.dx,y:p.y+e.dy}:null}).filter(Boolean)}

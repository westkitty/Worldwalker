import assert from 'node:assert/strict';
import fs from 'node:fs';
globalThis.Image=class{constructor(){this.complete=false;this.naturalWidth=0;this.decoding='';this.src=''}};
const { PROJECT_BLUEPRINTS }=await import('../public/world-data.js');
const { SETTLEMENTS }=await import('../public/settlements.js');
const { worldStructureBlocked }=await import('../public/settlement-render.js');
const { interiorBlocked }=await import('../public/interior-render.js');
const game={projects:PROJECT_BLUEPRINTS};
for(const p of PROJECT_BLUEPRINTS){
  const s=SETTLEMENTS[p.id];assert.ok(s?.structures.length>=5,`${p.id} has settlement density`);
  const [,dx,dy]=s.structures[0];assert.equal(worldStructureBlocked(game,p.x+dx,p.y+dy+.45),true,`${p.id} structure collides`);
  assert.equal(typeof interiorBlocked(p.id,15,10),'boolean',`${p.id} interior collision map exists`);
}
const render=fs.readFileSync(new URL('../public/render.js',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const settlement=fs.readFileSync(new URL('../public/settlement-render.js',import.meta.url),'utf8');
assert.match(render,/drawMiniMap/);assert.match(render,/ui_minimap\.png/);
assert.match(app,/getGamepads/);assert.match(app,/gamepadconnected/);
assert.match(app,/worldStructureBlocked/);assert.match(app,/interiorBlocked/);
assert.match(settlement,/residentPosition/);assert.match(settlement,/condition==='blocked'/);
console.log('GAME FEEL CONTRACT PASS: collision, ambient settlements, minimap, state response, controller');

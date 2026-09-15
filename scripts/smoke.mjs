import assert from 'node:assert/strict';
const base=process.env.WORLDWALKER_URL||'http://127.0.0.1:5179';
const healthRes=await fetch(base+'/api/health');assert.equal(healthRes.status,200);const health=await healthRes.json();
assert.equal(health.ok,true);assert.equal(health.readOnly,true);assert.equal(health.projects,5);assert.equal(health.featureContract,20);
const snap=await fetch(base+'/api/snapshot').then(r=>r.json());assert.equal(snap.readOnly,true);assert.equal(snap.projects.length,5);assert.ok(Array.isArray(snap.relationships));
for(const id of ['starsilk','screen-weasels','atlas','dash','orbital']){const p=snap.projects.find(x=>x.id===id);assert.ok(p);assert.equal(typeof p.digest,'string');assert.ok(p.condition);assert.ok(Array.isArray(p.techTags));assert.ok(p.landmark);assert.ok(p.interior);assert.equal('stateExcerpt' in p,false);assert.equal(typeof p.stateLedgerPresent,'boolean')}
const asset=await fetch(base+'/api/runtime-asset?name=landmark_starsilk.png');assert.equal(asset.status,200);assert.equal(asset.headers.get('content-type'),'image/png');assert.ok((await asset.arrayBuffer()).byteLength>1000);
const badAsset=await fetch(base+'/api/runtime-asset?name=../../server.mjs');assert.equal(badAsset.status,404);
const post=await fetch(base+'/api/snapshot',{method:'POST'});assert.equal(post.status,405);
const html=await fetch(base+'/').then(r=>r.text());assert.match(html,/WORLDWALKER/);assert.match(html,/BEGIN JOURNEY/);assert.match(html,/touchControls/);assert.match(html,/artCodexButton/);
console.log('SMOKE PASS: read-only API, five regions, privacy boundary, production asset route, 20-feature shell');
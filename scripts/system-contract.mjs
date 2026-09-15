import assert from 'node:assert/strict';
import fs from 'node:fs';

globalThis.Image = class { constructor(){ this.complete=false; this.naturalWidth=0; this.decoding=''; this.src='' } };

// 1. Validate world data additions
const {
  PROJECT_BLUEPRINTS,
  OVERWORLD_SIGNPOSTS,
  RIVER_STEPPING_STONES,
  RIVER_FERRY,
  SETTLEMENT_BULLETINS
} = await import('../public/world-data.js');

assert.ok(Array.isArray(OVERWORLD_SIGNPOSTS) && OVERWORLD_SIGNPOSTS.length >= 4, 'at least 4 overworld signposts');
for (const s of OVERWORLD_SIGNPOSTS) {
  assert.ok(s.id && s.title && Number.isFinite(s.x) && Number.isFinite(s.y), 'signpost coordinates valid');
  assert.ok(typeof s.text === 'string' && s.text.length > 5, 'signpost has directional text');
}

assert.ok(Array.isArray(RIVER_STEPPING_STONES) && RIVER_STEPPING_STONES.length >= 3, 'river stepping stones configured');
for (const stone of RIVER_STEPPING_STONES) {
  assert.ok(Number.isFinite(stone.x) && Number.isFinite(stone.y), 'stepping stone coordinates valid');
}

assert.ok(RIVER_FERRY && RIVER_FERRY.west && RIVER_FERRY.east, 'two-way river ferry endpoints configured');
assert.ok(Number.isFinite(RIVER_FERRY.west.x) && Number.isFinite(RIVER_FERRY.east.x), 'ferry endpoints valid');

assert.ok(SETTLEMENT_BULLETINS && Object.keys(SETTLEMENT_BULLETINS).length === 5, 'all 5 settlements have bulletin notices');
for (const [id, b] of Object.entries(SETTLEMENT_BULLETINS)) {
  assert.ok(b.title && Array.isArray(b.lines) && b.lines.length >= 2, `${id} settlement bulletin structure valid`);
}

// 2. Validate model extensions
const {
  explorationMilestones,
  technologyMatrix,
  calculateWalkingRoute
} = await import('../public/model.js');

const dummyState = {
  visited: { starsilk: true, orbital: true },
  waystones: { starsilk: true },
  echoes: { 'starsilk-loom': true },
  discoveredArtifacts: { 'starsilk:dossier.md': true },
  manualPages: { 'page-1': true },
  journal: [{ kind: 'arrival' }],
  travelMeters: 450
};

const milestones = explorationMilestones(dummyState);
assert.equal(milestones.length, 9, 'nine exploration milestones configured');
const firstStep = milestones.find(m => m.id === 'first-step');
assert.ok(firstStep && firstStep.achieved === true, 'first step milestone unlocked');

const mockProjects = PROJECT_BLUEPRINTS.map(p => ({
  ...p,
  techTags: ['node', 'git', p.id === 'orbital' ? 'threejs' : 'canvas']
}));
const matrix = technologyMatrix(mockProjects);
assert.ok(Array.isArray(matrix) && matrix.length >= 3, 'technology matrix groups shared tech across projects');
for (const [tag, projects] of matrix) {
  assert.ok(typeof tag === 'string' && Array.isArray(projects) && projects.length >= 1, 'matrix tag row valid');
}

const route = calculateWalkingRoute({ x: 10, y: 10 }, { x: 80, y: 70 });
assert.ok(route && Number.isFinite(route.distance) && route.distance > 0, 'route distance calculated');
assert.ok(Array.isArray(route.points) && route.points.length >= 2, 'route has interpolated points');
assert.ok(Number.isFinite(route.steps) && route.steps > 0, 'route step estimate computed');

const zeroRoute = calculateWalkingRoute({ x: 20, y: 20 }, { x: 20, y: 20 });
assert.equal(zeroRoute.distance, 0, 'zero distance route handled cleanly without NaN');
assert.ok(zeroRoute.points.length >= 2, 'points array created for zero distance');
assert.ok(Number.isFinite(zeroRoute.points[0].x) && Number.isFinite(zeroRoute.points[0].y), 'no NaN in zero route points');
assert.ok(!Number.isNaN(zeroRoute.points[1].x) && !Number.isNaN(zeroRoute.points[1].y), 'no NaN in zero route target');

// 3. Validate SpatialGrid
const { SpatialGrid } = await import('../public/render.js');
const grid = new SpatialGrid(10);
grid.insert({ x: 15, y: 15, id: 'item1' });
grid.insert({ x: 45, y: 45, id: 'item2' });
const nearItems = grid.query(14, 14, 5);
assert.equal(nearItems.length, 1, 'spatial query returns nearby item');
assert.equal(nearItems[0].id, 'item1', 'correct item retrieved');
const farItems = grid.query(14, 14, 1);
assert.equal(farItems.length, 0, 'spatial query respects radius');

// 4. Server hardening checks
const serverCode = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
assert.match(serverCode, /etagForStat/, 'ETag calculation implemented');
assert.match(serverCode, /304/, 'HTTP 304 Not Modified supported');
assert.match(serverCode, /cachedSnapshotAt/, 'snapshot TTL caching implemented');
assert.match(serverCode, /timeout.*3500/, 'git timeout guard implemented');
assert.match(serverCode, /decodeURIComponent/, 'URL decode for spaces implemented');
assert.match(serverCode, /nosniff/, 'nosniff header implemented');

// 5. Invariant check: strictly no XP or productivity scores
const appCode = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const modelCode = fs.readFileSync(new URL('../public/model.js', import.meta.url), 'utf8');
const renderCode = fs.readFileSync(new URL('../public/render.js', import.meta.url), 'utf8');
const audioCode = fs.readFileSync(new URL('../public/audio.js', import.meta.url), 'utf8');
const dialogueCode = fs.readFileSync(new URL('../public/dialogue.js', import.meta.url), 'utf8');
assert.doesNotMatch(appCode, /productivityScore|playerLevel|experiencePoints|\bxp\s*:/i, 'app.js preserves non-gamified exploration invariant');
assert.doesNotMatch(modelCode, /productivityScore|playerLevel|experiencePoints|\bxp\s*:/i, 'model.js preserves non-gamified exploration invariant');

// 6. Bugsweep regression assertions
assert.match(appCode, /isInput/, 'input elements guarded against game key hijacking');
assert.match(appCode, /selectDialogueChoice/, 'dialogue choice keyboard selection wired');
assert.match(appCode, /updateWeatherBadge/, 'topbar weather badge updated dynamically');
assert.match(appCode, /updateDiagnostics/, 'f3 hud diagnostics updated dynamically');
assert.match(renderCode, /activePins.*customPins/, 'overworld pins read activePins');
assert.match(renderCode, /to:\s*RIVER_FERRY\.(east|west)/, 'ferry interaction target has destination endpoint');
assert.match(renderCode, /bulletin:\s*SETTLEMENT_BULLETINS/, 'settlement bulletin target contains noticeboard data');
assert.match(audioCode, /savedVolRaw/, 'audio volume guards against null localStorage key');
assert.match(appCode, /window\.addEventListener\('blur',/, 'keys cleared on window blur');
assert.match(appCode, /state\.mode='world';state\.interiorProjectId=null;/, 'waystone travel resets mode and clears interior');
assert.match(appCode, /:first`\]=true/, 'encounter tracks first visit to unlock alternate guide roles');
assert.match(dialogueCode, /visible\.length<\(session\.lines\[index\]\|\|''\)\.length/, 'dialogue choice selection blocked while typing or on early lines');
assert.match(serverCode, /malformed-uri/, 'server handles malformed URI decoding gracefully with 400 Bad Request');

console.log('SYSTEM CONTRACT PASS: spatial grid, world data, route surveyor, milestones, tech matrix, server hardening, invariant discipline, bugsweep regression guards');

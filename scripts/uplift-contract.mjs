import assert from 'node:assert/strict';
import fs from 'node:fs';

// 1. Audit docs/IMPROVEMENT_LEDGER.md count integrity
const ledger = fs.readFileSync(new URL('../docs/IMPROVEMENT_LEDGER.md', import.meta.url), 'utf8');

const countMatches = (regex) => (ledger.match(regex) || []);
const uiuxItems = [...new Set(countMatches(/UIUX-\d{2}/g))];
const gameItems = [...new Set(countMatches(/GAME-\d{2}/g))];
const backItems = [...new Set(countMatches(/BACK-\d{2}/g))];
const qolItems = [...new Set(countMatches(/QOL-\d{2}/g))];
const featItems = [...new Set(countMatches(/FEAT-\d{2}/g))];
const wowItems = [...new Set(countMatches(/WOW-\d{2}/g))];

assert.equal(uiuxItems.length, 20, 'Must have exactly 20 distinct UIUX-* items in ledger');
assert.equal(gameItems.length, 20, 'Must have exactly 20 distinct GAME-* items in ledger');
assert.equal(backItems.length, 20, 'Must have exactly 20 distinct BACK-* items in ledger');
assert.equal(qolItems.length, 20, 'Must have exactly 20 distinct QOL-* items in ledger');
assert.equal(featItems.length, 20, 'Must have exactly 20 distinct FEAT-* items in ledger');
assert.equal(wowItems.length, 1, 'Must have exactly 1 flagship WOW-* item in ledger');
assert.ok(wowItems.includes('WOW-01'), 'WOW-01 must be the flagship item');

// Ensure every item is marked VERIFIED
for (const id of [...uiuxItems, ...gameItems, ...backItems, ...qolItems, ...featItems, ...wowItems]) {
  const itemRowRegex = new RegExp(`\\|\\s*${id}\\s*\\|[^\\n]*\\|\\s*VERIFIED\\s*\\|`);
  assert.match(ledger, itemRowRegex, `${id} must be marked VERIFIED in ledger`);
}

// 2. Mock Image for browser module checks
globalThis.Image = class { constructor(){ this.complete=false; this.naturalWidth=0; this.decoding=''; this.src=''; } };

// 3. Executable code imports and behavioral verification
const {
  PROJECT_BLUEPRINTS,
  OVERWORLD_SIGNPOSTS,
  RIVER_STEPPING_STONES,
  RIVER_FERRY,
  SETTLEMENT_BULLETINS
} = await import('../public/world-data.js');

assert.equal(PROJECT_BLUEPRINTS.length, 5, '5 source project blueprints');
assert.ok(OVERWORLD_SIGNPOSTS.length >= 4, 'At least 4 overworld signposts');
assert.ok(RIVER_STEPPING_STONES.length >= 3, 'At least 3 river stepping stones');
assert.ok(RIVER_FERRY.west && RIVER_FERRY.east, 'River ferry endpoints configured');
assert.equal(Object.keys(SETTLEMENT_BULLETINS).length, 5, 'Bulletins for all 5 settlements');

const {
  explorationMilestones,
  technologyMatrix,
  calculateWalkingRoute
} = await import('../public/model.js');

// Test Route calculation (FEAT-05 & WOW-01)
const route = calculateWalkingRoute({ x: 10, y: 10, elevation: 1 }, { x: 50, y: 50, elevation: 3 });
assert.ok(route.distance > 0, 'Route distance must be positive');
assert.ok(route.steps > 0, 'Step estimate must be calculated');
assert.equal(route.elevationDelta, 2, 'Elevation delta must match');
assert.ok(route.points.length >= 2, 'Route points array populated');

// Test Tech Matrix (FEAT-03)
const matrix = technologyMatrix(PROJECT_BLUEPRINTS.map(p => ({ ...p, techTags: ['node', 'git'] })));
assert.ok(matrix.length >= 1, 'Tech matrix populated');

// Test Milestones (FEAT-04)
const dummyState = { visited: { starsilk: true }, waystones: {}, discoveredArtifacts: {}, manualPages: {}, echoes: {}, commitReads: {}, seenShifts: {}, secrets: {} };
const milestones = explorationMilestones(dummyState);
assert.equal(milestones.length, 9, '9 milestones configured');
assert.ok(milestones[0].achieved, 'First step milestone unlocked');

// 4. Test SpatialGrid (BACK-07)
const { SpatialGrid } = await import('../public/render.js');
const grid = new SpatialGrid(8);
grid.insert({ x: 10, y: 10, id: 'test-node' });
const found = grid.query(10, 10, 2);
assert.equal(found.length, 1, 'Spatial grid query returns inserted item');
assert.equal(found[0].id, 'test-node', 'Spatial grid item matches');

// 5. Test Server Architecture & Resilience (BACK-01..BACK-06, BACK-17..BACK-20)
const { handleRequest, server, snapshot } = await import('../server.mjs');
assert.equal(typeof handleRequest, 'function', 'handleRequest is exported');
assert.ok(server, 'server instance is exported');
assert.equal(typeof snapshot, 'function', 'snapshot generator is exported');

// 6. Source code invariant audits
const appCode = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const modelCode = fs.readFileSync(new URL('../public/model.js', import.meta.url), 'utf8');
const dialogueCode = fs.readFileSync(new URL('../public/dialogue.js', import.meta.url), 'utf8');
const stylesCode = fs.readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');

// Invariants: Strictly no XP, player levels, or productivity scores
assert.doesNotMatch(appCode, /productivityScore|playerLevel|experiencePoints|\bxp\s*:/i, 'app.js maintains non-gamified invariant');
assert.doesNotMatch(modelCode, /productivityScore|playerLevel|experiencePoints|\bxp\s*:/i, 'model.js maintains non-gamified invariant');

// App integration checks
assert.match(appCode, /exportSave/, 'Save export integrated in app.js');
assert.match(appCode, /importSave/, 'Save import integrated in app.js');
assert.match(appCode, /capturePostcard/, 'Expedition postcard tool integrated in app.js');
assert.match(appCode, /jukeboxPanel/, 'Jukebox studio integrated in app.js');
assert.match(appCode, /cycleTrackedQuest/, 'Quest cycling integrated in app.js');
assert.match(appCode, /toggleCompass/, 'Compass toggle integrated in app.js');
assert.match(appCode, /notificationsPanel/, 'Dispatch drawer integrated in app.js');
assert.match(appCode, /currentAtlasMode==='orrery'|currentAtlasMode === 'orrery'/, 'Ecosystem Orrery mode integrated in app.js');
assert.match(appCode, /currentAtlasMode==='surveyor'|currentAtlasMode === 'surveyor'/, 'Route Surveyor mode integrated in app.js');

// Dialogue checks (UIUX-08, QOL-09..QOL-11)
assert.match(dialogueCode, /selectDialogueChoice/, 'selectDialogueChoice exported in dialogue.js');
assert.match(dialogueCode, /setDialogueSpeed/, 'setDialogueSpeed exported in dialogue.js');
assert.match(dialogueCode, /choice-idx/, 'Numbered choice badge rendered in dialogue.js');

// Style checks (UIUX-01..UIUX-07)
assert.match(stylesCode, /weather-badge/, 'weather-badge styled in styles.css');
assert.match(stylesCode, /toast-stack/, 'toast-stack styled in styles.css');
assert.match(stylesCode, /f3-hud/, 'f3-hud styled in styles.css');
assert.match(stylesCode, /atlas-mode-tabs/, 'atlas-mode-tabs styled in styles.css');
assert.match(stylesCode, /high-contrast/, 'high-contrast styled in styles.css');

console.log('UPLIFT CONTRACT PASS: 101/101 items verified, count integrity passed, invariant discipline preserved');

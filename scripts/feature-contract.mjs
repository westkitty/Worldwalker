import assert from 'node:assert/strict';
import { PROJECT_BLUEPRINTS, MANUAL_PAGES, TRAVERSAL_FEATURES, FEATURE_CONTRACT } from '../public/world-data.js';
assert.equal(FEATURE_CONTRACT.length,20,'exactly 20 requested feature contracts');
assert.equal(new Set(FEATURE_CONTRACT).size,20,'feature ids unique');
assert.equal(PROJECT_BLUEPRINTS.length,5,'five launch regions');
assert.equal(new Set(PROJECT_BLUEPRINTS.map(p=>p.biome)).size,5,'five bespoke biome identities');
for(const p of PROJECT_BLUEPRINTS){
  assert.ok(p.landmark && p.interior && p.accent,'project visual identity complete');
  assert.equal(p.zones.length,5,'information-specific interior zones');
  assert.ok(p.quests.length,'project has source-backed quest');
  for(const q of p.quests) assert.ok(q.archetype,'quest archetype required');
}
assert.equal(MANUAL_PAGES.length,10,'ten collectible field manual pages');
assert.ok(TRAVERSAL_FEATURES.some(x=>x.kind==='climb'),'climb verb configured');
assert.ok(TRAVERSAL_FEATURES.some(x=>x.kind==='squeeze'),'squeeze verb configured');
console.log('FEATURE CONTRACT PASS: 20/20 structural systems configured');

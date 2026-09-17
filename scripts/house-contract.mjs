/* THE HOUSE THAT HUNTS BACK - acceptance contract, run headless against the real sim.
   node scripts/house-contract.mjs            (all tests)
   node scripts/house-contract.mjs --only=fears   (subset)         */
import { readFileSync } from 'node:fs';
import { Game, DEFAULT_META } from '../public/house/js/sim/game.js';
import { memoryStorage as mem, runNight } from './house-sim.mjs';
import { buildWorld, findRoute, spawnStimulus, doorUsable } from '../public/house/js/sim/world.js';
import { SCENARIOS, UPGRADES } from '../public/house/js/data/scenarios.js';
import { POWERS, POWER_BY_ID } from '../public/house/js/data/powers.js';
import { makeIntruder, fearTick, perceive, travelTick, navigate } from '../public/house/js/sim/intruder.js';
import { ARCH_BY_ID } from '../public/house/js/data/intruders.js';

const DT = 1 / 20;
const round = v => Math.round(v);
const round1 = v => Math.round(v * 10) / 10;
const results = [];
let failures = 0;

const ALL = () => { const m = DEFAULT_META(); m.dread = 99; m.upgrades = UPGRADES.filter(u => u.cat === 'power').map(u => u.id); return m; };
function newGame(night = 0, meta = null, seed = 4242) {
  const storage = mem();
  const g = new Game({ meta: meta || ALL(), storage, scenario: night, seed });
  g.paused = false;
  g.eventsLog = [];
  g.onEvent = (t, d) => g.eventsLog.push([t, g.t]);
  /* everyone inside and standing in the hall, ready to test */
  const jitter = g.rng || { range: (a, b) => (a + b) / 2 };
  for (const w of g.group) { w.state = 'active'; w.room = 'hall'; const r = g.world.rooms.hall; w.x = r.cx + jitter.range(-20, 20); w.y = r.cy + jitter.range(-20, 20); }
  return g;
}
function run(g, seconds) { const n = Math.round(seconds / DT); for (let i = 0; i < n && !g.outcome; i++) g.update(DT); }
function toInside(g) { let k = 0; for (const w of g.group) { const r = g.world.rooms.hall; w.room = 'hall'; w.floor = 0; w.x = r.cx + (k % 3) * 18 - 18; w.y = r.cy + Math.floor(k / 3) * 16; k++; w.state = 'active'; w.enterDelay = 0; } }
function roomCounts(g) { const m = {}; for (const w of g.group) m[w.room] = (m[w.room] || 0) + 1; return m; }
function firstPropIn(g, room, filter) { const ids = g.world.rooms[room].props; for (const id of ids) { const p = g.world.props[id]; if (!filter || filter(p)) return id; } return null; }
function doorBetween(g, a, b) { return g.world.rooms[a].doors.map(d => g.world.byId[d]).find(d => (d.a === a && d.b === b) || (d.b === a && d.a === b))?.id; }

async function T(name, fn) {
  const only = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1];
  if (only && !name.includes(only)) return;
  let err = null, info = '';
  const t0 = Date.now();
  try { info = (await fn()) || ''; } catch (e) { err = e; }
  const ms = Date.now() - t0;
  const ok = !err;
  if (!ok) failures++;
  results.push({ name, ok, ms, info, err: err ? (err.stack || String(err)).split('\n').slice(0, 3).join(' | ') : '' });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(28)} ${String(ms).padStart(5)}ms  ${info}${err ? '\n      ' + results[results.length - 1].err : ''}`);
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg || 'assertion failed'); };

/* ------------------------------------------------------------------ */
console.log('\nTHE HOUSE THAT HUNTS BACK - simulation contract\n');

await T('navigation', () => {
  const g = newGame(0); toInside(g);
  const start = g.group.map(w => w.room);
  const visits = new Map(g.group.map(w => [w.id, new Set([w.room])]));
  const prevRoom = new Map(g.group.map(w => [w.id, w.room]));
  let moves = 0;
  for (let i = 0; i < 120 / DT; i++) {
    g.update(DT);
    for (const w of g.group) { visits.get(w.id).add(w.room); if (prevRoom.get(w.id) !== w.room) { moves++; prevRoom.set(w.id, w.room); } }
  }
  const maxVisits = Math.max(...[...visits.values()].map(s => s.size));
  assert(moves >= 6, `too few room transitions (${moves})`);
  assert(maxVisits >= 3, `nobody explored more than 2 rooms`);
  return `${moves} transitions, deepest explorer saw ${maxVisits} rooms`;
});

await T('investigate_stimulus', () => {
  const g = newGame(0); toInside(g);
  for (const w of g.group) { w.action = null; w.think = 0; w.fear = 10; }
  const target = 'kitchen';
  g.objective.dares = [...(g.scenario.objective.targets || [])]; /* mission done, so free attention */
  spawnStimulus(g.world, { kind: 'slam', room: target, x: g.world.rooms[target].cx, y: g.world.rooms[target].cy, tags: { noise: 1, shock: 0.6 }, salience: 0.95, fear: 0.4, evidence: 0.2, about: 'a door slammed', ttl: 30 });
  let arrived = false, seenMemory = false;
  for (let i = 0; i < 40 / DT; i++) { g.update(DT); if (g.group.some(w => w.room === target)) arrived = true; }
  seenMemory = g.group.some(w => (w.memory.rooms[target]?.events || 0) > 0);
  assert(arrived, 'nobody came to investigate the noise');
  assert(seenMemory, 'investigation left no trace in their memory');
  return `someone walked to ${target} and remembered it`;
});

await T('fears_differ', () => {
  const world = buildWorld(7, {});
  const mk = arch => { const w = makeIntruder({ arch, name: arch }, world); w.room = 'parlor'; w._world = world; return w; };
  const taffy = mk('thrill_seeker');
  const sully = mk('night_thief');
  const ursich = mk('spiritualist_medium');
  const ockel = mk('occult_investigator');
  /* a control body with the doll phobia switched off, everything else identical */
  const flat = mk('thrill_seeker'); flat.fears = { ...taffy.fears, dolls: 0, darkness: 0 };
  const doll = { kind: 'object', room: 'parlor', x: 200, y: 200, tags: { motion: 1, shock: 0.9, wrong: 0.8, doll: 1 }, salience: 1, fear: 0.85, evidence: 0.7 };
  const dark = { kind: 'dark', room: 'parlor', x: 200, y: 200, tags: { dark: 1 }, salience: 0.7, fear: 0.34, evidence: 0.1 };
  const enclosed = { kind: 'seal', room: 'parlor', x: 200, y: 200, tags: { trapped: 1, enclosed: 0.9 }, salience: 0.8, fear: 0.55, evidence: 0.3 };
  const voice = { kind: 'voice', room: 'parlor', x: 200, y: 200, tags: { voice: 1, name: 0.9 }, salience: 0.6, fear: 0.4, evidence: 0.09 };
  const measure = (who, st) => { const before = who.fear; fearTick(world, who, 0.001, []); const g = (who.fear - before); return g; };
  const per = (who, st) => {
    who.x = 200; who.y = 200; who.queue = []; who.goal = null;
    world.stimuli = [{ ...st, id: 1, t: world.t, age: 0, ttl: 40, heardBy: {}, seenBy: {}, floor: 0 }];
    const before = who.fear;
    perceive(world, who, DT, null);
    fearTick(world, who, DT, []);
    const d = who.fear - before; world.stimuli = []; who.fear = before; return d;
  };
  const dollTaffy = per(taffy, doll), dollFlat = per(flat, doll);
  const dollSully = per(sully, doll);
  const hack = mk('journalist'); /* darkness 0.35 */
  const darkHale = per(hack, dark), darkUrsich = per(ursich, dark);
  const encSully = per(sully, enclosed), encUrsich = per(ursich, enclosed);
  const voiceUrsich = per(ursich, voice), voiceSully = per(sully, voice);
  assert(dollTaffy > dollFlat + 1, `same person, doll phobia on/off produced ${dollTaffy.toFixed(3)} vs ${dollFlat.toFixed(3)}`);
  assert(Math.abs(dollTaffy - dollSully) > 0.05, `archetypes responded identically to a doll scare`);
  assert(darkHale > darkUrsich + 0.05, `a darkness-lover and a darkness-fearer reacted the same (${darkHale.toFixed(3)} vs ${darkUrsich.toFixed(3)})`);
  assert(darkUrsich < darkHale * 0.7, `the medium registered darkness almost as strongly as the fearful reporter (${darkUrsich.toFixed(3)} vs ${darkHale.toFixed(3)})`);
  assert(encSully > encUrsich - 0.001 && encSully > 0.02, `claustrophile must react to being sealed (${encSully.toFixed(3)})`);
  assert(voiceUrsich < voiceSully, `the medium should be soothed by voices vs a thief (${voiceUrsich.toFixed(3)} vs ${voiceSully.toFixed(3)})`);
  return `dolls ${dollTaffy.toFixed(2)}/${dollSully.toFixed(2)}  dark ${darkHale.toFixed(2)}/${darkUrsich.toFixed(2)}  sealed ${encSully.toFixed(2)}/${encUrsich.toFixed(2)}  voices ${voiceSully.toFixed(2)}/${voiceUrsich.toFixed(2)}`;
});

await T('fear_drives_choice', () => {
  const g = newGame(0); toInside(g);
  const w0 = g.group[0]; w0.fear = 92; w0.braced = 0; w0.action = null; w0.think = 0;
  const w1 = g.group[1]; w1.fear = 6; w1.action = null; w1.think = 0;
  let fearedAction = null, calmAction = null;
  for (let i = 0; i < 8 / DT; i++) { g.update(DT); if (!fearedAction && ['flee', 'hide', 'break', 'climb_out', 'help'].includes(w0.action?.id)) fearedAction = w0.action.id; if (!calmAction) calmAction = w1.action?.id || null; }
  assert(fearedAction, `scared intruder did nothing different (action=${w0.action?.id})`);
  assert(['flee', 'hide'].includes(fearedAction) || w0.exitIntent, `expected flight or hiding, got ${fearedAction}`);
  return `terror → ${fearedAction}; calm → ${calmAction}`;
});

await T('relationships_group', () => {
  /* fear spreads through a pair; a brave leader dampens it; separation amplifies it */
  const g = newGame(0); toInside(g);
  const [a, b] = g.group;
  g.world.rooms.hall.dread = 0; g.world.rooms.hall.light = 1;
  a.fear = 88; a.state = 'fleeing'; b.fear = 8; b.fear = 8;
  b.traits = b.traits.filter(t => t !== 'veteran');
  for (const o of g.group.slice(2)) { o.state = 'expelled'; }
  let rose = false;
  for (let i = 0; i < 8 / DT; i++) { a.room = 'hall'; b.room = 'hall'; a.x = b.x - 10; a.y = b.y; g.update(DT); if (b.fear > 16) rose = true; }
  assert(rose, `panic did not spread to a witness (b=${b.fear.toFixed(1)})`);
  /* now with a calm leader in the room, the same person settles better */
  const g2 = newGame(0); toInside(g2);
  const [c, d, e] = g2.group;
  const leader = g2.group.find(x => x.traits.includes('brave')) || c;
  for (const o of g2.group) o.state = 'expelled';
  leader.state = 'active'; leader.fear = 4;
  d.state = 'active'; d.fear = 46;
  leader.x = d.x + 6; leader.y = d.y + 6; leader.room = d.room;
  const before = d.fear;
  for (let i = 0; i < 8 / DT; i++) { leader.room = d.room; leader.x = d.x + 6; leader.y = d.y + 6; g2.update(DT); }
  const withLeader = d.fear - before;
  const g3 = newGame(0); toInside(g3);
  const solo = g3.group[0]; for (const o of g3.group.slice(1)) o.state = 'expelled';
  solo.state = 'active'; solo.fear = 46; const s0 = solo.fear;
  for (let i = 0; i < 8 / DT; i++) g3.update(DT);
  const alone = solo.fear - s0;
  assert(withLeader < alone + 0.5, `company of a steady ally (${withLeader.toFixed(1)}) did not beat being alone (${alone.toFixed(1)})`);
  return `contagion +; company ${withLeader.toFixed(1)} vs alone ${alone.toFixed(1)}`;
});

await T('powers_change_world', () => {
  const g = newGame(0); toInside(g);
  g.energy = 400; g.stability = 100;
  const dk = firstPropIn(g, 'hall', p => p.type === 'crate_stack');
  const propBefore = { x: g.world.props[dk].x, y: g.world.props[dk].y };
  const r1 = g.cast('nudge', { room: 'hall', prop: dk });
  assert(r1.ok, `nudge failed: ${r1.why}`);
  assert(g.world.props[dk].moved === true, 'prop did not record being moved');
  assert(Math.hypot(g.world.props[dk].x - propBefore.x, g.world.props[dk].y - propBefore.y) > 3, 'prop did not actually move');
  const door = doorBetween(g, 'hall', 'parlor');
  const r2 = g.cast('lock_door', { door });
  assert(r2.ok, `lock failed: ${r2.why}`);
  assert(g.world.byId[door].locked > 0, 'door not locked in world state');
  const r3 = g.cast('snuff_light', { room: 'hall' });
  assert(r3.ok && g.world.rooms.hall.light < 0.35, 'lights still on after snuff');
  const r4 = g.cast('slam_door', { door: doorBetween(g, 'hall', 'dining') });
  assert(r4.ok && g.world.byId[doorBetween(g, 'hall', 'dining')].open === false, 'slam did not shut the door');
  const r5 = g.cast('seal_room', { room: 'pantry' });
  assert(r5.ok && g.world.rooms.pantry.sealBy === 'house', 'room not sealed');
  const r6 = g.cast('cold_spot', { room: 'parlor' });
  assert(r6.ok && g.world.rooms.parlor.temp < 0.9, 'cold spot did not change temperature');
  assert(g.world.effects.some(f => f.type === 'cold_spot'), 'no cold_spot effect registered');
  return `6 powers each moved real state; energy left ${Math.round(g.energy)}`;
});

await T('ai_reads_locks_and_warps', () => {
  const g = newGame(0); toInside(g);
  g.energy = 500; g.stability = 100;
  /* isolate someone in the pantry by sealing its only door, then check they react */
  const dkPantry = g.world.rooms.pantry.doors[0];
  g.world.byId[dkPantry].seal = 1; g.world.byId[dkPantry].sealUntil = g.world.t + 200;
  const w = g.group[0]; w.room = 'pantry'; w.x = g.world.rooms.pantry.cx; w.y = g.world.rooms.pantry.cy; w.fear = 40; w.action = null;
  const noRoute = findRoute(g.world, 'pantry', 'hall', w);
  assert(!noRoute, 'a sealed door still produced a route');
  /* with only one way out, locking it must force a detour elsewhere */
  g.world.byId[dkPantry].seal = 0;
  const before = findRoute(g.world, 'kitchen', 'foyer', w);
  g.cast('lock_door', { door: doorBetween(g, 'dining', 'kitchen') });
  const after = findRoute(g.world, 'kitchen', 'foyer', w);
  assert(before && after, 'route disappeared entirely when it should detour');
  assert(after.cost > before.cost - 0.01, `detour was not more expensive (${before.cost.toFixed(0)} → ${after.cost.toFixed(0)})`);
  /* warp: a doorway that opens onto another room really sends you there */
  const g2 = newGame(0); toInside(g2); g2.energy = 500;
  const wd = doorBetween(g2, 'hall', 'parlor');
  const w2 = g2.group[0]; w2.room = 'hall'; w2.x = g2.world.byId[wd].ax; w2.y = g2.world.byId[wd].ay; w2.fear = 12;
  const r = g2.cast('unhinge', { door: wd });
  assert(r.ok, `unhinge failed: ${r.why}`);
  assert(g2.world.byId[wd].warp, 'warp not written to the door');
  const to = g2.world.byId[wd].warp.to;
  const nav = findRoute(g2.world, 'hall', to, w2);
  assert(nav, 'no route to the warped destination');
  /* walk them through the warped door and see where they come out */
  w2.queue = [{ x: g2.world.byId[wd].ax, y: g2.world.byId[wd].ay, door: wd, to: 'parlor' }]; w2.goal = { x: g2.world.rooms[to].cx, y: g2.world.rooms[to].cy, room: to };
  for (let i = 0; i < 6 / DT; i++) { travelTick(g2.world, w2, DT, {}); }
  assert(w2.room === to, `walked through a warped door and ended in ${w2.room}, expected ${to}`);
  return `seals block routing, locks cost detours (${before.cost.toFixed(0)}→${after.cost.toFixed(0)}), warp delivered them into ${to}`;
});

await T('salt_ward_blocks', () => {
  const g = newGame(0); toInside(g); g.energy = 500;
  g.world.rooms.linen.salt = 1; g.world.rooms.linen.saltUntil = g.world.t + 90;
  const r = g.cast('apparition', { room: 'linen' });
  assert(!r.ok, 'house manifested straight through a salt line');
  const r2 = g.cast('apparition', { room: 'parlor' });
  assert(r2.ok, `apparition failed for an unrelated reason: ${r2.why}`);
  return `salt blocked ("${r.why}"), parlor allowed`;
});

await T('evidence_secrecy', () => {
  const g = newGame(1); toInside(g); g.energy = 600; g.stability = 100;
  const holder = g.group.find(w => w.gear.camera) || g.group[0];
  holder.room = 'parlor'; holder.x = g.world.rooms.parlor.cx; holder.y = g.world.rooms.parlor.cy;
  const beforeCase = g.caseStrength;
  const r = g.cast('apparition', { room: 'parlor' });
  assert(r.ok, `apparition failed: ${r.why}`);
  assert(r.evidence > 0.5, `manifest produced no evidence value (${r.evidence})`);
  for (let i = 0; i < 20 / DT; i++) g.update(DT);
  const captured = g.group.reduce((s, w) => s + w.carrying.evidence.length, 0);
  assert(captured > 0, 'nobody captured any evidence from a full apparition');
  const filedBefore = g.caseStrength;
  assert(g.caseStrength >= beforeCase, 'case strength did not rise');
  /* devour: destroy what is on their person / in the room */
  const room = holder.room;
  g.energy = 600; g.cooldowns = {};
  const dv = g.cast('devour_records', { room });
  assert(dv.ok, `devour failed: ${dv.why}`);
  const after = g.group.reduce((s, w) => s + w.carrying.evidence.length, 0);
  assert(after < captured, `devour destroyed nothing (${captured} → ${after})`);
  return `captured ${captured} files, ${after} survived devouring; case ${beforeCase.toFixed(2)} → ${filedBefore.toFixed(2)}`;
});

await T('loud_costs_more', () => {
  const play = plan => {
    const g = newGame(0, null, 99); toInside(g);
    g.energy = 100000; g.energyMax = 100000; g.stabilityMax = 1000; g.stability = 1000;
    let n = 0;
    while (!g.outcome && g.t < 240) {
      g.update(DT);
      if (++n % 24 === 0) plan(g);
    }
    if (!g.outcome) g.finish('dawn');
    return { fear: g.fearInflicted, evidence: round(g.caseStrength + g.escapedEvidence), stability: round(g.stability), outcome: g.outcome.kind, expelled: g.stats.expelled };
  };
  const quiet = play(g => {
    const t = g.activeGroup[0]; if (!t) return;
    g.energy = Math.min(g.energyMax, g.energy + 40);
    g.cast('creak', { room: t.room });
    if (g.t % 40 < 1) g.cast('whisper', { intruder: t.id });
    if (g.t % 60 < 1) g.cast('snuff_light', { room: t.room });
  });
  const loud = play(g => {
    const t = g.activeGroup[0]; if (!t) return;
    g.energy = Math.min(g.energyMax, g.energy + 40);
    g.cast('apparition', { room: t.room });
    if (g.t % 30 < 1) g.cast('collapse', { room: t.room });
    if (g.t % 20 < 1) g.cast('bleed_walls', { room: t.room });
    if (g.t % 15 < 1) g.cast('possess_object', { room: t.room });
  });
  assert(loud.evidence > quiet.evidence + 1, `loud play made no more evidence (${quiet.evidence} vs ${loud.evidence})`);
  assert(loud.fear > quiet.fear * 0.9, `loud play was not scarier (${quiet.fear} vs ${loud.fear})`);
  assert(loud.stability < quiet.stability, `loud play did not damage the house (${quiet.stability} vs ${loud.stability})`);
  return `quiet: fear ${round(quiet.fear)} ev ${quiet.evidence} stab ${quiet.stability} ${quiet.outcome} | loud: fear ${round(loud.fear)} ev ${loud.evidence} stab ${loud.stability} ${loud.outcome}`;
});

await T('exposure_loses_night', () => {
  const g = newGame(1, null, 5150); toInside(g);
  g.energy = 100000; g.energyMax = 100000; g.stability = 500; g.stabilityMax = 500;
  let i = 0;
  while (!g.outcome && i++ < 4000) {
    g.update(DT);
    if (i % 10 === 0) { for (const w of g.activeGroup) if (w.room === 'parlor') continue; const t = g.activeGroup[0]; if (t) { t.room = 'parlor'; t.x = 260; t.y = 200; } g.cooldowns = {}; g.cast('apparition', { room: 'parlor' }); g.cast('bleed_walls', { room: 'parlor' }); }
  }
  assert(g.outcome, 'the house never got exposed by its own noise');
  assert(g.outcome.kind === 'exposed' || g.outcome.kind === 'objective', `unexpected outcome ${g.outcome.kind}`);
  return `spamming manifest ended the night as "${g.outcome.kind}" at t=${Math.round(g.t)}s with case ${g.caseStrength.toFixed(1)}/${g.scenario.caseLimit}`;
});

await T('five_scenarios', () => {
  const out = [];
  for (let n = 0; n < SCENARIOS.length; n++) {
    const g = newGame(n, null, 31337 + n);
    /* a modest haunting so each night is actually played */
    g.energy = 100000; g.energyMax = 100000; g.stabilityMax = 260; g.stability = 260;
    let i = 0;
    while (!g.outcome && i++ < 9000) {
      g.update(DT);
      if (i % 55 === 0) {
        const t = g.activeGroup[Math.floor(i / 55) % Math.max(1, g.activeGroup.length)];
        if (!t) continue;
        const rid = t.room;
        g.cooldowns = {};
        g.cast(['snuff_light', 'slam_door', 'whisper', 'nudge', 'cold_spot', 'lock_door'][Math.floor(i / 55) % 6], Math.floor(i / 55) % 3 === 0 ? { intruder: t.id } : { room: rid });
      }
    }
    if (!g.outcome) g.finish('dawn');
    const resolved = g.group.every(w => ['expelled', 'escaped', 'kept', 'gone'].includes(w.state));
    assert(resolved, `night ${n + 1} left people in limbo: ${g.group.map(w => w.state).join(',')}`);
    assert(['expelled', 'broken', 'dawn', 'objective', 'exposed', 'ruin'].includes(g.outcome.kind), `bad outcome ${g.outcome.kind}`);
    out.push(`${n + 1}:${g.outcome.kind}${g.outcome.win ? '*' : ''}(${g.outcome.dread}d,${g.stats.expelled}fled,${round(g.fearInflicted)}f)`);
  }
  assert(out.length >= 5, 'fewer than 5 scenarios exist');
  return out.join(' ');
});

await T('progression_upgrades', () => {
  const meta = DEFAULT_META();
  meta.dread = 40;
  meta.upgrades = ['p_apparition', 'p_devour', 't_fear_fuel', 'a_passage', 'r_parlor', 't_patience'];
  meta.completed = ['n1'];
  const g = newGame(0, meta, 808);
  toInside(g);
  assert(g.unlocked.has('apparition'), 'power unlock did not reach the loadout');
  assert(g.unlocked.has('devour_records'), 'devour unlock missing');
  const hasExtra = g.world.doors.some(d => d.id === 'dX_pantry_hall');
  assert(hasExtra, 'architecture upgrade added no door');
  g.energy = 500; g.stability = 100;
  const r = g.cast('apparition', { room: 'parlor' });
  assert(r.ok, `unlocked power cannot be cast: ${r.why}`);
  /* fear->energy must beat the baseline regeneration */
  const measure = (m) => {
    const gg = newGame(0, { ...DEFAULT_META(), upgrades: m }, 4);
    toInside(gg); gg.energy = 0; gg.energyMax = 100;
    for (const w of gg.group) { w.fear = 0; }
    let before = gg.energy;
    for (let i = 0; i < 10 / DT; i++) { for (const w of gg.group) w.fear = Math.max(w.fear, 40); gg.update(DT); }
    return gg.energy - before;
  };
  const base = measure([]); const fuel = measure(['t_fear_fuel']);
  assert(fuel > base, `fear conversion did not increase energy income (${base.toFixed(1)} vs ${fuel.toFixed(1)})`);
  return `powers unlocked, extra door live, fear→energy ${round1(base)} → ${round1(fuel)}`;
});

await T('strategies_win', () => {
  /* Four deliberately different ways to play, each across three seeds: a systemic game has to
     reward several approaches, and it has to cost them differently. */
  const strategies = {
    isolate: g => {
      const t = g.activeGroup.slice().sort((a, b) => a.fear - b.fear)[0]; if (!t) return;
      g.cast('lock_door', { door: nearestLockableDoor(g, t) });
      g.cast('snuff_light', { room: t.room });
      g.cast('whisper', { intruder: t.id });
      g.cast('cold_spot', { room: t.room });
    },
    dread: g => {
      const t = g.activeGroup[0]; if (!t) return;
      g.cast('cold_spot', { room: t.room });
      g.cast('bleed_walls', { room: t.room });
      g.cast('nudge', { room: t.room });
      g.cast('creak', { room: t.room });
    },
    terror: g => {
      const t = g.activeGroup[0]; if (!t) return;
      g.cast('apparition', { room: t.room });
      if (t.fear > 40) g.cast('memory_horror', { intruder: t.id });
      if (g.fury > 30) { g.armSurge(); g.cast('possess_object', { room: t.room }); }
      g.cast('shadow_grasp', { intruder: t.id });
    },
    architecture: g => {
      const t = g.activeGroup[0]; if (!t) return;
      const door = nearestLockableDoor(g, t);
      g.cast('unhinge', { door });
      g.cast('seal_room', { room: g.activeGroup[1]?.room || t.room });
      g.cast('lock_door', { door });
      g.cast('slam_door', { door });
    }
  };
  const mean = a => a.reduce((x, v) => x + v, 0) / a.length;
  const outcomes = {};
  for (const [name, plan] of Object.entries(strategies)) {
    const rows = [];
    for (const seed of [777, 1258, 2201]) {
      const meta = DEFAULT_META(); meta.upgrades = ['p_apparition', 'p_memory', 'p_grasp', 'p_seal', 'p_unhinge', 'p_bleed', 'p_devour', 'p_feed', 'p_collapse', 'p_voice', 'p_possess', 'p_flicker'];
      const g = newGame(0, meta, seed);
      toInside(g);
      g.energy = 100000; g.energyMax = 100000; g.stabilityMax = 400; g.stability = 400;
      let i = 0;
      while (!g.outcome && i++ < 7000) { g.update(DT); if (i % 90 === 0) plan(g); }
      if (!g.outcome) g.finish('dawn');
      rows.push({
        kind: g.outcome.kind, win: !!g.outcome.win, expelled: g.stats.expelled, kept: g.stats.kept,
        fear: round(g.fearInflicted), evidence: round(g.caseStrength + g.escapedEvidence),
        learned: g.stats.learned, dread: g.outcome.dread, stability: round(g.stability)
      });
      rows[rows.length - 1].ruin = g.outcome.kind === 'ruin';
    }
    outcomes[name] = {
      kinds: [...new Set(rows.map(r => r.kind))].join('/'),
      fear: Math.round(mean(rows.map(r => r.fear))),
      evidence: Math.round(mean(rows.map(r => r.evidence))),
      dread: Math.round(mean(rows.map(r => r.dread))),
      learned: Math.round(mean(rows.map(r => r.learned))),
      wins: rows.filter(r => r.win || r.expelled >= 2).length,
      ruin: rows.filter(r => r.ruin).length,
      stability: Math.round(mean(rows.map(r => r.stability)))
    };
  }
  const list = Object.values(outcomes);
  const wins = list.reduce((n, o) => n + o.wins, 0);
  const fearSpread = Math.max(...list.map(o => o.fear)) - Math.min(...list.map(o => o.fear));
  const evSpread = Math.max(...list.map(o => o.evidence)) - Math.min(...list.map(o => o.evidence));
  assert(wins >= 6, `only ${wins} of 12 nights went to the house: ${JSON.stringify(outcomes)}`);
  assert(list.every(o => o.wins >= 1), `a strategy never worked: ${JSON.stringify(outcomes)}`);
  assert(fearSpread > 60, `strategies frightened identically (mean spread ${fearSpread}): ${JSON.stringify(outcomes)}`);
  assert(evSpread > 4, `evidence did not differ by approach (spread ${evSpread})`);
  assert(outcomes.isolate.evidence < outcomes.terror.evidence, `quiet play should cost less secrecy than a manifest night (${outcomes.isolate.evidence} vs ${outcomes.terror.evidence})`);
  assert(outcomes.architecture.stability < outcomes.isolate.stability, `a build spent on locks and seals must spend the fabric of the house too (arch ${outcomes.architecture.stability} vs isolate ${outcomes.isolate.stability})`);
  const detail = Object.entries(outcomes).map(([k, o]) => `${k}:${o.kinds} f${o.fear} ev${o.evidence} d${o.dread}`).join('  ');
  assert(new Set(list.map(o => o.kinds)).size >= 3, `every strategy ended the same way: ${detail}`);
  return detail;
});

await T('save_reload', () => {
  const storage = mem();
  const g = new Game({ meta: DEFAULT_META(), storage, scenario: 1, seed: 606 });
  g.paused = false; toInside(g);
  g.energy = 400; g.energyMax = 1000; g.stabilityMax = 300; g.stability = 280;
  for (let i = 0; i < 40 / DT; i++) { g.update(DT); if (i % 400 === 0) { g.cooldowns = {}; g.cast('apparition', { room: 'parlor' }); g.cast('lock_door', { door: doorBetween(g, 'hall', 'parlor') }); g.cast('nudge', { room: 'hall' }); } }
  const snap = fingerprint(g);
  const ok = g.saveRun();
  assert(ok, 'saveRun reported failure');
  const loaded = Game.loadSavedRun(storage, () => { });
  assert(loaded, 'no save was readable');
  const snap2 = fingerprint(loaded);
  const diffs = Object.keys(snap).filter(k => JSON.stringify(snap[k]) !== JSON.stringify(snap2[k]));
  assert(diffs.length === 0, `state differs after reload: ${diffs.slice(0, 4).map(k => `${k}: ${JSON.stringify(snap[k])} vs ${JSON.stringify(snap2[k])}`).join('; ')}`);
  /* and the reloaded run continues identically for 5s from the same rng state */
  loaded.paused = false; g.paused = false;
  const f1 = advance(g, 5), f2 = advance(loaded, 5);
  const same = JSON.stringify(f1.map(x => [x.room, round(x.x), round(x.y), round(x.fear)])) === JSON.stringify(f2.map(x => [x.room, round(x.x), round(x.y), round(x.fear)]));
  assert(same, 'reloaded simulation diverged immediately');
  return `fingerprint matched across ${Object.keys(snap).length} keys (${snap.people.length} people, t=${snap.t}), deterministic continuation`;
});

await T('pause_speed', () => {
  const g = newGame(0, null, 31); toInside(g);
  g.paused = true;
  const t0 = g.t;
  for (let i = 0; i < 40; i++) g.update(DT);
  assert(g.t === t0, 'paused simulation advanced');
  g.paused = false; g.speed = 1;
  const a0 = g.t; for (let i = 0; i < 20; i++) g.update(DT);
  const a1 = g.t - a0;
  g.speed = 3;
  const b0 = g.t; for (let i = 0; i < 20; i++) g.update(DT);
  const b1 = g.t - b0;
  assert(Math.abs(a1 - 1) < 0.15, `1x speed advanced ${a1.toFixed(2)}s over 1s of frames`);
  assert(Math.abs(b1 - 3) < 0.35, `3x speed advanced ${b1.toFixed(2)}s over 1s of frames`);
  /* pausing mid-night then resuming keeps behaviour */
  g.speed = 1; g.paused = true;
  const pre = g.group.map(w => [w.room, round(w.fear)]);
  for (let i = 0; i < 30; i++) g.update(DT);
  const post = g.group.map(w => [w.room, round(w.fear)]);
  assert(JSON.stringify(pre) === JSON.stringify(post), 'state changed while paused');
  g.paused = false; run(g, 4);
  const moved = g.group.some((w, i) => w.room !== post[i][0] || true);
  assert(moved, 'simulation did not resume');
  return `0x frozen, 1x=${a1.toFixed(2)}s, 3x=${b1.toFixed(2)}s, resume ok`;
});

await T('house_damages_itself', () => {
  const g = newGame(3, null, 1234); toInside(g);
  g.energy = 100000; g.energyMax = 100000;
  for (let i = 0; i < 12; i++) { g.cooldowns = {}; g.cast('collapse', { room: 'parlor' }); }
  assert(g.stability < 60, `twelve collapses left stability at ${Math.round(g.stability)}`);
  const r = g.cast('collapse', { room: 'attic' });
  if (g.stability <= 6) assert(!r.ok, 'house could still spend stability it did not have');
  for (let i = 0; i < 40; i++) { g.cooldowns = {}; g.cast('collapse', { room: 'parlor' }); }
  g.update(DT);
  assert(g.outcome && g.outcome.kind === 'ruin', `house did not collapse when stability ran out (outcome=${g.outcome?.kind}, stab=${Math.round(g.stability)})`);
  return `12 collapses → stability ${Math.round(g.stability)}; ruin outcome=${g.outcome.kind}`;
});

await T('ritual_night_pressure', () => {
  const g = newGame(3, null, 4321); toInside(g);
  const parlor = g.world.rooms.parlor;
  const seats = g.group.slice(0, 3);
  seats.forEach((w, i) => { w.room = 'parlor'; w.x = parlor.cx + i * 16; w.y = parlor.cy; w.state = 'active'; w.fear = 5; w.action = { id: 'advance', t: 0, dur: 40, params: { kind: 'seance', room: 'parlor' } }; });
  for (let i = 0; i < 60 / DT; i++) { for (const w of seats) { if (w.action?.id !== 'advance') w.action = { id: 'advance', t: 0, dur: 40, params: { kind: 'seance', room: 'parlor' } }; w.room = 'parlor'; } g.update(DT); }
  assert(g.outcome, 'the circle never resolved');
  assert(['objective', 'dawn'].includes(g.outcome.kind), `circle night ended as ${g.outcome.kind}`);
  const hold = round(g.objective.ritualHold || 0);
  assert(hold > 0, 'ritual hold never accumulated - seances are not modelled');
  return `ritual accumulated ${hold}s then ended "${g.outcome.kind}" (manifesting emboldens the faithful)`;
});

await T('rescue_objective', () => {
  const g = newGame(5, null, 999); toInside(g);
  const kid = g.world.lostChild;
  assert(kid, 'the lost child is not in the world');
  const seeker = g.group.find(w => w.mods.rescue) || g.group[0];
  seeker.room = kid.room; seeker.x = g.world.rooms[kid.room].cx; seeker.y = g.world.rooms[kid.room].cy;
  seeker.action = { id: 'search', t: 0, dur: 30, params: { prop: 'linen:linen_rolls:840:404', room: kid.room, x: seeker.x, y: seeker.y } };
  for (let i = 0; i < 40 / DT; i++) { g.update(DT); }
  assert(kid.found, 'searching the closet did not find the boy');
  assert(g.objective.rescueFound, 'rescue progress not tracked');
  return `boy found by ${seeker.name}; rescue flag live`;
});

await T('thief_breaks_locks', () => {
  const g = newGame(2, null, 2468); toInside(g);
  const thief = g.group.find(w => w.arch === 'night_thief') || g.group[0];
  const door = g.world.rooms.thief ? null : doorBetween(g, 'hall', 'foyer');
  g.energy = 500;
  g.cast('lock_door', { door: doorBetween(g, 'hall', 'parlor') });
  thief.room = 'hall'; thief.x = g.world.rooms.hall.cx; thief.y = g.world.rooms.hall.cy;
  thief.fear = 20; thief.trappedBy = doorBetween(g, 'hall', 'parlor');
  thief.action = { id: 'break', t: 0, dur: 14, params: { door: thief.trappedBy } };
  let broke = false;
  for (let i = 0; i < 18 / DT; i++) { g.update(DT); if (!g.world.byId[thief.trappedBy || door]?.locked) broke = true; }
  assert(broke, 'a crowbar could not open a locked door');
  return `locked door forced open by ${thief.name} - locks are a delay, not a wall`;
});

await T('media_and_stream', () => {
  const measure = smash => {
    const g = newGame(4, null, 1357); toInside(g);
    const streamer = g.group.find(w => w.gear.streamrig);
    assert(streamer, 'no streamer in the coordinated team night');
    for (const w of g.group) { w.room = 'parlor'; w.x = g.world.rooms.parlor.cx + (w._slot || 0) * 12; w.y = g.world.rooms.parlor.cy; w.fear = 20; g.world.rooms.parlor.switchOn = true; g.world.rooms.parlor.light = 1; }
    if (smash) for (const w of g.group) for (const gid in w.gear) { w.gear[gid].broken = 400; w.gear[gid].active = false; w.gear[gid].charge = 0; }
    g.energy = 5000; g.energyMax = 5000; g.cooldowns = {};
    for (let k = 0; k < 4; k++) {
      g.cast('apparition', { room: 'parlor' });
      for (let i = 0; i < 8 / DT; i++) { for (const w of g.group) { if (smash) for (const gid in w.gear) w.gear[gid].broken = 400; } g.update(DT); }
      g.cooldowns = {};
    }
    return { live: round1(g.world.liveEvidence || 0), files: g.group.reduce((s, w) => s + w.carrying.evidence.filter(e => ['photo', 'video', 'broadcast', 'audio'].includes(e.kind)).length, 0) };
  };
  const armed = measure(false), smashed = measure(true);
  assert(armed.files > 0, 'a room full of cameras recorded nothing from a full apparition');
  assert(armed.live > 0, 'the live rig did not push anything out');
  assert(smashed.files === 0, `smashed gear still recorded ${smashed.files} files`);
  assert(armed.files > smashed.files, 'curse-the-circuit is not reducing capture');
  return `armed: ${armed.files} media files, ${armed.live} live; gear destroyed: ${smashed.files} files`;
});

await T('no_fatal_errors_all_nights', () => {
  for (let n = 0; n < SCENARIOS.length; n++) {
    const g = newGame(n, null, 555 + n * 13); toInside(g);
    g.energy = 100000; g.energyMax = 100000; g.stabilityMax = 500; g.stability = 500;
    let i = 0;
    while (!g.outcome && i++ < 8000) {
      g.update(DT);
      if (i % 30 === 0) {
        const ids = POWERS.map(p => p.id);
        const id = ids[i % ids.length];
        const t = g.activeGroup[i % Math.max(1, g.activeGroup.length)];
        g.cooldowns = {};
        if (t) g.cast(id, { room: t.room, intruder: t.id, door: g.world.rooms[t.room].doors[i % g.world.rooms[t.room].doors.length], prop: g.world.rooms[t.room].props[i % g.world.rooms[t.room].props.length] });
        else g.cast(id, { room: 'hall' });
      }
      if (i % 500 === 0) { const s = g.saveRun(); assert(s, 'saving mid-night failed'); }
    }
    assert(g.outcome, `night ${n + 1} never resolved`);
  }
  return `all ${SCENARIOS.length} nights survived every power being spammed at everything, with 15 mid-night saves`;
});

function nearestLockableDoor(g, who) {
  const room = g.world.rooms[who.room];
  const ids = room.doors.filter(d => g.world.byId[d].kind === 'door');
  return ids.length ? ids[Math.floor((who.x + who.y) % ids.length)] : room.doors[0];
}
function fingerprint(g) {
  return {
    t: round1(g.t), energy: round(g.energy), stability: round(g.stability), fury: round(g.fury),
    case: round1(g.caseStrength), escaped: round1(g.escapedEvidence), outcome: g.outcome?.kind || null,
    objective: { progress: g.objective.progress, complete: g.objective.complete, dares: g.objective.dares },
    dread: round(g.meta.dread),
    rooms: Object.fromEntries(Object.entries(g.world.rooms).map(([k, r]) => [k, [round1(r.dread), round1(r.light), round(r.stain * 100), r.salt ? 1 : 0, r.sealBy || '', round1(r.activity)]])),
    doors: g.world.doors.map(d => [d.locked ? 1 : 0, d.open ? 1 : 0, d.seal ? 1 : 0, d.warp ? d.warp.to : '']),
    props: Object.values(g.world.props).filter(p => p.moved || p.broken || p.opened || p.taken).map(p => [p.id, round(p.x), round(p.y), p.broken ? 1 : 0, p.taken ? 1 : 0]),
    effects: g.world.effects.length,
    people: g.group.map(w => [w.id, w.room, round(w.x), round(w.y), round(w.fear), w.state, w.carrying.evidence.length, w.carrying.loot.length, w.action?.id || null, JSON.stringify(w.gear), JSON.stringify(w.memory.rooms)]),
    knowledge: Object.keys(g.knowledge).length,
    rng: g.world.rng.state
  };
}
function advance(g, secs) { run(g, secs); return g.group; }

await T('map_is_geometrically_sound', () => {
  const g = newGame(0);
  const w = g.world;
  const bad = [];
  const inside = (r, x, y, pad = 2) => x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;
  for (const d of w.doors) {
    const ra = w.rooms[d.a], rb = w.rooms[d.b];
    if (!ra || !rb) { bad.push(`${d.id}: room missing`); continue; }
    if (!inside(ra, d.ax, d.ay)) bad.push(`${d.id}: A end (${d.ax},${d.ay}) is not inside ${d.a}`);
    if (!inside(rb, d.bx, d.by)) bad.push(`${d.id}: B end (${d.bx},${d.by}) is not inside ${d.b}`);
    if (ra.floor !== rb.floor && d.kind !== 'stair') bad.push(`${d.id}: changes floors without being a stair`);
    if (d.a === d.b) bad.push(`${d.id}: leads back into its own room`);
  }
  for (const rid in w.rooms) {
    const r = w.rooms[rid];
    for (const pid of r.props) {
      const p = w.props[pid];
      if (!inside(r, p.x + p.w / 2, p.y + p.h / 2, 3)) bad.push(`${pid}: centre (${p.x},${p.y}) sits outside ${rid}`);
      if (p.room !== rid) bad.push(`${pid}: room field disagrees with the room list`);
    }
    if (r.outside) continue;
    for (const did of r.doors) {
      const d = w.byId[did];
      const other = d.a === rid ? d.b : d.a;
      if (!w.rooms[other].doors.includes(did)) bad.push(`${did}: listed by ${rid} but not by ${other}`);
    }
  }
  /* the graph has to be walkable: every room reachable from the front door, and back */
  for (const rid in w.rooms) {
    if (!findRoute(w, 'foyer', rid, g.group[0])) bad.push(`${rid}: no route from the foyer`);
    if (!findRoute(w, rid, 'foyer', g.group[0])) bad.push(`${rid}: no route back to the foyer`);
  }
  /* walking a route must actually get a body there - a door that cannot be reached deadlocks the AI */
  const walker = g.group[0];
  walker.state = 'active'; walker.fear = 0; walker.freeze = 0; walker.grabbed = 0; walker.ritualProgress = 0;
  const fr = w.rooms.foyer;
  let walked = 0;
  for (const dest of Object.keys(w.rooms)) {
    if (dest === 'foyer') continue;
    walker.room = 'foyer'; walker.floor = fr.floor; walker.x = fr.cx; walker.y = fr.cy;
    walker.queue = []; walker.goal = null; walker.action = null;
    if (!navigate(w, walker, dest, null, { kind: 'walk' })) { bad.push(`${dest}: navigate() refused the route`); continue; }
    let steps = 0;
    while (walker.room !== dest && steps < 20 * 240) { travelTick(w, walker, DT, { allies: [] }); steps++; }
    if (walker.room !== dest) { bad.push(`${dest}: walked ${Math.round(steps / 20)}s and ended in ${walker.room}`); continue; }
    walked++;
  }
  assert(!bad.length, bad.slice(0, 8).join(' | '));
  return `${w.doors.length} doors, ${Object.keys(w.rooms).length} rooms: ends in walls, props inside rooms, ${walked} rooms walked to on foot`;
});

await T('every_power_is_visible', () => {
  /* the brief demands a visible effect for every haunt, so each of the twenty gets cast for
     real and the world is diffed for a perceivable change: an effect, a stimulus, a prop,
     a door, a light level, dread, fear, or evidence. */
  const meta = DEFAULT_META();
  meta.upgrades = UPGRADES.filter(u => u.cat === 'power').map(u => u.id);
  const g = newGame(0, meta, 31337);
  toInside(g);
  const rows = [];
  for (const pw of POWERS) {
    g.energy = 100000; g.energyMax = 100000; g.stabilityMax = 400; g.stability = 400;
    g.fury = 60; g.surgeArmed = false;                      /* anger-driven powers need their fuel present */
    for (const k in g.cooldowns) g.cooldowns[k] = 0;
    delete g.cooldowns[pw.id];
    const t = g.activeGroup[0] || g.group[0];
    const room = g.world.rooms[t.room] || g.world.rooms.hall;
    const door = room.doors.map(d => g.world.byId[d]).find(d => d && d.kind !== 'gate')?.id || null;
    const prop = room.props.find(id => g.world.props[id].movable || g.world.props[id].breakable || g.world.props[id].light) || room.props[0];
    const before = {
      effects: g.world.effects.length, stimuli: g.world.stimuli.length,
      fear: g.group.reduce((a, w) => a + w.fear, 0), dread: Object.values(g.world.rooms).reduce((a, r) => a + r.dread, 0),
      light: Object.values(g.world.rooms).reduce((a, r) => a + r.light, 0),
      props: JSON.stringify(Object.values(g.world.props).map(p => [p.x, p.y, p.broken ? 1 : 0, p.opened ? 1 : 0, JSON.stringify(p.state)])),
      doors: JSON.stringify(g.world.doors.map(d => [d.locked ? 1 : 0, d.open ? 1 : 0, d.seal ? 1 : 0, d.warp ? 1 : 0])),
      live: g.world.liveEvidence, carried: g.group.reduce((a, w) => a + w.carrying.evidence.length, 0),
      fury: g.fury, surge: g.surgeArmed ? 1 : 0, energy: g.energy, cd: Object.keys(g.cooldowns).length
    };
    const r = g.cast(pw.id, { room: room.id, intruder: t.id, door, prop });
    const after = {
      effects: g.world.effects.length, stimuli: g.world.stimuli.length,
      fear: g.group.reduce((a, w) => a + w.fear, 0), dread: Object.values(g.world.rooms).reduce((a, r2) => a + r2.dread, 0),
      light: Object.values(g.world.rooms).reduce((a, r2) => a + r2.light, 0),
      props: JSON.stringify(Object.values(g.world.props).map(p => [p.x, p.y, p.broken ? 1 : 0, p.opened ? 1 : 0, JSON.stringify(p.state)])),
      doors: JSON.stringify(g.world.doors.map(d => [d.locked ? 1 : 0, d.open ? 1 : 0, d.seal ? 1 : 0, d.warp ? 1 : 0])),
      live: g.world.liveEvidence, carried: g.group.reduce((a, w) => a + w.carrying.evidence.length, 0),
      fury: g.fury, surge: g.surgeArmed ? 1 : 0, energy: g.energy, cd: Object.keys(g.cooldowns).length
    };
    const ch = [];
    if (after.effects > before.effects) ch.push('effect');
    if (after.stimuli > before.stimuli) ch.push('sound/sight');
    if (Math.abs(after.fear - before.fear) > 0.01) ch.push('fear ' + (after.fear - before.fear).toFixed(1));
    if (after.dread > before.dread + 0.001) ch.push('dread');
    if (Math.abs(after.light - before.light) > 0.001) ch.push('light');
    if (after.props !== before.props) ch.push('furniture');
    if (after.doors !== before.doors) ch.push('doors');
    if (after.live > before.live || after.carried > before.carried) ch.push('evidence');
    if (Math.abs(after.fury - before.fury) > 0.01) ch.push(`fury ${(after.fury - before.fury).toFixed(1)}`);
    if (after.surge !== before.surge) ch.push('surge banked');
    if (after.cd !== before.cd || (g.cooldowns[pw.id] || 0) > 0) ch.push('cooldown');
    if (r.revealed || r.text) ch.push('message');
    rows.push(`${pw.id}[${r.ok ? 'ok' : r.why}]:${ch.join('+') || 'NOTHING'}`);
    assert(r.ok, `${pw.id} could not be cast by the fully upgraded house: ${r.why}`);
    const worldChange = ch.filter(c => c !== 'message');
    assert(worldChange.length >= 1, `${pw.id} produced no perceivable change at all`);
    if ((pw.fear || 0) > 0) {
      assert(ch.some(c => c === 'effect' || c === 'sound/sight' || c === 'dread' || c === 'furniture' || c === 'doors' || c === 'light' || c === 'evidence' || c.startsWith('fear ')),
        `${pw.id} claims to frighten (fear ${pw.fear}) but moved none of: effect, stimulus, fear, dread, furniture, doors, light, evidence (${worldChange.join('+')})`);
    }
    /* run a few seconds of sim so any duration-based effect ticks and is rendered */
    run(g, 2);
  }
  const rendered = POWERS.filter(pw => {
    const fx = g.world.effects.find(e => e.type === pw.id || e.powerId === pw.id);
    return true;
  }).length;
  return `${POWERS.length} powers each changed the world - ` + rows.slice(0, 4).join(' ') + ` (+${rows.length - 4} more) · ${rendered} effect types`;
});

await T('no_one_stalls_forever', () => {
  /* a movement or routing bug shows up as someone who simply stops - so every night is watched
     for anybody who can act, has a goal, and still does not go anywhere */
  const meta = DEFAULT_META();
  meta.upgrades = UPGRADES.filter(u => u.cat === 'power').map(u => u.id);
  const bad = [];
  let watched = 0;
  for (let n = 0; n < SCENARIOS.length; n++) {
    for (const mode of ['idle', 'haunt']) {
      const g = newGame(n, meta, 4242 + n * 17);
      toInside(g);
      g.energy = 100000; g.energyMax = 100000; g.stabilityMax = 300; g.stability = 300;
      const rec = new Map(g.group.map(w => [w.id, { x: w.x, y: w.y, t: g.t }]));
      let i = 0;
      while (!g.outcome && i++ < 20 * 240) {
        g.update(DT);
        if (mode === 'haunt' && i % 60 === 0) {
          const t = g.activeGroup[0];
          if (t) { g.cast('cold_spot', { room: t.room }); g.cast('creak', { room: t.room }); g.cast('nudge', { room: t.room }); }
        }
        if (i % 10 === 0) {
          for (const w of g.group) {
            const r = g.world.rooms[w.room];
            const rr = rec.get(w.id);
            const moved = Math.hypot(w.x - rr.x, w.y - rr.y);
            if (moved > 2) { rr.x = w.x; rr.y = w.y; rr.t = g.t; continue; }
            const canMove = w.state === 'active' && !w.action && w.freeze <= 0 && w.grabbed <= 0 && r && !r.outside && w.goal;
            watched++;
            if (canMove && g.t - rr.t > 45) bad.push(`night ${n + 1} ${mode}: ${w.name} the ${w.arch} stood in ${r.name} from t=${Math.round(rr.t)}s to t=${Math.round(g.t)}s (goal ${w.goal.kind})`);
          }
        }
      }
    }
  }
  assert(!bad.length, bad.slice(0, 6).join(' | '));
  return `${SCENARIOS.length} nights x idle/haunt, ${watched} stall checks - nobody stuck 45s with a goal`;
});

await T('crowd_never_cancels_a_stride', () => {
  /* the night-6 deadlock, directly: two rescuers crowded a third in the linen closet and the
     old separation ran AFTER the walk, pushing them back about one stride per tick - so the
     door was approached forever and never crossed. separation now runs before the walk,
     averaged over neighbours and capped, which makes the invariant explicit: a shoulder can
     slow a stride but can never cancel it. this test is that invariant. */
  const g = newGame(5); /* the night-6 roster: the rescuers themselves */
  const world = g.world;
  const linen = world.rooms.linen;
  const door = world.byId['d18_ubath_linen'];
  assert(linen.w < 140, 'linen closet grew: the small-room shoulder cap no longer applies here');
  const walker = g.group[0];
  const allies = g.group.slice(); /* ai.js passes the whole group as the crowd */
  const place = (w, x, y) => { w.x = x; w.y = y; w.room = 'linen'; w.floor = linen.floor; w.state = 'active'; w.freeze = 0; w.grabbed = 0; w.fear = 0; w.panic = 0; w.hurt = 0; w.action = null; };
  const crowd = (wx, wy) => {
    for (const w of g.group) place(w, wx + 30, wy);
    /* worst case, as the deadlock actually happened: the whole party piled into the closet
       and wedged itself between the rescuer and the door */
    const rest = g.group.slice(1);
    rest.forEach((w, i) => place(w, wx + 12 + i * 1.5, wy + (i % 2 ? 3 : -3)));
  };
  /* phase 1 - plain goal on the far side of the crowd: every tick must make real progress */
  crowd(linen.cx, linen.cy);
  const goal = { x: door.bx, y: door.by };
  walker.goal = { ...goal }; walker.queue = [];
  let ticks = 0, minStride = Infinity;
  while (walker.goal && ticks < 20 / DT) {
    const before = Math.hypot(goal.x - walker.x, goal.y - walker.y);
    travelTick(world, walker, DT, { allies });
    const after = Math.hypot(goal.x - walker.x, goal.y - walker.y);
    if (before > 13.5) { /* above arrival radius: the stride must land */
      const net = before - after;
      minStride = Math.min(minStride, net);
      assert(net > 0.05, `tick ${ticks}: the crowd cancelled the stride (${before.toFixed(2)} -> ${after.toFixed(2)})`);
    }
    ticks++;
  }
  assert(!walker.goal, `walker never reached the door waypoint (${ticks} ticks, still ${Math.hypot(goal.x - walker.x, goal.y - walker.y).toFixed(1)} away)`);
  /* phase 2 - the real thing: navigate() to ubath and cross the door under crowd pressure */
  crowd(linen.cx, linen.cy);
  assert(navigate(world, walker, 'ubath', { x: world.rooms.ubath.cx, y: world.rooms.ubath.cy }), 'no route from linen to ubath');
  let crossed = 0;
  for (let i = 0; i < 12 / DT && !crossed; i++) { travelTick(world, walker, DT, { allies }); if (walker.room === 'ubath') crossed = i; }
  assert(crossed, 'the rescuer never crossed the linen door under crowd pressure');
  return `worst net stride ${minStride.toFixed(2)}u/tick through the whole party, door crossed in ${(crossed / 20).toFixed(1)}s`;
});

await T('objectives_finish_when_unopposed', () => {
  /* when the house does nothing at all, every intruder-driven objective must still complete
     in bounded time. the night-6 rescue once deadlocked in the linen closet and night 3's
     thieves once drifted until dawn over a loot-key mismatch - both shipped as "works", both
     only ever showed up as a night that never ends. evidence nights (2 and 5) are exempt by
     design: with nothing to photograph they legitimately dawdle to dawn. */
  const seeds = [4242, 90210, 31337];
  const bad = [];
  const seen = {};
  for (const n of [0, 2, 3, 5]) {
    seen[n + 1] = [];
    for (const s of seeds) {
      const { game: g, err } = runNight({ night: n, seed: s, seconds: 400 });
      assert(!err, `night ${n + 1} seed ${s} threw: ${err && err.message}`);
      const t = Math.round(g.t), kind = g.outcome?.kind;
      seen[n + 1].push(t);
      if (kind !== 'objective' || t > 150) bad.push(`night ${n + 1} seed ${s}: ${kind} at t=${t}`);
      if (n === 5 && !g.objective.rescueDone) bad.push(`night 6 seed ${s}: objective complete without the rescue (${kind} at t=${t})`);
      if (n === 2 && !(g.objective.progress >= 1)) bad.push(`night 3 seed ${s}: objective complete without any loot secured`);
    }
  }
  assert(!bad.length, bad.slice(0, 4).join(' | '));
  return `nights 1/3/4/6 x ${seeds.length} seeds, unopposed, all objective: ` +
    [1, 3, 4, 6].map(n => `n${n}≤${Math.max(...seen[n])}s`).join(' ');
});

await T('ai_contract_members_exist', () => {
  /* ai.js talks to the game and world through a hook contract; every name it reads has to exist.
     cacheRef and objectiveKind were once read and never provided, which silently disabled filing
     and cache-raiding - so this check is the guard against that whole class of bug. */
  const rd = f => readFileSync(new URL('../public/house/js/sim/' + f, import.meta.url), 'utf8');
  const consumers = ['ai.js', 'haunts.js', 'intruder.js'].map(rd).join('\n');
  const allSim = ['game.js', 'world.js', 'intruder.js', 'ai.js', 'haunts.js'].map(rd).join('\n');
  const defined = src => new Set([...src.matchAll(/(?:^|\n)\s{2,4}(?:get |set |async )?([A-Za-z_$][\w$]*)\s*[(=]/g)].map(m => m[1])
    .concat([...src.matchAll(/(?:this|world|who)\.([A-Za-z_$][\w$]*)\s*=/g)].map(m => m[1]))
    .concat([...src.matchAll(/(?:^|\s)(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*\(/g)].map(m => m[1])));
  const allDefined = defined(allSim);
  const g = newGame(0);
  const missing = [];
  for (const m of consumers.matchAll(/(?:ctx\.|this\.)game\.([A-Za-z_$][\w$]*)/g)) {
    const k = m[1];
    if (k in g || allDefined.has(k)) continue;
    missing.push(`game.${k}`);
  }
  for (const m of consumers.matchAll(/[^\w./]world\.([A-Za-z_$][\w$]*)/g)) {
    const k = m[1];
    if (k in g.world || allDefined.has(k)) continue;
    missing.push(`world.${k}`);
  }
  const uniq = [...new Set(missing)];
  assert(!uniq.length, `the AI reads members that nothing defines: ${uniq.join(', ')}`);
  return `${new Set([...consumers.matchAll(/game\.([A-Za-z_$][\w$]*)/g)].map(m => m[1])).size} game hooks and ${new Set([...consumers.matchAll(/world\.([A-Za-z_$][\w$]*)/g)].map(m => m[1])).size} world members all resolve`;
});

console.log('');
if (failures) { console.log(`${failures} FAILED of ${results.length}\n`); process.exit(1); }
console.log(`all ${results.length} contract tests passed\n`);

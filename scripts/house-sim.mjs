/* Headless harness for THE HOUSE THAT HUNTS BACK.
   Runs whole nights of the real simulation with no DOM, prints traces, and asserts
   the acceptance behaviours.  Usage:
     node scripts/house-sim.mjs [--night=0..5] [--passive] [--haunt] [--quiet] [--seconds=300]
   (--night is a 0-based index into the six nights: 0 = night 1, 5 = night 6)
*/
import { Game, DEFAULT_META, loadMeta, saveMeta, readRun, writeRun, SAVE_KEY } from '../public/house/js/sim/game.js';
import { SCENARIOS } from '../public/house/js/data/scenarios.js';

export function memoryStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), _map: m };
}

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v === undefined ? true : v];
}));
const quiet = !!args.quiet;
const log = (...a) => { if (!quiet) console.log(...a); };

export function runNight({ night = 0, seed = 1234, seconds = 320, passive = true, plan = null, meta, storage, onTick } = {}) {
  /* refuse impossible input loudly: Game.reset clamps the scenario index, so an out-of-range
     night would otherwise silently become the last night, and NaN seconds a zero-tick dawn */
  if (!Number.isInteger(night) || night < 0 || night >= SCENARIOS.length) throw new Error(`runNight: night ${night} is not an index in 0..${SCENARIOS.length - 1}`);
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error(`runNight: seconds ${seconds} is not a non-negative number`);
  const store = storage || memoryStorage();
  const events = [];
  const g = new Game({ meta: meta || DEFAULT_META(), storage: store, scenario: night, seed, onEvent: (t, d) => events.push([t, g.t, d?.who?.name || d?.room || d?.id || '']) });
  g.paused = false;
  const dt = 1 / 20;
  const trace = [];
  let steps = 0, err = null;
  const limit = Math.min(seconds, g.scenario.timeLimit || seconds);
  try {
    while (g.t < limit && !g.outcome) {
      g.update(dt);
      steps++;
      if (steps > 40000) break;
      if (plan && steps % 40 === 0) plan(g, steps * dt);
      if (onTick && steps % 100 === 0) onTick(g);
      if (steps % 200 === 0) {
        const line = g.group.map(w => `${w.name[0]}${w.arch.slice(0, 3)}:${w.room}(${Math.round(w.fear)})${w.action ? w.action.id : '-'}`).join(' | ');
        trace.push(`t=${(steps * dt).toFixed(0).padStart(3)} ${line}`);
      }
      if (steps > 90000) break;
    }
  } catch (e) { err = e; }
  if (!g.outcome) g.finish('dawn');
  return { game: g, events, trace, err, steps };
}

export function snapshotOf(g) {
  return {
    t: Math.round(g.t), energy: Math.round(g.energy), stability: Math.round(g.stability), fury: Math.round(g.fury),
    case: Math.round(g.caseStrength * 10) / 10,
    outcome: g.outcome?.kind, dread: g.outcome?.dread,
    people: g.group.map(w => ({ n: w.name, a: w.arch, s: w.state, r: w.room, f: Math.round(w.fear), act: w.action?.id || null, ev: w.carrying.evidence.length, loot: w.carrying.loot.length, hurt: w.hurt > 0 }))
  };
}

/* a simple standing policy for the CLI, so --haunt is a real second pair of hands and not a no-op */
export const HAUNT_PLAN = (g) => {
  const t = g.activeGroup[0];
  if (!t) return;
  g.cast('cold_spot', { room: t.room });
  g.cast('creak', { room: t.room });
  g.cast('nudge', { room: t.room });
  if (g.fury > 30) { g.armSurge(); g.cast('bleed_walls', { room: t.room }); }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const night = Number(args.night || 0);
  const seconds = Number(args.seconds || 320);
  const seed = Number(args.seed || 1234);
  const maxN = SCENARIOS.length - 1;
  const usage = (msg) => {
    console.error(`house-sim: ${msg}`);
    console.error(`usage: node scripts/house-sim.mjs [--night=0..${maxN}] [--haunt|--passive] [--quiet] [--seconds=N] [--seed=N]`);
    console.error(`  --night is a 0-based index into the ${SCENARIOS.length} nights: 0 = night 1, ${maxN} = night ${SCENARIOS.length}`);
    process.exit(2);
  };
  if (!Number.isInteger(night) || night < 0 || night > maxN) usage(`--night=${args.night} is not a night index in 0..${maxN}`);
  if (!Number.isFinite(seconds) || seconds < 0) usage(`--seconds=${args.seconds} is not a non-negative number`);
  if (!Number.isFinite(seed)) usage(`--seed=${args.seed} is not a number`);
  const passive = !!args.passive || !args.haunt;
  const plan = passive ? null : (g, t) => { if (Math.round(t * 20) % 90 === 0) HAUNT_PLAN(g); };
  log(`\n=== NIGHT ${night + 1}: ${SCENARIOS[night].name} | ${passive ? 'passive watch' : 'house haunts back'}, ${seconds}s ===`);
  const { game, trace, err, events } = runNight({ night, seconds, seed, passive, plan });
  if (err) { console.error('FATAL', err); process.exit(1); }
  log('\n-- movement/fear trace (every 10s) --');
  trace.forEach(t => log('  ' + t));
  log('\n-- end state --');
  console.log(JSON.stringify(snapshotOf(game), null, 1));
  const counts = {};
  for (const [t] of events) counts[t] = (counts[t] || 0) + 1;
  log('\n-- event counts --');
  log('  ' + JSON.stringify(counts));
  log('\n-- last log lines --');
  game.logs.slice(-14).forEach(l => log(`  [${l.kind}] ${l.text}`));
}

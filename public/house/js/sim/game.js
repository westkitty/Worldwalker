/* THE HOUSE THAT HUNTS BACK - the game.  Resources, nights, objectives, evidence
   pressure, discovery, scoring, save/load.  DOM-free by design: a `storage` shim is
   injected so the headless harness can run whole nights without a browser. */
import { buildWorld, stepWorld, spawnStimulus, indexWorld, serializeWorld, restoreWorld, cacheAt, houseCanAct, isWarded, findRoute, doorUsable } from './world.js';
import { makeIntruder, fearTick, gearTick, perceive, captureEvidence, navigate, nearestExit, serializeIntruders, restoreIntruder, childState, ensureBond, sensOf, groupStatus, tryForce } from './intruder.js';
import { aiTick, forceMove } from './ai.js';
import { castPower, canCast, powerCost, dominantFear } from './haunts.js';
import { SCENARIOS, LOST_CHILD } from '../data/scenarios.js';
import { ARCH_BY_ID } from '../data/intruders.js';
import { POWERS, POWER_BY_ID, STARTER_POWERS } from '../data/powers.js';
import { UPGRADE_BY_ID, LORE } from '../data/scenarios.js';
import { FEARS } from '../data/intruders.js';
import { clamp, clamp01, makeRng, round1 } from '../core/util.js';

export const SAVE_KEY = 'hthb:save:v1';
export const DEFAULT_META = () => ({
  version: 1, dread: 0, night: 0, completed: [], upgrades: [], lore: [], kept: 0, missing: 0,
  secrecy: 100, best: {}, nights: 0, settings: { volume: 0.8, muted: false, screenShake: true, reduceMotion: false, showTriggers: true, subtitles: true },
  tutorialDone: false, wins: 0, losses: 0, totalEvidenceBurned: 0
});

/* ------------------------------ meta persistence ------------------------------ */
export function loadMeta(storage) {
  try {
    const raw = storage?.getItem?.(SAVE_KEY);
    if (!raw) return DEFAULT_META();
    const parsed = JSON.parse(raw);
    return normalizeMeta(parsed.meta ?? parsed);
  } catch { return DEFAULT_META(); }
}
export function saveMeta(storage, meta) {
  try { storage?.setItem?.(SAVE_KEY, JSON.stringify({ meta, run: null })); } catch { /* quota */ }
}
export function normalizeMeta(m) {
  const d = DEFAULT_META();
  const out = { ...d, ...(m || {}) };
  out.settings = { ...d.settings, ...(m?.settings || {}) };
  for (const k of ['completed', 'upgrades', 'lore']) if (!Array.isArray(out[k])) out[k] = [];
  out.dread = Number(out.dread) || 0;
  out.night = clamp(Number(out.night) || 0, 0, SCENARIOS.length - 1);
  out.secrecy = clamp(Number(out.secrecy ?? 100), 0, 100);
  return out;
}
export function writeRun(storage, meta, run) {
  try {
    storage?.setItem?.(SAVE_KEY, JSON.stringify({ meta, run }));
    return true;
  } catch {
    try { storage?.setItem?.(SAVE_KEY, JSON.stringify({ meta: { ...meta, dread: meta.dread }, run: null })); } catch { }
    return false;
  }
}
export function readRun(storage) {
  try { const raw = storage?.getItem?.(SAVE_KEY); if (!raw) return null; const p = JSON.parse(raw); return p.run || null; } catch { return null; }
}
export function clearSave(storage) { try { storage?.removeItem?.(SAVE_KEY); } catch { } return DEFAULT_META(); }

/* ------------------------------ the game ------------------------------ */
export class Game {
  constructor(opts = {}) {
    this.storage = opts.storage || null;
    this.meta = normalizeMeta(opts.meta);
    this.onEvent = opts.onEvent || (() => { });
    this.reset(opts.scenario ?? this.meta.night ?? 0, { seed: opts.seed });
  }

  /* ---------- setup ---------- */
  reset(index, opts = {}) {
    this.scenarioIndex = clamp(index | 0, 0, SCENARIOS.length - 1);
    this.scenario = SCENARIOS[this.scenarioIndex];
    this.seed = opts.seed ?? ((Date.now() ^ (this.scenarioIndex * 7919)) >>> 0);
    this.rng = makeRng(this.seed ^ 0x9e3779b9);
    this.mods = this.collectMods();
    this.world = buildWorld(this.seed, this.mods);
    this.world.intruders = new Map();
    this.world.liveEvidence = 0;
    this.t = 0;
    this.paused = true;
    this.speed = 1;
    this.outcome = null;
    this.logs = [];
    this.cooldowns = {};
    this.unlocked = this.learnedPowers();
    this.energyMax = 100 + (this.mods.energyMax || 0) + this.scenarioIndex * 6;
    this.energy = this.energyMax * (0.55 + (this.mods.startEnergy || 0));
    this.stabilityMax = 100;
    this.stability = this.stabilityMax;
    this.fury = 0;
    this.surgeArmed = false;
    this.caseStrength = 0;
    this._escaped = 0; this._destroyed = 0; this.lostLoot = 0; this.calls = 0; this.dawnSoon = 0;
    this.fearInflicted = 0;
    this.stats = { haunts: 0, bigHaunts: 0, learned: 0, doorsLocked: 0, moved: 0, wards: 0, seals: 0, warps: 0, devour: 0, evidenceDestroyed: 0, maxFear: 0, expelled: 0, kept: 0, arrivals: 0 };
    this.knowledge = this.meta.upgrades.includes('t_memory_keep') ? { ...(this.meta.knowledgePersist || {}) } : {};
    this.focus = { room: this.scenarioIndex === 0 ? 'foyer' : 'hall', progress: {} };
    this.selectedRoom = this.focus.room;
    this.selected = null;
    this.objective = { progress: 0, need: this.scenario.objective?.need || 1, complete: false, detail: '', anchors: {}, ritualHold: 0, dares: [] };
    this.briefingSeen = true;
    this.spawnRoster();
    this.log('night', `${this.scenario.name} - ${this.scenario.tagline}`);
    this.log('objective', `They want: ${this.objectiveBlurb()}`);
    if (this.mods.wardStrength) this.log('gear', 'Salt lines are out tonight. They will ward a threshold.');
    return this;
  }

  objectiveBlurb() {
    const o = this.scenario.objective || {};
    switch (o.kind) {
      case 'dare_tour': return `see ${o.need} of ${o.targets.map(r => this.world.rooms[r]?.name || r).join(', ')} and get out talking`;
      case 'evidence': return `${o.need} filed pieces of evidence in ${this.world.rooms[o.cache?.split(':')[0]]?.name || 'their cache'}`;
      case 'loot': return `the silver (${(o.targets || []).length} caches), out through the ${this.world.rooms[o.exit]?.name || 'back'}`;
      case 'ritual': return `hold ${o.need} people sitting in ${this.world.rooms[o.room]?.name || 'the parlor'} for ${o.hold}s`;
      case 'banishing': return `${o.need} anchor rooms sealed with the rite${o.rescue ? ', and the boy brought out alive' : ''}`;
      default: return 'whatever they came for';
    }
  }

  learnedPowers() {
    const set = new Set(STARTER_POWERS);
    for (const id of this.meta.upgrades || []) {
      const u = UPGRADE_BY_ID[id];
      if (u && u.cat === 'power' && u.power) set.add(u.power);
    }
    for (const p of POWERS) if (!p.requires) set.add(p.id);
    return set;
  }

  collectMods() {
    const m = {
      energyRegen: 0, energyMax: 0, fearToEnergy: 0, stabilityRegen: 0, stabilitySoft: 0, evidenceMult: 0,
      cooldownMult: 1, costMult: 0, holdDuration: 0, outburstRisk: 0, furyDecay: 0, dreadDecay: 0, darkAmp: 0,
      observeRate: 0, wardBreak: 0, memoryKeep: 0, evidenceWeight: 1, startEnergy: 0, fearGainMult: 0,
      warpCost: 0, warpDuration: 0, warpStab: 0, gripRange: 0, breakPower: 0, noWindows: 0, stairLockable: 0,
      cellarDread: 0, ritualValue: 1, banishPressure: 1, anchorDrain: 0, intruderNerve: 1, dollPower: 0,
      roomAmp: {}, extraDoor: 0, extraDoor2: 0, hasRoomUpgrade: 0, fearToDread: 1, wardStrength: 0
    };
    const add = (k, v) => { if (v === null || v === undefined) return; if (typeof v === 'number') m[k] = (m[k] || 0) + v; else if (typeof v === 'object') m[k] = { ...(m[k] || {}), ...v }; else m[k] = v; };
    for (const id of this.meta.upgrades || []) {
      const u = UPGRADE_BY_ID[id];
      if (!u) continue;
      for (const [k, v] of Object.entries(u.mods || {})) add(k, v);
      if (u.room) add('hasRoomUpgrade', u.room);
    }
    for (const id of this.meta.lore || []) {
      const l = LORE.find(x => x.id === id);
      if (l) for (const [k, v] of Object.entries(l.mods || {})) add(k, v);
    }
    /* secrecy makes later nights harsher */
    const sec = 1 - clamp01(this.meta.secrecy / 100);
    m.evidenceWeight = (m.evidenceWeight || 1) + sec * 0.35;
    for (const [k, v] of Object.entries(this.scenario?.mods || {})) {
      if (typeof v === 'number' && typeof m[k] === 'number') m[k] = m[k] + (v - (k.endsWith('Weight') ? 1 : 0));
      else if (k === 'roomAmp') m.roomAmp = { ...(m.roomAmp || {}), ...v };
      else m[k] = v;
    }
    return m;
  }

  spawnRoster() {
    const list = this.scenario.roster || [];
    const startRoom = 'yard';
    list.forEach((spec, i) => {
      const arch = ARCH_BY_ID[spec.arch] || ARCH_BY_ID.thrill_seeker;
      const merged = { ...spec, arch: spec.arch, gear: spec.gear || arch.gear, traits: spec.traits || [] };
      const who = makeIntruder({ ...merged, name: spec.name || `${arch.name} ${i + 1}` }, this.world);
      who._world = this.world;
      who._slot = i;
      who.entry = { room: startRoom, x: 520 + (i - list.length / 2) * 22, y: 700 };
      who.x = who.entry.x; who.y = who.entry.y; who.room = startRoom; who.floor = 0;
      who.state = 'entering'; who.enterDelay = 0.6 + i * 1.4;
      who.fear = clamp(who.fear + this.rng.range(0, 8), 0, 100);
      this.world.intruders.set(who.id, who);
      this.world.rooms[startRoom].occupantIds = this.world.rooms[startRoom].occupantIds || [];
      /* bonds are symmetric and start at a working level */
      for (const other of this.world.intruders.values()) if (other !== who) { ensureBond(who, other.id).trust = 0.4 + this.rng.range(-0.1, 0.2); ensureBond(other, who.id).trust = 0.4 + this.rng.range(-0.1, 0.2); }
      if (this.knowledge[who.name]) who._known = this.knowledge[who.name];
    });
    /* the lost child, for rescue nights */
    if (this.scenario.objective?.rescue || this.scenarioIndex >= 5) {
      const c = childState(this.world);
      c.hidden = true; c.found = false; c.room = this.scenario.objective.rescue?.room || 'linen';
      const r = this.world.rooms[c.room]; c.x = r.cx + 16; c.y = r.cy;
    }
  }

  /* ---------- resources ---------- */
  get group() { return [...this.world.intruders.values()]; }
  get activeGroup() { return this.group.filter(i => i.state !== 'expelled' && i.state !== 'gone' && i.state !== 'escaped' && i.state !== 'kept'); }
  addFury(v) { this.fury = clamp(this.fury + v, 0, 100); }
  addStability(v, why) {
    const before = this.stability;
    this.stability = clamp(this.stability + v, 0, this.stabilityMax);
    if (this.stability <= 0 && before > 0) { this.breached = true; this.log('damage', 'Something in the frame gives and does not stop giving.'); }
    if (v < 0) { this.world.damage = (this.world.damage || 0) + -v * 0.05; if (why) this.log(v < -8 ? 'damage' : 'wear', `${-v.toFixed(1)} stability - ${why}.`); }
  }
  get grip() { /* how much of the house will obey right now */
    return clamp01(0.35 + this.stability / 100 * 0.65) * (this.energy > 6 ? 1 : 0.4);
  }
  energyRegen(dt) {
    const fearPressure = clamp01(this.avgFear() / 100);
    const base = (1.05 + this.mods.energyRegen + fearPressure * 1.5 + this.fury * 0.008) * (this.stability < 40 ? 0.7 : 1);
    this.energy = clamp(this.energy + base * dt, 0, this.energyMax);
  }
  avgFear() { const a = this.activeGroup; return a.length ? a.reduce((s, i) => s + i.fear, 0) / a.length : 0; }
  totalFear() { return this.activeGroup.reduce((s, i) => s + i.fear, 0); }

  /* ---------- main tick ---------- */
  update(dtReal) {
    if (this.paused || this.outcome) return;
    const dt = Math.min(0.12, dtReal) * this.speed;
    this.acc = (this.acc || 0) + dt;
    let steps = 0;
    while (this.acc >= TICK_STEP && steps < 8) { this.step(TICK_STEP); this.acc -= TICK_STEP; steps++; }
    if (steps === 8) this.acc = 0;
  }
  step(dt) {
    this.t += dt;
    const w = this.world;
    const ctxHook = {
      events: (type, data) => this.emit(type, data),
      onFootfall: (world, who) => this.onFootfall(world, who),
      onDoor: (world, who, d) => this.onDoorUse(world, who, d),
      onStairs: (world, who, from, to) => this.onStairs(world, who, from, to),
      onArrive: (world, who, kind) => this.onArrive(world, who, kind),
      allies: this.group, group: this.group, game: this
    };
    /* world upkeep first so perception sees the freshest state */
    stepWorld(w, dt, { events: (type, data) => this.emit(type, data), onStep: () => { } });
    for (const k in this.cooldowns) if (this.cooldowns[k] > 0) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
    if (this.surgeArmed && this.t - (this.surgeAt || 0) > 24) { this.surgeArmed = false; this.log('surge', 'The banked anger cools off unused.'); }
    if (this.surgeArmed && this.surgeAt === undefined) this.surgeAt = this.t;

    /* intruders */
    for (const who of this.group) {
      if (who.state === 'expelled' || who.state === 'gone' || who.state === 'escaped' || who.state === 'kept') continue;
      who._pfear = who.fear;
      if (who.state === 'entering') {
        who.enterDelay -= dt;
        if (who.enterDelay <= 0) {
          who.state = 'active';
          who.room = 'foyer'; const r = w.rooms.foyer; who.x = 520; who.y = r.y + 24; who.floor = 0;
          who.braced = 1.5;
          this.stats.arrivals++;
          spawnStimulus(w, { kind: 'enter', room: 'foyer', x: who.x, y: who.y, tags: { noise: 0.5 }, salience: 0.35, fear: 0.02, evidence: 0.03, about: `${who.name} comes in`, ttl: 10 });
          this.emit('enter', { who });
        }
        continue;
      }
      /* decay their memory of where the fear came from, tick gear, feel the house */
      gearTick(w, who, dt);
      if (who.commsCd) who.commsCd = Math.max(0, who.commsCd - dt);
      if (who.flareT > 0) { who.flareT -= dt; const r = w.rooms[who.room]; if (r) { r.light = Math.max(r.light, 0.5); } }
      if (who.state === 'down') { aiTick(w, who, dt, ctxHook); continue; }
      /* senses first: they perceive what the house just did, then feel it */
      perceive(w, who, dt, {
        onPerceive: (world, person, st, gain, g) => {
          if (st.evidence > 0.05 && gain > 0.3) this.captureFrom(world, person, st);
          if (st.tags?.shape || st.tags?.motion || st.tags?.voice) person.knows.saw = world.t;
        }
      });
      /* fear and group dynamics */
      fearTick(w, who, dt, this.activeGroup);
      /* the house feeds on fear */
      const df = who.fear - (who._pfear || 0);
      if (df > 0) {
        this.fearInflicted += df;
        this.stats.maxFear = Math.max(this.stats.maxFear, who.fear);
        const conv = 0.34 * (1 + (this.mods.fearToEnergy || 0));
        this.energy = clamp(this.energy + df * conv, 0, this.energyMax);
        this.addFury(df * 0.55);
        const r = w.rooms[who.room]; if (r) r.dread = clamp(r.dread + df * 0.006, 0, 2.4);
      }
      /* autonomy: this is the whole game */
      aiTick(w, who, dt, ctxHook);
      /* panic makes people drop what they came for */
      if (who.fear > 88 && who.carrying.loot.length && this.rng.chance(0.06)) {
        const drop = who.carrying.loot.pop();
        const pr = w.props[drop.id];
        if (pr) { pr.taken = false; pr.state.taken = false; pr.x = pr.home.x; pr.y = pr.home.y; }
        this.log('house', `${who.name} drops the ${drop.label} and runs.`);
        this.emit('lootdrop', { who, drop });
      }
      /* any outside room is an exit */
      if (w.rooms[who.room]?.outside && who.state !== 'entering') { this.onExit(w, who, {}); continue; }
      if (who.state === 'fleeing' && who.fear < 26) who.state = 'active';
      /* observation: the player looking at them teaches the house */
      if (this.focus.room === who.room && who.state === 'active') {
        const rate = 0.16 * (1 + (this.mods.observeRate || 0)) * (w.rooms[who.room].light > 0.3 ? 1.25 : 0.8);
        who.observed = Math.min(3, (who.observed || 0) + rate * dt);
        if (who.observed >= 1) { who.observed = 0; this.learnFrom(who); }
      }
      /* they leave stains of their own passage for the house to read */
      const room = w.rooms[who.room];
      if (room) { room.seenBy[who.id] = this.t; }
    }

    this.resourceTick(dt);
    this.objectiveTick(dt);
    this.checkOutcome();
  }

  resourceTick(dt) {
    this.energyRegen(dt);
    const decay = (0.55 + (this.mods.furyDecay || 0) * 0.55);
    this.fury = clamp(this.fury - decay * dt, 0, 100);
    const calm = clamp01(1 - this.fury / 130);
    let dreadHere = 0; for (const rid in this.world.rooms) dreadHere += this.world.rooms[rid].dread || 0;
    const reg = (0.5 + (this.mods.stabilityRegen || 0) + Math.min(0.7, dreadHere * 0.02)) * calm * (this.breached ? 0 : 1);
    this.stability = clamp(this.stability + reg * dt, 0, this.stabilityMax);
    /* loss of control: a furious house rattles on its own and it costs evidence */
    if (this.fury > 86 && !(this.mods.outburstRisk < 0)) {
      if (this.rng.chance(0.035 * dt * 60 / 60)) {
        const rooms = Object.keys(this.world.rooms).filter(r => !this.world.rooms[r].outside);
        const rid = this.rng.pick(rooms);
        const w = this.world;
        spawnStimulus(w, { kind: 'outburst', room: rid, x: w.rooms[rid].cx, y: w.rooms[rid].cy, tags: { noise: 0.9, shock: 0.4, wrong: 0.5 }, salience: 0.8, fear: 0.22, evidence: 0.34, about: 'the house rattling by itself' });
        w.rooms[rid].dread = clamp(w.rooms[rid].dread + 0.1, 0, 2.4);
        this.addStability(-0.6, 'uncontrolled');
        this.log('fury', 'The house rattles on its own - loud, and recorded.');
      }
    }
    /* the whole house's evidence ledger */
    const carried = this.activeGroup.reduce((s, i) => s + i.carrying.evidence.reduce((a, b) => a + b.weight, 0), 0);
    this.caseStrength = round1(this.world.liveEvidence + this.escapedEvidence + this.cacheEvidenceWeight() * 0.5 + carried * 0.5);
  }
  cacheEvidenceWeight() {
    let s = 0;
    for (const rid in this.world.caches) s += (this.world.caches[rid]?.items || []).reduce((a, i) => a + i.weight, 0);
    for (const w of this.group) s += 0; /* carried evidence is counted when it walks out */
    return s;
  }

  /* ---------- per-event hooks from the AI / world ---------- */
  onFootfall(w, who) {
    this.emit('step', { who, room: who.room });
    if (this.rng.chance(0.5)) return;
    spawnStimulus(w, { kind: 'steps', room: who.room, x: who.x, y: who.y, tags: { noise: 0.45 }, salience: 0.2, fear: 0, evidence: 0, about: null, ttl: 6 });
  }
  onDoorUse(w, who, d) {
    if (d.kind === 'door') { d.noise = Math.max(d.noise, 0.3); this.emit('door', { who, door: d }); }
    if (d.lockedBy === 'house') {
      who.belief = clamp01((who.belief || 0) + 0.22);
      who.speak = 'That was locked from the inside.'; who.speakT = 2.4;
      spawnStimulus(w, { kind: 'intent', room: who.room, x: who.x, y: who.y, tags: { watched: 0.6, wrong: 0.5 }, salience: 0.5, fear: 0.16, evidence: 0.22, about: 'them noticing a lock turned from the inside', ttl: 18 });
    }
  }
  onStairs(w, who, from, to) {
    this.emit('stairs', { who, from, to });
    const a = w.rooms[from], b = w.rooms[to];
    if (a) spawnStimulus(w, { kind: 'stairs', room: from, x: who.x, y: who.y, tags: { noise: 0.6 }, salience: 0.34, fear: 0.04, evidence: 0.02, about: null, ttl: 8 });
    if (b) b.footfall = Math.min(1.6, b.footfall + 0.2);
  }
  onArrive(w, who, kind) {
    const room = w.rooms[who.room];
    if (kind === 'advance') this.objectiveArrive(w, who, who.action?.params || {}, { group: this.group });
    if (kind === 'exit' && room?.outside) this.onExit(w, who, {});
  }

  /* ---------- discovery: how the player learns an intruder ---------- */
  learnFrom(who) {
    const known = this.knowledge[who.name] || (this.knowledge[who.name] = { fears: {}, traits: {}, gear: [...Object.keys(who.gear)], plan: null, secret: null });
    const unknownFears = Object.keys(who.fears).filter(k => !known.fears[k] && Math.abs(who.fears[k]) > 0.15);
    const unknownTraits = who.traits.filter(t => !known.traits[t]);
    let item = null;
    if (unknownFears.length && this.rng.chance(0.62)) {
      const k = this.rng.pick(unknownFears);
      known.fears[k] = who.fears[k] > 0.8 ? 2 : who.fears[k] > 0.3 ? 1 : -1;
      const fe = FEARS.find(f => f.id === k);
      const strength = known.fears[k] === 2 ? 'They cannot stand ' : known.fears[k] === 1 ? `${who.name} dislikes ` : `${who.name} is untroubled by `;
      item = { kind: k, text: strength + (fe ? fe.name.toLowerCase() : k) };
    } else if (unknownTraits.length) {
      const t = this.rng.pick(unknownTraits);
      known.traits[t] = 1;
      item = { kind: t, text: `${who.name}: ${t.replace(/_/g, ' ')}` };
    } else if (!known.plan) {
      known.plan = this.objectiveBlurb();
      item = { text: `${who.name} is here for: ${known.plan}` };
    } else if (!known.secret && who.mods.grief || !known.secret && who.mods.rescue) {
      known.secret = this.secretOf(who).short;
      item = { text: `${who.name} keeps telling themselves: ${known.secret}` };
    }
    if (item) {
      this.stats.learned++;
      this.log('insight', item.text);
      this.emit('learn', { who, item });
    }
    return item;
  }
  secretOf(who) {
    const sec = {
      night_thief: { short: 'the fence they sold out in ’19', kind: 'enclosed', fear: 'enclosed' },
      skeptic: { short: 'that they were right once and it ruined someone', kind: 'voices', fear: 'voices' },
      journalist: { short: 'the tip line call they never reported', kind: 'loss', fear: 'loss' },
      occult_investigator: { short: 'the case that ended their marriage', kind: 'isolation', fear: 'isolation' },
      paranormal_streamer: { short: 'how small the numbers get without a scare', kind: 'watched', fear: 'watched' },
      spiritualist_medium: { short: 'the first voice was not a spirit', kind: 'voices', fear: 'voices' },
      search_party: { short: 'the row they had before he went in', kind: 'loss', fear: 'loss' },
      exorcist: { short: 'the last house did not answer back', kind: 'blood', fear: 'blood' },
      urban_explorer: { short: 'the photo they did not publish', kind: 'dolls', fear: 'dolls' },
      thrill_seeker: { short: 'that they are the reason this happened', kind: 'loss', fear: 'loss' }
    };
    return sec[who.arch] || { short: 'something they have never said aloud', kind: 'voices', fear: 'voices' };
  }

  /* ---------- evidence ---------- */
  captureFrom(w, who, st) {
    if (!st) return null;
    const item = captureEvidence(w, who, st, 1, this.group);
    if (item) {
      this.log('evidence', `${who.name} has ${item.label} (${item.weight.toFixed(2)}).`);
      this.emit('captured', { who, item });
    }
    return item;
  }
  addRoomEvidence(roomId, amount, from) {
    if (amount <= 0) return;
    const room = this.world.rooms[roomId]; if (!room) return;
    room.evidence.push({ kind: from, weight: round1(amount * 0.9), t: this.t, seen: false });
    /* camera traps left running in the room bank their own record */
    for (const tr of room.traps) {
      if (tr.dead || this.t > tr.t + tr.ttl) continue;
      if (amount > 0.4 && this.rng.chance(0.4)) {
        const cache = this.scenario.objective?.cache ? this.scenario.objective.cache.split(':')[0] : 'foyer';
        const c = cacheAt(this.world, cache + ':x') || cacheAt(this.world, roomId);
        if (c) { c.items.push({ kind: 'trap_footage', weight: round1(amount * 0.85), t: this.t, room: roomId, label: `camera trap in ${room.name}` }); this.log('evidence', `A camera trap in ${room.name} filed footage.`); }
      }
    }
  }
  fileEvidence(w, ref, item, who) {
    const rid = ref.split(':')[0];
    const c = cacheAt(w, rid + ':x');
    if (!c) return false;
    c.items.push({ ...item, room: rid });
    this.log('evidence', `${who?.name || 'Someone'} files ${item.label} in ${w.rooms[rid]?.name || rid}.`);
    this.emit('filed', { who, item, room: rid });
    return true;
  }
  /* the AI contract asks the game two questions about the intruders' paperwork; both used to
     answer undefined, which quietly disabled filing and cache-raiding altogether */
  get cacheRef() {
    const o = this.scenario.objective || {};
    if (o.cache) return o.cache;
    if (o.exit) return `${o.exit}:box`;
    for (const rid in this.world.caches) if (this.world.caches[rid]?.items?.length) return `${rid}:box`;
    return null;
  }
  get objectiveKind() { return this.scenario.objective?.kind || null; }
  get escapedEvidence() { return this._escaped || 0; }
  set escapedEvidence(v) { this._escaped = v; }
  destroyEvidence(weight, roomId) {
    if (weight <= 0) return;
    this._destroyed = (this._destroyed || 0) + weight;
    this.stats.evidenceDestroyed += weight;
    this.meta.totalEvidenceBurned = round1((this.meta.totalEvidenceBurned || 0) + weight);
    if (roomId) { const r = this.world.rooms[roomId]; r.evidence = []; }
    this.log('secrecy', `Evidence destroyed: ${weight.toFixed(2)} of their case file.`);
    this.emit('devoured', { weight, roomId });
  }
  onWard(w, roomId, dur, who) { this.stats.wards++; const r = w.rooms[roomId]; if (r) { r.salt = 1; r.saltUntil = w.t + dur; } this.log('counter', `${w.rooms[roomId]?.name || roomId} is salted. Your hands are tied in there.`); this.emit('ward', { roomId, who }); }
  onTrap(w, who, roomId) { this.log('counter', `${who.name} leaves a camera trap running in ${w.rooms[roomId]?.name || 'a room'}.`); this.emit('trap', { who, roomId }); }
  onCleanse(w, who, roomId) { this.log('counter', `${who.name} smudges ${w.rooms[roomId]?.name || 'the room'}: the dread there drains.`); if (roomId) { const r = w.rooms[roomId]; r.dread = Math.max(0, r.dread - 0.85); } this.emit('cleanse', { who, roomId }); }
  onLight(w, who, roomId) { this.log('counter', `Flare light in ${w.rooms[roomId]?.name || 'the room'}. Darkness will not work in there.`); this.emit('light', { who, roomId }); }
  onVandal(w, who, roomId, dmg) {
    this.addStability(-dmg, `${who.name} vandalism`);
    const r = w.rooms[roomId]; if (r) { r.dread = clamp(r.dread - 0.05, 0, 2.4); r.disturbance = Math.min(3, r.disturbance + 0.4); }
    this.emit('vandal', { who, roomId });
  }
  onResist(w, who, fx, ctx) {
    if (fx.type === 'possess') { this.log('resist', `${who.name} puts the thing back down.`); who.resolve = clamp01(who.resolve + 0.05); this.fury = clamp(this.fury - 6, 0, 100); }
    this.addStability(-1.2, 'they fought back');
    this.emit('resist', { who, fx });
  }
  onDebunk(w, who, fx, ctx) {
    this.log('resist', `${who.name} explains it away. Their nerve comes back and your fury drops.`);
    who.fear = clamp(who.fear - 12, 0, 100);
    this.fury = clamp(this.fury - 9, 0, 100);
    this.energy = clamp(this.energy - 4, 0, this.energyMax);
    who.speak = 'Draft and old pipes. Look it up.'; who.speakT = 2.4;
    this.emit('debunk', { who });
  }
  onCallForHelp(w, who, ctx) {
    this.calls = (this.calls || 0) + 1;
    this.log('counter', `${who.name} calls for someone outside. Exposure pressure rises.`);
    this._callTimer = 62;
    this.emit('call', { who });
  }
  onSearch(w, who, prop, ctx) {
    const rid = prop.room, room = w.rooms[rid];
    /* objective props: loot, evidence, the lost child */
    const kid = w.lostChild;
    if (kid && !kid.found && (room?.id === kid.room) && !kid.hidden) kid.found = true;
    if (kid && !kid.found && (prop.id === 'linen:linen_rolls:840:404' || room?.id === kid.room)) {
      kid.found = true; kid.hidden = false; kid.carrier = who.id; who.sawKid = true; who.hasKid = true;
      who.fear = clamp(who.fear - 14, 0, 100);
      who.speak = 'Here. He is here, he is asleep-'; who.speakT = 3.4;
      this.log('objective', `${who.name} finds the boy in the ${room.name}.`);
      spawnStimulus(w, { kind: 'found', room: rid, x: who.x, y: who.y, tags: { voice: 0.7, noise: 0.7 }, salience: 0.8, fear: -0.1, evidence: 0.2, about: 'the missing boy found asleep', ttl: 24 });
      this.objective.rescueFound = true;
      this.emit('foundChild', { who });
      return;
    }
    const obj = this.scenario.objective;
    if (obj?.kind === 'loot' && !prop.taken && this.lootTargets().some(t => t.id === prop.id)) {
      prop.taken = true; prop.state.taken = true;
      who.carrying.loot.push({ id: prop.id, label: prop.type.replace(/_/g, ' '), value: prop.value || 2 });
      who.speak = `${prop.type.replace(/_/g, ' ')} - in the bag.`; who.speakT = 2.2;
      this.log('objective', `${who.name} takes the ${prop.type.replace(/_/g, ' ')} from ${room.name}.`);
      this.emit('loot', { who, prop });
      return;
    }
    if (prop.id === 'study:desk:200:420' || prop.type === 'photos') {
      const item = { kind: 'doc', weight: 0.6, label: `paper from ${room.name}`, room: rid, t: w.t, who: who.id };
      who.carrying.evidence.push(item);
      this.log('evidence', `${who.name} pockets a document.`);
      return;
    }
    if (prop.objective === 'fuse') {
      for (const rid2 in w.rooms) { if (w.rooms[rid2].floor === 0) { w.rooms[rid2].switchOn = true; w.rooms[rid2].lightBroken = false; for (const pid of w.rooms[rid2].props) { const p = w.props[pid]; if (p.light) { p.state.off = false; p.broken = false; } } } }
      who.speak = 'Fuse is back. Lights on.'; who.speakT = 2;
      this.log('counter', `${who.name} restores the ground floor fuse box: your snuffed lights come back and can be relit.`);
      this.repairedAt = w.t;
      return;
    }
    if (prop.opened && room) room.searched = Math.min(3, (room.searched || 0) + 0.4);
    this.emit('search', { who, prop });
  }

  /* ---------- exit / expulsion ---------- */
  onExit(w, who, ctx) {
    if (who.state === 'expelled' || who.state === 'escaped' || who.state === 'gone' || who.state === 'kept' || who.state === 'entering') return;
    const carrying = who.carrying.evidence.reduce((s, i) => s + i.weight, 0);
    const loot = who.carrying.loot.length;
    const fled = who.state === 'fleeing' || who.fear > 55;
    if (carrying > 0) {
      const hold = who.fear > 80 ? 0.3 : who.fear > 62 ? 0.65 : 1;
      const gotAway = round1(carrying * hold);
      this.escapedEvidence = round1(this.escapedEvidence + gotAway);
      if (hold < 1) {
        const drop = who.carrying.evidence.slice(Math.ceil(who.carrying.evidence.length * hold));
        for (const it of drop) { const r = this.world.rooms[who.room]; if (r) r.evidence.push({ kind: it.kind, weight: round1(it.weight), t: this.t, dropped: true, label: it.label }); }
        who.carrying.evidence = who.carrying.evidence.slice(0, Math.ceil(who.carrying.evidence.length * hold));
        this.log('house', `${who.name} drops ${drop.length} file${drop.length > 1 ? 's' : ''} on the way out - still in the house, still recoverable.`);
      }
      this.log('evidence', `${who.name} walks out carrying ${gotAway.toFixed(2)} of evidence.`);
    }
    if (loot) { this.lostLoot = (this.lostLoot || 0) + loot; this.log('loss', `${who.name} gets away with ${loot} thing${loot > 1 ? 's' : ''} out of this house.`); }
    if (who.hasKid && w.lostChild?.found) { this.objective.rescueDone = true; this.log('loss', 'The boy is out of the house. They have what they came for.'); }
    who.state = fled ? 'expelled' : 'escaped';
    who.expelledAt = this.t;
    if (fled) { this.stats.expelled++; this.fury = clamp(this.fury + 6, 0, 100); this.energy = clamp(this.energy + 8, 0, this.energyMax); }
    this.emit('exit', { who, fled, carrying, loot });
    this.log('exit', `${who.name} ${fled ? 'runs out into the night' : 'walks out the way they came'}.`);
  }

  /* ---------- scenario objectives ---------- */
  /* Objectives name props loosely as "room:type" while the world keys every prop by its full
     id, so both the planner and the reward path resolve through here - otherwise a loot run can
     never see its own target and the thieves drift until dawn. */
  resolveTarget(name) {
    const w = this.world;
    if (!name) return null;
    if (w.props[name]) return w.props[name];
    const [room, type] = String(name).split(':');
    for (const id in w.props) {
      const p = w.props[id];
      if (p.room === room && (!type || p.type === type)) return p;
    }
    return null;
  }
  lootTargets() {
    const o = this.scenario.objective || {};
    return (o.targets || []).map(t => this.resolveTarget(t)).filter(Boolean);
  }
  objectiveNext(w, who, ctx) {
    const o = this.scenario.objective || {};
    if (this.objective.complete) return this.leaveWithIt();
    switch (o.kind) {
      case 'dare_tour': {
        const done = new Set(this.objective.dares);
        const left = (o.targets || []).filter(t => !done.has(t));
        if (!left.length) {
          const where = o.review || 'foyer';
          return { kind: 'review', room: where, label: 'back to the gang to watch it', point: null, pull: 1.15, lockIn: 0.7, needsArrival: true };
        }
        const room = this.rng.weighted(left.map(r => [r, 1 / (1 + (w.rooms[r]?.dread || 0)) + (who.memory.rooms[r]?.visits ? 0.4 : 1)])) || left[0];
        return { kind: 'dare', room, label: `the dare: ${w.rooms[room]?.name}`, point: null, pull: 0.75 + who.stats.curiosity * 0.35, lockIn: 0.35, needsArrival: true };
      }
      case 'evidence': {
        const cache = o.cache ? o.cache.split(':')[0] : null;
        const have = (cache && w.caches[cache]?.items.length) || 0;
        if (who.carrying.evidence.length && who.fear < 62) {
          return { kind: 'advance_file', room: cache, label: 'the evidence box', point: null, pull: 0.55, lockIn: 0.3 };
        }
        /* look for something worth photographing: dread, stains, moved things */
        let best = null;
        for (const rid in w.rooms) {
          const r = w.rooms[rid];
          if (r.outside || r.floor === -1 && who.fear > 55) continue;
          let score = (r.dread || 0) * 1.1 + (r.stain || 0) * 1.4 + (r.evidence?.length || 0) * 0.25;
          for (const pid of r.props) { const p = w.props[pid]; if (p.moved && who.rng.chance(0.05)) score += 0.4; if (p.objective) score += 0.35; }
          const mem = who.memory.rooms[rid];
          if (mem) score -= Math.min(1.2, mem.searched * 0.3 + (mem.visits || 0) * 0.14);
          if (!mem) score += 0.55 + who.stats.curiosity * 0.4;
          if (r.sealBy === 'house') score -= 1.2;
          if (score > (best?.s || 0)) best = { rid, s: score };
        }
        if (!best) return null;
        return { kind: 'gather', room: best.rid, label: 'somewhere with a story', point: null, pull: 0.7 + who.stats.curiosity * 0.4, lockIn: 0.5, needsArrival: true };
      }
      case 'loot': {
        if (who.carrying.loot.length) {
          const exit = o.exit || 'lane';
          return { kind: 'loot_out', room: exit, label: 'the van', point: null, pull: 1.1, lockIn: 0.8, exitIntent: true };
        }
        const left = this.lootTargets().filter(pr => !pr.taken);
        if (!left.length) return null;
        /* nearest target they can actually reach */
        let best = null;
        for (const pr of left) {
          const r = findRoute(w, who.room, pr.room, who); if (!r) continue;
          if (!best || r.cost < best.cost) best = { cost: r.cost, prop: pr.id, room: pr.room };
        }
        if (!best) return null;
        const pr = w.props[best.prop];
        return { kind: 'loot', room: pr.room, point: { x: pr.x + pr.w / 2, y: pr.y + pr.h / 2 }, prop: best.prop, label: `the ${pr.type.replace(/_/g, ' ')}`, pull: 1 + who.stats.greed * 0.8 + (who.mods.greed || 0) * 0.4, lockIn: 0.9, needsArrival: true };
      }
      case 'ritual': {
        const room = o.room;
        if (who.fear > 72 && who.stats.faith < 0.6) return null;
        return { kind: 'seance', room, label: 'the circle', point: null, pull: 0.55 + who.stats.faith * 0.9 + (who.mods.devout || 0) * 0.5, lockIn: 0.85, needsArrival: true };
      }
      case 'banishing': {
        const anchors = o.anchors || [];
        const rescue = o.rescue;
        if (rescue && this.objective.rescueFound && !this.objective.rescueDone) {
          if (who.hasKid || (w.lostChild?.found && who.room === w.lostChild.room)) {
            const ex = nearestExit(w, who);
            if (ex) return { kind: 'escort_child', room: ex.room, label: 'out, with the boy', point: null, pull: 1.5, lockIn: 1 };
          }
          if (w.lostChild?.found && who.mods.rescue) { const c = w.lostChild; who.hasKid = true; }
        }
        if (rescue && !this.objective.rescueFound) {
          const kid = w.lostChild;
          if (kid && !kid.found && (who.mods.rescue || who.stats.charisma > 0.4)) {
            return { kind: 'find_child', room: kid.room, label: 'looking for the boy', point: null, pull: 1.15, lockIn: 0.9, needsArrival: true };
          }
        }
        const left = anchors.filter(a => !this.objective.anchors[a]);
        if (!left.length) return null;
        let best = null;
        for (const a of left) { const r = findRoute(w, who.room, a, who); if (r && (!best || r.cost < best.cost)) best = { a, cost: r.cost }; }
        if (!best) return null;
        return { kind: 'anchor', room: best.a, label: `the ${w.rooms[best.a]?.name} anchor`, point: null, pull: 0.7 + who.stats.faith * 0.9 + (who.mods.devout || 0) * 0.6, lockIn: 0.95, needsArrival: true };
      }
      default: return null;
    }
  }

  /* once they have what they came for, they go and the file goes with them */
  leaveWithIt() {
    const o = this.scenario.objective || {};
    return { kind: 'leave', room: o.exit || 'yard', label: 'out, with what they found', point: null, pull: 1.6, lockIn: 1.2 };
  }

  objectiveArrive(w, who, p, ctx) {
    const o = this.scenario.objective || {};
    if (!p || !p.kind) return;
    switch (p.kind) {
      case 'advance_file': {
        /* the objective walks them to the box; arriving has to actually file the film,
           otherwise the errand outranks the work and the case never grows */
        const ref = this.cacheRef;
        const [cr] = (ref || '').split(':');
        if (ref && cr && who.room === cr && who.carrying.evidence.length) {
          const n = who.carrying.evidence.length;
          for (const it of who.carrying.evidence) this.fileEvidence(w, ref, it, who);
          who.carrying.evidence = [];
          who.filedEvidence = (who.filedEvidence || 0) + n;
          who.fear = clamp(who.fear - 4 * Math.min(3, n), 0, 100);
          who.speak = n > 1 ? `${n} in the file. Keep moving.` : 'Filed.';
          who.speakT = 2;
        }
        break;
      }
      case 'dare': {
        if (!this.objective.dares.includes(p.room)) {
          this.objective.dares.push(p.room);
          who.objectives.dares.push(p.room);
          const item = { kind: 'clip', weight: 0.45, label: `dare clip in ${w.rooms[p.room]?.name}`, room: p.room, t: w.t, who: who.id };
          who.carrying.evidence.push(item);
          who.speak = `That is the ${w.rooms[p.room]?.name}. We are legend.`; who.speakT = 2.2;
          this.log('objective', `${who.name} films the dare in ${w.rooms[p.room]?.name}.`);
          this.objective.progress = this.objective.dares.length;
          if (this.objective.progress >= (o.need || 1)) this.objective.complete = true;
        }
        break;
      }
      case 'gather': {
        const room = w.rooms[who.room];
        if (room) room.searched = Math.min(3, room.searched + 0.55);
        who.braced = Math.max(who.braced, 3);
        if (room && (room.dread > 0.6 || room.stain > 0.2 || room.props.some(id => w.props[id].moved))) {
          this.captureFrom(w, who, { room: room.id, x: who.x, y: who.y, evidence: 0.34 + room.dread * 0.25, salience: 0.5, about: `documentation in ${room.name}`, tags: { wrong: 1 } });
        }
        break;
      }
      case 'loot': {
        const pr = p.prop ? w.props[p.prop] : null;
        if (pr && !pr.taken) { this.onSearch(w, who, pr, ctx); if (!pr.opened) { pr.opened = true; pr.searchProgress = 1; } }
        break;
      }
      case 'review': {
        who.speak = 'Right. Watch it back, then we are gone.'; who.speakT = 2.4;
        break;
      }
      case 'seance': {
        who.ritualProgress = Math.max(0, who.ritualProgress);
        who.chant = 6;
        const room = w.rooms[who.room];
        if (room) { for (const pid of room.props) { const p = w.props[pid]; if (p.type.includes('candelabra') || p.draw === 'candles') { p.state.lit = true; } } room.fire = Math.max(room.fire || 0, 0.35); room.dread = clamp(room.dread + 0.05, 0, 2.4); }
        break;
      }
      case 'anchor': {
        who.ritualProgress = 6; who.chant = 8;
        const room = w.rooms[who.room];
        if (room) { room.ward = 1; room.wardUntil = w.t + 20; }
        break;
      }
      case 'find_child': {
        const room = w.rooms[who.room];
        if (room) for (const pid of room.props) { const pr = w.props[pid]; searchPropStart(pr); }
        break;
      }
      case 'escort_child': break;
      default: break;
    }
  }

  objectiveTick(dt) {
    const o = this.scenario.objective || {};
    switch (o.kind) {
      case 'evidence': {
        const cache = o.cache ? o.cache.split(':')[0] : null;
        const filed = (cache && this.world.caches[cache]?.items.length) || 0;
        const carried = this.activeGroup.reduce((s, i) => s + i.carrying.evidence.length, 0);
        this.objective.progress = filed + Math.floor(carried * 0.6);
        if (this.objective.progress >= (o.need || 1) && filed >= Math.ceil((o.need || 1) * 0.6)) this.objective.complete = true;
        break;
      }
      case 'ritual': {
        const room = this.world.rooms[o.room];
        const inRoom = this.activeGroup.filter(i => i.room === o.room && i.state === 'active' && i.fear < 78);
        if (inRoom.length >= (o.need || 1)) {
          this.objective.ritualHold = (this.objective.ritualHold || 0) + dt * inRoom.length * 0.8;
          if (room) room.dread = clamp(room.dread + dt * 0.04, 0, 2.4);
          for (const i of inRoom) i.ritualProgress += dt;
        } else this.objective.ritualHold = Math.max(0, (this.objective.ritualHold || 0) - dt * 0.55);
        this.objective.progress = Math.floor((this.objective.ritualHold || 0) / (o.hold || 30) * (o.need || 1));
        if ((this.objective.ritualHold || 0) > (o.hold || 30)) this.objective.complete = true;
        break;
      }
      case 'banishing': {
        const anchors = o.anchors || [];
        for (const a of anchors) {
          if (this.objective.anchors[a]) continue;
          const inRoom = this.activeGroup.filter(i => i.room === a && i.state === 'active' && i.fear < 74);
          if (!inRoom.length) continue;
          this.objective.anchors[a] = (this.objective.anchors[a] || 0) + dt * inRoom.length * 0.5;
          const room = this.world.rooms[a];
          if (room) { room.ward = 1; room.wardUntil = this.t + 6; this.energy = clamp(this.energy - dt * 0.9, 0, this.energyMax); this.fury = clamp(this.fury - dt * 1.1, 0, 100); }
          if (this.objective.anchors[a] > (o.hold || 24)) {
            this.objective.anchors[a] = (o.hold || 24);
            this.log('loss', `The ${room?.name || a} anchor is sealed. Your grip there is gone.`);
            this.emit('anchor', { room: a });
          }
        }
        const sealed = Object.values(this.objective.anchors).filter(v => v >= (o.hold || 24)).length;
        this.objective.progress = sealed;
        if (sealed >= (o.need || 4)) this.objective.complete = true;
        if (this.objective.rescueDone) this.objective.complete = true;
        break;
      }
      case 'loot': {
        const deposited = this.world.caches[o.exit]?.items?.filter(i => i.kind === 'loot').length || 0;
        const carrying = this.activeGroup.reduce((s, i) => s + i.carrying.loot.length, 0) + (this.lostLoot || 0);
        this.objective.progress = carrying + deposited;
        if (this.objective.progress >= (o.need || 1)) this.objective.complete = true;
        break;
      }
      case 'dare_tour': {
        this.objective.progress = this.objective.dares.length;
        if (this.objective.dares.length >= (o.need || 1)) {
          /* they will not brag over the internet from inside the attic - they come back to the foyer first */
          const here = this.activeGroup.filter(i => i.room === (o.review || 'foyer') && i.state === 'active' && i.fear < 70).length;
          const want = Math.max(2, this.activeGroup.filter(i => i.state !== 'entering').length - (o.needReview || 0));
          if (here >= want) this.objective.reviewT = (this.objective.reviewT || 0) + dt;
          else this.objective.reviewT = Math.max(0, (this.objective.reviewT || 0) - dt * 0.7);
          if ((this.objective.reviewT || 0) > (o.reviewHold || 9)) this.objective.complete = true;
        }
        break;
      }
    }
    /* a phone call brings a patrol car: the night ends and everything they carry leaves */
    if (this._callTimer > 0) { this._callTimer -= dt; if (this._callTimer <= 0) { this.log('counter', 'Headlights in the street. They are all leaving now.'); for (const i of this.activeGroup) { i.exitIntent = true; i.state = 'fleeing'; } this.dawnSoon = 22; } }
    if (this.dawnSoon > 0) { this.dawnSoon -= dt; if (this.dawnSoon <= 0) this.finish('dawn'); }
  }

  /* ---------- outcomes ---------- */
  checkOutcome() {
    if (this.outcome) return;
    const o = this.scenario.objective || {};
    if (this.stability <= 0 || this.breached) return this.finish('ruin');
    if (this.caseStrength >= (this.scenario.caseLimit || 40)) return this.finish('exposed');
    const remaining = this.activeGroup.filter(i => i.state === 'active' || i.state === 'fleeing' || i.state === 'down' || i.state === 'entering');
    if (remaining.length && remaining.every(i => i.state === 'down') && this.t > 24) return this.finish('broken');
    if (!remaining.length) {
      if (this.objective.complete) return this.finish('objective');
      return this.finish('expelled');
    }
    if (this.objective.complete && (o.kind === 'ritual' || o.kind === 'banishing')) return this.finish('objective');
    if (this.t >= (this.scenario.timeLimit || 300)) return this.finish(this.objective.complete ? 'objective' : 'dawn');
  }
  finish(kind) {
    if (this.outcome) return this.outcome;
    const active = this.activeGroup;
    /* when the night ends, nobody is left half-written: inside becomes kept, outside becomes gone */
    for (const i of this.group) {
      if (i.state === 'expelled' || i.state === 'escaped' || i.state === 'gone' || i.state === 'kept') continue;
      if (i.room && this.world.rooms[i.room]?.outside) { this.onExit(this.world, i, {}); continue; }
      i.state = i.state === 'entering' ? 'gone' : 'kept';
      if (i.state === 'kept') { this.stats.kept++; this.log('house', `${i.name} is still in the house. They will be.`); }
    }
    const escaped = round1(this.escapedEvidence);
    const fearScore = Math.min(22, this.fearInflicted / 24);
    const learned = this.stats.learned * 2.5;
    /* whatever they filed but never got out with still leaves if they won */
    if (this.objective.complete) { const c = this.cacheEvidenceWeight(); if (c > 0) this.escapedEvidence = round1(this.escapedEvidence + c); }
    const win = kind === 'expelled' || kind === 'broken' || (kind === 'dawn' && !this.objective.complete && this.avgFear() > 40) || (kind === 'dawn' && this.stats.kept >= Math.ceil(this.group.length * 0.6));
    const partial = kind === 'dawn' && !this.objective.complete;
    let dread = 4 + fearScore + learned + this.stats.expelled * 5 + this.stats.kept * 2.5 + this.stats.evidenceDestroyed * 1.2 - escaped * 3.5;
    if (this.objective.complete) dread -= 8;
    if (win) dread *= 1.8; else if (partial) dread *= 1.05; else if (kind === 'objective') dread *= 0.55; else dread *= 0.4;
    if (kind === 'ruin' || kind === 'exposed') dread = Math.max(2, dread * 0.55);
    dread = clamp(Math.round(dread), 4, 58);
    const secHit = round1(escaped * (this.scenarioIndex >= 1 ? 1.15 : 0.8));
    const secrecy = clamp(this.meta.secrecy - secHit, 0, 100);
    const labels = {
      expelled: 'THE HOUSE IS THEIRS', dawn: 'DAWN - THEY WALKED OUT', objective: 'THEY GOT WHAT THEY CAME FOR',
      broken: 'THEY NEVER LEFT',
      exposed: 'EXPOSURE - THE FILE IS PUBLIC', ruin: 'RUIN - THE HOUSE CAME DOWN'
    };
    const verdict = {
      kind, win: !!win, partial: !!partial, dread, escapedEvidence: escaped, secrecyHit: secHit,
      fearInflicted: Math.round(this.fearInflicted), expelled: this.stats.expelled, kept: this.stats.kept,
      learned: this.stats.learned, evidenceBurned: Math.round(this.stats.evidenceDestroyed),
      title: labels[kind] || 'THE NIGHT ENDS', line: this.verdictLine(kind, win)
    };
    this.outcome = verdict;
    this.paused = true;
    this.meta.dread += dread;
    this.meta.nights = (this.meta.nights || 0) + 1;
    this.meta.secrecy = secrecy;
    this.meta.kept = (this.meta.kept || 0) + this.stats.kept;
    this.meta.missing = (this.meta.missing || 0) + this.stats.kept;
    if (win) this.meta.wins++; else this.meta.losses++;
    const prev = this.meta.best?.[this.scenario.id];
    if (!prev || dread > prev.dread) this.meta.best = { ...(this.meta.best || {}), [this.scenario.id]: { dread, fear: Math.round(this.fearInflicted), kind } };
    if (win && !this.meta.completed.includes(this.scenario.id)) {
      this.meta.completed.push(this.scenario.id);
      this.meta.night = clamp(Math.max(this.meta.night, this.scenarioIndex + 1), 0, SCENARIOS.length - 1);
      const loreFor = LORE[this.scenarioIndex] || LORE[LORE.length - 1];
      if (loreFor && !this.meta.lore.includes(loreFor.id)) { this.meta.lore.push(loreFor.id); verdict.loreUnlocked = loreFor; }
    }
    if (this.meta.upgrades.includes('t_memory_keep')) this.meta.knowledgePersist = this.knowledge;
    this.emit('end', verdict);
    this.persist();
    return verdict;
  }
  verdictLine(kind, win) {
    const after = this.scenario.after || '';
    if (kind === 'broken') return `Nobody in ${this.world.meta.name} is still standing. They will wake up somewhere else, or they will not. ${after}`;
    if (kind === 'expelled') return `They ran out of ${this.world.meta.name} in the dark, and did not stop at the gate. ${after}`;
    if (kind === 'dawn') return `Grey light in the windows. Some of them left with something, some of them did not leave. ${after}`;
    if (kind === 'objective') return `They finished what they came for. The house is quieter now, and that is not a compliment. ${after}`;
    if (kind === 'exposed') return `The file is out. Cameras, council letters, a documentary pitch. Every night from here is harder. ${after}`;
    if (kind === 'ruin') return 'Something in the framing gives, and does not stop giving. A house that collapses cannot hunt.';
    return after;
  }

  /* ---------- UI-facing helpers ---------- */
  cast(id, target) {
    const r = castPower(this, id, target);
    if (r.ok) {
      this.stats.haunts++;
      if ((POWER_BY_ID[id]?.evidence || 0) > 0.5) this.stats.bigHaunts++;
      if (id === 'lock_door') this.stats.doorsLocked++;
      if (id === 'nudge' || id === 'possess_object') this.stats.moved++;
      if (id === 'seal_room') this.stats.seals++;
      if (id === 'unhinge') this.stats.warps++;
      if (id === 'devour_records') this.stats.devour++;
      this.emit('cast', { id, r, target });
      this.spendEnergyFlash = 1;
      /* a cast may reveal something about whoever was in the room */
      const rid = r.target?.room;
      if (rid) {
        for (const i of this.activeGroup) if (i.room === rid && this.rng.chance(0.34)) this.learnFrom(i);
      }
      if (r.revealed) this.applyReveal(r.revealed);
    } else {
      this.emit('castFail', { id, why: r.why });
    }
    return r;
  }
  applyReveal(rv) {
    if (!rv) return;
    if (rv.who) {
      const who = this.world.intruders.get(rv.who);
      if (!who) return;
      const k = this.knowledge[who.name] || (this.knowledge[who.name] = { fears: {}, traits: {}, gear: [], plan: null, secret: null });
      if (rv.kind && k.fears[rv.kind] === undefined) {
        const v = sensOf(who, rv.kind);
        k.fears[rv.kind] = v > 0.8 ? 2 : v > 0.25 ? 1 : v < -0.1 ? -1 : 0;
        this.stats.learned++;
        this.log('insight', `${who.name} - ${rv.kind}: ${k.fears[rv.kind] === 2 ? 'terror' : k.fears[rv.kind] === 1 ? 'afraid' : k.fears[rv.kind] === -1 ? 'unbothered' : 'mild'}.`);
      }
      if (rv.secret) { k.secret = this.secretOf(who).short; this.stats.learned++; }
    }
  }
  canCastPower(id, target) { return canCast(this, id, target); }
  costOf(id, target) { return powerCost(this, POWER_BY_ID[id], target || {}); }
  armSurge() { if (this.fury < 30) return false; this.surgeArmed = true; this.surgeAt = this.t; this.emit('surge', { on: true }); return true; }
  setFocus(room) { if (this.world.rooms[room]) { this.focus.room = room; this.selectedRoom = room; this.emit('focus', { room }); return true; } return false; }
  roomSummary(rid) {
    const r = this.world.rooms[rid]; if (!r) return null;
    const occ = this.group.filter(i => i.room === rid);
    return {
      id: rid, name: r.name, floor: r.floor, light: r.light, dread: r.dread, stain: r.stain, salt: r.salt,
      sealed: r.sealBy === 'house' && this.t < r.sealUntil, ward: r.ward > 0, occupancy: occ.length,
      evidence: (r.evidence || []).length, activity: r.activity, props: r.props.length,
      doors: r.doors.map(d => { const x = this.world.byId[d]; return { id: d, kind: x.kind, open: x.open, locked: x.locked > 0, sealed: x.seal > 0, warp: x.warp ? x.warp.to : null, broken: !!x.broken, other: x.a === rid ? x.b : x.a, label: x.label }; })
    };
  }
  personSummary(who) {
    if (!who) return null;
    const kn = this.knowledge[who.name] || { fears: {}, traits: {} };
    return {
      id: who.id, name: who.name, arch: who.arch, archName: who.archName, role: who.role, state: who.state,
      room: who.room, roomName: this.world.rooms[who.room]?.name || who.room, fear: who.fear, resolve: who.resolve,
      action: who.action?.id, actionLabel: who.action?.label, fearBands: bands(who),
      known: kn, carriedEvidence: who.carrying.evidence.length, evidenceWeight: round1(who.carrying.evidence.reduce((s, i) => s + i.weight, 0)),
      loot: who.carrying.loot.map(l => l.label), gear: Object.keys(who.gear), hurt: who.hurt, alone: who.withAlly === 0,
      missingFor: who.missingFor, observed: who.observed || 0, speak: who.speak, blurb: who.blurb
    };
  }
  log(kind, text) {
    const entry = { kind, text, t: this.t };
    this.logs.push(entry);
    if (this.logs.length > 220) this.logs.shift();
    this.emit('log', entry);
    return entry;
  }
  emit(type, data) { try { this.onEvent(type, data, this); } catch { /* never let a listener break the sim */ } }

  /* ---------- persistence ---------- */
  serialize() {
    return {
      v: 1, seed: this.seed, scenarioIndex: this.scenarioIndex, t: this.t, paused: true, speed: this.speed,
      rngState: this.rng.state, worldRngState: this.world.rng.state,
      energy: this.energy, energyMax: this.energyMax, stability: this.stability, fury: this.fury, surgeArmed: this.surgeArmed, surgeAt: this.surgeAt, breached: !!this.breached,
      caseStrength: this.caseStrength, escapedEvidence: this.escapedEvidence, lostLoot: this.lostLoot || 0,
      fearInflicted: this.fearInflicted, stats: this.stats, cooldowns: this.cooldowns,
      knowledge: this.knowledge, objective: this.objective, calls: this.calls || 0, dawnSoon: this.dawnSoon || 0,
      focus: this.focus, selectedRoom: this.selectedRoom, outcome: this.outcome, logs: this.logs.slice(-40),
      world: serializeWorld(this.world), lostChild: this.world.lostChild || null,
      people: serializeIntruders(this.group)
    };
  }
  static restore(data, meta, storage, onEvent) {
    const g = new Game({ meta, storage, onEvent, scenario: data.scenarioIndex, seed: data.seed });
    g.loadRun(data);
    return g;
  }
  loadRun(data) {
    if (!data) return this;
    if (data.rngState !== undefined) this.rng.state = data.rngState;
    this.t = data.t || 0; this.energy = data.energy ?? this.energy; this.energyMax = data.energyMax || this.energyMax;
    this.stability = data.stability ?? this.stability; this.fury = data.fury ?? 0;
    this.surgeArmed = !!data.surgeArmed; this.surgeAt = data.surgeAt;
    this._escaped = data.escapedEvidence || 0; this.lostLoot = data.lostLoot || 0; this.caseStrength = data.caseStrength || 0;
    this.breached = !!data.breached;
    this.fearInflicted = data.fearInflicted || 0; this.stats = { ...this.stats, ...(data.stats || {}) };
    this.cooldowns = data.cooldowns || {}; this.knowledge = data.knowledge || this.knowledge;
    this.objective = { ...this.objective, ...(data.objective || {}) };
    this.calls = data.calls || 0; this.dawnSoon = data.dawnSoon || 0;
    this.focus = data.focus || this.focus; this.selectedRoom = data.selectedRoom || this.focus.room;
    this.logs = data.logs || [];
    this.outcome = data.outcome || null;
    restoreWorld(this.world, data.world);
    if (data.worldRngState !== undefined) this.world.rng.state = data.worldRngState;
    const _rng = this.world.rng.state;
    this.world.intruders = new Map();
    this.world.liveEvidence = data.world?.liveEvidence ?? 0;
    if (data.lostChild) this.world.lostChild = data.lostChild;
    for (const pd of data.people || []) {
      const who = makeIntruder({ arch: pd.arch, name: pd.name }, this.world);
      restoreIntruder(who, pd);
      who._world = this.world;
      this.world.intruders.set(who.id, who);
    }
    this.world.rng.state = _rng;
    indexWorld(this.world);
    this.unlocked = this.learnedPowers();
    this.paused = true;
    return this;
  }
  persist() { saveMeta(this.storage, this.meta); }
  saveRun() { const ok = writeRun(this.storage, this.meta, this.serialize()); this.emit('saved', { ok }); return ok; }
  static hasRun(storage) { return !!readRun(storage); }
  static loadSavedRun(storage, onEvent) {
    const data = readRun(storage);
    if (!data) return null;
    return Game.restore(data, normalizeMeta(loadMeta(storage)), storage, onEvent);
  }
}
const TICK_STEP = 1 / 20;

function bands(who) {
  const f = who.fear;
  return {
    level: f > 82 ? 'terror' : f > 62 ? 'scared' : f > 42 ? 'rattled' : f > 22 ? 'uneasy' : 'steady',
    panic: who.panic > 0.3, frozen: who.freeze > 0, grabbed: who.grabbed > 0, hurt: who.hurt > 0,
    braced: who.braced > 0, belief: who.belief || 0, debunk: who.debunkStreak
  };
}
function searchPropStart(pr) { pr.searchProgress = Math.max(0.5, pr.searchProgress || 0); }

export { TICK_STEP };

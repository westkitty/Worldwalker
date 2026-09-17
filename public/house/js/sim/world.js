/* THE HOUSE THAT HUNTS BACK - world state: rooms, doors, props, effects, stimuli.
   Pure data + logic.  No DOM, no rendering.  The AI reads exactly this. */
import { ROOMS, DOORS, PROPS, OUTSIDE, FLOORS, HOUSE_META } from '../data/house.js';
import { clamp, clamp01, dist, makeRng } from '../core/util.js';

export const TICK = 1 / 20;

export function buildWorld(seed, mods = {}) {
  const rng = makeRng(seed || 1);
  const rooms = {};
  for (const r of [...ROOMS, ...OUTSIDE]) {
    rooms[r.id] = {
      ...r, props: [], doors: [], light: r.lightDefault, lightBroken: false, switchOn: !!r.lightDefault,
      dread: r.baseDread, stain: 0, wet: 0, temp: 1, activity: 0, chaos: 0,
      salt: 0, saltUntil: 0, ward: 0, sealUntil: 0, sealBy: null,
      searched: 0, seenBy: {}, evidence: [], traps: [], disturbance: 0,
      lastEventAt: -99, occupantIds: [], footfall: 0, breath: 0, ritual: 0,
      cx: r.x + r.w / 2, cy: r.y + r.h / 2
    };
  }
  const doors = DOORS.map(d => ({ ...d, open: d.kind === 'stair' ? true : d.open, locked: 0, lockedBy: null, lockUntil: 0, jam: 0, jamUntil: 0,
    noise: 0, swing: 0, lastTouched: -99, autoClose: d.kind === 'door' ? 22 : 0, seal: 0, sealUntil: 0 }));
  /* progression can bolt extra passages onto the graph */
  if (mods.extraDoor) doors.push({
    id: 'dX_pantry_hall', a: 'hall', b: 'pantry', ax: 606, ay: 470, bx: 934, by: 420, kind: 'door',
    label: 'Hidden Passage', open: true, locked: 0, lockedBy: null, lockUntil: 0, jam: 0, noise: 1, hinge: 1, creak: 1,
    slamAt: -99, warp: null, extra: true
  });
  if (mods.extraDoor2) {
    doors.push({ id: 'dX_laundry_boiler', a: 'laundry', b: 'workshop', ax: 426, ay: 430, bx: 616, by: 430, kind: 'door', label: 'Bricked Arch', open: true, locked: 0, lockedBy: null, lockUntil: 0, jam: 0, noise: 1, hinge: 1, creak: 1, slamAt: -99, warp: null, extra: true });
    doors.push({ id: 'dX_hall_boiler', a: 'hall', b: 'boiler', ax: 434, ay: 486, bx: 426, by: 300, kind: 'stair', label: 'Trade Stair', open: true, locked: 0, lockedBy: null, lockUntil: 0, jam: 0, noise: 1, hinge: 1, creak: 1, slamAt: -99, warp: null, extra: true });
  }
  const props = {};
  for (const p of PROPS) {
    props[p.id] = { ...p, state: {}, home: { x: p.x, y: p.y }, moved: false, broken: false, hidden: false, opened: false, animated: 0, taken: false, searchProgress: 0 };
    if (rooms[p.room]) rooms[p.room].props.push(p.id);
  }
  for (const d of doors) {
    if (rooms[d.a]) rooms[d.a].doors.push(d.id);
    if (rooms[d.b]) rooms[d.b].doors.push(d.id);
  }
  const windows = {};
  for (const id in props) {
    const p = props[id];
    if (p.draw === 'window' || p.draw === 'door_plate') windows[p.room] = (windows[p.room] || 0) + 1;
  }
  for (const rid in rooms) {
    const r = rooms[rid];
    r.windows = r.outside ? 0 : (windows[rid] || (['master', 'child', 'spare', 'ubath', 'study', 'attic', 'nook'].includes(rid) ? 1 : 0));
    r.escalate = ['confined', 'dark'].some(t => r.tags.includes(t)) ? 1.2 : 1;
  }
  const world = {
    meta: HOUSE_META, floors: FLOORS, rooms, doors, props, rng,
    t: 0, stimuli: [], effects: [], nextStimId: 1, nextFxId: 1,
    caches: {}, damage: 0, anchorRings: {}, collapsed: {},
    mods
  };
  indexWorld(world);
  return world;
}

export function indexWorld(world) {
  world.byId = {};
  for (const d of world.doors) world.byId[d.id] = d;
  world.adj = {};
  for (const rid in world.rooms) world.adj[rid] = [];
  for (const d of world.doors) {
    if (world.adj[d.a]) world.adj[d.a].push(d.id);
    if (world.adj[d.b]) world.adj[d.b].push(d.id);
  }
}

export const roomOf = (world, id) => world.rooms[id];
export const doorOf = (world, id) => world.byId[id];

/* ---------- passage rules: what the house can and cannot do ---------- */
export function isWarded(world, roomId, who) {
  const r = world.rooms[roomId];
  if (!r || r.salt <= 0) return false;
  if (world.t > r.saltUntil) { r.salt = 0; return false; }
  const brk = world.mods.wardBreak || 0;
  if (brk && who && who._wardRoll !== undefined && who._wardRoll < brk) return false;
  if (brk && world.rng.chance(brk)) return false;
  return true;
}

export function doorLocked(d) { return d.locked > 0; }

/* Can this intruder physically use this door right now? */
export function doorUsable(world, d, who) {
  if (!d) return { ok: false, why: 'none' };
  if (d.seal > 0) return { ok: false, why: 'sealed' };
  if (d.kind === 'stair' && (world.mods.stairLockable ? d.locked > 0 : d.locked > 0) && !(who && who.breakPower > 0.4)) return { ok: false, why: 'locked' };
  if (d.locked > 0 && !(who && (who.unlockSkill > 0 || who.breakPower > 0))) return { ok: false, why: 'locked' };
  if (d.broken && d.jam > 0.6) return { ok: false, why: 'jammed' };
  return { ok: true, why: d.locked > 0 ? 'forced' : 'free' };
}

/* The house's own ability to act on a door/room. */
export function houseCanAct(world, roomId, who) {
  const r = world.rooms[roomId];
  if (!r) return { ok: false, why: 'unknown room' };
  if (r.outside) return { ok: false, why: 'beyond the walls' };
  if (isWarded(world, roomId, who)) return { ok: false, why: 'salt holds' };
  if (r.ward > 0 && world.t < r.wardUntil) return { ok: false, why: 'the rite holds' };
  if (world.ruin) return { ok: false, why: 'the house is spent' };
  return { ok: true, why: '' };
}

/* ---------- routing ---------- */
export function routeCost(world, d, fromRoom, who) {
  const a = world.rooms[fromRoom === d.a ? d.a : d.b];
  const b = world.rooms[fromRoom === d.a ? d.b : d.a];
  const ax = fromRoom === d.a ? d.ax : d.bx, ay = fromRoom === d.a ? d.ay : d.by;
  const bx = fromRoom === d.a ? d.bx : d.ax, by = fromRoom === d.a ? d.by : d.ay;
  let c = dist(a.cx, a.cy, ax, ay) + dist(bx, by, b.cx, b.cy);
  c += d.kind === 'stair' ? 46 : 16;
  const use = doorUsable(world, d, who);
  if (use.why === 'sealed' || use.why === 'jammed' || use.why === 'none') c += 1e7;
  else if (!use.ok) c += 900;
  else if (use.why === 'forced') c += 150 - (who ? who.breakPower * 95 + who.unlockSkill * 65 : 0);
  if (d.open === false) c += 24;
  if (d.noise > 0.4) c += 14;
  if (b.dread > 0.5) c += b.dread * 60 * (who ? (1.15 - who.nerve) : 1);
  if (b.light < 0.2 && who && who.darkSensitivity > 0.4) c += 90 * who.darkSensitivity;
  return c;
}

/* Dijkstra over the live graph, so locks/warps/seals genuinely change routes. */
export function findRoute(world, fromRoom, toRoom, who) {
  if (!world.rooms[fromRoom] || !world.rooms[toRoom]) return null;
  if (fromRoom === toRoom) return { steps: [], cost: 0, total: 0 };
  const distMap = { [fromRoom]: 0 }, prev = {}, seen = {};
  const queue = [fromRoom];
  while (queue.length) {
    let bi = 0, bv = Infinity;
    for (let i = 0; i < queue.length; i++) { const v = distMap[queue[i]]; if (v < bv) { bv = v; bi = i; } }
    const cur = queue.splice(bi, 1)[0];
    if (seen[cur]) continue;
    seen[cur] = true;
    for (const did of world.adj[cur] || []) {
      const d = world.byId[did];
      const nx = d.a === cur ? d.b : d.a;
      const warped = d.warp ? d.warp.to : null;
      const target = warped && cur === fromRoomSide(d, cur) ? warped : nx;
      if (!world.rooms[target]) continue;
      const c = distMap[cur] + routeCost(world, d, cur, who);
      if (c < (distMap[target] ?? Infinity)) { distMap[target] = c; prev[target] = { from: cur, door: did }; if (!seen[target]) queue.push(target); }
    }
  }
  if (!(toRoom in distMap) || distMap[toRoom] > 1e6) return null;
  const steps = [];
  let cur = toRoom;
  while (cur && cur !== fromRoom) {
    const p = prev[cur];
    if (!p) break;
    const d = world.byId[p.door];
    const fromPoint = p.from === d.a ? { x: d.ax, y: d.ay } : { x: d.bx, y: d.by };
    const toPoint = cur === d.b ? { x: d.bx, y: d.by } : { x: d.ax, y: d.ay };
    steps.unshift({ door: p.door, from: p.from, to: cur, fromPoint, toPoint, kind: d.kind, warp: !!d.warp });
    cur = p.from;
  }
  return { steps, cost: distMap[toRoom], total: steps.length };
}
function fromRoomSide(d, cur) { return d.a === cur ? d.a : d.b; }

export function reachable(world, fromRoom, toRoom, who) {
  return !!findRoute(world, fromRoom, toRoom, who);
}

/* ---------- stimuli: everything the AI can perceive ---------- */
export function spawnStimulus(world, s) {
  const st = {
    id: world.nextStimId++, t: world.t, age: 0, ttl: s.ttl ?? 26,
    room: s.room, x: s.x ?? world.rooms[s.room]?.cx ?? 0, y: s.y ?? world.rooms[s.room]?.cy ?? 0,
    kind: s.kind || 'creak', tags: s.tags || {}, salience: s.salience ?? 0.5,
    evidence: s.evidence ?? 0, fear: s.fear ?? 0.2, about: s.about || null,
    target: s.target || null, heardBy: {}, seenBy: {}, payload: s.payload || null,
    floor: world.rooms[s.room]?.floor ?? 0
  };
  world.stimuli.push(st);
  const r = world.rooms[st.room];
  if (r) {
    r.activity = Math.min(2.4, r.activity + st.salience * 0.6);
    r.lastEventAt = world.t;
    r.dread = clamp(r.dread + st.fear * 0.16 * (r.escalate || 1), 0, 2.4);
    r.disturbance = Math.min(3, r.disturbance + st.salience * 0.35);
  }
  if (world.stimuli.length > 90) world.stimuli.splice(0, world.stimuli.length - 90);
  return st;
}

/* how strongly a person in room A perceives an event in room B */
export function perceptionGain(world, st, who) {
  const here = who.room;
  if (st.room === here) {
    const d = dist(st.x, st.y, who.x, who.y);
    return clamp01(1.15 - d / 520);
  }
  let g = 0;
  /* through an open/unlocked door into a neighbouring room, or up/down a stair */
  for (const did of world.adj[here] || []) {
    const d = world.byId[did];
    const other = d.a === here ? d.b : d.a;
    if (other !== st.room && !(d.warp && d.warp.to === st.room)) continue;
    const doorState = d.open ? 0.85 : 0.45;
    const lockPenalty = d.locked > 0 ? 0.55 : 1;
    const seal = d.seal > 0 ? 0.18 : 1;
    g = Math.max(g, 0.62 * doorState * lockPenalty * seal);
  }
  if (who.lying > 0 || who.hiddenIn) g *= 0.45;
  if (world.rooms[here] && world.rooms[here].salt > 0) g *= 0.6;
  return g;
}

/* ---------- effects spawned by the house ---------- */
export function addEffect(world, e) {
  const fx = { id: world.nextFxId++, t: world.t, until: world.t + (e.duration || 4), power: e.power || 1, data: e.data || {}, ...e };
  world.effects.push(fx);
  return fx;
}
export function effectsOfType(world, type, roomId) {
  return world.effects.filter(f => f.type === type && (!roomId || f.room === roomId) && f.until > world.t);
}
export function hasEffect(world, type, roomId) { return effectsOfType(world, type, roomId).length > 0; }

/* ---------- per-tick world upkeep ---------- */
export function stepWorld(world, dt, ctx) {
  world.t += dt;
  for (const rid in world.rooms) {
    const r = world.rooms[rid];
    if (r.outside) continue;
    /* light: switch state, broken fittings, fireplace glow */
    const target = r.switchOn && !r.lightBroken ? 1 : (r.fire ? 0.55 : 0);
    r.light += (target - r.light) * clamp01(dt * 3.2);
    if (r.fire > 0) { r.fire = Math.max(0, r.fire - dt * 0.06); r.light = Math.max(r.light, 0.4 + Math.sin(world.t * 7 + r.cx) * 0.06); }
    /* dread decays unless upgraded; cold spots and blood sustain it */
    let dreadRate = -0.035 * (1 - (world.mods.dreadDecay || 0));
    const cold = hasEffect(world, 'cold_spot', rid);
    const blood = hasEffect(world, 'bleed', rid);
    const app = hasEffect(world, 'apparition', rid);
    if (cold) dreadRate += 0.055;
    if (blood) dreadRate += 0.03;
    if (app) dreadRate += 0.09;
    r.dread = clamp(r.dread + dreadRate * dt * (r.escalate || 1), 0, 2.4);
    if (world.mods.cellarDread && r.floor === -1) r.dread = clamp(r.dread + 0.012 * dt, 0, 2.4);
    r.activity = Math.max(0, r.activity - dt * 0.36);
    r.disturbance = Math.max(0, r.disturbance - dt * 0.12);
    r.footfall = Math.max(0, r.footfall - dt * 0.25);
    r.breath = Math.max(0, r.breath - dt * 0.4);
    if (r.salt > 0 && world.t > r.saltUntil) r.salt = 0;
    if (r.sealUntil && world.t > r.sealUntil && r.sealBy === 'house') { r.sealUntil = 0; r.sealBy = null; }
    if (r.wardUntil && world.t > r.wardUntil) { r.ward = 0; }
    if (r.stain > 0 && !blood) r.stain = Math.max(0, r.stain - dt * 0.012);
  }
  /* doors swing back, hinges wear, warps expire */
  for (const d of world.doors) {
    if (d.warp && world.t > d.warp.until) { d.warp = null; }
    if (d.noise > 0) d.noise = Math.max(0, d.noise - dt * 0.5);
    if (d.lockBy === 'house' && d.lockUntil && world.t > d.lockUntil) { d.locked = 0; d.lockBy = null; }
    if (d.jam > 0 && world.t > d.jamUntil) d.jam = Math.max(0, d.jam - dt * 0.1);
    if (d.seal > 0 && d.sealUntil && world.t > d.sealUntil) { d.seal = 0; d.jam = 0; if (ctx?.events) ctx.events('unseal', { door: d }); }
    if (d.open && d.autoClose > 0 && world.t - d.lastTouched > d.autoClose) {
      d.open = false; d.swing = 1; if (ctx?.events) ctx.events('door_auto', { door: d });
      if (world.rooms[d.a]) spawnStimulus(world, { kind: 'door_close', room: d.a, x: d.ax, y: d.ay, tags: { noise: 0.5 }, salience: 0.4, fear: 0.1, evidence: 0.03 });
    }
    if (d.swing > 0) d.swing = Math.max(0, d.swing - dt * 2.4);
  }
  /* expire effects, apply their world mutation */
  for (let i = world.effects.length - 1; i >= 0; i--) {
    const f = world.effects[i];
    const r = world.rooms[f.room];
    if (f.type === 'cold_spot' && r) r.temp = clamp01(1 - (f.until - world.t) * 0.06);
    if (f.type === 'possess' && f.until <= world.t) {
      const p = world.props[f.prop];
      if (p) { p.animated = 0; if (f.data.throwAt) { /* nothing persistent */ } }
    }
    if (f.until <= world.t) {
      if (f.type === 'apparition' && r) r.dread = clamp(r.dread + 0.12, 0, 2.4);
      if (f.type === 'bleed' && r) r.stain = Math.max(r.stain, 0.15);
      world.effects.splice(i, 1);
    }
  }
  for (const rid in world.rooms) {
    const r = world.rooms[rid];
    if (r.outside) continue;
    const cold = hasEffect(world, 'cold_spot', rid);
    if (!cold) r.temp = clamp01(r.temp + dt * 0.25);
  }
  /* stimuli age out */
  for (let i = world.stimuli.length - 1; i >= 0; i--) {
    const s = world.stimuli[i];
    s.age = world.t - s.t;
    if (s.age > s.ttl) world.stimuli.splice(i, 1);
  }
  /* animated props jitter */
  for (const pid in world.props) {
    const p = world.props[pid];
    if (p.animated > 0) p.animated = Math.max(0, p.animated - dt);
    else if (p.vel && (Math.abs(p.vel.x) > 1 || Math.abs(p.vel.y) > 1)) {
      p.x += p.vel.x * dt; p.y += p.vel.y * dt;
      p.vel.x *= 0.86; p.vel.y *= 0.86;
      p.rot = (p.rot || 0) + (p.vel.x + p.vel.y) * 0.004;
    }
  }
  if (ctx?.onStep) ctx.onStep(world);
}

export function roomLabel(world, rid) { return world.rooms[rid]?.name || rid; }
export function litLevel(world, rid) { const r = world.rooms[rid]; return r ? clamp01(r.light) : 1; }

/* ---------- caches of collected evidence, and loot ---------- */
export function cacheAt(world, ref) {
  if (!ref) return null;
  const [rid] = ref.split(':');
  if (!world.rooms[rid]) return null;
  if (!world.caches[rid]) world.caches[rid] = { room: rid, items: [], x: world.rooms[rid].cx, y: world.rooms[rid].cy };
  return world.caches[rid];
}
export function fileEvidence(world, ref, item) {
  const c = cacheAt(world, ref);
  if (!c) return false;
  c.items.push(item);
  return true;
}
export function cacheWeight(world, rid) {
  const c = world.caches[rid];
  return c ? c.items.reduce((s, i) => s + i.weight, 0) : 0;
}

/* ---------- serialization ---------- */
export function serializeWorld(world) {
  return {
    t: world.t, rng: world.rng.state, nextStimId: world.nextStimId, nextFxId: world.nextFxId,
    damage: world.damage, ruin: !!world.ruin,
    rooms: Object.fromEntries(Object.entries(world.rooms).map(([k, r]) => [k, {
      light: r.light, switchOn: r.switchOn, lightBroken: r.lightBroken, dread: r.dread, stain: r.stain,
      wet: r.wet, temp: r.temp, activity: r.activity, salt: r.salt, saltUntil: r.saltUntil, sealUntil: r.sealUntil,
      sealBy: r.sealBy, ward: r.ward, wardUntil: r.wardUntil, searched: r.searched, disturbance: r.disturbance, fire: r.fire || 0
    }])),
    doors: world.doors.map(d => ({ id: d.id, open: d.open, locked: d.locked, lockBy: d.lockBy, lockUntil: d.lockUntil, jam: d.jam, jamUntil: d.jamUntil, hinge: d.hinge, broken: d.broken, noise: d.noise, warp: d.warp, lastTouched: d.lastTouched })),
    props: Object.values(world.props).map(p => ({ id: p.id, x: p.x, y: p.y, state: p.state, moved: p.moved, broken: p.broken, opened: p.opened, hidden: p.hidden, taken: p.taken, animated: p.animated, searchProgress: p.searchProgress })),
    effects: world.effects, stimuli: world.stimuli.map(s => ({ ...s, seenBy: {}, heardBy: { ...s.heardBy } })),
    caches: world.caches
  };
}
export function restoreWorld(world, data) {
  if (!data) return world;
  world.t = data.t || 0; world.rng.state = data.rng || 1;
  world.nextStimId = data.nextStimId || 1; world.nextFxId = data.nextFxId || 1; world.damage = data.damage || 0; world.ruin = !!data.ruin;
  for (const [k, v] of Object.entries(data.rooms || {})) if (world.rooms[k]) Object.assign(world.rooms[k], v);
  const byId = {}; for (const d of world.doors) byId[d.id] = d;
  for (const dv of data.doors || []) { const d = byId[dv.id]; if (d) Object.assign(d, dv); }
  for (const pv of data.props || []) { const p = world.props[pv.id]; if (p) Object.assign(p, pv); }
  world.effects = data.effects || [];
  world.stimuli = (data.stimuli || []).map(s => ({ ...s, seenBy: s.seenBy || {}, heardBy: s.heardBy || {} }));
  world.caches = data.caches || {};
  return world;
}
export const worldHelpers = { clamp, clamp01 };

/* THE HOUSE THAT HUNTS BACK - intruder entities: senses, fear, gear, bonds, travel.
   Decision-making lives in ai.js; this file is the body. */
import { ARCH_BY_ID, TRAIT_BY_ID, GEAR_BY_ID_ALL, FEAR_IDS } from '../data/intruders.js';
import { TAG_TO_FEAR } from '../data/powers.js';
import { LOST_CHILD } from '../data/scenarios.js';
import { clamp, clamp01, dist, makeRng } from '../core/util.js';
import { doorUsable, perceptionGain, spawnStimulus, findRoute } from './world.js';

let SEQ = 1;

export function makeIntruder(spec, world) {
  const arch = ARCH_BY_ID[spec.arch] || ARCH_BY_ID.thrill_seeker;
  const traitIds = [...new Set([...(arch.traits || []), ...(spec.traits || [])])];
  const mods = {};
  for (const tid of traitIds) {
    const t = TRAIT_BY_ID[tid]; if (!t) continue;
    for (const [k, v] of Object.entries(t.mods || {})) mods[k] = (mods[k] || 0) + v;
  }
  const gearIds = spec.gear || arch.gear || [];
  const gear = {};
  for (const g of gearIds) {
    const def = GEAR_BY_ID_ALL[g]; if (!def) continue;
    gear[g] = { id: g, uses: def.uses || 0, charge: def.battery || 0, max: def.battery || 0, broken: 0, active: true, placed: false };
  }
  const fears = { ...arch.fears, ...(spec.fears || {}) };
  const id = 'p' + (SEQ++);
  return {
    id, name: spec.name || arch.name, arch: arch.id, archName: arch.name, role: spec.role || arch.role,
    blurb: spec.blurb || arch.blurb, palette: { ...arch.palette },
    x: 0, y: 0, room: 'yard', floor: 0, face: -Math.PI / 2, step: 0, stride: 0,
    state: 'entering', alive: true, expelledAt: -1,
    fear: 0, nerve: clamp01(0.35 + (arch.stats.nerve || 0.5) * 0.55),
    resolve: clamp01(0.3 + (arch.stats.resolve || 0.5) * 0.6),
    panic: 0, freeze: 0, braced: 0, startle: 0, shock: 0,
    stats: { ...arch.stats }, traits: traitIds, mods, fears, sens: {},
    speed: arch.speed || 1,
    gear, carrying: { loot: [], evidence: [], items: [] }, filedEvidence: 0, evidenceWeight: 0,
    bonds: {}, lastSeenAlly: {}, missingFor: 0, withAlly: 0, aloneFor: 0,
    queue: [], goal: null, goalKind: null, navFail: 0, arriveT: 0, crossing: null,
    action: null, think: world.rng.range(0, 0.5), actionT: 0, committed: 0,
    memory: { rooms: {}, props: {}, plans: 0 }, suspects: {}, knows: {},
    speak: null, speakT: 0, shout: 0, hurt: 0, downT: 0, carried: false, carries: null,
    tether: null, tetheredTo: null, saltedRoom: null, ritualProgress: 0, chant: 0,
    haunted: 0, debunkStreak: 0, greedSatisfied: 0, faithFed: 0, sawKid: false, hasKid: false,
    objectives: { visited: [], dares: [], taken: [], ritualsDone: 0, anchors: [] },
    rng: makeRng((world.rng.int(1, 1e9) ^ (SEQ * 2654435761)) >>> 0),
    breakPower: clamp01(0.15 + (mods.breakPower || 0) + (gear.crowbar ? 0.7 : 0)),
    unlockSkill: clamp01((mods.unlock || 0) + (gear.lockpick ? 0.72 : 0) + (mods.careful ? 0.1 : 0)),
    darkSensitivity: clamp01(0.3 + (mods.darkHandicap || 0) + (fears.darkness || 0) * 0.35),
    light: 0, _wardRoll: undefined
  };
}

export function sensOf(who, kind) {
  const v = who.fears?.[kind];
  return v === undefined ? 0 : v;
}

export function placeAtEntrance(who, room, x, y) {
  who.room = room; const r = who._world?.rooms?.[room];
  who.x = x; who.y = y;
}

/* ---------------- perception + fear ---------------- */
export function perceive(world, who, dt, hook) {
  const out = { events: [], mag: 0, noise: 0 };
  for (const st of world.stimuli) {
    if (st.heardBy[who.id] === undefined) st.heardBy[who.id] = 0;
    if (st.heardBy[who.id] === 1) continue;
    const gain = perceptionGain(world, st, who);
    const audible = st.kind === 'scream' || st.tags?.noise || st.tags?.voice ? 0.34 : 0.52;
    if (gain < audible) continue;
    st.heardBy[who.id] = 1;
    out.events.push({ st, gain });
    /* reaction magnitude from fear profile */
    let react = 0;
    for (const [tag, w] of Object.entries(st.tags || {})) {
      const map = TAG_TO_FEAR[tag]; if (!map) continue;
      for (const [kind, fw] of Object.entries(map)) react += w * fw * sensOf(who, kind);
    }
    const sudden = ['slam', 'crash', 'scream', 'touch', 'apparition', 'collapse', 'object', 'shape'].includes(st.kind);
    const unprepared = who.braced > 0 ? 0.55 : 1;
    const careful = 1 - clamp01(who.mods.startleResist || 0) * (sudden ? 1 : 0.25);
    const room = world.rooms[who.room];
    const darkMod = 1 + (room && room.light < 0.22 ? 0.35 + who.darkSensitivity * 0.5 + (world.mods.darkAmp || 0) : 0);
    const dreadMod = 1 + (room ? room.dread * 0.45 : 0);
    const nerveMod = 1.35 - who.nerve * 0.7 - who.resolve * 0.25 + (who.mods.fearGain || 0);
    const g = (st.fear * 0.5 + clamp(react, -1.6, 2.6) * 0.52) * gain * unprepared * careful * darkMod * dreadMod * nerveMod;
    if (sudden) { who.startle = Math.max(who.startle, clamp01(g * 0.9)); who.braced = Math.min(6, who.braced + 2.2); }
    who.fear = clamp(who.fear + g * 26, -6, 100);
    out.mag += Math.abs(g);
    /* they learn about the room they heard */
    const rm = st.room;
    if (rm) {
      const m = who.memory.rooms[rm] || (who.memory.rooms[rm] = { visits: 0, lastAt: -99, dread: 0, events: 0, fear: 0, hazard: 0, searched: 0, wrong: 0 });
      m.events++; m.dread = Math.max(m.dread, room?.dread || 0); m.fear = Math.max(m.fear, who.fear);
      if (st.tags?.space) m.wrong = 1;
    }
    if (hook?.onPerceive) hook.onPerceive(world, who, st, gain, g);
  }
  /* what they can see in this room right now */
  const room = world.rooms[who.room];
  if (room) {
    for (const pid of room.props) {
      const p = world.props[pid];
      if (p.moved && !who.memory.props[p.id]) {
        who.memory.props[p.id] = 1;
        const g = (0.2 + Math.max(0, sensOf(who, 'dolls')) * 0.25 + 0.1) * (1 - who.nerve * 0.4);
        who.fear = clamp(who.fear + g * 16, 0, 100);
        out.events.push({ st: { kind: 'displacement', room: p.room, x: p.x, y: p.y, tags: { wrong: 1 }, salience: 0.4, fear: 0.2, evidence: 0.1, about: `${p.type.replace(/_/g, ' ')} moved` }, gain: 1, seen: true });
        if (hook?.onPerceive) hook.onPerceive(world, who, { kind: 'displacement', room: p.room, tags: { wrong: 1 }, evidence: 0.1, salience: 0.35, fear: 0.18 }, 1, g);
      }
      if (p.animated > 0) { who.braced = Math.max(who.braced, 3); }
    }
    if (room.stain > 0.1) {
      const s = sensOf(who, 'blood');
      who.fear = clamp(who.fear + (0.16 + s * 0.22) * dt * 8 * (1 - who.nerve * 0.4), 0, 100);
    }
    if (room.salt > 0 && who.gear.salt) { room.salt = Math.max(room.salt, 0.001); }
  }
  return out;
}

export function fearTick(world, who, dt, group) {
  const room = world.rooms[who.room];
  /* soothing conditions */
  let decay = 0.26 + who.nerve * 0.46 + who.resolve * 0.2 + (who.mods.fearDecay || 0) * 0.35;
  const lightHere = room ? room.light : 1;
  decay += lightHere * 0.3;
  if (who.gear.flashlight?.active && who.gear.flashlight.charge !== 0) decay += 0.22;
  if (who.gear.headlamp?.active) decay += 0.16;
  if (who.gear.crucifix) decay += 0.3 * (1 + who.stats.faith * 0.5);
  /* company */
  let withThem = 0, panicking = 0, calmAura = 0, leaderNear = null;
  for (const o of group) {
    if (o === who || o.state !== 'active' && o.state !== 'fleeing') continue;
    if (o.room === who.room) {
      withThem++;
      who.lastSeenAlly[o.id] = world.t;
      if (o.state === 'fleeing' || o.panic > 0) panicking++;
      const aura = (o.mods.calmAura || 0) + o.stats.charisma * 0.4;
      if (aura > calmAura) { calmAura = aura; leaderNear = o; }
      if (o.fear < 25 && aura > 0.5) who.fear = clamp(who.fear - aura * 0.5 * dt * bond(who, o), 0, 100);
      if (o.fear > 55) {
        const spread = 2.6 * (1 + Math.max(0, who.mods.contagion || 0)) * (1 - clamp01(who.mods.contagionResist || 0));
        who.fear = clamp(who.fear + spread * dt * (0.35 + o.fear / 130), 0, 100);
        if (who.bonds[o.id]) who.bonds[o.id].sawPanic++;
      }
    }
  }
  who.withAlly = withThem;
  if (withThem === 0) {
    who.aloneFor += dt;
    const solo = (who.mods.soloPanic || 0) * 0.5 + (sensOf(who, 'isolation') > 0 ? 0.35 : 0) + 0.12;
    const dark = room && room.light < 0.25 ? 1.5 : 1;
    who.fear = clamp(who.fear + solo * dark * dt * (1.3 - who.nerve * 0.5), 0, 100);
    /* loss of companions */
    for (const o of group) {
      if (o === who || o.state === 'expelled' || o.state === 'gone') continue;
      const seen = who.lastSeenAlly[o.id] ?? -99;
      if (world.t - seen > 34) {
        who.missingFor = Math.max(who.missingFor, world.t - seen);
        const ls = sensOf(who, 'loss');
        if (ls > 0) who.fear = clamp(who.fear + ls * 0.55 * dt, 0, 100);
        if (o.state === 'down' || o.state === 'fleeing') who.fear = clamp(who.fear + 0.5 * dt, 0, 100);
      } else who.missingFor = Math.min(who.missingFor, world.t - seen);
    }
  } else { who.aloneFor = 0; who.missingFor = 0; }
  if (world.rooms[who.room]?.salt > 0 && who.gear.salt?.placed) decay += 0.5;
  /* the house is frightening on its own: dark rooms and pooled dread press on them */
  let pressure = 0;
  if (room) {
    pressure += room.dread * 0.42;
    if (room.light < 0.26) pressure += 0.30 + who.darkSensitivity * 0.4 + Math.max(0, sensOf(who, 'darkness')) * 0.22;
    if (room.tags.includes('confined')) pressure += Math.max(0, sensOf(who, 'enclosed')) * 0.13;
    if (room.stain > 0.12) pressure += 0.1 + Math.max(0, sensOf(who, 'blood')) * 0.2;
    if (room.salt > 0) pressure -= 0.18;
    if (withThem === 0) pressure += 0.06;
  }
  pressure *= 1.25 - who.nerve * 0.55 - who.resolve * 0.35 + (who.mods.fearGain || 0) * 0.5 + (world.mods.fearGainMult || 0);
  who.fear = clamp(who.fear + pressure * dt, 0, 100);
  who.fear = clamp(who.fear - decay * dt * (withThem > 0 ? 1.15 : 1), 0, 100);
  /* thresholds */
  who.braced = Math.max(0, who.braced - dt);
  who.startle = Math.max(0, who.startle - dt * 0.55);
  who.shock = Math.max(0, who.shock - dt * 0.5);
  if (who.fear > 74) {
    who.panic = Math.min(3, who.panic + dt);
    if (who.rng.chance(0.12 * dt * 6) && who.freeze <= 0) who.freeze = who.rng.range(1.2, 3.4) * (1 - who.nerve * 0.5);
  } else who.panic = Math.max(0, who.panic - dt * 1.4);
  who.freeze = Math.max(0, who.freeze - dt);
  if (who.fear > 88 && who.gear.sedative?.uses > 0) {
    who.gear.sedative.uses--; who.fear = clamp(who.fear - (GEAR_BY_ID_ALL.sedative.calm * (1 + who.mods.calmAura * 0.2)), 0, 100);
    who.hurt = Math.max(who.hurt, 0); who.resolve = clamp01(who.resolve - 0.06);
    who.speak = 'I need - hold still.'; who.speakT = 2.4;
    for (const o of group) if (o !== who && o.room === who.room && o.gear.sedative?.uses > 0 && o.fear > 80) { o.gear.sedative.uses--; o.fear -= 22; }
  }
  if (who.freeze > 0 && who.fear > 80 && who.rng.chance(0.02)) {
    who.state = 'down'; who.downT = who.rng.range(4, 9);
  }
  /* scream: an audible event others perceive - fear is contagious through the house */
  if (who.startle > 0.72 && who.shout <= 0 && who.fear > 45) {
    who.shout = who.rng.range(5, 9);
    spawnStimulus(world, { kind: 'scream', room: who.room, x: who.x, y: who.y, tags: { voice: 0.8, noise: 1, shock: 0.5 }, salience: 0.9, fear: 0.34, evidence: 0.24, about: `${who.name} screaming`, ttl: 20 });
    who.speak = who.fear > 80 ? 'GET OFF ME!' : 'Somebody - in here!'; who.speakT = 2.2;
  }
  who.shout = Math.max(0, who.shout - dt);
  who.speakT = Math.max(0, who.speakT - dt);
  if (who.speakT <= 0) who.speak = null;
}

export function bond(who, other) {
  const b = who.bonds[other.id];
  if (!b) return 1;
  return clamp(0.55 + b.trust * 0.8 - b.blame * 0.5, 0.2, 1.7);
}
export function ensureBond(who, otherId) {
  return who.bonds[otherId] || (who.bonds[otherId] = { trust: 0.35, blame: 0, sawPanic: 0, helped: 0, lastHelp: -99 });
}

/* ---------------- gear ---------------- */
export function gearTick(world, who, dt) {
  const g = who.gear;
  const dark = world.rooms[who.room] ? world.rooms[who.room].light < 0.4 : false;
  who.light = 0;
  for (const id in g) {
    const it = g[id]; const def = GEAR_BY_ID_ALL[id];
    if (it.broken > 0) { it.broken -= dt; if (it.broken <= 0) { it.broken = 0; it.charge = Math.min(it.max, it.charge + 12); } continue; }
    if (it.max) {
      const drawing = it.active && (dark || id === 'streamrig' || id === 'vidcam');
      if (drawing) it.charge = clamp(it.charge - dt * (1 + (id === 'streamrig' ? 0.6 : 0)), 0, it.max);
      if (it.charge <= 0) { it.active = false; if (who.rng.chance(0.2)) who.speak = id === 'streamrig' ? 'Chat, the battery - no, no, no-' : 'Dead. Of course.'; who.speakT = 2; }
    }
    if (id === 'flashlight' || id === 'headlamp') { if (it.active && it.charge > 0) who.light += def.light * (1 - (world.rooms[who.room]?.light || 0) * 0.3); }
    if (id === 'phone' && it.active) who.light += 0.16;
    if (id === 'flare' && it.active && it.uses > 0) who.light += 0.8;
    /* cursed circuits: gear knocked out by the house */
    if (who.gearCurse > 0) { it.active = false; }
  }
  who.gearCurse = Math.max(0, (who.gearCurse || 0) - dt);
  if (who.gearCurse <= 0) { for (const id in g) if (!g[id].broken && g[id].charge > 0) g[id].active = true; }
  const room = world.rooms[who.room];
  if (room && who.light > 0) room.light = Math.max(room.light, Math.min(0.5, who.light * 0.35));
  /* deploying a salt line or a camera trap is a deliberate act - see ai.js */
  if (who.trapDeployed) { /* handled at deploy */ }
}

/* ---------------- evidence ---------------- */
export function captureEvidence(world, who, st, gain, group) {
  if (!st.evidence || st.evidence <= 0.05) return null;
  if (who.state !== 'active') return null;
  const clarity = clamp01(gain * (0.55 + st.salience * 0.6));
  if (clarity < 0.28) return null;
  const g = who.gear; let best = null;
  const options = [
    ['streamrig', 2.1, 'broadcast'], ['vidcam', 1.35, 'video'], ['camera', 0.85, 'photo'],
    ['thermal', 0.7, 'video'], ['phone', 0.6, 'photo'], ['recorder', 0.55, 'audio'], ['emf', 0.4, 'emf_log'], ['geiger', 0.35, 'log']
  ];
  for (const [gid, w, kind] of options) {
    const it = g[gid]; if (!it || !it.active || it.broken > 0) continue;
    if (it.max && it.charge <= 0) continue;
    if (gid === 'recorder' && !(st.tags?.voice || st.tags?.noise || st.tags?.shock)) continue;
    if (gid === 'thermal' && !(st.tags?.cold || st.tags?.shape || st.tags?.touch)) continue;
    if (gid === 'emf' && !(st.tags?.shape || st.tags?.motion || st.tags?.cold || st.tags?.wrong || st.tags?.voice)) continue;
    if (gid === 'phone' && !who.rng.chance(0.55)) continue;
    if (!best || w > best.w) best = { w, kind, gid };
  }
  if (!best) return null;
  if (!who.rng.chance(clamp01(0.4 + clarity * 0.7))) return null;
  const weight = round2(st.evidence * best.w * (1 + (who.mods.evidenceGain || 0)) * (0.7 + clarity * 0.6) * (world.mods.evidenceWeight || 1) * (1 + (world.mods.evidenceMult || 0)));
  if (weight <= 0.01) return null;
  const item = { kind: best.kind, weight, label: labelFor(best.kind, st), room: st.room, t: world.t, who: who.id };
  if (who.state === 'fleeing' || who.exitIntent) { /* they still keep it */ }
  who.carrying.evidence.push(item);
  who.evidenceWeight = round2(who.evidenceWeight + weight);
  if (best.kind === 'broadcast' || best.kind === 'video') {
    /* live material leaves the house instantly - the secrecy hit bypasses the cache */
    world.liveEvidence = round2((world.liveEvidence || 0) + weight * 0.85);
  }
  who.speak = best.kind === 'broadcast' ? 'CHAT. CHAT, DID YOU SEE THAT' : `${best.kind === 'photo' ? 'Got it.' : 'Recording - do not stop.'}`;
  who.speakT = 2;
  return item;
}
const labelFor = (kind, st) => ({
  photo: `photo: ${st.about || st.kind}`, video: `footage: ${st.about || st.kind}`,
  broadcast: `live clip: ${st.about || st.kind}`, audio: `EVP: ${st.about || st.kind}`,
  emf_log: `EMF log (${(st.room || '').replace(/_/g, ' ')})`, log: `sensor log: ${st.kind}`
}[kind] || kind);
const round2 = v => Math.round(v * 100) / 100;

/* ---------------- movement ---------------- */
export function navigate(world, who, toRoom, point, opts = {}) {
  const r = findRoute(world, who.room, toRoom, who);
  if (!r) { who.navFail++; return false; }
  who.queue = r.steps.map(s => ({ x: s.fromPoint.x, y: s.fromPoint.y, door: s.door, to: s.to, kind: s.kind }));
  who.goal = point ? { x: point.x, y: point.y, room: toRoom } : { x: world.rooms[toRoom].cx, y: world.rooms[toRoom].cy, room: toRoom };
  who.goalKind = opts.kind || null;
  who.navRoom = toRoom;
  who.navFail = 0;
  who.routeCost = r.cost;
  return true;
}

export function currentSpeed(world, who) {
  const base = 46 * who.speed;
  if (who.state === 'down' || who.freeze > 0 || who.grabbed > 0) return 0;
  let s = base;
  s *= 1 + who.fear / 240;
  if (who.panic > 0.4) s *= 1.22;
  if (who.state === 'fleeing') s *= 1.18;
  const room = world.rooms[who.room];
  if (room && room.light < 0.2) s *= 0.86 - who.darkSensitivity * 0.18;
  if (who.carrying.loot.length) s *= 0.9;
  if (who.carries) s *= 0.62;
  if (who.hurt > 0) s *= 0.75;
  if (who.climbing) s *= 0.55;
  return s;
}

export function travelTick(world, who, dt, hook) {
  if (who.grabbed > 0) { who.grabbed -= dt; who.jitter = Math.min(1, (who.jitter || 0) + dt); return; }
  who.jitter = Math.max(0, (who.jitter || 0) - dt * 1.6);
  /* soft separation, applied BEFORE walking so a crowd can never cancel someone's progress:
     bodies slide apart, but a shoulder is never stronger than a stride. */
  if (hook?.allies) {
    let px = 0, py = 0, n = 0;
    for (const o of hook.allies) {
      if (o === who || o.state === 'expelled' || o.state === 'gone' || o.state === 'kept') continue;
      if (o.room !== who.room) continue;
      const dd = dist(who.x, who.y, o.x, o.y);
      if (dd >= 22 || dd <= 0.01) continue;
      const push = Math.min((22 - dd) * 0.35, 5);
      px += ((who.x - o.x) / dd) * push; py += ((who.y - o.y) / dd) * push;
      n++;
    }
    if (n) {
      const room = world.rooms[who.room];
      const cap = Math.max(0.4, (room && room.w < 140 ? 1.4 : 2.2)) ;
      who.x += clamp(px / n * dt * 4, -cap, cap);
      who.y += clamp(py / n * dt * 4, -cap, cap);
    }
  }
  const speed = currentSpeed(world, who);
  const tgt = who.queue.length ? who.queue[0] : who.goal;
  if (!tgt) return;
  const dx = tgt.x - who.x, dy = tgt.y - who.y;
  const d = Math.hypot(dx, dy);
  if (d > 0.5) {
    const step = Math.min(d, speed * dt);
    who.x += (dx / d) * step; who.y += (dy / d) * step;
    who.face = Math.atan2(dy, dx);
    who.step += step;
    const stride = 16 + (who.panic > 0 ? 4 : 0);
    if (who.step - who.stride > stride) {
      who.stride = who.step;
      if (hook?.onFootfall) hook.onFootfall(world, who);
      const rm = world.rooms[who.room];
      if (rm) rm.footfall = Math.min(1.6, rm.footfall + 0.08);
    }
  }
  if (d <= (who.queue.length ? 11 : 13)) {
    if (who.queue.length) {
      const w = who.queue.shift();
      const dr = world.byId[w.door];
      if (dr) {
        const wasLocked = dr.locked > 0;
        if (dr.kind !== 'stair') { dr.open = true; dr.lastTouched = world.t; dr.swing = 1; }
        dr.noise = Math.max(dr.noise || 0, dr.hinge < 0.6 ? 0.8 : 0.35);
        if (wasLocked) { dr.forced = true; }
        let toRoom = w.to;
        if (dr.warp && world.t < dr.warp.until) toRoom = dr.warp.to;
        const fromR = who.room;
        who.floor = world.rooms[toRoom]?.floor ?? who.floor;
        who.room = toRoom;
        const room = world.rooms[toRoom];
        if (dr.warp) { who.x = room.cx; who.y = room.cy; who.disoriented = 4.5; spawnStimulus(world, { kind: 'wrongness', room: toRoom, x: who.x, y: who.y, tags: { space: 1, wrong: 0.6 }, salience: 0.5, fear: 0.3, evidence: 0.1, about: `${who.name} walked into the wrong room` }); }
        else { const onA = toRoom === dr.b; who.x = onA ? dr.bx : dr.ax; who.y = onA ? dr.by : dr.ay; }
        if (hook?.onDoor) hook.onDoor(world, who, dr, fromR, toRoom);
        if (dr.kind === 'stair' && hook?.onStairs) hook.onStairs(world, who, fromR, toRoom);
        const m = who.memory.rooms[toRoom] || (who.memory.rooms[toRoom] = { visits: 0, lastAt: -99, dread: 0, events: 0, fear: 0, hazard: 0, searched: 0, wrong: 0 });
        m.visits++; m.lastAt = world.t;
        if (!who.objectives.visited.includes(toRoom)) who.objectives.visited.push(toRoom);
      }
    } else {
      who.goal = null; who.arriveT = world.t;
      if (hook?.onArrive) hook.onArrive(world, who, who.goalKind);
    }
  }
  /* keep them inside the room they are in (except while crossing) */
  const room = world.rooms[who.room];
  if (room && !room.outside) {
    const pad = 12;
    who.x = clamp(who.x, room.x + pad, room.x + room.w - pad);
    who.y = clamp(who.y, room.y + pad, room.y + room.h - pad);
  } else if (room) { who.x = clamp(who.x, room.x + 8, room.x + room.w - 8); who.y = clamp(who.y, room.y + 8, room.y + room.h - 8); }
}

export function nearestExit(world, who, opts = {}) {
  const exits = world.meta.exitRooms;
  let best = null;
  for (const ex of exits) {
    const r = findRoute(world, who.room, ex, who);
    if (!r) continue;
    if (!best || r.cost < best.cost) best = { room: ex, cost: r.cost, route: r };
  }
  return best;
}

export function canSee(world, who, other) {
  if (other === who) return true;
  if (other.room !== who.room) return false;
  return dist(who.x, who.y, other.x, other.y) < 320;
}

export function groupStatus(group, world) {
  const active = group.filter(i => i.state === 'active' || i.state === 'fleeing' || i.state === 'down');
  const fleeing = group.filter(i => i.state === 'fleeing').length;
  const down = group.filter(i => i.state === 'down').length;
  const gone = group.filter(i => i.state === 'expelled' || i.state === 'gone' || i.state === 'escaped').length;
  const avg = active.length ? active.reduce((s, i) => s + i.fear, 0) / active.length : 0;
  return { active, fleeing, down, gone, avg, size: group.length, cohesion: active.length ? clamp01(1 - fleeing / active.length - down / active.length * 0.7) : 0 };
}

export function tryForce(world, who, doorId, dt) {
  const d = world.byId[doorId];
  if (!d) return false;
  const use = doorUsable(world, d, who);
  if (use.ok) return true;
  if (d.seal > 0) {
    d.jam = clamp01((d.jam || 0) + dt * (0.14 + who.breakPower * 0.5) * (1 + who.fear / 160));
    if (d.jam > 0.85) { d.seal = 0; spawnStimulus(world, { kind: 'crash', room: d.a, x: d.ax, y: d.ay, tags: { noise: 1, force: 0.6 }, salience: 0.8, fear: 0.25, evidence: 0.22, about: 'a sealed door gave way' }); world.mods.sealBreaks = (world.mods.sealBreaks || 0) + 1; }
    return false;
  }
  const skill = who.unlockSkill * (d.lockedBy === 'house' ? 0.85 : 1) + who.breakPower * 0.6;
  d.jam = clamp01((d.jam || 0) + dt * (0.12 + skill * 0.55));
  if (d.jam >= 1) {
    d.locked = 0; d.lockedBy = null; d.open = true; d.broken = true; d.jam = 1; d.jamUntil = world.t + 999;
    d.hinge = clamp01(d.hinge - 0.35);
    spawnStimulus(world, { kind: 'crash', room: d.a, x: d.ax, y: d.ay, tags: { noise: 1, force: 0.7, shock: 0.3 }, salience: 0.85, fear: 0.22, evidence: 0.3, about: 'a door broken through' });
    if (world.rooms[d.b]) spawnStimulus(world, { kind: 'crash', room: d.b, x: d.bx, y: d.by, tags: { noise: 0.8 }, salience: 0.5, fear: 0.15, evidence: 0.12, about: 'a door smashed' });
    who.speak = 'Clear!'; who.speakT = 1.6;
    return true;
  }
  return false;
}

/* searching / looting progress on a prop */
export function searchProp(world, who, propId, dt, rate = 1) {
  const p = world.props[propId];
  if (!p) return 0;
  p.searchProgress = clamp01((p.searchProgress || 0) + dt * (0.16 * rate) * (1 - who.fear / 240) * (world.rooms[p.room]?.light > 0.3 ? 1.15 : 0.8) / (world.mods.roomAmp?.[p.room]?.searchSlow || 1));
  return p.searchProgress;
}

export function childState(world) {
  return world.lostChild || (world.lostChild = { ...LOST_CHILD, found: false, carried: false, room: LOST_CHILD.hiddenIn, x: world.rooms[LOST_CHILD.hiddenIn]?.cx || 0, y: world.rooms[LOST_CHILD.hiddenIn]?.cy || 0 });
}

export function serializeIntruders(group) {
  return group.map(w => {
    const o = {};
    for (const k of ['id', 'name', 'arch', 'role', 'x', 'y', 'room', 'floor', 'face', 'state', 'fear', 'nerve', 'resolve', 'panic', 'freeze', 'braced', 'startle', 'shock', 'speed', 'fear', 'filedEvidence', 'evidenceWeight', 'aloneFor', 'missingFor', 'withAlly', 'navFail', 'gearCurse', 'disoriented', 'hurt', 'downT', 'carries', 'tetheredTo', 'ritualProgress', 'chant', 'haunted', 'debunkStreak', 'faithFed', 'greedSatisfied', 'sawKid', 'hasKid', 'speak', 'speakT', 'shout', 'stride', 'step', 'grabbed', 'jitter', 'exitIntent', 'trapDeployed', 'saltedRoom', 'routeCost', 'navRoom']) o[k] = w[k];
    o.palette = w.palette; o.traits = w.traits; o.mods = w.mods; o.stats = w.stats; o.fears = w.fears;
    o.gear = w.gear; o.carrying = w.carrying; o.bonds = w.bonds; o.lastSeenAlly = w.lastSeenAlly;
    o.memory = w.memory; o.knows = w.knows; o.suspects = w.suspects; o.objectives = w.objectives;
    o.queue = w.queue; o.goal = w.goal; o.goalKind = w.goalKind;
    o.action = w.action ? { id: w.action.id, t: w.action.t, dur: w.action.dur, params: w.action.params, commitT: w.action.commitT } : null;
    o.rngState = w.rng.state;
    return o;
  });
}
export function restoreIntruder(who, data) {
  Object.assign(who, data);
  who.rng.state = data.rngState || who.rng.state;
  if (!who.action) who.action = null;
  return who;
}

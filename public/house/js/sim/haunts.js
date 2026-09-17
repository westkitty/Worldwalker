/* THE HOUSE THAT HUNTS BACK - the haunt engine.  Every power here mutates world state
   that intruder perception reads on the next tick.  Costs, cooldowns, structural damage,
   evidence yield and the risk of overreaching are all resolved in one place. */
import { POWER_BY_ID, TAG_TO_FEAR } from '../data/powers.js';
import { clamp, clamp01 } from '../core/util.js';
import { spawnStimulus, addEffect, houseCanAct, effectsOfType, isWarded } from './world.js';
import { sensOf } from './intruder.js';

const SURGE_KEY = 'surge';

export function powerCost(game, pw, target) {
  const w = game.world;
  const roomId = target.room || (target.door ? w.byId[target.door]?.a : null) || (target.prop ? w.props[target.prop]?.room : null) || (target.intruder ? w.intruders.get(target.intruder)?.room : null);
  const room = roomId ? w.rooms[roomId] : null;
  let e = pw.energy;
  let ev = pw.evidence;
  let stab = pw.stability;
  const m = game.mods;
  e *= 1 + (m.costMult || 0);
  if (game.fury > 62) e *= 0.82;
  const amp = (m.roomAmp && room && m.roomAmp[room.id]) || {};
  if (amp.appCost && (pw.id === 'apparition')) e *= 1 + amp.appCost;
  if (pw.id === 'unhinge') e *= 1 + (m.warpCost || 0);
  if (pw.id === 'nudge' && amp.nudgeFree) e *= 0.45;
  if (game.stability < 40) e *= 1.25;
  if (game.surgeArmed) e *= 0.6;
  const outsideFocus = target.outsideFocus;
  if (outsideFocus) e *= 1.3;
  ev *= 1 + (m.evidenceMult || 0);
  if (game.fury > 62) ev *= 1.3;
  if (stabilityDamage(pw)) {
    stab *= 1 + (m.stabilitySoft || 0);
    if (pw.id === 'unhinge') stab *= 1 + (m.warpStab || 0);
    if (stab && game.stability < 25) stab *= 1.4;
  }
  return { energy: Math.max(0, Math.round(e)), evidence: ev, stability: stab, room: roomId };
}
const stabilityDamage = pw => pw.stability > 0;

export function canCast(game, id, target) {
  const pw = POWER_BY_ID[id];
  if (!pw) return { ok: false, why: 'unknown power' };
  if (!game.unlocked.has(id)) return { ok: false, why: 'not learned yet' };
  const cd = game.cooldowns[id] || 0;
  if (cd > 0) return { ok: false, why: `still gathering (${cd.toFixed(1)}s)` };
  const cost = powerCost(game, pw, target || {});
  if (game.energy < cost.energy) return { ok: false, why: 'not enough energy' };
  if (game.stability <= 6 && cost.stability > 3) return { ok: false, why: 'the house cannot spare the strength' };
  const roomId = resolveRoom(game, target);
  if (roomId) {
    const room = game.world.rooms[roomId];
    if (!room) return { ok: false, why: 'no such room' };
    if (room.outside) return { ok: false, why: 'beyond the walls' };
    if (isWarded(game.world, roomId) && pw.energy > 0 && id !== 'nudge' && id !== 'devour_records') return { ok: false, why: 'salt across the threshold' };
    if (room.ward > 0 && game.world.t < room.wardUntil && ['apparition', 'possess_object', 'bleed_walls', 'collapse'].includes(id)) return { ok: false, why: 'a rite holds this room' };
    if (id === 'seal_room' && room.sealBy === 'house') return { ok: false, why: 'already sealed' };
  }
  return { ok: true, cost };
}

export function resolveRoom(game, target) {
  const w = game.world;
  if (!target) return null;
  if (target.room) return target.room;
  if (target.door && w.byId[target.door]) {
    const d = w.byId[target.door];
    return game.selectedRoom === d.b ? d.b : d.a;
  }
  if (target.prop && w.props[target.prop]) return w.props[target.prop].room;
  if (target.intruder && w.intruders.get(target.intruder)) return w.intruders.get(target.intruder).room;
  return null;
}

/* ---------- main entry ---------- */
export function castPower(game, id, target, opts = {}) {
  const pw = POWER_BY_ID[id];
  const chk = canCast(game, id, target);
  if (!chk.ok) return { ok: false, why: chk.why };
  const w = game.world;
  const cost = chk.cost;
  const roomId = resolveRoom(game, target);
  const room = roomId ? w.rooms[roomId] : null;
  game.energy = clamp(game.energy - cost.energy, 0, game.energyMax);
  game.cooldowns[id] = pw.cooldown * (game.mods.cooldownMult || 1);
  if (cost.stability) game.addStability(-cost.stability, pw.id);
  let res = { ok: true, id, energy: cost.energy, evidence: 0, fear: 0, revealed: null, text: '', target: { room: roomId, door: target.door, prop: target.prop, intruder: target.intruder } };
  const surge = game.surgeArmed ? 1 + game.fury / 90 : 1;
  if (game.surgeArmed) { game.fury = Math.max(0, game.fury * 0.15); game.surgeArmed = false; }
  res.surge = surge > 1;

  const who = target.intruder ? w.intruders.get(target.intruder) : null;
  const door = target.door ? w.byId[target.door] : null;
  const prop = target.prop ? w.props[target.prop] : null;

  const emit = (rid, payload) => spawnStimulus(w, { ...payload, room: rid ?? roomId });

  switch (id) {
    case 'creak': {
      const n = 1 + Math.floor(game.rng.int(1, 2) * 0.9);
      for (let i = 0; i < n; i++) {
        emit(null, { kind: 'creak', x: room.cx + game.rng.range(-50, 50), y: room.cy + game.rng.range(-40, 40), tags: { noise: 0.8 }, salience: 0.42 * surge, fear: 0.1 * surge, evidence: 0.03, about: 'a board groaning', ttl: 18 });
      }
      room.dread = clamp(room.dread + 0.05, 0, 2.4);
      res.text = 'A board settles somewhere it should not.';
      break;
    }
    case 'slam_door': {
      const d = door || pickDoor(game, room, 'slam');
      if (!d) return fail(res, 'no door to reach');
      const wasOpen = d.open;
      d.open = false;   /* slamming always ends with the door shut */
      d.swing = 2; d.slamAt = w.t; d.noise = 1; d.hinge = clamp01(d.hinge - 0.08);
      d.lastTouched = w.t;
      const p = d.a === roomId ? d.ax : d.bx, q = d.a === roomId ? d.ay : d.by;
      emit(null, { kind: 'slam', x: p, y: q, tags: { noise: 1, shock: 0.7, watched: 0.4 }, salience: (wasOpen ? 0.95 : 0.78) * surge, fear: (wasOpen ? 0.45 : 0.34) * surge, evidence: cost.evidence * (wasOpen ? 1 : 0.8), about: wasOpen ? 'a door slammed shut' : 'a door banged in its frame', ttl: 22 });
      if (w.rooms[d.b] && d.b !== roomId) emit(d.b, { kind: 'slam', x: d.a === roomId ? d.bx : d.ax, y: d.a === roomId ? d.by : d.ay, tags: { noise: 0.8 }, salience: 0.6, fear: 0.2, evidence: cost.evidence * 0.4, about: 'a door slammed nearby' });
      if (d.hinge < 0.4 && game.rng.chance(0.3)) { d.broken = true; d.jam = 0.7; d.jamUntil = w.t + 40; res.text = 'The hinge gave way with it.'; }
      else res.text = 'The door goes to with a crack.';
      game.addFury(6 * surge);
      break;
    }
    case 'lock_door': {
      const d = door || pickDoor(game, room, 'lock');
      if (!d) return fail(res, 'no door to reach');
      if (d.kind === 'stair' && !(game.mods.stairLockable)) return fail(res, 'the stairs have no lock');
      d.locked = 1; d.lockedBy = 'house'; d.lockUntil = w.t + 46; d.open = false;
      emit(d.a, { kind: 'lock', x: d.ax, y: d.ay, tags: { trapped: 0.5, noise: 0.35 }, salience: 0.42, fear: 0.16 * surge, evidence: cost.evidence, about: 'a lock turning by itself' });
      if (w.rooms[d.b]) emit(d.b, { kind: 'lock', x: d.bx, y: d.by, tags: { trapped: 0.4, noise: 0.3 }, salience: 0.36, fear: 0.12, evidence: cost.evidence * 0.5, about: 'the far side of a door going quiet' });
      res.text = d.kind === 'stair' ? 'The stair gate drops.' : 'You throw the latch from the inside.';
      game.addFury(2.5);
      break;
    }
    case 'snuff_light': {
      const kill = [];
      for (const pid of room.props) { const p = w.props[pid]; if (p.light) { p.state.off = true; kill.push(p); if (game.rng.chance(0.22 * (1 + (game.mods.darkAmp || 0)))) { p.state.burned = true; p.broken = true; } } }
      room.switchOn = false; room.light = Math.min(room.light, 0.12); room.lightBroken = kill.length > 0;
      room.dread = clamp(room.dread + 0.16 + (game.mods.darkAmp ? 0.12 : 0), 0, 2.4);
      emit(null, { kind: 'dark', x: room.cx, y: room.cy, tags: { dark: 1, noise: 0.25 }, salience: 0.7 * surge, fear: 0.34 * surge, evidence: cost.evidence, about: 'the lights going out', ttl: 24 });
      res.revealed = { kind: 'darkness', room: room.id };
      res.text = kill.length ? 'Every fitting in the room dies at once.' : 'The room goes the colour of a shut eye.';
      game.addFury(4 * surge);
      break;
    }
    case 'nudge': {
      const p = prop || pickMovable(game, room);
      if (!p) return fail(res, 'nothing loose in there');
      const dx = game.rng.range(-46, 46), dy = game.rng.range(-38, 38);
      p.x = clamp(p.x + dx, w.rooms[p.room].x + 10, w.rooms[p.room].x + w.rooms[p.room].w - p.w - 10);
      p.y = clamp(p.y + dy, w.rooms[p.room].y + 10, w.rooms[p.room].y + w.rooms[p.room].h - p.h - 10);
      p.moved = true; p.state.moved = true; p.rot = (p.rot || 0) + game.rng.range(-0.5, 0.5);
      p.vel = { x: dx * 1.6, y: dy * 1.6 };
      const isDoll = p.draw === 'doll' || p.draw === 'dollhouse' || p.draw === 'crib' || p.draw === 'rocking_horse';
      emit(p.room, { kind: 'displace', x: p.x + p.w / 2, y: p.y + p.h / 2, tags: { wrong: 1, motion: isDoll ? 0.4 : 0.7, [isDoll ? 'doll' : '']: isDoll ? 1 : 0 }, salience: 0.62 * surge, fear: (isDoll ? 0.46 : 0.3) * surge, evidence: cost.evidence * (isDoll ? 1.15 : 1), about: `${p.type.replace(/_/g, ' ')} is in a different place`, ttl: 30 });
      if (isDoll) for (const o of w.intruders.values()) if (o.room === p.room) o.fear = clamp(o.fear + 12 * Math.max(0.2, sensOf(o, 'dolls')), 0, 100);
      res.revealed = isDoll ? { kind: 'dolls' } : { kind: 'watched' };
      res.text = `${p.type.replace(/_/g, ' ')} - not where it was.`;
      game.addFury(4.5);
      break;
    }
    case 'cold_spot': {
      const dur = 16 * (1 + (game.mods.holdDuration || 0) * 0.5);
      addEffect(w, { type: 'cold_spot', room: room.id, duration: dur, power: 1 * surge, x: room.cx, y: room.cy });
      room.temp = 0.2; room.dread = clamp(room.dread + 0.22, 0, 2.4);
      emit(null, { kind: 'cold', x: room.cx, y: room.cy, tags: { cold: 1, presence: 0.8, dark: 0.2 }, salience: 0.55 * surge, fear: 0.3 * surge, evidence: cost.evidence, about: 'breath fogging in the room', ttl: dur });
      for (const o of w.intruders.values()) {
        if (o.room !== room.id) continue;
        const amp = (game.mods.roomAmp?.[room.id]?.coldResolve || 0);
        if (amp) o.resolve = clamp01(o.resolve - amp * 0.05);
      }
      res.revealed = { kind: 'watched' };
      res.text = 'The room goes cold enough to see their own breathing.';
      game.addFury(4);
      break;
    }
    case 'flicker_power': {
      const dur = 26;
      addEffect(w, { type: 'curse', room: room.id, duration: dur, power: 1 });
      let hit = 0;
      for (const o of w.intruders.values()) {
        if (o.room !== room.id) continue;
        o.gearCurse = dur;
        for (const gid in o.gear) { const g = o.gear[gid]; if (g.max) { g.charge = Math.max(0, g.charge - 26); g.active = false; hit++; } if (gid === 'camera' || gid === 'vidcam' || gid === 'streamrig') g.broken = Math.max(g.broken, 12); }
      }
      emit(null, { kind: 'surge', x: room.cx, y: room.cy, tags: { tech: 1, noise: 0.4 }, salience: 0.5, fear: 0.18 * surge, evidence: cost.evidence, about: 'every screen in the room went white', ttl: dur });
      res.text = hit ? `${hit} pieces of their gear go dead at once.` : 'The wiring spits, though nobody in there is holding anything.';
      game.addFury(3);
      break;
    }
    case 'possess_object': {
      const p = prop || pickMovable(game, room, true);
      if (!p) return fail(res, 'nothing solid to wear');
      const dur = 8 * (1 + (game.mods.holdDuration || 0) * 0.5);
      p.animated = dur;
      addEffect(w, { type: 'possess', room: p.room, prop: p.id, duration: dur, power: 1.35 * surge, x: p.x, y: p.y });
      const isDoll = ['doll', 'dollhouse', 'crib', 'rocking_horse', 'toy'].includes(p.draw);
      emit(p.room, { kind: 'object', x: p.x + p.w / 2, y: p.y + p.h / 2, tags: { motion: 1, shock: 0.9, wrong: 0.8, [isDoll ? 'doll' : 'motion']: isDoll ? 1 : 0 }, salience: 1.0 * surge, fear: 0.85 * surge, evidence: cost.evidence, about: `${p.type.replace(/_/g, ' ')} moving on its own`, ttl: dur + 12 });
      /* a thrown object can hurt someone, which is loud and terrible and very documentable */
      const near = [...w.intruders.values()].filter(o => o.room === p.room && Math.hypot(o.x - p.x, o.y - p.y) < 62);
      if (near.length && game.rng.chance(0.45)) {
        const v = game.rng.pick(near);
        v.hurt = 3; v.fear = clamp(v.fear + 22, 0, 100); v.state = v.fear > 84 ? 'down' : v.state; if (v.state === 'down') v.downT = 4;
        w.damage = (w.damage || 0) + 0.2;
        emit(p.room, { kind: 'injury', x: v.x, y: v.y, tags: { injury: 1, blood: 0.4, shock: 1 }, salience: 1, fear: 0.5, evidence: 0.4, about: `${v.name} struck by a thrown object`, ttl: 20 });
        res.text = `${p.type.replace(/_/g, ' ')} goes across the room and takes ${v.name} with it.`;
        game.addStability(-2, 'impact');
      } else res.text = `${p.type.replace(/_/g, ' ')} lifts, turns, and looks at them.`;
      if (isDoll) for (const o of w.intruders.values()) if (o.room === p.room) o.fear = clamp(o.fear + 16 * Math.max(0.15, sensOf(o, 'dolls')), 0, 100);
      res.revealed = { kind: isDoll ? 'dolls' : 'watched', detail: 'who stands their ground' };
      game.addFury(12 * surge);
      break;
    }
    case 'bleed_walls': {
      const dur = 48;
      addEffect(w, { type: 'bleed', room: room.id, duration: dur, power: 1.1 * surge });
      room.stain = Math.max(room.stain, 0.55 + 0.2 * surge);
      room.wet = Math.max(room.wet, 0.4);
      emit(null, { kind: 'blood', x: room.cx, y: room.cy, tags: { blood: 1, wrong: 0.5, water: 0.35 }, salience: 0.88 * surge, fear: 0.66 * surge, evidence: cost.evidence, about: 'dark fluid running out of the plaster', ttl: dur });
      res.revealed = { kind: 'blood' };
      res.text = 'The plaster gives. It will not wipe off.';
      game.addFury(9);
      break;
    }
    case 'whisper': {
      if (!who) return fail(res, 'nobody to speak to');
      emit(who.room, { kind: 'voice', x: who.x, y: who.y, tags: { voice: 1, name: 0.9, watched: 0.5 }, salience: 0.58 * surge, fear: 0.4 * surge, evidence: cost.evidence, about: `a voice saying ${who.name}'s name`, target: who.id, ttl: 20 });
      const dom = dominantFear(game, who);
      res.revealed = { who: who.id, kind: dom.kind, confidence: 0.7 };
      who.braced = Math.max(who.braced, 2);
      if (who.gear.spiritbox?.active) {
        who.speak = `It knows about ${dom.word}.`; who.speakT = 3;
        for (const o of w.intruders.values()) if (o !== who && o.room === who.room) o.fear = clamp(o.fear - 3, 0, 100);
        res.evidence = 0.3;
        res.text = `They answer back through the box: "${dom.word}". The whole room hears it.`;
        game.addStability(-1, 'exposure');
      } else {
        res.text = `You say one word to ${who.name}. They stop walking.`;
        game.addFury(5);
      }
      break;
    }
    case 'mimic_voice': {
      /* find a companion to imitate: someone they care about */
      const speakers = [...w.intruders.values()];
      let victim = null, bestScore = -1;
      for (const s of speakers) {
        if (s.room === roomId) continue;
        for (const o of speakers) {
          if (o === s || o.room === roomId) continue;
          const b = o.bonds[s.id]?.trust ?? 0.3;
          const sc = b + Math.max(0, sensOf(o, 'loss')) * 1.5 + (o.mods.rescue || 0);
          if (sc > bestScore) { bestScore = sc; victim = { imitator: s, listener: o }; }
        }
      }
      const imitator = victim?.imitator, listener = victim?.listener;
      const label = imitator ? `${imitator.name}'s voice` : 'a voice they do not know';
      emit(null, { kind: 'lure', x: room.cx, y: room.cy, tags: { voice: 1, lure: 1, name: 0.8 }, salience: 0.72 * surge, fear: 0.34 * surge, evidence: cost.evidence, about: `${label} calling from ${room.name}`, payload: { ally: imitator?.id }, ttl: 26 });
      if (listener) { listener.fear = clamp(listener.fear + 6, 0, 100); res.revealed = { who: listener.id, kind: 'loss', confidence: 0.5 }; }
      res.text = `${label} calls out of an empty room.`;
      game.addFury(6);
      break;
    }
    case 'seal_room': {
      const dur = 34 * (1 + (game.mods.holdDuration || 0) * 0.5);
      room.sealUntil = w.t + dur; room.sealBy = 'house';
      const sealedDoors = [];
      for (const did of room.doors) { const d = w.byId[did]; d.seal = 1; d.sealUntil = w.t + dur; sealedDoors.push(d); addEffect(w, { type: 'seal', room: d.a === room.id ? d.a : d.b, door: d.id, duration: dur, power: 1 }); }
      emit(null, { kind: 'seal', x: room.cx, y: room.cy, tags: { trapped: 1, enclosed: 0.9, dark: 0.4, wrong: 0.4 }, salience: 0.8 * surge, fear: 0.55 * surge, evidence: cost.evidence, about: `black pitch in every frame in ${room.name}`, ttl: dur });
      const inside = [...w.intruders.values()].filter(o => o.room === room.id);
      for (const o of inside) { o.trappedBy = sealedDoors[0]?.id; o.fear = clamp(o.fear + 8 + Math.max(0, sensOf(o, 'enclosed')) * 16, 0, 100); }
      res.revealed = inside.length ? { who: inside[0].id, kind: 'enclosed', confidence: 0.55 } : null;
      res.text = `Pitch sets in the frames. ${inside.length ? inside.length + ' in there with it.' : 'Nobody in there to find it out.'}`;
      game.addFury(9);
      break;
    }
    case 'unhinge': {
      const d = door || pickDoor(game, room, 'warp');
      if (!d) return fail(res, 'no passage to bend');
      const candidates = Object.keys(w.rooms).filter(r => r !== d.a && r !== d.b && !w.rooms[r].outside && w.rooms[r].floor === w.rooms[d.a].floor);
      const to = game.rng.pick(candidates.length ? candidates : Object.keys(w.rooms).filter(r => !w.rooms[r].outside && r !== d.a));
      const dur = 54 * (1 + (game.mods.warpDuration || 0));
      d.warp = { to, until: w.t + dur, from: d.b };
      addEffect(w, { type: 'warp', room: d.a, door: d.id, duration: dur, power: 1.2 });
      emit(d.a, { kind: 'warp', x: d.ax, y: d.ay, tags: { space: 1, wrong: 1, lost: 0.8 }, salience: 0.66 * surge, fear: 0.42 * surge, evidence: cost.evidence, about: `the doorway in ${w.rooms[d.a].name} opens onto somewhere else`, ttl: dur });
      game.stability = clamp(game.stability - cost.stability, 0, 100);
      res.revealed = { kind: 'enclosed', detail: 'who loses their bearings' };
      res.text = `You bend the passage: ${w.rooms[d.a].name} now opens into ${w.rooms[to].name}.`;
      game.log('architecture', `${d.label || 'a passage'} now leads to ${w.rooms[to].name} for ${Math.round(dur)}s.`);
      game.addFury(11);
      break;
    }
    case 'apparition': {
      const dur = 9;
      addEffect(w, { type: 'apparition', room: room.id, duration: dur, power: 1.6 * surge, x: room.cx, y: room.cy });
      room.dread = clamp(room.dread + 0.6, 0, 2.4);
      emit(null, { kind: 'shape', x: room.cx, y: room.cy, tags: { shape: 1, watched: 1, shock: 1, presence: 0.9, doll: 0.3 }, salience: 1.25 * surge, fear: 1.0 * surge, evidence: cost.evidence, about: `a standing shape in ${room.name}`, ttl: dur + 22 });
      const watchers = [...w.intruders.values()].filter(o => o.room === room.id);
      let emboldened = 0;
      for (const o of watchers) {
        if (o.stats.faith > 0.6 || o.mods.devout) { o.fear = clamp(o.fear - 8, 0, 100); o.faithFed += 1; emboldened++; o.resolve = clamp01(o.resolve + 0.06); }
        if (o.gear.crucifix && o.gear.crucifix.active) { o.fear = clamp(o.fear - 6, 0, 100); }
        if (o.mods.debunk && o.rng.chance(0.3)) { o.fear = clamp(o.fear - 10, 0, 100); o.debunkStreak++; }
      }
      res.revealed = { kind: 'watched', detail: watchers.length ? 'who believes' : null };
      res.text = emboldened ? `You stand there and ${emboldened} of them thank you for it.` : 'You stand in the room and let them look.';
      game.addFury(18 * surge);
      if (emboldened) res.evidence = 0.35;
      break;
    }
    case 'memory_horror': {
      if (!who) return fail(res, 'nobody to show it to');
      const sec = game.secretOf(who);
      emit(who.room, { kind: 'memory', x: who.x, y: who.y, tags: { memory: 1, grief: 1, voice: 0.8, name: 1 }, salience: 0.9 * surge, fear: 0.95 * surge, evidence: cost.evidence, about: `${who.name} hearing something only they can hear`, target: who.id, ttl: 24 });
      const vuln = 1 + (who.mods.memoryVuln || 0) + (who.mods.grief ? 0.4 : 0);
      who.fear = clamp(who.fear + 26 * vuln * surge, 0, 100);
      who.speak = sec.short; who.speakT = 3.4;
      if (who.fear > 78 && game.rng.chance(0.5)) { who.state = 'down'; who.downT = 5 + game.rng.range(0, 4); }
      else if (game.rng.chance(0.4)) { who.exitIntent = true; who.state = 'fleeing'; }
      res.revealed = { who: who.id, kind: sec.kind, confidence: 1, secret: true };
      res.text = `${who.name} hears ${sec.short}`;
      game.addFury(14);
      game.addStability(-1.5, 'reach');
      break;
    }
    case 'shadow_grasp': {
      if (!who) return fail(res, 'nobody close enough to hold');
      const dur = 5 * (1 + (game.mods.holdDuration || 0));
      who.grabbed = dur; who.fear = clamp(who.fear + 14, 0, 100);
      addEffect(w, { type: 'grasp', room: who.room, duration: dur, power: 1, x: who.x, y: who.y, who: who.id });
      emit(who.room, { kind: 'touch', x: who.x, y: who.y, tags: { touch: 1, trapped: 0.8, isolated: 0.9, shock: 0.6 }, salience: 0.95 * surge, fear: 0.62 * surge, evidence: cost.evidence, about: `${who.name} held by something in the dark`, ttl: dur + 16 });
      res.revealed = { who: who.id, kind: 'isolation', confidence: 0.6 };
      res.text = `Cold hands on ${who.name}. They cannot move.`;
      game.addFury(10);
      break;
    }
    case 'collapse': {
      const dur = 12;
      room.dread = clamp(room.dread + 0.5, 0, 2.4);
      room.collapsed = (room.collapsed || 0) + 1;
      w.collapsed[room.id] = (w.collapsed[room.id] || 0) + 1;
      for (const pid of room.props) { const p = w.props[pid]; if (p.breakable && game.rng.chance(0.4)) { p.broken = true; p.state.broken = true; } else if (p.movable) { p.moved = true; p.state.moved = true; p.vel = { x: game.rng.range(-70, 70), y: game.rng.range(-50, 50) }; } }
      emit(null, { kind: 'collapse', x: room.cx, y: room.cy, tags: { force: 1, injury: 1, shock: 1, earth: 0.8, noise: 1 }, salience: 1.3 * surge, fear: 0.8 * surge, evidence: cost.evidence, about: `part of the ceiling came down in ${room.name}`, ttl: dur + 20 });
      const inside = [...w.intruders.values()].filter(o => o.room === room.id);
      for (const o of inside) {
        if (game.rng.chance(0.5)) { o.hurt = 4; o.state = 'down'; o.downT = 6 + game.rng.range(0, 6); o.fear = clamp(o.fear + 26, 0, 100); }
        else o.fear = clamp(o.fear + 18, 0, 100);
      }
      game.addStability(-Math.max(0, cost.stability), 'collapse');
      if (game.stability < 30) { room.dread = clamp(room.dread + 0.3, 0, 2.4); }
      res.revealed = { kind: 'enclosed', detail: 'who runs and who stays to help' };
      res.text = `A joist gives. Dust, and ${inside.length ? inside.length + ' in the room with it.' : 'nobody.'}`;
      game.addFury(20);
      break;
    }
    case 'devour_records': {
      let destroyed = 0, weight = 0;
      const c = w.caches[room.id];
      if (c?.items.length) { weight += c.items.reduce((s, i) => s + i.weight, 0); destroyed += c.items.length; c.items.length = 0; }
      for (const o of w.intruders.values()) {
        if (o.room !== room.id) continue;
        if (o.carrying.evidence.length) {
          const cost2 = 0.55 + game.rng.range(0, 0.25);
          const keep = [];
          for (const it of o.carrying.evidence) { if (game.rng.chance(cost2)) { weight += it.weight; destroyed++; } else keep.push(it); }
          o.carrying.evidence = keep;
        }
        if (o.trapId && w.rooms[room.id].traps.length) { w.rooms[room.id].traps.length = 0; destroyed++; }
      }
      for (const t of room.traps) { t.dead = true; }
      const before = game.caseStrength;
      game.destroyEvidence(weight, room.id);
      emit(null, { kind: 'spoil', x: room.cx, y: room.cy, tags: { wrong: 0.6, loss: 0.9 }, salience: 0.5, fear: 0.12, evidence: 0.02, about: 'every recording in the room went to mush', ttl: 18 });
      for (const o of w.intruders.values()) if (o.room === room.id) { o.fear = clamp(o.fear + 6, 0, 100); o.speak = game.rng.pick(['The card is blank.', 'It recorded nothing. Nothing.', 'Gone. All of it gone.']); o.speakT = 2.6; }
      res.text = destroyed ? `${destroyed} file${destroyed > 1 ? 's' : ''} rot${destroyed > 1 ? '' : 's'} to nothing. Case strength ${before.toFixed(1)} → ${game.caseStrength.toFixed(1)}.` : 'Nothing to spoil in there. Yet.';
      game.addFury(3);
      break;
    }
    case 'feed': {
      const gain = room.dread;
      room.dread = clamp(room.dread - 0.85, 0, 2.4);
      game.energy = clamp(game.energy + gain * 26, 0, game.energyMax);
      game.addStability(gain * 6, 'feed');
      emit(null, { kind: 'feed', x: room.cx, y: room.cy, tags: { cold: 0.3 }, salience: 0.2, fear: -0.05, evidence: 0.02, about: 'the room suddenly feeling ordinary', ttl: 10 });
      res.text = `The house digests. +${Math.round(gain * 26)} energy, plaster settling.`;
      break;
    }
    case 'drain_fury': {
      if (game.fury < 30) return fail(res, 'not enough anger to spend');
      game.surgeArmed = true;
      res.text = 'Anger banked. The next thing you do will be remembered.';
      break;
    }
    default: return fail(res, 'the house does not know how');
  }

  /* evidence, backfire risk, and observation credit are resolved for every power */
  res.evidence = clamp01((res.evidence || 0) + (cost.evidence || 0) * (res.surge ? 1.25 : 1));
  if (pw.risk && room) {
    const detectors = [...w.intruders.values()].filter(o => o.room === room.id && (o.gear.emf?.active || o.gear.geiger?.active || o.gear.thermal?.active));
    const backfire = pw.risk * (1 + detectors.length * 0.55 + (game.fury > 80 ? 0.35 : 0) - (game.mods.outburstRisk ? 0 : 0));
    if (game.rng.chance(clamp01(backfire * 0.5))) {
      res.backfire = true;
      res.evidence = clamp01(res.evidence + 0.35);
      game.addStability(-cost.stability * 0.6 - 1.5, 'backlash');
      for (const o of detectors) { o.braced = Math.max(o.braced, 6); o.knows.housePatterns = (o.knows.housePatterns || 0) + 1; }
      game.log('risk', `${pw.name} overreached - the spike was logged before it landed.`);
    }
  }
  if (res.evidence > 0 && room) game.addRoomEvidence(room.id, res.evidence, id);
  return res;
}

function fail(res, why) { res.ok = false; res.why = why; return res; }

function pickDoor(game, room, want) {
  if (!room) return null;
  const w = game.world;
  const list = room.doors.map(id => w.byId[id]).filter(d => d);
  if (!list.length) return null;
  if (want === 'lock') return game.rng.pick(list.filter(d => d.kind === 'door') .length ? list.filter(d => d.kind === 'door') : list);
  if (want === 'warp') { const c = list.filter(d => d.kind === 'door' && !d.warp); return c.length ? game.rng.pick(c) : game.rng.pick(list); }
  const unslammed = list.filter(d => !d.broken);
  return game.rng.pick(unslammed.length ? unslammed : list);
}
function pickMovable(game, room, heavy) {
  if (!room) return null;
  const w = game.world;
  const list = room.props.map(id => w.props[id]).filter(p => p.movable && !p.taken && (!heavy || p.draw !== 'rug'));
  if (!list.length) return null;
  const dolls = list.filter(p => ['doll', 'dollhouse', 'crib', 'rocking_horse'].includes(p.draw));
  if (dolls.length && game.rng.chance(0.45)) return game.rng.pick(dolls);
  return game.rng.pick(list);
}
function dominantFear(game, who) {
  let best = { kind: 'darkness', word: 'the dark', v: 0 };
  for (const k in who.fears) { const v = who.fears[k]; if (v > best.v) best = { kind: k, v, word: fearWord(k) }; }
  if (best.v <= 0.1) best = { kind: 'darkness', v: 0.3, word: 'the dark' };
  return best;
}
const fearWord = k => ({ darkness: 'the dark', isolation: 'being alone', blood: 'the blood', dolls: 'the dolls', enclosed: 'small rooms', voices: 'the voices', watched: 'the watching', loss: 'losing the others', drowning: 'the water', insects: 'what scratches in the walls' }[k] || k);
export { dominantFear, fearWord };

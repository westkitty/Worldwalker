/* THE HOUSE THAT HUNTS BACK - autonomous intruder brains.
   Utility AI on top of a small state machine.  Every action reads and writes real
   world state; nothing here waits for the player.  No rendering, no DOM. */
import { clamp, clamp01, dist } from '../core/util.js';
import { doorUsable, findRoute, spawnStimulus, isWarded, houseCanAct } from './world.js';
import { navigate, travelTick, nearestExit, tryForce, searchProp, bond, ensureBond, sensOf, childState } from './intruder.js';
import { LOST_CHILD } from '../data/scenarios.js';

const DECIDE = 0.55;

export function aiTick(world, who, dt, ctx) {
  if (who.state === 'expelled' || who.state === 'gone' || who.state === 'escaped' || who.state === 'entering') return;
  if (who.state === 'down') {
    who.downT -= dt;
    who.fear = clamp(who.fear - dt * 2.2, 22, 100);
    if (who.downT <= 0 && who.fear < 88) { who.state = 'active'; who.freeze = 1.2; who.speak = 'I am up. I am up.'; who.speakT = 2; }
    return;
  }
  who.disoriented = Math.max(0, (who.disoriented || 0) - dt);
  const a = who.action;
  if (a) {
    a.t += dt;
    const done = tickAction(world, who, a, dt, ctx);
    if (done) { who.action = null; who.think = 0.05; }
    else if (interrupted(world, who, a, ctx)) { who.action = null; who.think = 0; }
    else return;
  }
  who.think -= dt;
  if (who.think > 0) return;
  who.think = DECIDE * (who.panic > 0 ? 0.55 : 1) * world.rng.range(0.7, 1.3);
  const cands = plan(world, who, ctx);
  if (!cands.length) { who.think = 1.2; return; }
  let chosen = null;
  for (const c of cands) if (!chosen || c.score > chosen.score) chosen = c;
  /* stubbornness: keep going if the current plan is still decent */
  const keepBias = who.action ? 0.25 : 0;
  if (who.action) {
    const cur = cands.find(c => c.id === who.action.id);
    if (cur && cur.score < chosen.score * (0.78 - keepBias) === false && chosen.score / Math.max(0.001, cur?.score || 0) < 1.55) chosen = cur || chosen;
  }
  /* a little noise keeps eight people from doing the same thing */
  const pool = cands.filter(c => c.score > chosen.score * 0.62);
  const pick = world.rng.weighted(pool.map(c => [c, Math.pow(Math.max(0.02, c.score), 2.1 + who.fear / 40)]));
  startAction(world, who, pick || chosen, ctx);
}

/* ---------------- candidate generation ---------------- */
function plan(world, who, ctx) {
  const out = [];
  const room = world.rooms[who.room];
  const fear = who.fear / 100, alone = who.withAlly === 0;
  const push = (id, score, data) => { if (score > 0.012) out.push({ id, score, data }); };

  /* 1. their mission keeps pulling them forward */
  const stim = bestStimulus(world, who);
  const noise = stim ? clamp01(stim.salience * (stim.room === who.room ? 1 : 0.72) * (1 - (world.t - stim.t) / 22)) : 0;
  const obj = ctx.game.objectiveNext(world, who, ctx);
  if (obj) {
    const duty = 0.5 + who.resolve * 0.55 + (who.mods.greed || 0) * 0.25 + (who.mods.parent || 0) * 0.7 + obj.pull;
    const dread = obj.room ? (world.rooms[obj.room]?.dread || 0) : 0;
    const fearPenalty = fear * (1.15 - who.nerve * 0.5) * (dread > 0.8 ? 1.35 : 1);
    /* a loud house is distracting: that is the whole point of a creak in an empty room */
    push('advance', clamp((duty - fearPenalty * 0.5) * (1 - 0.45 * noise), 0.05, 3.2), obj);
  }
  /* 2. stimuli: noises, voices, things that moved */
  if (stim) {
    const curious = 0.42 + who.stats.curiosity * 0.85 + (who.mods.curiosity || 0);
    const bravePull = 1 - fear * (1.2 - who.nerve);
    const wants = who.state === 'fleeing' ? -0.4 : 0;
    const urgency = (stim.tags?.voice ? 0.5 : 0) + (stim.about && /scream|scream|call|shout/.test(stim.about) ? 0.7 : 0) + (stim.tags?.loss || stim.tags?.trapped ? 0.35 : 0);
    push('investigate', clamp(curious * (0.35 + stim.gainScore * 1.15) * (bravePull * 0.55 + 0.55) + urgency + wants, 0.02, 2.9), { stimId: stim.id, room: stim.room, x: stim.x, y: stim.y, kind: stim.kind, about: stim.about });
    push('document', clamp(0.3 + who.stats.tech * 0.5 + stim.evidence * 1.6 - fear * 0.5, 0.02, 2.0), { stimId: stim.id, room: stim.room, x: stim.x, y: stim.y, evidence: stim.evidence, about: stim.about });
  }
  /* 3. fear does things to judgement */
  if (fear > 0.5 || who.panic > 0.2) {
    const exit = nearestExit(world, who);
    const urgency = (fear - 0.45) * (2.6 - who.resolve * 1.5) + who.panic * 0.8 - (who.mods.parent || 0) * (who.missingFor > 20 ? 1.2 : 0);
    const dutyHold = obj ? (0.3 + obj.lockIn * 0.8) * who.resolve : 0;
    if (exit) push('flee', clamp(urgency * 2.1 - dutyHold, 0.02, 3.4), exit);
    if (alone && who.withAlly === 0) {
      const pal = nearestAlly(world, who, ctx.group);
      if (pal) push('regroup', clamp(0.5 + (who.mods.regroup || 0) + fear * 0.9 - who.stats.nerve * 0.3, 0.02, 2.4), pal);
    }
    if (who.panic > 1 && !obj) {
      const hid = hideSpot(world, who);
      if (hid) push('hide', clamp(0.5 + fear * 1.4 - who.resolve, 0.02, 2.2), hid);
    }
  }
  /* 4. helping: someone is down, or has gone quiet */
  const victim = helpTarget(world, who, ctx.group);
  if (victim) {
    const urge = 0.5 + (who.mods.rescue || 0) * 0.9 + who.stats.charisma * 0.5 + (who.mods.parent || 0) - fear * (0.55 - who.nerve * 0.3);
    push('help', clamp(urge, 0.02, 2.6), { id: victim.id, room: victim.room, x: victim.x, y: victim.y, down: victim.state === 'down' });
  }
  /* 5. evidence work */
  if (who.carrying.evidence.length) {
    const cache = ctx.game.cacheRef;
    if (cache && who.state === 'active' && fear < 0.75) {
      const [cr] = cache.split(':');
      push('file', clamp(0.5 + who.stats.greed * 0.2 + (who.mods.careful ? 0.5 : 0.25) - fear * 0.6, 0.02, 1.8), { room: cr, ref: cache, n: who.carrying.evidence.length });
    }
  }
  const cacheRoom = ctx.game.cacheRef ? ctx.game.cacheRef.split(':')[0] : null;
  if (cacheRoom && world.caches[cacheRoom]?.items.length && ctx.game.objectiveKind === 'evidence') {
    push('raid_cache', clamp(0.35 + who.stats.greed * 0.4 + (world.rooms[who.room]?.id === cacheRoom ? 1.2 : 0) - fear * 0.4, 0.02, 1.6), { room: cacheRoom });
  }
  /* 6. countermeasures */
  const dreadHere = room ? room.dread : 0;
  if (who.gear.salt && !who.gear.salt.placed && dreadHere > 0.7 && who.state === 'active') {
    push('ward', clamp(0.5 + who.stats.tech * 0.7 + dreadHere * 0.5 - fear * 0.3, 0.02, 2.0), { room: who.room });
  }
  if (who.gear.tripod_trap && !who.gear.tripod_trap.placed && (dreadHere > 0.5 || who.objectives.visited.length > 3)) {
    push('trap', clamp(0.45 + who.stats.tech * 0.8 - fear * 0.25, 0.02, 1.8), { room: who.room });
  }
  if (who.gear.sage && dreadHere > 0.85) push('cleanse', clamp(0.5 + dreadHere * 0.6 - fear * 0.2, 0.02, 1.6), { room: who.room });
  if (who.gear.flare?.uses > 0 && room && room.light < 0.25 && fear > 0.4) push('flare', clamp(0.6 + fear - who.resolve * 0.3, 0.02, 2.0), { room: who.room });
  if (who.gear.crowbar && who.trappedBy) push('break', clamp(0.9 + who.fear / 140, 0.02, 2.2), { door: who.trappedBy });
  /* 7. the room they are standing in still has things in it */
  const searchable = roomThings(world, who);
  if (searchable) push('search', clamp(0.36 + who.stats.greed * 0.9 + who.stats.curiosity * 0.4 + (who.mods.greed || 0) * 0.4 - fear * 0.35, 0.02, 2.1), searchable);
  /* 8. the phenomenon itself can be answered */
  const fx = liveHaunt(world, who);
  if (fx) {
    const fight = 0.4 + who.stats.aggression * 0.9 + who.breakPower * 0.6 + (who.mods.skeptic || 0) * 0.5 - fear * 0.75;
    push('defend', clamp(fight, 0.02, 2.3), fx);
    if ((who.mods.skeptic || 0) > 0.3 || who.stats.tech > 0.55) push('debunk', clamp(0.4 + (who.mods.debunk || 0) + who.stats.tech * 0.5 - fear * 0.5, 0.02, 1.9), fx);
  }
  /* 9. the house can be fed on: vandalism & dares while they are bored */
  if (fear < 0.4 && who.stats.curiosity > 0.6) {
    const rm = exploreTarget(world, who, ctx);
    if (rm) push('explore', clamp(0.42 + who.stats.curiosity * 0.7 - fear * 0.5 - who.aloneFor * 0.02, 0.02, 1.9), rm);
  }
  if (who.arch === 'thrill_seeker' && fear < 0.55 && who.rng.chance(0.25)) push('vandalize', clamp(0.34 + (1 - fear) * 0.5, 0.02, 1.4), { room: who.room });
  /* 10. nothing to do: keep their nerve up */
  push('wait', clamp(0.16 + fear * 0.35 - (who.action ? 0 : 0), 0.02, 0.9), { room: who.room });
  if (fear > 0.28 && who.stats.charisma > 0.5 && who.withAlly > 0) push('rally', clamp(0.4 + who.stats.charisma * 0.7 - fear, 0.02, 1.6), { room: who.room });
  if (who.gear.phone && who.commsCd === undefined && (fear > 0.72 || who.hurt > 1)) {
    push('call_help', clamp(0.5 + fear - who.resolve * 0.4, 0.02, 1.7), { room: who.room });
  }
  /* 11. stuck behind the house's own work */
  if (who.navFail > 0 || who.trappedBy) push('reroute', clamp(0.6 + fear * 0.6, 0.02, 2.0), { room: who.room });
  if (who.exitIntent && !nearestExit(world, who) && !world.mods.noWindows) {
    const win = windowOf(world, who);
    if (win) push('climb_out', clamp(1.4 + fear, 0.02, 3), win);
  }
  return out;
}

function bestStimulus(world, who) {
  let best = null;
  for (const st of world.stimuli) {
    if (st.about === null) continue;
    const g = who.room === st.room ? 1 : 0.5;
    if (who.seenStim === st.id) continue;
    let w = st.salience * g;
    if (st.tags?.voice) w *= 1 + Math.max(0, sensOf(who, 'voices'));
    if (st.tags?.lure) w *= 1 + (who.mods.rescue || 0) * 0.8 + (who.bonds[st.payload?.ally]?.trust || 0);
    if (st.tags?.shape && who.fear > 60) w *= 0.5;
    if (w > (best?.w || 0)) best = { ...st, w, gainScore: w };
  }
  if (!best) return null;
  who.seenStim = best.id;
  return best;
}
function nearestAlly(world, who, group) {
  let best = null;
  for (const o of group) {
    if (o === who || o.state === 'expelled' || o.state === 'gone') continue;
    const r = findRoute(world, who.room, o.room, who);
    if (!r) continue;
    if (!best || r.cost < best.cost) best = { room: o.room, x: o.x, y: o.y, id: o.id, cost: r.cost };
  }
  return best;
}
function helpTarget(world, who, group) {
  for (const o of group) {
    if (o === who || o.state === 'expelled' || o.state === 'gone') continue;
    if (o.state === 'down' || (o.grabbed > 0)) {
      if (who.room !== o.room && !findRoute(world, who.room, o.room, who)) continue;
      return o;
    }
  }
  for (const o of group) {
    if (o === who || o.state === 'expelled' || o.state === 'gone') continue;
    const seen = who.lastSeenAlly[o.id] ?? -99;
    if (world.t - seen > 52 && (who.mods.rescue || 0) + who.stats.charisma > 0.55) return o;
  }
  return null;
}
function hideSpot(world, who) {
  const room = world.rooms[who.room];
  if (!room) return null;
  for (const pid of room.props) {
    const p = world.props[pid];
    if (p.hideable && !p.taken) return { prop: p.id, room: p.room, x: p.x + p.w / 2, y: p.y + p.h / 2 };
  }
  const closet = ['linen', 'pantry', 'attic', 'nook'];
  for (const c of closet) {
    if (c === who.room) return { prop: null, room: c, x: world.rooms[c].cx, y: world.rooms[c].cy };
    if (findRoute(world, who.room, c, who)) return { prop: null, room: c, x: world.rooms[c].cx, y: world.rooms[c].cy };
  }
  return null;
}
function roomThings(world, who) {
  const room = world.rooms[who.room];
  if (!room) return null;
  let best = null;
  for (const pid of room.props) {
    const p = world.props[pid];
    if (!p.container && !p.objective) continue;
    if ((p.searchProgress || 0) > 0.99) continue;
    const w = (p.objective ? 2 : 0.6) + (p.value || 0) - (p.opened ? 1.4 : 0);
    if (w > (best?.w || 0)) best = { prop: p.id, room: p.room, x: p.x + p.w / 2, y: p.y + p.h / 2, w };
  }
  if (room.stain > 0.2 && who.stats.tech > 0.4) best = best || { prop: null, room: room.id, x: room.cx, y: room.cy, w: 0.6, sample: true };
  return best;
}
function liveHaunt(world, who) {
  let best = null;
  for (const f of world.effects) {
    if (f.until <= world.t) continue;
    if (!['possess', 'apparition', 'bleed', 'cold_spot'].includes(f.type)) continue;
    if (f.room !== who.room) continue;
    if (!best || f.power > best.power) best = { fx: f.id, type: f.type, room: f.room, prop: f.prop, power: f.power, x: f.x || world.rooms[f.room].cx, y: f.y || world.rooms[f.room].cy };
  }
  return best;
}
function windowOf(world, who) {
  const room = world.rooms[who.room];
  if (!room || room.windows < 1 || room.floor === -1) return null;
  for (const pid of room.props) { const p = world.props[pid]; if (p.draw === 'window') return { prop: p.id, room: room.id, x: p.x, y: p.y, window: true }; }
  return { prop: null, room: room.id, x: room.x + 12, y: room.cy, window: true };
}
function exploreTarget(world, who, ctx) {
  const room = world.rooms[who.room];
  const cands = [];
  for (const did of room.doors) {
    const d = world.byId[did];
    const other = d.a === room.id ? d.b : d.a;
    const r = world.rooms[other];
    if (!r || r.outside) continue;
    const m = who.memory.rooms[other];
    let score = 1;
    if (!m) score += 1.5 + who.stats.curiosity;
    else score -= m.visits * 0.42 + m.events * 0.05;
    if (r.dread > 0.7) score -= (r.dread - 0.7) * (1.4 - who.nerve);
    if (r.light < 0.2) score -= who.darkSensitivity * 0.9;
    const use = doorUsable(world, d, who);
    if (!use.ok) score -= 1.6;
    if (score > 0) cands.push([other, score]);
  }
  if (!cands.length) return null;
  const pick = world.rng.weighted(cands);
  const r = world.rooms[pick];
  return { room: pick, x: r.cx + world.rng.range(-40, 40), y: r.cy + world.rng.range(-30, 30) };
}

/* ---------------- action lifecycle ---------------- */
function startAction(world, who, c, ctx) {
  who.action = { id: c.id, score: c.score, t: 0, dur: 0, params: c.data || {}, log: [] };
  const p = c.data || {};
  const go = (room, point, kind) => { if (room && (room !== who.room || point)) navigate(world, who, room, point, { kind }); };
  switch (c.id) {
    case 'advance': {
      const o = p;
      who.action.label = o.label || 'their errand';
      go(o.room, o.point, 'advance');
      who.action.dur = 40;
      break;
    }
    case 'investigate':
      go(p.room, { x: p.x, y: p.y }, 'stim');
      who.action.dur = 26; who.action.label = `checking ${p.about || p.kind}`;
      who.braced = Math.max(who.braced, 2);
      break;
    case 'explore':
      go(p.room, { x: p.x, y: p.y }, 'explore'); who.action.dur = 22; who.action.label = 'looking around'; break;
    case 'document':
      who.action.dur = 2.4; who.action.label = 'recording it'; break;
    case 'regroup':
      go(p.room, { x: p.x, y: p.y }, 'ally'); who.action.dur = 26; who.action.label = 'finding the others'; break;
    case 'help':
      go(p.room, { x: p.x, y: p.y }, 'help'); who.action.dur = 30; who.action.label = 'going back for someone'; break;
    case 'flee': {
      who.exitIntent = true; who.state = 'fleeing';
      go(p.room, p.point || null, 'exit'); who.action.dur = 45; who.action.label = 'out';
      break;
    }
    case 'file': go(p.room, null, 'file'); who.action.dur = 12; who.action.label = 'filing what they found'; break;
    case 'raid_cache': go(p.room, null, 'raid'); who.action.dur = 12; who.action.label = 'at the evidence box'; break;
    case 'ward': who.action.dur = 4.5; who.action.label = 'pouring a salt line'; break;
    case 'trap': who.action.dur = 4; who.action.label = 'setting a camera'; break;
    case 'cleanse': who.action.dur = 5; who.action.label = 'smudging the room'; break;
    case 'flare': who.action.dur = 2.2; who.action.label = 'a flare'; break;
    case 'search': who.action.dur = 20; who.action.label = 'going through things'; if (p.room) navigate(world, who, p.room, p.prop ? { x: p.x, y: p.y } : null, { kind: 'search' }); break;
    case 'defend': who.action.dur = 4.5; who.action.label = 'swinging at it'; break;
    case 'debunk': who.action.dur = 4.2; who.action.label = 'explaining it away'; break;
    case 'vandalize': who.action.dur = 5.5; who.action.label = 'breaking something'; break;
    case 'wait': who.action.dur = world.rng.range(1.2, 3.4); who.action.label = 'catching breath'; break;
    case 'rally': who.action.dur = 4.2; who.action.label = 'talking them down'; break;
    case 'call_help': who.action.dur = 6; who.action.label = 'on the phone'; break;
    case 'break': who.action.dur = 12; who.action.label = 'on a locked door'; break;
    case 'reroute': who.action.dur = 6; who.action.label = 'finding another way'; break;
    case 'hide':
      if (p.prop) { const pr = world.props[p.prop]; if (pr) { pr.occupied = who.id; who.hiddenIn = pr.id; } }
      go(p.room, { x: p.x, y: p.y }, 'hide');
      who.action.dur = world.rng.range(9, 18); who.action.label = 'hiding';
      break;
    case 'climb_out': who.action.dur = 7; who.action.label = 'at the window'; break;
    default: who.action.dur = 3;
  }
  who.actionT = world.t;
  if (ctx?.events) ctx.events('act', { who, act: c.id });
}

function interrupted(world, who, a, ctx) {
  if (a.id === 'flee' || a.id === 'help' || a.id === 'break' || a.id === 'climb_out') return false;
  const fearJump = who.fear > 86 && a.id !== 'defend';
  if (fearJump && world.t - (who.actionT || 0) > 1) return true;
  if (a.id !== 'investigate' && a.id !== 'explore' && a.id !== 'wait' && a.id !== 'rally') return false;
  /* a strong new event near them is worth abandoning boredom for */
  for (const st of world.stimuli) {
    if (st.heardBy[who.id] !== 1) continue;
    if (st.t <= (who.lastStimSeen || 0)) continue;
    if (st.salience > 0.55 && (who.room === st.room || Math.abs((world.rooms[st.room]?.dread || 0)) > 0.2)) {
      who.lastStimSeen = st.t;
      return who.fear < 70 && st.salience > 0.62;
    }
  }
  return false;
}

function tickAction(world, who, a, dt, ctx) {
  const p = a.params || {};
  travelTick(world, who, dt, { onFootfall: ctx.onFootfall, onDoor: ctx.onDoor, onStairs: ctx.onStairs, allies: ctx.group, onArrive: (w, h, kind) => onArrive(w, h, kind, ctx) });
  const room = world.rooms[who.room];
  const nearGoal = !who.queue.length && !who.goal;
  switch (a.id) {
    case 'advance': {
      if (p.kind === 'leave') { who.exitIntent = true; who.state = 'fleeing'; if (!who.queue.length && !who.goal) { const ex = nearestExit(world, who); if (ex) navigate(world, who, ex.room, null, { kind: 'exit' }); } if (world.rooms[who.room]?.outside) { ctx.game.onExit(world, who, ctx); return true; } if (a.t > a.dur) { who.exitIntent = false; return true; } break; }
      if (p.needsArrival) {
        if (nearGoal) {
          ctx.game.objectiveArrive(world, who, p, ctx);
          /* arriving in the right room is not the same as doing the work: if this objective
             still wants something here, go through the room instead of spinning on arrival */
          const stillWants = (p.kind === 'find_child' && !ctx.game.objective.rescueFound)
            || (p.kind === 'loot' && p.prop && world.props[p.prop] && !world.props[p.prop].taken)
            || (p.kind === 'gather' && (room?.searched || 0) < 2.2)
            || (p.kind === 'review' && who.fear < 70);
          if (stillWants) {
            const things = roomThings(world, who);
            if (things) { a.id = 'search'; a.params = things; a.t = 0; a.dur = 20; return false; }
          }
          return true;
        }
      } else if (nearGoal || a.t > a.dur) { ctx.game.objectiveArrive(world, who, p, ctx); return true; }
      break;
    }
    case 'investigate': {
      if (nearGoal) {
        who.braced = Math.max(who.braced, 3);
        a.scan = (a.scan || 0) + dt;
        if (room) { room.searched = Math.min(3, room.searched + dt * 0.08); }
        /* look at the source, then decide whether to stay */
        if (a.scan > 1.6) {
          const loud = who.fear > 62 || (room && room.dread > 1.5);
          if (loud && who.rng.chance(0.7)) { who.trappedBy = null; return true; }
          const things = roomThings(world, who);
          if (things) { a.id = 'search'; a.params = things; a.t = 0; a.dur = 18; return false; }
          return true;
        }
      } else if (a.t > a.dur) return true;
      break;
    }
    case 'explore':
      if (nearGoal) {
        if (room) { room.searched = Math.min(3, room.searched + 0.12); who.memory.rooms[who.room] = who.memory.rooms[who.room] || {}; who.memory.rooms[who.room].visits++; }
        return a.t > 2;
      }
      if (a.t > a.dur) return true;
      break;
    case 'document': {
      if (dist(who.x, who.y, p.x ?? who.x, p.y ?? who.y) > 90 && p.room === who.room) return true;
      a.t >= 1 && (a.done = true);
      if (a.t > 1.1) {
        const st = world.stimuli.find(s => s.id === p.stimId);
        const item = ctx.game.captureFrom(world, who, st || { room: who.room, x: who.x, y: who.y, evidence: 0.25, salience: 0.5, about: p.about, tags: { wrong: 1 } });
        a.done = !!item;
        return true;
      }
      break;
    }
    case 'regroup':
      if (nearGoal || a.t > a.dur) {
        for (const o of ctx.group) if (o !== who && o.room === who.room) { ensureBond(who, o.id).trust = clamp01((who.bonds[o.id]?.trust || 0) + 0.08); }
        who.fear = clamp(who.fear - 4, 0, 100);
        return true;
      }
      break;
    case 'help': {
      const victim = ctx.group.find(o => o.id === p.id);
      if (!victim || victim.state === 'expelled' || victim.state === 'gone') return true;
      if (victim.room === who.room && dist(victim.x, victim.y, who.x, who.y) < 34) {
        a.assist = (a.assist || 0) + dt;
        if (a.assist > 2.4) {
          if (victim.state === 'down') { victim.state = 'active'; victim.fear = clamp(victim.fear - 12, 0, 100); victim.freeze = 1.5; }
          who.fear = clamp(who.fear - 5, 0, 100);
          ensureBond(victim, who.id).helped++;
          ensureBond(who, victim.id).trust = clamp01((who.bonds[victim.id]?.trust || 0) + 0.25);
          who.speak = 'Up. Both of us, up.'; who.speakT = 2;
          if (who.gear.firstaid) { victim.hurt = 0; }
          if (victim.hurt > 0 || victim.fear > 70) { who.action = { id: 'escort', t: 0, dur: 40, params: { id: victim.id } }; who.carries = victim.id; return true; }
          return true;
        }
      } else if (a.t > a.dur) return true;
      break;
    }
    case 'escort': {
      const victim = ctx.group.find(o => o.id === a.params.id);
      if (!victim) { who.carries = null; return true; }
      travelTick(world, who, dt, { onFootfall: ctx.onFootfall, allies: ctx.group, onArrive: () => { } });
      victim.x = who.x; victim.y = who.y; victim.room = who.room; victim.floor = who.floor;
      if (!victim.queue.length && !victim.goal) {
        const ex = nearestExit(world, who);
        if (ex) navigate(world, victim, ex.room, null, { kind: 'exit' });
        else { who.carries = null; return true; }
      }
      if (who.room && world.rooms[who.room].outside) { ctx.game.onExit(world, victim, ctx); ctx.game.onExit(world, who, ctx); who.carries = null; return true; }
      if (a.t > a.dur) { who.carries = null; return true; }
      break;
    }
    case 'flee': {
      if (room?.outside) { ctx.game.onExit(world, who, ctx); return true; }
      if (a.t > a.dur) { who.exitIntent = false; return true; }
      const stuck = !who.queue.length && !who.goal && a.t > 2.5;
      if (stuck) {
        const ex = nearestExit(world, who);
        if (!ex) {
          const w = windowOf(world, who);
          if (w && !world.mods.noWindows) { a.id = 'climb_out'; a.params = w; a.t = 0; a.dur = 7; break; }
          who.trappedBy = who.roomDoorBlocked || null;
          a.id = 'break'; a.params = { door: who.trappedBy }; a.t = 0; a.dur = 14;
        } else navigate(world, who, ex.room, null, { kind: 'exit' });
        who.actionT = world.t;
      }
      break;
    }
    case 'climb_out': {
      if (a.t > 2.2 && !a.judged) {
        a.judged = true;
        const room2 = world.rooms[who.room];
        const height = room2.floor === 2 ? 1.5 : room2.floor === 1 ? 1 : 0.6;
        who.climbing = 1;
        if (who.rng.chance(0.18 + height * 0.4 - who.mods.moveSpeed * 0.2)) {
          who.hurt = 2; who.fear = clamp(who.fear + 22, 0, 100);
          spawnStimulus(world, { kind: 'crash', room: who.room, x: who.x, y: who.y, tags: { noise: 1, injury: 0.7 }, salience: 0.8, fear: 0.3, evidence: 0.3, about: 'someone out of a window' });
          if (world.props[a.params.prop]) { world.props[a.params.prop].broken = true; world.props[a.params.prop].state.broken = true; }
          room2.stain = Math.max(room2.stain, 0.3);
        } else {
          const exitRoom = who.room === 'nook' ? 'roof' : null;
          who.escapeRoute = true;
          if (exitRoom) { who.room = exitRoom; who.x = world.rooms[exitRoom].cx; who.y = world.rooms[exitRoom].cy; ctx.game.onExit(world, who, ctx); return true; }
          /* drop down outside on this floor: walk them to the nearest gate */
          const ex = nearestExit(world, who);
          if (ex) { navigate(world, who, ex.room, null, { kind: 'exit' }); who.state = 'fleeing'; return false; }
          ctx.game.onExit(world, who, ctx); return true;
        }
        who.climbing = 0;
      }
      if (a.t > a.dur) return true;
      break;
    }
    case 'file': {
      if (nearGoal || a.t > 6) {
        const n = who.carrying.evidence.length;
        for (const it of who.carrying.evidence) ctx.game.fileEvidence(world, p.ref, it, who);
        who.carrying.evidence = [];
        who.filedEvidence += n;
        who.fear = clamp(who.fear - 4 * Math.min(3, n), 0, 100);
        who.speak = n > 1 ? `${n} in the file. Keep moving.` : 'Filed.'; who.speakT = 2;
        return true;
      }
      break;
    }
    case 'raid_cache': {
      const c = world.caches[p.room];
      if (!c || !c.items.length) return true;
      if (nearGoal || a.t > 3) {
        const grab = c.items.splice(0, 3);
        who.carrying.evidence.push(...grab);
        who.speak = 'We have it in the box - give me the card.'; who.speakT = 2;
        return true;
      }
      break;
    }
    case 'ward': {
      if (a.t > a.dur * 0.6 && !a.placed) {
        a.placed = true;
        if (room && houseCanAct(world, room.id) !== null) {
          room.salt = 1; room.saltUntil = world.t + 78; who.gear.salt.placed = true; who.gear.salt.uses = Math.max(0, who.gear.salt.uses - 1);
          spawnStimulus(world, { kind: 'ward', room: room.id, x: who.x, y: who.y, tags: { rite: 1 }, salience: 0.3, fear: 0.05, evidence: 0.12, about: 'salt across the threshold' });
          ctx.game.onWard(world, room.id, 78, who);
          who.speak = 'Line is set. Nobody steps over it.'; who.speakT = 2.4;
        }
      }
      return a.t > a.dur;
    }
    case 'trap': {
      if (a.t > a.dur * 0.6 && !a.placed) {
        a.placed = true;
        who.gear.tripod_trap.placed = true;
        if (room) room.traps.push({ t: world.t, ttl: 150, x: who.x, y: who.y, owner: who.id });
        ctx.game.onTrap(world, who, room?.id);
        who.speak = 'Trap is armed, by the door.'; who.speakT = 2;
      }
      return a.t > a.dur;
    }
    case 'cleanse': {
      if (a.t > a.dur * 0.5 && !a.done) {
        a.done = true;
        if (room) { room.dread = clamp(room.dread - 0.85, 0, 2.4); room.stain = Math.max(0, room.stain - 0.4); }
        for (const o of ctx.group) if (o.room === who.room) o.fear = clamp(o.fear - 6, 0, 100);
        ctx.game.onCleanse(world, who, room?.id);
      }
      return a.t > a.dur;
    }
    case 'flare': {
      if (a.t > 1 && !a.lit) {
        a.lit = true;
        who.gear.flare.uses--; who.gear.flare.active = true; who.flareT = 26;
        if (room) { room.light = Math.max(room.light, 0.85); room.fire = 0.5; room.dread = Math.max(0, room.dread - 0.3); }
        for (const o of ctx.group) if (o.room === who.room) o.fear = clamp(o.fear - 10, 0, 100);
        spawnStimulus(world, { kind: 'light', room: who.room, x: who.x, y: who.y, tags: { light: 1 }, salience: 0.5, fear: -0.12, evidence: 0.18, about: 'a flare, and the room in it' });
        ctx.game.onLight(world, who, room?.id);
      }
      return a.t > a.dur;
    }
    case 'search': {
      const pr = p.prop ? world.props[p.prop] : null;
      if (pr) {
        if (dist(who.x, who.y, p.x, p.y) > 42) {
          if (a.t > 2) { navigate(world, who, pr.room, { x: p.x, y: p.y }, { kind: 'search' }); a.t = Math.min(a.t, a.dur - 3); }
          if (a.t > a.dur - 1) return true;
          break;
        }
        const prog = searchProp(world, who, pr.id, dt, 1 + who.stats.tech * 0.6);
        if (prog >= 1 || a.t > a.dur) {
          pr.opened = true; pr.state.opened = true; pr.searchProgress = 1;
          a.done = true;
          ctx.game.onSearch(world, who, pr, ctx);
          return true;
        }
      } else if (room && room.stain > 0.2) {
        who.fear = clamp(who.fear + 3 * dt, 0, 100);
        if (a.t > 2.5) { ctx.game.captureFrom(world, who, { room: room.id, x: who.x, y: who.y, evidence: 0.5, salience: 0.6, about: 'sample of the stain', tags: { blood: 1 } }); return true; }
      } else return true;
      break;
    }
    case 'defend': {
      const fx = world.effects.find(f => f.id === p.fx);
      if (!fx) return true;
      if (a.t > 1.2) {
        const who2 = who;
        fx.until = Math.max(world.t, fx.until - dt * 3.5);
        who2.braced = Math.max(who2.braced, 4);
        who2.resolve = clamp01(who2.resolve + dt * 0.05);
        who2.fear = clamp(who2.fear - dt * 3.4, 0, 100);
        if (fx.type === 'possess') {
          const pr = world.props[fx.prop];
          if (pr) { pr.animated = 0; pr.vel = { x: 0, y: 0 }; }
          fx.until = 0;
        }
        world.damage = (world.damage || 0) + dt * 0.05;
        if (a.t > a.dur) { ctx.game.onResist(world, who2, fx, ctx); return true; }
      }
      break;
    }
    case 'debunk': {
      const fx = world.effects.find(f => f.id === p.fx);
      if (!fx) return true;
      if (a.t > a.dur - 0.4) {
        who.debunkStreak++;
        who.fear = clamp(who.fear - 14, 0, 100);
        who.resolve = clamp01(who.resolve + 0.08);
        who.speak = ['Draught. Old pipes. Nothing more.', 'Settling joists. Textbook.', 'We are tired. That is all this is.'][world.rng.int(0, 2)];
        who.speakT = 2.8;
        ctx.game.onDebunk(world, who, fx, ctx);
        return true;
      }
      break;
    }
    case 'vandalize': {
      if (a.t > 2.4 && !a.hit) {
        a.hit = true;
        if (room) {
          const breakable = room.props.map(id => world.props[id]).filter(x => x.breakable && !x.broken);
          const target = breakable.length ? world.rng.pick(breakable) : null;
          if (target) { target.broken = true; target.state.broken = true; spawnStimulus(world, { kind: 'crash', room: room.id, x: target.x, y: target.y, tags: { noise: 0.8 }, salience: 0.5, fear: 0.05, evidence: 0.16, about: `${who.name} broke a thing` }); }
          ctx.game.onVandal(world, who, room.id, 3.4);
          who.fear = clamp(who.fear - 5, 0, 100);
        }
      }
      return a.t > a.dur;
    }
    case 'wait': {
      who.fear = clamp(who.fear - dt * (1.1 + who.nerve * 1.4), 0, 100);
      who.resolve = clamp01(who.resolve + dt * 0.012);
      return a.t > a.dur;
    }
    case 'rally': {
      if (a.t > a.dur) {
        for (const o of ctx.group) {
          if (o === who || o.room !== who.room || o.state === 'expelled') continue;
          const b = bond(who, o);
          const effect = (4 + who.stats.charisma * 9) * b * (1 - o.fear / 260);
          o.fear = clamp(o.fear - effect, 0, 100);
          ensureBond(o, who.id).trust = clamp01((o.bonds[who.id]?.trust || 0) + 0.1);
        }
        who.fear = clamp(who.fear - 3, 0, 100);
        who.speak = 'Stay together. Nobody goes off alone.'; who.speakT = 2.4;
        return true;
      }
      break;
    }
    case 'call_help': {
      if (a.t > a.dur - 0.3 && !a.called) {
        a.called = true;
        who.commsCd = 90;
        ctx.game.onCallForHelp(world, who, ctx);
        who.speak = 'Yeah - 13 Hollowmere Lane. Send someone who believes us.'; who.speakT = 3;
        return true;
      }
      break;
    }
    case 'break': {
      const d = p.door ? world.byId[p.door] : null;
      const target = d || nextBlockingDoor(world, who);
      if (!target) return true;
      who.trappedBy = target.id;
      if (dist(who.x, who.y, target.a === who.room ? target.ax : target.bx, target.a === who.room ? target.ay : target.by) > 34) {
        const pt = target.a === who.room ? { x: target.ax, y: target.ay } : { x: target.bx, y: target.by };
        navigate(world, who, who.room, pt, { kind: 'door' });
        who.goal = pt; who.queue = [];
        break;
      }
      if (tryForce(world, who, target.id, dt * (1 + who.panic * 0.7))) {
        who.trappedBy = null; who.speak = 'Got it. Keep up.'; who.speakT = 1.6;
        who.belief = clamp01((who.belief || 0) + 0.12);
        return true;
      }
      if (a.t > a.dur) { who.trappedBy = null; return true; }
      break;
    }
    case 'reroute': {
      const goalRoom = who.navRoom && who.navRoom !== who.room ? who.navRoom : (p.room || who.room);
      const r = findRoute(world, who.room, goalRoom, who);
      if (r) { who.action = null; return false; }
      who.trappedBy = who.roomDoorBlocked || null;
      if (who.trappedBy) { a.id = 'break'; a.params = { door: who.trappedBy }; a.t = 0; a.dur = 12; }
      else return true;
      break;
    }
    case 'hide': {
      if (a.t > 3) {
        who.fear = clamp(who.fear - dt * (2.4 + who.nerve * 2), 0, 100);
        const pal = ctx.group.filter(o => o !== who && o.room === who.room && o.state === 'active').length;
        if (who.fear < 34 || pal > 1 || a.t > a.dur) { if (who.hiddenIn && world.props[who.hiddenIn]) world.props[who.hiddenIn].occupied = null; who.hiddenIn = null; return true; }
      }
      break;
    }
    default: return a.t > a.dur;
  }
  /* doors they pass through: fear makes them shut the house behind them */
  if (room && who.fear > 52 && who.queue.length === 0 && who.goal === null) {
    for (const did of room.doors) { const d = world.byId[did]; if (d.open && d.kind === 'door' && dist(d.ax, d.ay, who.x, who.y) < 40 && who.rng.chance(0.02)) { d.open = false; d.swing = 1; } }
  }
  return false;
}

function nextBlockingDoor(world, who) {
  const room = world.rooms[who.room];
  if (!room) return null;
  for (const did of room.doors) {
    const d = world.byId[did];
    const use = doorUsable(world, d, who);
    if (!use.ok && (d.locked > 0 || d.seal > 0 || d.broken)) return d;
  }
  who.roomDoorBlocked = null;
  return null;
}

function onArrive(world, who, kind, ctx) {
  if (kind === 'stim') ctx.events?.('arrive_stim', { who });
  if (kind === 'advance') ctx.game.objectiveArrive(world, who, who.action?.params || {}, ctx);
}

/* the house can push a person around without them deciding anything */
export function forceMove(world, who, room, point) {
  navigate(world, who, room, point, { kind: 'forced' });
  who.action = null; who.think = 0.4;
}

export { nextBlockingDoor };

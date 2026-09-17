/* THE HOUSE THAT HUNTS BACK - boot + input + the loop.  The simulation is not here:
   game.update() owns the clock, this file only decides how often it is allowed to run. */
import { Game, loadMeta, saveMeta, writeRun, readRun, clearSave, DEFAULT_META } from './sim/game.js';
import { createView, PLAN } from './render/view.js';
import { createAudio } from './audio/audio.js';
import { createUI } from './ui/ui.js';
import { POWER_BY_ID } from './data/powers.js';
import { SCENARIOS } from './data/scenarios.js';
import { titleCase, clockLabel, clamp, fmt } from './core/util.js';

const memoryStorage = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };
const storage = (() => { try { const s = window.localStorage; s.setItem('__hthb', '1'); s.removeItem('__hthb'); return s; } catch { return memoryStorage(); } })();

const root = document.getElementById('app');
const canvas = document.getElementById('view');
const audio = createAudio({ volume: 0.8 });
let game, view, ui, tutorial;

/* ---------------- stimuli are the sound + caption channel ---------------- */
const KIND_SOUND = {
  creak: 'creak', steps: 'step', footfall: 'step', stairs: 'creak', door_close: 'door_close', slam: 'slam', crash: 'glass',
  scream: 'scream', voice: 'whisper', voices: 'whisper', whisper: 'whisper', cold: 'cold', dark: 'sting', darkness: 'sting',
  shape: 'apparition', apparition: 'apparition', collapse: 'collapse', object: 'glass', displace: 'device', displacement: 'device',
  lock: 'lock', seal: 'seal', warp: 'warp', ward: 'device', light: 'device', outburst: 'slam', wrongness: 'sting',
  intent: 'ui', found: 'device', enter: 'door_close', memory: 'voice', dolls: 'creak', blood: 'sting', watched: 'sting',
  touch: 'sting', enclosed: 'sting', isolation: 'sting', loss: 'voice', injury: 'scream', seance: 'ritual', surge: 'sting',
  devour: 'devour', feed: 'devour', trap_footage: 'flash', clip: 'flash', doc: 'device', broadcast: 'device', evidence: 'flash'
};
const CAPTIONED = new Set(['slam', 'crash', 'scream', 'collapse', 'outburst', 'apparition', 'shape', 'voice', 'whisper', 'voices', 'ward', 'seance', 'lock', 'seal', 'warp', 'injury', 'cold']);
let seenStim = 0, seenLog = 0;

function pumpEvents() {
  const w = game.world;
  for (const st of w.stimuli) {
    if (st.id <= seenStim) continue;
    seenStim = Math.max(seenStim, st.id);
    const snd = KIND_SOUND[st.kind] || 'creak';
    const room = w.rooms[st.room];
    const pan = room ? clamp((room.cx - view.cam.x) / 560, -1, 1) : 0;
    const gain = clamp(0.35 + st.salience * 0.75, 0.2, 1);
    audio.play(snd, { pan, gain });
    if (!audio.muted || true) {
      const line = `${st.about || titleCase(st.kind)} · ${room ? room.name : st.room}`;
      if (CAPTIONED.has(st.kind) || st.salience > 0.6) audio.caption(line, 'sound');
    }
    if (st.salience > 0.85 && !view.reduceMotion) view.shake = Math.max(view.shake, 0.3 * gain);
  }
  if (seenStim > 400 && w.stimuli.length > 40) seenStim = w.stimuli[w.stimuli.length - 1].id;
  for (let i = seenLog; i < game.logs.length; i++) {
    const l = game.logs[i]; if (!l) continue;
    if (l.t < game.t - 1.5) continue;
    seenLog = i + 1;
    if (l.kind === 'counter' || l.kind === 'evidence' || l.kind === 'insight' || l.kind === 'loss' || l.kind === 'damage' || l.kind === 'risk' || l.kind === 'architecture' || l.kind === 'secrecy' || l.kind === 'objective') {
      ui.toast(l.text, l.kind === 'insight' ? 'insight' : l.kind === 'damage' || l.kind === 'risk' || l.kind === 'secrecy' ? 'risk' : 'them');
      audio.caption(l.text, 'them');
      if (l.kind === 'damage' || l.kind === 'architecture') audio.play('sting');
      if (l.kind === 'objective') audio.play('emf');
    } else seenLog = i + 1;
  }
  if (game.logs.length < seenLog) seenLog = game.logs.length;
}

/* ---------------- onEvent ---------------- */
function onEvent(type, data) {
  switch (type) {
    case 'cast':
      game.spentFlash = 1;
      break;
    case 'end':
      audio.play(data.win ? 'win' : data.kind === 'ruin' || data.kind === 'exposed' ? 'lose' : 'bell');
      if (data.kind === 'ruin') view.shake = 1.6;
      break;
    case 'vandal': audio.play('glass'); break;
    case 'captured': audio.play('flash'); break;
    case 'filed': audio.play('device'); break;
    case 'exit': audio.play('door_close'); break;
    case 'enter': audio.play('creak'); break;
    case 'saved': if (data && data.ok === false) ui.toast('Storage refused the save - this browser blocks it.', 'deny'); break;
    default: break;
  }
}

/* ---------------- boot ---------------- */
function boot() {
  const meta = loadMeta(storage);
  game = new Game({ storage, meta, onEvent });
  game.selectedPerson = null;
  view = createView(canvas, game, {
    screenShake: meta.settings.screenShake !== false,
    reduceMotion: !!meta.settings.reduceMotion
  });
  view.showNames = meta.settings.showNames !== false;
  view.showTriggers = meta.settings.showTriggers !== false;
  view.showHeat = meta.settings.showHeat !== false;
  ui = createUI({ getGame: () => game, view, audio, root });
  ui.view = view; ui.viewRef = view;
  ui.titleMode = on => { view.mode = on ? 'title' : 'floor'; if (!on) view.zoomAll(); };
  ui.mount();
  wireInput();
  attachUiHelpers();
  applySettings(meta.settings);
  tutorial = createTutorial(ui);
  audio.setVolume(meta.settings.volume ?? 0.8);
  audio.muted = !!meta.settings.muted;
  const saved = readRun(storage);
  ui.openModal('title', { saved });
  if (saved && game.loadRun(saved)) ui.toast('Saved night loaded: ' + clockLabel(game.t, game.scenario.timeLimit), 'info');
  ui.refresh();
  requestAnimationFrame(frame);
}

/* ---------------- the loop ---------------- */
let last = 0, autosave = 0, endedShown = false;
function frame(ts) {
  const dt = last ? Math.min(0.06, (ts - last) / 1000) : 0.016;
  last = ts;
  if (!game.outcome) {
    game.update(dt);
    pumpEvents();
    tutorial.tick(dt);
    autosave += dt;
    if (autosave > 20 && !game.paused) { autosave = 0; game.saveRun(); }
  }
  audio.update({
    fear: game.avgFear(), fury: game.fury, dread: game.world.rooms[game.focus.room]?.dread ?? 0,
    running: !game.paused && !game.outcome && !ui.modal, haunts: game.stats.haunts
  }, dt);
  view.render(dt);
  ui.frame(dt);
  if (game.outcome && !endedShown) {
    endedShown = true;
    game.saveRun();
    setTimeout(() => ui.openModal('results', game.outcome), 420);
  }
  if (!game.outcome && endedShown) endedShown = false;
  requestAnimationFrame(frame);
}

/* ---------------- input ---------------- */
function wireInput() {
  const pos = ev => {
    const r = canvas.getBoundingClientRect();
    const t = ev.touches?.[0] || ev;
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  };
  let lastClick = { t: 0, key: '' };
  canvas.addEventListener('pointermove', ev => {
    const p = pos(ev);
    const hit = view.pick(p.x, p.y);
    view.hover = hit;
    canvas.style.cursor = hit ? (hit.type === 'intruder' ? 'pointer' : hit.type === 'room' ? 'crosshair' : 'pointer') : 'default';
    showHover(hit, ev.clientX, ev.clientY);
  });
  canvas.addEventListener('pointerleave', () => { view.hover = null; ui.els.hover.replaceChildren(); });
  canvas.addEventListener('pointerdown', () => { audio.resume(); });
  canvas.addEventListener('click', ev => {
    const p = pos(ev);
    const hit = view.pick(p.x, p.y);
    if (!hit) { view.zoomAll(); return; }
    if (hit.type === 'intruder') {
      game.selectedPerson = hit.id;
      ui.tab = 'inspect';
      const who = hit.who;
      if (who.room) { game.setFocus(who.room); view.focusRoom(who.room); }
      audio.play('ui');
    } else if (hit.type === 'prop') {
      ui.pickedProp = hit.id;
      if (game.focus.room !== hit.room) game.setFocus(hit.room);
      const room = game.world.rooms[hit.room]; view.focusRoom(hit.room);
      audio.play('ui');
      const pw = POWER_BY_ID[ui.powerList(game)[ui.powerSel]];
      if (ev.shiftKey || pw?.target === 'prop') { ui.pendingTarget = { prop: hit.id, room: hit.room }; ui.castAt(); }
      else if (room) ui.toast(`${game.world.props[hit.id].type.replace(/_/g, ' ')} in ${room.name}: ${describeProp(game.world.props[hit.id])}`, 'info');
    } else if (hit.type === 'door') {
      ui.pickedDoor = hit.id;
      const d = game.world.byId[hit.id];
      ui.toast(`Door to ${game.world.rooms[d.a === hit.room ? d.b : d.a]?.name || 'elsewhere'}: ${d.locked ? 'locked' : 'unlocked'}${d.seal ? ' · sealed' : ''}${d.warp ? ' · unhinged' : ''}`, 'info');
      if (ev.shiftKey) { ui.pendingTarget = { door: hit.id, room: hit.room }; ui.castAt(); }
    } else {
      game.setFocus(hit.id);
      view.focusRoom(hit.id);
      audio.play('ui');
      if (view.mode === 'floor' && Math.abs(view.cam.zoom - 1) < 0.02) view.cam.tz = 1.95;
    }
    ui.refresh();
  });
  canvas.addEventListener('dblclick', ev => {
    const hit = view.pick(...Object.values(pos(ev)));
    if (hit) { ui.castAt(); }
  });
  canvas.addEventListener('contextmenu', ev => { ev.preventDefault(); ui.castAt(null, true); });
  window.addEventListener('keydown', ev => {
    if (ev.metaKey || ev.ctrlKey) return;
    const k = ev.key;
    audio.resume();
    if (ui.modal) {
      if (k === 'Escape') { if (ui.modal === 'title') return; ui.closeAndRun(); }
      if (k >= '1' && k <= '9' && ui.modal === 'title') ui.openModal('brief', {});
      if (k === 'Enter') { const btn = ui.els.modal.querySelector('button.big'); if (btn) btn.click(); }
      return;
    }
    if (k >= '1' && k <= '9') { ui.powerSel = Number(k) - 1; ui.updatePowerBar(); audio.play('ui'); return; }
    if (k === '0') { ui.powerSel = 9; ui.updatePowerBar(); return; }
    switch (k.toLowerCase()) {
      case ' ': case 'spacebar': ev.preventDefault(); ui.setPaused(!game.paused); audio.play('ui'); break;
      case ',': case '-': game.speed = Math.max(1, game.speed - 1); ui.refresh(); break;
      case '.': case '=': game.speed = Math.min(3, game.speed + 1); ui.refresh(); break;
      case 'e': game.focus.observe = !game.focus.observe; ui.refresh(); break;
      case 't': if (game.armSurge()) { audio.play('ui_big'); ui.toast('Fury banked. The next haunt lands harder.', 'haunt'); } else { audio.play('deny'); ui.toast('Not enough fury to bank (needs 30).', 'deny'); } break;
      case 'f': focusNextPerson(); break;
      case 'g': view.setMode(view.mode === 'floor' ? 'cutaway' : 'floor'); if (view.mode === 'floor') view.zoomAll(); ui.refresh(); break;
      case '[': view.setFloor(clamp(view.floor - 1, -1, 2)); view.zoomAll(); ui.refresh(); break;
      case ']': view.setFloor(clamp(view.floor + 1, -1, 2)); view.zoomAll(); ui.refresh(); break;
      case 'l': ui.tab = 'chronicle'; ui.refresh(); break;
      case 'h': ui.openModal('help'); break;
      case 'm': audio.setMuted(!audio.muted); game.meta.settings.muted = audio.muted; game.persist(); ui.toast(audio.muted ? 'Muted.' : 'Sound on.', 'info'); break;
      case 'r': ui.restartNight(); break;
      case 'y': ui.powerSel = (ui.powerSel + 1) % Math.max(1, ui.powerList(game).length); ui.updatePowerBar(); break;
      case 'u': { const list = ui.powerList(game); ui.powerSel = (ui.powerSel + list.length - 1) % Math.max(1, list.length); ui.updatePowerBar(); break; }
      case 'enter': ui.castAt(); break;
      case 'escape': ui.openModal('pause'); break;
      default: break;
    }
  });
  /* gamepad: A = cast selected, B = back / pause - nothing else needs a pad */
  setInterval(() => {
    if (!navigator.getGamepads) return;
    const pad = [...navigator.getGamepads()].find(p => p);
    if (!pad) return;
    const pressed = i => pad.buttons[i]?.pressed;
    if (pressed(0) && !pad._a) { ui.castAt(); pad._a = true; } else if (!pressed(0)) pad._a = false;
    if (pressed(1) && !pad._b) { ui.setPaused(!game.paused); pad._b = true; } else if (!pressed(1)) pad._b = false;
    if (pressed(4) && !pad._lb) { view.setFloor(clamp(view.floor - 1, -1, 2)); pad._lb = true; } else if (!pressed(4)) pad._lb = false;
    if (pressed(5) && !pad._rb) { view.setFloor(clamp(view.floor + 1, -1, 2)); pad._rb = true; } else if (!pressed(5)) pad._rb = false;
  }, 90);
  window.addEventListener('resize', () => view.resize());
}
function focusNextPerson() {
  const cand = game.activeGroup.filter(i => i.state !== 'expelled');
  if (!cand.length) return;
  const idx = cand.findIndex(i => i.id === game.selectedPerson);
  const who = cand[(idx + 1) % cand.length];
  game.selectedPerson = who.id;
  ui.tab = 'inspect';
  if (who.room) { game.setFocus(who.room); view.focusRoom(who.room); }
  ui.refresh();
}
function describeProp(p) {
  const s = p.state || {};
  const bits = [];
  if (p.broken) bits.push('broken');
  if (p.taken) bits.push('gone');
  if (p.opened) bits.push('open');
  if (p.moved) bits.push('moved from where they left it');
  if (s.lit) bits.push('burning');
  if (s.off) bits.push('dead');
  if (p.animated > 0) bits.push('moving under your hand');
  if (!bits.length) bits.push(p.objective ? `they want this - ${p.objective}` : 'untouched');
  return bits.join(', ');
}
function showHover(hit, cx, cy) {
  const el = ui.els.hover; if (!el) return;
  if (!hit) { el.replaceChildren(); el.classList.remove('show'); return; }
  const kids = [];
  if (hit.type === 'room') {
    const r = game.world.rooms[hit.id];
    kids.push(h3(r.name), p(`${FLOORNAME(r.floor)} · light ${Math.round(r.light * 100)}% · dread ${r.dread.toFixed(2)} · ${r.evidence.length} file(s)`), p(r.desc, 'muted'));
    const occ = game.group.filter(i => i.room === r.id && i.state !== 'expelled' && i.state !== 'gone');
    if (occ.length) kids.push(h('div', { class: 'hcrow' }, occ.map(o => h('span', { class: 'chip', text: `${o.name.split(' ')[0]} ${Math.round(o.fear)}%` }))));
  } else if (hit.type === 'intruder') {
    const w = hit.who;
    kids.push(h3(w.name), p(`${w.archName} · ${w.state} · fear ${Math.round(w.fear)}%`), p(w.action ? (w.action.label || w.action.id) : 'deciding', 'muted'));
  } else if (hit.type === 'door') {
    const d = game.world.byId[hit.id];
    kids.push(h3('Door'), p(`${d.locked ? 'locked' : 'unlocked'} · ${d.seal ? 'sealed' : 'open'}${d.broken ? ' · smashed' : ''}`));
  } else if (hit.type === 'prop') {
    const p2 = game.world.props[hit.id];
    kids.push(h3(titleCase(p2.type)), p(describeProp(p2)));
  }
  el.replaceChildren(...kids);
  el.classList.add('show');
  el.style.left = Math.min(window.innerWidth - 260, cx + 14) + 'px';
  el.style.top = Math.min(window.innerHeight - 130, cy + 12) + 'px';
}
const h3 = t => h('h3', { text: t });
const p = (t, c) => h('p', { class: c, text: t });
const FLOORNAME = f => (['cellar', 'ground floor', 'upper floor', 'attic'][f + 1] || 'outside');
const h = (tag, props = {}, kids = []) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v;
    else if (k === 'on') for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn);
    else e.setAttribute(k, v);
  }
  for (const kid of [].concat(kids || []).flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false || kid === true) continue;
    e.appendChild(typeof kid === 'string' || typeof kid === 'number' ? document.createTextNode(String(kid)) : kid);
  }
  return e;
};

/* ---------------- helpers the UI expects the shell to own ---------------- */
function attachUiHelpers() {
  ui.applySettings = applySettings;
  ui.persistSettings = () => { game.meta.settings = { ...game.meta.settings, showNames: view.showNames, showTriggers: view.showTriggers, showHeat: view.showHeat, screenShake: view.opts.screenShake, reduceMotion: view.reduceMotion, volume: audio.volume, muted: audio.muted }; game.persist(); applySettings(game.meta.settings); };
  ui.refreshSettings = () => applySettings(game.meta.settings);
  ui.applyProgression = () => { ui.pendingProgression = true; };
  ui.restartNight = () => {
    const idx = game.scenarioIndex;
    game.reset(idx, { seed: (Math.random() * 1e9) >>> 0 });
    view.floor = 0; view.zoomAll(); view.mode = 'floor';
    endedShown = false; seenStim = 0; seenLog = 0;
    game.saveRun();
    ui.closeModal(); ui.openModal('brief', { fresh: true });
    ui.toast('The house is reset. Doors open at nine.', 'info');
  };
  ui.nextNight = freeplay => {
    const idx = freeplay ? game.scenarioIndex : Math.min(SCENARIOS.length - 1, game.scenarioIndex + 1);
    game.reset(idx, { seed: (Math.random() * 1e9) >>> 0 });
    view.floor = 0; view.zoomAll(); view.mode = 'floor';
    endedShown = false; seenStim = 0; seenLog = 0;
    ui.closeModal(); ui.openModal('brief', {});
  };
  ui.resetCampaign = () => {
    clearSave(storage);
    const fresh = DEFAULT_META();
    saveMeta(storage, fresh);
    game.meta = fresh;
    game.reset(0, { seed: (Math.random() * 1e9) >>> 0 });
    view.floor = 0; view.zoomAll();
    endedShown = false; seenStim = 0; seenLog = 0;
    ui.toast('Campaign cleared. Hollowmere has forgotten you.', 'info');
    ui.openModal('title');
  };
  ui.startTutorial = () => tutorial.start();
  ui.tutorialOff = () => tutorial.off();
  ui.selectPower = id => { const i = ui.powerList(game).indexOf(id); if (i >= 0) { ui.powerSel = i; ui.updatePowerBar(); } };
}
function applySettings(s) {
  view.opts.screenShake = s.screenShake !== false;
  view.reduceMotion = !!s.reduceMotion;
  view.showNames = s.showNames !== false;
  view.showTriggers = s.showTriggers !== false;
  view.showHeat = s.showHeat !== false;
  audio.setVolume(s.volume ?? 0.8);
  audio.setMuted(!!s.muted);
  document.documentElement.dataset.motion = s.reduceMotion ? 'calm' : 'full';
}

/* ---------------- tutorial, driven by real game state ---------------- */
const TUT = [
  {
    title: 'THE HOUSE IS AWAKE', text: 'Four of them are walking up the front walk with a phone out and a dare posted. You have no body and no legs: you have rooms, doors, and what is inside them. Nothing to press yet - watch the foyer, and notice that they are deciding for themselves.', done: g => g.world.stimuli.length > 0 || g.t > 12
  },
  {
    title: 'LOOK AT THEM', text: 'Pick a room with someone in it (click the floor plan or the room list on the left), then press OBSERVE / E. Standing still and watching costs you nothing and teaches you what each of them fears. A fear you know lands at double weight.', done: g => g.stats.learned >= 1 || g.t > 70
  },
  {
    title: 'SAY SOMETHING SMALL', text: 'Select BREATH ON YOUR NECK or CREAK from the haunt bar (keys 1-0) and press ENTER to cast it at the focused room. Small and cheap: it moves them, and moved people get separated.', done: g => g.stats.haunts >= 1
  },
  {
    title: 'FEAR IS NOT A BAR', text: 'Watch the little numbers by their heads and the fear bar in the People panel. Same haunt, different people: one of them will run and one will get angrier and walk towards it. That difference is the whole game.', done: g => g.activeGroup.some(i => i.fear > 30)
  },
  {
    title: 'THEIR CAMERAS', text: 'Everything they see becomes a file, and files leave with them. Open the Chronicle (L) and find the line that says someone recorded. Loud, visible haunts are worth more on camera - so the biggest scare you own is the worst one to use casually.', done: g => g.world.liveEvidence > 0.2 || g.group.some(i => i.carrying.evidence.length)
  },
  {
    title: 'PAUSE IS A REAL STATE', text: 'Press SPACE. The clock stops mid-decision; nothing moves and no one finishes a thought. Press it again, then push speed to 3x with the . key and watch the same rules run faster, not differently.', done: g => g.t > 20
  },
  {
    title: 'TAKE THEIR NERVE APART', text: 'Snuff a light, lock a door behind one of them, and put something in front of the others. Isolation multiplies panic. If a room is salted you cannot touch it - break the line or wait it out.', done: g => g.stats.doorsLocked + g.stats.moved >= 1 || g.t > 150
  },
  {
    title: 'GET THEM OUT', text: 'Tonight they have to see three dare rooms and then stand in the foyer talking before they count it as done. Drive them out through the front walk, or make sure they never finish. Then survive to dawn and spend the dread on making the house worse.', done: g => !!g.outcome || g.t > 240
  }
];
function createTutorial(ui) {
  const host = document.getElementById('tutorial');
  const t = { i: 0, active: false, timer: 0 };
  t.start = () => { t.i = 0; t.active = true; paint(); };
  t.off = () => { t.active = false; host.replaceChildren(); host.classList.remove('show'); };
  t.skip = () => { t.i++; if (t.i >= TUT.length) t.off(); else paint(); };
  function paint() {
    if (!t.active) { host.replaceChildren(); host.classList.remove('show'); return; }
    const s = TUT[t.i];
    host.classList.add('show');
    host.replaceChildren(h('div', { class: 'tut' }, [
      h('div', { class: 'tuthead' }, [h('b', { text: `TEACHING ${t.i + 1}/${TUT.length}` }), h('button', { text: 'skip', on: { click: () => { audio.play('ui'); t.skip(); } } })]),
      h('h4', { text: s.title }), h('p', { text: s.text }),
      h('div', { class: 'tutfoot' }, [h('span', { class: 'ok', text: t.doneFlash ? 'noted' : 'waiting for you' })])
    ]));
  }
  t.tick = dt => {
    if (!t.active) return;
    const s = TUT[t.i]; if (!s) return;
    let ok = false;
    try { ok = !!s.done(game); } catch { ok = false; }
    if (ok) {
      t.doneFlash = true; paint();
      t.timer += dt;
      if (t.timer > 1.1) { t.timer = 0; t.doneFlash = false; t.skip(); if (t.i >= TUT.length) game.meta.tutorialDone = true; }
    }
    if (!document.getElementById('tutorial').classList.contains('show') && t.active) paint();
  };
  return t;
}

/* expose for console poking + the headless harness */
window.HOUSE = { get game() { return game; }, get view() { return view; }, get ui() { return ui; }, get audio() { return audio; }, PLAN, SCENARIOS, POWER_BY_ID, storage, fmt };
boot();

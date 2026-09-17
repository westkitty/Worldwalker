/* THE HOUSE THAT HUNTS BACK - all DOM interfaces.  Reads the simulation, writes intents. */
import { clamp, clamp01, clockLabel, titleCase, romanize, fmt } from '../core/util.js';
import { PAL, drawPowerIcon, drawFearIcon, drawGearIcon, drawCrest, drawPerson, fearBand } from '../render/art.js';
import { POWERS, POWER_BY_ID } from '../data/powers.js';
import { SCENARIOS, UPGRADES, LORE } from '../data/scenarios.js';
import { FEARS, ARCH_BY_ID, GEAR_BY_ID_ALL, TRAITS } from '../data/intruders.js';
import { FLOORS } from '../data/house.js';

export const h = (tag, props = {}, kids = []) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'on') for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn);
    else if (k === 'style') Object.assign(e.style, v);
    else if (k in e && k !== 'list' && k !== 'value' === false) { try { e[k] = v; } catch { e.setAttribute(k, v); } }
    else if (k === 'data') for (const [dk, dv] of Object.entries(v || {})) e.dataset[dk] = dv;
    else e.setAttribute(k, v);
  }
  for (const kid of [].concat(kids || []).flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false || kid === true) continue;
    e.appendChild(typeof kid === 'string' || typeof kid === 'number' ? document.createTextNode(String(kid)) : kid);
  }
  return e;
};
const meter = (label, value, max, color, hint) => h('div', { class: 'res', title: hint || '' }, [
  h('span', { class: 'reslabel', text: label }),
  h('div', { class: 'bar' }, [h('i', { style: { width: clamp01(value / max) * 100 + '%', background: color } })]),
  h('span', { class: 'resval', text: `${Math.round(value)}` })
]);

/* Casting is a physical act, so each power gets its own sound, jolt and colour -
   never a generic click.  CAST_CUE names must exist in audio.js play(); a missing
   entry falls back to the floorboard creak rather than to silence. */
const CAST_CUE = {
  creak: 'creak', slam_door: 'slam', lock_door: 'lock', snuff_light: 'glass', nudge: 'creak',
  cold_spot: 'cold', whisper: 'whisper', flicker_power: 'emf', possess_object: 'ritual',
  bleed_walls: 'heart', mimic_voice: 'voice', seal_room: 'seal', unhinge: 'warp',
  apparition: 'apparition', memory_horror: 'sting', shadow_grasp: 'scream', collapse: 'collapse',
  devour_records: 'devour', feed: 'heart', drain_fury: 'ui_big'
};
const CAST_FX = {
  collapse: { shake: 1, flash: 0.22, color: '122,92,70' },
  apparition: { shake: 0.7, flash: 0.5, color: '180,220,240' },
  bleed_walls: { shake: 0.3, flash: 0.26, color: '150,30,30' },
  slam_door: { shake: 0.45, flash: 0.16 },
  shadow_grasp: { shake: 0.5, flash: 0.2, color: '60,60,90' },
  memory_horror: { shake: 0.4, flash: 0.34, color: '120,90,140' },
  cold_spot: { shake: 0.08, flash: 0.14, color: '147,215,234' },
  unhinge: { shake: 0.3, flash: 0.18, color: '110,140,120' },
  seal_room: { shake: 0.34, flash: 0.18, color: '150,130,90' },
  devour_records: { shake: 0.2, flash: 0.24, color: '30,30,40' },
  flicker_power: { shake: 0.1, flash: 0.3 },
  feed: { shake: 0.14, flash: 0.2, color: '150,60,50' },
  drain_fury: { shake: 0.24, flash: 0.2, color: '200,110,60' }
};

export function createUI({ getGame, view, audio, root }) {
  const ui = {
    root, tab: 'room', modal: null, powerSel: 0, hoverInfo: null, toastTimer: 0, toasts: [],
    els: {},
    mount() {
      const els = this.els;
      els.topbar = root.querySelector('#topbar');
      els.night = root.querySelector('#nightLabel');
      els.res = root.querySelector('#resources');
      els.clock = root.querySelector('#clock');
      els.clockFill = root.querySelector('#clockFill');
      els.objective = root.querySelector('#objective');
      els.speed = root.querySelector('#speed');
      els.left = root.querySelector('#leftPanel');
      els.right = root.querySelector('#rightPanel');
      els.powers = root.querySelector('#powerbar');
      els.toast = root.querySelector('#toasts');
      els.captions = root.querySelector('#captions');
      els.modal = root.querySelector('#modal');
      els.hover = root.querySelector('#hovercard');
      els.crest = root.querySelector('#crest');
      els.focusBadge = root.querySelector('#focusBadge');
      drawCrestCanvas(els.crest);
    },
    /* ---------------- frame updates (cheap) ---------------- */
    frame(dt) {
      const g = getGame(); if (!g) return;
      const els = this.els;
      els.res.replaceChildren(
        meter('Energy', g.energy, g.energyMax, PAL.energy, 'Manifestation energy. Fear feeds it back to you.'),
        meter('Stability', g.stability, g.stabilityMax, PAL.stability, 'How much of the house will still obey. Powers cost it.'),
        meter('Secrecy', g.meta.secrecy, 100, PAL.secrecy, 'How little of this house is on the record. Escaped evidence burns it.'),
        meter('Fury', g.fury, 100, PAL.fury, 'Haunting intensity. Spend it as a Surge, or it spends you.'),
        h('div', { class: 'res case', title: 'Case strength: what they can prove tonight' }, [
          h('span', { class: 'reslabel', text: 'Case' }),
          h('div', { class: 'bar' }, [h('i', { style: { width: clamp01(g.caseStrength / Math.max(1, g.scenario.caseLimit)) * 100 + '%', background: g.caseStrength / g.scenario.caseLimit > 0.7 ? '#c8483c' : PAL.warn } })]),
          h('span', { class: 'resval', text: `${fmt(g.caseStrength, 1)}/${g.scenario.caseLimit}` })
        ])
      );
      els.clock.replaceChildren(
        h('b', { text: clockLabel(g.t, g.scenario.timeLimit) }),
        h('div', { class: 'bar clockbar' }, [h('i', { style: { width: clamp01(g.t / (g.scenario.timeLimit || 300)) * 100 + '%', background: '#6f7f95' } })]),
        h('span', { class: 'dawn', text: `dawn in ${Math.max(0, Math.round((g.scenario.timeLimit || 300) - g.t))}s` })
      );
      els.night.textContent = `Night ${romanize(g.scenario.n)} · ${g.scenario.name}`;
      els.objective.textContent = g.objectiveBlurb();
      els.objective.dataset.prog = `${g.objective.progress}/${g.objective.need}`;
      els.speed.replaceChildren(...[0, 1, 2, 3].map(s => h('button', {
        class: (g.paused ? s === 0 : s === g.speed) ? 'on' : '', text: s === 0 ? '❙❙' : s + '×',
        title: s === 0 ? 'Pause (Space)' : `Speed ${s}×`,
        on: { click: () => { if (s === 0) { ui.setPaused(true); } else { ui.setPaused(false); g.speed = s; } audio.play('ui'); ui.refresh(); } }
      })));
      this.updatePowerBar();
      this.updateFocusBadge();
      this.tickToasts(dt);
      if (this.els.captions && audio.takeCaptions) this.els.captions.replaceChildren(...audio.takeCaptions().map(c => h('div', { class: 'cap ' + c.kind, text: '♪ ' + c.text })));
      this.heavy += dt;
      if (this.heavy > 0.14) { this.heavy = 0; this.refresh(); }
    },
    heavy: 9,
    setPaused(v) { const g = getGame(); g.paused = !!v; if (v) this.refresh(); },

    /* ---------------- power bar ---------------- */
    updatePowerBar() {
      const g = getGame(), els = this.els;
      const list = this.powerList(g);
      if (this.powerSel >= list.length) this.powerSel = 0;
      els.powers.replaceChildren(
        h('div', { class: 'ptlabel' }, [h('b', { text: 'HAUNTS' }), h('span', { text: `${list.length} available` })]),
        h('div', { class: 'ptrow' }, list.map((id, i) => {
          const pw = POWER_BY_ID[id];
          const chk = g.canCastPower(id, this.currentTarget(g, id));
          const cd = g.cooldowns[id] || 0;
          const ready = cd <= 0.001;
          const sel = i === this.powerSel;
          return h('button', {
            class: 'pt' + (sel ? ' sel' : '') + (chk.ok ? '' : ' off'), title: `${pw.name} - ${pw.desc}`, data: { id },
            on: {
              click: () => { this.powerSel = i; audio.play('ui'); this.tryCast(); },
              contextmenu: ev => { ev.preventDefault(); this.powerSel = i; this.castAt(null, true); }
            }
          }, [
            iconCanvas(28, (ctx, s) => drawPowerIcon(ctx, pw.id, s / 2, s / 2, s * 0.8, { disabled: !chk.ok })),
            h('span', { class: 'ptkey', text: i < 9 ? String(i + 1) : i === 9 ? '0' : '' }),
            h('span', { class: 'ptname', text: pw.name }),
            h('span', { class: 'ptcost', text: `${pw.energy ? pw.energy + 'e' : '—'}${pw.stability ? ' ·' + pw.stability.toFixed(1) + 's' : ''}` }),
            !ready ? h('i', { class: 'cd', style: { height: clamp01(cd / Math.max(0.2, pw.cooldown)) * 100 + '%' } }) : null,
            pw.evidence > 0.5 ? h('span', { class: 'risk', title: 'high evidence', text: '⚠' }) : null
          ]);
        })),
        h('div', { class: 'ptfoot' }, [
          h('button', {
            class: 'surge' + (g.surgeArmed ? ' on' : '') + (g.fury < 30 ? ' off' : ''),
            title: 'Bank the anger: the next haunt lands harder for less energy (T)',
            on: { click: () => { if (g.armSurge()) audio.play('ui_big'); else audio.play('deny'); this.refresh(); } }
          }, [h('b', { text: g.surgeArmed ? 'SURGE ARMED' : 'SPEND FURY' }), h('span', { text: g.surgeArmed ? 'next haunt ×1.6' : 'needs 30 fury' })]),
          h('button', {
            class: 'observe' + (g.focus?.observe ? ' on' : ''),
            title: 'Observe the focused room: learn what they fear. Costs time, not energy (E)',
            on: { click: () => { g.focus.observe = !g.focus.observe; audio.play('ui'); this.refresh(); } }
          }, [h('b', { text: 'OBSERVE' }), h('span', { text: g.focus?.observe ? 'watching' : 'idle' })])
        ])
      );
    },
    powerList(g) {
      return POWERS.filter(p => g.unlocked.has(p.id)).map(p => p.id);
    },
    currentTarget(g, id) {
      const pw = POWER_BY_ID[id];
      if (!pw) return null;
      const room = g.focus.room;
      if (pw.target === 'intruder') {
        const cands = g.group.filter(w => w.room === room || nearRoom(g, w.room, room));
        const t = cands.sort((a, b) => b.fear - a.fear)[0] || g.selectedPerson && g.world.intruders.get(g.selectedPerson);
        return t ? { room: t.room, intruder: t.id } : { room };
      }
      if (pw.target === 'door') {
        const r = g.world.rooms[room];
        const d = r && r.doors[0];
        return { room, door: this.pickedDoor || d };
      }
      if (pw.target === 'prop') {
        const r = g.world.rooms[room];
        const pid = this.pickedProp || (r ? r.props.find(id => g.world.props[id].movable) : null);
        return { room, prop: pid };
      }
      if (pw.target === 'self') return { room };
      return { room };
    },
    tryCast() {
      const g = getGame();
      const list = this.powerList(g);
      const id = list[this.powerSel];
      if (!id) return;
      this.castAt(id);
    },
    castAt(forceId, secondary) {
      const g = getGame();
      const list = this.powerList(g);
      const id = forceId || list[this.powerSel];
      if (!id) return;
      let target = this.currentTarget(g, id);
      if (this.pendingTarget) { target = { ...target, ...this.pendingTarget }; this.pendingTarget = null; }
      const r = g.cast(id, target);
      if (r.ok) {
        const room = r.target?.room ? g.world.rooms[r.target.room] : null;
        const cue = CAST_CUE[id] || 'creak';
        const fx = CAST_FX[id] || {};
        audio.play(cue, { pan: room ? (room.cx - view.cam.x) / 600 : 0 });
        view.shake = fx.shake ?? 0.2;
        view.flash = fx.flash ?? 0.14;
        view.flashColor = fx.color || '220,210,190';
        this.toast(r.text || titleCase(id), POWER_BY_ID[id].evidence > 0.5 ? 'risk' : 'haunt');
        if (r.revealed?.who) {
          const w = g.world.intruders.get(r.revealed.who);
          if (w && r.revealed.kind) this.toast(`${w.name}: ${r.revealed.kind} ${g.knowledge[w.name]?.fears[r.revealed.kind] === 2 ? '- terror' : ''}`, 'insight');
        }
        audio.caption(`${r.text || titleCase(id)}`, 'haunt');
        audio.caption(`sounded: ${titleCase(cue)}`, 'sound');
      } else {
        audio.play('deny');
        this.toast(`${titleCase(id)}: ${r.why}`, 'deny');
      }
      this.refresh();
    },
    updateFocusBadge() {
      const g = getGame(), r = g.world.rooms[g.focus.room];
      if (!r || !this.els.focusBadge) return;
      const occ = g.group.filter(i => i.room === r.id && i.state !== 'expelled');
      this.els.focusBadge.replaceChildren(...nodes([
        h('b', { text: r.name }),
        h('span', { class: 'meta', text: `${r.floor < 0 ? 'cellar' : r.floor === 0 ? 'ground' : r.floor === 1 ? 'upper' : 'attic'} · light ${Math.round(r.light * 100)}% · dread ${r.dread.toFixed(2)}` }),
        r.salt > 0 ? h('span', { class: 'badgewarn', text: 'SALTED' }) : null,
        r.sealBy === 'house' ? h('span', { class: 'badgecold', text: 'SEALED BY YOU' }) : null,
        r.ward > 0 ? h('span', { class: 'badgewarn', text: 'RITE HELD' }) : null,
        occ.length ? h('span', { class: 'badgepeople', text: occ.map(o => o.name.split(' ')[0]).join(', ') }) : null,
        g.focus.observe ? h('span', { class: 'observing', text: 'observing…' }) : null
      ]));
    },
    /* ---------------- side panels ---------------- */
    refresh() {
      const g = getGame(); if (!g) return;
      this.renderLeft(g);
      this.renderRight(g);
    },
    renderLeft(g) {
      const els = this.els;
      const roomsByFloor = f => Object.values(g.world.rooms).filter(r => r.floor === f && !r.outside);
      els.left.replaceChildren(
        h('div', { class: 'floors' }, FLOORS.map(f => h('button', {
          class: (view.floor === f.id ? 'on' : '') + ' fl',
          text: f.short, title: f.name,
          on: { click: () => { view.setFloor(f.id); view.zoomAll(); audio.play('ui'); this.refresh(); } }
        }))),
        h('div', { class: 'paneltitle' }, [h('b', { text: 'HOUSE OVERVIEW' }), h('span', { text: view.mode === 'cutaway' ? 'cutaway' : 'one floor' })]),
        h('div', { class: 'roomlist' }, roomsByFloor(view.floor).map(r => {
          const occ = g.group.filter(i => i.room === r.id && i.state !== 'expelled' && i.state !== 'gone');
          const ev = r.evidence.length + (g.world.caches[r.id]?.items.length || 0);
          return h('button', {
            class: 'room' + (g.focus.room === r.id ? ' on' : ''),
            on: {
              click: () => { g.setFocus(r.id); view.focusRoom(r.id); audio.play('ui'); this.refresh(); },
              dblclick: () => { g.setFocus(r.id); view.focusRoom(r.id); this.castAt(); }
            }
          }, [
            h('span', { class: 'rname', text: r.name }),
            h('span', { class: 'rdots' }, occ.map(o => h('i', { class: 'dot', style: { background: oarch(o).palette.top }, title: `${o.name}: ${titleCase(o.action?.id || 'idle')}` }))),
            h('span', { class: 'rbar', title: 'dread pooled here' }, [h('i', { style: { width: clamp01(r.dread / 2.4) * 100 + '%', background: r.dread > 1.5 ? '#a05ac8' : '#6b4a90' } })]),
            h('span', { class: 'rflags' }, [
              r.light < 0.2 ? h('em', { text: 'dark' }) : null,
              r.stain > 0.1 ? h('em', { class: 'blood', text: 'blood' }) : null,
              r.salt > 0 ? h('em', { class: 'salt', text: 'salt' }) : null,
              r.sealBy === 'house' ? h('em', { class: 'seal', text: 'sealed' }) : null,
              ev ? h('em', { class: 'ev', text: ev + ' ev' }) : null
            ])
          ]);
        })),
        h('div', { class: 'paneltitle' }, [h('b', { text: 'PASSAGES' })]),
        h('div', { class: 'passlist' }, g.world.rooms[g.focus.room]?.doors.map(did => {
          const d = g.world.byId[did], other = d.a === g.focus.room ? d.b : d.a;
          return h('div', { class: 'pass' + (d.warp ? ' warp' : '') + (d.seal ? ' sealed' : '') + (d.locked ? ' locked' : '') }, [
            h('span', { text: g.world.rooms[other]?.name || other }),
            d.warp ? h('em', { class: 'warpT', text: '→ ' + (g.world.rooms[d.warp.to]?.name || d.warp.to) }) : null,
            h('button', {
              class: 'mini', text: d.locked ? 'unlock' : 'lock',
              on: { click: () => { this.pendingTarget = { door: did }; this.castAt(d.locked ? 'lock_door' : 'lock_door'); } }
            })
          ]);
        }) || [])
      );
    },
    renderRight(g) {
      const els = this.els;
      const tabs = [['room', 'Room'], ['people', 'People'], ['inspect', 'Inspect'], ['chronicle', 'Chronicle']];
      els.right.replaceChildren(
        h('div', { class: 'tabs' }, tabs.map(([k, label]) => h('button', {
          class: (this.tab === k ? 'on' : ''), text: label,
          on: { click: () => { this.tab = k; audio.play('ui'); this.refresh(); } }
        }))),
        this.tab === 'room' ? this.roomTab(g) : this.tab === 'people' ? this.peopleTab(g) : this.tab === 'inspect' ? this.inspectTab(g) : this.chronicleTab(g)
      );
    },
    roomTab(g) {
      const r = g.world.rooms[g.focus.room];
      if (!r) return h('div', { class: 'pane' }, 'no room');
      const propBits = r.props.map(id => g.world.props[id]).filter(p => p.moved || p.broken || p.opened || p.taken || p.state.lit || p.animated > 0);
      return h('div', { class: 'pane' }, [
        h('h3', { text: r.name }),
        h('p', { class: 'desc', text: r.desc }),
        h('div', { class: 'grid2' }, [
          stat('light', Math.round(r.light * 100) + '%'), stat('dread', r.dread.toFixed(2)),
          stat('stain', r.stain > 0.05 ? Math.round(r.stain * 100) + '%' : 'none'), stat('salt', r.salt > 0 ? 'holds' : 'no'),
          stat('sealed', r.sealBy === 'house' ? Math.max(0, Math.round(r.sealUntil - g.world.t)) + 's' : 'open'),
          stat('rite', r.ward > 0 ? Math.max(0, Math.round(r.wardUntil - g.world.t)) + 's' : 'no')
        ]),
        h('h4', { text: 'THINGS YOU HAVE CHANGED' }),
        propBits.length ? h('ul', { class: 'list' }, propBits.map(p => h('li', {}, [
          h('b', { text: titleCase(p.type) }), ' ',
          h('span', { text: [p.taken ? 'gone from the house' : p.animated > 0 ? 'moving under your hand' : p.broken ? 'broken' : p.opened ? 'opened' : p.moved ? 'out of place' : 'lit'].join('') }),
          p.movable ? h('button', { class: 'mini', text: 'target', on: { click: () => { ui.pickedProp = p.id; ui.powerSel = ui.powerList(g).indexOf('nudge'); ui.castAt('nudge'); } } }) : null
        ]))) : h('p', { class: 'muted', text: 'Nothing moved, nothing broken. They will find a house that behaves.' }),
        h('h4', { text: 'RECORDS IN THIS ROOM' }),
        r.evidence.length ? h('ul', { class: 'list evlist' }, r.evidence.slice(-8).map(e => h('li', {}, [h('b', { text: e.kind }), h('span', { text: e.weight.toFixed(2) }), e.dropped ? h('em', { text: 'dropped' }) : null]))) : h('p', { class: 'muted', text: 'No recordings here.' }),
        h('div', { class: 'actions' }, [
          h('button', { text: 'Devour records', class: 'act', disabled: !g.unlocked.has('devour_records'), on: { click: () => { ui.pickedProp = null; ui.castAt('devour_records'); } } }),
          h('button', { text: 'Feed on dread', class: 'act', disabled: !g.unlocked.has('feed'), on: { click: () => ui.castAt('feed') } }),
          h('button', { text: 'Seal room', class: 'act', disabled: !g.unlocked.has('seal_room'), on: { click: () => ui.castAt('seal_room') } }),
          h('button', { text: 'Unhinge a passage', class: 'act', on: { click: () => { const d = r.doors[0]; ui.pendingTarget = { door: d }; ui.castAt('unhinge'); } }, disabled: !g.unlocked.has('unhinge') })
        ])
      ]);
    },
    peopleTab(g) {
      const rows = g.group.map(who => {
        const kn = g.knowledge[who.name] || { fears: {}, traits: {} };
        const knFears = Object.keys(kn.fears || {}).length, totFears = Object.keys(who.fears).length;
        return h('button', {
          class: 'person' + (g.selectedPerson === who.id ? ' on' : ''),
          on: { click: () => { g.selectedPerson = who.id; ui.tab = 'inspect'; if (who.room && g.world.rooms[who.room]) g.setFocus(who.room); view.focusRoom(who.room); audio.play('ui'); ui.refresh(); } }
        }, [
          portraitCanvas(who, 30),
          h('div', { class: 'pinfo' }, [
            h('div', { class: 'pline' }, [h('b', { text: who.name }), h('span', { class: 'arch', text: who.archName })]),
            h('div', { class: 'pline small' }, [
              h('span', { class: 'state ' + who.state, text: who.state }),
              h('span', { text: g.world.rooms[who.room]?.name || who.room }),
              h('span', { class: 'intent', text: who.action ? (who.action.label || who.action.id) : 'deciding' })
            ]),
            h('div', { class: 'fbar' }, [h('i', { style: { width: clamp01(who.fear / 100) * 100 + '%', background: fearColor(who.fear) } }), h('em', { text: fearBand(who) })]),
            h('div', { class: 'ptags' }, [
              h('span', { text: `${knFears}/${totFears} fears known` }),
              who.carrying.evidence.length ? h('span', { class: 'warn', text: `${who.carrying.evidence.length} file${who.carrying.evidence.length > 1 ? 's' : ''}` }) : null,
              who.carrying.loot.length ? h('span', { class: 'gold', text: `${who.carrying.loot.length} loot` }) : null,
              who.grabbed > 0 ? h('span', { class: 'cold', text: 'held' }) : null,
              who.hurt > 0 ? h('span', { class: 'hurt', text: 'hurt' }) : null,
              who.withAlly === 0 && who.state === 'active' ? h('span', { class: 'alone', text: 'alone' }) : null
            ])
          ])
        ]);
      });
      return h('div', { class: 'pane' }, [h('h3', { text: 'WHO IS INSIDE' }), h('p', { class: 'muted', text: `Group mood ${Math.round(g.avgFear())}% · ${g.activeGroup.length} still in the house` }), h('div', { class: 'people' }, rows)]);
    },
    inspectTab(g) {
      const who = g.selectedPerson ? g.world.intruders.get(g.selectedPerson) : g.group[0];
      if (!who) return h('div', { class: 'pane' }, 'nobody picked');
      const kn = g.knowledge[who.name] || (g.knowledge[who.name] = { fears: {}, traits: {}, gear: [], plan: null, secret: null });
      const arch = ARCH_BY_ID[who.arch];
      const bonds = Object.entries(who.bonds || {}).map(([id, b]) => {
        const o = g.world.intruders.get(id);
        return o ? h('li', {}, [h('b', { text: o.name }), h('span', { text: `trust ${Math.round(b.trust * 100)}%` }), b.sawPanic ? h('em', { text: `saw them break ×${b.sawPanic}` }) : null, b.helped ? h('em', { class: 'good', text: `carried you ×${b.helped}` }) : null]) : null;
      }).filter(Boolean);
      return h('div', { class: 'pane inspect' }, [
        h('div', { class: 'ihead' }, [portraitCanvas(who, 66), h('div', {}, [h('h3', { text: who.name }), h('p', { class: 'muted', text: `${who.archName} · ${who.role || ''}` }), h('p', { class: 'blurb', text: who.blurb })])]),
        h('div', { class: 'grid2' }, [
          stat('state', who.state), stat('fear', Math.round(who.fear) + '% ' + fearBand(who)),
          stat('nerve', Math.round(who.nerve * 100) + '%'), stat('resolve', Math.round(who.resolve * 100) + '%'),
          stat('belief in you', Math.round((who.belief || 0) * 100) + '%'), stat('alone for', Math.round(who.aloneFor) + 's'),
          stat('hurt', who.hurt > 0 ? 'yes' : 'no'), stat('observed', Math.round((who.observed || 0) * 100) + '%')
        ]),
        h('h4', { text: 'FEARS - WHAT THE HOUSE HAS LEARNED' }),
        h('div', { class: 'fears' }, FEARS.map(f => {
          const known = kn.fears[f.id];
          const has = who.fears[f.id] !== undefined;
          const label = known === 2 ? 'TERROR' : known === 1 ? 'afraid' : known === -1 ? 'unbothered' : known === 0 ? 'mild' : has ? 'unknown' : '—';
          return h('div', { class: 'fear' + (known === 2 ? ' hot' : known === -1 ? ' cold' : known === undefined ? ' unknown' : '') }, [
            iconCanvas(20, (ctx, s) => drawFearIcon(ctx, f.id, s / 2, s / 2, s * 0.86, known === undefined ? '#4c5560' : known === -1 ? '#6f8f7a' : f.color)),
            h('span', { class: 'fname', text: f.name }),
            h('span', { class: 'fval', text: label })
          ]);
        })),
        h('h4', { text: 'TEMPERAMENT' }),
        h('ul', { class: 'chips' }, (arch?.traits || []).concat(who.traits || []).filter((v, i, a) => a.indexOf(v) === i).map(t => h('li', { class: kn.traits?.[t] ? 'known' : 'guess', title: TRAITS.find(x => x.id === t)?.desc || '' }, [h('b', { text: titleCase(t) }), h('span', { text: kn.traits?.[t] ? (TRAITS.find(x => x.id === t)?.desc || '') : 'not observed yet' })]))),
        h('h4', { text: 'CARRIED' }),
        h('div', { class: 'gear' }, Object.keys(who.gear).map(id => {
          const g2 = who.gear[id], def = GEAR_BY_ID_ALL[id];
          return h('div', { class: 'gearitem' + (g2.broken > 0 || g2.charge <= 0 ? ' dead' : ''), title: def?.desc || id }, [
            iconCanvas(22, (ctx, s) => drawGearIcon(ctx, def?.icon || 'device', s / 2, s / 2, s * 0.9)),
            h('span', { text: def?.name || id }),
            g2.max ? h('i', { class: 'charge', style: { width: clamp01(g2.charge / g2.max) * 100 + '%' } }) : null,
            g2.uses ? h('em', { text: '×' + g2.uses }) : null,
            g2.broken > 0 ? h('em', { class: 'bad', text: 'dead' }) : null,
            g2.placed ? h('em', { class: 'good', text: 'placed' }) : null
          ]);
        })),
        h('div', { class: 'grid2' }, [
          stat('files on them', String(who.carrying.evidence.length)),
          stat('weight', who.carrying.evidence.reduce((s, i) => s + i.weight, 0).toFixed(2)),
          stat('loot', who.carrying.loot.map(l => l.label).join(', ') || 'none'),
          stat('filing to', g.scenario.objective?.cache || 'their own pocket')
        ]),
        h('h4', { text: 'BONDS' }),
        bonds.length ? h('ul', { class: 'list' }, bonds) : h('p', { class: 'muted', text: 'no relationships recorded' }),
        h('h4', { text: 'WHAT THEY THINK' }),
        h('ul', { class: 'list mind' }, [
          h('li', {}, [h('b', { text: 'plan: ' }), kn.plan || 'unread - observe them']),
          h('li', {}, [h('b', { text: 'secret: ' }), kn.secret || 'the house does not know them yet']),
          h('li', {}, [h('b', { text: 'says: ' }), who.speak || 'nothing, lately']),
          h('li', {}, [h('b', { text: 'last seen: ' }), Object.entries(who.lastSeenAlly || {}).map(([id, tt]) => `${g.world.intruders.get(id)?.name || id} ${Math.round(g.world.t - tt)}s ago`).join(', ') || 'nobody'])
        ])
      ]);
    },
    chronicleTab(g) {
      const list = g.logs.slice(-70).reverse();
      return h('div', { class: 'pane' }, [
        h('h3', { text: 'CHRONICLE' }),
        h('p', { class: 'muted', text: 'Everything the house felt tonight, newest first. Audio events are written here too.' }),
        h('ul', { class: 'log' }, list.map(l => h('li', { class: 'lg ' + l.kind }, [
          h('span', { class: 't', text: clockLabel(l.t, g.scenario.timeLimit) }),
          h('span', { class: 'k', text: l.kind }),
          h('span', { class: 'x', text: l.text })
        ])))
      ]);
    },
    /* ---------------- toasts ---------------- */
    toast(text, kind = 'info') {
      this.toasts.push({ text, kind, t: 0 });
      if (this.toasts.length > 4) this.toasts.shift();
      this.paintToasts();
    },
    paintToasts() {
      this.els.toast?.replaceChildren(...this.toasts.map(t => h('div', { class: 'toast ' + t.kind, text: t.text })));
    },
    tickToasts(dt) {
      if (!this.toasts.length) return;
      this.toasts.forEach(t => t.t += dt);
      const before = this.toasts.length;
      this.toasts = this.toasts.filter(t => t.t < 6);
      if (this.toasts.length !== before) this.paintToasts();
    },
    /* ---------------- modals ---------------- */
    openModal(kind, data) {
      const g = getGame();
      this.modal = kind;
      g.paused = true;
      this.titleMode?.(kind === 'title');
      const body = this.modalBody(kind, data);
      this.els.modal.replaceChildren(h('div', { class: 'sheet ' + kind }, body));
      this.els.modal.classList.add('show');
    },
    closeModal() { this.modal = null; this.els.modal.classList.remove('show'); this.els.modal.replaceChildren(); this.titleMode?.(false); },
    modalBody(kind, data = {}) {
      const g = getGame();
      switch (kind) {
        case 'title': return titleSheet(g, this, audio);
        case 'brief': return briefSheet(g, this, audio, data);
        case 'results': return resultSheet(g, this, audio, data);
        case 'upgrades': return upgradeSheet(g, this, audio);
        case 'lore': return loreSheet(g, this, data);
        case 'settings': return settingsSheet(g, this, audio, data);
        case 'help': return helpSheet(g, this);
        case 'pause': return pauseSheet(g, this, audio);
        default: return [h('h2', { text: kind })];
      }
    },
    closeAndRun(cb) { this.closeModal(); if (cb) cb(); },
    toggleModal(kind, data) { if (this.modal === kind) this.closeModal(); else this.openModal(kind, data); }
  };
  const oarch = who => ({ palette: who.palette || { top: '#556' } });
  const nearRoom = (g, a, b) => g.world.rooms[a]?.doors.some(d => { const dd = g.world.byId[d]; return dd.a === b || dd.b === b; });
  return ui;
}

/* nodes([...]) - like h()'s child handling, for direct replaceChildren calls:
   drops nulls/booleans, flattens arrays, turns strings into text nodes. */
export const nodes = arr => [].concat(arr === null || arr === undefined ? [] : arr).flat(Infinity)
  .filter(v => v !== null && v !== undefined && v !== false && v !== true)
  .map(v => typeof v === 'string' || typeof v === 'number' ? document.createTextNode(String(v)) : v);
const fearColor = f => f > 82 ? '#d8503c' : f > 62 ? '#d98a3c' : f > 42 ? '#c9b45a' : f > 22 ? '#8aa26a' : '#6f8f9a';
const stat = (k, v) => h('div', { class: 'stat' }, [h('span', { text: k }), h('b', { text: v })]);

function iconCanvas(size, draw) {
  const c = h('canvas', { class: 'iconc', width: size * 2, height: size * 2, style: { width: size + 'px', height: size + 'px' } });
  const ctx = c.getContext('2d');
  if (ctx) { ctx.setTransform(2, 0, 0, 2, 0, 0); draw(ctx, size); }
  return c;
}
function portraitCanvas(who, size) {
  const c = h('canvas', { class: 'portrait', width: size * 2, height: size * 2, style: { width: size + 'px', height: size + 'px' } });
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.fillStyle = 'rgba(10,13,18,0.9)'; ctx.fillRect(0, 0, size, size);
    ctx.save();
    ctx.translate(size / 2, size * 0.66); ctx.scale(size / 26, size / 26);
    const fake = { ...who, x: 0, y: 0, step: 0, grabbed: 0, jitter: 0, speaking: null, hasKid: false };
    drawPerson(ctx, fake, (who.id ? (who.id.length * 0.7) : 1), { zoom: 1.5, showNames: false, selected: false });
    ctx.restore();
  }
  return c;
}
function drawCrestCanvas(c) {
  if (!c) return;
  const size = 46; c.width = size * 2; c.height = size * 2;
  const ctx = c.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  drawCrest(ctx, size / 2, size / 2, size, 0, { glow: true });
}

/* ------------------------------ sheets ------------------------------ */
function titleSheet(g, ui, audio) {
  const meta = g.meta;
  const hasRun = !!g.world && meta.lastNightRun;
  return [
    h('div', { class: 'titleside' }, [
      h('h1', { class: 'gametitle' }, [h('span', { text: 'THE HOUSE' }), h('span', { text: 'THAT HUNTS' }), h('span', { class: 'back', text: 'BACK' })]),
      h('p', { class: 'tagline', text: 'You are not trapped in the haunted house. You are the haunted house.' }),
      h('div', { class: 'titlerow' }, [
        h('button', { class: 'big', text: 'BEGIN THE FIRST NIGHT', on: { click: () => { audio.resume(); audio.play('bell'); ui.closeAndRun(() => ui.openModal('brief', { fresh: true })); } } }),
        h('button', { text: `CONTINUE - NIGHT ${romanize(g.scenario.n)}`, on: { click: () => { audio.resume(); ui.closeAndRun(() => { g.paused = false; ui.refresh(); }); } } }),
        h('button', { text: 'UPGRADE THE HAUNTING', on: { click: () => ui.openModal('upgrades') } }),
        h('button', { text: 'THE HOUSE LORE', on: { click: () => ui.openModal('lore') } }),
        h('button', { text: 'SETTINGS', on: { click: () => ui.openModal('settings') } }),
        h('button', { text: 'HOW TO HAUNT', on: { click: () => ui.openModal('help') } }),
        h('button', { class: 'danger', text: 'RESET CAMPAIGN', on: { click: () => ui.openModal('settings', { confirmReset: true }) } })
      ]),
      h('div', { class: 'campaign' }, [
        h('span', { text: `Nights survived: ${meta.completed.length}/${SCENARIOS.length}` }),
        h('span', { text: `Dread banked: ${meta.dread}` }),
        h('span', { text: `Secrecy: ${Math.round(meta.secrecy)}%` }),
        h('span', { text: `Souls kept: ${meta.kept || 0}` })
      ])
    ])
  ];
}
function briefSheet(g, ui, audio, data) {
  const sc = g.scenario;
  const roster = sc.roster.map(r => {
    const a = ARCH_BY_ID[r.arch];
    return h('li', {}, [h('b', { text: r.name || a.name }), h('span', { text: a.name }), h('em', { text: (r.gear || a.gear || []).map(x => GEAR_BY_ID_ALL[x]?.name || x).join(', ') })]);
  });
  return [
    h('h2', { text: `NIGHT ${romanize(sc.n)} - ${sc.name}` }),
    h('p', { class: 'lede', text: sc.brief }),
    h('div', { class: 'twocol' }, [
      h('div', {}, [h('h4', { text: 'THEY ARE COMING FOR' }), h('p', { text: g.objectiveBlurb() }),
      h('h4', { text: 'THEIR KIT' }), h('ul', { class: 'list' }, roster),
      h('h4', { text: 'PRESSURE' }), h('ul', { class: 'list' }, [
        h('li', {}, [h('b', { text: 'Dawn in ' }), h('span', { text: sc.timeLimit + 's' })]),
        h('li', {}, [h('b', { text: 'Exposure limit: ' }), h('span', { text: `case strength ${sc.caseLimit}` })]),
        h('li', {}, [h('b', { text: 'Stability: ' }), h('span', { text: 'if it reaches zero, the house comes down' })])
      ])]),
      h('div', {}, [h('h4', { text: 'LESSON' }), h('ul', { class: 'list teach' }, (sc.teaching || []).map(t => h('li', { text: lesson(t) }))),
      sc.newGear ? h('h4', { text: 'NEW COUNTERMEASURES' }) : null,
      sc.newGear ? h('ul', { class: 'list' }, sc.newGear.map(id => h('li', {}, [h('b', { text: GEAR_BY_ID_ALL[id]?.name || id }), h('span', { text: GEAR_BY_ID_ALL[id]?.desc || '' })]))) : null])
    ]),
    h('div', { class: 'row' }, [
      h('button', { class: 'big', text: data.tutorial || !g.meta.tutorialDone ? 'BEGIN - TUTORIAL' : 'BEGIN THE NIGHT', on: { click: () => { audio.resume(); audio.play('bell'); ui.closeAndRun(() => { g.paused = false; g.meta.tutorialDone = g.meta.tutorialDone || true; ui.startTutorial?.(); }); } } }),
      h('button', { text: 'BEGIN WITHOUT GUIDANCE', on: { click: () => { audio.resume(); ui.closeAndRun(() => { g.paused = false; ui.tutorialOff?.(); }); } } }),
      h('button', { text: 'SWITCH NIGHT', on: { click: () => ui.openModal('nights') } })
    ])
  ];
}
const lesson = k => ({
  movement: 'Nothing you do is required for them to move. Watch the hall: they will come in and start working.',
  observe: 'Press OBSERVE (E) with a room focused. Standing still and looking is how you learn what each of them fears.',
  sound: 'A creak in an empty room costs almost nothing and buys almost nothing - but it moves people, and moving people get separated.',
  fear: 'Fear is not a bar to fill: it changes what they are willing to decide. Rattled people check doors; terrified people run or stop moving at all.',
  expel: 'They leave through the front walk, the cobble lane, the coal chute or the roof hatch. Everything they carry with them leaves too.',
  evidence: 'Every haunt has an evidence rating. A manifest frightens everyone and photographs perfectly - so it is the worst thing to do on a nightly basis.',
  cache: 'They file what they find into a box. Once it is in the box it can be destroyed with Devour the Record, but it also means they believe they have proof.',
  light: 'Snuffed light is cheap and it is a fear on its own. It also kills their camera flash - darkness is the only countermeasure that costs you nothing.',
  isolate: 'Lock a door and one of them is alone. Alone in the dark is when the house gets loud in their heads.',
  devour: 'Rotting a file does not frighten anyone. It is also the only way to undo a night you overdid.',
  lock: 'A lock is a delay, not a wall. A crowbar or a patient thief will open it - and they will remember that the house locked it from the inside.',
  break: 'If they can break it, do not lock it. Seal the room instead, and take your time.',
  loot: 'Anything they carry out of this house is gone from it forever. That is a loss you cannot devour.',
  hiding: 'They will hide in closets and under beds. A hidden intruder hears everything and is terrified by all of it.',
  props: 'Moved furniture stays moved. They notice, they photograph, and they tell each other - permanent change is the slowest, best haunt.',
  ritual: 'Believers are not frightened by a manifestation the way a reporter is. Break the circle with isolation and memory instead of spectacle.',
  emboldened: 'The faithful gain nerve when you show yourself. Give the circle a reason to distrust each other.',
  fury: 'Fury is a bank: SPEND FURY (T) and the next haunt lands far harder for less energy - and is far more worth filming.',
  seal: 'Sealed doors stop escape routes. Someone trapped will panic, someone cornered will swing.',
  memory: 'A memory needs the house to know the person first. Observe, whisper, then take the thing they never said aloud.',
  salt: 'A salt line means you cannot touch that room at all. Break their line with a thrown object, or wait it out.',
  ward: 'Salt, sage and camera traps are their tools against you. A tripod in a corner is an eye you cannot blink.',
  countermeasure: 'Their instruments warn them before a haunt lands: braced people fear less and record better. Silence the gear first.',
  tripod: 'A camera trap records whether or not anyone is standing in the room. Devour it or move it.',
  battery: 'Batteries run out. A dead flashlight in a dark room is a gift to anyone afraid of the dark.',
  anchor: 'The anchors are how they bind you. Each one they finish costs you energy, fury, and eventually the house.',
  rescue: 'The boy in the linen closet is the only person in this house who is not against you. Keep them away from that door.',
  collapse: 'Ceilings wound people. Wounded people scream, and screaming brings the rest of them to the room - which is either a trap or a disaster.',
  final: 'This is the last night. They have come with a rite. Nothing that happens tonight stays secret.'
}[k] || k.replace(/_/g, ' '));

function resultSheet(g, ui, audio, data) {
  const o = g.outcome || {};
  return [
    h('h2', { class: o.win ? 'good' : o.kind === 'dawn' ? '' : 'bad', text: o.title || 'THE NIGHT ENDS' }),
    h('p', { class: 'lede', text: o.line || '' }),
    h('div', { class: 'scoregrid' }, [
      scoreCard('Dread earned', o.dread ?? 0),
      scoreCard('Fear inflicted', o.fearInflicted ?? 0),
      scoreCard('Driven out', o.expelled ?? 0),
      scoreCard('Kept', o.kept ?? 0),
      scoreCard('Fears learned', o.learned ?? 0),
      scoreCard('Evidence burned', o.evidenceBurned ?? 0),
      scoreCard('Evidence escaped', o.escapedEvidence ?? 0),
      scoreCard('Secrecy', Math.round(g.meta.secrecy) + '%')
    ]),
    o.loreUnlocked ? h('div', { class: 'loreunlocked' }, [h('h4', { text: 'THE HOUSE REMEMBERS: ' + o.loreUnlocked.name }), h('p', { text: o.loreUnlocked.text })]) : null,
    h('div', { class: 'row' }, [
      g.scenarioIndex < SCENARIOS.length - 1 ? h('button', { class: 'big', text: `PREPARE NIGHT ${romanize(SCENARIOS[g.scenarioIndex + 1].n)}`, on: { click: () => { audio.play('ui_big'); ui.nextNight(); } } }) : h('button', { class: 'big', text: 'THE HOUSE STANDS - FREE PLAY', on: { click: () => ui.nextNight(true) } }),
      h('button', { text: 'SPEND DREAD', on: { click: () => ui.openModal('upgrades') } }),
      h('button', { text: 'REPLAY THIS NIGHT', on: { click: () => ui.restartNight() } }),
      h('button', { text: 'CHRONICLE', on: { click: () => { ui.closeAndRun(() => { ui.tab = 'chronicle'; ui.refresh(); }); } } })
    ]),
    h('p', { class: 'muted', text: `Bank: ${g.meta.dread} dread · nights played ${g.meta.nights}` })
  ];
}
const scoreCard = (k, v) => h('div', { class: 'card' }, [h('b', { text: String(v) }), h('span', { text: k })]);

function upgradeSheet(g, ui, audio) {
  const cats = [['power', 'HAUNTS'], ['structure', 'ARCHITECTURE'], ['room', 'ROOMS'], ['trait', 'NATURE'], ['lore', 'LORE']];
  const buy = id => {
    const u = UPGRADES.find(x => x.id === id);
    if (!u) return;
    if (g.meta.upgrades.includes(id)) { ui.toast('Already part of the house.', 'info'); return; }
    if (u.requires && !g.meta.upgrades.includes(u.requires)) { ui.toast(`Needs ${UPGRADES.find(x => x.id === u.requires)?.name || u.requires} first.`, 'deny'); audio.play('deny'); return; }
    if (g.meta.dread < u.cost) { ui.toast(`Not enough dread (${g.meta.dread}/${u.cost}).`, 'deny'); audio.play('deny'); return; }
    g.meta.dread -= u.cost; g.meta.upgrades.push(id); g.persist();
    audio.play('ui_big');
    ui.toast(`The house changes: ${u.name}`, 'upgrade');
    ui.applyProgression?.();
    ui.openModal('upgrades');
  };
  return [
    h('h2', { text: 'WHAT THE HOUSE BECOMES' }),
    h('p', { class: 'muted', text: `Dread banked: ${g.meta.dread}. Spend it on power, on rooms, on the shape of the place. Restarting the night applies the changes.` }),
    ...cats.map(([cat, label]) => h('div', { class: 'upcat' }, [
      h('h4', { text: label }),
      h('div', { class: 'upgrid' }, UPGRADES.filter(u => u.cat === cat).map(u => {
        const owned = g.meta.upgrades.includes(u.id);
        const can = !owned && g.meta.dread >= u.cost && (!u.requires || g.meta.upgrades.includes(u.requires));
        return h('button', { class: 'up' + (owned ? ' owned' : can ? '' : ' off'), on: { click: () => buy(u.id) } }, [
          h('div', { class: 'uptop' }, [h('b', { text: u.name }), h('span', { class: 'cost', text: owned ? 'DONE' : u.cost + 'd' })]),
          h('p', { text: u.desc })
        ]);
      }))
    ])),
    h('div', { class: 'upcat' }, [
      h('h4', { text: 'LORE FRAGMENTS' }),
      h('div', { class: 'upgrid' }, LORE.map(l => h('div', { class: 'up' + (g.meta.lore.includes(l.id) ? ' owned' : ' off') }, [
        h('div', { class: 'uptop' }, [h('b', { text: l.name }), h('span', { class: 'cost', text: g.meta.lore.includes(l.id) ? 'READ' : 'locked' })]),
        h('p', { text: g.meta.lore.includes(l.id) ? l.text : 'Win a night to pull this out of the plaster. ' + (l.hint || '') })
      ])))
    ]),
    h('div', { class: 'row' }, [h('button', { class: 'big', text: 'APPLY AND RESTART NIGHT', on: { click: () => ui.restartNight() } }), h('button', { text: 'CLOSE', on: { click: () => ui.closeAndRun() } })])
  ];
}
function loreSheet(g, ui, data) {
  return [h('h2', { text: 'HOLLOWMERE HOUSE' }), h('p', { class: 'muted', text: `Built ${g.world.meta.built}. ${g.world.meta.address}. The house reads these as memories, not folklore.` }),
  h('div', { class: 'lorebook' }, LORE.map(l => h('div', { class: 'lore' + (g.meta.lore.includes(l.id) ? '' : ' locked') }, [
    h('h4', { text: g.meta.lore.includes(l.id) ? l.name : 'SEALED - ' + l.name }),
    h('p', { text: g.meta.lore.includes(l.id) ? l.text : `Somewhere in this house is ${l.hint} ${Object.keys(g.world.rooms).length} rooms; the plaster keeps it.` })
  ]))),
  h('div', { class: 'row' }, [h('button', { text: 'CLOSE', on: { click: () => ui.closeAndRun() } })])];
}
function settingsSheet(g, ui, audio, data = {}) {
  const s = g.meta.settings;
  const toggle = (k, label, note) => h('label', { class: 'setrow' }, [
    h('span', { text: label }),
    h('input', { type: 'checkbox', checked: !!s[k], on: { change: e => { s[k] = e.target.checked; if (k === 'screenShake') viewSet(ui, k, e.target.checked); if (k === 'reduceMotion') viewSet(ui, k, e.target.checked); ui.persistSettings?.(); ui.refreshSettings?.(); } } }),
    h('em', { text: note })
  ]);
  return [h('h2', { text: 'SETTINGS' }),
  h('div', { class: 'setrow' }, [h('span', { text: 'Master volume' }), h('input', { type: 'range', min: 0, max: 100, value: Math.round(s.volume * 100), on: { input: e => { audio.resume(); audio.setVolume(Number(e.target.value) / 100); s.volume = Number(e.target.value) / 100; ui.persistSettings?.(); } } }), h('em', { text: 'everything is synthesised - no audio files' })]),
  toggle('muted', 'Mute', 'M also mutes'),
  toggle('screenShake', 'Screen shake', 'off = camera stays still'),
  toggle('reduceMotion', 'Reduce motion', 'kills shake, slows pulses, calms fog'),
  toggle('showNames', 'Show intruder names', ''),
  toggle('showTriggers', 'Audio captions', 'critical sounds are also written on screen'),
  toggle('showHeat', 'Dread heat map', 'colours rooms by how much dread is pooled'),
  toggle('subtitles', 'Caption the chronicle', 'event log doubles as the audio transcript'),
  h('div', { class: 'row' }, [
    h('button', { text: 'SAVE THIS NIGHT', on: { click: () => { const ok = g.saveRun(); ui.toast(ok ? 'Saved. The night will resume here.' : 'Storage refused the save.', ok ? 'info' : 'deny'); } } }),
    h('button', { text: 'CLOSE', on: { click: () => ui.closeAndRun() } }),
    h('button', { class: 'danger', text: data.confirmReset ? 'YES - BURN THE SAVE' : 'RESET CAMPAIGN', on: { click: () => { if (!data.confirmReset) { ui.openModal('settings', { confirmReset: true }); return; } ui.resetCampaign?.(); } } })
  ])];
}
const viewSet = (ui, k, v) => { if (ui.viewRef) ui.viewRef.opts[k] = v, ui.viewRef[k === 'reduceMotion' ? 'reduceMotion' : k] = v; };
function helpSheet(g, ui) {
  return [h('h2', { text: 'HOW TO HAUNT' }),
  h('div', { class: 'twocol' }, [
    h('div', {}, [
      h('h4', { text: 'CONTROLS' }),
      h('ul', { class: 'list keys' }, [
        ['Click', 'focus a room / pick a person / target a prop or door'],
        ['Double-click', 'cast the selected haunt at that room'],
        ['1-0', 'select a haunt'], ['Enter', 'cast the selected haunt at the focused room'],
        ['Right-click a haunt', 'cast it without moving your focus'],
        ['E', 'observe the focused room'], ['F', 'focus the next intruder'],
        ['[ and ]', 'floor down / up'], ['G', 'cutaway view of all floors'],
        ['T', 'spend fury for a Surge'], ['Space', 'pause / resume'],
        [', and .', 'speed down / up'], ['L', 'chronicle'], ['H', 'help'], ['M', 'mute'],
        ['Esc', 'pause menu'], ['R', 'restart the night']
      ].map(([k, d]) => h('li', {}, [h('b', { text: k }), h('span', { text: d })]))),
      h('h4', { text: 'TOUCH AND CONTROLLER' }),
      h('p', { class: 'muted', text: 'Tap a room to focus it, tap a haunt to cast it there. The speed cluster and power bar are large on purpose. A gamepad sends its A/B to select and back.' })
    ]),
    h('div', {}, [
      h('h4', { text: 'THE ECONOMY' }),
      h('ul', { class: 'list' }, [
        h('li', {}, [h('b', { text: 'Energy ' }), h('span', { text: 'is spent on every haunt and paid back by fear. A quiet house starves.' })]),
        h('li', {}, [h('b', { text: 'Stability ' }), h('span', { text: 'is spent by violence. Zero means the house comes down and the night is lost.' })]),
        h('li', {}, [h('b', { text: 'Secrecy ' }), h('span', { text: 'is what escapes. Every file they carry out is a harder next night.' })]),
        h('li', {}, [h('b', { text: 'Fury ' }), h('span', { text: 'makes haunts cheaper and louder; past 86 the house rattles on its own.' })])
      ]),
      h('h4', { text: 'PLAYING IT' }),
      h('ul', { class: 'list' }, [
        h('li', { text: 'Observe before you perform: a fear you know is a haunt that lands double.' }),
        h('li', { text: 'Loud and visible frightens them and their equipment. Cheap and quiet frightens only them.' }),
        h('li', { text: 'Separate them. One person alone in a cold dark room is the house at its strongest.' }),
        h('li', { text: 'Devour the record before dawn, not after.' }),
        h('li', { text: 'Locked doors invite crowbars. Sealed rooms invite panic. Pick which of the two you want.' })
      ])
    ])
  ]),
  h('div', { class: 'row' }, [h('button', { text: 'CLOSE', on: { click: () => ui.closeAndRun() } })])];
}
function pauseSheet(g, ui, audio) {
  return [h('h2', { text: 'THE HOUSE HOLDS ITS BREATH' }),
  h('p', { class: 'muted', text: `Night ${romanize(g.scenario.n)} · ${Math.round(g.t)}s in · case strength ${fmt(g.caseStrength, 1)}/${g.scenario.caseLimit}` }),
  h('div', { class: 'row' }, [
    h('button', { class: 'big', text: 'RESUME', on: { click: () => ui.closeAndRun(() => { g.paused = false; }) } }),
    h('button', { text: 'SAVE NIGHT', on: { click: () => { const ok = g.saveRun(); ui.toast(ok ? 'Saved.' : 'Save refused.', 'info'); } } }),
    h('button', { text: 'RESTART NIGHT', on: { click: () => ui.restartNight() } }),
    h('button', { text: 'UPGRADES', on: { click: () => ui.openModal('upgrades') } }),
    h('button', { text: 'SETTINGS', on: { click: () => ui.openModal('settings') } }),
    h('button', { text: 'HELP', on: { click: () => ui.openModal('help') } }),
    h('button', { text: 'TITLE SCREEN', on: { click: () => ui.openModal('title') } })
  ]),
  h('p', { class: 'muted', text: 'Pausing freezes the simulation: nothing moves, no decision is half-made, and speed controls govern the same clock afterwards.' })];
}

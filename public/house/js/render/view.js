/* THE HOUSE THAT HUNTS BACK - canvas view.  Reads simulation state only; never writes it.
   Floors as architectural cutaway plates: walls, furniture, light, people, haunts. */
import { clamp, clamp01, lerp, smooth, ease } from '../core/util.js';
import { PAL, drawFloor, drawWalls, drawProp, drawPerson, drawKid, drawStimulus, drawHaunt, fearBand, drawTitleHouse, drawCrest } from './art.js';

const PLAN = { w: 1260, h: 780 };

export function createView(canvas, game, opts = {}) {
  const ctx = canvas.getContext('2d');
  const view = {
    canvas, ctx, game, opts,
    cam: { x: 520, y: 400, zoom: 1, tx: 520, ty: 400, tz: 1 },
    floor: 0, mode: 'floor', hover: null, picked: null, reticle: null,
    shake: 0, flash: 0, flashColor: 'rgba(255,255,255,0.1)', time: 0,
    dpr: 1, w: 0, h: 0, scale: 1, ox: 0, oy: 0,
    reduceMotion: !!opts.reduceMotion,
    showGrid: false, showHeat: true, showNames: true, showTriggers: true,
    trail: [],
    setFloor(f) { this.floor = f; },
    setMode(m) { this.mode = m; },
    focusRoom(id) {
      const r = game.world.rooms[id];
      if (!r) return;
      this.cam.tx = r.cx; this.cam.ty = r.cy + (r.floor - this.floor) * 0;
      this.cam.tz = this.mode === 'floor' ? 1.95 : 1;
      if (r.floor !== this.floor && this.mode === 'floor') this.floor = r.floor;
    },
    zoomAll() { this.cam.tx = PLAN.w / 2; this.cam.ty = PLAN.h / 2; this.cam.tz = 1; },
    resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect();
      this.dpr = dpr; this.w = Math.max(320, rect.width); this.h = Math.max(240, rect.height);
      canvas.width = Math.round(this.w * dpr); canvas.height = Math.round(this.h * dpr);
    },
    toWorld(sx, sy) {
      return { x: (sx - this.ox) / (this.scale * this.cam.zoom), y: (sy - this.oy) / (this.scale * this.cam.zoom) };
    },
    pick(sx, sy) {
      const p = this.toWorld(sx, sy);
      let best = null, bd = 1e9;
      for (const who of game.group) {
        if (who.state === 'expelled' || who.state === 'gone' || who.state === 'escaped') continue;
        if (who.floor !== this.floor && this.mode === 'floor') continue;
        const d = Math.hypot(who.x - p.x, who.y - p.y);
        if (d < 16 && d < bd) { bd = d; best = { type: 'intruder', id: who.id, who }; }
      }
      if (best) return best;
      for (const rid in game.world.rooms) {
        const r = game.world.rooms[rid];
        if (r.floor !== this.floor && this.mode === 'floor') continue;
        if (p.x < r.x || p.x > r.x + r.w || p.y < r.y || p.y > r.y + r.h) continue;
        for (const pid of r.props) {
          const pr = game.world.props[pid];
          if (p.x >= pr.x - 2 && p.x <= pr.x + pr.w + 2 && p.y >= pr.y - 2 && p.y <= pr.y + pr.h + 2) return { type: 'prop', id: pid, room: rid };
        }
        for (const did of r.doors) {
          const d = game.world.byId[did];
          const near = Math.min(Math.hypot(d.ax - p.x, d.ay - p.y), Math.hypot(d.bx - p.x, d.by - p.y));
          if (near < 17) return { type: 'door', id: did, room: rid };
        }
        return { type: 'room', id: rid };
      }
      return null;
    },
    render(dtReal) {
      const dt = this.reduceMotion ? Math.min(dtReal, 0.05) : Math.min(dtReal, 0.05);
      this.time += dt;
      this.resizeIfNeeded();
      const t = this.time;
      const w = game.world;
      /* camera easing */
      const cr = this.reduceMotion ? 9 : 5.2;
      this.cam.x = smooth(this.cam.x, this.cam.tx, cr, dt);
      this.cam.y = smooth(this.cam.y, this.cam.ty, cr, dt);
      this.cam.zoom = smooth(this.cam.zoom, this.cam.tz, 6, dt);
      this.shake = Math.max(0, this.shake - dt * 3.2);
      this.flash = Math.max(0, this.flash - dt * 2.4);
      const shakeX = this.opts.screenShake && !this.reduceMotion ? Math.sin(t * 47) * this.shake * 7 : 0;
      const shakeY = this.opts.screenShake && !this.reduceMotion ? Math.cos(t * 39) * this.shake * 5 : 0;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      /* void */
      ctx.fillStyle = PAL.void; ctx.fillRect(0, 0, this.w, this.h);
      drawVignette(ctx, this.w, this.h, t);
      if (this.mode === 'title') {
        drawTitleHouse(ctx, this.w, this.h, t, {
          windowsLit: game.meta?.upgrades?.length ? 4 + Math.min(8, game.meta.upgrades.length) : 4,
          moon: 1, fog: this.reduceMotion ? 0.55 : 1, shake: 0
        });
        return;
      }
      /* fit */
      const fit = Math.min(this.w / PLAN.w, this.h / (PLAN.h * (this.mode === 'cutaway' ? 1.42 : 1)));
      this.scale = fit;
      const s = fit * this.cam.zoom;
      this.ox = this.w / 2 - this.cam.x * s + shakeX;
      this.oy = this.h / 2 - this.cam.y * s + shakeY;
      ctx.save();
      ctx.translate(this.ox, this.oy); ctx.scale(s, s);
      if (this.showGrid) drawGrid(ctx);
      const floors = this.mode === 'cutaway' ? [-1, 0, 1, 2] : [this.floor];
      floors.forEach((f, fi) => {
        const ghost = this.mode === 'cutaway';
        const yoff = ghost ? (1 - f) * 190 : 0;
        ctx.save();
        if (ghost) { ctx.translate(0, yoff); ctx.globalAlpha = f === this.floor ? 1 : 0.42; }
        this.renderFloor(f, t, ghost, s);
        ctx.restore();
      });
      ctx.restore();
      /* hud overlays that live in screen space */
      if (this.flash > 0.01) { ctx.fillStyle = `rgba(${this.flashColor},${this.flash * 0.32})`; ctx.fillRect(0, 0, this.w, this.h); }
      drawScanlines(ctx, this.w, this.h, this.reduceMotion ? 0.02 : 0.045);
    },
    resizeIfNeeded() {
      const r = this.canvas.getBoundingClientRect();
      if (Math.abs(r.width * this.dpr - this.canvas.width) > 2 || Math.abs(r.height * this.dpr - this.canvas.height) > 2) this.resize();
    },
    renderFloor(floor, t, ghost, s) {
      const w = game.world;
      const rooms = Object.values(w.rooms).filter(r => r.floor === floor);
      const focusId = game.focus?.room;
      /* 1. floors + props */
      for (const r of rooms) {
        const dim = this.mode === 'floor' && focusId && r.id !== focusId ? 0.9 : 1;
        drawFloor(ctx, r, t, r.light, {});
        if (r.stain > 0.02) {
          ctx.save(); ctx.globalAlpha = clamp01(r.stain) * 0.8;
          for (let i = 0; i < 8; i++) {
            const px = r.x + (Math.sin(i * 2.7 + r.cx) * 0.5 + 0.5) * r.w, py = r.y + (Math.cos(i * 1.9 + r.cy) * 0.5 + 0.5) * r.h * 0.5;
            ctx.fillStyle = i % 3 ? PAL.blood : PAL.bloodWet;
            ctx.beginPath(); ctx.ellipse(px, py, 8 + (i % 4) * 5, 4 + (i % 3) * 3, i, 0, 6.3); ctx.fill();
          }
          ctx.restore();
        }
        if (r.wet > 0.05) {
          ctx.save(); ctx.globalAlpha = clamp01(r.wet) * 0.34; ctx.fillStyle = '#2f4a56';
          ctx.fillRect(r.x, r.y + r.h * 0.55, r.w, r.h * 0.45); ctx.restore();
        }
        if (this.showHeat && !ghost) {
          const heat = clamp01(r.dread / 2.2);
          if (heat > 0.06) { ctx.save(); ctx.globalAlpha = heat * 0.34; const g = ctx.createRadialGradient(r.cx, r.cy, 4, r.cx, r.cy, Math.max(r.w, r.h) * 0.72); g.addColorStop(0, 'rgba(120,60,140,0.85)'); g.addColorStop(0.6, 'rgba(70,40,110,0.4)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.restore(); }
        }
        if (r.salt > 0) {
          ctx.save(); ctx.strokeStyle = 'rgba(226,226,214,0.75)'; ctx.lineWidth = 2.4; ctx.setLineDash([5, 4]);
          for (const did of r.doors) { const d = w.byId[did]; if (d.a !== r.id) continue; ctx.beginPath(); ctx.moveTo(d.ax - 9, d.ay); ctx.lineTo(d.ax + 9, d.ay); ctx.stroke(); }
          ctx.restore();
        }
        if (!ghost) for (const pid of r.props) drawProp(ctx, w.props[pid], t, r);
        else { ctx.save(); ctx.globalAlpha = 0.5; for (const pid of r.props) { const p = w.props[pid]; ctx.fillStyle = '#2a2318'; ctx.fillRect(p.x, p.y, p.w, p.h); } ctx.restore(); }
        /* 2. darkness */
        const dark = clamp01(1 - r.light) * (r.outside ? 0.15 : 0.86);
        if (dark > 0.01) { ctx.save(); ctx.globalAlpha = dark; ctx.fillStyle = '#04060a'; ctx.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4); ctx.restore(); }
        /* 3. lights punch back through */
        if (!ghost) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          if (r.switchOn && !r.lightBroken && r.light > 0.05) {
            const g = ctx.createRadialGradient(r.cx, r.cy, 6, r.cx, r.cy, Math.max(r.w, r.h) * 0.6);
            g.addColorStop(0, `rgba(255,222,166,${0.2 * r.light})`); g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h);
          }
          for (const pid of r.props) {
            const p = w.props[pid];
            if (!p.light || p.state.off || (!r.light && !p.state.lit)) continue;
            const g = ctx.createRadialGradient(p.x + p.w / 2, p.y + p.h / 2, 1, p.x + p.w / 2, p.y + p.h / 2, 46);
            const fl = 0.7 + Math.sin(t * 6 + p.x) * 0.12;
            g.addColorStop(0, `rgba(255,214,146,${0.3 * fl})`); g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x + p.w / 2, p.y + p.h / 2, 46, 0, 6.3); ctx.fill();
          }
          ctx.restore();
        }
      }
      /* 4. walls / doors once so shared walls are clean */
      drawWalls(ctx, Object.fromEntries(rooms.map(r => [r.id, r])), w.doors.filter(d => (w.rooms[d.a]?.floor === floor || w.rooms[d.b]?.floor === floor)), t, { distorting: new Set(w.doors.filter(d => d.warp).map(d => d.id)) });
      /* 5. haunts */
      for (const fx of w.effects) {
        const r = w.rooms[fx.room];
        if (!r || r.floor !== floor) continue;
        drawHaunt(ctx, fx, t, r, { prop: fx.prop ? w.props[fx.prop] : null, zoom: 1 / Math.max(0.4, s / (this.scale || 1)) });
      }
      /* 6. people - everyone still inside is drawn, including the ones the house kept */
      const people = game.group.filter(i => i.floor === floor && i.state !== 'expelled' && i.state !== 'gone' && i.state !== 'escaped');
      people.sort((a, b) => a.y - b.y);
      let kidCarried = false;
      for (const who of people) {
        const zoom = this.cam.zoom;
        drawPerson(ctx, who, t, {
          zoom, showNames: this.showNames && !ghost,
          selected: game.selectedPerson === who.id,
          hovered: this.hover?.type === 'intruder' && this.hover.id === who.id
        });
        if (!ghost && this.showTriggers) drawTriggers(ctx, who, t);
        if (who.hasKid && !kidCarried) { drawKid(ctx, who.x + 7, who.y + 3, t, 0.92); kidCarried = true; }
      }
      /* 7. the lost child, where the house left him */
      const kid = w.lostChild;
      if (kid && !kidCarried && kid.room && w.rooms[kid.room]?.floor === floor) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        const g = ctx.createRadialGradient(kid.x, kid.y - 3, 1, kid.x, kid.y - 3, 22);
        g.addColorStop(0, 'rgba(120,170,220,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(kid.x, kid.y - 3, 22, 0, 6.3); ctx.fill();
        ctx.restore();
        drawKid(ctx, kid.x, kid.y, t, 1);
      }
      /* 8. stimuli ripples */
      for (const st of w.stimuli) {
        const r = w.rooms[st.room];
        if (!r || r.floor !== floor) continue;
        if (st.salience < 0.16) continue;
        drawStimulus(ctx, st, t, { zoom: 1 });
      }
      /* 9. labels + interaction affordances */
      for (const r of rooms) {
        if (r.outside) continue;
        const sel = focusId === r.id;
        ctx.save();
        ctx.font = `600 ${sel ? 12 : 10.5}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillStyle = sel ? 'rgba(240,226,196,0.95)' : 'rgba(196,206,220,0.5)';
        ctx.fillText(r.name.toUpperCase(), r.x + 8, r.y + 6);
        if (!ghost && (r.dread > 0.55 || r.evidence.length || r.salt > 0 || r.sealBy === 'house')) {
          let bx = r.x + r.w - 8;
          const badges = [];
          if (r.evidence.length) badges.push(['#e0a13a', r.evidence.length]);
          if (r.salt > 0) badges.push(['#e6e6dc', 0]);
          if (r.sealBy === 'house') badges.push(['#8fd7ea', 0]);
          if (r.ward > 0) badges.push(['#dcd2b6', 0]);
          if (r.dread > 1.2) badges.push(['#a06ac8', Math.round(r.dread * 10)]);
          for (const [c, n] of badges) {
            bx -= 13;
            ctx.beginPath(); ctx.arc(bx, r.y + 10, 5, 0, 6.3); ctx.fillStyle = c; ctx.globalAlpha = 0.85; ctx.fill();
            if (n) { ctx.fillStyle = '#0a0c10'; ctx.font = '700 7px ui-sans-serif'; ctx.textAlign = 'center'; ctx.fillText(String(n), bx, r.y + 6.6); ctx.textAlign = 'right'; }
          }
        }
        if (sel) {
          ctx.strokeStyle = 'rgba(232,196,106,0.8)'; ctx.lineWidth = 1.6 / Math.max(0.5, this.scale * this.cam.zoom);
          ctx.strokeRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6);
        }
        ctx.restore();
      }
      /* hover ring */
      if (this.hover && !ghost) {
        const h = this.hover;
        ctx.save(); ctx.strokeStyle = 'rgba(214,230,242,0.55)'; ctx.lineWidth = 1.2;
        if (h.type === 'room') { const r = w.rooms[h.id]; if (r) ctx.strokeRect(r.x - 1.5, r.y - 1.5, r.w + 3, r.h + 3); }
        else if (h.type === 'prop') { const p = w.props[h.id]; if (p) { ctx.strokeRect(p.x - 2, p.y - 2, p.w + 4, p.h + 4); } }
        else if (h.type === 'door') { const d = w.byId[h.id]; if (d) { ctx.beginPath(); ctx.arc(d.ax, d.ay, 12, 0, 6.3); ctx.moveTo(d.bx + 12, d.by); ctx.arc(d.bx, d.by, 12, 0, 6.3); ctx.stroke(); } }
        ctx.restore();
      }
      /* power reticle on the focused room */
      if (this.reticle) {
        const r = w.rooms[this.reticle.room || focusId];
        if (r) {
          ctx.save();
          ctx.strokeStyle = this.reticle.ok === false ? 'rgba(224,120,90,0.9)' : 'rgba(150,220,240,0.8)';
          ctx.lineWidth = 1.6; ctx.setLineDash([7, 5]); ctx.lineDashOffset = -t * 14;
          ctx.strokeRect(r.x - 5, r.y - 5, r.w + 10, r.h + 10);
          ctx.restore();
        }
      }
    }
  };
  view.resize();
  return view;
}

function drawTriggers(ctx, who, t) {
  /* fear indicator: a small dial over the head with a needle per active trigger */
  const keys = who._activeTriggers || [];
  if (!keys.length) return;
  const n = Math.min(4, keys.length);
  for (let i = 0; i < n; i++) {
    const k = keys[i];
    const col = k === 'darkness' ? '#4a5a86' : k === 'blood' ? '#8e2b32' : k === 'dolls' ? '#9a7f6c' : k === 'enclosed' ? '#7a6b52' : k === 'voices' ? '#6f8f7a' : k === 'watched' ? '#7b5b8c' : k === 'loss' ? '#a4763f' : k === 'isolation' ? '#5d7a9a' : '#7d8a99';
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(who.x + 12 + i * 6, who.y - 20); ctx.lineTo(who.x + 15 + i * 6, who.y - 25); ctx.lineTo(who.x + 18 + i * 6, who.y - 20); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}
function drawVignette(ctx, w, h, t) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.22, w / 2, h / 2, Math.max(w, h) * 0.78);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.72)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const p = 0.02 + Math.sin(t * 0.6) * 0.008;
  ctx.fillStyle = `rgba(60,30,20,${p})`; ctx.fillRect(0, 0, w, h);
}
function drawGrid(ctx) {
  ctx.save(); ctx.globalAlpha = 0.12; ctx.strokeStyle = '#39506b'; ctx.lineWidth = 0.6;
  for (let x = 0; x < PLAN.w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, PLAN.h); ctx.stroke(); }
  for (let y = 0; y < PLAN.h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(PLAN.w, y); ctx.stroke(); }
  ctx.restore();
}
function drawScanlines(ctx, w, h, alpha) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = '#8fb4c8';
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 0.6);
  ctx.restore();
}
export { PLAN, drawCrest };

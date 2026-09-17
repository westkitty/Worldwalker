/* THE HOUSE THAT HUNTS BACK - the entire visible asset family, drawn procedurally.
   Nothing here loads an external image: floors, walls, ~30 furniture sprites, nine
   intruder archetypes with expressions, gear icons, fear icons, power glyphs, haunt VFX
   and the title plate are all vector code so the whole game shares one authored hand. */
import { clamp, clamp01, ease, lerp } from '../core/util.js';

export const PAL = {
  void: '#080a0e', paper: '#0e1218', ink: '#05070a', line: '#232a35',
  wall: '#171b23', wallTop: '#242b38', wallEdge: '#333d4c',
  wood: '#3b2c1e', woodLight: '#4d3a26', woodDark: '#241a12',
  carpet: '#4b2b2e', carpetLight: '#5f383b',
  tile: '#2d3941', tileLight: '#3a4952',
  stone: '#33343b', stoneLight: '#43454e',
  dirt: '#2b2118', dirtLight: '#3a2d20',
  plaster: '#3a3630', plasterLight: '#4a453c',
  brass: '#c9a25a', brassDark: '#7c6331',
  copper: '#a9714a',
  silver: '#c4ccd6',
  glass: '#8fb9c9',
  cloth: '#6b5f74',
  blood: '#7d1f26', bloodWet: '#a8323a',
  cold: '#93d7ea', ghost: '#bfe8f2',
  fury: '#d4502f', energy: '#e8c46a', stability: '#8fa8bd', secrecy: '#8d7bc0', dread: '#86b46b',
  flesh: '#d9a06a', shadow: 'rgba(3,4,7,0.55)',
  warn: '#e0a13a', ok: '#79b98a'
};
const INK = PAL.ink;

/* ---------------- primitives ---------------- */
export function rr(ctx, x, y, w, h, r = 3) {
  const rad = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}
function fillRR(ctx, x, y, w, h, r, fill, stroke, lw = 1) {
  rr(ctx, x, y, w, h, r); if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
function hashN(x, y) { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); }

/* ---------------- floor plates ---------------- */
export function drawFloor(ctx, room, t = 0, light = 1, style = {}) {
  const { x, y, w, h } = room;
  const mat = room.floorMaterial;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const base = mat === 'carpet' ? PAL.carpet : mat === 'tile' ? PAL.tile : mat === 'stone' ? PAL.stone : mat === 'dirt' ? PAL.dirt : mat === 'gravel' ? '#2a2d33' : PAL.wood;
  ctx.fillStyle = base; ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 0.85;
  if (mat === 'wood') {
    const ph = 13;
    for (let i = 0, py = y; py < y + h; i++, py += ph) {
      ctx.fillStyle = i % 2 ? PAL.woodDark : '#2b2015';
      ctx.fillRect(x, py, w, 1.2);
      const jx = x + ((i * 47) % Math.max(24, w - 24));
      ctx.fillRect(jx, py, 1.1, ph);
    }
    ctx.globalAlpha = 0.12; ctx.fillStyle = PAL.woodLight;
    for (let i = 0; i < (w * h) / 900; i++) {
      const hx = x + hashN(i, room.cx) * w, hy = y + hashN(room.cy, i) * h;
      ctx.fillRect(hx, hy, 12 + hashN(i, 3) * 20, 1.4);
    }
  } else if (mat === 'tile') {
    const s = 22;
    ctx.strokeStyle = '#1d262c'; ctx.lineWidth = 1.1;
    for (let gy = y; gy < y + h; gy += s) { ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke(); }
    for (let gx = x; gx < x + w; gx += s) { ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); ctx.stroke(); }
    ctx.globalAlpha = 0.1; ctx.fillStyle = '#b9d3dc';
    for (let gy = y; gy < y + h; gy += s) for (let gx = x; gx < x + w; gx += s) if (hashN(gx, gy) > 0.72) ctx.fillRect(gx + 2, gy + 2, s - 6, s - 6);
  } else if (mat === 'stone') {
    let sy = y;
    for (let row = 0; sy < y + h; row++, sy += 15) {
      let sx = x - (row % 2 ? 12 : 0);
      while (sx < x + w) {
        const bw = 26 + hashN(sx, sy) * 16;
        ctx.fillStyle = hashN(sy, sx) > 0.5 ? PAL.stoneLight : '#2c2e35';
        fillRR(ctx, sx + 1, sy + 1, bw - 2, 13, 2, ctx.fillStyle, '#1a1c22', 1);
        sx += bw;
      }
    }
  } else if (mat === 'carpet') {
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < (w * h) / 260; i++) {
      const px = x + hashN(i, 11) * w, py = y + hashN(7, i) * h;
      ctx.fillStyle = hashN(i, i) > 0.5 ? PAL.carpetLight : '#3e2427';
      ctx.fillRect(px, py, 4, 3);
    }
    ctx.globalAlpha = 0.3; ctx.strokeStyle = '#7d5a3a'; ctx.lineWidth = 2;
    ctx.strokeRect(x + 12, y + 12, w - 24, h - 24);
  } else if (mat === 'dirt') {
    for (let i = 0; i < (w * h) / 200; i++) {
      const px = x + hashN(i, 31) * w, py = y + hashN(13, i) * h;
      ctx.fillStyle = hashN(i, 5) > 0.6 ? PAL.dirtLight : '#211a13';
      ctx.fillRect(px, py, 3 + hashN(i, 2) * 4, 2);
    }
  } else {
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#31363d';
    for (let i = 0; i < (w * h) / 320; i++) { const px = x + hashN(i, 3) * w, py = y + hashN(i, 9) * h; ctx.fillRect(px, py, 5, 3); }
  }
  ctx.globalAlpha = 1;
  /* a floorboard sheen where a light is on */
  if (light > 0.12) {
    const g = ctx.createRadialGradient(x + w / 2, y + h / 2, 4, x + w / 2, y + h / 2, Math.max(w, h) * 0.72);
    g.addColorStop(0, `rgba(255,226,180,${0.09 * light})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

/* ---------------- walls / doors ---------------- */
export function drawWalls(ctx, rooms, doors, t, opts = {}) {
  const { wall = 7, distorting = new Set() } = opts;
  for (const id in rooms) {
    const r = rooms[id];
    if (r.outside) continue;
    ctx.save();
    ctx.strokeStyle = PAL.wall; ctx.lineWidth = wall; ctx.lineCap = 'square';
    ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.stroke();
    ctx.strokeStyle = PAL.wallTop; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.rect(r.x + 1.6, r.y + 1.6, r.w - 3.2, r.h - 3.2); ctx.stroke();
    ctx.restore();
  }
  /* cut the doorways out, then draw frames + leaves */
  for (const d of doors) {
    const a = rooms[d.a], b = rooms[d.b];
    if (!a || !b) continue;
    const angle = doorAngle(d, a, b);
    ctx.save();
    ctx.translate(d.ax, d.ay); ctx.rotate(angle);
    if (!a.outside) { ctx.fillStyle = PAL.void; ctx.fillRect(-11, -wall - 2, 22, wall + 5); }
    ctx.restore();
    ctx.save();
    ctx.translate(d.bx, d.by); ctx.rotate(angle);
    if (!b.outside) { ctx.fillStyle = PAL.void; ctx.fillRect(-11, -wall - 2, 22, wall + 5); }
    ctx.restore();
    drawDoorLeaf(ctx, d, t, distorting.has(d.id));
  }
}

function doorAngle(d, a, b) {
  const dx = d.bx - d.ax, dy = d.by - d.ay;
  if (d.kind === 'stair') return Math.atan2(dy, dx);
  return Math.abs(dx) > Math.abs(dy) ? 0 : Math.PI / 2;
}

export function drawDoorLeaf(ctx, d, t, distorting = false) {
  const wall = 7;
  const wob = d.noise > 0.05 ? Math.sin(t * 22) * d.noise * 1.6 : 0;
  for (const side of ['a', 'b']) {
    const px = d[side + 'x'], py = d[side + 'y'];
    ctx.save(); ctx.translate(px, py); ctx.rotate(doorAngle(d) + wob * 0.02);
    /* frame */
    ctx.strokeStyle = distorting ? PAL.cold : '#4a3a24'; ctx.lineWidth = 1.6;
    ctx.strokeRect(-11, -wall / 2 - 1, 22, wall + 2);
    if (d.kind === 'stair') {
      ctx.strokeStyle = '#5d4a2e'; ctx.lineWidth = 2;
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 3.2, -5); ctx.lineTo(i * 3.2, 5); ctx.stroke(); }
      ctx.fillStyle = 'rgba(150,190,205,0.25)'; ctx.fillRect(-11, -4, 22, 8);
      ctx.restore(); continue;
    }
    /* the leaf, swung by open/closed */
    const openAmt = d.open ? clamp01(0.85 + (d.swing || 0) * 0.15) : clamp01((d.swing || 0) * 0.6);
    ctx.save();
    ctx.rotate(-openAmt * 1.35 * (side === 'a' ? 1 : -1));
    const leaf = d.broken ? '#3c2c1d' : '#4b3826';
    ctx.fillStyle = leaf; ctx.fillRect(0, -1.6, 20, 3.4);
    ctx.strokeStyle = '#2a1f14'; ctx.lineWidth = 0.8; ctx.strokeRect(0, -1.6, 20, 3.4);
    if (!d.broken) { ctx.fillStyle = PAL.brass; ctx.fillRect(16, -0.6, 1.6, 1.2); }
    ctx.restore();
    /* lock / seal / jam marks */
    if (d.locked > 0) { ctx.fillStyle = d.lockedBy === 'house' ? PAL.cold : PAL.warn; ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, 6.3); ctx.fill(); }
    if (d.seal > 0) {
      ctx.fillStyle = 'rgba(9,10,14,0.94)';
      rr(ctx, -12, -6, 24, 12, 4); ctx.fill();
      ctx.strokeStyle = `rgba(150,220,235,${0.28 + Math.sin(t * 3) * 0.12})`; ctx.lineWidth = 1; ctx.stroke();
    }
    if (d.broken && d.jam > 0.3) { ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-8, -5); ctx.lineTo(8, 5); ctx.stroke(); }
    ctx.restore();
  }
}

/* ---------------- furniture / fixtures ---------------- */
export function drawProp(ctx, p, t, room) {
  const x = p.x, y = p.y, w = p.w, h = p.h;
  const cx = x + w / 2, cy = y + h / 2;
  ctx.save();
  if (p.rot) { ctx.translate(cx, cy); ctx.rotate(p.rot); ctx.translate(-cx, -cy); }
  if (p.taken) { ctx.globalAlpha = 0.18; ctx.strokeStyle = '#4a4a52'; ctx.setLineDash([3, 3]); ctx.strokeRect(x, y, w, h); ctx.setLineDash([]); ctx.restore(); return; }
  const shake = p.animated > 0 ? Math.sin(t * 30 + x) * 1.8 : 0;
  ctx.translate(shake, shake * 0.6);
  const shadow = () => { ctx.fillStyle = 'rgba(0,0,0,0.34)'; ctx.beginPath(); ctx.ellipse(cx, y + h + 1.5, w * 0.46, 3.4, 0, 0, 6.3); ctx.fill(); };
  const dark = p.broken ? '#2a2018' : null;
  switch (p.draw) {
    case 'table': case 'long_table': case 'desk': case 'workbench': case 'counter': case 'ironing': case 'saw_horse': {
      shadow();
      const top = p.draw === 'counter' ? '#4c4033' : p.draw === 'workbench' ? '#5a4128' : '#5c452c';
      fillRR(ctx, x, y, w, h, 2.5, dark || top, '#20170f', 1.2);
      ctx.fillStyle = 'rgba(255,235,200,0.08)'; ctx.fillRect(x + 1, y + 1, w - 2, Math.max(1.5, h * 0.28));
      ctx.fillStyle = '#2b1f14';
      const lw = Math.min(5, w * 0.12);
      ctx.fillRect(x + 2, y + h - lw - 1, lw, lw); ctx.fillRect(x + w - lw - 2, y + h - lw - 1, lw, lw);
      if (p.draw === 'long_table') { ctx.fillStyle = '#efe6d2'; for (let i = 0; i < Math.floor(w / 22); i++) { ctx.beginPath(); ctx.ellipse(x + 12 + i * 22, cy, 3.4, 2.2, 0, 0, 6.3); ctx.fill(); } }
      if (p.draw === 'desk') { fillRR(ctx, x + w * 0.55, y + h * 0.2, w * 0.36, h * 0.55, 1.5, '#3c2c1c', '#20170f', 1); ctx.fillStyle = '#d8cbb0'; ctx.fillRect(x + w * 0.08, y + h * 0.3, w * 0.3, h * 0.16); }
      if (p.draw === 'workbench') { ctx.fillStyle = '#8a7c62'; for (let i = 0; i < 5; i++) ctx.fillRect(x + 4 + i * (w / 5), y + 3, 3, 2); }
      break;
    }
    case 'chair': case 'highchair': case 'stool': {
      shadow();
      const seat = '#4a3a55';
      fillRR(ctx, x + 2, y + 2, w - 4, h - 4, 2, dark || seat, '#1b1620', 1);
      ctx.fillStyle = '#6d5a78'; ctx.fillRect(x + 2, y + 2, w - 4, Math.max(2, h * 0.22));
      ctx.fillStyle = '#241d2b'; ctx.fillRect(x + 3, y + h - 5, 2.4, 3.4); ctx.fillRect(x + w - 5.4, y + h - 5, 2.4, 3.4);
      break;
    }
    case 'sofa': case 'settee': {
      shadow();
      fillRR(ctx, x, y, w, h, 4, dark || '#5a3340', '#20111a', 1.2);
      ctx.fillStyle = '#6e4152'; fillRR(ctx, x + 2, y + 2, w - 4, h * 0.42, 3, ctx.fillStyle);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
      for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x + (w / 3) * i, y + h * 0.45); ctx.lineTo(x + (w / 3) * i, y + h - 2); ctx.stroke(); }
      break;
    }
    case 'bed': case 'crib': {
      shadow();
      const frame = p.draw === 'crib' ? '#4a3520' : '#3d2c22';
      fillRR(ctx, x, y, w, h, 3, dark || frame, '#181009', 1.3);
      ctx.fillStyle = p.draw === 'crib' ? 'rgba(0,0,0,0)' : '#6f5566';
      if (p.draw !== 'crib') { fillRR(ctx, x + 3, y + 3, w - 6, h - 6, 2, ctx.fillStyle); }
      ctx.fillStyle = '#c8c3d0'; fillRR(ctx, x + 5, y + 5, w * 0.36, h - 10, 2, ctx.fillStyle); /* pillow */
      if (p.draw === 'crib') {
        ctx.strokeStyle = '#6b533a'; ctx.lineWidth = 1.2;
        for (let i = 0; i < w; i += 5) { ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i, y + h); ctx.stroke(); }
      }
      ctx.fillStyle = '#4b3a49'; ctx.fillRect(x + 3, y + h * 0.62, w - 6, h * 0.3);
      break;
    }
    case 'wardrobe': case 'dresser': case 'cabinet': case 'sideboard': case 'safe': case 'trunk': case 'suitcase': case 'lockbox': {
      shadow();
      const tall = p.draw === 'wardrobe' || p.draw === 'dresser' || p.draw === 'cabinet' || p.draw === 'sideboard';
      const body = p.draw === 'safe' ? '#3b4149' : p.draw === 'trunk' ? '#4a3323' : '#43301f';
      fillRR(ctx, x, y, w, h, 2.5, dark || body, '#170f09', 1.2);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1;
      if (tall) { ctx.beginPath(); ctx.moveTo(x + w / 2, y + 2); ctx.lineTo(x + w / 2, y + h - 2); ctx.stroke(); ctx.fillStyle = PAL.brass; ctx.fillRect(x + w / 2 - 3, cy, 1.6, 1.6); ctx.fillRect(x + w / 2 + 1.4, cy, 1.6, 1.6); }
      else if (p.draw === 'dresser' || p.draw === 'sideboard') { for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x + 2, y + (h / 3) * i); ctx.lineTo(x + w - 2, y + (h / 3) * i); ctx.stroke(); } }
      else { ctx.strokeRect(x + 3, y + 3, w - 6, h - 6); ctx.fillStyle = '#8d7a52'; ctx.fillRect(cx - 2, y + 2, 4, 2.4); }
      if (p.draw === 'safe') { ctx.strokeStyle = '#93a1b0'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(cx, cy, Math.min(w, h) * 0.24, 0, 6.3); ctx.stroke(); }
      if (p.opened) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x + 2, y + 2, w - 4, Math.max(2, h * 0.3)); }
      if (p.state.lit) { ctx.fillStyle = 'rgba(224,161,58,0.5)'; ctx.fillRect(x + 2, y + 2, w - 4, h - 4); }
      break;
    }
    case 'bookshelf': case 'shelf': {
      shadow();
      fillRR(ctx, x, y, w, h, 2, dark || '#33251a', '#150e08', 1.1);
      const rows = Math.max(2, Math.floor(h / 12));
      for (let i = 0; i < rows; i++) {
        const ry = y + 3 + i * ((h - 6) / rows);
        ctx.fillStyle = '#1d140d'; ctx.fillRect(x + 2, ry + (h - 6) / rows - 2.4, w - 4, 1.6);
        for (let b = 0; b < Math.floor((w - 6) / 3.6); b++) {
          if (hashN(b, i + x) > 0.82) continue;
          ctx.fillStyle = ['#6b3a34', '#42536b', '#5c6b3a', '#6a5a34', '#4a3a5e'][Math.floor(hashN(b * 3, i) * 5)];
          ctx.fillRect(x + 3 + b * 3.6, ry, 2.6, (h - 6) / rows - 3);
        }
      }
      break;
    }
    case 'fireplace': {
      fillRR(ctx, x, y, w, h, 2, '#2b2b31', '#101014', 1.3);
      ctx.fillStyle = '#1a1a1f'; rr(ctx, x + 6, y + 5, w - 12, h - 6, 2); ctx.fill();
      const fire = room?.fire || 0;
      if (fire > 0.02) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 5; i++) {
          const fx = x + w / 2 + Math.sin(t * 6 + i) * (w * 0.16), fy = y + h - 6 - i * 3 - Math.sin(t * 9 + i) * 2;
          ctx.fillStyle = `rgba(${220 - i * 16},${110 - i * 12},40,${(0.5 - i * 0.08) * fire})`;
          ctx.beginPath(); ctx.ellipse(fx, fy, 6 - i, 8 - i * 1.4, 0, 0, 6.3); ctx.fill();
        }
        ctx.restore();
      } else { ctx.fillStyle = '#241a12'; ctx.fillRect(x + 9, y + h - 7, w - 18, 3); }
      ctx.fillStyle = '#3d3d45'; ctx.fillRect(x - 2, y - 3, w + 4, 3.4);
      break;
    }
    case 'piano': {
      shadow();
      fillRR(ctx, x, y, w, h * 0.66, 3, dark || '#221b1a', '#0b0808', 1.2);
      ctx.fillStyle = '#e8e4dc'; ctx.fillRect(x + 4, y + h * 0.6, w - 8, h * 0.16);
      ctx.fillStyle = '#141213';
      for (let i = 0; i < Math.floor((w - 8) / 4); i++) if (i % 3 !== 1) ctx.fillRect(x + 4 + i * 4, y + h * 0.6, 1.4, h * 0.1);
      ctx.fillStyle = '#2b2220'; fillRR(ctx, x + w * 0.1, y + h * 0.78, w * 0.8, h * 0.2, 2, ctx.fillStyle);
      break;
    }
    case 'mirror': {
      ctx.save();
      fillRR(ctx, x, y, w, h, 2, '#7e8ea0', '#4a3a24', 2.2);
      const g = ctx.createLinearGradient(x, y, x + w, y + h);
      g.addColorStop(0, 'rgba(255,255,255,0.42)'); g.addColorStop(0.5, 'rgba(160,190,205,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0.2)');
      ctx.fillStyle = g; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
      if (p.state.off || p.state.covered) { ctx.fillStyle = '#4b4436'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2); ctx.strokeStyle = '#2e2a20'; ctx.strokeRect(x - 1, y - 1, w + 2, h + 2); }
      if (p.broken) {
        ctx.strokeStyle = 'rgba(15,18,22,0.9)'; ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x + hashN(i, 1) * w, y); ctx.lineTo(x + hashN(i, 2) * w, y + h); ctx.stroke(); }
      }
      ctx.restore();
      break;
    }
    case 'lamp': case 'ceiling_lamp': case 'hanglamp': case 'chandelier': case 'candles': {
      const on = !p.state.off && (room ? room.light > 0.1 : true) || p.state.lit;
      const r = Math.max(4, Math.min(w, h) * 0.5);
      if (p.draw === 'chandelier') {
        ctx.strokeStyle = '#4a4335'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy - r - 6); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.55, 0, 0, 6.3); ctx.stroke();
      }
      if (p.draw === 'candles') { ctx.fillStyle = '#ded4bd'; for (let i = 0; i < 3; i++) ctx.fillRect(x + 2 + i * 4.4, y + 2, 2.4, h - 4); }
      if (on) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(cx, cy, 0.5, cx, cy, r * (p.draw === 'chandelier' ? 5.2 : 3.4));
        const flick = 0.72 + Math.sin(t * 7 + x) * 0.08;
        g.addColorStop(0, `rgba(255,214,146,${0.5 * flick})`); g.addColorStop(0.4, `rgba(226,164,86,${0.16 * flick})`); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r * (p.draw === 'chandelier' ? 5.2 : 3.4), 0, 6.3); ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = on ? '#f2d9a0' : '#4d4a44';
      ctx.beginPath(); ctx.arc(cx, cy, Math.max(2, r * 0.42), 0, 6.3); ctx.fill();
      ctx.strokeStyle = '#332d24'; ctx.lineWidth = 1; ctx.stroke();
      if (p.broken) { ctx.strokeStyle = '#20242c'; ctx.beginPath(); ctx.moveTo(cx - 3, cy - 3); ctx.lineTo(cx + 3, cy + 3); ctx.stroke(); }
      break;
    }
    case 'rug': {
      ctx.save(); ctx.globalAlpha = 0.82;
      fillRR(ctx, x, y, w, h, 6, '#4a3345', '#2a1d28', 1.6);
      ctx.globalAlpha = 0.5; ctx.strokeStyle = '#8a6a52'; ctx.lineWidth = 1.2;
      ctx.strokeRect(x + 6, y + 6, w - 12, h - 12);
      ctx.beginPath(); ctx.ellipse(cx, cy, Math.min(w, h) * 0.22, Math.min(w, h) * 0.16, 0, 0, 6.3); ctx.stroke();
      ctx.restore();
      break;
    }
    case 'portrait': case 'drawings': {
      fillRR(ctx, x, y, w, h, 1.5, '#2c2620', '#6a5537', 2);
      const px = x + 2, py = y + 2, pw = Math.max(2, w - 4), ph = Math.max(2, h - 4);
      if (p.draw === 'portrait') {
        ctx.fillStyle = '#3a3742'; ctx.fillRect(px, py, pw, ph);
        ctx.fillStyle = '#c7a783'; ctx.beginPath(); ctx.ellipse(px + pw / 2, py + ph * 0.34, Math.min(pw, ph) * 0.19, Math.min(pw, ph) * 0.24, 0, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#25222a'; ctx.fillRect(px + pw * 0.2, py + ph * 0.55, pw * 0.6, ph * 0.45);
        if (p.moved) { ctx.save(); ctx.translate(px + pw / 2, py + ph * 0.34); ctx.rotate(Math.sin(t * 2) * 0.05); ctx.fillStyle = 'rgba(180,60,60,0.55)'; ctx.fillRect(-2, -1, 4, 2); ctx.restore(); }
      } else {
        ctx.fillStyle = '#c9c2ae'; ctx.fillRect(px, py, pw, ph);
        ctx.strokeStyle = '#4a4740'; ctx.lineWidth = 0.8;
        for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(px + 1, py + 3 + i * (ph / 6)); ctx.lineTo(px + pw - 1, py + 6 + i * (ph / 6)); ctx.stroke(); }
      }
      break;
    }
    case 'plant': {
      shadow();
      fillRR(ctx, x + w * 0.2, y + h * 0.6, w * 0.6, h * 0.4, 2, '#6a4a34', '#2a1c12', 1);
      ctx.fillStyle = '#3c5c3a';
      for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28 + Math.sin(t * 0.6) * 0.06; ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * w * 0.2, cy - h * 0.1 + Math.sin(a) * h * 0.16, 4.4, 2.4, a, 0, 6.3); ctx.fill(); }
      break;
    }
    case 'crate': case 'boxes': case 'sacks': {
      shadow();
      const boxes = p.draw === 'boxes' ? 3 : 1;
      for (let i = 0; i < boxes; i++) {
        const bw = w / boxes, bh = h * (0.7 + hashN(i, x) * 0.3);
        fillRR(ctx, x + i * bw + 0.6, y + h - bh, bw - 1.4, bh, 1.5, p.draw === 'sacks' ? '#5b4f38' : '#4a3826', '#1a1209', 1);
        if (p.draw !== 'sacks') { ctx.strokeStyle = '#6b512f'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(x + i * bw + 1.4, y + h - bh * 0.5); ctx.lineTo(x + (i + 1) * bw - 1.4, y + h - bh * 0.5); ctx.stroke(); }
      }
      break;
    }
    case 'barrel': {
      shadow();
      ctx.fillStyle = '#4a3520'; ctx.beginPath(); ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, 6.3); ctx.fill();
      ctx.strokeStyle = '#8a8071'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.ellipse(cx, cy - h * 0.18, w * 0.44, h * 0.12, 0, 0, 6.3); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx, cy + h * 0.18, w * 0.44, h * 0.12, 0, 0, 6.3); ctx.stroke();
      ctx.strokeStyle = '#231708'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, 6.3); ctx.stroke();
      break;
    }
    case 'doll': case 'dollhouse': case 'rocking_horse': case 'toys': {
      shadow();
      if (p.draw === 'dollhouse') {
        fillRR(ctx, x, y + h * 0.24, w, h * 0.76, 2, '#5b4230', '#1c130b', 1.2);
        ctx.fillStyle = '#6b2f33'; ctx.beginPath(); ctx.moveTo(x - 1, y + h * 0.26); ctx.lineTo(cx, y); ctx.lineTo(x + w + 1, y + h * 0.26); ctx.closePath(); ctx.fill();
        for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { ctx.fillStyle = '#15100a'; ctx.fillRect(x + 5 + i * (w * 0.44), y + h * 0.4 + j * (h * 0.26), w * 0.28, h * 0.2); }
        ctx.fillStyle = '#c9b48a';
        for (let i = 0; i < 4; i++) ctx.fillRect(x + 6 + i * (w / 4.4), y + h * 0.46 + (i % 2) * h * 0.26, 2.4, 2.4);
      } else if (p.draw === 'rocking_horse') {
        ctx.strokeStyle = '#5c4326'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(cx, y + h - 3, w * 0.42, 3.4, 0, 0.15, Math.PI - 0.15); ctx.stroke();
        fillRR(ctx, x + w * 0.2, y + h * 0.3, w * 0.6, h * 0.4, 3, '#6a5138', '#241a10', 1);
        ctx.fillStyle = '#c8b48c'; ctx.fillRect(x + w * 0.62, y + h * 0.16, w * 0.2, h * 0.22);
        ctx.fillStyle = '#8d5b5b'; ctx.fillRect(x + w * 0.24, y + h * 0.24, w * 0.34, h * 0.1);
      } else if (p.draw === 'toys') {
        for (let i = 0; i < 5; i++) { ctx.fillStyle = ['#b0483f', '#4d7a99', '#c9a25a', '#6c8c53'][i % 4]; ctx.fillRect(x + i * (w / 5), y + h * (0.3 + (i % 2) * 0.3), w / 6, h / 3); }
      } else {
        /* doll: pale head, dark eyes, dress - reads at 12px */
        ctx.fillStyle = '#5d4257'; ctx.beginPath(); ctx.ellipse(cx, y + h * 0.72, w * 0.42, h * 0.3, 0, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#d8c6ae'; ctx.beginPath(); ctx.arc(cx, y + h * 0.3, Math.max(2.4, w * 0.28), 0, 6.3); ctx.fill();
        ctx.fillStyle = '#2a1f1a';
        ctx.beginPath(); ctx.arc(cx - w * 0.1, y + h * 0.28, Math.max(0.7, w * 0.06), 0, 6.3); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + w * 0.1, y + h * 0.28, Math.max(0.7, w * 0.06), 0, 6.3); ctx.fill();
        ctx.fillStyle = '#3b2a2a'; ctx.fillRect(cx - w * 0.06, y + h * 0.4, w * 0.12, 1);
        ctx.fillStyle = '#8d6b4a'; ctx.beginPath(); ctx.ellipse(cx, y + h * 0.14, w * 0.3, h * 0.12, 0, 0, 6.3); ctx.fill();
        if (p.moved || p.animated > 0) { ctx.strokeStyle = 'rgba(180,220,235,0.5)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(cx, cy, Math.max(w, h) * 0.7, 0, 6.3); ctx.stroke(); }
      }
      break;
    }
    case 'stove': case 'fridge': case 'washer': case 'boiler': {
      shadow();
      const body = p.draw === 'fridge' ? '#4b5560' : p.draw === 'boiler' ? '#3d3a36' : '#3a3f45';
      fillRR(ctx, x, y, w, h, 2.5, dark || body, '#12161a', 1.3);
      ctx.fillStyle = '#22272c'; ctx.fillRect(x + 3, y + 3, w - 6, h * 0.32);
      if (p.draw === 'stove' || p.draw === 'boiler' || p.draw === 'washer') {
        ctx.strokeStyle = '#8fa2b0'; ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x + 6 + i * 6, y + 6, 2, 0, 6.3); ctx.stroke(); }
      }
      if (p.draw === 'boiler') {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(cx, y + h * 0.7, 1, cx, y + h * 0.7, w * 0.5);
        g.addColorStop(0, 'rgba(226,130,50,0.42)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(x, y, w, h); ctx.restore();
        ctx.fillStyle = '#c86a2a'; ctx.fillRect(x + w * 0.3, y + h * 0.62, w * 0.4, h * 0.18);
      }
      ctx.fillStyle = '#9aa7b3'; ctx.fillRect(x + w - 6, y + h * 0.5, 2, 4);
      break;
    }
    case 'sink': case 'tub': case 'toilet': case 'basket': case 'buckets': case 'bathtub': {
      if (p.draw === 'toilet') {
        fillRR(ctx, x, y + h * 0.3, w, h * 0.7, 3, '#a9b3ba', '#3a4148', 1.1);
        fillRR(ctx, x + w * 0.1, y, w * 0.8, h * 0.36, 2, '#8f9aa2', '#3a4148', 1);
        ctx.fillStyle = '#6f8a99'; ctx.beginPath(); ctx.ellipse(cx, y + h * 0.68, w * 0.28, h * 0.18, 0, 0, 6.3); ctx.fill();
      } else {
        fillRR(ctx, x, y, w, h, 3, '#9fb0b8', '#39434a', 1.2);
        ctx.fillStyle = '#5e7885'; fillRR(ctx, x + 3, y + 3, w - 6, h - 6, 2, ctx.fillStyle);
        ctx.fillStyle = 'rgba(210,236,244,0.35)'; ctx.beginPath(); ctx.ellipse(cx, cy, w * 0.22, h * 0.16, 0, 0, 6.3); ctx.fill();
        ctx.strokeStyle = '#c9d6dd'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x + w * 0.2, y + 2); ctx.lineTo(x + w * 0.2, y - 3); ctx.stroke();
        if (room && (room.wet > 0.05 || p.draw === 'tub')) { ctx.fillStyle = 'rgba(120,180,200,0.25)'; ctx.fillRect(x - 4, y + h, w + 8, 5); }
      }
      break;
    }
    case 'pipes': case 'rack': case 'hanging': case 'chain': {
      ctx.strokeStyle = '#6d6f76'; ctx.lineWidth = p.draw === 'pipes' ? 4 : 2;
      ctx.beginPath();
      if (p.draw === 'pipes') { ctx.moveTo(x, y + 2); ctx.lineTo(x + w, y + 2); ctx.moveTo(x + w * 0.3, y + 2); ctx.lineTo(x + w * 0.3, y + h + 8); }
      else if (p.draw === 'hanging' || p.draw === 'chain') { ctx.moveTo(cx, y); ctx.lineTo(cx, y + h); }
      else { ctx.moveTo(x, cy); ctx.lineTo(x + w, cy); ctx.moveTo(x, y + 3); ctx.lineTo(x + w, y + 3); }
      ctx.stroke();
      if (p.draw === 'hanging') { ctx.fillStyle = '#7a6b52'; ctx.beginPath(); ctx.ellipse(cx, y + h, 5, 7, 0, 0, 6.3); ctx.fill(); }
      break;
    }
    case 'radio': case 'typewriter': case 'globe': case 'fusebox': {
      fillRR(ctx, x, y, w, h, 2, '#4a4038', '#191512', 1.2);
      if (p.draw === 'radio') {
        ctx.fillStyle = '#2b2f2a'; ctx.fillRect(x + 2, y + 2, w * 0.5, h - 4);
        ctx.fillStyle = p.state.off ? '#5a6058' : '#8fd07a';
        ctx.beginPath(); ctx.arc(x + w - 5, y + h / 2, 2, 0, 6.3); ctx.fill();
        if (p.state.on) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(120,220,140,0.25)'; ctx.fillRect(x - 6, y - 6, w + 12, h + 12); ctx.restore(); }
      } else if (p.draw === 'globe') {
        ctx.fillStyle = '#3f5a6b'; ctx.beginPath(); ctx.arc(cx, cy - 2, Math.min(w, h) * 0.42, 0, 6.3); ctx.fill();
        ctx.strokeStyle = '#a8863f'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx, cy - 2, Math.min(w, h) * 0.46, 0.4, 2.7); ctx.stroke();
        ctx.fillStyle = '#3a2a1a'; ctx.fillRect(cx - 3, y + h - 4, 6, 3);
      } else if (p.draw === 'fusebox') {
        ctx.strokeStyle = '#9aa7b3'; ctx.lineWidth = 1; ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
        ctx.fillStyle = p.state.off ? '#c04a3c' : '#79b98a'; ctx.fillRect(x + w * 0.3, y + h * 0.35, w * 0.4, h * 0.3);
      } else {
        ctx.fillStyle = '#2a2a2e'; for (let i = 0; i < 6; i++) ctx.fillRect(x + 3 + i * 3, y + h * 0.4, 2, 2);
      }
      break;
    }
    case 'jars': case 'dishes': case 'pans': case 'bowls': case 'towels': {
      for (let i = 0; i < Math.max(2, Math.floor(w / 8)); i++) {
        const jw = w / Math.max(2, Math.floor(w / 8));
        ctx.fillStyle = p.draw === 'dishes' ? '#c9d2d8' : p.draw === 'towels' ? '#8f8676' : 'rgba(150,190,190,0.75)';
        fillRR(ctx, x + i * jw + 1, y + 2, jw - 2, h - 3, 1.6, ctx.fillStyle, 'rgba(0,0,0,0.4)', 0.7);
        if (p.draw === 'jars') { ctx.fillStyle = '#5d6b3a'; ctx.fillRect(x + i * jw + 2.4, y + h * 0.4, jw - 5, h * 0.38); }
      }
      break;
    }
    case 'coal': case 'wetmark': case 'floorboard': case 'stairs_glyph': case 'hollowwall': {
      if (p.draw === 'wetmark') {
        ctx.save(); ctx.globalAlpha = 0.42 + Math.sin(t * 1.4) * 0.06;
        ctx.fillStyle = '#2c4752'; ctx.beginPath(); ctx.ellipse(cx, cy, w * 0.55, h * 0.5, 0.4, 0, 6.3); ctx.fill();
        ctx.globalAlpha = 0.6; ctx.fillStyle = 'rgba(180,220,235,0.35)';
        ctx.beginPath(); ctx.ellipse(cx - w * 0.1, cy - h * 0.1, w * 0.2, h * 0.14, 0, 0, 6.3); ctx.fill(); ctx.restore();
      } else if (p.draw === 'coal') {
        for (let i = 0; i < 22; i++) { const cxx = x + hashN(i, 1) * w, cyy = y + hashN(i, 2) * h; ctx.fillStyle = i % 3 ? '#26262b' : '#3a3a41'; ctx.fillRect(cxx, cyy, 3.4, 2.6); }
      } else if (p.draw === 'floorboard') {
        ctx.strokeStyle = '#5c4830'; ctx.lineWidth = 1.2; ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = p.opened ? '#120d08' : '#3b2c1e'; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
        if (p.opened) { ctx.fillStyle = 'rgba(200,170,110,0.25)'; ctx.fillRect(x + 2, y + 2, w - 4, 2); }
      } else if (p.draw === 'stairs_glyph') {
        ctx.strokeStyle = '#6b5c46'; ctx.lineWidth = 1.4;
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x, y + i * 4); ctx.lineTo(x + w, y + i * 4); ctx.stroke(); }
      } else {
        ctx.fillStyle = '#3a3a41'; ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#5b5f68'; ctx.lineWidth = 1; for (let i = 0; i < 3; i++) ctx.strokeRect(x + 1, y + 2 + i * 18, w - 2, 14);
      }
      break;
    }
    case 'crate_stack': case 'shelf_s': {
      fillRR(ctx, x, y, w, h, 2, '#42311f', '#191109', 1.1); break;
    }
    case 'window': case 'door_plate': {
      fillRR(ctx, x, y, w, h, 1.5, '#1b2733', '#5a4a30', 2);
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, 'rgba(120,150,190,0.35)'); g.addColorStop(1, 'rgba(30,44,60,0.2)');
      ctx.fillStyle = g; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
      ctx.strokeStyle = 'rgba(90,74,48,0.9)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx, y + 2); ctx.lineTo(cx, y + h - 2); ctx.moveTo(x + 2, cy); ctx.lineTo(x + w - 2, cy); ctx.stroke();
      if (p.broken) { ctx.fillStyle = PAL.void; ctx.fillRect(x + 3, y + 3, w - 6, h - 6); ctx.strokeStyle = '#9fb6c4'; ctx.beginPath(); ctx.moveTo(x + 3, y + 3); ctx.lineTo(x + w - 3, y + h - 3); ctx.stroke(); }
      break;
    }
    case 'curtain': {
      ctx.fillStyle = '#4a3345'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      for (let i = 0; i < h; i += 6) ctx.fillRect(x, y + i, w, 1.6);
      break;
    }
    case 'columns': case 'column': case 'newel_post': {
      ctx.fillStyle = '#3d3327'; ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(3, w * 0.4), Math.max(3, h * 0.4), 0, 0, 6.3); ctx.fill();
      ctx.strokeStyle = '#5c4a33'; ctx.lineWidth = 1; ctx.stroke();
      break;
    }
    case 'rack': {
      ctx.strokeStyle = '#5a5147'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x + w, cy); ctx.stroke();
      ctx.fillStyle = '#6b5f74';
      for (let i = 0; i < 4; i++) { ctx.fillRect(x + 3 + i * (w / 4.4), cy, 3, h * 0.5); }
      break;
    }
    case 'tools': case 'vise': {
      ctx.strokeStyle = '#8b8578'; ctx.lineWidth = 1.2;
      for (let i = 0; i < Math.max(3, Math.floor(w / 7)); i++) { const tx = x + 3 + i * 7; ctx.beginPath(); ctx.moveTo(tx, y); ctx.lineTo(tx + 1.5, y + h); ctx.stroke(); }
      break;
    }
    case 'smoke': case 'smudge': {
      ctx.fillStyle = 'rgba(190,190,200,0.16)';
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(cx + Math.sin(t + i) * 6, cy - i * 5 - (t * 8) % 20, 4 + i, 0, 6.3); ctx.fill(); }
      break;
    }
    case 'covered': {
      ctx.fillStyle = '#5f5a4e';
      ctx.beginPath();
      ctx.moveTo(x, y + h); ctx.lineTo(x + 3, y + 4); ctx.lineTo(cx, y); ctx.lineTo(x + w - 3, y + 4); ctx.lineTo(x + w, y + h);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(x + 4, y + 6, w * 0.3, h * 0.24);
      break;
    }
    case 'clock': {
      /* grandfather clock: case, hood, dial, and a pendulum that keeps its own time */
      shadow();
      fillRR(ctx, x, y + h * 0.16, w, h * 0.84, 2, dark || '#4a3320', '#150f08', 1.3);
      ctx.beginPath();
      ctx.moveTo(x, y + h * 0.2); ctx.lineTo(x + w * 0.5, y); ctx.lineTo(x + w, y + h * 0.2); ctx.closePath();
      ctx.fillStyle = dark || '#573b24'; ctx.fill(); ctx.strokeStyle = '#160f08'; ctx.lineWidth = 1; ctx.stroke();
      const dw = w * 0.62, dx = x + (w - dw) / 2, dy = y + h * 0.24;
      ctx.fillStyle = '#0f0c09'; ctx.fillRect(x + 1.5, dy + dw * 0.9, w - 3, h * 0.44);
      ctx.save();
      ctx.beginPath(); ctx.rect(x + 1.5, dy + dw * 0.9, w - 3, h * 0.44); ctx.clip();
      ctx.strokeStyle = '#6d5a3a'; ctx.lineWidth = 0.8;
      const swing = p.broken ? 0 : Math.sin(t * 1.6) * 0.3;
      ctx.beginPath(); ctx.moveTo(x + w / 2, dy + dw * 0.92);
      ctx.lineTo(x + w / 2 + Math.sin(swing) * h * 0.3, dy + dw * 0.92 + Math.cos(swing) * h * 0.3); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + w / 2 + Math.sin(swing) * h * 0.3, dy + dw * 0.92 + Math.cos(swing) * h * 0.3, 2.6, 0, 6.3);
      ctx.fillStyle = '#c9a24a'; ctx.fill();
      ctx.restore();
      ctx.beginPath(); ctx.arc(dx + dw / 2, dy + dw / 2, dw / 2, 0, 6.3);
      ctx.fillStyle = p.broken ? '#3a3128' : '#ded2b4'; ctx.fill();
      ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 1.2; ctx.stroke();
      if (!p.broken) {
        ctx.strokeStyle = '#20211f'; ctx.lineWidth = 0.9;
        const ang = (t * 0.18) % 6.3;
        ctx.beginPath(); ctx.moveTo(dx + dw / 2, dy + dw / 2);
        ctx.lineTo(dx + dw / 2 + Math.cos(ang - 1.57) * dw * 0.3, dy + dw / 2 + Math.sin(ang - 1.57) * dw * 0.3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(dx + dw / 2, dy + dw / 2);
        ctx.lineTo(dx + dw / 2 + Math.cos(ang * 0.083 - 1.57) * dw * 0.2, dy + dw / 2 + Math.sin(ang * 0.083 - 1.57) * dw * 0.2); ctx.stroke();
        for (let i = 0; i < 4; i++) {
          const a = i * 1.57;
          ctx.fillStyle = '#3a352a';
          ctx.fillRect(dx + dw / 2 + Math.cos(a) * dw * 0.38 - 0.7, dy + dw / 2 + Math.sin(a) * dw * 0.38 - 0.7, 1.4, 1.4);
        }
      } else {
        ctx.strokeStyle = 'rgba(20,16,12,0.9)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(dx + 2, dy + 3); ctx.lineTo(dx + dw - 3, dy + dw - 2); ctx.stroke();
      }
      break;
    }
    case 'stand': {
      /* umbrella / hat stand: a post, three arms, and whatever the house hung on them */
      shadow();
      fillRR(ctx, x + w * 0.28, y + h * 0.78, w * 0.44, h * 0.22, 1.5, dark || '#3d2f20', '#140f09', 1);
      ctx.strokeStyle = dark || '#5a4630'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(x + w / 2, y + h * 0.82); ctx.lineTo(x + w / 2 + (p.moved ? 1.6 : 0), y + h * 0.12); ctx.stroke();
      ctx.lineWidth = 1.4;
      const top = y + h * 0.16;
      for (const dx of [-1, 0, 1]) {
        ctx.beginPath();
        ctx.moveTo(x + w / 2, top + 2);
        ctx.quadraticCurveTo(x + w / 2 + dx * w * 0.34, top - 2, x + w / 2 + dx * w * 0.42, top + h * 0.1);
        ctx.stroke();
      }
      if (!p.broken) {
        ctx.strokeStyle = '#2b3038'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(x + w * 0.08, top + h * 0.12); ctx.quadraticCurveTo(x + w * 0.06, y + h * 0.6, x + w * 0.14, y + h * 0.72); ctx.stroke();
        ctx.fillStyle = '#3a4250';
        rr(ctx, x + w * 0.02, top + h * 0.04, w * 0.16, h * 0.1, 1.2); ctx.fill();
      }
      if (p.animated > 0) {
        ctx.strokeStyle = 'rgba(180,220,240,0.5)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, w * 0.7, 0, 6.3); ctx.stroke();
      }
      break;
    }
    default: {
      shadow();
      fillRR(ctx, x, y, w, h, 2, dark || '#43362a', '#17110b', 1.1);
      ctx.fillStyle = 'rgba(255,240,210,0.06)'; ctx.fillRect(x + 1, y + 1, w - 2, Math.max(1, h * 0.2));
    }
  }
  /* salt line drawn on top of whatever the floor is */
  ctx.restore();
}

/* ---------------- intruders ---------------- */
const FACE = {
  steady: { brow: 0, mouth: 0.05, eyes: 0.7 },
  uneasy: { brow: -0.35, mouth: -0.28, eyes: 1 },
  rattled: { brow: -0.7, mouth: -0.55, eyes: 1.25 },
  scared: { brow: -1.05, mouth: -0.85, eyes: 1.5 },
  terror: { brow: -1.45, mouth: -1.3, eyes: 1.85 },
  calm: { brow: 0.2, mouth: 0.28, eyes: 0.65 },
  down: { brow: -0.2, mouth: -0.4, eyes: 0.2 }
};
export function fearBand(who) {
  if (who.state === 'down') return 'down';
  if (who.fear > 82) return 'terror';
  if (who.fear > 62) return 'scared';
  if (who.fear > 42) return 'rattled';
  if (who.fear > 22) return 'uneasy';
  if (who.fear < 12 && who.resolve > 0.5) return 'calm';
  return 'steady';
}
export function drawPerson(ctx, who, t, opts = {}) {
  const { zoom = 1, showNames = true, selected = false, hovered = false, dim = 1 } = opts;
  const bob = who.state === 'down' ? 0 : Math.sin((who.step || 0) * 0.35) * 1.1;
  const r = 8 * (zoom > 1 ? 1.06 : 1);
  const x = who.x, y = who.y + bob;
  const band = fearBand(who);
  const pal = who.palette || {};
  ctx.save();
  ctx.globalAlpha = dim;
  /* ground shadow */
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.beginPath(); ctx.ellipse(x, y + r * 0.9, r * 0.92, r * 0.4, 0, 0, 6.3); ctx.fill();
  if (who.grabbed > 0) {
    ctx.strokeStyle = 'rgba(140,200,220,0.55)'; ctx.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x, y + r * 0.6, r * (1.1 + i * 0.5), r * (0.42 + i * 0.16), 0, 0, 6.3); ctx.stroke(); }
  }
  const jitterX = who.jitter > 0 ? Math.sin(t * 40) * who.jitter * 1.4 : 0;
  ctx.translate(jitterX, 0);
  /* body: shoulders + jacket */
  const lean = who.state === 'fleeing' ? 0.24 : band === 'terror' ? 0.14 : band === 'down' ? 0.5 : 0.04;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(lean * Math.cos(who.face || 0));
  fillRR(ctx, -r * 0.86, -r * 0.5, r * 1.72, r * 1.3, r * 0.5, pal.top || '#556', 'rgba(0,0,0,0.55)', 1);
  ctx.fillStyle = pal.accent || 'rgba(255,255,255,0.12)';
  ctx.fillRect(-r * 0.7, -r * 0.42, r * 1.4, r * 0.2);
  ctx.restore();
  /* head */
  ctx.save();
  ctx.translate(x, y - r * 0.55);
  const hx = Math.cos(who.face || 0) * r * 0.2, hy = Math.sin(who.face || 0) * r * 0.14;
  ctx.fillStyle = pal.skin || PAL.flesh;
  ctx.beginPath(); ctx.ellipse(hx, hy, r * 0.62, r * 0.58, 0, 0, 6.3); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.9; ctx.stroke();
  ctx.fillStyle = pal.hair || '#22201f';
  ctx.beginPath(); ctx.ellipse(hx, hy - r * 0.2, r * 0.6, r * 0.34, 0, Math.PI, 6.4); ctx.fill();
  if (zoom > 1.6) drawFace(ctx, band, hx, hy, r, who);
  else {
    ctx.fillStyle = band === 'terror' || band === 'scared' ? '#f6f2e8' : '#241f1c';
    const eyeOff = band === 'terror' ? 0.3 : 0.22;
    ctx.beginPath(); ctx.arc(hx - r * 0.2, hy + r * 0.02, r * eyeOff * 0.5, 0, 6.3); ctx.fill();
    ctx.beginPath(); ctx.arc(hx + r * 0.2, hy + r * 0.02, r * eyeOff * 0.5, 0, 6.3); ctx.fill();
  }
  ctx.restore();
  /* torch cone */
  const lit = (who.light || 0) > 0.05 || who.gearCurse <= 0 && (who.gear?.flashlight?.active || who.gear?.headlamp?.active);
  if (lit) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.translate(x, y); ctx.rotate(who.face || 0);
    const g = ctx.createLinearGradient(0, 0, 74 * zoom, 0);
    g.addColorStop(0, 'rgba(255,236,196,0.24)'); g.addColorStop(1, 'rgba(255,236,196,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 76 * zoom, -0.42, 0.42); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  /* gear pips */
  const pips = [];
  if (who.gear?.camera || who.gear?.vidcam || who.gear?.phone || who.gear?.streamrig) pips.push('camera');
  if (who.gear?.emf || who.gear?.thermal || who.gear?.recorder) pips.push('sensor');
  if (who.gear?.crowbar || who.gear?.lockpick) pips.push('pry');
  if (who.gear?.crucifix || who.gear?.exorcism || who.gear?.sage) pips.push('rite');
  if (who.gear?.sedative || who.gear?.firstaid) pips.push('kit');
  if (who.carrying?.evidence?.length) pips.push('file');
  if (who.carrying?.loot?.length) pips.push('loot');
  pips.slice(0, 4).forEach((k, i) => {
    ctx.fillStyle = k === 'file' ? PAL.warn : k === 'loot' ? PAL.brass : k === 'camera' ? '#c9d6dd' : k === 'sensor' ? '#93d7ea' : k === 'pry' ? '#a08466' : k === 'rite' ? '#dcd2b6' : '#8fb08a';
    ctx.beginPath(); ctx.arc(x - 6 + i * 4, y - r * 1.9, 1.5 * zoom, 0, 6.3); ctx.fill();
  });
  /* fear ring */
  const fr = clamp01(who.fear / 100);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = `rgba(${Math.round(lerp(90, 232, fr))},${Math.round(lerp(150, 70, fr))},${Math.round(lerp(180, 60, fr))},${0.3 + fr * 0.6})`;
  ctx.beginPath(); ctx.arc(x, y, r * 1.35, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fr); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r * 1.35, 0, 6.3);
  ctx.strokeStyle = `rgba(255,255,255,0.05)`; ctx.stroke();
  if (selected || hovered) {
    ctx.strokeStyle = selected ? 'rgba(232,196,106,0.95)' : 'rgba(200,220,235,0.6)';
    ctx.lineWidth = selected ? 1.8 : 1.2;
    ctx.beginPath(); ctx.arc(x, y, r * 1.85, 0, 6.3); ctx.stroke();
    if (selected) {
      ctx.beginPath(); ctx.moveTo(x - r * 1.85, x - x); /* no-op guard */
      ctx.moveTo(x, y - r * 2.5); ctx.lineTo(x, y - r * 2.0); ctx.stroke();
    }
  }
  if (showNames && zoom > 0.95) {
    ctx.font = `${Math.round(8.4 * zoom)}px ui-serif, Georgia, serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(6,8,11,0.72)';
    const label = who.name.length > 13 ? who.name.slice(0, 12) + '…' : who.name;
    const tw = ctx.measureText(label).width;
    fillRR(ctx, x - tw / 2 - 3, y + r * 1.5, tw + 6, 10 * zoom, 3, 'rgba(6,8,11,0.72)');
    ctx.fillStyle = band === 'terror' ? '#f0b7a4' : band === 'down' ? '#9aa2ad' : '#dfe6ee';
    ctx.fillText(label, x, y + r * 1.5 + 1);
    if (who.speak && zoom > 0.9) {
      ctx.font = `italic ${Math.round(8 * zoom)}px ui-serif, Georgia, serif`;
      ctx.fillStyle = 'rgba(226,232,240,0.86)';
      ctx.fillText(who.speak.length > 34 ? who.speak.slice(0, 33) + '…' : who.speak, x, y - r * 3.1);
    }
  }
  if (who.state === 'down') {
    ctx.strokeStyle = 'rgba(220,140,120,0.7)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x - 4, y - 4); ctx.lineTo(x + 4, y + 4); ctx.moveTo(x + 4, y - 4); ctx.lineTo(x - 4, y + 4); ctx.stroke();
  }
  if (who.hasKid) drawKid(ctx, x + r * 1.5, y + r * 0.6, t, 0.8);
  ctx.restore();
}
export function drawFace(ctx, band, hx, hy, r, who) {
  const f = FACE[band] || FACE.steady;
  ctx.fillStyle = '#f3eee2';
  const eh = r * 0.2 * f.eyes, ew = r * 0.17;
  ctx.beginPath(); ctx.ellipse(hx - r * 0.22, hy + r * 0.02, ew, eh, 0, 0, 6.3); ctx.fill();
  ctx.beginPath(); ctx.ellipse(hx + r * 0.22, hy + r * 0.02, ew, eh, 0, 0, 6.3); ctx.fill();
  ctx.fillStyle = '#1b1712';
  const look = clamp((who.face ? Math.cos(who.face) : 0), -1, 1) * ew * 0.35;
  ctx.beginPath(); ctx.arc(hx - r * 0.22 + look, hy + r * 0.02, Math.max(0.7, r * 0.075), 0, 6.3); ctx.fill();
  ctx.beginPath(); ctx.arc(hx + r * 0.22 + look, hy + r * 0.02, Math.max(0.7, r * 0.075), 0, 6.3); ctx.fill();
  ctx.strokeStyle = 'rgba(30,24,20,0.85)'; ctx.lineWidth = Math.max(0.8, r * 0.07);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(hx + s * r * 0.36, hy - r * 0.2 + f.brow * r * 0.1);
    ctx.lineTo(hx + s * r * 0.1, hy - r * 0.24 - f.brow * r * 0.06);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(hx - r * 0.18, hy + r * 0.3 - f.mouth * r * 0.06);
  ctx.quadraticCurveTo(hx, hy + r * 0.3 + f.mouth * r * 0.24, hx + r * 0.18, hy + r * 0.3 - f.mouth * r * 0.06);
  ctx.stroke();
  if (band === 'terror') {
    ctx.fillStyle = 'rgba(150,200,225,0.5)';
    ctx.beginPath(); ctx.ellipse(hx + r * 0.42, hy + r * 0.16, r * 0.07, r * 0.12, 0, 0, 6.3); ctx.fill();
  }
}
export function drawKid(ctx, x, y, t, scale = 1) {
  const r = 5.4 * scale;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(x, y + r, r * 0.9, r * 0.34, 0, 0, 6.3); ctx.fill();
  ctx.fillStyle = '#3f5c86'; fillRR(ctx, x - r * 0.8, y - r * 0.4, r * 1.6, r * 1.3, r * 0.5, ctx.fillStyle, 'rgba(0,0,0,0.5)', 0.8);
  ctx.fillStyle = '#e2b98d'; ctx.beginPath(); ctx.arc(x, y - r * 0.9, r * 0.62, 0, 6.3); ctx.fill();
  ctx.fillStyle = '#2c211a'; ctx.beginPath(); ctx.ellipse(x, y - r * 1.1, r * 0.6, r * 0.3, 0, Math.PI, 6.4); ctx.fill();
  ctx.restore();
}

/* ---------------- haunt VFX ---------------- */
export function drawStimulus(ctx, st, t, opts = {}) {
  const age = st.age / st.ttl;
  const a = clamp01(1 - age);
  if (a <= 0.02) return;
  const max = (30 + st.salience * 70) * (opts.zoom || 1);
  ctx.save();
  const cold = st.tags?.cold || st.tags?.shape;
  ctx.strokeStyle = cold ? `rgba(147,215,234,${a * 0.5})` : st.evidence > 0.4 ? `rgba(224,161,58,${a * 0.55})` : `rgba(210,190,160,${a * 0.4})`;
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 2; i++) {
    const rr2 = max * ((age + i * 0.32) % 1);
    ctx.globalAlpha = clamp01(1 - ((age + i * 0.32) % 1)) * 0.8;
    ctx.beginPath(); ctx.arc(st.x, st.y, rr2, 0, 6.3); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (st.salience > 0.7 && age < 0.5) {
    ctx.fillStyle = `rgba(255,240,220,${(0.5 - age) * 0.5})`;
    ctx.beginPath(); ctx.arc(st.x, st.y, 5 + (0.5 - age) * 10, 0, 6.3); ctx.fill();
  }
  ctx.restore();
}
export function drawHaunt(ctx, fx, t, room, opts = {}) {
  const r = room || { x: 0, y: 0, w: 100, h: 100, cx: 0, cy: 0 };
  const life = clamp01((fx.until - t) / Math.max(0.001, (fx.until - fx.t)));
  const x = fx.x ?? r.cx, y = fx.y ?? r.cy;
  ctx.save();
  switch (fx.type) {
    case 'cold_spot': {
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 16; i++) {
        const px = r.x + hashN(i, 2) * r.w, py = r.y + ((hashN(i, 5) * r.h) + (t * 9 + i * 7)) % r.h;
        ctx.fillStyle = `rgba(150,205,225,${0.05 + Math.sin(t * 2 + i) * 0.03})`;
        ctx.beginPath(); ctx.ellipse(px, py, 12 + hashN(i, 3) * 18, 5 + hashN(i, 4) * 7, 0, 0, 6.3); ctx.fill();
      }
      break;
    }
    case 'bleed': {
      ctx.globalAlpha = 0.86;
      for (let i = 0; i < 9; i++) {
        const px = r.x + hashN(i, 11) * r.w;
        const len = 12 + (1 - life) * 6 + hashN(i, 12) * 26;
        ctx.fillStyle = i % 3 ? PAL.blood : PAL.bloodWet;
        ctx.beginPath(); ctx.moveTo(px, r.y + 2);
        ctx.quadraticCurveTo(px + 3, r.y + len * 0.6, px, r.y + len);
        ctx.lineTo(px + 2.6, r.y + len); ctx.quadraticCurveTo(px + 5, r.y + len * 0.6, px + 2.6, r.y + 2);
        ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.ellipse(px + 1.3, r.y + len + 3, 3.4, 1.7, 0, 0, 6.3); ctx.fill();
      }
      break;
    }
    case 'possess': {
      /* if the prop itself is gone (smashed, carried off) the cue still has to be visible */
      const p = opts.prop || { x: r.cx - 9, y: r.cy - 9, w: 18, h: 18 };
      ctx.strokeStyle = `rgba(180,225,240,${(0.35 + Math.sin(t * 12) * 0.15) * life})`; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(p.x + p.w / 2, p.y + p.h / 2, p.w * 0.9 + 4, p.h * 0.9 + 4, 0, 0, 6.3); ctx.stroke();
      ctx.strokeStyle = `rgba(120,190,215,${0.4 * life})`;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(p.x + p.w / 2, r.cy); ctx.lineTo(p.x + p.w / 2 + Math.cos(t * 4 + i * 2) * 14, p.y + p.h / 2 + Math.sin(t * 4 + i * 2) * 14); ctx.stroke(); }
      break;
    }
    case 'apparition': {
      const pulse = 0.6 + Math.sin(t * 5) * 0.16;
      const h = 46 * (opts.zoom || 1), w = 26 * (opts.zoom || 1);
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(x, y, 2, x, y, w * 3.4);
      g.addColorStop(0, `rgba(190,232,242,${0.22 * life * pulse})`);
      g.addColorStop(0.5, `rgba(90,140,170,${0.11 * life})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, w * 3.4, 0, 6.3); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(10,12,16,${0.82 * life})`;
      ctx.beginPath();
      ctx.moveTo(x, y - h * 0.62);
      ctx.quadraticCurveTo(x + w * 0.5, y - h * 0.34, x + w * 0.42, y + h * 0.4);
      ctx.quadraticCurveTo(x, y + h * 0.28, x - w * 0.42, y + h * 0.4);
      ctx.quadraticCurveTo(x - w * 0.5, y - h * 0.34, x, y - h * 0.62);
      ctx.fill();
      ctx.strokeStyle = `rgba(158,214,232,${0.5 * life})`; ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = `rgba(214,244,252,${0.85 * life})`;
      ctx.beginPath(); ctx.arc(x - w * 0.14, y - h * 0.34, 1.7, 0, 6.3); ctx.fill();
      ctx.beginPath(); ctx.arc(x + w * 0.14, y - h * 0.34, 1.7, 0, 6.3); ctx.fill();
      break;
    }
    case 'seal': {
      ctx.fillStyle = `rgba(8,9,13,${0.9})`;
      rr(ctx, r.x + 2, r.y + 2, r.w - 4, r.h - 4, 6); ctx.fill();
      ctx.strokeStyle = `rgba(120,180,200,${0.25 + Math.sin(t * 2.6) * 0.1})`; ctx.lineWidth = 2;
      rr(ctx, r.x + 2, r.y + 2, r.w - 4, r.h - 4, 6); ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const dy = r.y + 6 + ((t * 12 + i * 22) % (r.h - 10));
        ctx.fillStyle = 'rgba(140,200,220,0.09)'; ctx.fillRect(r.x + 4, dy, r.w - 8, 3);
      }
      break;
    }
    case 'warp': {
      const d = fx.door;
      ctx.strokeStyle = `rgba(150,220,240,${0.35 + Math.sin(t * 3) * 0.2})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        const off = i * 4;
        ctx.moveTo((d?.ax ?? x) - 14, (d?.ay ?? y) + off - 4 + Math.sin(t * 4 + i) * 3);
        ctx.lineTo((d?.ax ?? x) + 14, (d?.ay ?? y) + off - 4 - Math.sin(t * 4 + i) * 3);
        ctx.stroke();
      }
      break;
    }
    case 'grasp': {
      ctx.strokeStyle = `rgba(120,180,205,${0.5 * life})`; ctx.lineWidth = 1.6;
      for (let i = 0; i < 4; i++) {
        const a = t * 2 + i * 1.6;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * 16, y + Math.sin(a) * 10);
        ctx.lineTo(x + Math.cos(a) * 5, y + Math.sin(a) * 3);
        ctx.stroke();
      }
      break;
    }
    case 'curse': {
      ctx.globalAlpha = 0.4 * life;
      ctx.fillStyle = '#8fb0c4';
      for (let i = 0; i < 6; i++) {
        const px = r.x + hashN(i, t | 0) * r.w, py = r.y + hashN(t | 0, i) * r.h;
        ctx.fillRect(px, py, 2, 2);
      }
      break;
    }
    default: break;
  }
  ctx.restore();
}

/* ---------------- icons: powers, fears, gear, status ---------------- */
export function drawPowerIcon(ctx, id, x, y, s, state = {}) {
  const k = s / 32;
  ctx.save();
  ctx.translate(x, y); ctx.scale(k, k);
  const ink = state.disabled ? '#4a515c' : state.color || '#e6dcc4';
  ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = 2.1; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const P0 = -13, P1 = 13;
  switch (id) {
    case 'creak': ctx.beginPath(); ctx.moveTo(P0, 6); ctx.lineTo(3, 6); ctx.lineTo(3, 1); ctx.lineTo(P1, 1); ctx.stroke(); ctx.beginPath(); ctx.arc(-4, -6, 3.4, -1, 1.6); ctx.stroke(); ctx.beginPath(); ctx.arc(-4, -6, 6.6, -1.1, 1.4); ctx.stroke(); break;
    case 'slam_door': ctx.beginPath(); ctx.moveTo(-9, P1); ctx.lineTo(-9, P0); ctx.lineTo(6, P0 - 2); ctx.lineTo(6, P1 - 2); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(9, -8); ctx.lineTo(13, -12); ctx.moveTo(10, -2); ctx.lineTo(15, -2); ctx.moveTo(9, 5); ctx.lineTo(13, 9); ctx.stroke(); break;
    case 'lock_door': ctx.beginPath(); ctx.arc(0, -4, 5, Math.PI, 0); ctx.stroke(); fillRR(ctx, -8, -2, 16, 12, 2.4, ink); ctx.fillStyle = state.disabled ? '#2a2f36' : '#0d1014'; ctx.beginPath(); ctx.arc(0, 3.4, 2.2, 0, 6.3); ctx.fill(); break;
    case 'snuff_light': ctx.beginPath(); ctx.arc(0, -2, 7, 0, 6.3); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-4, 8); ctx.lineTo(4, 8); ctx.moveTo(-3, 11); ctx.lineTo(3, 11); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-9, -11); ctx.lineTo(9, 6); ctx.stroke(); break;
    case 'nudge': ctx.beginPath(); ctx.moveTo(-11, 8); ctx.lineTo(-11, -2); ctx.lineTo(-3, -2); ctx.lineTo(-3, 8); ctx.stroke(); ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(12, 0); ctx.lineTo(9, -3.4); ctx.moveTo(12, 0); ctx.lineTo(9, 3.4); ctx.stroke(); break;
    case 'cold_spot': for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 11, Math.sin(a) * 11); ctx.stroke(); ctx.beginPath(); ctx.moveTo(Math.cos(a) * 7 + Math.cos(a + 1) * 3, Math.sin(a) * 7 + Math.sin(a + 1) * 3); ctx.lineTo(Math.cos(a) * 7, Math.sin(a) * 7); ctx.stroke(); } break;
    case 'whisper': ctx.beginPath(); ctx.ellipse(-4, 0, 5, 7.4, -0.3, 0, 6.3); ctx.stroke(); ctx.beginPath(); ctx.arc(5, 0, 3, -0.9, 0.9); ctx.stroke(); ctx.beginPath(); ctx.arc(9.4, 0, 6, -0.7, 0.7); ctx.stroke(); break;
    case 'flicker_power': fillRR(ctx, -10, -6, 17, 12, 2, null); ctx.strokeRect(-10, -6, 17, 12); ctx.fillRect(8, -3, 3, 6); ctx.beginPath(); ctx.moveTo(-3, -9); ctx.lineTo(-6, 0); ctx.lineTo(0, 0); ctx.lineTo(-3, 9); ctx.stroke(); break;
    case 'possess_object': ctx.beginPath(); ctx.moveTo(-2, 12); ctx.lineTo(-2, -4); ctx.lineTo(10, -4); ctx.lineTo(10, 12); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-13, -3); ctx.quadraticCurveTo(-7, -12, -1, -8); ctx.quadraticCurveTo(3, -6, 1, -2); ctx.stroke(); for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-12 + i * 4, 4 + i * 2); ctx.lineTo(-8 + i * 4, 1 + i * 2); ctx.stroke(); } break;
    case 'bleed_walls': ctx.beginPath(); ctx.moveTo(-11, -9); ctx.lineTo(11, -9); ctx.lineTo(11, -1); ctx.lineTo(-11, -1); ctx.closePath(); ctx.stroke(); for (let i = 0; i < 3; i++) { const dx = -6 + i * 6; ctx.beginPath(); ctx.moveTo(dx, -1); ctx.lineTo(dx, 5 + i); ctx.stroke(); ctx.beginPath(); ctx.arc(dx, 8 + i, 1.9, 0, 6.3); ctx.fill(); } break;
    case 'mimic_voice': ctx.beginPath(); ctx.moveTo(-12, 6); ctx.lineTo(-12, -6); ctx.lineTo(-2, -6); ctx.lineTo(-2, 0); ctx.lineTo(-6, 0); ctx.lineTo(-6, 6); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(2, 8); ctx.lineTo(2, -2); ctx.lineTo(12, -2); ctx.lineTo(12, 3); ctx.lineTo(7, 3); ctx.lineTo(7, 8); ctx.closePath(); ctx.stroke(); break;
    case 'seal_room': ctx.beginPath(); ctx.rect(-11, -11, 22, 22); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-11, -11); ctx.quadraticCurveTo(0, -2, 11, -11); ctx.lineTo(11, -4); ctx.quadraticCurveTo(0, 5, -11, -4); ctx.closePath(); ctx.fill(); break;
    case 'unhinge': ctx.beginPath(); ctx.moveTo(-12, 11); ctx.lineTo(-12, -4); ctx.lineTo(0, -9); ctx.lineTo(0, 6); ctx.lineTo(12, 11); ctx.lineTo(12, -6); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-12, 11); ctx.lineTo(0, 6); ctx.stroke(); break;
    case 'apparition': ctx.beginPath(); ctx.moveTo(0, -12); ctx.quadraticCurveTo(9, -8, 8, 10); ctx.quadraticCurveTo(4, 6, 0, 11); ctx.quadraticCurveTo(-4, 6, -8, 10); ctx.quadraticCurveTo(-9, -8, 0, -12); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.arc(-3, -3, 1.5, 0, 6.3); ctx.arc(3, -3, 1.5, 0, 6.3); ctx.fill(); break;
    case 'memory_horror': ctx.beginPath(); ctx.arc(0, 0, 10, 0, 6.3); ctx.stroke(); ctx.beginPath(); for (let i = 0; i < 42; i++) { const a = i * 0.34, rr2 = 1 + i * 0.2; const px = Math.cos(a) * rr2, py = Math.sin(a) * rr2; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); } ctx.stroke(); break;
    case 'shadow_grasp': ctx.beginPath(); ctx.moveTo(-9, 12); ctx.lineTo(-9, 0); ctx.quadraticCurveTo(-9, -9, 0, -9); ctx.quadraticCurveTo(9, -9, 9, 0); ctx.lineTo(9, 12); ctx.stroke(); for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-6 + i * 4, -9); ctx.lineTo(-6 + i * 4, -13); ctx.stroke(); } break;
    case 'collapse': ctx.beginPath(); ctx.moveTo(-12, -9); ctx.lineTo(12, -9); ctx.stroke(); for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-9 + i * 6, -6); ctx.lineTo(-11 + i * 6, 8); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(-12, 11); ctx.lineTo(12, 11); ctx.stroke(); break;
    case 'devour_records': ctx.beginPath(); ctx.rect(-11, -8, 22, 16); ctx.stroke(); for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 3.4, -8); ctx.lineTo(i * 3.4, -5); ctx.moveTo(i * 3.4, 5); ctx.lineTo(i * 3.4, 8); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(-6, 2); ctx.quadraticCurveTo(0, -6, 6, 2); ctx.stroke(); break;
    case 'feed': ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(10, -10); ctx.lineTo(2, 2); ctx.lineTo(2, 11); ctx.lineTo(-2, 11); ctx.lineTo(-2, 2); ctx.closePath(); ctx.stroke(); break;
    case 'drain_fury': ctx.beginPath(); ctx.moveTo(0, 12); ctx.quadraticCurveTo(-11, 2, -3, -4); ctx.quadraticCurveTo(-1, -12, 5, -12); ctx.quadraticCurveTo(1, -4, 8, -1); ctx.quadraticCurveTo(11, 7, 0, 12); ctx.closePath(); ctx.stroke(); break;
    default: ctx.beginPath(); ctx.arc(0, 0, 9, 0, 6.3); ctx.stroke();
  }
  ctx.restore();
}
export function drawFearIcon(ctx, id, x, y, s, color = '#cbd4de', state = 1) {
  const k = s / 24;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.7; ctx.lineCap = 'round';
  switch (id) {
    case 'darkness': ctx.beginPath(); ctx.arc(0, 0, 8, 0.6, 5.7); ctx.fill(); break;
    case 'isolation': ctx.beginPath(); ctx.arc(0, -3, 3.2, 0, 6.3); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-6, 9); ctx.quadraticCurveTo(0, 2, 6, 9); ctx.stroke(); break;
    case 'blood': ctx.beginPath(); ctx.moveTo(0, -9); ctx.quadraticCurveTo(7, 1, 0, 8); ctx.quadraticCurveTo(-7, 1, 0, -9); ctx.fill(); break;
    case 'dolls': ctx.beginPath(); ctx.arc(0, -5, 3.6, 0, 6.3); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-4, 9); ctx.lineTo(-3, -1); ctx.lineTo(3, -1); ctx.lineTo(4, 9); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.arc(-1.4, -5.4, 0.7, 0, 6.3); ctx.arc(1.4, -5.4, 0.7, 0, 6.3); ctx.fill(); break;
    case 'enclosed': ctx.strokeRect(-8, -8, 16, 16); ctx.beginPath(); ctx.moveTo(-4, -8); ctx.lineTo(-4, 8); ctx.moveTo(4, -8); ctx.lineTo(4, 8); ctx.stroke(); break;
    case 'voices': for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-2, 0, 3 + i * 3.4, -1, 1); ctx.stroke(); } break;
    case 'watched': ctx.beginPath(); ctx.ellipse(0, 0, 9, 5.4, 0, 0, 6.3); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 2.4, 0, 6.3); ctx.fill(); break;
    case 'loss': ctx.beginPath(); ctx.arc(-4, 0, 4, 0, 6.3); ctx.stroke(); ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(9, 0); ctx.stroke(); ctx.beginPath(); ctx.moveTo(5, -4); ctx.lineTo(9, 0); ctx.lineTo(5, 4); ctx.stroke(); break;
    case 'drowning': ctx.beginPath(); for (let i = -1; i <= 1; i++) { ctx.moveTo(-9, i * 4); ctx.quadraticCurveTo(-4.5, i * 4 - 3, 0, i * 4); ctx.quadraticCurveTo(4.5, i * 4 + 3, 9, i * 4); } ctx.stroke(); break;
    case 'insects': ctx.beginPath(); ctx.ellipse(0, 0, 4.4, 6.4, 0, 0, 6.3); ctx.stroke(); for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-4, i * 3); ctx.lineTo(-9, i * 3 - 2); ctx.moveTo(4, i * 3); ctx.lineTo(9, i * 3 - 2); ctx.stroke(); } break;
    default: ctx.beginPath(); ctx.arc(0, 0, 7, 0, 6.3); ctx.stroke();
  }
  if (state === 2) { ctx.strokeStyle = '#e0a13a'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(0, 0, 11, 0, 6.3); ctx.stroke(); }
  ctx.restore();
}
export function drawGearIcon(ctx, id, x, y, s, color = '#c8d2dc') {
  const k = s / 24;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.6;
  switch (id) {
    case 'torch': ctx.beginPath(); ctx.moveTo(-7, 3); ctx.lineTo(2, 3); ctx.lineTo(2, -3); ctx.lineTo(-7, -3); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(2, -4); ctx.lineTo(9, -7); ctx.lineTo(9, 7); ctx.lineTo(2, 4); ctx.closePath(); ctx.stroke(); break;
    case 'camera': ctx.strokeRect(-9, -5, 18, 12); ctx.beginPath(); ctx.arc(0, 1, 4, 0, 6.3); ctx.stroke(); ctx.fillRect(-6, -8, 5, 3); break;
    case 'vidcam': ctx.strokeRect(-9, -5, 13, 11); ctx.beginPath(); ctx.moveTo(5, -2); ctx.lineTo(10, -5); ctx.lineTo(10, 5); ctx.lineTo(5, 2); ctx.closePath(); ctx.fill(); break;
    case 'phone': ctx.strokeRect(-5, -9, 10, 18); ctx.beginPath(); ctx.moveTo(-2, 6); ctx.lineTo(2, 6); ctx.stroke(); break;
    case 'stream': ctx.beginPath(); ctx.arc(0, 2, 3.4, 0, 6.3); ctx.fill(); for (let i = 1; i <= 2; i++) { ctx.beginPath(); ctx.arc(0, 2, 3.4 + i * 3.6, -2.4, -0.7); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(-8, 9); ctx.lineTo(8, 9); ctx.stroke(); break;
    case 'emf': ctx.strokeRect(-7, -8, 14, 16); for (let i = 0; i < 4; i++) ctx.fillRect(-5 + i * 2.6, -6, 1.6, 2 + i); ctx.beginPath(); ctx.moveTo(-4, 4); ctx.lineTo(0, 0); ctx.lineTo(4, 4); ctx.stroke(); break;
    case 'thermal': ctx.strokeRect(-8, -6, 16, 12); ctx.beginPath(); ctx.arc(0, 0, 3, 0, 6.3); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-8, -6); ctx.lineTo(-4, -10); ctx.lineTo(4, -10); ctx.lineTo(8, -6); ctx.stroke(); break;
    case 'radio': ctx.strokeRect(-8, -6, 16, 12); ctx.beginPath(); ctx.arc(-3, 0, 2.4, 0, 6.3); ctx.stroke(); ctx.fillRect(3, -3, 3, 6); break;
    case 'mic': ctx.beginPath(); ctx.arc(0, -3, 3.4, Math.PI, 0); ctx.rect(-3.4, -3, 6.8, 6); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(0, 8); ctx.moveTo(-4, 8); ctx.lineTo(4, 8); ctx.stroke(); break;
    case 'salt': ctx.beginPath(); ctx.moveTo(-8, 8); ctx.lineTo(8, 8); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-6, 6); ctx.lineTo(-2, -6); ctx.lineTo(2, 6); ctx.lineTo(6, -4); ctx.stroke(); break;
    case 'cross': ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(0, 9); ctx.moveTo(-5, -3); ctx.lineTo(5, -3); ctx.stroke(); break;
    case 'vial': ctx.beginPath(); ctx.moveTo(-3, -8); ctx.lineTo(3, -8); ctx.lineTo(3, 0); ctx.lineTo(4, 6); ctx.lineTo(-4, 6); ctx.lineTo(-3, 0); ctx.closePath(); ctx.stroke(); ctx.fillRect(-3, 1, 6, 4); break;
    case 'flare': ctx.beginPath(); ctx.moveTo(-2, 9); ctx.lineTo(-2, -2); ctx.lineTo(2, -6); ctx.lineTo(2, 9); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, -9); ctx.quadraticCurveTo(4, -12, 1, -14); ctx.stroke(); break;
    case 'bar': ctx.beginPath(); ctx.moveTo(-8, 8); ctx.lineTo(4, -6); ctx.lineTo(8, -3); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-8, 8); ctx.lineTo(-4, 9); ctx.stroke(); break;
    case 'key': ctx.beginPath(); ctx.arc(-4, -4, 3.4, 0, 6.3); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-1.4, -1.4); ctx.lineTo(8, 8); ctx.moveTo(5, 5); ctx.lineTo(8, 3); ctx.stroke(); break;
    case 'rope': ctx.beginPath(); for (let i = 0; i < 20; i++) { const px = -9 + i, py = Math.sin(i * 0.8) * 3; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); } ctx.stroke(); break;
    case 'tripod': ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, 4); ctx.moveTo(-6, 9); ctx.lineTo(0, 4); ctx.lineTo(6, 9); ctx.stroke(); ctx.strokeRect(-4, -10, 8, 5); break;
    case 'smoke': ctx.beginPath(); ctx.moveTo(-4, 9); ctx.lineTo(2, -2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(2, -4); ctx.quadraticCurveTo(8, -8, 2, -12); ctx.stroke(); break;
    case 'candles': for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-5 + i * 5, 9); ctx.lineTo(-5 + i * 5, -1); ctx.stroke(); ctx.beginPath(); ctx.ellipse(-5 + i * 5, -4, 1.6, 2.6, 0, 0, 6.3); ctx.fill(); } break;
    case 'exorcism': ctx.strokeRect(-8, -4, 16, 10); ctx.beginPath(); ctx.moveTo(-8, -4); ctx.lineTo(0, -10); ctx.lineTo(8, -4); ctx.stroke(); break;
    default: ctx.beginPath(); ctx.arc(0, 0, 7, 0, 6.3); ctx.stroke();
  }
  ctx.restore();
}

/* ---------------- title plate: the house from the front walk ---------------- */
export function drawTitleHouse(ctx, W, H, t, opts = {}) {
  const { windowsLit = 12, moon = 1, fog = 1, shake = 0 } = opts;
  ctx.save();
  ctx.translate(shake, Math.sin(t * 0.3) * 1.2);
  /* sky */
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0a0e16'); sky.addColorStop(0.55, '#141b28'); sky.addColorStop(1, '#1b2130');
  ctx.fillStyle = sky; ctx.fillRect(-40, -40, W + 80, H + 80);
  /* stars */
  for (let i = 0; i < 90; i++) {
    const px = hashN(i, 1) * W, py = hashN(i, 2) * H * 0.5;
    ctx.fillStyle = `rgba(226,236,246,${0.14 + hashN(i, 3) * 0.5 * (0.6 + Math.sin(t * 1.4 + i) * 0.4)})`;
    ctx.fillRect(px, py, 1.4, 1.4);
  }
  /* moon */
  const mx = W * 0.78, my = H * 0.18;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const mg = ctx.createRadialGradient(mx, my, 4, mx, my, 120);
  mg.addColorStop(0, `rgba(226,232,240,${0.5 * moon})`); mg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, 120, 0, 6.3); ctx.fill(); ctx.restore();
  ctx.fillStyle = `rgba(232,238,246,${0.86 * moon})`; ctx.beginPath(); ctx.arc(mx, my, 26, 0, 6.3); ctx.fill();
  ctx.fillStyle = 'rgba(120,132,150,0.35)';
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(mx - 10 + i * 5, my - 6 + (i % 2) * 10, 3 + (i % 3), 0, 6.3); ctx.fill(); }
  /* ground */
  ctx.fillStyle = '#0c1016'; ctx.fillRect(-40, H * 0.82, W + 80, H);
  ctx.fillStyle = '#121822';
  ctx.beginPath(); ctx.moveTo(-40, H * 0.82); ctx.quadraticCurveTo(W * 0.5, H * 0.78, W + 40, H * 0.83); ctx.lineTo(W + 40, H); ctx.lineTo(-40, H); ctx.closePath(); ctx.fill();
  /* trees */
  const tree = (tx, s, flip = 1) => {
    ctx.save(); ctx.translate(tx, H * 0.84); ctx.scale(flip * s, s);
    ctx.strokeStyle = '#05070a'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-4, -90); ctx.stroke();
    for (let i = 0; i < 9; i++) {
      const a = -1.9 + i * 0.34, len = 30 + Math.sin(i * 2.1) * 22;
      ctx.lineWidth = 3.4 - i * 0.2;
      ctx.beginPath(); ctx.moveTo(-4, -50 - i * 4);
      ctx.quadraticCurveTo(Math.cos(a) * len * 0.6, -60 - i * 5 + Math.sin(a) * 10, Math.cos(a) * len, -70 - i * 6 + Math.sin(a) * len * 0.4);
      ctx.stroke();
    }
    ctx.restore();
  };
  tree(W * 0.1, 1.05); tree(W * 0.92, 1.2, -1); tree(W * 0.24, 0.62);
  /* the house silhouette */
  const bw = W * 0.5, bh = H * 0.5, bx = W * 0.5 - bw / 2, by = H * 0.84 - bh;
  ctx.fillStyle = '#070a0f';
  ctx.beginPath();
  ctx.rect(bx, by + bh * 0.2, bw, bh * 0.8);
  ctx.fill();
  /* roof */
  ctx.beginPath();
  ctx.moveTo(bx - bw * 0.05, by + bh * 0.22);
  ctx.lineTo(bx + bw * 0.5, by - bh * 0.06);
  ctx.lineTo(bx + bw * 1.05, by + bh * 0.22);
  ctx.closePath(); ctx.fill();
  /* tower */
  ctx.fillRect(bx + bw * 0.02, by - bh * 0.26, bw * 0.19, bh * 0.5);
  ctx.beginPath(); ctx.moveTo(bx - bw * 0.02, by - bh * 0.24); ctx.lineTo(bx + bw * 0.115, by - bh * 0.46); ctx.lineTo(bx + bw * 0.25, by - bh * 0.24); ctx.closePath(); ctx.fill();
  /* porch */
  ctx.fillRect(bx + bw * 0.36, by + bh * 0.62, bw * 0.3, bh * 0.2);
  ctx.fillRect(bx + bw * 0.34, by + bh * 0.6, bw * 0.34, bh * 0.04);
  for (let i = 0; i < 4; i++) ctx.fillRect(bx + bw * (0.37 + i * 0.075), by + bh * 0.62, bw * 0.012, bh * 0.2);
  /* windows, lit by the state of the campaign */
  const cells = [];
  for (let row = 0; row < 2; row++) for (let col = 0; col < 5; col++) cells.push([bx + bw * (0.1 + col * 0.18), by + bh * (0.32 + row * 0.24), bw * 0.1, bh * 0.16]);
  cells.push([bx + bw * 0.06, by - bh * 0.18, bw * 0.08, bh * 0.12]);
  cells.push([bx + bw * 0.44, by + bh * 0.66, bw * 0.12, bh * 0.16]); /* the door */
  const now = t * 0.6;
  cells.forEach((c, i) => {
    const lit = i < windowsLit;
    const flick = lit ? 0.55 + Math.sin(now * 3 + i * 1.7) * 0.2 + (hashN(i, Math.floor(now)) > 0.9 ? -0.3 : 0) : 0;
    ctx.fillStyle = lit ? `rgba(255,206,128,${0.1 + flick * 0.75})` : 'rgba(18,24,32,0.9)';
    ctx.fillRect(c[0], c[1], c[2], c[3]);
    ctx.strokeStyle = '#020305'; ctx.lineWidth = 1.4; ctx.strokeRect(c[0], c[1], c[2], c[3]);
    ctx.beginPath(); ctx.moveTo(c[0] + c[2] / 2, c[1]); ctx.lineTo(c[0] + c[2] / 2, c[1] + c[3]); ctx.moveTo(c[0], c[1] + c[3] / 2); ctx.lineTo(c[0] + c[2], c[1] + c[3] / 2); ctx.stroke();
    if (lit) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(c[0] + c[2] / 2, c[1] + c[3] / 2, 1, c[0] + c[2] / 2, c[1] + c[3] / 2, c[2] * 3.2);
      g.addColorStop(0, `rgba(255,200,120,${0.24 * flick})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(c[0] - c[2] * 3, c[1] - c[3] * 3, c[2] * 7, c[3] * 7);
      ctx.restore();
    }
  });
  /* fog */
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 7; i++) {
    const fy = H * (0.72 + (i % 3) * 0.06);
    const fx = ((t * (6 + i * 3) + i * 240) % (W + 420)) - 210;
    ctx.fillStyle = `rgba(150,175,195,${0.045 * fog})`;
    ctx.beginPath(); ctx.ellipse(fx, fy, 190, 26 + i * 3, 0, 0, 6.3); ctx.fill();
  }
  ctx.restore();
  ctx.restore();
}

/* a small crest for panels: a house keyhole inside a frame */
export function drawCrest(ctx, x, y, s, t = 0, opts = {}) {
  ctx.save(); ctx.translate(x, y);
  const k = s / 40;
  ctx.scale(k, k);
  ctx.strokeStyle = opts.color || PAL.brass; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-18, 16); ctx.lineTo(-18, -4); ctx.lineTo(0, -18); ctx.lineTo(18, -4); ctx.lineTo(18, 16); ctx.closePath(); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -1, 4.4, 0, 6.3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-2.4, 2); ctx.lineTo(2.4, 2); ctx.lineTo(3.6, 11); ctx.lineTo(-3.6, 11); ctx.closePath(); ctx.stroke();
  if (opts.glow) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 26);
    g.addColorStop(0, `rgba(226,180,90,${0.18 + Math.sin(t * 2) * 0.05})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 26, 0, 6.3); ctx.fill(); ctx.restore();
  }
  ctx.restore();
}

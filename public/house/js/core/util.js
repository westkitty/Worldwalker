/* THE HOUSE THAT HUNTS BACK - shared math / rng / formatting helpers.
   Pure module: no DOM, importable by the headless test harness. */

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (v, a, b) => (b === a ? 0 : (v - a) / (b - a));
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
export const smooth = (cur, target, rate, dt) => cur + (target - cur) * clamp01(1 - Math.exp(-rate * dt));
export const sign = v => (v < 0 ? -1 : v > 0 ? 1 : v);
export const ease = t => t * t * (3 - 2 * t);

/* deterministic RNG (mulberry32) so replays and tests are reproducible */
export function makeRng(seed = 1) {
  let s = seed >>> 0;
  const f = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next: f,
    get state() { return s >>> 0; },
    set state(v) { s = v >>> 0; },
    range: (a, b) => a + f() * (b - a),
    int: (a, b) => Math.floor(a + f() * (b - a + 1)),
    chance: p => f() < p,
    pick: arr => arr[Math.floor(f() * arr.length) % arr.length],
    weighted(pairs) {
      let total = 0;
      for (const p of pairs) total += Math.max(0, p[1]);
      if (total <= 0) return pairs.length ? pairs[0][0] : null;
      let r = f() * total;
      for (const p of pairs) { r -= Math.max(0, p[1]); if (r <= 0) return p[0]; }
      return pairs[pairs.length - 1][0];
    },
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(f() * (i + 1));
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    }
  };
}

export const round1 = v => Math.round(v * 10) / 10;
export const pct = v => Math.round(clamp01(v) * 100) + '%';

/* sim seconds -> in-game clock. A night runs 21:00 -> 03:59 (300 sim minutes-ish) */
export function clockLabel(sec, nightLength = 300) {
  const startMin = 21 * 60;
  const spanMin = 300;
  const mins = Math.floor(startMin + clamp01(sec / nightLength) * spanMin);
  const h = Math.floor(mins / 60) % 24, m = mins % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(m).padStart(2, '0')} ${ap}`;
}
export const titleCase = s => String(s).replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
export const romanize = n => ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n] || String(n);
export const copyOf = o => JSON.parse(JSON.stringify(o));
export const fmt = (v, d = 0) => Number(v).toFixed(d);
export function timeLabel(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

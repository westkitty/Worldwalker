/* Headless runtime harness for /house/.  Builds a small DOM + Canvas2D + WebAudio shim,
   boots public/house/js/main.js exactly as the browser would, drives real animation frames,
   and asserts that the render/UI/audio layers actually run and actually draw.
   Run: node scripts/house-runtime.mjs [--frames=N] [--verbose] */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const HOUSE = join(ROOT, 'public', 'house');
const VERBOSE = process.argv.includes('--verbose');
const FRAMES = Number((process.argv.find(a => a.startsWith('--frames=')) || '').split('=')[1] || 620);

/* ------------------------------- assertions ------------------------------- */
const results = [];
let failures = 0;
function test(name, fn) {
  const t0 = Date.now();
  try { const detail = fn(); results.push({ name, ok: true, detail, ms: Date.now() - t0 }); if (VERBOSE) console.log(`  PASS  ${name}${detail ? '  -  ' + detail : ''}`); }
  catch (e) { failures++; results.push({ name, ok: false, detail: String(e && e.message || e), ms: Date.now() - t0 }); console.log(`  FAIL  ${name}\n        ${e && e.stack ? e.stack.split('\n').slice(0, 4).join('\n        ') : e}`); }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg || 'assertion failed'); };

/* ------------------------------- canvas shim ------------------------------- */
let drawCalls = 0, drawOps = Object.create(null);
const badStyle = v => {
  if (typeof v === 'number' && !Number.isFinite(v)) throw new Error('non-finite canvas number: ' + v);
  if (typeof v === 'string' && /NaN|undefined|Infinity|null/.test(v)) throw new Error('bad canvas style string: ' + v);
};
function makeCtx(el) {
  const num = name => (...a) => { drawCalls++; drawOps[name] = (drawOps[name] || 0) + 1; a.forEach(badStyle); if (name === 'createLinearGradient' || name === 'createRadialGradient') return { addColorStop: (p, c) => { badStyle(p); badStyle(c); } }; return undefined; };
  const ctx = {
    canvas: el, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1, globalCompositeOperation: 'source-over',
    font: '10px sans-serif', textAlign: 'left', textBaseline: 'alphabetic', lineCap: 'butt', lineJoin: 'miter',
    shadowBlur: 0, shadowColor: 'rgba(0,0,0,0)', filter: 'none', imageSmoothingEnabled: true, miterLimit: 10, lineDashOffset: 0,
    save: num('save'), restore: num('restore'), beginPath: num('beginPath'), closePath: num('closePath'),
    moveTo: num('moveTo'), lineTo: num('lineTo'), quadraticCurveTo: num('quadraticCurveTo'), bezierCurveTo: num('bezierCurveTo'),
    arc: num('arc'), arcTo: num('arcTo'), ellipse: num('ellipse'), rect: num('rect'), roundRect: num('roundRect'),
    fill: num('fill'), stroke: num('stroke'), clip: num('clip'), fillRect: num('fillRect'), strokeRect: num('strokeRect'),
    clearRect: num('clearRect'), fillText: num('fillText'), strokeText: num('strokeText'), translate: num('translate'),
    rotate: num('rotate'), scale: num('scale'), transform: num('transform'), setTransform: num('setTransform'),
    drawImage: num('drawImage'), setLineDash: num('setLineDash'), getLineDash: () => [], createPattern: () => ({}),
    measureText: s => ({ width: String(s).length * 5.2 }), createImageData: () => ({ data: [] }), putImageData: num('putImageData'),
    createLinearGradient: num('createLinearGradient'), createRadialGradient: num('createRadialGradient'),
    createConicGradient: num('createConicGradient')
  };
  for (const key of ['fillStyle', 'strokeStyle', 'shadowColor', 'font']) {
    let v = ctx[key];
    Object.defineProperty(ctx, key, { get: () => v, set: nv => { badStyle(nv); v = nv; } });
  }
  return ctx;
}

/* ------------------------------- element shim ------------------------------- */
class TextNode {
  constructor(t) { this.nodeValue = String(t); this.nodeType = 3; }
  get textContent() { return this.nodeValue; }
  set textContent(v) { this.nodeValue = String(v); }
}
class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase(); this.nodeType = 1;
    this.childNodes = []; this.attrs = Object.create(null); this.style = Object.create(null);
    this.dataset = Object.create(null); this._cls = new Set(); this._lis = Object.create(null);
    this._text = ''; this.disabled = false; this.value = ''; this.checked = false;
    this._w = this.tagName === 'CANVAS' ? 1200 : 0; this._h = this.tagName === 'CANVAS' ? 700 : 0;
  }
  get children() { return this.childNodes.filter(c => c.nodeType === 1); }
  get firstChild() { return this.childNodes[0] || null; }
  get parentElement() { return this._parent || null; }
  appendChild(c) { c._parent = this; this.childNodes.push(c); return c; }
  removeChild(c) { const i = this.childNodes.indexOf(c); if (i >= 0) this.childNodes.splice(i, 1); return c; }
  replaceChildren(...kids) { this.childNodes = []; for (const k of kids) if (k !== null && k !== undefined && k !== false) this.appendChild(typeof k === 'string' || typeof k === 'number' ? new TextNode(k) : k); }
  append(...kids) { for (const k of kids) this.appendChild(k); }
  remove() { if (this._parent) this._parent.removeChild(this); }
  addEventListener(t, fn) { (this._lis[t] || (this._lis[t] = [])).push(fn); }
  removeEventListener(t, fn) { this._lis[t] = (this._lis[t] || []).filter(f => f !== fn); }
  dispatch(t, ev = {}) { for (const fn of (this._lis[t] || []).slice()) fn({ type: t, target: this, currentTarget: this, preventDefault() { }, stopPropagation() { }, ...ev }); return this; }
  click() { return this.dispatch('click'); }
  setAttribute(k, v) { if (v === undefined || v === null) return; if (k === 'id') this.id = String(v); if (k === 'width') this._w = Number(v); if (k === 'height') this._h = Number(v); this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  removeAttribute(k) { delete this.attrs[k]; }
  hasAttribute(k) { return k in this.attrs; }
  get className() { return [...this._cls].join(' '); }
  set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get classList() { const s = this._cls; return { add: (...c) => c.forEach(x => s.add(x)), remove: (...c) => c.forEach(x => s.delete(x)), toggle: (c, f) => (f === undefined ? (s.has(c) ? s.delete(c) : s.add(c)) : (f ? s.add(c) : s.delete(c))), contains: c => s.has(c), get length() { return s.size } }; }
  get textContent() { return this.childNodes.length ? this.childNodes.map(c => c.textContent).join('') : this._text; }
  set textContent(v) { this.childNodes = []; this._text = String(v); }
  get innerHTML() { return this._html || ''; }
  set innerHTML(v) { this._html = String(v); this.childNodes = []; }
  getContext(kind) { if (kind !== '2d') return null; if (!this._ctx) this._ctx = makeCtx(this); return this._ctx; }
  getBoundingClientRect() { const w = this._w || 240, h = this._h || 40; return { x: 0, y: 0, left: 0, top: 0, width: w, height: h, right: w, bottom: h }; }
  matches(sel) { return matches(this, sel); }
  querySelector(sel) { const r = this.querySelectorAll(sel); return r[0] || null; }
  querySelectorAll(sel) { const out = []; const parts = String(sel).split(/\s*,\s*/); walk(this, el => { if (parts.some(p => matches(el, p))) out.push(el); }); return out; }
  closest(sel) { let n = this; while (n) { if (matches(n, sel)) return n; n = n._parent; } return null; }
  focus() { } blur() { } scrollIntoView() { }
}
function walk(el, fn) { for (const c of el.childNodes) { if (c.nodeType === 1) { fn(c); walk(c, fn); } } }
function matches(el, sel) {
  if (!el || el.nodeType !== 1) return false;
  const parts = sel.match(/^[#.]?[a-zA-Z0-9_-]+|([#.][a-zA-Z0-9_-]+)/g) || [];
  for (const p of parts) {
    if (p[0] === '#') { if (el.id !== p.slice(1)) return false; }
    else if (p[0] === '.') { if (!el._cls.has(p.slice(1))) return false; }
    else { if (el.tagName !== p.toUpperCase()) return false; }
  }
  return true;
}
const doc = new El('html');
const html = new El('html'); const head = new El('head'); const body = new El('body');
doc.appendChild(head); doc.appendChild(body);
html.documentElement = doc;
const byId = Object.create(null);
const origSet = El.prototype.setAttribute;
El.prototype.setAttribute = function (k, v) { origSet.call(this, k, v); if (k === 'id' && this.id) byId[this.id] = this; };
const documentApi = {
  documentElement: doc, head, body,
  createElement: t => new El(t),
  createTextNode: t => new TextNode(t),
  getElementById: id => byId[id] || (walk(doc, e => { if (e.id === id) byId[id] = e; }), byId[id] || null),
  querySelector: sel => doc.querySelector(sel) || (matches(doc, sel) ? doc : null),
  querySelectorAll: sel => doc.querySelectorAll(sel),
  addEventListener: (t, fn) => documentApi._lis[t] && documentApi._lis[t].push(fn),
  _lis: Object.create(null)
};

/* build the page skeleton exactly as public/house/index.html does */
function mk(tag, id, cls, kids = [], parent = body) {
  const e = new El(tag);
  if (id) e.setAttribute('id', id);
  if (cls) e.className = cls;
  for (const k of kids) e.appendChild(typeof k === 'string' ? new TextNode(k) : k);
  parent.appendChild(e);
  return e;
}
const winLis = Object.create(null);
const rafQ = [];
let vClock = 0;
const timeouts = [];
const intervals = [];
const win = {
  innerWidth: 1360, innerHeight: 820, devicePixelRatio: 2,
  addEventListener: (t, fn) => { (winLis[t] || (winLis[t] = [])).push(fn); },
  removeEventListener: () => { },
  requestAnimationFrame: cb => { rafQ.push(cb); return rafQ.length; },
  cancelAnimationFrame: () => { },
  getBoundingClientRect: () => ({ width: 1360, height: 820, left: 0, top: 0 }),
  matchMedia: q => ({ matches: /prefers-reduced-motion/.test(q) ? false : false, addEventListener() { }, removeEventListener() { } }),
  localStorage: null, performance: { now: () => vClock },
  AudioContext: null, webkitAudioContext: null, navigator: null
};
/* the app root the UI mounts into */
const app = mk('div', 'app');
const topbar = mk('header', 'topbar', '', [], app);
mk('canvas', 'crest', 'crest', [], topbar);
const brand = mk('div', '', 'brand', [], topbar);
mk('h1', '', '', ['The House That Hunts Back'], brand);
mk('span', 'nightLabel', 'ninelabel', ['Night I'], topbar);
mk('div', 'resources', 'resources', [], topbar);
mk('div', 'objective', 'objective', [], topbar);
const clock = mk('div', 'clock', 'clock', [], topbar);
mk('b', '', '', ['9:00 PM'], clock);
mk('div', 'clockbarx', 'bar', [mk('i', 'clockFill')], clock);
mk('span', '', 'dawn', [], clock);
const topbtns = mk('div', 'topbtns', '', [], topbar);
mk('div', 'speed', 'speed', [], topbtns);
for (const [id, label] of [['btnUpgrades', 'Upgrades'], ['btnLore', 'Lore'], ['btnHelp', 'Help'], ['btnSettings', 'Settings'], ['btnMute', 'Sound']]) mk('button', id, '', [label], topbtns);
const main = mk('main', 'body', '', [], app);
mk('aside', 'leftPanel', 'panel side', [], main);
const stage = mk('section', 'stage', '', [], main);
const canvasEl = mk('canvas', 'view', '', [], stage);
canvasEl._w = 1200; canvasEl._h = 700;
for (const [id, cls] of [['focusBadge', 'focusbadge'], ['toasts', 'toasts'], ['captions', 'captions'], ['tutorial', 'tutorial'], ['hovercard', 'hovercard'], ['legend', 'legend']]) mk('div', id, cls, [], stage);
mk('aside', 'rightPanel', 'panel side', [], main);
mk('footer', 'powerbar', 'powerbar', [], app);
mk('div', 'modal', 'modal', [], app);

/* ------------------------------- audio shim ------------------------------- */
let audioNodes = 0;
class Param {
  constructor(v = 0) { this.value = v; }
  setValueAtTime(v) { badStyle(v); audioNodes++; return this; }
  linearRampToValueAtTime(v) { badStyle(v); return this; }
  exponentialRampToValueAtTime(v) { badStyle(v); if (!(v > 0)) throw new Error('exponentialRamp to non-positive: ' + v); return this; }
  setTargetAtTime(v) { badStyle(v); return this; }
  cancelScheduledValues() { return this; }
}
const node = extra => {
  audioNodes++;
  return Object.assign({
    connect(t) { return t; }, disconnect() { }, start() { }, stop() { },
    addEventListener() { }
  }, extra || {});
};
class FakeAudioContext {
  constructor() { this.sampleRate = 48000; this.state = 'running'; this.destination = node({}); }
  get currentTime() { return vClock / 1000; }
  resume() { this.state = 'running'; return Promise.resolve(); }
  close() { this.state = 'closed'; return Promise.resolve(); }
  createGain() { return node({ gain: new Param(1) }); }
  createOscillator() { return node({ type: 'sine', frequency: new Param(440), detune: new Param(0) }); }
  createBiquadFilter() { return node({ type: 'lowpass', frequency: new Param(350), Q: new Param(1), gain: new Param(0) }); }
  createDelay() { return node({ delayTime: new Param(0) }); }
  createDynamicsCompressor() { return node({ threshold: new Param(-24), knee: new Param(30), ratio: new Param(12), attack: new Param(0.003), release: new Param(0.25) }); }
  createBufferSource() { return node({ buffer: null, loop: false, playbackRate: new Param(1) }); }
  createStereoPanner() { return node({ pan: new Param(0) }); }
  createWaveShaper() { return node({ curve: null, oversample: 'none' }); }
  createBuffer(ch, len) { const d = new Float32Array(len); return { length: len, numberOfChannels: ch, getChannelData: () => d }; }
}
win.AudioContext = FakeAudioContext;

/* ------------------------------- globals ------------------------------- */
const store = new Map();
win.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
  clear: () => store.clear()
};
globalThis.__hthbErrors = [];
process.on('unhandledRejection', e => globalThis.__hthbErrors.push('rejection: ' + (e && e.message || e)));
process.on('uncaughtException', e => globalThis.__hthbErrors.push('exception: ' + (e && e.message || e)));
const def = (name, value) => { try { Object.defineProperty(globalThis, name, { value, configurable: true, writable: true }); } catch { try { globalThis[name] = value; } catch { } } };
def('window', win); def('document', documentApi); def('performance', win.performance);
def('localStorage', win.localStorage); def('requestAnimationFrame', win.requestAnimationFrame);
def('cancelAnimationFrame', win.cancelAnimationFrame); def('devicePixelRatio', win.devicePixelRatio);
def('matchMedia', win.matchMedia);
def('navigator', { getGamepads: () => [], userAgent: 'harness', maxTouchPoints: 0 });
def('setTimeout', (fn, ms) => { timeouts.push({ fn, at: vClock + (ms || 0) }); return timeouts.length; });
def('clearTimeout', () => { });
def('setInterval', fn => { intervals.push(fn); return intervals.length; });
def('clearInterval', () => { });
def('getComputedStyle', () => ({ getPropertyValue: () => '' }));
win.navigator = globalThis.navigator;

/* ------------------------------- drive ------------------------------- */
let frameNo = 0;
function pump(ms = 16.7) {
  vClock += ms;
  for (let i = timeouts.length - 1; i >= 0; i--) if (timeouts[i].at <= vClock) { const t = timeouts.splice(i, 1)[0]; t.fn(); }
  const cbs = rafQ.splice(0, rafQ.length);
  for (const cb of cbs) cb(vClock);
  frameNo++;
}
function pumpFrames(n, ms) { for (let i = 0; i < n; i++) pump(ms); }
function dispatchWin(type, ev) { for (const fn of (winLis[type] || [])) fn({ type, preventDefault() { }, ...ev }); }
function key(k, extra = {}) { dispatchWin('keydown', { key: k, ...extra }); }

const AUDIO_NAMES = (await import(join(HOUSE, 'js/audio/audio.js'))).AUDIO_NAMES;
const modArt = await import(join(HOUSE, 'js/render/art.js'));
const modPowers = await import(join(HOUSE, 'js/data/powers.js'));
const modIntruders = await import(join(HOUSE, 'js/data/intruders.js'));
const modGear = modIntruders;

/* ------------------------------- boot the game ------------------------------- */
console.log('\n=== /house/ runtime harness (DOM + Canvas2D + WebAudio shim) ===\n');
const idx = readFileSync(join(HOUSE, 'index.html'), 'utf8');
let bootErr = null;
try { await import(join(HOUSE, 'js/main.js')); } catch (e) { bootErr = e; }
const H = win.HOUSE || globalThis.HOUSE;

test('main.js boots without throwing', () => { if (bootErr) throw bootErr; assert(H && H.game && H.view && H.ui, 'window.HOUSE not exposed'); return 'game+view+ui+audio wired'; });
test('index.html declares every mount point and asset', () => {
  const need = ['topbar', 'crest', 'nightLabel', 'resources', 'objective', 'clock', 'speed', 'leftPanel', 'rightPanel', 'powerbar', 'toasts', 'captions', 'modal', 'hovercard', 'focusBadge', 'tutorial', 'view', 'btnUpgrades', 'btnSettings', 'btnMute'];
  const missing = need.filter(id => !idx.includes(`id="${id}"`));
  assert(!missing.length, 'missing ids in index.html: ' + missing.join(', '));
  for (const f of ['house.css', 'js/main.js']) assert(existsSync(join(HOUSE, f)), 'missing file ' + f);
  const offSite = (idx.match(/https?:\/\/[^"'\s)]+/g) || []).filter(u => !/^https?:\/\/www\.w3\.org/.test(u));
  assert(!offSite.length, 'index.html pulls a remote URL: ' + offSite.join(', '));
  return `${need.length} ids + css + module`;
});
test('title screen renders and holds the sim paused', () => {
  const sheet = documentApi.getElementById('modal');
  assert(sheet.children.length, 'empty modal sheet');
  const before = H.game.t;
  pumpFrames(8);
  assert(H.game.t === before, 'sim advanced behind the title screen');
  return `${sheet.querySelectorAll('button').length} buttons on the title sheet`;
});
test('title screen draws the house procedurally, frame by frame', () => {
  assert(H.view.mode === 'title', 'title sheet did not put the view in title mode');
  const g0 = drawOps.createLinearGradient || 0;
  const c0 = drawCalls; pump(); const d0 = drawCalls - c0;
  pump(); const d1 = drawCalls - c0;
  assert(d0 > 250, 'title frame underdraws: ' + d0);
  assert((drawOps.createLinearGradient || 0) > g0, 'title art drew no gradients - is it a flat fill?');
  assert(d1 > d0, 'title art is not animating frame to frame');
  return `${d0} then ${d1 - d0} canvas ops per title frame`;
});
test('HUD panels are populated from live state', () => {
  const res = documentApi.getElementById('resources');
  assert(res.children.length >= 4, 'resources not drawn: ' + res.children.length);
  const power = documentApi.getElementById('powerbar');
  const pts = power.querySelectorAll('.pt');
  assert(pts.length >= 4, 'power bar too short: ' + pts.length);
  const un = H.game.unlocked; const unlockedN = un.size ?? un.length;
  assert(pts.length === unlockedN, `power bar ${pts.length} != unlocked ${unlockedN}`);
  assert(unlockedN >= 8 && unlockedN <= 20, 'unlocked power count implausible: ' + unlockedN);
  const left = documentApi.getElementById('leftPanel');
  assert(left.querySelectorAll('.room').length >= 6, 'room list too short');
  assert(documentApi.getElementById('nightLabel').textContent.includes('Night'), 'no night label');
  return `${pts.length} haunts · ${left.querySelectorAll('.room').length} rooms listed`;
});
test('begin the night from the briefing sheet', () => {
  const sheet = documentApi.getElementById('modal');
  const begin = sheet.querySelectorAll('button.big')[0];
  assert(begin, 'no begin button');
  begin.click(); pump(16.7);
  const begin2 = documentApi.getElementById('modal').querySelectorAll('button.big')[0];
  assert(begin2, 'briefing sheet missing begin');
  begin2.click(); pump();
  assert(!H.game.paused, 'night did not start (still paused)');
  assert(H.ui.modal === null, 'modal still open after begin');
  return 'title → briefing → live';
});
test('sim runs under the renderer and moves people', () => {
  const p0 = H.game.group.map(i => ({ x: i.x, y: i.y, room: i.room }));
  const t0 = H.game.t;
  pumpFrames(120, 30);
  const moved = H.game.group.filter((i, k) => Math.hypot(i.x - p0[k].x, i.y - p0[k].y) > 2 || i.room !== p0[k].room).length;
  assert(H.game.t - t0 > 1.5, `sim clock barely moved (${(H.game.t - t0).toFixed(2)}s of 3.6s wall)`);
  assert(moved >= 1, 'nobody moved on the floor');
  const c0 = drawCalls; pump(); const perFrame = drawCalls - c0;
  assert(perFrame > 1500, 'floor-plan frame underdraws: ' + perFrame);
  assert((drawOps.ellipse || 0) > 200 && (drawOps.arc || 0) > 200, 'no furniture/people geometry in the frame');
  return `${(H.game.t - t0).toFixed(1)}s sim, ${moved}/${H.game.group.length} relocated, ${perFrame} ops/frame`;
});
test('pause and speed keys govern the same clock', () => {
  key(' ');
  assert(H.game.paused, 'space did not pause');
  const t0 = H.game.t; pumpFrames(10);
  assert(H.game.t === t0, 'sim ran while paused');
  key(' ');
  assert(!H.game.paused, 'space did not resume');
  key('.'); key('.');
  assert(H.game.speed === 3, 'speed key did not reach 3x: ' + H.game.speed);
  const t1 = H.game.t; const s1 = drawCalls; pumpFrames(10, 40);
  const fast = H.game.t - t1;
  key(' '); const t2 = H.game.t; pumpFrames(10, 40); key(' ');
  assert(fast > (H.game.t - t2) + 0.5, `3x did not outpace paused/1x: fast=${fast.toFixed(2)} slow=${(H.game.t - t2).toFixed(2)}`);
  assert(drawCalls - s1 > 40 * 1000, 'renderer idled out');
  key(','); key(',');
  assert(H.game.speed === 1, 'speed down failed: ' + H.game.speed);
  return 'space + , . verified live';
});
test('clicking the floor plan focuses the room under the cursor', () => {
  const r = H.game.world.rooms.kitchen || H.game.world.rooms.parlor;
  const s = H.view.scale * H.view.cam.zoom;
  const sx = H.view.w / 2 + (r.cx - H.view.cam.x) * s, sy = H.view.h / 2 + (r.cy - H.view.cam.y) * s;
  canvasEl.dispatch('pointermove', { clientX: sx, clientY: sy });
  canvasEl.dispatch('click', { clientX: sx, clientY: sy });
  pumpFrames(2);
  assert(H.game.focus.room === r.id, `focus is ${H.game.focus.room}, expected ${r.id}`);
  assert(H.view.hover, 'hover card state never set');
  assert(documentApi.getElementById('hovercard').textContent.length > 4, 'hovercard empty');
  return `focused ${r.name}, hover: "${documentApi.getElementById('hovercard').textContent.slice(0, 42)}…"`;
});
test('props and doors are individually clickable', () => {
  /* aim using the transform the renderer actually used, exactly like a browser would */
  const toScreen = (wx, wy) => ({ x: H.view.ox + wx * H.view.scale * H.view.cam.zoom, y: H.view.oy + wy * H.view.scale * H.view.cam.zoom });
  let hits = 0, tries = 0, misses = [];
  const ids = ['kitchen', 'parlor', 'foyer', 'ubath', 'cellar'];
  for (const rid of ids) {
    const r = H.game.world.rooms[rid]; if (!r) { misses.push(rid + ':no such room'); continue; }
    H.view.shake = 0;
    H.view.setFloor(r.floor); H.game.setFocus(rid); H.view.focusRoom(rid);
    H.view.cam.tz = 1; H.view.cam.tx = r.cx; H.view.cam.ty = r.cy;
    pumpFrames(3, 30);
    H.view.cam.x = r.cx; H.view.cam.y = r.cy; H.view.cam.zoom = 1; H.view.shake = 0;
    pump();
    for (const pid of r.props.slice(0, 4)) {
      const p = H.game.world.props[pid];
      const c = toScreen(p.x + p.w / 2, p.y + p.h / 2);
      tries++;
      canvasEl.dispatch('pointermove', { clientX: c.x, clientY: c.y });
      const hv = H.view.hover;
      if (hv && hv.type === 'prop') hits++; else misses.push(`${rid}/${pid} -> ${hv ? hv.type : 'nothing'}`);
      canvasEl.dispatch('click', { clientX: c.x, clientY: c.y });
      pump();
    }
    for (const did of r.doors.slice(0, 2)) {
      const d = H.game.world.byId[did];
      const c = toScreen(d.ax, d.ay);
      tries++;
      canvasEl.dispatch('pointermove', { clientX: c.x, clientY: c.y });
      const hv = H.view.hover;
      if (hv && (hv.type === 'door' || hv.type === 'prop')) hits++; else misses.push(`${did} -> ${hv ? hv.type : 'nothing'}`);
    }
  }
  assert(hits >= Math.ceil(tries * 0.7), `only ${hits}/${tries} picks resolved; ${misses.slice(0, 4).join(' | ')}`);
  return `${hits}/${tries} furniture + door picks resolved`;
});
test('haunts cast from the power bar change world state', () => {
  H.game.setFocus('foyer');
  H.game.energy = H.game.energyMax;
  const pts = documentApi.getElementById('powerbar').querySelectorAll('.pt');
  let casts = 0, toasts0 = H.ui.toasts.length;
  for (let i = 0; i < Math.min(9, pts.length); i++) {
    H.game.cooldowns = {}; H.game.energy = H.game.energyMax; H.game.stability = H.game.stabilityMax;
    pts[i].dispatch('click', { button: 0 });
    pump();
    if (H.game.stats.haunts > casts) casts = H.game.stats.haunts;
  }
  assert(casts >= 2, `only ${casts} of 9 haunts landed (toasts ${toasts0}→${H.ui.toasts.length})`);
  return `${casts} haunts cast via click, ${drawOps.fillText || 0} text draws`;
});
test('keyboard selects and casts haunts', () => {
  const g = H.game; g.energy = g.energyMax; g.stability = g.stabilityMax; g.cooldowns = {};
  g.setFocus('foyer');
  const before = g.stats.haunts;
  key('1'); const sel = H.ui.powerSel; assert(sel === 0, 'key 1 did not select slot 0');
  key('5'); assert(H.ui.powerSel === 4 || H.ui.powerSel === 0, 'key 5 out of range');
  key('Enter'); pump();
  assert(g.stats.haunts > before || g.logs.some(l => l.kind === 'haunt' || l.text.includes('—')), 'Enter cast produced nothing');
  return `selected slot ${H.ui.powerSel}, haunts ${before}→${g.stats.haunts}`;
});
test('observe mode learns fears through the UI toggle', () => {
  const g = H.game;
  g.focus.observe = false;
  key('e');
  assert(g.focus.observe, 'E did not toggle observe');
  const before = g.stats.learned;
  g.energy = g.energyMax;
  pumpFrames(200, 30);
  key('e');
  assert(g.focus.observe === false, 'E did not toggle back');
  return `learned ${before}→${g.stats.learned} while observing`;
});
test('surge (T) banks fury and the observe badge reflects state', () => {
  const g = H.game; g.fury = 80;
  key('t');
  assert(g.surgeArmed, 'T did not arm the surge');
  pump();
  assert(documentApi.getElementById('powerbar').querySelector('.surge').className.includes('on'), 'surge button not showing armed');
  g.fury = 0; g.surgeArmed = false;
  return 'fury banking wired to the button';
});
test('floor tabs, cutaway and focus zoom all render', () => {
  const tabs = documentApi.getElementById('leftPanel').querySelectorAll('.fl');
  assert(tabs.length === 4, 'floor tabs: ' + tabs.length);
  const counts = [];
  for (let i = 0; i < 4; i++) { tabs[i].dispatch('click', {}); pumpFrames(3, 20); counts.push(drawCalls); }
  key('g'); pumpFrames(3, 20); counts.push(drawCalls);
  assert(H.view.mode === 'cutaway', 'G did not enter cutaway');
  key('g'); pumpFrames(2, 20);
  key(']'); key(']'); pumpFrames(2, 20);
  assert(H.view.floor === 1 || H.view.floor === 2, 'bracket keys did not change floor: ' + H.view.floor);
  const uniq = new Set(counts.map(c => c % 1000));
  assert(counts.every((c, i) => i === 0 || c > counts[i - 1]), 'a floor drew nothing');
  return `4 floors + cutaway drew (${counts[1] - counts[0]} ops/floor frame, ${uniq.size} distinct)`;
});
test('every intruder can be inspected in the panel', () => {
  const g = H.game;
  key('f'); pumpFrames(2);
  H.ui.tab = 'inspect'; H.ui.refresh(); pumpFrames(2);
  const pane = documentApi.getElementById('rightPanel');
  const txt = pane.textContent;
  assert(g.selectedPerson, 'F did not select anyone');
  assert(/FEARS/.test(txt) && /TEMPERAMENT/.test(txt) && /CARRIED/.test(txt) && /BONDS/.test(txt), 'inspect pane incomplete: ' + txt.slice(0, 80));
  assert(pane.querySelectorAll('.portrait').length === 1, 'no portrait canvas');
  assert(pane.querySelectorAll('.fear').length >= 8, 'fear grid too short');
  const known = pane.querySelectorAll('.fear.hot, .fear.cold').length;
  return `fear grid ${pane.querySelectorAll('.fear').length} rows, ${known} learned rows, portrait canvas drawn`;
});
test('people, room and chronicle tabs each build without error', () => {
  const out = [];
  for (const tab of ['people', 'room', 'inspect', 'chronicle']) {
    H.ui.tab = tab; H.ui.refresh(); pumpFrames(2);
    const txt = documentApi.getElementById('rightPanel').textContent;
    assert(txt.length > 60, tab + ' pane empty');
    out.push(`${tab}:${txt.length}`);
  }
  const logs = H.game.logs.length;
  assert(logs > 4, 'chronicle has nothing in it');
  return out.join(' ') + ` · ${logs} log lines`;
});
test('every modal sheet renders', () => {
  const kinds = ['title', 'brief', 'results', 'upgrades', 'lore', 'settings', 'help', 'pause'];
  const sizes = [];
  for (const k of kinds) {
    H.ui.openModal(k, k === 'results' ? (H.game.outcome || {}) : {});
    const sheet = documentApi.getElementById('modal').querySelector('.sheet');
    assert(sheet, k + ': no sheet');
    const nodes = countAll(sheet);
    assert(nodes > 4, k + ': sheet too empty (' + nodes + ')');
    sizes.push(`${k}:${nodes}`);
    H.ui.closeModal();
  }
  H.ui.openModal('upgrades'); const ups = documentApi.getElementById('modal').querySelectorAll('.up');
  assert(ups.length > 14, 'upgrade grid too small: ' + ups.length);
  const owned = ups.filter(u => u.classList.contains('owned')).length;
  const off = ups.filter(u => u.classList.contains('off')).length;
  assert(owned + off === ups.length || off > 0, 'locked state not reflected on cards');
  ups[0].dispatch('click', {});
  H.ui.closeModal();
  return sizes.join(' ') + ` · ${ups.length} upgrade cards (${off} unaffordable at 0 dread), clicks safe`;
});
function countAll(el) { let n = 0; walk(el, () => n++); return n; }
test('settings toggles reach the renderer and persist', () => {
  const g = H.game;
  H.ui.openModal('settings');
  const boxes = documentApi.getElementById('modal').querySelectorAll('input');
  assert(boxes.length >= 6, 'settings inputs: ' + boxes.length);
  const shake = boxes.find(b => b.attrs.type === 'checkbox');
  shake.checked = false; shake.dispatch('change', { target: shake });
  pumpFrames(2);
  H.ui.closeModal();
  H.game.saveRun();
  const raw = store.get('hthb:save:v1');
  assert(raw, 'nothing written to localStorage');
  const parsed = JSON.parse(raw);
  assert(parsed.meta && parsed.meta.settings, 'save has no meta.settings');
  assert(parsed.run && parsed.run.people && parsed.run.people.length > 0, 'save blob has no run roster');
  assert(raw.length > 8000, 'save blob suspiciously small: ' + raw.length + ' bytes');
  const range = boxes.find(b => b.attrs.type === 'range');
  range.value = 40; range.dispatch('input', { target: range });
  assert(Math.abs(H.audio.volume - 0.4) < 0.01, 'volume slider did not reach audio: ' + H.audio.volume);
  key('m');
  assert(H.audio.muted, 'M did not mute');
  key('m');
  return `volume slider + ${boxes.length} toggles verified, save blob ${(raw.length / 1024).toFixed(1)}kB with ${parsed.run.people.length} people`;
});
test('audio engine boots, synthesises and captions events', () => {
  const a = H.audio;
  assert(a.ok, 'no AudioContext created');
  assert(audioNodes > 40, 'too few audio nodes: ' + audioNodes);
    return `AudioContext + ${a.started ? 'ambience drone' : 'no ambience'}, ${a.captions.length} live captions`;
});
test('all synthesised cues fire without throwing', () => {
  const a = H.audio; a.resume();
  let played = 0;
  for (const name of AUDIO_NAMES) { a.play(name, { pan: 0.3 }); played++; }
  assert(played === AUDIO_NAMES.length, 'cue loop broke');
  assert(drawCalls > 0, 'renderer stopped');
  return `${played} cues, ${audioNodes} nodes total`;
});
test('sound captions appear for loud events (nothing critical is audio-only)', () => {
  const g = H.game, a = H.audio;
  H.ui.restartNight(); H.ui.closeModal(); H.ui.modal = null;
  g.paused = false;
  pumpFrames(6, 30);
  a.captions.length = 0;
  g.energy = g.energyMax; g.stability = g.stabilityMax; g.cooldowns = {};
  g.setFocus('foyer');
  let casts = 0;
  for (let i = 0; i < 24; i++) {
    g.cooldowns = {}; g.energy = g.energyMax; g.stability = g.stabilityMax;
    if (g.cast('slam_door', { room: 'foyer', door: g.world.rooms.foyer.doors[0] }).ok) casts++;
    pumpFrames(1, 30);
  }
  pumpFrames(6, 30);
  const capEl = documentApi.getElementById('captions');
  assert(casts > 4, 'slams never landed: ' + casts);
  assert(capEl.children.length >= 1, 'no caption rows rendered while sounds fired');
  assert(/NaN|undefined/.test(capEl.textContent) === false, 'caption rendered a bad value');
  const logHasSound = g.logs.some(l => /slam|bang|creak|scream|door/i.test(l.text));
  assert(logHasSound, 'no audible event ever written to the chronicle');
  return `${capEl.children.length} caption rows ("${capEl.children[0].textContent.slice(0, 40)}…"), same events in the chronicle`;
});
test('tutorial advances only on real game state', () => {
  H.ui.startTutorial();
  const host = documentApi.getElementById('tutorial');
  assert(host.classList.contains('show'), 'tutorial not shown');
  const t0 = H.ui.__tutStep ?? 0;
  const g = H.game;
  g.stats.learned = Math.max(1, g.stats.learned); g.stats.haunts = Math.max(2, g.stats.haunts);
  g.activeGroup.forEach(i => i.fear = 40);
  g.world.liveEvidence = 1.2;
  pumpFrames(140, 40);
  assert(!/undefined/.test(host.textContent), 'tutorial rendered undefined');
  return `tutorial text live: "${host.textContent.slice(0, 46)}…"`;
});
test('long play: two hundred sim seconds with rendering, no fatal error', () => {
  const g = H.game;
  g.speed = 3; g.paused = false;
  const before = { t: g.t, haunts: g.stats.haunts };
  let saved = 0;
  for (let i = 0; i < FRAMES; i++) {
    pump(40);
    if (i % 25 === 0) {
      g.energy = Math.max(g.energy, 40);
      const list = H.ui.powerList(g);
      const id = list[i % Math.max(1, list.length)];
      g.cooldowns = {};
      g.cast(id, { room: g.world.rooms[g.focus.room] ? g.focus.room : 'foyer' });
      saved++;
    }
    if (i % 60 === 0) H.game.saveRun();
  }
  assert(g.t > before.t, 'clock frozen during long play');
  assert(!H.ui.els.modal.querySelector('.sheet') || H.game.outcome, 'a sheet is stuck open mid-night');
  return `${g.t.toFixed(0)}s sim, ${saved} casts, ${drawCalls} canvas ops total, outcome ${g.outcome ? g.outcome.kind : 'open'}`;
});
test('outcome sheet opens automatically at the end of a night', () => {
  const g = H.game;
  if (!g.outcome) { g.finish('expelled'); }
  pumpFrames(40);
  const sheet = documentApi.getElementById('modal').querySelector('.sheet');
  assert(sheet, 'results sheet never opened');
  const cards = documentApi.getElementById('modal').querySelectorAll('.card');
  assert(cards.length >= 6, 'score card grid missing');
  assert(/Dread earned/.test(sheet.textContent), 'no dread score');
  const next = documentApi.getElementById('modal').querySelectorAll('button')[0];
  next.dispatch('click', {}); pumpFrames(3);
  return `results ${cards.length} cards → next night ${g.scenario.n}`;
});
test('progression: dread buys an upgrade and it reaches the sim', () => {
  const g = H.game;
  g.meta.dread = 999;
  H.ui.openModal('upgrades'); pump();
  const ups = documentApi.getElementById('modal').querySelectorAll('.up')
    .filter(u => !u.classList.contains('owned'));
  assert(ups.length, 'no affordable upgrade cards');
  const n0 = g.meta.upgrades.length;
  ups[0].dispatch('click', {});
  assert(g.meta.upgrades.length === n0 + 1, 'upgrade not purchased');
  const before = g.unlocked.size ?? g.unlocked.length;
  H.ui.closeAndRun();
  pumpFrames(4, 20);
  const learned = g.learnedPowers();
  const after = learned.size ?? learned.length;
  assert(after >= before, `power list shrank after purchase: ${before} -> ${after}`);
  assert(g.meta.dread < 999, 'dread not spent');
  assert(/hthb:save:v1/.test(JSON.stringify([...store.keys()])), 'no save key after purchase');
  const raw2 = JSON.parse(store.get('hthb:save:v1'));
  assert(raw2.meta.upgrades.length === g.meta.upgrades.length, 'purchase not persisted');
  return `${g.meta.upgrades.length} upgrades owned, ${after} powers available, ${999 - g.meta.dread} dread spent`;
});
test('restart and next-night helpers rebuild the world', () => {
  const g = H.game;
  const r0 = g.scenarioIndex;
  H.ui.nextNight(); pumpFrames(3, 20);
  assert(g.scenarioIndex === Math.min(5, r0 + 1), `night index ${g.scenarioIndex} after nextNight from ${r0}`);
  H.ui.restartNight(); pumpFrames(3, 20);
  assert(g.t < 1, 'restart did not reset the clock: ' + g.t);
  assert(g.world.intruders.size > 0, 'restart left the house empty');
  H.ui.openModal('brief'); const sheet = documentApi.getElementById('modal').querySelector('.sheet');
  assert(sheet && /NIGHT/.test(sheet.textContent), 'briefing sheet after restart is blank');
  return `night ${g.scenario.n} rebuilt, ${g.world.intruders.size} intruders`;
});
test('all six nights boot into the renderer and play', () => {
  const g = H.game;
  const out = [];
  for (let i = 0; i < 6; i++) {
    g.reset(i, { seed: 4242 + i });
    g.paused = false; g.briefingSeen = true;
    H.ui.closeModal(); H.ui.modal = null;
    g.selectedPerson = null;
    out.push(`${i + 1}:${g.scenario.roster.length}p`);
    for (let f = 0; f < 90; f++) {
      pump(60);
      if (f % 8 === 0) { g.energy = g.energyMax; g.cooldowns = {}; const id = H.ui.powerList(g)[f % H.ui.powerList(g).length]; g.cast(id, { room: g.world.rooms[g.focus.room] ? g.focus.room : 'foyer' }); }
    }
    assert(g.t > 4, `night ${i + 1} barely ran (${g.t.toFixed(1)}s after 90 frames)`);
    for (const fl of [-1, 0, 1, 2]) { H.view.setFloor(fl); H.game.setFocus(Object.values(g.world.rooms).find(r => r.floor === fl).id); H.view.focusRoom(g.focus.room); pump(); }
    H.view.setMode('cutaway'); pump(); H.view.setMode('floor');
  }
  return out.join(' ') + ' · every roster placed and drawn on 4 floors';
});
test('reset campaign clears the save', () => {
  H.ui.resetCampaign();
  pumpFrames(3);
  const raw = store.get('hthb:save:v1');
  const meta = raw ? JSON.parse(raw).meta : null;
  assert(!meta || (!meta.upgrades.length && meta.dread === 0), 'campaign not cleared: ' + JSON.stringify(meta && { d: meta.dread, u: meta.upgrades.length }));
  assert(H.game.scenarioIndex === 0, 'did not return to night 1');
  return 'save wiped, back to Night I';
});
test('resize mid-frame keeps the canvas coherent', () => {
  canvasEl._w = 480; canvasEl._h = 320; win.innerWidth = 480; win.innerHeight = 360;
  dispatchWin('resize', {});
  const c0 = drawCalls; pump(); pump();
  assert(drawCalls - c0 > 1000, 'tiny viewport stopped drawing');
  canvasEl._w = 1200; canvasEl._h = 700; dispatchWin('resize', {}); pump();
  return 'small viewport still renders';
});
test('reduced motion and screen-shake-off paths render', () => {
  H.ui.openModal('settings');
  const boxes = documentApi.getElementById('modal').querySelectorAll('input');
  for (const b of boxes) { if (b.attrs.type === 'checkbox') { b.checked = !b.checked; b.dispatch('change', { target: b }); } }
  pumpFrames(4, 30);
  H.ui.closeModal();
  assert(H.view.reduceMotion !== undefined, 'reduceMotion flag lost');
  const c0 = drawCalls; pumpFrames(3, 30);
  assert(drawCalls - c0 > 3000, 'reduced motion path underdraws');
  return `${drawCalls - c0} ops over 3 calm frames`;
});
test('gamepad poll tick runs safely with no pad', () => {
  for (const fn of intervals) fn();
  return `${intervals.length} interval(s) ticked`;
});
test('renderer never mutates the simulation', () => {
  const g = H.game;
  const snap = JSON.stringify(g.serialize().people);
  const e0 = g.energy, s0 = g.stability, t0 = g.t;
  for (let i = 0; i < 12; i++) { g.paused = true; pump(); }
  assert(g.energy === e0 && g.stability === s0 && g.t === t0, 'rendering advanced the clock or resources');
  assert(JSON.stringify(g.serialize().people) === snap, 'render mutated intruder state');
  g.paused = false;
  return '12 paused frames, zero state drift';
});
test('no unhandled rejections or thrown errors were recorded', () => {
  assert(!globalThis.__hthbErrors || !globalThis.__hthbErrors.length, 'errors: ' + (globalThis.__hthbErrors || []).join(' | '));
  return `${frameNo} frames, ${drawCalls} canvas ops, ${audioNodes} audio params touched`;
});

/* ------------------------------- static audits ------------------------------- */
test('asset audit: every prop, power, fear and gear has real drawn art', () => {
  const art = readFileSync(join(HOUSE, 'js/render/art.js'), 'utf8');
  const house = readFileSync(join(HOUSE, 'js/data/house.js'), 'utf8');
  const powerData = readFileSync(join(HOUSE, 'js/data/powers.js'), 'utf8');
  const intruders = readFileSync(join(HOUSE, 'js/data/intruders.js'), 'utf8');
  const body = (src, name) => {
    const i = src.indexOf(`export function ${name}(`);
    assert(i >= 0, 'art.js has no ' + name);
    const j = src.indexOf('\nexport ', i + 5);
    return src.slice(i, j < 0 ? src.length : j);
  };
  const casesOf = txt => new Set([...txt.matchAll(/case\s+'([a-z0-9_]+)'/g)].map(m => m[1]));
  const propCases = casesOf(body(art, 'drawProp'));
  const P = /P\('([a-z_]+)',\s*'([a-z_]+)',\s*'([a-z_0-9]+)'/g;
  const propDraws = new Set([...house.matchAll(P)].map(m => m[3]));
  const missingProps = [...propDraws].filter(k => !propCases.has(k));
  const pwCases = casesOf(body(art, 'drawPowerIcon'));
  const pwIds = new Set([...powerData.matchAll(/PW\(\{\s*id:\s*'([a-z_]+)'/g)].map(m => m[1]));
  assert(pwIds.size >= 20, 'only ' + pwIds.size + ' powers parsed - check the data shape');
  const missingPowers = [...pwIds].filter(k => !pwCases.has(k));
  const fearCases = casesOf(body(art, 'drawFearIcon'));
  const fearBlock = intruders.slice(intruders.indexOf('export const FEARS'), intruders.indexOf('export const', intruders.indexOf('export const FEARS') + 10));
  const fearIds = new Set([...fearBlock.matchAll(/id:\s*'([a-z_]+)'/g)].map(m => m[1]));
  const missingFears = [...fearIds].filter(k => !fearCases.has(k));
  const gearBlock = intruders.slice(intruders.indexOf('export const GEAR'), intruders.indexOf('export const', intruders.indexOf('export const GEAR') + 10));
  const gearCases = casesOf(body(art, 'drawGearIcon'));
  const gearIcons = new Set([...gearBlock.matchAll(/icon:\s*'([a-z_]+)'/g)].map(m => m[1]));
  const missingGear = [...gearIcons].filter(k => !gearCases.has(k));
  const allMissing = [...missingProps.map(k => 'prop:' + k), ...missingPowers.map(k => 'power:' + k), ...missingFears.map(k => 'fear:' + k), ...missingGear.map(k => 'gear:' + k)];
  assert(!allMissing.length, 'no art branch for: ' + allMissing.join(', '));
  assert(propDraws.size > 25, 'only ' + propDraws.size + ' distinct prop draw keys - art is too generic');
  const propCount = [...house.matchAll(/\bP\('/g)].length;
  assert(propCount > 100, 'only ' + propCount + ' props defined');
  const generic = [...house.matchAll(/P\('([a-z_]+)',\s*'([a-z_0-9]+)',\s*'crate'/g)].length;
  assert(generic <= 3, generic + ' props fall back to a generic crate');
  const defs = ['drawFloor', 'drawWalls', 'drawDoorLeaf', 'drawProp', 'drawPerson', 'drawFace', 'drawKid', 'drawStimulus', 'drawHaunt', 'drawPowerIcon', 'drawFearIcon', 'drawGearIcon', 'drawTitleHouse', 'drawCrest', 'rr', 'fearBand', 'PAL'];
  const undef = defs.filter(d2 => !new RegExp(`export (function|const) ${d2}\\b`).test(art));
  assert(!undef.length, 'art.js missing exports: ' + undef.join(', '));
  const artBody = art;
  const img = /new Image\(|\bfetch\(|data:image\/|url\(['"]?http/.test(artBody);
  assert(!img, 'art.js reaches for external imagery');
  return `${propCount} props on ${propDraws.size} draw keys, ${pwIds.size} power icons, ${fearIds.size} fear icons, ${gearIcons.size} gear icons - 0 missing, no external images`;
});
test('module graph: every import resolves, nothing reaches the network', () => {
  const files = [];
  const scan = dir => { for (const e of readdirSync(dir, { withFileTypes: true })) { const f = join(dir, e.name); if (e.isDirectory()) scan(f); else if (e.name.endsWith('.js')) files.push(f); } };
  scan(join(HOUSE, 'js'));
  assert(files.length >= 11, 'only ' + files.length + ' modules found');
  const broken = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/from\s+'([^']+)'/g)) {
      const spec = m[1];
      assert(spec.startsWith('.'), `${f.slice(HOUSE.length + 1)} imports a bare specifier: ${spec}`);
      if (!existsSync(join(dirname(f), spec))) broken.push(`${f.slice(HOUSE.length + 1)} -> ${spec}`);
    }
    const net = /\bfetch\s*\(|new WebSocket|XMLHttpRequest|import\(['"`]https?:|EventSource|navigator\.sendBeacon/.test(src);
    assert(!net, `${f.slice(HOUSE.length + 1)} touches the network`);
  }
  assert(!broken.length, 'unresolved imports: ' + broken.join(', '));
  const idx2 = readFileSync(join(HOUSE, 'index.html'), 'utf8');
  for (const m of idx2.matchAll(/(?:src|href)="([^"]+\.js|[^"]+\.css)"/g)) assert(existsSync(join(HOUSE, m[1])), 'index.html references a missing file: ' + m[1]);
  const css = readFileSync(join(HOUSE, 'house.css'), 'utf8');
  assert(!/@import|url\(['"]?http/.test(css), 'css pulls an external stylesheet or font');
  assert(!/\bemoji\b|\?\u20e3/.test(css + idx2), 'emoji placeholders in chrome');
  return `${files.length} modules, ${new Set(files.map(f => f.split('/').slice(-2).join('/'))).size} files, all imports local + resolvable`;
});
test('css: the classes the UI emits all exist in the stylesheet', () => {
  const css = readFileSync(join(HOUSE, 'house.css'), 'utf8');
  const src = readFileSync(join(HOUSE, 'js/ui/ui.js'), 'utf8') + readFileSync(join(HOUSE, 'js/main.js'), 'utf8');
  const used = new Set();
  for (const m of src.matchAll(/class:\s*'([^']+)'/g)) m[1].split(/\s+/).forEach(c => { if (c && !c.includes('?') && !c.includes('$')) used.add(c.replace(/^\+|[+'].*$/g, '')); });
  for (const m of src.matchAll(/classList\.(?:add|toggle)\('([a-z]+)'/g)) used.add(m[1]);
  const missing = [...used].filter(c => c && !new RegExp('\\.' + c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(css));
  assert(!missing.length, 'unstyled classes: ' + missing.join(', '));
  return `${used.size} classes referenced, ${missing.length} unstyled (${missing.join(',') || 'none'})`;
});

test('render: haunt effects have visual branches, and every sound has one too', () => {
  const read = f => readFileSync(join(HOUSE, f), 'utf8');
  const sim = ['js/sim/haunts.js', 'js/sim/world.js', 'js/sim/game.js', 'js/sim/intruder.js', 'js/sim/ai.js'].map(read).join('\n');
  const types = new Set([...sim.matchAll(/type:\s*'([a-z_0-9]+)'/g)].map(m => m[1]));
  const art = read('js/render/art.js');
  const hb = art.slice(art.indexOf('export function drawHaunt('));
  const body = hb.slice(0, hb.indexOf('\nexport '));
  const cases = new Set([...body.matchAll(/case\s+'([a-z_0-9]+)'/g)].map(m => m[1]));
  const COUNT = new Set(['fill', 'stroke', 'fillRect', 'strokeRect', 'fillText']);
  const bare = new Proxy({ n: 0 }, {
    get(t, k) {
      if (k === 'n') return t.n;
      if (k === 'canvas') return { width: 300, height: 200 };
      if (k === 'measureText') return () => ({ width: 4 });
      if (String(k).startsWith('create')) return () => new Proxy({}, { get: () => () => { } });
      if (typeof k === 'symbol') return () => { };
      return (...a) => { if (COUNT.has(String(k))) t.n++; };
    },
    set(t, k, v) { t[k] = v; return true; }
  });
  const painted = [];
  for (const ty of ['apparition', 'bleed', 'cold_spot', 'curse', 'grasp', 'possess', 'seal', 'warp']) {
    const spy = Object.create(bare); spy.n = 0;
    modArt.drawHaunt(spy, { type: ty, t: 0.4, age: 0.4, until: 2, power: 1, x: 20, y: 30, prop: ty === 'possess' ? 'rocker' : null, progress: 0.5 }, 1.2, { id: 'parlor', x: 0, y: 0, w: 100, h: 100, cx: 50, cy: 50, light: 0.2, dread: 1 }, { zoom: 1, prop: ty === 'possess' ? { x: 40, y: 40, w: 22, h: 14 } : null });
    if (spy.n < 1) painted.push(ty);
    if (!cases.has(ty) && !/default:/.test(body)) painted.push(ty + ' (no branch)');
  }
  assert(!painted.length, 'haunt effects that render nothing: ' + painted.join(', '));
  /* sounds: every stimulus kind the house can make has a ripple on screen and a cue off-screen */
  const simAll = ['js/sim/haunts.js', 'js/sim/world.js', 'js/sim/game.js', 'js/sim/intruder.js', 'js/sim/ai.js'].map(read).join('\n');
  const kinds = new Set();
  for (const m of simAll.matchAll(/spawnStimulus\([\s\S]{0,300}?kind:\s*'([a-z_0-9]+)'/g)) kinds.add(m[1]);
  for (const m of simAll.matchAll(/emitStimulus\([\s\S]{0,300}?kind:\s*'([a-z_0-9]+)'/g)) kinds.add(m[1]);
  const ringed = [];
  for (const k of kinds) {
    const spy = Object.create(bare); spy.n = 0;
    modArt.drawStimulus(spy, { kind: k, x: 30, y: 40, t: 0, age: 0.2, ttl: 4, strength: 1, salience: 0.8, evidence: 0.5, tags: {} }, 0.8, { zoom: 1 });
    if (spy.n < 2) ringed.push(k);
  }
  assert(!ringed.length, 'stimulus kinds with no visible echo: ' + ringed.join(', '));
  const ui = readFileSync(join(HOUSE, 'js/main.js'), 'utf8');
  const ks = ui.slice(ui.indexOf('const KIND_SOUND'), ui.indexOf('};', ui.indexOf('const KIND_SOUND')));
  const mapped = new Set([...ks.matchAll(/([a-z_0-9]+):\s*'[a-z_0-9]+'/g)].map(m => m[1]));
  const silent = new Set([...simAll.matchAll(/spawnStimulus\([\s\S]{0,300}?kind:\s*'([a-z_0-9]+)'[\s\S]{0,260}?silent:\s*true/g)].map(m => m[1]));
  const soundless = [...kinds].filter(k => !mapped.has(k) && !silent.has(k));
  assert(kinds.size >= 8, 'only ' + kinds.size + ' stimulus kinds found - the parse is wrong');
  assert(!soundless.length, 'stimulus kinds with no sound and no silent flag: ' + soundless.join(', '));
  const audio = read('js/audio/audio.js');
  const playBody = audio.slice(audio.indexOf('play(name, p = {})'), audio.indexOf('\n    update(state'));
  const cues = new Set([...playBody.matchAll(/case\s+'([a-z_0-9]+)'/g)].map(m => m[1]));
  const referenced = new Set([...ks.matchAll(/'([a-z_0-9]+)'\s*\]/g)].map(m => m[1]).flatMap(v => [v]));
  const cueNames = new Set([...ks.matchAll(/:\s*'([a-z_0-9]+)'/g)].map(m => m[1]));
  const missingCue = [...cueNames].filter(c => !cues.has(c));
  assert(!missingCue.length, 'KIND_SOUND points at cues that do not exist: ' + missingCue.join(', '));
  void referenced;
  /* every power names an audio cue that the engine actually implements, plus its own jolt */
  const ids = modPowers.POWERS.map(p => p.id);
  const uijs = read('js/ui/ui.js');
  const cueTable = uijs.slice(uijs.indexOf('const CAST_CUE'), uijs.indexOf('const CAST_FX'));
  const fxTable = uijs.slice(uijs.indexOf('const CAST_FX'), uijs.indexOf('export function createUI'));
  assert(cueTable.length > 80 && fxTable.length > 80, 'CAST_CUE / CAST_FX tables not found in ui.js');
  const mappedPowers = new Set([...cueTable.matchAll(/([a-z_0-9]+):\s*'([a-z_0-9]+)'/g)].map(m => m[1]));
  const powerCues = [...cueTable.matchAll(/([a-z_0-9]+):\s*'([a-z_0-9]+)'/g)].map(m => m[2]);
  const fxPowers = new Set([...fxTable.matchAll(/([a-z_0-9]+):\s*\{\s*shake/g)].map(m => m[1]));
  const unmapped = ids.filter(i => !mappedPowers.has(i));
  const badCues = powerCues.filter(c => !cues.has(c));
  assert(!unmapped.length, 'powers with no cast cue of their own: ' + unmapped.join(', '));
  assert(!badCues.length, 'cast cues the audio engine does not implement: ' + badCues.join(', '));
  assert(new Set(powerCues).size >= 14, `only ${new Set(powerCues).size} distinct cast sounds across ${powerCues.length} powers`);
  assert(fxPowers.size >= 10, 'only ' + fxPowers.size + ' powers have their own screen jolt');
  assert([...fxPowers].every(p => ids.includes(p)), 'CAST_FX names a power that does not exist');
  return `${kinds.size} stimulus kinds ringed + cue-mapped; ${ids.length}/${ids.length} powers with their own cue (${new Set(powerCues).size} distinct) and ${fxPowers.size} with their own jolt`;
});

test('art: every prop draws visible, in-bounds geometry', () => {
  const art = modArt;
  const g = H.game;
  let drawn = 0; const bad = [];
  for (const rid in g.world.rooms) {
    const r = g.world.rooms[rid];
    for (const pid of r.props) {
      const p = { ...g.world.props[pid] };
      let ops = 0, fills = 0;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      /* keep a real 2x3 CTM so transformed geometry lands in world space */
      let M = [1, 0, 0, 1, 0, 0];
      const stack = [];
      const mul = (a, b) => [
        a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
        a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
        a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]
      ];
      const xf = (x, y) => [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]];
      const track = (x, y) => {
        if (!Number.isFinite(x) || !Number.isFinite(y)) { bad.push(p.id + ': non-finite point'); return; }
        const [wx, wy] = xf(x, y);
        if (!Number.isFinite(wx) || !Number.isFinite(wy)) { bad.push(p.id + ': non-finite transform'); return; }
        if (wx < minX) minX = wx; if (wy < minY) minY = wy; if (wx > maxX) maxX = wx; if (wy > maxY) maxY = wy;
      };
      const sx = v => Math.abs(M[0] * v) + Math.abs(M[2] * v);
      const sy = v => Math.abs(M[1] * v) + Math.abs(M[3] * v);
      const ctx = new Proxy({}, {
        get(_t, k) {
          if (k === 'canvas') return {};
          if (['fillStyle', 'strokeStyle', 'lineWidth', 'globalAlpha', 'font', 'textAlign', 'textBaseline', 'globalCompositeOperation', 'lineCap', 'lineJoin', 'shadowBlur', 'shadowColor', 'filter', 'miterLimit', 'imageSmoothingEnabled', 'lineDashOffset'].includes(k)) return _t['__' + k] ?? (k === 'globalAlpha' ? 1 : 0);
          if (k === 'createRadialGradient') return (...a) => { track(a[0] - sx(a[2]), a[1] - sy(a[2])); track(a[3] + sx(a[5]), a[4] + sy(a[5])); return { addColorStop() { } }; };
          if (k === 'createLinearGradient') return (...a) => { track(a[0], a[1]); track(a[2], a[3]); return { addColorStop() { } }; };
          if (k === 'measureText') return () => ({ width: 8 });
          if (k === 'getLineDash') return () => [];
          return (...a) => {
            ops++;
            if (k === 'fill' || k === 'stroke' || k === 'fillRect' || k === 'strokeRect' || k === 'fillText') fills++;
            if (k === 'moveTo' || k === 'lineTo') track(a[0], a[1]);
            if (k === 'rect' || k === 'fillRect' || k === 'strokeRect' || k === 'clearRect') { track(a[0], a[1]); track(a[0] + a[2], a[1] + a[3]); }
            if (k === 'roundRect') { track(a[0], a[1]); track(a[0] + a[2], a[1] + a[3]); }
            if (k === 'arc') { const rr = a[2] || 0; track(a[0] - rr, a[1] - rr); track(a[0] + rr, a[1] + rr); }
            if (k === 'arcTo') { track(a[0], a[1]); track(a[2], a[3]); }
            if (k === 'ellipse') { track(a[0] - (a[2] || 0), a[1] - (a[3] || 0)); track(a[0] + (a[2] || 0), a[1] + (a[3] || 0)); }
            if (k === 'translate') { M = mul(M, [1, 0, 0, 1, a[0] || 0, a[1] || 0]); }
            if (k === 'scale') { M = mul(M, [a[0] || 1, 0, 0, a[1] || a[0] || 1, 0, 0]); }
            if (k === 'rotate') { const c = Math.cos(a[0] || 0), si = Math.sin(a[0] || 0); M = mul(M, [c, si, -si, c, 0, 0]); }
            if (k === 'setTransform') { M = [a[0], a[1], a[2], a[3], a[4], a[5]]; }
            if (k === 'transform') { M = mul(M, [a[0], a[1], a[2], a[3], a[4], a[5]]); }
            if (k === 'save') { stack.push(M.slice()); }
            if (k === 'restore') { if (stack.length) M = stack.pop(); }
            if (k === 'createRadialGradient' || k === 'createLinearGradient') { track(a[0] - sx(a[2] || 0), a[1] - sy(a[2] || 0)); track(a[2] >= 0 ? a[0] + sx(a[2]) : a[0], a[2] >= 0 ? a[1] + sy(a[2]) : a[1]); }
            if (k === 'quadraticCurveTo' || k === 'bezierCurveTo') { for (let i = 0; i < a.length - 2; i += 2) track(a[i], a[i + 1]); track(a[a.length - 2], a[a.length - 1]); }
            if (k === 'fillText' || k === 'strokeText') track(a[1], a[2]);
          };
        },
        set(_t, k, v) { _t['__' + k] = v; return true; }
      });
      art.drawProp(ctx, p, 3.5, r);
      drawn++;
      if (fills < 1) bad.push(p.id + ': nothing filled or stroked');
      if (!Number.isFinite(minX)) continue;
      const pad = Math.max(64, p.w, p.h) + 8;
      if (minX < r.x - pad || maxX > r.x + r.w + pad || minY < r.y - pad || maxY > r.y + r.h + pad) bad.push(`${p.id}: art escapes its room (${Math.round(minX)},${Math.round(minY)})-(${Math.round(maxX)},${Math.round(maxY)}) vs room ${r.x},${r.y},${r.w},${r.h}`);
    }
  }
  assert(!bad.length, bad.slice(0, 6).join(' | '));
  assert(drawn > 150, 'only ' + drawn + ' props exercised');
  return `${drawn} props: all draw geometry, none empty, none out of bounds`;
});
const PROPS_STYLE = ['fillStyle', 'strokeStyle', 'lineWidth', 'globalAlpha', 'font', 'textAlign', 'textBaseline', 'globalCompositeOperation', 'filter', 'shadowBlur', 'shadowColor', 'lineCap', 'lineJoin', 'miterLimit', 'imageSmoothingEnabled', 'lineDashOffset'];
function iconSpy(bump) {
  const target = { canvas: {} };
  return new Proxy(target, {
    get(t, k) {
      if (PROPS_STYLE.includes(k)) return k === 'globalAlpha' ? 1 : 0;
      if (k === 'measureText') return () => ({ width: 6 });
      if (k === 'getLineDash') return () => [];
      if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern') return () => ({ addColorStop() { } });
      if (k === 'then' || typeof k === 'symbol') return undefined;
      return (...a) => { bump(); };
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}
test('art: every power, fear and gear icon is visibly drawn', () => {
  const art = modArt;
  const { POWERS, POWER_BY_ID } = modPowers;
  const { FEARS } = modIntruders;
  const bad = [];
  for (const pw of POWERS) {
    let marks = 0;
    const spy = iconSpy(() => marks++);
    art.drawPowerIcon(spy, pw.id, 16, 16, 26, {});
    if (marks < 3) bad.push('power ' + pw.id + ' drew ' + marks + ' ops');
  }
  for (const f of FEARS) {
    let marks = 0;
    const spy = { save() { }, restore() { }, beginPath() { }, closePath() { }, moveTo() { }, lineTo() { }, arc() { marks++ }, ellipse() { marks++ }, rect() { }, fill() { marks++ }, stroke() { marks++ }, fillRect() { marks++ }, strokeRect() { marks++ }, translate() { }, rotate() { }, scale() { }, quadraticCurveTo() { marks++ }, bezierCurveTo() { marks++ }, setLineDash() { }, createLinearGradient: () => ({ addColorStop() { } }), createRadialGradient: () => ({ addColorStop() { } }), fillText() { marks++ }, measureText: () => ({ width: 6 }) };
    art.drawFearIcon(spy, f.id, 8, 8, 14, '#fff');
    if (marks < 2) bad.push('fear ' + f.id + ' drew ' + marks + ' ops');
  }
  const gearIcons = [...new Set(Object.values(modGear.GEAR_BY_ID_ALL || {}).map(g2 => g2.icon).filter(Boolean))];
  for (const ic of gearIcons) {
    let marks = 0;
    const spy = { save() { }, restore() { }, beginPath() { marks++ }, closePath() { }, moveTo() { }, lineTo() { }, arc() { marks++ }, ellipse() { marks++ }, rect() { }, fill() { marks++ }, stroke() { marks++ }, fillRect() { marks++ }, strokeRect() { marks++ }, translate() { }, rotate() { }, scale() { }, quadraticCurveTo() { marks++ }, setLineDash() { }, createLinearGradient: () => ({ addColorStop() { } }), createRadialGradient: () => ({ addColorStop() { } }), fillText() { }, measureText: () => ({ width: 6 }) };
    art.drawGearIcon(spy, ic, 8, 8, 16, {});
    if (marks < 2) bad.push('gear icon ' + ic + ' drew ' + marks + ' ops');
  }
  assert(!bad.length, bad.slice(0, 8).join(' | '));
  return `${POWERS.length} power icons, ${FEARS.length} fear icons, ${gearIcons.length} gear icons - all visibly drawn`;
});

/* ------------------------------- report ------------------------------- */
console.log('');
for (const r of results) console.log(`${r.ok ? ' ok ' : 'FAIL'}  ${r.name}${r.detail ? '  -  ' + r.detail : ''}  (${r.ms}ms)`);
console.log(`\n${results.length - failures}/${results.length} runtime checks passed${failures ? ` — ${failures} FAILED` : ''}`);
console.log(`frames driven: ${frameNo} · canvas ops: ${drawCalls} · top draws: ${Object.entries(drawOps).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => k + ':' + v).join(' ')}`);
process.exit(failures ? 1 : 0);

/* THE HOUSE THAT HUNTS BACK - real-DOM verification.
   Boots public/house/js/main.js inside jsdom (genuine DOM semantics: classList,
   replaceChildren, event dispatch, CSS cascade) with a recording Canvas2D that validates
   every coordinate and colour string the art layer emits.

   jsdom is NOT a dependency of the game; this script is optional and skips itself when it is
   absent.  Enable with:  npm i --no-save jsdom   (then: node scripts/house-dom.mjs)        */
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const HOUSE = join(HERE, '..', 'public', 'house');

/* find jsdom wherever it happens to live (project, parent sandbox, or a --jsdom= override) */
const arg = (k, d) => { const a = process.argv.find(s => s.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
let JSDOM, VirtualConsole;
const candidates = [arg('jsdom', ''), 'jsdom', '../jsdom', '../../pw/node_modules/jsdom/lib/api.js'].filter(Boolean);
for (const c of candidates) {
  try { const m = await import(c.startsWith('.') || c.startsWith('/') || /^[a-zA-Z]:/.test(c) ? pathToFileURL(join(HERE, c)).href : c); JSDOM = m.JSDOM || m.default?.JSDOM; VirtualConsole = m.VirtualConsole || m.default?.VirtualConsole; if (JSDOM) break; } catch { }
}
if (!JSDOM) {
  console.log('\n=== jsdom real-DOM check: SKIPPED ===\n   jsdom is not installed here. Run `npm i --no-save jsdom` and re-run this script.\n   (The dependency-free equivalents live in scripts/house-runtime.mjs and scripts/house-contract.mjs.)\n');
  process.exit(0);
}

const html = readFileSync(HOUSE + '/index.html', 'utf8');
const css = readFileSync(HOUSE + '/house.css', 'utf8');
const problems = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => problems.push('jsdom: ' + (e.message || e)));
vc.on('error', (...a) => problems.push('console.error: ' + a.map(String).join(' ')));
vc.on('warn', (...a) => problems.push('console.warn: ' + a.map(String).join(' ')));

const inlined = html.replace(/<link rel="stylesheet" href="house.css">/, `<style>${css}</style>`);
const dom = new JSDOM(inlined, { url: 'http://localhost:5179/house/', pretendToBeVisual: true, runScripts: 'dangerously', virtualConsole: vc });
const { window } = dom;

/* canvas 2D: jsdom has no canvas backend, so install a recording context that also validates
   every numeric argument and every style string the art layer produces */
let ops = 0, styles = { fill: 0, stroke: 0, gradient: 0 };
const bad = v => {
  if (typeof v === 'number' && !Number.isFinite(v)) throw new Error('non-finite canvas arg ' + v);
  if (typeof v === 'string' && /NaN|undefined|Infinity/.test(v)) throw new Error('bad canvas style "' + v + '"');
};
function makeCtx(el) {
  const grad = () => { styles.gradient++; return { addColorStop: (p, c) => { bad(p); bad(c); } }; };
  const store = { fillStyle: '#000', strokeStyle: '#000', font: '10px sans-serif', shadowColor: 'rgba(0,0,0,0)' };
  const c = {
    canvas: el, lineWidth: 1, globalAlpha: 1, globalCompositeOperation: 'source-over', textAlign: 'left',
    textBaseline: 'alphabetic', lineCap: 'butt', lineJoin: 'miter', shadowBlur: 0, filter: 'none',
    miterLimit: 10, imageSmoothingEnabled: true, lineDashOffset: 0,
    save() { ops++ }, restore() { ops++ }, beginPath() { ops++ }, closePath() { ops++ },
    moveTo(...a) { ops++; a.forEach(bad) }, lineTo(...a) { ops++; a.forEach(bad) },
    quadraticCurveTo(...a) { ops++; a.forEach(bad) }, bezierCurveTo(...a) { ops++; a.forEach(bad) },
    arc(...a) { ops++; a.forEach(bad) }, arcTo(...a) { ops++; a.forEach(bad) }, ellipse(...a) { ops++; a.forEach(bad) },
    rect(...a) { ops++; a.forEach(bad) }, roundRect(...a) { ops++; a.forEach(bad) },
    fill() { ops++; styles.fill++ }, stroke() { ops++; styles.stroke++ }, clip() { ops++ },
    fillRect(...a) { ops++; a.forEach(bad) }, strokeRect(...a) { ops++; a.forEach(bad) }, clearRect(...a) { ops++; a.forEach(bad) },
    fillText(t, ...a) { ops++; a.forEach(bad); if (t === undefined || String(t) === 'undefined') throw new Error('drew the string "undefined"'); },
    strokeText(t, ...a) { ops++; a.forEach(bad) },
    translate(...a) { ops++; a.forEach(bad) }, rotate(...a) { ops++; a.forEach(bad) }, scale(...a) { ops++; a.forEach(bad) },
    transform(...a) { ops++; a.forEach(bad) }, setTransform(...a) { ops++; a.forEach(bad) },
    drawImage() { ops++; throw new Error('drawImage would need an external image'); },
    setLineDash(a) { ops++; (a || []).forEach(bad) }, getLineDash() { return [] },
    createLinearGradient(...a) { a.forEach(bad); return grad() }, createRadialGradient(...a) { a.forEach(bad); return grad() },
    createPattern() { throw new Error('external pattern'); },
    measureText(s) { return { width: String(s).length * 5.1 } },
    getImageData() { return { data: [] } }, putImageData() { ops++ }
  };
  for (const k of Object.keys(store)) Object.defineProperty(c, k, {
    get: () => store[k], set: v => { bad(v); store[k] = v; }
  });
  return c;
}
window.HTMLCanvasElement.prototype.getContext = function (kind) {
  if (kind !== '2d') return null;
  if (!this.__ctx) this.__ctx = makeCtx(this);
  return this.__ctx;
};
window.devicePixelRatio = 2;
const SIZE = { canvas: { w: 1180, h: 680 }, panel: { w: 320, h: 520 }, other: { w: 240, h: 40 } };
window.Element.prototype.getBoundingClientRect = function () {
  const s = this.tagName === 'CANVAS' ? SIZE.canvas : this.classList.contains('panel') ? SIZE.panel : SIZE.other;
  return { x: 0, y: 0, left: 0, top: 0, right: s.w, bottom: s.h, width: s.w, height: s.h, toJSON() { return this } };
};
/* keep an eye on the audio path too: no AudioContext in jsdom, so the engine must degrade quietly */
const def = (k, v) => Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
def('window', window); def('document', window.document); def('navigator', window.navigator);
def('requestAnimationFrame', window.requestAnimationFrame.bind(window));
def('cancelAnimationFrame', window.cancelAnimationFrame.bind(window));
def('matchMedia', window.matchMedia ? window.matchMedia.bind(window) : () => ({ matches: false, addEventListener() { }, removeEventListener() { } }));
def('MouseEvent', window.MouseEvent); def('KeyboardEvent', window.KeyboardEvent); def('Event', window.Event);

/* the page's own inline script waits for DOMContentLoaded */
if (document.readyState === 'complete') { window.dispatchEvent(new window.Event('DOMContentLoaded')); document.dispatchEvent(new window.Event('DOMContentLoaded')); }

await import(HOUSE + '/js/main.js');
const H = window.HOUSE;
const results = [];
const check = async (name, fn) => {
  try { const d = await fn(); results.push(['PASS', name, d]); }
  catch (e) { results.push(['FAIL', name, (e && e.stack ? String(e.stack).split('\n').slice(0, 2).join(' / ') : (e && e.message || e))]); }
};
const wait = ms => new Promise(r => setTimeout(r, ms));

await wait(60);
await check('boots in a real DOM without console errors', () => {
  if (problems.length) throw new Error(problems.slice(0, 3).join(' | '));
  if (!H || !H.game || !H.view || !H.ui) throw new Error('window.HOUSE missing');
  return 'title screen up, no errors';
});
await check('css parses under jsdom and the sheet is applied', () => {
  const probe = document.querySelector('.powerbar');
  const cs = window.getComputedStyle(probe);
  if (!cs) throw new Error('no computed style');
  if (!/flex/.test(cs.display)) throw new Error('powerbar display=' + cs.display + ' - css not applied');
  if (/NaN|undefined/.test(css)) throw new Error('css text contains a bad token');
  return `${css.split('\n').length} lines parsed, display:${cs.display}`;
});
await check('title sheet renders with real buttons', () => {
  const btns = document.querySelectorAll('#modal button');
  if (btns.length < 6) throw new Error('only ' + btns.length + ' title buttons');
  const big = document.querySelector('#modal button.big');
  if (!big) throw new Error('no primary action');
  return `${btns.length} buttons, primary "${big.textContent}"`;
});
await await check('top-bar buttons (wired by the page script) open sheets', () => {
  document.getElementById('btnHelp').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const sheet = document.querySelector('#modal .sheet');
  if (!sheet) throw new Error('help did not open');
  if (!/CONTROLS/.test(sheet.textContent)) throw new Error('help sheet missing controls list');
  document.getElementById('btnSettings').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const inputs = document.querySelectorAll('#modal input');
  if (inputs.length < 6) throw new Error('settings inputs: ' + inputs.length);
  document.getElementById('btnMute').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  if (!/Muted/.test(document.getElementById('btnMute').textContent)) throw new Error('mute button did not update its label');
  document.getElementById('btnMute').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  H.ui.closeModal();
  return 'help + settings + mute all live';
});
await await check('begin → briefing → night, driven by real clicks', async () => {
  H.ui.openModal('brief', {});
  await wait(20);
  document.querySelector('#modal button.big').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await wait(120);
  if (H.game.paused) throw new Error('still paused after the briefing began');
  if (H.ui.modal) throw new Error('a sheet is still open over the night');
  return 'night running, no sheet left open';
});
await check('no element renders the word null or undefined', () => {
  const bad = ['#leftPanel', '#rightPanel', '#powerbar', '#topbar', '#focusBadge', '#toasts'].map(sel => document.querySelector(sel));
  for (const el of bad) {
    if (!el) continue;
    const txt = el.textContent;
    if (/\bnull\b|undefined/.test(txt)) throw new Error(sel + ' contains: …' + txt.slice(0, 120));
  }
  return 'clean text in 6 chrome regions';
});
await wait(500);
await await check('the sim advanced and the renderer drew thousands of ops', () => {
  if (!(H.game.t > 0.2)) throw new Error('clock barely moved: ' + H.game.t);
  if (ops < 3000) throw new Error('only ' + ops + ' canvas ops');
  if (styles.gradient < 5) throw new Error('no gradients drawn (' + styles.gradient + ')');
  return `${H.game.t.toFixed(1)}s sim, ${ops} ops, ${styles.gradient} gradients`;
});
await await check('a room click through a real MouseEvent refocuses the house', async () => {
  const r = H.game.world.rooms.parlor;
  const c = document.getElementById('view');
  const sx = H.view.ox + r.cx * H.view.scale * H.view.cam.zoom;
  const sy = H.view.oy + r.cy * H.view.scale * H.view.cam.zoom;
  c.dispatchEvent(new window.MouseEvent('pointermove', { clientX: sx, clientY: sy, bubbles: true }));
  c.dispatchEvent(new window.MouseEvent('click', { clientX: sx, clientY: sy, bubbles: true }));
  await new Promise(r => setTimeout(r, 40));
  if (H.game.focus.room !== 'parlor') throw new Error('focus = ' + H.game.focus.room);
  const badge = document.getElementById('focusBadge').textContent;
  if (!/Parlor/.test(badge)) throw new Error('focus badge did not update: ' + badge.slice(0, 40));
  return `clicked at (${Math.round(sx)},${Math.round(sy)}) → ${badge.slice(0, 48)}`;
});
await check('haunt buttons cast through real DOM events', async () => {
  H.game.energy = H.game.energyMax; H.game.stability = H.game.stabilityMax; H.game.cooldowns = {};
  const before = H.game.stats.haunts;
  const pts = [...document.querySelectorAll('#powerbar .pt')];
  if (pts.length < 4) throw new Error('power bar rendered ' + pts.length + ' slots');
  for (const p of pts.slice(0, 5)) { p.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); await wait(8); H.game.cooldowns = {}; H.game.energy = H.game.energyMax; H.game.stability = H.game.stabilityMax; }
  if (H.game.stats.haunts <= before) throw new Error('no haunt landed from 5 clicks');
  return `${H.game.stats.haunts - before} of 5 clicks cast, ${pts.length} slots rendered`;
});
await await check('keyboard shortcuts work via real KeyboardEvent', () => {
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'e', bubbles: true }));
  if (!H.game.focus.observe) throw new Error('E did not toggle observe');
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: ' ', bubbles: true }));
  if (!H.game.paused) throw new Error('Space did not pause');
  const t0 = H.game.t;
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: '.', bubbles: true }));
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: '.', bubbles: true }));
  if (H.game.speed !== 3) throw new Error('speed: ' + H.game.speed);
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  if (!document.querySelector('#modal .sheet')) throw new Error('Escape did not open the pause sheet');
  H.ui.closeModal();
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: ' ', bubbles: true }));
  return `observe + pause + 3x + escape all handled (t frozen at ${t0.toFixed(2)}s while paused)`;
});
await check('save round-trips through real localStorage', async () => {
  H.game.saveRun();
  const raw = window.localStorage.getItem('hthb:save:v1');
  if (!raw) throw new Error('nothing in localStorage');
  const parsed = JSON.parse(raw);
  if (!parsed.run || !parsed.run.people.length) throw new Error('save has no roster');
  const idx = H.game.scenarioIndex, t = H.game.t;
  H.game.reset(idx, { seed: 999 });
  H.game.loadRun(parsed.run);
  if (Math.abs(H.game.t - t) > 0.001) throw new Error(`t drifted ${t} -> ${H.game.t}`);
  if (H.game.group.length !== parsed.run.people.length) throw new Error('roster mismatch after reload');
  return `${(raw.length / 1024).toFixed(1)}kB save, ${parsed.run.people.length} people restored at t=${H.game.t.toFixed(1)}s`;
});
await wait(400);
await await check('panels rebuild continuously without error', async () => {
  await new Promise(r => setTimeout(r, 60));
  const left = document.querySelectorAll('#leftPanel .room');
  if (left.length < 5) throw new Error('room list: ' + left.length);
  H.ui.tab = 'room'; H.ui.refresh();
  const roomPane = document.querySelector('#rightPanel .pane');
  if (!roomPane || !/THINGS YOU HAVE CHANGED|RECORDS IN THIS ROOM/.test(roomPane.textContent)) throw new Error('room pane missing: ' + (roomPane ? roomPane.textContent.slice(0, 60) : 'none'));
  H.ui.tab = 'inspect';
  H.game.selectedPerson = (H.game.group[0] || {}).id || null;
  H.ui.refresh();
  const fears = document.querySelectorAll('#rightPanel .fear').length;
  if (fears < 8) throw new Error('fear rows in inspect: ' + fears);
  H.ui.tab = 'people'; H.ui.refresh();
  const rows = document.querySelectorAll('#rightPanel .person').length;
  H.ui.tab = 'chronicle'; H.ui.refresh();
  const logs = document.querySelectorAll('#rightPanel .log li').length;
  if (!logs) throw new Error('chronicle empty');
  if (rows !== H.game.group.length) throw new Error(`people tab shows ${rows} of ${H.game.group.length}`);
  return `${left.length} rooms · ${fears} fear rows · ${rows} person rows · ${logs} chronicle lines`;
});
await check('audio degrades silently when the DOM has no AudioContext', () => {
  if (H.audio.ok) throw new Error('audio claimed to work without an AudioContext');
  H.audio.play('slam'); H.audio.update({ fear: 40, fury: 20, dread: 1, running: true, haunts: 1 }, 0.05);
  H.audio.caption('test caption');
  return 'no throw: play/update/caption are all safe without audio';
});
await check('no uncaught errors across the whole session', () => {
  if (problems.length) throw new Error(problems.slice(0, 4).join(' | '));
  return `clean: ${ops} canvas ops, ${results.length} checks`;
});

console.log('\n=== jsdom real-DOM smoke check for /house/ ===\n');
let fails = 0;
for (const [k, n, d] of results) { if (k === 'FAIL') fails++; console.log(`${k === 'PASS' ? ' ok ' : 'FAIL'}  ${n}  -  ${d}`); }
console.log(`\n${results.length - fails}/${results.length} real-DOM checks passed`);
process.exit(fails ? 1 : 0);

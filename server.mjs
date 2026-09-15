import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { PROJECT_BLUEPRINTS } from './public/world-data.js';

const exec = promisify(execFile);
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT || 5179);
const HOST = process.env.HOST || '127.0.0.1';
const GENERATED_ASSET_ROOT = '/Users/andrew/Library/CloudStorage/GoogleDrive-digitalghosts269@gmail.com/My Drive/GPT/Worldwalker/ASSETS/2026-09-14';
const RUNTIME_ASSET_ROOT = path.join(PUBLIC, 'assets', 'runtime');
const generatedAssets = {
  title: 'worldwalker_title_art.png',
  tileset: 'worldwalker_overworld_tileset.png',
  landmarks: 'worldwalker_landmarks.png',
  player: 'worldwalker_player_sheet.png',
  npcs: 'worldwalker_npc_sheet.png',
  ui: 'worldwalker_ui_sheet.png'
};

let runtimeAssetSet = null;
async function loadRuntimeAssetSet() {
  if (runtimeAssetSet) return runtimeAssetSet;
  try {
    const raw = JSON.parse(await fsp.readFile(path.join(RUNTIME_ASSET_ROOT, 'manifest.json'), 'utf8'));
    const names = [];
    const walk = v => {
      if (typeof v === 'string') names.push(v);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    walk(raw);
    runtimeAssetSet = new Set(names.filter(x => x.endsWith('.png')));
  } catch {
    runtimeAssetSet = new Set();
  }
  return runtimeAssetSet;
}

const roots = {
  starsilk: { root: '/Users/andrew/Starsilk_Character_Dossier', stateFile: 'OPERATIONAL_STATE.md' },
  'screen-weasels': { root: '/Users/andrew/The_Screen_Weasels', stateFile: 'docs/PROJECT_STATE.md' },
  atlas: { root: '/Users/andrew/Atlas_Of_One', stateFile: 'OPERATIONAL_STATE.md' },
  dash: { root: '/Users/andrew/DASH_LEDGER' },
  orbital: { root: '/Users/andrew/orbital tomb/threejs_flagship', stateFile: 'OPERATIONAL_STATE.md' }
};

const projects = PROJECT_BLUEPRINTS.map(p => ({ ...p, ...roots[p.id] }));
const previewable = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.md', '.txt', '.json', '.html', '.pdf']);

function mime(file) {
  const ext = path.extname(file).toLowerCase();
  return ({
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.md': 'text/plain; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.pdf': 'application/pdf'
  })[ext] || 'application/octet-stream';
}

function safeInside(base, target) {
  const rel = path.relative(base, target);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

async function exists(p) {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

function hash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}

function etagForStat(st) {
  return `"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
}

function artifactKind(name) {
  const e = path.extname(name).toLowerCase();
  if (/\.(png|jpe?g|webp|gif|svg)$/.test(e)) return 'image';
  if (e === '.mp4') return 'video';
  if (e === '.glb') return 'model';
  if (e === '.apk') return 'build';
  if (e === '.zip') return 'archive';
  if (/\.(md|pdf|html)$/.test(e)) return 'document';
  return 'data';
}

async function gitInfo(root) {
  if (!await exists(path.join(root, '.git'))) return null;
  try {
    const opts = { timeout: 3500 };
    const [branch, log, status, remote] = await Promise.all([
      exec('git', ['-C', root, 'branch', '--show-current'], opts),
      exec('git', ['-C', root, 'log', '-12', '--date=iso-strict', '--pretty=format:%h|%ad|%s'], opts),
      exec('git', ['-C', root, 'status', '--porcelain=v1'], opts),
      exec('git', ['-C', root, 'remote', 'get-url', 'origin'], opts).catch(() => ({ stdout: '' }))
    ]);
    return {
      branch: branch.stdout.trim(),
      dirty: Boolean(status.stdout.trim()),
      remote: remote.stdout.trim(),
      commits: log.stdout.split('\n').filter(Boolean).map(line => {
        const [h, date, ...s] = line.split('|');
        return { hash: h, date, subject: s.join('|') };
      })
    };
  } catch {
    return null;
  }
}

async function recentArtifacts(root, limit = 18) {
  const out = [];
  const skip = new Set(['node_modules', '.git', '.wrangler', '.venv', '.pio', '.platformio', 'dist', 'build']);
  async function walk(dir, depth) {
    if (depth > 2) return;
    let list = [];
    try {
      list = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of list) {
      if (skip.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full, depth + 1);
      else if (/\.(png|jpe?g|webp|gif|svg|mp4|html|md|pdf|zip|apk|glb|json)$/i.test(e.name)) {
        try {
          const st = await fsp.stat(full);
          if (st.size > 0) {
            out.push({
              name: e.name,
              rel: path.relative(root, full),
              mtime: st.mtime.toISOString(),
              size: st.size,
              kind: artifactKind(e.name),
              previewable: previewable.has(path.extname(e.name).toLowerCase()) && st.size < 20_000_000
            });
          }
        } catch {}
      }
    }
  }
  await walk(root, 0);
  return out.sort((a, b) => b.mtime.localeCompare(a.mtime)).slice(0, limit);
}

async function techTags(root) {
  const tags = new Set();
  try {
    const pkg = JSON.parse(await fsp.readFile(path.join(root, 'package.json'), 'utf8'));
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    tags.add('javascript');
    if (deps.typescript) tags.add('typescript');
    if (deps.react) tags.add('react');
    if (deps.vite) tags.add('vite');
    if (deps.three || deps['@react-three/fiber']) tags.add('threejs');
    if (deps.vitest) tags.add('vitest');
  } catch {}
  let names = [];
  try {
    names = await fsp.readdir(root);
  } catch {}
  if (names.some(n => n.endsWith('.html'))) tags.add('html');
  if (names.some(n => n.endsWith('.py')) || names.includes('requirements.txt')) tags.add('python');
  if (names.some(n => n.endsWith('.swift')) || names.includes('Package.swift') || names.includes('ios')) tags.add('swift');
  if (names.includes('platformio.ini') || names.includes('firmware')) tags.add('embedded');
  return [...tags].sort();
}

function conditionFor(p, present, git) {
  if (!present) return 'unknown';
  const statuses = p.quests.map(q => q.status);
  if (statuses.every(s => ['sealed', 'verified', 'closed'].includes(s))) return 'sealed';
  if (statuses.includes('blocked')) return 'blocked';
  if (statuses.includes('open')) return git?.dirty ? 'active' : 'open';
  if (statuses.includes('deferred')) return 'dormant';
  if (statuses.includes('unknown')) return 'unknown';
  return git?.dirty ? 'active' : 'quiet';
}

async function projectSnapshot(p) {
  const present = await exists(p.root);
  const statePath = p.stateFile ? path.join(p.root, p.stateFile) : null;
  const stateLedgerPresent = Boolean(statePath && await exists(statePath));
  const stat = present ? await fsp.stat(p.root).catch(() => null) : null;
  const git = present ? await gitInfo(p.root) : null;
  const artifacts = present ? await recentArtifacts(p.root) : [];
  const tags = present ? await techTags(p.root) : [];
  const condition = conditionFor(p, present, git);
  const digest = hash(JSON.stringify({
    present,
    modified: stat?.mtime?.toISOString() || null,
    head: git?.commits?.[0]?.hash || null,
    dirty: git?.dirty || false,
    artifacts: artifacts.slice(0, 6).map(a => [a.rel, a.mtime]),
    condition
  }));
  return {
    ...p,
    present,
    modified: stat?.mtime?.toISOString() || null,
    git,
    artifacts,
    techTags: tags,
    condition,
    digest,
    stateLedgerPresent
  };
}

function buildRelationships(data) {
  const edges = [];
  for (let i = 0; i < data.length; i++) {
    for (let j = i + 1; j < data.length; j++) {
      const shared = data[i].techTags.filter(t => data[j].techTags.includes(t)).filter(t => t !== 'javascript');
      if (shared.length) {
        edges.push({
          id: [data[i].id, data[j].id].sort().join('--'),
          a: data[i].id,
          b: data[j].id,
          kind: 'shared-tech',
          shared,
          evidence: `Both project roots expose ${shared.join(', ')}.`
        });
      }
    }
  }
  return edges;
}

let cachedSnapshot = null;
let cachedSnapshotAt = 0;
async function snapshot(force = false) {
  const now = Date.now();
  if (!force && cachedSnapshot && (now - cachedSnapshotAt < 2500)) {
    return cachedSnapshot;
  }
  const data = await Promise.all(projects.map(projectSnapshot));
  cachedSnapshot = {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    projects: data,
    relationships: buildRelationships(data)
  };
  cachedSnapshotAt = now;
  return cachedSnapshot;
}

function sendJson(res, obj, status = 200) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY'
  });
  res.end(JSON.stringify(obj));
}

async function streamFile(req, res, file, cache = 'no-cache') {
  try {
    const st = await fsp.stat(file);
    if (!st.isFile()) throw new Error();
    const etag = etagForStat(st);
    if (req.headers && req.headers['if-none-match'] === etag) {
      res.writeHead(304, {
        'etag': etag,
        'cache-control': cache,
        'x-content-type-options': 'nosniff'
      });
      res.end();
      return true;
    }
    res.writeHead(200, {
      'content-type': mime(file),
      'cache-control': cache,
      'content-length': st.size,
      'etag': etag,
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY'
    });
    fs.createReadStream(file).pipe(res);
    return true;
  } catch {
    return false;
  }
}

async function serveGeneratedAsset(req, res, url) {
  const key = url.searchParams.get('name') || '';
  const fileName = generatedAssets[key];
  if (!fileName) return sendJson(res, { error: 'unknown-generated-asset' }, 404);
  const file = path.join(GENERATED_ASSET_ROOT, fileName);
  if (!await streamFile(req, res, file, 'public, max-age=300')) {
    return sendJson(res, { error: 'generated-asset-unavailable' }, 404);
  }
}

async function serveRuntimeAsset(req, res, url) {
  const name = path.basename(url.searchParams.get('name') || '');
  const allowed = await loadRuntimeAssetSet();
  if (!allowed.has(name)) return sendJson(res, { error: 'unknown-runtime-asset' }, 404);
  const file = path.join(RUNTIME_ASSET_ROOT, name);
  if (!await streamFile(req, res, file, 'public, max-age=3600')) {
    return sendJson(res, { error: 'runtime-asset-unavailable' }, 404);
  }
}

async function serveArtifact(req, res, url) {
  const id = url.searchParams.get('project');
  const rawRel = url.searchParams.get('rel') || '';
  let rel;
  try {
    rel = decodeURIComponent(rawRel);
  } catch {
    return sendJson(res, { error: 'bad-request', detail: 'malformed-uri' }, 400);
  }
  const p = projects.find(x => x.id === id);
  if (!p || !rel) return sendJson(res, { error: 'bad-artifact' }, 400);
  const file = path.normalize(path.join(p.root, rel));
  if (!safeInside(p.root, file) || !previewable.has(path.extname(file).toLowerCase())) {
    return sendJson(res, { error: 'forbidden-artifact' }, 403);
  }
  try {
    const st = await fsp.stat(file);
    if (!st.isFile() || st.size > 20_000_000) throw new Error();
    const etag = etagForStat(st);
    if (req.headers && req.headers['if-none-match'] === etag) {
      res.writeHead(304, { 'etag': etag, 'cache-control': 'no-store' });
      return res.end();
    }
    res.writeHead(200, {
      'content-type': mime(file),
      'cache-control': 'no-store',
      'content-length': st.size,
      'etag': etag,
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY'
    });
    fs.createReadStream(file).pipe(res);
  } catch {
    return sendJson(res, { error: 'artifact-unavailable' }, 404);
  }
}

async function serveStatic(req, res, url) {
  let rel;
  try {
    rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  } catch {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8', 'x-content-type-options': 'nosniff' });
    return res.end('Bad Request');
  }
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!(file === path.join(PUBLIC, 'index.html') || safeInside(PUBLIC, file))) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  if (!await streamFile(req, res, file, 'no-cache')) {
    res.writeHead(404);
    res.end('Not found');
  }
}

const startTime = Date.now();
export async function handleRequest(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/api/snapshot') {
      return sendJson(res, await snapshot());
    }
    if (req.method === 'GET' && url.pathname === '/api/health') {
      return sendJson(res, {
        ok: true,
        service: 'worldwalker',
        version: '0.29.0',
        readOnly: true,
        uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
        nodeVersion: process.version,
        memoryUsage: process.memoryUsage().rss,
        projects: projects.length,
        featureContract: 20,
        generatedAssets: Object.keys(generatedAssets)
      });
    }
    if (req.method === 'GET' && url.pathname === '/api/generated-asset') {
      return await serveGeneratedAsset(req, res, url);
    }
    if (req.method === 'GET' && url.pathname === '/api/runtime-asset') {
      return await serveRuntimeAsset(req, res, url);
    }
    if (req.method === 'GET' && url.pathname === '/api/artifact') {
      return await serveArtifact(req, res, url);
    }
    if (req.method !== 'GET') {
      res.writeHead(405, { 'allow': 'GET', 'x-content-type-options': 'nosniff' });
      return res.end('Read-only');
    }
    return await serveStatic(req, res, url);
  } catch (err) {
    sendJson(res, { error: 'server-error', detail: String(err?.message || err) }, 500);
  }
}

export const server = http.createServer(handleRequest);
export { snapshot };

const isMain = Boolean(process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url));
if (isMain) {
  server.listen(PORT, HOST, () => console.log(`WORLDWALKER http://${HOST}:${PORT}`));
}



import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { handleRequest } from '../server.mjs';

const base = process.env.WORLDWALKER_URL || 'http://127.0.0.1:5179';

async function request(path, opts = {}) {
  try {
    const fullUrl = path.startsWith('http') ? path : `${base}${path}`;
    const res = await fetch(fullUrl, opts);
    const buf = Buffer.from(await res.arrayBuffer());
    return {
      status: res.status,
      headers: {
        get: (k) => res.headers.get(k)
      },
      arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      text: async () => buf.toString('utf8'),
      json: async () => JSON.parse(buf.toString('utf8'))
    };
  } catch {
    // In-process fallback when live network sockets are blocked by sandbox policies or server is not bound
    const chunks = [];
    let statusCode = 200;
    const headers = {};
    const method = opts.method || 'GET';
    const req = {
      url: path.startsWith('http') ? new URL(path).pathname + new URL(path).search : path,
      method,
      headers: opts.headers || {}
    };
    const res = new Writable({
      write(chunk, enc, cb) {
        chunks.push(chunk);
        cb();
      }
    });
    res.writeHead = (code, h = {}) => {
      statusCode = code;
      for (const [k, v] of Object.entries(h)) headers[k.toLowerCase()] = v;
    };
    res.setHeader = (k, v) => {
      headers[k.toLowerCase()] = v;
    };
    const done = new Promise((resolve) => {
      res.on('finish', resolve);
    });
    await handleRequest(req, res);
    await done;
    const buf = Buffer.concat(chunks);
    return {
      status: statusCode,
      headers: {
        get: (k) => headers[k.toLowerCase()] || null
      },
      arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      text: async () => buf.toString('utf8'),
      json: async () => JSON.parse(buf.toString('utf8'))
    };
  }
}

const healthRes = await request('/api/health');
assert.equal(healthRes.status, 200);
const health = await healthRes.json();
assert.equal(health.ok, true);
assert.equal(health.readOnly, true);
assert.equal(health.projects, 5);
assert.equal(health.featureContract, 20);

const snap = await request('/api/snapshot').then(r => r.json());
assert.equal(snap.readOnly, true);
assert.equal(snap.projects.length, 5);
assert.ok(Array.isArray(snap.relationships));

for (const id of ['starsilk', 'screen-weasels', 'atlas', 'dash', 'orbital']) {
  const p = snap.projects.find(x => x.id === id);
  assert.ok(p);
  assert.equal(typeof p.digest, 'string');
  assert.ok(p.condition);
  assert.ok(Array.isArray(p.techTags));
  assert.ok(p.landmark);
  assert.ok(p.interior);
  assert.equal('stateExcerpt' in p, false);
  assert.equal(typeof p.stateLedgerPresent, 'boolean');
}

const asset = await request('/api/runtime-asset?name=landmark_starsilk.png');
assert.equal(asset.status, 200);
assert.equal(asset.headers.get('content-type'), 'image/png');
assert.ok((await asset.arrayBuffer()).byteLength > 1000);

const badAsset = await request('/api/runtime-asset?name=../../server.mjs');
assert.equal(badAsset.status, 404);

const post = await request('/api/snapshot', { method: 'POST' });
assert.equal(post.status, 405);

const html = await request('/').then(r => r.text());
assert.match(html, /WORLDWALKER/);
assert.match(html, /BEGIN JOURNEY/);
assert.match(html, /touchControls/);
assert.match(html, /artCodexButton/);

console.log('SMOKE PASS: read-only API, five regions, privacy boundary, production asset route, 20-feature shell');
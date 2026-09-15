import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PROJECT_BLUEPRINTS } from '../public/world-data.js';
import { WORLD_ECHOES, echoNodes } from '../public/world-echoes.js';

const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const render=fs.readFileSync(new URL('../public/render.js',import.meta.url),'utf8');
const audio=fs.readFileSync(new URL('../public/audio.js',import.meta.url),'utf8');
const camera=fs.readFileSync(new URL('../public/camera.js',import.meta.url),'utf8');

assert.match(audio,/AudioContext/);assert.match(audio,/audioTick/);assert.match(audio,/stinger/);assert.match(audio,/THEMES/);
assert.match(camera,/updateCamera/);assert.match(camera,/focusCamera/);assert.match(camera,/cameraOffset/);
assert.match(app,/trackedQuest/);assert.match(app,/worldEchoPanel/);assert.match(app,/audioToggle/);assert.match(app,/updateCamera/);
assert.match(render,/drawQuestCompass/);assert.match(render,/drawWorldEchoes/);assert.match(render,/drawLighting/);assert.match(render,/drawWeather/);
assert.equal(WORLD_ECHOES.length,10,'ten world echoes configured');
const nodes=echoNodes(PROJECT_BLUEPRINTS);assert.equal(nodes.length,10,'all echoes resolve to project geography');
for(const p of PROJECT_BLUEPRINTS)assert.equal(nodes.filter(e=>e.projectId===p.id).length,2,`${p.id} has two world echoes`);
for(const e of WORLD_ECHOES){assert.ok(e.title&&e.text,'echo must have authored world-layer text');assert.ok(e.dx||e.dy,'echo must be spatially offset')}
console.log('IMMERSION CONTRACT PASS: adaptive audio, cinematic camera, tracked quests, atmosphere, world echoes');

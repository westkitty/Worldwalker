/* THE HOUSE THAT HUNTS BACK - procedural audio.  Everything is synthesised with WebAudio:
   no samples, no files, no external services.  Also drives the visual "sound caption"
   channel so nothing important exists only as audio. */

const A1 = 55, E2 = 82.4, G2 = 98, SH2 = 138.6, C3 = 130.8;

export function createAudio(opts = {}) {
  const engine = {
    ok: false, ctx: null, master: null, busFx: null, busMusic: null, busSfx: null,
    volume: opts.volume ?? 0.8, muted: !!opts.muted,
    started: false, nodes: {}, nextBeat: 0, beat: 0, lastStep: 0, lastHeart: 0,
    amb: { dread: 0, fear: 0, fury: 0 }, captions: [],
    resume() {
      if (!this.ctx) {
        const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
        if (!AC) return false;
        try {
          this.ctx = new AC();
        } catch { return false; }
        const c = this.ctx;
        this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : this.volume;
        const comp = c.createDynamicsCompressor();
        comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 5;
        this.master.connect(comp); comp.connect(c.destination);
        this.busSfx = c.createGain(); this.busSfx.gain.value = 0.95; this.busSfx.connect(this.master);
        this.busMusic = c.createGain(); this.busMusic.gain.value = 0.5; this.busMusic.connect(this.master);
        /* cheap reverb: a few feedback taps */
        const pre = c.createGain(); pre.gain.value = 1;
        const d1 = c.createDelay(1.2), d2 = c.createDelay(1.2), f1 = c.createBiquadFilter(), f2 = c.createBiquadFilter();
        const g1 = c.createGain(), g2 = c.createGain();
        f1.type = 'lowpass'; f1.frequency.value = 2600; f2.type = 'lowpass'; f2.frequency.value = 1400;
        d1.delayTime.value = 0.19; d2.delayTime.value = 0.37; g1.gain.value = 0.42; g2.gain.value = 0.3;
        pre.connect(d1); d1.connect(f1); f1.connect(g1); g1.connect(d2); g1.connect(this.busFxIn = c.createGain());
        d2.connect(f2); f2.connect(g2); g2.connect(d1); g2.connect(this.busFxIn);
        this.busFxIn.gain.value = 0.5; this.busFxIn.connect(this.master);
        this.busFx = pre;
        this.ok = true;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => { });
      if (!this.started) { this.startAmbience(); this.started = true; }
      return this.ok;
    },
    setVolume(v) { this.volume = Math.max(0, Math.min(1, v)); if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.05); return this.volume; },
    setMuted(b) { this.muted = !!b; if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.05); return this.muted; },

    /* ------------- generators ------------- */
    noiseBuffer(seconds = 1.2) {
      const c = this.ctx, len = Math.floor(c.sampleRate * seconds);
      const b = c.createBuffer(1, len, c.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len * 0.25);
      return b;
    },
    tone({ freq = 220, type = 'sine', dur = 0.4, gain = 0.2, attack = 0.008, dest = null, slide = 0, detune = 0, filter = null, q = 1, when = 0 }) {
      if (!this.ok) return;
      const c = this.ctx, t0 = c.currentTime + when;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t0); o.detune.value = detune;
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t0 + dur);
      let node = g;
      if (filter) { const f = c.createBiquadFilter(); f.type = filter; f.frequency.value = Math.max(40, freq * 1.4); f.Q.value = q; g.connect(f); node = f; }
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); node.connect(dest || this.busSfx);
      if (this.busFx) g.connect(this.busFx);
      o.start(t0); o.stop(t0 + dur + 0.06);
    },
    noise({ dur = 0.3, gain = 0.2, type = 'bandpass', freq = 900, q = 0.9, when = 0, sweep = 0, dest = null, attack = 0.004 }) {
      if (!this.ok) return;
      const c = this.ctx, t0 = c.currentTime + when;
      const src = c.createBufferSource(); src.buffer = this.noiseBuffer(Math.max(0.3, dur + 0.1));
      const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
      if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * sweep), t0 + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f); f.connect(g); g.connect(dest || this.busSfx);
      if (this.busFx) g.connect(this.busFx);
      src.start(t0); src.stop(t0 + dur + 0.1);
    },

    /* ------------- ambience ------------- */
    startAmbience() {
      if (!this.ok) return;
      const c = this.ctx;
      /* drone stack */
      const drone = c.createGain(); drone.gain.value = 0.1;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; lp.Q.value = 1.4;
      drone.connect(lp); lp.connect(this.busMusic);
      [A1, A1 * 1.005, E2 * 0.5, A1 * 1.5].forEach((f, i) => {
        const o = c.createOscillator(); o.type = i % 2 ? 'sawtooth' : 'triangle'; o.frequency.value = f;
        const g = c.createGain(); g.gain.value = i === 3 ? 0.22 : 0.42;
        o.connect(g); g.connect(drone); o.start();
        const lfo = c.createOscillator(); lfo.frequency.value = 0.03 + i * 0.017;
        const la = c.createGain(); la.gain.value = f * 0.004;
        lfo.connect(la); la.connect(o.frequency); lfo.start();
      });
      /* air / room tone */
      const air = c.createBufferSource(); air.buffer = this.noiseBuffer(2.6); air.loop = true;
      const af = c.createBiquadFilter(); af.type = 'bandpass'; af.frequency.value = 420; af.Q.value = 0.6;
      const ag = c.createGain(); ag.gain.value = 0.05;
      air.connect(af); af.connect(ag); ag.connect(this.busMusic); air.start();
      /* dread shimmer, gated by the state of the house */
      const shim = c.createOscillator(); shim.type = 'sine'; shim.frequency.value = SH2 * 4;
      const sg = c.createGain(); sg.gain.value = 0;
      const sb = c.createBiquadFilter(); sb.type = 'bandpass'; sb.frequency.value = 1900; sb.Q.value = 8;
      shim.connect(sb); sb.connect(sg); sg.connect(this.busMusic); sg.connect(this.busFx || this.busMusic); shim.start();
      this.nodes = { drone, lp, ag, af, sg, shim };
      this.nextBeat = c.currentTime + 1.2;
    },
    setRoomTone(room) {
      if (!this.ok || !this.nodes.ag) return;
      const c = this.ctx;
      const map = {
        cellar: [180, 0.08], bathroom: [700, 0.055], kitchen: [520, 0.06], nursery: [880, 0.038], attic: [1200, 0.03], hall: [420, 0.05]
      };
      const key = room?.tags?.includes('confined') || room?.floor === -1 ? 'cellar' : room?.tags?.includes('water') ? 'bathroom' : room?.tags?.includes('heat') ? 'kitchen' : room?.tags?.includes('dolls') ? 'nursery' : room?.floor === 2 ? 'attic' : 'hall';
      const [f, g] = map[key] || map.hall;
      this.nodes.af.frequency.setTargetAtTime(f, c.currentTime, 0.5);
      this.nodes.ag.gain.setTargetAtTime(g, c.currentTime, 0.5);
      this.nodes.lp.frequency.setTargetAtTime(key === 'cellar' ? 170 : key === 'attic' ? 340 : 260, c.currentTime, 0.6);
    },

    /* ------------- one-shots, one per meaningful event ------------- */
    play(name, p = {}) {
      if (!this.ok || this.muted) return;
      const pan = p.pan ?? 0, when = p.when || 0;
      const duck = clampPan(pan);
      const g = 1 - Math.abs(duck) * 0.4;
      switch (name) {
        case 'step': this.noise({ dur: 0.075, gain: 0.055 * g, freq: 220 + Math.random() * 90, q: 1.6, sweep: 0.6, when }); break;
        case 'creak': {
          const f = 120 + Math.random() * 90;
          this.tone({ freq: f, type: 'sawtooth', dur: 0.5 + Math.random() * 0.3, gain: 0.07 * g, slide: 0.62, filter: 'bandpass', q: 7, when });
          this.noise({ dur: 0.36, gain: 0.03 * g, freq: f * 5, type: 'highpass', when });
          break;
        }
        case 'slam':
          this.noise({ dur: 0.3, gain: 0.42 * g, freq: 340, sweep: 0.25, q: 0.9, when });
          this.tone({ freq: 88, type: 'sine', dur: 0.42, gain: 0.34 * g, slide: 0.42, when });
          this.tone({ freq: 190, type: 'square', dur: 0.16, gain: 0.1 * g, slide: 0.5, when });
          break;
        case 'door_close': this.tone({ freq: 150, type: 'triangle', dur: 0.22, gain: 0.1 * g, slide: 0.6, when }); this.noise({ dur: 0.1, gain: 0.05 * g, freq: 700, when }); break;
        case 'lock': this.noise({ dur: 0.11, gain: 0.2 * g, freq: 1700, q: 4, type: 'bandpass', when }); this.tone({ freq: 520, type: 'square', dur: 0.07, gain: 0.06 * g, when: when + 0.06 }); break;
        case 'whisper': {
          for (let i = 0; i < 4; i++) this.noise({ dur: 0.2 + Math.random() * 0.2, gain: 0.09 * g, freq: 900 + Math.random() * 1400, q: 9 + Math.random() * 8, type: 'bandpass', when: when + i * 0.14, sweep: 0.5 });
          break;
        }
        case 'glass': for (let i = 0; i < 6; i++) this.tone({ freq: 1600 + Math.random() * 3200, type: 'triangle', dur: 0.12 + Math.random() * 0.2, gain: 0.05 * g, when: when + i * 0.03 }); this.noise({ dur: 0.3, gain: 0.12 * g, freq: 4200, type: 'highpass', when }); break;
        case 'cold': this.noise({ dur: 1.1, gain: 0.075 * g, freq: 2100, type: 'bandpass', q: 3, sweep: 0.4, when }); this.tone({ freq: SH2 * 6, type: 'sine', dur: 1.1, gain: 0.03 * g, slide: 0.8, when }); break;
        case 'apparition':
          this.tone({ freq: 62, type: 'sawtooth', dur: 1.5, gain: 0.2 * g, slide: 2.2, filter: 'lowpass', q: 4, when });
          this.tone({ freq: C3 * 4, type: 'sine', dur: 1.2, gain: 0.08 * g, slide: 0.5, when: when + 0.15 });
          this.noise({ dur: 1.3, gain: 0.1 * g, freq: 300, type: 'lowpass', sweep: 4, when });
          break;
        case 'collapse':
          this.noise({ dur: 1.4, gain: 0.42 * g, freq: 220, type: 'lowpass', sweep: 0.35, when });
          this.tone({ freq: 46, type: 'square', dur: 1.1, gain: 0.26 * g, slide: 0.6, when });
          break;
        case 'scream': {
          const f = 300 + Math.random() * 160;
          this.tone({ freq: f, type: 'sawtooth', dur: 0.5, gain: 0.16 * g, slide: 0.62, filter: 'bandpass', q: 3, when });
          this.noise({ dur: 0.4, gain: 0.1 * g, freq: 1300, type: 'bandpass', q: 2, when });
          break;
        }
        case 'voice': this.tone({ freq: 168, type: 'sawtooth', dur: 0.6, gain: 0.07 * g, slide: 0.8, filter: 'bandpass', q: 6, when }); break;
        case 'warp':
          for (let i = 0; i < 3; i++) this.tone({ freq: 220 + i * 90, type: 'sine', dur: 0.9, gain: 0.06 * g, slide: 0.4 + i * 0.3, when: when + i * 0.06 });
          this.noise({ dur: 0.8, gain: 0.05 * g, freq: 640, type: 'bandpass', q: 5, sweep: 3, when });
          break;
        case 'seal': this.noise({ dur: 0.7, gain: 0.16 * g, freq: 420, type: 'lowpass', sweep: 0.3, when }); this.tone({ freq: 96, type: 'triangle', dur: 0.6, gain: 0.12 * g, slide: 0.5, when }); break;
        case 'flash': this.noise({ dur: 0.09, gain: 0.12 * g, freq: 5200, type: 'highpass', when }); break;
        case 'device': this.noise({ dur: 0.05, gain: 0.05 * g, freq: 2600, type: 'highpass', when }); break;
        case 'emf': for (let i = 0; i < 3; i++) this.tone({ freq: 1250, type: 'square', dur: 0.05, gain: 0.05 * g, when: when + i * 0.09 }); break;
        case 'ritual': this.tone({ freq: E2, type: 'sine', dur: 2.2, gain: 0.09 * g, slide: 1.06, when }); this.tone({ freq: E2 * 1.5, type: 'sine', dur: 2.2, gain: 0.05 * g, when: when + 0.1 }); break;
        case 'devour': this.noise({ dur: 0.6, gain: 0.13 * g, freq: 1400, type: 'bandpass', q: 1.4, sweep: 0.15, when }); this.tone({ freq: 240, type: 'triangle', dur: 0.5, gain: 0.05 * g, slide: 0.3, when }); break;
        case 'ui': this.tone({ freq: 420, type: 'sine', dur: 0.07, gain: 0.05 * g, when }); break;
        case 'ui_big': this.tone({ freq: 180, type: 'triangle', dur: 0.2, gain: 0.11 * g, slide: 1.6, when }); break;
        case 'deny': this.tone({ freq: 130, type: 'square', dur: 0.16, gain: 0.09 * g, slide: 0.7, when }); break;
        case 'bell': this.tone({ freq: G2 * 2, type: 'sine', dur: 2.6, gain: 0.16 * g, when }); this.tone({ freq: G2 * 3.01, type: 'sine', dur: 2.1, gain: 0.08 * g, when: when + 0.05 }); this.tone({ freq: G2 * 4.98, type: 'sine', dur: 1.4, gain: 0.04 * g, when: when + 0.1 }); break;
        case 'win': [C3, E2 * 2, G2 * 2, C3 * 2].forEach((f, i) => this.tone({ freq: f, type: 'triangle', dur: 1.2, gain: 0.09 * g, when: when + i * 0.16 })); break;
        case 'lose': [G2, SH2, E2].forEach((f, i) => this.tone({ freq: f, type: 'sawtooth', dur: 1.6, gain: 0.075 * g, filter: 'lowpass', q: 3, when: when + i * 0.22, slide: 0.72 })); break;
        case 'heart': this.tone({ freq: 52, type: 'sine', dur: 0.16, gain: 0.2 * g, slide: 0.6, when }); this.tone({ freq: 46, type: 'sine', dur: 0.14, gain: 0.14 * g, slide: 0.6, when: when + 0.21 }); break;
        case 'sting': this.tone({ freq: SH2 * 4, type: 'sawtooth', dur: 0.5, gain: 0.1 * g, filter: 'bandpass', q: 9, slide: 0.5, when }); break;
        default: break;
      }
    },

    /* ------------- adaptive tension score ------------- */
    update(state, dt) {
      if (!this.ok) return;
      const c = this.ctx;
      const fear = clamp01(state.fear / 100), fury = clamp01(state.fury / 100), dread = clamp01(state.dread / 2.2);
      this.amb.fear = lerp(this.amb.fear, fear, 0.05);
      this.amb.fury = lerp(this.amb.fury, fury, 0.05);
      this.amb.dread = lerp(this.amb.dread, dread, 0.05);
      if (this.nodes.sg) this.nodes.sg.gain.setTargetAtTime(0.0001 + this.amb.fear * 0.045 + this.amb.dread * 0.02, c.currentTime, 0.6);
      if (this.nodes.drone) this.nodes.drone.gain.setTargetAtTime(0.085 + this.amb.fury * 0.05 + this.amb.fear * 0.03, c.currentTime, 0.8);
      if (this.nodes.shim) this.nodes.shim.frequency.setTargetAtTime(SH2 * (3.6 + this.amb.fear * 1.9), c.currentTime, 1.1);
      /* heartbeat + pulse: only while the night is running */
      const bpm = 44 + fear * 66 + fury * 22;
      const gap = 60 / bpm;
      if (state.running && c.currentTime > this.lastHeart + gap) {
        this.lastHeart = c.currentTime;
        const inten = clamp01(fear * 0.8 + dread * 0.3);
        this.tone({ freq: 50 + inten * 8, type: 'sine', dur: 0.15, gain: 0.02 + inten * 0.09, slide: 0.6 });
        this.tone({ freq: 44, type: 'sine', dur: 0.13, gain: 0.015 + inten * 0.06, slide: 0.6, when: 0.2 });
      }
      /* score: sparse low notes, dissonance as the night gets away from them */
      if (state.running && c.currentTime > this.nextBeat) {
        this.nextBeat = c.currentTime + (2.4 - fear * 1.1);
        const scale = [A1, E2, G2, A1 * 1.189, A1 * 1.498];
        const root = scale[(this.beat * (1 + (fury > 0.6 ? 1 : 0))) % scale.length];
        this.beat++;
        this.tone({ freq: root, type: 'triangle', dur: 2.2, gain: 0.035 + fear * 0.05, dest: this.busMusic, when: 0 });
        if (fear > 0.45) this.tone({ freq: root * (fear > 0.75 ? 1.414 : 1.2), type: 'sine', dur: 1.8, gain: 0.018 + fear * 0.03, dest: this.busMusic, when: 0.4 });
        if (state.haunts > this._lastHaunts) {
          this._lastHaunts = state.haunts;
          this.tone({ freq: A1 * 4, type: 'sawtooth', dur: 0.5, gain: 0.03, filter: 'lowpass', q: 6, dest: this.busMusic, slide: 0.5 });
        }
      }
    },
    caption(text, kind = 'sound') {
      this.captions.push({ text, kind, t: performance.now() });
      if (this.captions.length > 6) this.captions.shift();
    },
    takeCaptions(maxAge = 2600) {
      const now = performance.now();
      this.captions = this.captions.filter(c => now - c.t < maxAge);
      return this.captions;
    },
    stop() {
      if (!this.ok) return;
      try { this.ctx.close(); } catch { }
      this.ok = false; this.ctx = null; this.started = false; this.nodes = {};
    }
  };
  const clampPan = v => Math.max(-1, Math.min(1, v));
  const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  return engine;
}
export const AUDIO_NAMES = ['step', 'creak', 'slam', 'door_close', 'lock', 'whisper', 'glass', 'cold', 'apparition', 'collapse', 'scream', 'voice', 'warp', 'seal', 'flash', 'device', 'emf', 'ritual', 'devour', 'ui', 'ui_big', 'deny', 'bell', 'win', 'lose', 'heart', 'sting'];

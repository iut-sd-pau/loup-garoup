/* ============================================================
   SFX.JS
   Ambiance sonore et bruitages 100% generes en direct via
   Web Audio API (oscillateurs + bruit blanc). Aucun fichier
   audio a heberger, aucun droit d'auteur, ca marche offline.
   ============================================================ */

const SFX = {
  ctx: null,
  enabled: true,
  master: null,
  ambientNodes: null,

  init() {
    const saved = localStorage.getItem('lg_sfx_enabled');
    this.enabled = saved === null ? true : saved === '1';
    const vol = localStorage.getItem('lg_sfx_volume');
    this.volume = vol === null ? 0.35 : parseFloat(vol);
  },

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    localStorage.setItem('lg_sfx_volume', String(this.volume));
    if (this.master) this.master.gain.value = this.volume;
  },

  _ensureCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume === undefined ? 0.35 : this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('lg_sfx_enabled', this.enabled ? '1' : '0');
    if (!this.enabled) {
      this.stopAmbient();
      if (typeof MusicEngine !== 'undefined') MusicEngine.stop();
    } else if (typeof MusicEngine !== 'undefined' && MusicEngine.themeKey) {
      MusicEngine.start(MusicEngine.themeKey);
    }
    return this.enabled;
  },

  _tone(freq, duration, type, startGain, delay) {
    type = type || 'sine'; startGain = startGain === undefined ? 0.4 : startGain; delay = delay || 0;
    if (!this.enabled) return;
    const ctx = this._ensureCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const t0 = ctx.currentTime + delay;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(startGain, t0 + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  },

  _noise(duration, startGain, delay, filterFreq) {
    startGain = startGain === undefined ? 0.3 : startGain; delay = delay || 0; filterFreq = filterFreq || 1200;
    if (!this.enabled) return;
    const ctx = this._ensureCtx();
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    const t0 = ctx.currentTime + delay;
    gain.gain.setValueAtTime(startGain, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t0);
  },

  click() { this._tone(700, 0.08, 'triangle', 0.2); },

  whoosh() { this._noise(0.5, 0.25, 0, 2200); },

  wolfHowl() {
    if (!this.enabled) return;
    const ctx = this._ensureCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    const t0 = ctx.currentTime;
    osc.frequency.setValueAtTime(180, t0);
    osc.frequency.linearRampToValueAtTime(520, t0 + 0.5);
    osc.frequency.linearRampToValueAtTime(340, t0 + 1.4);
    osc.frequency.linearRampToValueAtTime(120, t0 + 2.1);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.28, t0 + 0.3);
    gain.gain.linearRampToValueAtTime(0.18, t0 + 1.5);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 2.2);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 1800;
    osc.connect(filter).connect(gain).connect(this.master);
    osc.start(t0); osc.stop(t0 + 2.3);
  },

  heartbeat() {
    this._tone(60, 0.18, 'sine', 0.5, 0);
    this._tone(55, 0.22, 'sine', 0.4, 0.25);
  },

  bellToll() {
    this._tone(220, 1.6, 'sine', 0.3);
    this._tone(330, 1.6, 'sine', 0.15, 0.02);
  },

  magicSparkle() {
    [0, 0.08, 0.16, 0.24].forEach((d, i) => this._tone(880 + i * 220, 0.35, 'sine', 0.18, d));
  },

  poisonDrip() {
    this._tone(300, 0.3, 'square', 0.15);
    this._tone(150, 0.4, 'square', 0.12, 0.15);
  },

  drumroll() {
    if (!this.enabled) return;
    for (let i = 0; i < 10; i++) this._noise(0.09, 0.18, i * 0.09, 3000);
  },

  gavel() { this._noise(0.12, 0.4, 0, 800); this._tone(120, 0.2, 'square', 0.3, 0.02); },

  victoryFanfare(team) {
    if (!this.enabled) return;
    const notes = team === 'wolves' ? [220, 261, 220, 174, 261, 329] : [392, 494, 587, 784];
    notes.forEach((f, i) => this._tone(f, 0.4, 'triangle', 0.3, i * 0.18));
  },

  death() {
    if (!this.enabled) return;
    const ctx = this._ensureCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    const t0 = ctx.currentTime;
    osc.frequency.setValueAtTime(400, t0);
    osc.frequency.exponentialRampToValueAtTime(60, t0 + 0.9);
    gain.gain.setValueAtTime(0.3, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.9);
    osc.connect(gain).connect(this.master);
    osc.start(t0); osc.stop(t0 + 1);
  },

  startAmbient(mode) {
    this.stopAmbient();
    if (!this.enabled) return;
    const ctx = this._ensureCtx();
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.type = 'sine'; osc2.type = 'sine';
    if (mode === 'night') { osc1.frequency.value = 55; osc2.frequency.value = 82.5; gain.gain.value = 0.05; }
    else { osc1.frequency.value = 130; osc2.frequency.value = 164; gain.gain.value = 0.025; }
    osc1.connect(gain); osc2.connect(gain); gain.connect(this.master);
    osc1.start(); osc2.start();
    this.ambientNodes = { osc1: osc1, osc2: osc2, gain: gain };
  },

  stopAmbient() {
    if (this.ambientNodes) {
      try {
        this.ambientNodes.gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
        this.ambientNodes.osc1.stop(this.ctx.currentTime + 0.5);
        this.ambientNodes.osc2.stop(this.ctx.currentTime + 0.5);
      } catch (e) {}
      this.ambientNodes = null;
    }
  }
};

document.addEventListener('DOMContentLoaded', () => SFX.init());

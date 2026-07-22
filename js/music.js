/* ============================================================
   MUSIC.JS
   Vraie musique d'ambiance generative (accords + arpege), pas
   juste un bourdonnement. 100% synthetise en direct via Web
   Audio API (aucun fichier audio, aucun droit d'auteur), avec
   un theme different pour le menu, la nuit et le jour.
   Utilise le meme contexte audio et le meme volume que SFX.
   ============================================================ */

const THEMES = {
  // Village mysterieux, en attendant que la partie commence
  menu:  { chords: [[220,261.63,329.63],[174.61,220,261.63],[130.81,164.81,196.00],[196.00,246.94,293.66]], chordDuration: 6.5, arp: [220,261.63,329.63,392.00,440], arpInterval: 1.6, filterFreq: 850, chordGain: 0.05, arpGain: 0.045 },
  // Plus sombre et tendu, tempo plus lent
  night: { chords: [[220,261.63,329.63],[174.61,220,261.63],[130.81,164.81,196.00],[196.00,246.94,293.66]], chordDuration: 8,   arp: [220,261.63,329.63,440],         arpInterval: 2.4, filterFreq: 550, chordGain: 0.055, arpGain: 0.035 },
  // Plus clair et un peu plus enleve pour le debat du village
  day:   { chords: [[261.63,329.63,392.00],[196.00,246.94,293.66],[220,261.63,329.63],[174.61,220,261.63]], chordDuration: 5,  arp: [261.63,329.63,392.00,440,523.25], arpInterval: 1.1, filterFreq: 1500, chordGain: 0.045, arpGain: 0.05 }
};

const MusicEngine = {
  themeKey: null,
  theme: null,
  filter: null,
  gain: null,
  timerID: null,
  nextChordTime: 0,
  nextArpTime: 0,
  chordIndex: 0,
  arpIndex: 0,
  lookahead: 0.25,

  _ensureNodes() {
    const ctx = SFX._ensureCtx();
    if (!this.gain) {
      this.gain = ctx.createGain();
      this.gain.gain.value = 1;
      this.filter = ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 900;
      this.gain.connect(this.filter);
      this.filter.connect(SFX.master);
    }
    return ctx;
  },

  start(themeKey) {
    if (!SFX.enabled) return;
    const ctx = this._ensureNodes();
    this.themeKey = themeKey;
    this.theme = THEMES[themeKey] || THEMES.menu;
    this.filter.frequency.cancelScheduledValues(ctx.currentTime);
    this.filter.frequency.linearRampToValueAtTime(this.theme.filterFreq, ctx.currentTime + 2);

    if (this.timerID) return; // deja en cours, on vient juste de changer de theme en douceur
    this.nextChordTime = ctx.currentTime + 0.1;
    this.nextArpTime = ctx.currentTime + 0.1;
    this.chordIndex = 0;
    this.arpIndex = 0;
    this.timerID = setInterval(() => this._scheduler(), 120);
  },

  switchTheme(themeKey) {
    if (!this.timerID) { this.start(themeKey); return; }
    this.themeKey = themeKey;
    this.theme = THEMES[themeKey] || THEMES.menu;
    const ctx = this._ensureNodes();
    this.filter.frequency.cancelScheduledValues(ctx.currentTime);
    this.filter.frequency.linearRampToValueAtTime(this.theme.filterFreq, ctx.currentTime + 2.5);
  },

  stop() {
    if (this.timerID) { clearInterval(this.timerID); this.timerID = null; }
  },

  _scheduler() {
    if (!SFX.enabled) return;
    const ctx = SFX.ctx;
    if (!ctx) return;
    const horizon = ctx.currentTime + this.lookahead;

    while (this.nextChordTime < horizon) {
      this._playChord(this.theme.chords[this.chordIndex % this.theme.chords.length], this.nextChordTime, this.theme.chordDuration, this.theme.chordGain);
      this.chordIndex++;
      this.nextChordTime += this.theme.chordDuration;
    }
    while (this.nextArpTime < horizon) {
      const notes = this.theme.arp;
      // Petite promenade quasi-aleatoire dans la gamme plutot qu'une boucle previsible
      this.arpIndex = (this.arpIndex + (Math.random() < 0.5 ? 1 : 2)) % notes.length;
      if (Math.random() < 0.8) this._playArpNote(notes[this.arpIndex], this.nextArpTime, this.theme.arpGain);
      this.nextArpTime += this.theme.arpInterval;
    }
  },

  _playChord(freqs, time, duration, peakGain) {
    const ctx = SFX.ctx;
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      osc.detune.value = (i - 1) * 4;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(peakGain, time + duration * 0.35);
      g.gain.linearRampToValueAtTime(peakGain * 0.7, time + duration * 0.7);
      g.gain.linearRampToValueAtTime(0.0001, time + duration);
      osc.connect(g).connect(this.gain);
      osc.start(time);
      osc.stop(time + duration + 0.1);
    });
  },

  _playArpNote(freq, time, peakGain) {
    const ctx = SFX.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    const dur = 1.8;
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(peakGain, time + 0.15);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(g).connect(this.gain);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  }
};

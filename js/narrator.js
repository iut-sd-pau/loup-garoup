/* ============================================================
   NARRATOR.JS
   Le Conteur : lit a voix haute les evenements du jeu grace
   a la synthese vocale native du navigateur (Web Speech API).
   Aucun fichier audio externe : ca marche partout, gratuitement,
   sans droits d'auteur.
   ============================================================ */

const Narrator = {
  enabled: true,
  voice: null,
  queue: [],
  speaking: false,

  init() {
    const saved = localStorage.getItem('lg_narrator_enabled');
    this.enabled = saved === null ? true : saved === '1';
    if ('speechSynthesis' in window) {
      const pick = () => { this.voice = this._pickBestVoice(window.speechSynthesis.getVoices()); };
      pick();
      window.speechSynthesis.onvoiceschanged = pick;
    }
  },

  // Choisit la meilleure voix francaise disponible. Les voix "en ligne"
  // (Google, Microsoft Natural/Neural) sonnent nettement mieux que les
  // voix locales basiques presentes par defaut sur beaucoup de systemes,
  // donc on les priorise quand elles existent.
  _pickBestVoice(voices) {
    const fr = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith('fr'));
    if (fr.length === 0) return voices[0] || null;

    const score = (v) => {
      let s = 0;
      const name = (v.name || '').toLowerCase();
      if (!v.localService) s += 5; // voix "cloud" generalement bien plus naturelles
      if (/natural|neural|wavenet|premium|enhanced/.test(name)) s += 6;
      if (/google/.test(name)) s += 3;
      if (v.lang.toLowerCase() === 'fr-fr') s += 2;
      return s;
    };
    return fr.sort((a, b) => score(b) - score(a))[0];
  },

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('lg_narrator_enabled', this.enabled ? '1' : '0');
    if (!this.enabled && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    return this.enabled;
  },

  say(text, { interrupt = false } = {}) {
    if (!this.enabled || !('speechSynthesis' in window) || !text) return;
    if (interrupt) { window.speechSynthesis.cancel(); this.queue = []; }
    this.queue.push(text);
    this._pump();
  },

  _pump() {
    if (this.speaking || this.queue.length === 0) return;
    const text = this.queue.shift();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'fr-FR';
    if (this.voice) utter.voice = this.voice;
    // Pitch et debit proches du naturel : un pitch trop bas (ancienne valeur 0.85)
    // rend la plupart des voix systeme robotiques et desagreables.
    utter.rate = 1.0;
    utter.pitch = 1.0;
    utter.onend = () => { this.speaking = false; this._pump(); };
    utter.onerror = () => { this.speaking = false; this._pump(); };
    this.speaking = true;
    window.speechSynthesis.speak(utter);
  }
};

document.addEventListener('DOMContentLoaded', () => Narrator.init());

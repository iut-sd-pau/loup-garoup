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
      const pick = () => {
        const voices = window.speechSynthesis.getVoices();
        this.voice =
          voices.find(v => v.lang && v.lang.startsWith('fr') && /male|homme|thomas|paul|nicolas/i.test(v.name)) ||
          voices.find(v => v.lang && v.lang.startsWith('fr')) ||
          voices[0] || null;
      };
      pick();
      window.speechSynthesis.onvoiceschanged = pick;
    }
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
    utter.rate = 0.98;
    utter.pitch = 0.85;
    utter.onend = () => { this.speaking = false; this._pump(); };
    utter.onerror = () => { this.speaking = false; this._pump(); };
    this.speaking = true;
    window.speechSynthesis.speak(utter);
  }
};

document.addEventListener('DOMContentLoaded', () => Narrator.init());

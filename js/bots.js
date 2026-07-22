/* ============================================================
   BOTS.JS
   Controleur des joueurs-robots (IA simple, heuristique).
   Execute UNIQUEMENT par le client hote, en parallele du
   HostEngine : les bots agissent en ecrivant dans Firebase
   exactement comme le ferait un joueur humain (memes chemins),
   donc le reste du moteur de jeu n'a rien a savoir de leur
   existence.
   ============================================================ */

const CHAT_LINES = [
  "Franchement je soupçonne {name}...",
  "Moi je fais confiance à {name} pour l'instant.",
  "On devrait surveiller les votes de {name}.",
  "{name} est bizarrement silencieux(se), non ?",
  "Je pense qu'on part sur une mauvaise piste.",
  "Qui a des arguments concrets contre {name} ?",
  "Perso je m'abstiens de juger trop vite.",
  "{name}, tu en penses quoi toi ?",
  "On a déjà perdu trop de monde, faut être malins.",
  "Je change d'avis, je pense que c'est {name}.",
  "Rien de louche de mon côté, promis !",
  "Il nous reste peu de temps, faut se décider.",
];

const BotController = {
  roomCode: null,
  ref: null,
  scheduled: new Set(),
  chatRoundsHandled: new Set(),

  start(roomCode) {
    this.roomCode = roomCode;
    this.ref = db.ref(`rooms/${roomCode}`);
    this.ref.on('value', snap => this.onChange(snap.val()));
  },
  stop() {
    if (this.ref) this.ref.off('value');
    this.scheduled.clear();
    this.chatRoundsHandled.clear();
  },

  onChange(room) {
    if (!room || room.status === 'ended' || room.status === 'lobby') return;
    const bots = Object.entries(room.players || {}).filter(([id, p]) => p.isBot && p.alive);
    if (bots.length === 0) return;

    if (room.status === 'mayor-election') this.handleMayorElection(room, bots);
    else if (room.status === 'night') this.handleNight(room, bots);
    else if (room.status === 'day-vote') this.handleDayVote(room, bots);
    else if (room.status === 'hunter') this.handleHunter(room, bots);
    else if (room.status === 'mayor-succession') this.handleMayorSuccession(room, bots);
    else if (room.status === 'day-discuss') this.handleChat(room, bots);
  },

  once(key, fn, minDelay, maxDelay) {
    if (this.scheduled.has(key)) return;
    this.scheduled.add(key);
    setTimeout(fn, (minDelay || 1500) + Math.random() * ((maxDelay || 6000) - (minDelay || 1500)));
  },

  randomFrom(arr) { return arr.length ? arr[Math.floor(Math.random() * arr.length)] : null; },

  otherAliveIds(room, excludeId) {
    return Object.entries(room.players || {}).filter(([id, p]) => p.alive && id !== excludeId).map(([id]) => id);
  },

  // ============ ELECTION DU MAIRE ============
  handleMayorElection(room, bots) {
    bots.forEach(([id]) => {
      const key = `mayor-${id}`;
      if (room.mayorVotes && room.mayorVotes[id]) return;
      this.once(key, async () => {
        const fresh = (await this.ref.once('value')).val();
        if (!fresh || fresh.status !== 'mayor-election') return;
        if (fresh.mayorVotes && fresh.mayorVotes[id]) return;
        const target = this.randomFrom(this.otherAliveIds(fresh, null));
        if (target) await this.ref.child(`mayorVotes/${id}`).set(target);
      });
    });
  },

  // ============ NUIT ============
  handleNight(room, bots) {
    const night = room.night || {};
    const step = (night.steps || [])[night.stepIndex || 0];
    if (!step) return;

    bots.forEach(([id, p]) => {
      const key = `night-${room.round}-${step}-${id}`;

      if (step === 'voleur' && p.role === 'voleur') {
        if (night.voleurDone) return;
        this.once(key, async () => {
          await this.ref.child('night').update({ voleurDone: true }); // les bots ne trichent jamais
        });
      } else if (step === 'cupidon' && p.role === 'cupidon') {
        if (night.cupidLovers) return;
        this.once(key, async () => {
          const fresh = (await this.ref.once('value')).val();
          if (fresh.night.cupidLovers) return;
          const all = Object.keys(fresh.players).filter(pid => fresh.players[pid].alive);
          const shuffled = all.sort(() => Math.random() - 0.5);
          const pair = shuffled.slice(0, 2);
          if (pair.length === 2) {
            await this.ref.child('night/cupidLovers').set(pair);
            await this.ref.child('lovers').set(pair);
          }
        });
      } else if (step === 'wolves' && isWolf(p.role)) {
        if (night.wolfVotes && night.wolfVotes[id]) return;
        this.once(key, async () => {
          const fresh = (await this.ref.once('value')).val();
          if (fresh.night.wolfVotes && fresh.night.wolfVotes[id]) return;
          // Les loups doivent choisir UNE SEULE victime ensemble : si un autre
          // loup (bot ou humain) a deja vote, le bot se rallie a ce choix
          // pour converger vers le consensus plutot que de voter au hasard.
          const existingVotes = Object.values(fresh.night.wolfVotes || {});
          let target;
          if (existingVotes.length) {
            target = existingVotes[0];
          } else {
            const targets = Object.entries(fresh.players).filter(([pid, pp]) => pp.alive && !isWolf(pp.role)).map(([pid]) => pid);
            target = this.randomFrom(targets);
          }
          if (target) await this.ref.child(`night/wolfVotes/${id}`).set(target);
        });
      } else if (step === 'loup_blanc' && p.role === 'loup_blanc') {
        if (night.loupBlancTarget) return;
        this.once(key, async () => {
          const fresh = (await this.ref.once('value')).val();
          if (fresh.night.loupBlancTarget) return;
          const wolves = Object.entries(fresh.players).filter(([pid, pp]) => pp.alive && pp.role === 'loup_garou').map(([pid]) => pid);
          const target = this.randomFrom(wolves);
          if (target) await this.ref.child('night/loupBlancTarget').set(target);
        });
      } else if (step === 'voyante' && p.role === 'voyante') {
        if (night.seerTarget) return;
        this.once(key, async () => {
          const fresh = (await this.ref.once('value')).val();
          if (fresh.night.seerTarget) return;
          const target = this.randomFrom(this.otherAliveIds(fresh, id));
          if (target) await this.ref.child('night').update({ seerTarget: target, seerAck: true });
        });
      } else if (step === 'sorciere' && p.role === 'sorciere') {
        if (night.witchDecided) return;
        this.once(key, async () => {
          const fresh = (await this.ref.once('value')).val();
          if (fresh.night.witchDecided) return;
          const victimId = HostEngine.majorityTarget(fresh.night.wolfVotes || {});
          const roll = Math.random();
          if (victimId && !p.witchHealUsed && roll < 0.45) {
            await this.ref.child('night').update({ witchDecided: true, witchHeal: true, witchHealTarget: victimId });
            await this.ref.child(`players/${id}/witchHealUsed`).set(true);
          } else if (!p.witchPoisonUsed && roll > 0.85) {
            const target = this.randomFrom(this.otherAliveIds(fresh, id));
            await this.ref.child('night').update({ witchDecided: true, witchPoisonTarget: target || null });
            if (target) await this.ref.child(`players/${id}/witchPoisonUsed`).set(true);
          } else {
            await this.ref.child('night').update({ witchDecided: true, witchHeal: false, witchPoisonTarget: null });
          }
        });
      } else if (step === 'salvateur' && p.role === 'salvateur') {
        if (night.salvateurTarget) return;
        this.once(key, async () => {
          const fresh = (await this.ref.once('value')).val();
          if (fresh.night.salvateurTarget) return;
          const options = Object.keys(fresh.players).filter(pid => fresh.players[pid].alive && pid !== p.lastProtected);
          const target = this.randomFrom(options);
          if (target) {
            await this.ref.child('night/salvateurTarget').set(target);
            await this.ref.child(`players/${id}/lastProtected`).set(target);
          }
        });
      } else if (step === 'corbeau' && p.role === 'corbeau') {
        if (night.corbeauTarget) return;
        this.once(key, async () => {
          const fresh = (await this.ref.once('value')).val();
          if (fresh.night.corbeauTarget) return;
          const target = this.randomFrom(this.otherAliveIds(fresh, id));
          if (target) await this.ref.child('night/corbeauTarget').set(target);
        });
      } else if (step === 'renard' && p.role === 'renard' && !p.renardBlind) {
        if (night.renardTargets) return;
        this.once(key, async () => {
          const fresh = (await this.ref.once('value')).val();
          if (fresh.night.renardTargets) return;
          const all = Object.keys(fresh.players).filter(pid => fresh.players[pid].alive);
          const shuffled = all.sort(() => Math.random() - 0.5).slice(0, 3);
          if (shuffled.length === 3) await this.ref.child('night').update({ renardTargets: shuffled, renardAck: true });
        });
      }
    });
  },

  // ============ VOTE DE JOUR ============
  handleDayVote(room, bots) {
    bots.forEach(([id]) => {
      if (room.players[id].canVote === false) return;
      if (room.day && room.day.votes && room.day.votes[id]) return;
      const key = `dayvote-${room.round}-${id}`;
      this.once(key, async () => {
        const fresh = (await this.ref.once('value')).val();
        if (fresh.day && fresh.day.votes && fresh.day.votes[id]) return;
        const target = this.randomFrom(this.otherAliveIds(fresh, id));
        if (target) await this.ref.child(`day/votes/${id}`).set(target);
      }, 2000, 20000);
    });
  },

  // ============ CHASSEUR / SUCCESSION MAIRE ============
  handleHunter(room, bots) {
    const shooterId = room.night && room.night.hunterShooterId;
    if (!shooterId) return;
    const shooter = room.players[shooterId];
    if (!shooter || !shooter.isBot) return;
    if (room.night.hunterTarget) return;
    this.once(`hunter-${room.round}-${shooterId}`, async () => {
      const fresh = (await this.ref.once('value')).val();
      if (fresh.night.hunterTarget) return;
      const target = this.randomFrom(this.otherAliveIds(fresh, shooterId));
      if (target) await this.ref.child('night/hunterTarget').set(target);
    });
  },
  handleMayorSuccession(room, bots) {
    const formerId = room.mayorSuccession && room.mayorSuccession.formerMayorId;
    if (!formerId) return;
    const former = room.players[formerId];
    if (!former || !former.isBot) return;
    if (room.mayorSuccession.chosenId) return;
    this.once(`mayorsucc-${room.round}-${formerId}`, async () => {
      const fresh = (await this.ref.once('value')).val();
      if (fresh.mayorSuccession && fresh.mayorSuccession.chosenId) return;
      const target = this.randomFrom(this.otherAliveIds(fresh, formerId));
      if (target) await this.ref.child('mayorSuccession/chosenId').set(target);
    });
  },

  // ============ CHAT ============
  handleChat(room, bots) {
    const roundKey = `chat-${room.round}`;
    if (this.chatRoundsHandled.has(roundKey)) return;
    this.chatRoundsHandled.add(roundKey);

    const remaining = Math.max(4000, (room.phaseEndsAt || Date.now() + 30000) - Date.now());
    bots.forEach(([id, p]) => {
      const msgCount = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < msgCount; i++) {
        const delay = 1500 + Math.random() * Math.max(3000, remaining - 3000);
        setTimeout(async () => {
          const fresh = (await this.ref.once('value')).val();
          if (!fresh || fresh.status !== 'day-discuss') return;
          if (!fresh.players[id] || !fresh.players[id].alive) return;
          if (fresh.day && fresh.day.speakerPhase === 'turns') {
            const currentSpeaker = fresh.day.speakOrder[fresh.day.speakerIndex];
            if (currentSpeaker !== id) return;
          }
          const others = this.otherAliveIds(fresh, id).map(pid => fresh.players[pid].name);
          const name = this.randomFrom(others) || 'quelqu\'un';
          const line = this.randomFrom(CHAT_LINES).replace('{name}', name);
          await db.ref(`rooms/${this.roomCode}/chat`).push({ pid: id, name: p.name, text: line, channel: 'village', ts: Date.now() });
        }, delay);
      }
    });
  }
};

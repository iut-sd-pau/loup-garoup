/* ============================================================
   BOTS.JS
   Controleur des joueurs-robots (IA simple, heuristique).
   Execute UNIQUEMENT par le client hote, en parallele du
   HostEngine : les bots agissent en ecrivant dans Firebase
   exactement comme le ferait un joueur humain (memes chemins),
   donc le reste du moteur de jeu n'a rien a savoir de leur
   existence.
   ============================================================ */

// Mots-cles utilises pour deviner le ton d'un message recu (suspicion,
// confiance, question) afin que la reponse du bot y soit vraiment liee,
// plutot que d'envoyer une phrase generique sans rapport.
const SUSPICION_WORDS = ['louche', 'suspect', 'bizarre', 'loup', 'menteur', 'me méfie', 'me mefie', 'soupçonne', 'soupconne', 'cache quelque chose', 'pas net'];
const TRUST_WORDS = ['confiance', 'innocent', 'sûr de', 'sur de', 'pas lui', 'pas elle', 'clean', 'blanc', 'clair'];

const WOLF_HINT_LINES = [
  "Je ne sais pas pourquoi mais {name} m'inspire pas confiance.",
  "Perso je surveillerais {name} de près.",
  "{name}, tu m'as pas convaincu(e) hier soir.",
  "Y'a un truc qui cloche avec {name}, je saurais pas dire quoi.",
  "Franchement je me méfierais de {name} si j'étais vous.",
  "J'ai un mauvais pressentiment sur {name}, sans preuve concrète."
];
const INNOCENT_HINT_LINES = [
  "Je pense qu'on peut faire confiance à {name}, perso.",
  "{name} ne me semble pas être le problème ici.",
  "Bizarrement {name} m'inspire confiance.",
  "Je mettrais pas ma main à couper, mais {name} m'a l'air clean.",
  "On ferait mieux de chercher ailleurs que du côté de {name}."
];
const DEATH_LINES = [
  "Depuis la mort de {name}, je fais moins confiance à personne.",
  "On a perdu {name} cette nuit, faut pas se planter maintenant.",
  "{name} nous manque déjà, essayons de pas refaire la même erreur.",
  "La mort de {name} me fait bien réfléchir sur qui accuser."
];
const REACT_SUSPICIOUS_LINES = [
  "Ouais, {name} m'a paru louche aussi.",
  "Je suis d'accord, on devrait garder un œil sur {name}.",
  "Hmm, pas totalement convaincu(e) pour {name}, mais je note.",
  "Intéressant, pourquoi tu penses ça sur {name} ?"
];
const REACT_TRUSTING_LINES = [
  "Ok si tu le dis, je fais confiance à {name} alors.",
  "Pas sûr, je reste prudent(e) avec {name} quand même.",
  "{name} m'a pas donné de raison de douter non plus."
];
const REACT_QUESTION_LINES = [
  "Bonne question, j'y ai pas encore réfléchi.",
  "Franchement je sais pas, on manque d'infos.",
  "Difficile à dire pour l'instant."
];
const GENERIC_EARLY_LINES = [
  "On a encore peu d'infos, faut faire attention à pas accuser au hasard.",
  "Premier jour, je préfère observer avant de me prononcer.",
  "Qui a des arguments concrets contre quelqu'un ?"
];
const GENERIC_LATE_LINES = [
  "On n'a plus trop le temps de tergiverser.",
  "Il va falloir trancher, on peut pas se permettre une autre erreur.",
  "Le village se réduit, chaque vote compte double maintenant."
];
const GENERIC_NAME_LINES = [
  "Je me demande ce qu'a fait {name} hier soir.",
  "{name}, t'en penses quoi toi ?",
  "On devrait écouter {name} avant de voter.",
  "Qui a un avis sur {name} ?"
];

const BotController = {
  roomCode: null,
  ref: null,
  scheduled: new Set(),
  chatRoundsHandled: new Set(),
  _lastBotToBotReply: 0,

  start(roomCode) {
    this.roomCode = roomCode;
    this.ref = db.ref(`rooms/${roomCode}`);
    this.ref.on('value', snap => this.onChange(snap.val()));
    this.bindChatListener();
  },
  stop() {
    if (this.ref) this.ref.off('value');
    if (this._chatListenerRef) { this._chatListenerRef.off('child_added'); this._chatListenerRef = null; }
    this.scheduled.clear();
    this.chatRoundsHandled.clear();
  },

  onChange(room) {
    if (!room || room.status === 'ended' || room.status === 'lobby') return;
    const bots = Object.entries(room.players || {}).filter(([id, p]) => p.isBot && p.alive);
    if (bots.length === 0) return;

    if (room.status === 'mayor-candidacy') this.handleMayorCandidacy(room, bots);
    else if (room.status === 'mayor-speeches') this.handleMayorSpeeches(room, bots);
    else if (room.status === 'mayor-election') this.handleMayorElection(room, bots);
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

  // ============ CANDIDATURE AU POSTE DE MAIRE ============
  handleMayorCandidacy(room, bots) {
    const speeches = [
      "Je serais un bon Maire, j'ai l'esprit d'analyse.",
      "Franchement, personne ne se lance ? Je veux bien essayer.",
      "Je pense pouvoir aider le village a garder son calme.",
      "Allez, je me presente, on verra bien !"
    ];
    bots.forEach(([id, p]) => {
      const key = `candidacy-${id}`;
      if (room.candidacyResponses && room.candidacyResponses[id] !== undefined) return;
      this.once(key, async () => {
        const fresh = (await this.ref.once('value')).val();
        if (!fresh || fresh.status !== 'mayor-candidacy') return;
        if (fresh.candidacyResponses && fresh.candidacyResponses[id] !== undefined) return;
        const runs = Math.random() < 0.35; // la plupart des bots ne se presentent pas, comme des humains timides
        await this.ref.update({ [`mayorCandidates/${id}`]: runs, [`candidacyResponses/${id}`]: true });
      }, 2000, 15000);
    });
  },

  // ============ DISCOURS DE CANDIDATURE ============
  handleMayorSpeeches(room, bots) {
    const speech = room.mayorSpeech || {};
    const order = speech.order || [];
    const speakerId = order[speech.index || 0];
    const speakerBot = bots.find(([id]) => id === speakerId);
    if (!speakerBot) return;
    const [id, p] = speakerBot;
    const key = `speech-${speech.index || 0}-${id}`;
    const lines = [
      "Je pense avoir la tete froide qu'il faut pour ce role. Votez pour moi !",
      "J'ecoute tout le monde avant de trancher, je crois que c'est ce qu'il faut au village.",
      "Je n'ai rien a cacher, et je ferai de mon mieux pour le village.",
      "Faites-moi confiance, je prendrai les votes serieusement.",
      "Je serai juste et j'ecouterai les arguments de chacun."
    ];
    this.once(key, async () => {
      const fresh = (await this.ref.once('value')).val();
      if (!fresh || fresh.status !== 'mayor-speeches') return;
      const freshSpeech = fresh.mayorSpeech || {};
      if ((freshSpeech.order || [])[freshSpeech.index || 0] !== id) return;
      await db.ref(`rooms/${this.roomCode}/chat`).push({ pid: id, name: p.name, text: this.randomFrom(lines), channel: 'village', ts: Date.now() });
      // termine son discours peu apres, pas la peine de faire attendre tout le monde 20s
      setTimeout(async () => {
        const f2 = (await this.ref.once('value')).val();
        if (!f2 || f2.status !== 'mayor-speeches') return;
        const s2 = f2.mayorSpeech || {};
        if ((s2.order || [])[s2.index || 0] !== id) return;
        await this.ref.child('mayorSpeech/skipRequested').set(id);
      }, 2500 + Math.random() * 2000);
    }, 1500, 4000);
  },

  // ============ ELECTION DU MAIRE ============
  handleMayorElection(room, bots) {
    const pool = room.mayorPool && room.mayorPool.length ? room.mayorPool : this.otherAliveIds(room, null);
    bots.forEach(([id]) => {
      const key = `mayor-${id}`;
      if (room.mayorVotes && room.mayorVotes[id]) return;
      this.once(key, async () => {
        const fresh = (await this.ref.once('value')).val();
        if (!fresh || fresh.status !== 'mayor-election') return;
        if (fresh.mayorVotes && fresh.mayorVotes[id]) return;
        const freshPool = fresh.mayorPool && fresh.mayorPool.length ? fresh.mayorPool : this.otherAliveIds(fresh, null);
        const validPool = freshPool.filter(pid => fresh.players[pid] && fresh.players[pid].alive);
        const target = this.randomFrom(validPool.length ? validPool : this.otherAliveIds(fresh, null));
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
        this.reconcileWolfVote(room, id, p);
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
          if (target) await this.ref.child(`players/${id}/knowledge/${target}`).set(fresh.players[target].role);
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

  // Les loups-bots doivent VRAIMENT suivre les loups humains, pas l'inverse.
  // Si un loup humain a deja vote, le bot se rallie a SON choix (pas au
  // premier vote quel qu'il soit). S'il n'y a aucun loup humain, on retombe
  // sur la convergence habituelle (premier vote existant, sinon au hasard).
  // Cette fonction est appelee a CHAQUE mise a jour de la salle (pas une
  // seule fois), donc si le loup humain change d'avis, le bot se realigne.
  reconcileWolfVote(room, id, p) {
    const night = room.night || {};
    const votes = night.wolfVotes || {};
    const wolfEntries = Object.entries(room.players).filter(([pid, pp]) => pp.alive && isWolf(pp.role));
    const humanVoted = wolfEntries.find(([pid, pp]) => !pp.isBot && votes[pid]);
    const myVote = votes[id];

    if (humanVoted) {
      const desiredTarget = votes[humanVoted[0]];
      if (myVote === desiredTarget) return; // deja aligne avec le loup humain
      const key = `wolfrealign-${room.round}-${id}-${desiredTarget}`;
      this.once(key, async () => {
        const fresh = (await this.ref.once('value')).val();
        if (!fresh || fresh.status !== 'night') return;
        const st = fresh.night && fresh.night.steps[fresh.night.stepIndex];
        if (st !== 'wolves') return;
        const freshVotes = fresh.night.wolfVotes || {};
        const freshWolves = Object.entries(fresh.players).filter(([pid, pp]) => pp.alive && isWolf(pp.role));
        const freshHuman = freshWolves.find(([pid, pp]) => !pp.isBot && freshVotes[pid]);
        if (!freshHuman) return;
        const finalTarget = freshVotes[freshHuman[0]];
        if (freshVotes[id] === finalTarget) return;
        await this.ref.child(`night/wolfVotes/${id}`).set(finalTarget);
      }, 1000, 3000);
      return;
    }

    if (!myVote) {
      const key = `night-${room.round}-wolves-${id}`;
      this.once(key, async () => {
        const fresh = (await this.ref.once('value')).val();
        if (fresh.night.wolfVotes && fresh.night.wolfVotes[id]) return;
        const anyVote = Object.values(fresh.night.wolfVotes || {});
        let target;
        if (anyVote.length) {
          target = anyVote[0];
        } else {
          const targets = Object.entries(fresh.players).filter(([pid, pp]) => pp.alive && !isWolf(pp.role)).map(([pid]) => pid);
          target = this.randomFrom(targets);
        }
        if (target) await this.ref.child(`night/wolfVotes/${id}`).set(target);
      });
    }
  },

  // ============ ECOUTE DU CHAT : les bots reagissent vraiment ============
  bindChatListener() {
    this._chatListenerRef = db.ref(`rooms/${this.roomCode}/chat`).limitToLast(1);
    this._chatListenerRef.on('child_added', (snap) => {
      const msg = snap.val();
      if (!msg || Date.now() - msg.ts > 8000) return; // ignore l'historique au chargement initial
      if (msg.channel === 'wolves') this.reactToWolfChat(msg);
      else if (msg.channel === 'village') this.reactToVillageChat(msg);
    });
  },

  // Cherche un nom de joueur mentionne dans un message (le plus long nom
  // correspondant d'abord, pour eviter qu'un nom court soit un sous-mot).
  findMentionedName(text, candidateNames) {
    const lower = text.toLowerCase();
    const sorted = [...candidateNames].sort((a, b) => b.length - a.length);
    for (const name of sorted) {
      if (name.length >= 2 && lower.includes(name.toLowerCase())) return name;
    }
    return null;
  },

  async reactToWolfChat(msg) {
    const room = (await this.ref.once('value')).val();
    if (!room || room.status !== 'night') return;
    const step = room.night && room.night.steps[room.night.stepIndex];
    if (step !== 'wolves') return;
    const author = room.players[msg.pid];
    if (!author || author.isBot) return; // ne reagit qu'aux messages humains (evite les boucles bot<->bot)
    if (!isWolf(author.role) && author.role !== 'loup_blanc') return;

    const wolfBots = Object.entries(room.players).filter(([id, pp]) => pp.isBot && pp.alive && isWolf(pp.role));
    if (wolfBots.length === 0) return;

    const targetNames = Object.values(room.players).filter(pp => pp.alive && !isWolf(pp.role)).map(pp => pp.name);
    const mentioned = this.findMentionedName(msg.text, targetNames);
    if (!mentioned) return;
    const targetEntry = Object.entries(room.players).find(([id, pp]) => pp.name === mentioned && pp.alive && !isWolf(pp.role));
    if (!targetEntry) return;
    const targetId = targetEntry[0];

    const replies = [
      `D'accord, va pour ${mentioned}.`,
      `Ok, ${mentioned} alors.`,
      `Ca me va, je change pour ${mentioned}.`,
      `Bonne idee, ${mentioned}.`,
      `Va pour ${mentioned}, je te suis.`
    ];

    wolfBots.forEach(([botId, botP]) => {
      const delay = 1000 + Math.random() * 2200;
      setTimeout(async () => {
        const fresh = (await this.ref.once('value')).val();
        if (!fresh || fresh.status !== 'night') return;
        const st = fresh.night && fresh.night.steps[fresh.night.stepIndex];
        if (st !== 'wolves') return;
        const currentVote = fresh.night.wolfVotes && fresh.night.wolfVotes[botId];
        if (currentVote === targetId) return; // deja d'accord
        await this.ref.child(`night/wolfVotes/${botId}`).set(targetId);
        if (Math.random() < 0.75) {
          const line = this.randomFrom(replies);
          await db.ref(`rooms/${this.roomCode}/chat`).push({ pid: botId, name: botP.name, text: line, channel: 'wolves', ts: Date.now() });
        }
      }, delay);
    });
  },

  // ============ GENERATION DE DIALOGUE CONTEXTUEL ============
  detectSentiment(text) {
    const lower = text.toLowerCase();
    if (lower.includes('?')) return 'question';
    if (SUSPICION_WORDS.some(w => lower.includes(w))) return 'suspicious';
    if (TRUST_WORDS.some(w => lower.includes(w))) return 'trusting';
    return 'neutral';
  },

  fillName(line, name) { return line.replace('{name}', name); },

  // Construit une ligne de chat qui a un vrai lien avec l'instant present :
  // un indice tire d'une info que le bot possede vraiment (sans jamais
  // denoncer frontalement), une reaction au message recu, une reference a
  // une mort recente, ou a defaut une ligne generique adaptee au round.
  buildVillageLine(room, botId, botP, replyCtx) {
    const others = this.otherAliveIds(room, botId).map(pid => room.players[pid].name);
    const knowledge = (room.players[botId] && room.players[botId].knowledge) || {};
    const hintsGiven = (room.players[botId] && room.players[botId].hintsGiven) || {};
    const unusedKnowledge = Object.entries(knowledge).filter(([tid, role]) => room.players[tid] && room.players[tid].alive && !hintsGiven[tid]);

    const roll = Math.random();

    // Aide sans denoncer : un indice discret tire d'une info reellement connue
    if (unusedKnowledge.length && roll < 0.3) {
      const [targetId, role] = this.randomFrom(unusedKnowledge);
      const isWolfy = role === 'loup_garou' || role === 'loup_blanc';
      const line = this.fillName(this.randomFrom(isWolfy ? WOLF_HINT_LINES : INNOCENT_HINT_LINES), room.players[targetId].name);
      return { text: line, usedHintTarget: targetId };
    }

    // Reponse a ce qui vient d'etre dit, quand ca a un sens
    if (replyCtx && replyCtx.mentioned) {
      const sentiment = this.detectSentiment(replyCtx.text);
      const pool = sentiment === 'suspicious' ? REACT_SUSPICIOUS_LINES
        : sentiment === 'trusting' ? REACT_TRUSTING_LINES
        : sentiment === 'question' ? REACT_QUESTION_LINES
        : null;
      if (pool) return { text: this.fillName(this.randomFrom(pool), replyCtx.mentioned) };
    }

    // Reference a la mort la plus recente, pour ancrer la conversation dans le moment
    const logEntries = Object.values(room.log || {}).sort((a, b) => b.ts - a.ts);
    const deathEntry = logEntries.find(l => l.text && l.text.includes('\ud83d\udc80'));
    if (deathEntry && roll < 0.55) {
      const deadNames = Object.values(room.players).filter(pp => !pp.alive).map(pp => pp.name);
      const deadName = this.findMentionedName(deathEntry.text, deadNames);
      if (deadName) return { text: this.fillName(this.randomFrom(DEATH_LINES), deadName) };
    }

    // A defaut, une ligne generique mais adaptee au moment de la partie
    const name = this.randomFrom(others) || 'quelqu\'un';
    const pool = room.round >= 3 ? GENERIC_LATE_LINES.concat(GENERIC_NAME_LINES) : GENERIC_EARLY_LINES.concat(GENERIC_NAME_LINES);
    return { text: this.fillName(this.randomFrom(pool), name) };
  },

  async sendVillageLine(botId, botP, replyCtx) {
    const fresh = (await this.ref.once('value')).val();
    if (!fresh || fresh.status !== 'day-discuss') return;
    if (!fresh.players[botId] || !fresh.players[botId].alive) return;
    if (fresh.day && fresh.day.speakerPhase === 'turns') {
      const speaker = fresh.day.speakOrder[fresh.day.speakerIndex];
      if (speaker !== botId) return; // respecte le tour de parole
    }
    const result = this.buildVillageLine(fresh, botId, botP, replyCtx);
    await db.ref(`rooms/${this.roomCode}/chat`).push({ pid: botId, name: botP.name, text: result.text, channel: 'village', ts: Date.now() });
    if (result.usedHintTarget) {
      await this.ref.child(`players/${botId}/hintsGiven/${result.usedHintTarget}`).set(true);
    }
  },

  async reactToVillageChat(msg) {
    const room = (await this.ref.once('value')).val();
    if (!room || room.status !== 'day-discuss') return;
    const author = room.players[msg.pid];
    if (!author) return;

    const bots = Object.entries(room.players).filter(([id, pp]) => pp.isBot && pp.alive && id !== msg.pid);
    if (bots.length === 0) return;

    // Un bot reagit plus volontiers a un humain qu'a un autre bot, et on
    // limite les echanges bot<->bot dans le temps pour eviter un dialogue
    // en boucle qui tournerait en rond sans les joueurs humains.
    if (author.isBot) {
      if (Math.random() > 0.18) return;
      if (Date.now() - this._lastBotToBotReply < 14000) return;
    } else {
      if (Math.random() > 0.45) return;
    }

    const names = Object.values(room.players).filter(pp => pp.alive).map(pp => pp.name);
    const mentioned = this.findMentionedName(msg.text, names.filter(n => n !== author.name));
    const [botId, botP] = this.randomFrom(bots);
    if (author.isBot) this._lastBotToBotReply = Date.now();

    const delay = 1500 + Math.random() * 4000;
    setTimeout(() => this.sendVillageLine(botId, botP, { text: msg.text, mentioned }), delay);
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
        setTimeout(() => this.sendVillageLine(id, p, null), delay);
      }
    });
  }
};

/* ============================================================
   HOST-ENGINE.JS
   Machine a etats executee UNIQUEMENT par le client "hote".
   Ecoute la salle en temps reel et fait avancer la partie
   (nuit -> jour -> nuit ... -> fin) quand les conditions sont
   reunies (actions soumises ou temps ecoule).
   Supporte : roles etendus (Ancien, Idiot, Corbeau, Renard,
   Voleur, Loup Blanc), Maire, 1 a 50 joueurs, bots.
   ============================================================ */

const HostEngine = {
  roomCode: null,
  ref: null,
  busy: false,
  timerCheckInterval: null,

  start(roomCode) {
    this.roomCode = roomCode;
    this.ref = db.ref(`rooms/${roomCode}`);
    this.ref.on('value', snap => this.onRoomChange(snap.val()));
    this.timerCheckInterval = setInterval(() => this.checkTimeout(), 2000);
  },

  stop() {
    if (this.ref) this.ref.off('value');
    if (this.timerCheckInterval) clearInterval(this.timerCheckInterval);
  },

  async onRoomChange(room) {
    if (!room) return;
    if (room.status === 'ended') return;
    if (this.busy) { this._pendingRoom = room; return; }
    try {
      this.busy = true;
      if (room.status === 'night') await this.evaluateNight(room);
      else if (room.status === 'day-vote') await this.evaluateDayVote(room);
      else if (room.status === 'hunter') await this.evaluateHunter(room);
      else if (room.status === 'mayor-candidacy') await this.evaluateMayorCandidacy(room);
      else if (room.status === 'mayor-speeches') await this.evaluateMayorSpeeches(room);
      else if (room.status === 'mayor-election') await this.evaluateMayorElection(room);
      else if (room.status === 'mayor-succession') await this.evaluateMayorSuccession(room);
      else if (room.status === 'day-discuss') await this.evaluateDayDiscuss(room);
    } catch (e) {
      console.error('HostEngine error', e);
    } finally {
      this.busy = false;
      // Si un evenement est arrive pendant le traitement, on le retraite
      // immediatement pour ne jamais rater une action soumise par un joueur.
      if (this._pendingRoom) {
        const pending = this._pendingRoom;
        this._pendingRoom = null;
        this.onRoomChange(pending);
      }
    }
  },

  async checkTimeout() {
    if (this.busy) return;
    const snap = await this.ref.once('value');
    const room = snap.val();
    if (!room || room.status === 'ended') return;

    // Rotation du "tour de parole" pendant le debat (independant du timer de phase)
    if (room.status === 'day-discuss' && room.day && room.day.speakerPhase !== 'free' && room.day.speakerEndsAt && Date.now() >= room.day.speakerEndsAt) {
      await this.advanceSpeaker(room);
    }
    // Rotation des discours de candidature au poste de Maire
    if (room.status === 'mayor-speeches' && room.mayorSpeech && room.mayorSpeech.endsAt && Date.now() >= room.mayorSpeech.endsAt) {
      await this.advanceMayorSpeech(room);
    }

    if (!room.phaseEndsAt) return;
    if (Date.now() < room.phaseEndsAt) return;

    if (room.status === 'day-discuss') {
      await this.ref.update({ status: 'day-vote', phaseEndsAt: Date.now() + 45000 });
    } else if (room.status === 'day-vote') {
      await this.evaluateDayVote(room, true);
    } else if (room.status === 'night') {
      await this.evaluateNight(room, true);
    } else if (room.status === 'hunter') {
      await this.evaluateHunter(room, true);
    } else if (room.status === 'mayor-election') {
      await this.evaluateMayorElection(room, true);
    } else if (room.status === 'mayor-succession') {
      await this.evaluateMayorSuccession(room, true);
    } else if (room.status === 'mayor-candidacy') {
      await this.evaluateMayorCandidacy(room, true);
    } else if (room.status === 'mayor-speeches') {
      await this.evaluateMayorSpeeches(room, true);
    }
  },

  // ============ TOUR DE PAROLE (chat) ============
  async evaluateDayDiscuss(room) {
    const day = room.day || {};
    if (day.speakerPhase !== 'turns') return;
    const order = day.speakOrder || [];
    const currentSpeaker = order[day.speakerIndex];
    if (day.skipRequested && day.skipRequested === currentSpeaker) {
      await this.advanceSpeaker(room);
    }
  },

  async advanceSpeaker(room) {
    const day = room.day || {};
    const order = day.speakOrder || [];
    const nextIndex = (day.speakerIndex || 0) + 1;
    if (nextIndex >= order.length) {
      await this.ref.child('day').update({ speakerPhase: 'free', skipRequested: null });
    } else {
      const perSpeakerMs = day.perSpeakerMs || 15000;
      await this.ref.child('day').update({ speakerIndex: nextIndex, speakerEndsAt: Date.now() + perSpeakerMs, skipRequested: null });
    }
  },

  // ============ CANDIDATURE AU POSTE DE MAIRE ============
  // Etape optionnelle et volontaire : chacun choisit s'il se presente ou non.
  // Personne n'est oblige de repondre (silence = non), mais si tout le monde
  // a explicitement repondu on n'attend pas la fin du minuteur pour rien.
  async startMayorCandidacy(room) {
    await this.ref.update({
      status: 'mayor-candidacy',
      mayorCandidates: null,
      candidacyResponses: null,
      mayorSpeech: null,
      mayorVotes: null,
      mayorPool: null,
      phaseEndsAt: Date.now() + 25000
    });
  },

  async evaluateMayorCandidacy(room, forceTimeout = false) {
    const alive = this.alivePlayers(room);
    const responses = room.candidacyResponses || {};
    const allResponded = alive.length > 0 && alive.every(([id]) => responses[id] !== undefined);
    if (!allResponded && !forceTimeout) return;
    await this.resolveMayorCandidacy(room);
  },

  async resolveMayorCandidacy(room) {
    const alive = this.alivePlayers(room);
    const candidateIds = alive.filter(([id]) => room.mayorCandidates && room.mayorCandidates[id]).map(([id]) => id);
    const updates = {};

    if (candidateIds.length === 0) {
      // Personne ne s'est porte volontaire : on ne force personne a se
      // presenter, le village vote directement parmi tout le monde.
      updates['log/' + Date.now()] = { round: 0, text: `🗳️ Personne ne s'est porté candidat au poste de Maire : le village va voter directement.`, ts: Date.now() };
      updates['status'] = 'mayor-election';
      updates['mayorVotes'] = null;
      updates['mayorPool'] = alive.map(([id]) => id);
      updates['phaseEndsAt'] = Date.now() + 35000;
      await this.ref.update(updates);
      return;
    }

    if (candidateIds.length === 1) {
      const soleId = candidateIds[0];
      updates[`players/${soleId}/isMayor`] = true;
      updates['log/' + Date.now()] = { round: 0, text: `👑 ${room.players[soleId].name} est l'unique candidat(e) et devient Maire sans opposition.`, ts: Date.now() };
      await this.ref.update(updates);
      const fresh = (await this.ref.once('value')).val();
      await this.startNight(fresh, 1);
      return;
    }

    const names = candidateIds.map(id => room.players[id].name).join(', ');
    updates['log/' + Date.now()] = { round: 0, text: `🗳️ ${candidateIds.length} candidat(e)s se présentent au poste de Maire : ${names}. Chacun aura un temps de parole avant le vote.`, ts: Date.now() };
    await this.ref.update(updates);
    const fresh = (await this.ref.once('value')).val();
    await this.startMayorSpeeches(fresh, candidateIds);
  },

  // ============ DISCOURS DES CANDIDATS ============
  async startMayorSpeeches(room, candidateIds) {
    const order = shuffleArray(candidateIds);
    await this.ref.update({
      status: 'mayor-speeches',
      mayorSpeech: { order, index: 0, endsAt: Date.now() + 20000 },
      phaseEndsAt: null
    });
  },

  async evaluateMayorSpeeches(room, forceTimeout = false) {
    const speech = room.mayorSpeech || {};
    const order = speech.order || [];
    const currentSpeaker = order[speech.index || 0];
    const skipped = speech.skipRequested && speech.skipRequested === currentSpeaker;
    if (!forceTimeout && !skipped) return;
    await this.advanceMayorSpeech(room);
  },

  async advanceMayorSpeech(room) {
    const speech = room.mayorSpeech || {};
    const order = speech.order || [];
    const nextIndex = (speech.index || 0) + 1;
    if (nextIndex >= order.length) {
      await this.ref.update({
        status: 'mayor-election',
        mayorVotes: null,
        mayorPool: order,
        mayorSpeech: null,
        phaseEndsAt: Date.now() + 35000
      });
    } else {
      await this.ref.update({
        'mayorSpeech/index': nextIndex,
        'mayorSpeech/endsAt': Date.now() + 20000,
        'mayorSpeech/skipRequested': null
      });
    }
  },

  // ============ VOTE FINAL (parmi les candidats, ou tout le monde si personne ne s'est presente) ============
  async evaluateMayorElection(room, forceTimeout = false) {
    const alive = this.alivePlayers(room);
    const votes = room.mayorVotes || {};
    const allVoted = alive.every(([id]) => votes[id]);
    if (!allVoted && !forceTimeout) return;

    const winnerId = this.majorityTarget(votes);
    const updates = {};
    if (winnerId) {
      updates[`players/${winnerId}/isMayor`] = true;
      updates['log/' + Date.now()] = { round: 0, text: `👑 ${room.players[winnerId].name} a été élu(e) Maire du village. Son vote comptera double.`, ts: Date.now() };
    }
    updates['mayorVotes'] = null;
    updates['mayorPool'] = null;
    await this.ref.update(updates);
    const fresh = (await this.ref.once('value')).val();
    await this.startNight(fresh, 1);
  },

  // ============ SUCCESSION DU MAIRE ============
  async evaluateMayorSuccession(room, forceTimeout = false) {
    const successorId = room.mayorSuccession && room.mayorSuccession.chosenId;
    if (!successorId && !forceTimeout) return;

    const updates = {};
    const alive = this.alivePlayers(room);
    const pick = successorId && room.players[successorId] && room.players[successorId].alive
      ? successorId
      : (alive.length ? alive[Math.floor(Math.random() * alive.length)][0] : null);

    if (pick) {
      updates[`players/${pick}/isMayor`] = true;
      updates['log/' + Date.now()] = { round: room.round, text: `👑 ${room.players[pick].name} devient le nouveau Maire.`, ts: Date.now() };
    }
    updates['mayorSuccession'] = null;
    await this.ref.update(updates);

    const fresh = (await this.ref.once('value')).val();
    if (this.checkWin(fresh)) return;
    await this.advanceSpecialQueue(fresh);
  },

  alivePlayers(room) {
    return Object.entries(room.players || {}).filter(([id, p]) => p.alive);
  },
  votingPlayers(room) {
    return this.alivePlayers(room).filter(([id, p]) => p.canVote !== false);
  },
  aliveWolves(room) {
    return this.alivePlayers(room).filter(([id, p]) => isWolf(p.role));
  },
  playerByRole(room, role) {
    return Object.entries(room.players || {}).find(([id, p]) => p.role === role && p.alive);
  },

  // ============ NUIT ============
  hasAliveRole(room, role) {
    return Object.values(room.players || {}).some(p => p.alive && p.role === role);
  },

  buildNightSteps(room, roundNumber) {
    const s = room.settings || {};
    const steps = [];
    if (roundNumber === 1) {
      if (s.voleur && this.hasAliveRole(room, 'voleur')) steps.push('voleur');
      if (s.cupidon && this.hasAliveRole(room, 'cupidon')) steps.push('cupidon');
    }
    steps.push('wolves');
    if (roundNumber % 2 === 0 && s.loup_blanc && this.hasAliveRole(room, 'loup_blanc')) steps.push('loup_blanc');
    if (s.voyante && this.hasAliveRole(room, 'voyante')) steps.push('voyante');
    if (s.sorciere && this.hasAliveRole(room, 'sorciere')) steps.push('sorciere');
    if (s.salvateur && this.hasAliveRole(room, 'salvateur')) steps.push('salvateur');
    if (s.corbeau && this.hasAliveRole(room, 'corbeau')) steps.push('corbeau');
    if (s.renard && this.hasAliveRole(room, 'renard')) steps.push('renard');
    steps.push('resolve');
    return steps;
  },

  // La nuit n'a JAMAIS de minuteur automatique : chaque joueur prend le temps
  // qu'il faut pour decider. Seul le bouton "Forcer le passage" de l'hote
  // peut debloquer une etape (utile si quelqu'un est absent).
  async evaluateNight(room, forceTimeout = false) {
    const night = room.night || {};
    const steps = night.steps || [];
    const stepIndex = night.stepIndex || 0;
    const currentStep = steps[stepIndex];
    if (!currentStep) return;

    // Le Renard doit toujours voir son resultat calcule des que ses cibles
    // sont soumises, independamment du moment ou l'etape avance.
    if (currentStep === 'renard' && night.renardTargets && !night.renardProcessed) {
      await this.resolveRenard(room, night);
      const refreshed = (await this.ref.once('value')).val();
      room = refreshed || room;
    }

    let ready = forceTimeout;

    if (!ready) {
      if (currentStep === 'voleur') {
        ready = night.voleurDone === true;
      } else if (currentStep === 'cupidon') {
        ready = !!(night.cupidLovers && night.cupidLovers.length === 2);
      } else if (currentStep === 'wolves') {
        const wolves = this.aliveWolves(room);
        const votes = night.wolfVotes || {};
        if (wolves.length === 0) {
          ready = true; // ne devrait pas arriver (la partie serait deja finie), securite anti-blocage
        } else {
          const allVoted = wolves.every(([id]) => votes[id]);
          if (allVoted) {
            const distinctTargets = new Set(wolves.map(([id]) => votes[id]));
            ready = distinctTargets.size === 1; // consensus requis : une seule victime choisie ENSEMBLE
          }
        }
      } else if (currentStep === 'loup_blanc') {
        ready = !!night.loupBlancTarget;
      } else if (currentStep === 'voyante') {
        ready = night.seerAck === true;
      } else if (currentStep === 'sorciere') {
        ready = night.witchDecided === true;
      } else if (currentStep === 'salvateur') {
        ready = !!night.salvateurTarget;
      } else if (currentStep === 'corbeau') {
        ready = !!night.corbeauTarget;
      } else if (currentStep === 'renard') {
        const renardEntry = this.playerByRole(room, 'renard');
        const isBlind = renardEntry && renardEntry[1].renardBlind;
        ready = !!isBlind || night.renardAck === true;
      }
    }

    if (!ready) return;

    if (currentStep === 'resolve') {
      await this.resolveNight(room);
      return;
    }

    const nextIndex = stepIndex + 1;
    const nextStep = steps[nextIndex];
    await this.ref.child('night').update({ stepIndex: nextIndex });
    if (nextStep === 'resolve') {
      // Tout le monde a fini : petit compte a rebours avant que le village
      // ne s'endorme completement et que la nuit se resolve.
      await this.ref.update({ phaseEndsAt: Date.now() + 4000 });
    } else {
      // Etape avec une decision a prendre : pas de minuteur, on prend le temps qu'il faut.
      await this.ref.update({ phaseEndsAt: null });
    }
  },

  async resolveRenard(room, night) {
    const targets = night.renardTargets || [];
    const foundWolf = targets.some(id => room.players[id] && isWolfSide(room.players[id].role));
    const renardEntry = this.playerByRole(room, 'renard');
    const updates = { 'night/renardProcessed': true };
    if (!foundWolf && renardEntry) {
      updates[`players/${renardEntry[0]}/renardBlind`] = true;
    }
    await this.ref.update(updates);
  },

  async resolveNight(room) {
    const night = room.night || {};
    const players = room.players || {};
    const wolfVotes = night.wolfVotes || {};
    const logLines = [];
    const updates = {};
    let deaths = new Set();

    let victimId = this.majorityTarget(wolfVotes);
    if (victimId) {
      let saved = false;
      if (night.witchHeal && night.witchHealTarget === victimId) saved = true;
      if (night.salvateurTarget === victimId) saved = true;
      if (!saved) {
        const victimP = players[victimId];
        if (victimP && victimP.role === 'ancien' && !victimP.elderHit) {
          updates[`players/${victimId}/elderHit`] = true;
          logLines.push(`🧓 ${victimP.name} (l'Ancien) résiste à l'attaque des loups... cette fois-ci.`);
        } else {
          deaths.add(victimId);
        }
      }
    }

    if (night.witchPoisonTarget) deaths.add(night.witchPoisonTarget);

    if (night.loupBlancTarget && players[night.loupBlancTarget] && players[night.loupBlancTarget].alive) {
      deaths.add(night.loupBlancTarget);
    }

    this.applyLoverChain(room, deaths);

    deaths.forEach(id => { if (players[id]) updates[`players/${id}/alive`] = false; });

    if (deaths.size === 0) {
      logLines.push(`🌙 Nuit ${room.round} : étrangement, personne n'est mort cette nuit.`);
    } else {
      deaths.forEach(id => {
        const p = players[id];
        if (p) logLines.push(`💀 ${p.name} a été retrouvé(e) mort(e) au petit matin.`);
      });
    }

    updates['log/' + Date.now()] = { round: room.round, text: logLines.join(' '), ts: Date.now() };
    updates['deathsThisRound'] = Array.from(deaths);
    await this.ref.update(updates);

    const fresh = (await this.ref.once('value')).val();
    if (this.checkWin(fresh)) return;
    await this.runSpecials(fresh, Array.from(deaths), 'day-reveal');
  },

  // Construit et lance la file d'evenements speciaux declenches par des morts
  // (Chasseur qui tire, succession du Maire), puis enchaine sur la suite du jeu.
  async runSpecials(room, deathIds, continuation) {
    const players = room.players || {};
    const queue = [];
    deathIds.forEach(id => {
      const p = players[id];
      if (!p) return;
      if (p.role === 'chasseur') queue.push({ type: 'hunter', actorId: id });
      if (p.isMayor) queue.push({ type: 'mayor-succession', actorId: id });
    });

    if (queue.length === 0) {
      await this.continueAfterSpecials(room, continuation);
      return;
    }

    await this.ref.update({ specialQueue: queue, specialIndex: 0, specialContinuation: continuation });
    await this.activateSpecial(queue[0]);
  },

  async activateSpecial(item) {
    if (item.type === 'hunter') {
      await this.ref.update({ status: 'hunter', 'night/hunterShooterId': item.actorId, phaseEndsAt: null });
    } else if (item.type === 'mayor-succession') {
      await this.ref.update({ status: 'mayor-succession', 'mayorSuccession/formerMayorId': item.actorId, phaseEndsAt: null });
    }
  },

  // Si une mort en entraine une autre (ex : le Chasseur emporte quelqu'un
  // qui etait lui-meme Maire), on insere les nouveaux evenements speciaux
  // juste apres celui en cours, sans perdre la file existante.
  async extendSpecialQueue(room, newDeathIds) {
    const players = room.players || {};
    const additions = [];
    newDeathIds.forEach(id => {
      const p = players[id];
      if (!p) return;
      if (p.role === 'chasseur') additions.push({ type: 'hunter', actorId: id });
      if (p.isMayor) additions.push({ type: 'mayor-succession', actorId: id });
    });
    if (additions.length === 0) return;
    const queue = room.specialQueue || [];
    const idx = room.specialIndex || 0;
    const newQueue = [...queue.slice(0, idx + 1), ...additions, ...queue.slice(idx + 1)];
    await this.ref.update({ specialQueue: newQueue });
  },

  async advanceSpecialQueue(room) {
    const queue = room.specialQueue || [];
    const nextIndex = (room.specialIndex || 0) + 1;
    if (nextIndex < queue.length) {
      await this.ref.update({ specialIndex: nextIndex });
      await this.activateSpecial(queue[nextIndex]);
    } else {
      const continuation = room.specialContinuation;
      await this.ref.update({ specialQueue: null, specialIndex: null, specialContinuation: null });
      await this.continueAfterSpecials(room, continuation);
    }
  },

  async continueAfterSpecials(room, continuation) {
    if (continuation === 'day-reveal') await this.goToDayReveal(room);
    else await this.startNight(room, room.round + 1);
  },

  async evaluateHunter(room, forceTimeout = false) {
    const night = room.night || {};
    if (!night.hunterShooterId) return;
    const target = night.hunterTarget;
    if (!target && !forceTimeout) return;

    const updates = {};
    const deaths = new Set();
    if (target && room.players[target] && room.players[target].alive) {
      deaths.add(target);
      this.applyLoverChain(room, deaths);
      deaths.forEach(id => { updates[`players/${id}/alive`] = false; });
      const name = room.players[target].name;
      updates['log/' + Date.now()] = { round: room.round, text: `🏹 En mourant, ${room.players[night.hunterShooterId].name} a emporté ${name} avec lui.`, ts: Date.now() };
    }
    updates['night/hunterShooterId'] = null;
    updates['night/hunterTarget'] = null;
    await this.ref.update(updates);

    let fresh = (await this.ref.once('value')).val();
    if (this.checkWin(fresh)) return;
    if (deaths.size > 0) {
      await this.extendSpecialQueue(fresh, Array.from(deaths));
      fresh = (await this.ref.once('value')).val();
    }
    await this.advanceSpecialQueue(fresh);
  },

  applyLoverChain(room, deathsSet) {
    const players = room.players || {};
    const lovers = room.lovers || [];
    if (lovers.length !== 2) return;
    const [a, b] = lovers;
    if (deathsSet.has(a) && players[b] && players[b].alive) deathsSet.add(b);
    if (deathsSet.has(b) && players[a] && players[a].alive) deathsSet.add(a);
  },

  majorityTarget(votesObj) {
    const counts = {};
    Object.values(votesObj || {}).forEach(t => { counts[t] = (counts[t] || 0) + 1; });
    let best = null, bestCount = 0, tie = [];
    Object.entries(counts).forEach(([id, c]) => {
      if (c > bestCount) { best = id; bestCount = c; tie = [id]; }
      else if (c === bestCount) { tie.push(id); }
    });
    if (tie.length > 1) best = tie[Math.floor(Math.random() * tie.length)];
    return best;
  },

  // Calcule un temps de parole par joueur qui garantit : 1) tout le monde
  // parle a tour de role, 2) un vrai moment de debat libre reste toujours
  // disponible ensuite, en s'adaptant a la duree de debat choisie par l'hote.
  computeSpeakingPlan(aliveCount, dayDurationSeconds) {
    const MIN_FREE = 25;      // secondes de debat libre garanties au minimum
    const MIN_TURN = 6;       // secondes minimum par joueur pour que ca vaille le coup
    const MAX_TURN = 20;      // secondes maximum par joueur (evite de trainer en petit comite)

    if (aliveCount <= 1) return { enabled: false };

    const availableForTurns = dayDurationSeconds - MIN_FREE;
    if (availableForTurns < MIN_TURN * aliveCount) {
      return { enabled: false };
    }
    const perSpeaker = Math.min(MAX_TURN, Math.max(MIN_TURN, Math.floor(availableForTurns / aliveCount)));
    return { enabled: true, perSpeakerMs: perSpeaker * 1000 };
  },

  async goToDayReveal(room) {
    const fresh = (await this.ref.once('value')).val();
    if (this.checkWin(fresh)) return;
    await this.ref.update({
      status: 'day-reveal',
      phaseEndsAt: Date.now() + 8000,
      'day/votes': null
    });
    setTimeout(async () => {
      const r = (await this.ref.once('value')).val();
      if (!r || r.status !== 'day-reveal') return;
      const duration = (r.settings && r.settings.dayDuration) || 120;
      const order = shuffleArray(this.alivePlayers(r).map(([id]) => id));
      const wantsTurns = r.settings && r.settings.tourDeParole !== false && order.length > 1;
      const plan = wantsTurns ? this.computeSpeakingPlan(order.length, duration) : null;

      const dayPayload = (plan && plan.enabled)
        ? { speakOrder: order, speakerIndex: 0, speakerEndsAt: Date.now() + plan.perSpeakerMs, speakerPhase: 'turns', perSpeakerMs: plan.perSpeakerMs }
        : { speakerPhase: 'free' };

      const updates = { status: 'day-discuss', phaseEndsAt: Date.now() + duration * 1000, day: dayPayload };
      if (wantsTurns && plan && !plan.enabled) {
        updates['log/' + Date.now()] = { round: r.round, text: `🎙️ Trop de joueurs pour un tour de parole individuel avec ce temps de débat : direction le débat libre !`, ts: Date.now() };
      }
      await this.ref.update(updates);
    }, 8200);
  },

  // ============ VOTE DE JOUR ============
  async evaluateDayVote(room, forceTimeout = false) {
    const voters = this.votingPlayers(room);
    const votes = (room.day && room.day.votes) || {};
    const allVoted = voters.every(([id]) => votes[id]);
    if (!allVoted && !forceTimeout) return;

    const counts = {};
    voters.forEach(([voterId]) => {
      const targetId = votes[voterId];
      if (!targetId) return;
      const weight = (room.players[voterId] && room.players[voterId].isMayor) ? 2 : 1;
      counts[targetId] = (counts[targetId] || 0) + weight;
    });
    const corbeauTarget = room.night && room.night.corbeauTarget;
    if (corbeauTarget && room.players[corbeauTarget] && room.players[corbeauTarget].alive) {
      counts[corbeauTarget] = (counts[corbeauTarget] || 0) + 2;
    }

    let best = null, bestCount = -1, tie = [];
    Object.entries(counts).forEach(([id, c]) => {
      if (c > bestCount) { best = id; bestCount = c; tie = [id]; }
      else if (c === bestCount) { tie.push(id); }
    });

    let eliminatedId = null;
    if (tie.length > 1) {
      const scapegoat = this.playerByRole(room, 'bouc_emissaire');
      eliminatedId = scapegoat ? scapegoat[0] : null;
    } else {
      eliminatedId = best;
    }

    const updates = {};
    const logLines = [];
    let deaths = new Set();

    if (eliminatedId && room.players[eliminatedId] && room.players[eliminatedId].alive) {
      const p = room.players[eliminatedId];
      if (p.role === 'idiot_village') {
        updates[`players/${eliminatedId}/canVote`] = false;
        updates[`players/${eliminatedId}/revealed`] = true;
        logLines.push(`🤪 Le village a voté pour éliminer ${p.name}... qui était l'Idiot du Village ! Il survit, mais perd son droit de vote.`);
      } else {
        deaths.add(eliminatedId);
        this.applyLoverChain(room, deaths);
        deaths.forEach(id => { updates[`players/${id}/alive`] = false; });
        logLines.push(`☀️ Le village a voté. ${p.name} (${ROLES[p.role].name}) a été éliminé(e).`);
      }
    } else {
      logLines.push(`☀️ Le vote n'a rien donné : personne n'est éliminé aujourd'hui.`);
    }
    updates['log/' + Date.now()] = { round: room.round, text: logLines.join(' '), ts: Date.now() };
    await this.ref.update(updates);

    const fresh = (await this.ref.once('value')).val();
    if (this.checkWin(fresh)) return;
    await this.runSpecials(fresh, Array.from(deaths), 'next-night');
  },

  // ============ DEMARRAGE D'UNE NUIT ============
  async startNight(room, roundNumber) {
    const steps = this.buildNightSteps(room, roundNumber);
    await this.ref.update({
      status: 'night',
      round: roundNumber,
      phaseEndsAt: null,
      night: { steps, stepIndex: 0 },
      day: { votes: null },
      deathsThisRound: null
    });
  },

  // ============ VERIF VICTOIRE ============
  checkWin(room) {
    if (!room) return false;
    const alive = this.alivePlayers(room);

    if (alive.length === 1 && alive[0][1].role === 'loup_blanc') {
      this.endGame(room, 'loup_blanc');
      return true;
    }

    const lovers = room.lovers || [];
    if (lovers.length === 2 && alive.length === 2) {
      const aliveIds = alive.map(([id]) => id);
      if (lovers.every(id => aliveIds.includes(id))) {
        this.endGame(room, 'lovers');
        return true;
      }
    }

    const wolves = alive.filter(([id, p]) => isWolf(p.role));
    const nonWolves = alive.filter(([id, p]) => !isWolf(p.role));

    if (wolves.length === 0) { this.endGame(room, 'village'); return true; }
    if (wolves.length >= nonWolves.length) { this.endGame(room, 'wolves'); return true; }
    return false;
  },

  async endGame(room, winner) {
    await this.ref.update({ status: 'ended', winner, phaseEndsAt: null });
  }
};

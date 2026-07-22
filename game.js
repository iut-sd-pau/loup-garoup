/* ============================================================
   GAME.JS
   Logique cote client : ecrans, actions joueur, rendu temps reel
   Supporte : 1 a 50 joueurs, bots, salles publiques/matchmaking,
   tour de parole au chat, tous les roles etendus.
   ============================================================ */

const AVATARS = ['🧑‍🌾','🧙‍♂️','👩‍🍳','🧔','👵','👴','🧑‍🎨','👩‍🌾','🧑‍🚒','👩‍🏫','🧑‍💼','👨‍🍳','👩‍🎤','🧑‍🎓','🧕','🤠'];
const MIN_PLAYERS = 3;
const MAX_PLAYERS = 50;
const SETTINGS_KEYS = ['voyante','sorciere','chasseur','cupidon','petitefille','salvateur','boucemissaire','maire','idiot_village','ancien','corbeau','renard','voleur','loup_blanc','tourDeParole'];

const State = {
  roomCode: null,
  playerId: null,
  name: null,
  room: null,
  isHost: false,
  roomRef: null,
  selectedTargets: [],
  currentChatChannel: 'village',
  hunterTargetLocal: null,
  _announced: new Set(),
  _publicMirrorRemoved: false
};

function announceOnce(key, fn) {
  if (State._announced.has(key)) return;
  State._announced.add(key);
  fn();
}

function genId() { return 'p_' + Math.random().toString(36).slice(2, 10); }
function genRoomCode() { const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c=''; for(let i=0;i<5;i++) c+=chars[Math.floor(Math.random()*chars.length)]; return c; }
function avatarFor(name) { let h=0; for(let i=0;i<name.length;i++) h=(h*31+name.charCodeAt(i))>>>0; return AVATARS[h % AVATARS.length]; }
function saveSession() { localStorage.setItem('lg_session', JSON.stringify({ roomCode: State.roomCode, playerId: State.playerId, name: State.name })); }
function clearSession() { localStorage.removeItem('lg_session'); }

/* ---------------- INIT ---------------- */
document.addEventListener('DOMContentLoaded', () => {
  Profile.load();
  bindHomeScreen();
  bindLobbyScreen();
  bindRoleReveal();
  bindGameScreen();
  bindEndScreen();
  bindShopScreen();
  tryAutoRejoin();
  loadPublicRooms();
  handleInviteLink();
  renderProfileBar();
  setInterval(updateTimerDisplay, 1000);
  bindGlobalClickSound();
  bindFirstInteractionAudio();
});

// Les navigateurs bloquent tout son tant qu'il n'y a pas eu une vraie
// interaction utilisateur : on lance donc la musique de menu au tout
// premier clic/toucher sur la page, ou qu'il soit.
function bindFirstInteractionAudio() {
  const unlock = () => {
    MusicEngine.start('menu');
    document.removeEventListener('pointerdown', unlock);
    document.removeEventListener('keydown', unlock);
  };
  document.addEventListener('pointerdown', unlock, { once: true });
  document.addEventListener('keydown', unlock, { once: true });
}

// Un leger clic sonore sur chaque bouton de l'interface, sans avoir a
// l'ajouter manuellement partout.
function bindGlobalClickSound() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (btn) SFX.click();
  }, true);
}

function handleInviteLink() {
  const params = new URLSearchParams(window.location.search);
  const join = params.get('join');
  if (join) {
    document.getElementById('input-room-code').value = join.toUpperCase();
    document.getElementById('input-pseudo').focus();
    UI.toast(`Code de partie ${join.toUpperCase()} pré-rempli, entre ton pseudo pour rejoindre !`);
  }
}

function renderProfileBar() {
  const p = Profile.load();
  const el = document.getElementById('profile-coins');
  if (el) el.textContent = `🪙 ${p.coins}`;
}

/* ---------------- BOUTIQUE & PERSONNALISATION ---------------- */
let currentShopCat = 'hat';

function bindShopScreen() {
  document.getElementById('btn-open-shop').addEventListener('click', () => {
    UI.showScreen('screen-shop');
    renderShop();
  });
  document.querySelectorAll('.shop-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentShopCat = tab.dataset.cat;
      renderShop();
    });
  });
}

function renderShop() {
  const p = Profile.load();
  document.getElementById('shop-coins').textContent = `🪙 ${p.coins}`;
  renderAvatarPreview();

  const grid = document.getElementById('shop-items-grid');
  grid.innerHTML = '';

  if (currentShopCat === 'achievements') {
    Object.entries(ACHIEVEMENTS).forEach(([key, ach]) => {
      const unlocked = p.achievements.includes(key);
      const card = document.createElement('div');
      card.className = 'achievement-card' + (unlocked ? ' unlocked' : '');
      card.innerHTML = `<div class="ac-title">${unlocked ? '🏆' : '🔒'} ${escapeHtml(ach.name)}</div>
        <div class="ac-desc">${escapeHtml(ach.desc)}</div>
        <div class="ac-reward">🪙 +${ach.reward}${unlocked ? ' — obtenu !' : ''}</div>`;
      grid.appendChild(card);
    });
    return;
  }

  (SHOP_ITEMS[currentShopCat] || []).forEach(item => {
    const owned = p.owned.includes(item.id);
    const equipped = p.equipped[currentShopCat] === item.id;
    const locked = !!item.achievementLocked && !owned;
    const card = document.createElement('div');
    card.className = 'shop-item' + (item.epic ? ' epic' : '');

    const iconHtml = (currentShopCat === 'hat' || currentShopCat === 'title') ? (item.icon || '🏷️')
      : currentShopCat === 'nameColor' ? `<span class="${item.className}">Aa</span>`
      : '';

    const priceLabel = item.price > 0 ? `🪙 ${item.price}` : (item.achievementLocked ? '🔒 Succès' : 'Gratuit');
    const frameSwatch = currentShopCat === 'frame' ? `<div class="avatar ${item.className}" style="width:34px;height:34px;border-radius:50%;background:#0e1324;margin:0 auto;"></div>` : '';

    card.innerHTML = `
      <div class="si-icon">${frameSwatch || iconHtml}</div>
      <div class="si-name">${escapeHtml(item.name)}</div>
      <div class="si-price">${priceLabel}</div>
    `;

    const btn = document.createElement('button');
    btn.className = 'btn btn-secondary' + (equipped ? ' equipped' : '');
    if (equipped) { btn.textContent = 'Équipé ✔️'; btn.disabled = true; }
    else if (owned) { btn.textContent = 'Équiper'; btn.onclick = () => { Profile.equip(currentShopCat, item.id); renderShop(); applyCosmeticsToRoom(); }; }
    else if (locked) { btn.textContent = 'Succès requis'; btn.disabled = true; }
    else { btn.textContent = 'Acheter'; btn.disabled = p.coins < item.price; btn.onclick = () => { if (Profile.buy(currentShopCat, item.id)) { renderShop(); } else { UI.toast('Pas assez de pièces !'); } }; }
    card.appendChild(btn);
    grid.appendChild(card);
  });
}

function renderAvatarPreview() {
  const cos = Profile.getEquippedCosmetics();
  const circle = document.getElementById('avatar-preview-circle');
  circle.className = 'avatar-preview-circle ' + cos.frameClass;
  document.getElementById('avatar-preview-hat').textContent = cos.hatIcon;
  const pseudo = (document.getElementById('input-pseudo').value.trim()) || 'Toi';
  document.getElementById('avatar-preview-emoji').textContent = avatarFor(pseudo);
  const nameEl = document.getElementById('avatar-preview-name');
  nameEl.textContent = pseudo;
  nameEl.className = 'avatar-preview-name ' + cos.nameColorClass;
  document.getElementById('avatar-preview-title').textContent = cos.titleLabel;
}

// Si on est deja dans une salle (lobby), repercute le changement de cosmetiques en direct
function applyCosmeticsToRoom() {
  if (!State.roomCode || !State.playerId) return;
  db.ref(`rooms/${State.roomCode}/players/${State.playerId}/cosmetics`).set(Profile.getEquippedCosmetics());
}

function tryAutoRejoin() {
  const raw = localStorage.getItem('lg_session');
  if (!raw) return;
  try {
    const s = JSON.parse(raw);
    if (!s.roomCode || !s.playerId) return;
    db.ref(`rooms/${s.roomCode}/players/${s.playerId}`).once('value').then(snap => {
      if (snap.exists()) {
        State.roomCode = s.roomCode; State.playerId = s.playerId; State.name = s.name;
        subscribeRoom();
        UI.toast('Reconnecté à la partie en cours');
      } else {
        clearSession();
      }
    }).catch(() => clearSession());
  } catch (e) { clearSession(); }
}

/* ---------------- ECRAN ACCUEIL ---------------- */
function bindHomeScreen() {
  document.getElementById('btn-how-to-play').addEventListener('click', () => UI.showScreen('screen-rules'));

  document.getElementById('btn-create-room').addEventListener('click', async () => {
    const name = document.getElementById('input-pseudo').value.trim();
    if (!validateName(name)) return;
    const isPublic = document.getElementById('input-public-room').checked;
    const code = genRoomCode();
    const playerId = genId();
    State.roomCode = code; State.playerId = playerId; State.name = name; State.isHost = true;

    await db.ref(`rooms/${code}`).set({
      host: playerId,
      createdAt: Date.now(),
      status: 'lobby',
      round: 0,
      isPublic: !!isPublic,
      settings: { voyante: true, sorciere: true, chasseur: true, cupidon: true, petitefille: true, salvateur: false, boucemissaire: false, maire: false, idiot_village: false, ancien: false, corbeau: false, renard: false, voleur: false, loup_blanc: false, tourDeParole: true, dayDuration: 120 },
      players: { [playerId]: { name, alive: true, isHost: true, role: null, joinedAt: Date.now(), cosmetics: Profile.getEquippedCosmetics() } }
    });

    if (isPublic) {
      await db.ref(`publicRooms/${code}`).set({ code, hostName: name, playerCount: 1, maxPlayers: MAX_PLAYERS, createdAt: Date.now() });
    }

    saveSession();
    subscribeRoom();
  });

  document.getElementById('btn-join-room').addEventListener('click', async () => {
    const name = document.getElementById('input-pseudo').value.trim();
    const code = document.getElementById('input-room-code').value.trim().toUpperCase();
    if (!validateName(name)) return;
    if (!code) { showHomeError('Entre un code de partie.'); return; }
    await attemptJoinRoom(code, name);
  });

  document.getElementById('input-room-code').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase(); });

  document.getElementById('btn-refresh-public').addEventListener('click', loadPublicRooms);

  document.getElementById('btn-quick-match').addEventListener('click', async () => {
    const name = document.getElementById('input-pseudo').value.trim();
    if (!validateName(name)) return;
    const snap = await db.ref('publicRooms').limitToLast(30).once('value');
    const rooms = [];
    snap.forEach(child => { const v = child.val(); if (v && v.playerCount < (v.maxPlayers || MAX_PLAYERS)) rooms.push(v); });
    if (rooms.length === 0) { showHomeError("Aucune partie publique disponible pour l'instant. Crée la tienne !"); return; }
    const pick = rooms[Math.floor(Math.random() * rooms.length)];
    await attemptJoinRoom(pick.code, name);
  });
}

async function attemptJoinRoom(code, name) {
  const snap = await db.ref(`rooms/${code}`).once('value');
  const room = snap.val();
  if (!room) { showHomeError("Cette partie n'existe pas."); return; }
  if (room.status !== 'lobby') { showHomeError('Cette partie a déjà commencé.'); return; }
  const count = room.players ? Object.keys(room.players).length : 0;
  if (count >= MAX_PLAYERS) { showHomeError(`Salle pleine (${MAX_PLAYERS} max).`); return; }

  const playerId = genId();
  State.roomCode = code; State.playerId = playerId; State.name = name; State.isHost = false;
  await db.ref(`rooms/${code}/players/${playerId}`).set({ name, alive: true, isHost: false, role: null, joinedAt: Date.now(), cosmetics: Profile.getEquippedCosmetics() });
  saveSession();
  subscribeRoom();
}

function validateName(name) {
  if (!name || name.length < 2) { showHomeError('Choisis un pseudo (2 caractères min).'); return false; }
  document.getElementById('home-error').textContent = '';
  return true;
}
function showHomeError(msg) { document.getElementById('home-error').textContent = msg; }

async function loadPublicRooms() {
  const list = document.getElementById('public-rooms-list');
  if (!list) return;
  try {
    const snap = await db.ref('publicRooms').limitToLast(30).once('value');
    const rooms = [];
    snap.forEach(child => rooms.push(child.val()));
    rooms.sort((a, b) => b.createdAt - a.createdAt);
    if (rooms.length === 0) {
      list.innerHTML = '<li class="public-room-empty">Aucune partie publique pour l\'instant.</li>';
      return;
    }
    list.innerHTML = '';
    rooms.forEach(r => {
      const li = document.createElement('li');
      li.className = 'public-room-row';
      li.innerHTML = `<div class="prr-info"><strong>${escapeHtml(r.code)}</strong><span class="prr-count">${r.playerCount || 0} joueur(s) — hôte : ${escapeHtml(r.hostName || '?')}</span></div>`;
      const btn = document.createElement('button');
      btn.className = 'mini-btn';
      btn.textContent = 'Rejoindre';
      btn.onclick = async () => {
        const name = document.getElementById('input-pseudo').value.trim();
        if (!validateName(name)) return;
        await attemptJoinRoom(r.code, name);
      };
      li.appendChild(btn);
      list.appendChild(li);
    });
  } catch (e) {
    list.innerHTML = '<li class="public-room-empty">Impossible de charger les parties publiques.</li>';
  }
}

/* ---------------- SUBSCRIPTION SALLE ---------------- */
function subscribeRoom() {
  State.roomRef = db.ref(`rooms/${State.roomCode}`);
  State.roomRef.on('value', snap => {
    const room = snap.val();
    if (!room) { UI.toast('La partie a été fermée.'); backToHome(); return; }
    const prevStatus = State.room ? State.room.status : null;
    State.room = room;
    State.isHost = room.host === State.playerId;

    if (State.isHost && HostEngine.roomCode !== State.roomCode) {
      HostEngine.start(State.roomCode);
      BotController.start(State.roomCode);
    }
    if (State.isHost && room.isPublic) syncPublicMirror(room);

    render(room, prevStatus);
  });

  db.ref(`rooms/${State.roomCode}/chat`).limitToLast(100).on('child_added', snap => {
    renderChatMessage(snap.key, snap.val());
  });

  bindReactionsListener();
}

async function syncPublicMirror(room) {
  if (room.status === 'lobby') {
    const count = room.players ? Object.keys(room.players).length : 0;
    db.ref(`publicRooms/${State.roomCode}/playerCount`).set(count);
  } else if (!State._publicMirrorRemoved) {
    State._publicMirrorRemoved = true;
    db.ref(`publicRooms/${State.roomCode}`).remove();
  }
}

/* ---------------- RENDER PRINCIPAL ---------------- */
function render(room, prevStatus) {
  if (room.status === 'lobby') {
    UI.showScreen('screen-lobby');
    renderLobby(room);
    return;
  }

  handlePhaseTransitionFx(room, prevStatus);

  if (room.status === 'ended') {
    if (prevStatus !== 'ended') {
      MusicEngine.stop();
      SFX.victoryFanfare(room.winner);
      Narrator.say(endNarration(room.winner), { interrupt: true });
      if (room.winner !== 'wolves') launchConfetti();
      setTimeout(() => MusicEngine.start('menu'), 3000);

      const me = room.players[State.playerId];
      if (me && !me.isBot) {
        const won = computeWinForPlayer(room, State.playerId);
        const survived = !!me.alive;
        State._lastReward = Profile.applyGameResult({ won, survived });
        renderProfileBar();
      } else {
        State._lastReward = null;
      }
    }
    renderEnd(room);
    UI.showScreen('screen-end');
    return;
  }

  const seenKey = `lg_seen_role_${State.roomCode}`;
  const myRole = room.players[State.playerId] && room.players[State.playerId].role;
  if (myRole && !localStorage.getItem(seenKey) && document.getElementById('screen-game').classList.contains('active') === false && document.getElementById('screen-role-reveal').classList.contains('active') === false) {
    showRoleReveal(room, myRole);
    localStorage.setItem(seenKey, '1');
    return;
  }
  if (myRole && document.getElementById('screen-role-reveal').classList.contains('active')) {
    return;
  }

  UI.showScreen('screen-game');
  renderGameScreen(room);
}

/* ---------------- EFFETS DE TRANSITION (son / narrateur / decor) ---------------- */
function handlePhaseTransitionFx(room, prevStatus) {
  const nightLike = room.status === 'night';
  document.body.classList.toggle('phase-night', nightLike);
  document.body.classList.toggle('phase-day', !nightLike && room.status !== 'lobby');

  if (room.status === prevStatus) return;

  SFX.click();

  if (room.status === 'night') {
    MusicEngine.switchTheme('night');
    SFX.whoosh();
    if (room.round === 1) Narrator.say("La nuit tombe sur le village pour la première fois. Que le sort des habitants soit scellé dans l'ombre.", { interrupt: true });
    else Narrator.say(`La nuit ${room.round} enveloppe le village...`, { interrupt: true });
  } else if (room.status === 'day-reveal') {
    MusicEngine.switchTheme('day');
    const deaths = room.deathsThisRound || [];
    SFX.bellToll();
    if (deaths.length) setTimeout(() => SFX.death(), 300);
    const names = deaths.map(id => room.players[id] ? room.players[id].name : '').filter(Boolean);
    const text = names.length ? `Le village se réveille... et découvre avec effroi que ${names.join(' et ')} ${names.length > 1 ? 'ont' : 'a'} péri cette nuit.` : "Le village se réveille... et par miracle, personne n'est mort cette nuit !";
    Narrator.say(text, { interrupt: true });
  } else if (room.status === 'day-discuss') {
    Narrator.say("À vous de débattre. Qui, parmi vous, cache un loup ?", { interrupt: true });
  } else if (room.status === 'day-vote') {
    SFX.drumroll();
    setTimeout(() => SFX.gavel(), 900);
    Narrator.say("L'heure du vote a sonné. Désignez le village.", { interrupt: true });
  } else if (room.status === 'hunter') {
    SFX.death();
    Narrator.say("Le Chasseur, dans son dernier souffle, arme son arc...", { interrupt: true });
  } else if (room.status === 'mayor-candidacy') {
    SFX.magicSparkle();
    Narrator.say("Qui souhaite se présenter au poste de Maire ?", { interrupt: true });
  } else if (room.status === 'mayor-speeches') {
    SFX.click();
    const speaker = room.mayorSpeech && room.players[room.mayorSpeech.order[room.mayorSpeech.index]];
    Narrator.say(speaker ? `${speaker.name} prend la parole pour convaincre le village.` : "Les candidats prennent la parole.", { interrupt: true });
  } else if (room.status === 'mayor-election') {
    SFX.drumroll();
    Narrator.say("Le village doit désormais élire son Maire.", { interrupt: true });
  } else if (room.status === 'mayor-succession') {
    Narrator.say("Le Maire, avant de mourir, désigne son successeur.", { interrupt: true });
  }
}

function computeWinForPlayer(room, playerId) {
  const p = room.players && room.players[playerId];
  if (!p) return false;
  const winner = room.winner;
  if (winner === 'lovers') return (room.lovers || []).includes(playerId);
  if (winner === 'loup_blanc') return p.role === 'loup_blanc';
  if (winner === 'wolves') return isWolf(p.role);
  if (winner === 'village') return !isWolf(p.role) && p.role !== 'loup_blanc';
  return false;
}

function endNarration(winner) {
  if (winner === 'wolves') return "Les hurlements résonnent dans la nuit. Les loups-garous ont dévoré le village tout entier. La partie est terminée.";
  if (winner === 'lovers') return "Contre toute attente, les amoureux ont survécu à tous les autres. L'amour l'emporte sur la guerre. La partie est terminée.";
  if (winner === 'loup_blanc') return "Le Loup Blanc a éliminé tout le monde, amis comme ennemis. Il gagne seul, dans un silence glaçant. La partie est terminée.";
  return "Le dernier loup-garou vient de tomber. Le village est sauvé. La partie est terminée.";
}

function launchConfetti() {
  const container = document.getElementById('confetti-container');
  if (!container) return;
  const colors = ['#e0a24b', '#c8402b', '#4caf7d', '#4a90a4', '#d9578f', '#f4e3b2'];
  for (let i = 0; i < 90; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = (2.2 + Math.random() * 2.2) + 's';
    piece.style.animationDelay = (Math.random() * 0.6) + 's';
    container.appendChild(piece);
    setTimeout(() => piece.remove(), 5200);
  }
}

/* ---------------- LOBBY ---------------- */
function bindLobbyScreen() {
  document.getElementById('btn-copy-code').addEventListener('click', () => {
    navigator.clipboard.writeText(State.roomCode).then(() => UI.toast('Code copié !'));
  });
  document.getElementById('btn-copy-link').addEventListener('click', () => {
    const url = `${window.location.origin}${window.location.pathname}?join=${State.roomCode}`;
    navigator.clipboard.writeText(url).then(() => UI.toast('Lien d\'invitation copié !'));
  });
  document.getElementById('btn-leave-room').addEventListener('click', leaveRoom);

  SETTINGS_KEYS.forEach(key => {
    const el = document.getElementById(`role-toggle-${key}`);
    if (!el) return;
    el.addEventListener('change', () => {
      if (!State.isHost) return;
      db.ref(`rooms/${State.roomCode}/settings/${key}`).set(el.checked);
    });
  });
  document.getElementById('day-duration-select').addEventListener('change', e => {
    if (!State.isHost) return;
    db.ref(`rooms/${State.roomCode}/settings/dayDuration`).set(parseInt(e.target.value));
  });

  document.getElementById('btn-start-game').addEventListener('click', startGame);

  document.getElementById('btn-add-bot').addEventListener('click', () => addBots(1));
  document.getElementById('btn-remove-bot').addEventListener('click', removeBot);
  document.getElementById('btn-fill-bots').addEventListener('click', () => {
    const target = parseInt(document.getElementById('input-fill-total').value, 10) || 0;
    const current = Object.keys((State.room && State.room.players) || {}).length;
    if (target > current) addBots(Math.min(target - current, MAX_PLAYERS - current));
  });
}

function addBots(n) {
  if (!State.isHost || !State.room) return;
  const existingNames = new Set(Object.values(State.room.players || {}).map(p => p.name));
  const updates = {};
  let added = 0;
  const currentCount = Object.keys(State.room.players || {}).length;
  for (let i = 0; i < BOT_NAMES.length && added < n && (currentCount + added) < MAX_PLAYERS; i++) {
    const candidate = BOT_NAMES[i];
    if (existingNames.has(candidate)) continue;
    const id = genId();
    updates[`players/${id}`] = { name: candidate, alive: true, isHost: false, role: null, joinedAt: Date.now(), isBot: true };
    existingNames.add(candidate);
    added++;
  }
  let extra = 1;
  while (added < n && (currentCount + added) < MAX_PLAYERS) {
    const candidate = `Bot ${currentCount + added + extra}`;
    if (existingNames.has(candidate)) { extra++; continue; }
    const id = genId();
    updates[`players/${id}`] = { name: candidate, alive: true, isHost: false, role: null, joinedAt: Date.now(), isBot: true };
    existingNames.add(candidate);
    added++;
  }
  if (Object.keys(updates).length) db.ref(`rooms/${State.roomCode}`).update(updates);
}

function removeBot() {
  if (!State.isHost || !State.room) return;
  const bots = Object.entries(State.room.players || {}).filter(([id, p]) => p.isBot);
  if (bots.length === 0) return;
  bots.sort((a, b) => b[1].joinedAt - a[1].joinedAt);
  db.ref(`rooms/${State.roomCode}/players/${bots[0][0]}`).remove();
}

function renderLobby(room) {
  document.getElementById('lobby-room-code').textContent = State.roomCode;
  const players = Object.entries(room.players || {});
  document.getElementById('lobby-player-count').textContent = players.length;

  const list = document.getElementById('lobby-player-list');
  list.innerHTML = '';
  players.sort((a, b) => (a[1].joinedAt || 0) - (b[1].joinedAt || 0)).forEach(([id, p]) => {
    const li = document.createElement('li');
    if (p.isBot) li.classList.add('bot-row');
    const cos = p.cosmetics || {};
    const nameSpan = `<span class="${cos.nameColorClass || ''}">${escapeHtml(p.name)}</span>`;
    const titleSpan = cos.titleLabel ? `<div class="player-title-badge">${escapeHtml(cos.titleLabel)}</div>` : '';
    li.innerHTML = `<span>${cos.hatIcon ? cos.hatIcon + ' ' : ''}${avatarFor(p.name)} ${nameSpan}${titleSpan}</span>${p.isHost ? '<span class="host-tag">HÔTE</span>' : ''}${p.isBot ? '<span class="bot-tag">BOT</span>' : ''}`;
    if (State.isHost && id !== State.playerId) {
      const kickBtn = document.createElement('button');
      kickBtn.className = 'mini-btn danger';
      kickBtn.textContent = '✕';
      kickBtn.title = 'Exclure ce joueur';
      kickBtn.onclick = () => db.ref(`rooms/${State.roomCode}/players/${id}`).remove();
      li.appendChild(kickBtn);
    }
    list.appendChild(li);
  });

  const settingsPanel = document.getElementById('lobby-settings-host');
  const startBtn = document.getElementById('btn-start-game');
  const waitingMsg = document.getElementById('lobby-waiting');
  const botControls = document.getElementById('bot-controls');

  if (State.isHost) {
    settingsPanel.style.display = '';
    startBtn.style.display = '';
    waitingMsg.style.display = 'none';
    botControls.style.display = '';
    const s = room.settings || {};
    SETTINGS_KEYS.forEach(key => {
      const el = document.getElementById(`role-toggle-${key}`);
      if (el) el.checked = !!s[key];
    });
    document.getElementById('day-duration-select').value = String(s.dayDuration || 120);

    const deck = buildRoleDeck(Math.max(players.length, 1), s);
    const wolfCount = deck.filter(isWolfSide).length;
    const specialKeys = ['voyante','sorciere','chasseur','cupidon','petitefille','salvateur','boucemissaire','idiot_village','ancien','corbeau','renard'];
    const specialsWanted = specialKeys.filter(k => s[k]).length;
    const remainingSlots = Math.max(0, deck.length - wolfCount);
    let hint = `${players.length} joueur(s) → ${wolfCount} loup(s) au total, ${deck.length - wolfCount} autre(s) rôle(s)${s.voleur ? ' (dont 2 cartes non distribuées pour le Voleur)' : ''}.`;
    if (specialsWanted > remainingSlots) {
      hint += ` ⚠️ Tu as coché ${specialsWanted} rôles spéciaux mais il n'y a de la place que pour ${remainingSlots} avec ce nombre de joueurs : certains ne seront pas inclus (tirés au sort). Ajoute des joueurs/bots pour tous les avoir.`;
    }
    if (s.loup_blanc && players.length < 7) {
      hint += ` ⚠️ Le Loup Blanc nécessite au moins 7 joueurs pour être inclus (actuellement ${players.length}).`;
    }
    document.getElementById('role-count-hint').textContent = hint;

    startBtn.disabled = players.length < MIN_PLAYERS;
    startBtn.textContent = players.length < MIN_PLAYERS ? `Lancer la partie (${players.length}/${MIN_PLAYERS} min.)` : 'Lancer la partie';
  } else {
    settingsPanel.style.display = 'none';
    startBtn.style.display = 'none';
    waitingMsg.style.display = '';
    botControls.style.display = 'none';
  }
}

async function startGame() {
  if (!State.isHost) return;
  const room = State.room;
  const players = Object.entries(room.players || {});
  if (players.length < MIN_PLAYERS) return;

  const settings = room.settings || {};
  const fullDeck = buildRoleDeck(players.length, settings);
  const playerRoles = fullDeck.slice(0, players.length);
  const extraCards = fullDeck.slice(players.length);

  const updates = {};
  players.forEach(([id], i) => { updates[`players/${id}/role`] = playerRoles[i]; });
  updates['status'] = 'starting';
  updates['lovers'] = null;
  updates['extraCards'] = extraCards.length ? extraCards : null;
  await db.ref(`rooms/${State.roomCode}`).update(updates);

  if (room.isPublic) db.ref(`publicRooms/${State.roomCode}`).remove();

  const fresh = (await db.ref(`rooms/${State.roomCode}`).once('value')).val();
  if (settings.maire) {
    await HostEngine.startMayorCandidacy(fresh);
  } else {
    await HostEngine.startNight(fresh, 1);
  }
}

function leaveRoom() {
  if (State.roomRef && State.playerId) {
    db.ref(`rooms/${State.roomCode}/players/${State.playerId}`).remove();
  }
  if (State.isHost) db.ref(`publicRooms/${State.roomCode}`).remove();
  backToHome();
}

function backToHome() {
  if (State.roomRef) State.roomRef.off();
  db.ref(`rooms/${State.roomCode}/chat`).off();
  db.ref(`rooms/${State.roomCode}/reactions`).off();
  MusicEngine.switchTheme('menu');
  document.body.classList.remove('phase-night', 'phase-day');
  HostEngine.stop();
  BotController.stop();
  clearSession();
  State.roomCode = null; State.playerId = null; State.room = null; State._publicMirrorRemoved = false;
  UI.showScreen('screen-home');
  loadPublicRooms();
}

/* ---------------- ROLE REVEAL ---------------- */
function bindRoleReveal() {
  document.getElementById('btn-role-continue').addEventListener('click', () => {
    UI.showScreen('screen-game');
    renderGameScreen(State.room);
  });
}

function showRoleReveal(room, roleId) {
  const role = ROLES[roleId];
  document.getElementById('role-icon').textContent = role.icon;
  document.getElementById('role-name').textContent = role.name;
  document.getElementById('role-desc').textContent = role.desc;
  const tag = document.getElementById('role-team-tag');
  tag.className = 'team-tag ' + (role.team === TEAM.WOLF ? 'wolf' : role.team === TEAM.SOLO ? 'solo' : 'village');
  tag.textContent = role.team === TEAM.WOLF ? 'Camp des Loups' : role.team === TEAM.SOLO ? 'Camp solo' : 'Camp du Village';

  const loversInfo = document.getElementById('lovers-info');
  loversInfo.classList.add('hidden');

  if (roleId === 'loup_garou') {
    const others = Object.entries(room.players).filter(([id, p]) => id !== State.playerId && p.role === 'loup_garou');
    if (others.length) {
      loversInfo.classList.remove('hidden');
      loversInfo.innerHTML = `🐺 Tes complices : <strong>${others.map(([id,p]) => escapeHtml(p.name)).join(', ')}</strong>`;
    }
  } else if (roleId === 'loup_blanc') {
    const wolves = Object.entries(room.players).filter(([id, p]) => p.role === 'loup_garou');
    if (wolves.length) {
      loversInfo.classList.remove('hidden');
      loversInfo.innerHTML = `🐺❄️ Tu connais les Loups-Garous, mais eux ne te connaissent pas : <strong>${wolves.map(([id,p]) => escapeHtml(p.name)).join(', ')}</strong>`;
    }
  }

  UI.showScreen('screen-role-reveal');
}

/* ---------------- ECRAN DE JEU ---------------- */
function bindGameScreen() {
  document.getElementById('event-log-toggle').addEventListener('click', () => {
    document.getElementById('event-log').classList.toggle('hidden');
  });
  document.querySelectorAll('.chat-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.chat-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      State.currentChatChannel = tab.dataset.channel;
      renderChatHistory();
      updateChatInputState();
    });
  });
  document.getElementById('btn-chat-send').addEventListener('click', sendChat);
  document.getElementById('chat-input').addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });

  const narratorBtn = document.getElementById('btn-toggle-narrator');
  const sfxBtn = document.getElementById('btn-toggle-sfx');
  narratorBtn.classList.toggle('muted', !Narrator.enabled);
  sfxBtn.classList.toggle('muted', !SFX.enabled);
  narratorBtn.addEventListener('click', () => narratorBtn.classList.toggle('muted', !Narrator.toggle()));
  sfxBtn.addEventListener('click', () => sfxBtn.classList.toggle('muted', !SFX.toggle()));

  const volumeSlider = document.getElementById('sfx-volume');
  volumeSlider.value = String(Math.round((SFX.volume === undefined ? 0.35 : SFX.volume) * 100));
  volumeSlider.addEventListener('input', () => SFX.setVolume(volumeSlider.value / 100));

  document.querySelectorAll('#reaction-bar button').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!State.room || !State.playerId) return;
      const me = State.room.players[State.playerId];
      db.ref(`rooms/${State.roomCode}/reactions`).push({ pid: State.playerId, name: me ? me.name : '?', emoji: btn.dataset.emoji, ts: Date.now() });
    });
  });

  document.getElementById('btn-skip-turn').addEventListener('click', () => {
    if (!State.room || !State.playerId) return;
    db.ref(`rooms/${State.roomCode}/day/skipRequested`).set(State.playerId);
  });

  document.getElementById('btn-role-reminder').addEventListener('click', () => {
    if (!State.room || !State.playerId) return;
    const me = State.room.players[State.playerId];
    if (me && me.role) showRoleReveal(State.room, me.role);
  });
}

function bindReactionsListener() {
  db.ref(`rooms/${State.roomCode}/reactions`).limitToLast(1).on('child_added', snap => {
    const r = snap.val();
    if (!r || Date.now() - r.ts > 5000) return;
    flyReaction(r.emoji);
  });
}

function flyReaction(emoji) {
  const zone = document.getElementById('reaction-fly-zone');
  if (!zone) return;
  const el = document.createElement('div');
  el.className = 'flying-emoji';
  el.textContent = emoji;
  el.style.left = (10 + Math.random() * 80) + '%';
  el.style.bottom = '0px';
  zone.appendChild(el);
  setTimeout(() => el.remove(), 2300);
}

/* ---------------- TOUR DE PAROLE ---------------- */
function isMySpeakingTurn(room) {
  if (!room) return true;
  if (room.status === 'mayor-speeches') {
    const speech = room.mayorSpeech || {};
    const order = speech.order || [];
    return order[speech.index || 0] === State.playerId;
  }
  if (room.status !== 'day-discuss') return true;
  const day = room.day || {};
  if (!day.speakOrder || day.speakerPhase === 'free') return true;
  return day.speakOrder[day.speakerIndex] === State.playerId;
}

function renderSpeakerIndicator(room) {
  const el = document.getElementById('speaker-indicator');
  const textEl = document.getElementById('speaker-indicator-text');
  const skipBtn = document.getElementById('btn-skip-turn');
  const upnext = document.getElementById('speaker-upnext');
  if (!el) return;

  if (room.status !== 'day-discuss' || !room.day || !room.day.speakOrder || room.day.speakerPhase === 'free') {
    el.classList.add('hidden');
    upnext.classList.add('hidden');
    return;
  }
  const order = room.day.speakOrder;
  const idx = room.day.speakerIndex;
  const speakerId = order[idx];
  const speaker = room.players[speakerId];
  el.classList.remove('hidden');
  if (speakerId === State.playerId) {
    textEl.textContent = '🎙️ C\'est ton tour de parler !';
    el.classList.add('my-turn');
    skipBtn.classList.remove('hidden');
  } else {
    textEl.textContent = `🎙️ ${speaker ? speaker.name : '???'} a la parole...`;
    el.classList.remove('my-turn');
    skipBtn.classList.add('hidden');
  }

  const upcoming = order.slice(idx + 1, idx + 4).map(id => room.players[id] ? room.players[id].name : '?');
  if (upcoming.length) {
    upnext.classList.remove('hidden');
    upnext.textContent = `À suivre : ${upcoming.join(', ')}${order.length - idx - 1 > 3 ? '...' : ''}`;
  } else {
    upnext.classList.add('hidden');
  }
}

function updateChatInputState() {
  const input = document.getElementById('chat-input');
  const row = document.querySelector('.chat-input-row');
  if (!input || !State.room) return;
  const me = State.room.players[State.playerId];
  let locked = false;
  if (State.currentChatChannel === 'village') {
    locked = !me || !me.alive || !isMySpeakingTurn(State.room);
  } else if (State.currentChatChannel === 'wolves') {
    locked = !me || !me.alive || !isWolfSide(me.role);
  } else if (State.currentChatChannel === 'dead') {
    locked = !me || me.alive;
  }
  input.disabled = locked;
  row.classList.toggle('locked', locked);
}

function sendChat() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text || input.disabled) return;
  const me = State.room.players[State.playerId];
  const channel = State.currentChatChannel;
  if (channel === 'wolves' && !isWolfSide(me.role)) return;
  if (channel === 'village' && (!me.alive || !isMySpeakingTurn(State.room))) return;
  db.ref(`rooms/${State.roomCode}/chat`).push({
    pid: State.playerId, name: me.name, text: text.slice(0, 200), channel, ts: Date.now()
  });
  input.value = '';
}

let chatCache = [];
function renderChatMessage(key, msg) {
  chatCache.push({ key, ...msg });
  if (msg.channel === State.currentChatChannel) appendChatDom(msg);
}
function renderChatHistory() {
  const box = document.getElementById('chat-messages');
  box.innerHTML = '';
  chatCache.filter(m => m.channel === State.currentChatChannel).forEach(appendChatDom);
}
function appendChatDom(msg) {
  const box = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-msg';
  const senderP = State.room && State.room.players && State.room.players[msg.pid];
  const nameColorClass = senderP && senderP.cosmetics ? (senderP.cosmetics.nameColorClass || '') : '';
  div.innerHTML = `<span class="author ${nameColorClass}">${escapeHtml(msg.name)} :</span> ${escapeHtml(msg.text)}`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function updateTimerDisplay() {
  const el = document.getElementById('hud-timer');
  if (!el) return;
  if (!State.room) { el.textContent = ''; el.classList.remove('low'); return; }
  if (!State.room.phaseEndsAt) {
    const unlimitedStatuses = ['night', 'hunter', 'mayor-succession'];
    el.textContent = unlimitedStatuses.includes(State.room.status) ? '⏳ Prenez votre temps' : '';
    el.classList.remove('low');
    return;
  }
  const remaining = Math.max(0, Math.round((State.room.phaseEndsAt - Date.now()) / 1000));
  el.textContent = UI.formatTime(remaining);
  el.classList.toggle('low', remaining <= 15 && remaining > 0);
}

function renderGameScreen(room) {
  const me = room.players[State.playerId];
  if (!me) return;
  const myRole = ROLES[me.role] || {};

  document.getElementById('hud-role-icon').textContent = myRole.icon || '❓';
  document.getElementById('hud-role-name').textContent = myRole.name || '???';
  const aliveBadge = document.getElementById('hud-alive-status');
  aliveBadge.textContent = me.alive ? 'Vivant' : 'Mort';
  aliveBadge.className = 'alive-badge' + (me.alive ? '' : ' dead');

  document.getElementById('tab-wolves').classList.toggle('hidden', !isWolfSide(me.role));
  document.getElementById('tab-dead').classList.toggle('hidden', me.alive);

  renderEventLog(room);
  renderPhaseHud(room);
  renderSpeakerIndicator(room);
  renderNarrationAndActions(room, me);
  renderActionProgressBar(room);
  renderHostControls(room);
  renderPlayersGrid(room, me);
  updateChatInputState();
}

function renderEventLog(room) {
  const log = Object.values(room.log || {}).sort((a,b) => a.ts - b.ts);
  const el = document.getElementById('event-log');
  el.innerHTML = log.map(l => `<p>${escapeHtml(l.text)}</p>`).join('') || '<p>Rien à signaler pour l\'instant.</p>';
}

function renderPhaseHud(room) {
  const icon = document.getElementById('hud-phase-icon');
  const title = document.getElementById('hud-phase-title');
  const map = {
    'night': ['🌙', `Nuit ${room.round}`],
    'day-reveal': ['🌅', `Réveil du village`],
    'day-discuss': ['☀️', `Débat — Jour ${room.round}`],
    'day-vote': ['🗳️', `Vote — Jour ${room.round}`],
    'hunter': ['🏹', `Le Chasseur tire`],
    'mayor-candidacy': ['🗳️', `Candidature au poste de Maire`],
    'mayor-speeches': ['🎤', `Discours des candidats`],
    'mayor-election': ['👑', `Élection du Maire`],
    'mayor-succession': ['👑', `Succession du Maire`],
    'starting': ['🎬', `La partie démarre...`]
  };
  const [i, t] = map[room.status] || ['🐺', room.status];
  icon.textContent = i; title.textContent = t;
}

function renderNarrationAndActions(room, me) {
  const narrationBox = document.getElementById('narration-box');
  const actionZone = document.getElementById('action-zone');
  actionZone.innerHTML = '';
  State.selectedTargets = [];
  State._pickerConfirmBtn = null;
  State._pickerMax = 0;
  State._allowSelf = false;

  const alivePlayers = Object.entries(room.players).filter(([id,p]) => p.alive);
  const targetableOthers = alivePlayers.filter(([id]) => id !== State.playerId);

  if (room.status === 'starting') {
    narrationBox.textContent = "Distribution des rôles en cours...";
    return;
  }

  if (room.status === 'mayor-candidacy') {
    if (me.alive) {
      const myResponse = room.candidacyResponses && room.candidacyResponses[State.playerId];
      const candidatesSoFar = Object.entries(room.players).filter(([id,p]) => room.mayorCandidates && room.mayorCandidates[id]).map(([id,p]) => p.name);
      narrationBox.textContent = "🗳️ Le village va élire un Maire, dont le vote comptera double. Veux-tu te présenter ? Ce n'est pas obligatoire !";
      if (candidatesSoFar.length) {
        const note = document.createElement('p');
        note.className = 'action-hint';
        note.textContent = `Se sont déjà présenté(e)s : ${candidatesSoFar.join(', ')}`;
        actionZone.appendChild(note);
      }
      if (myResponse === undefined) {
        const yesBtn = document.createElement('button');
        yesBtn.className = 'btn btn-primary';
        yesBtn.textContent = '🎗️ Je me présente !';
        yesBtn.onclick = async () => {
          await db.ref(`rooms/${State.roomCode}`).update({ [`mayorCandidates/${State.playerId}`]: true, [`candidacyResponses/${State.playerId}`]: true });
        };
        actionZone.appendChild(yesBtn);
        const noBtn = document.createElement('button');
        noBtn.className = 'btn btn-secondary';
        noBtn.textContent = 'Non merci';
        noBtn.onclick = async () => {
          await db.ref(`rooms/${State.roomCode}`).update({ [`mayorCandidates/${State.playerId}`]: false, [`candidacyResponses/${State.playerId}`]: true });
        };
        actionZone.appendChild(noBtn);
      } else {
        const doneP = document.createElement('p');
        doneP.className = 'action-hint';
        doneP.textContent = myResponse ? '✅ Tu es candidat(e) ! En attente des autres...' : '✅ Choix envoyé. En attente des autres...';
        actionZone.appendChild(doneP);
      }
    } else {
      narrationBox.textContent = "🗳️ Le village décide qui se présentera au poste de Maire...";
    }
    return;
  }

  if (room.status === 'mayor-speeches') {
    const speech = room.mayorSpeech || {};
    const order = speech.order || [];
    const speakerId = order[speech.index || 0];
    const speaker = room.players[speakerId];
    if (State.playerId === speakerId) {
      narrationBox.textContent = "🎤 C'est ton tour ! Utilise le chat du village pour convaincre tout le monde de voter pour toi.";
      const doneBtn = document.createElement('button');
      doneBtn.className = 'btn btn-primary';
      doneBtn.textContent = "J'ai fini mon discours";
      doneBtn.onclick = async () => { await db.ref(`rooms/${State.roomCode}/mayorSpeech/skipRequested`).set(State.playerId); };
      actionZone.appendChild(doneBtn);
    } else {
      narrationBox.textContent = `🎤 ${speaker ? speaker.name : '???'} a la parole pour convaincre le village. Regarde le chat !`;
    }
    const upcoming = order.slice((speech.index || 0) + 1).map(id => room.players[id] ? room.players[id].name : '?');
    if (upcoming.length) {
      const upNext = document.createElement('p');
      upNext.className = 'action-hint';
      upNext.textContent = `À suivre : ${upcoming.join(', ')}`;
      actionZone.appendChild(upNext);
    }
    return;
  }

  if (room.status === 'mayor-election') {
    if (me.alive) {
      const myVote = room.mayorVotes && room.mayorVotes[State.playerId];
      const pool = (room.mayorPool || []).map(id => [id, room.players[id]]).filter(([id,p]) => p);
      narrationBox.textContent = "👑 Le village doit élire son Maire, dont le vote comptera double lors des votes du jour. Qui proposez-vous ?";
      renderPickerAction(actionZone, pool, 1, async (ids) => {
        await db.ref(`rooms/${State.roomCode}/mayorVotes/${State.playerId}`).set(ids[0]);
      }, myVote, true);
    } else {
      narrationBox.textContent = "👑 Le village élit son Maire...";
    }
    return;
  }

  if (room.status === 'mayor-succession') {
    if (State.playerId === room.mayorSuccession.formerMayorId) {
      narrationBox.textContent = "👑 En tant qu'ancien Maire, désigne ton successeur avant de t'éteindre.";
      renderPickerAction(actionZone, targetableOthers, 1, async (ids) => {
        await db.ref(`rooms/${State.roomCode}/mayorSuccession/chosenId`).set(ids[0]);
      });
    } else {
      const former = room.players[room.mayorSuccession.formerMayorId];
      narrationBox.textContent = `👑 ${former ? former.name : 'Le Maire'} désigne son successeur avec ses derniers mots...`;
    }
    return;
  }

  if (room.status === 'night') {
    const step = room.night.steps[room.night.stepIndex];

    if (step === 'voleur') {
      if (me.role === 'voleur' && me.alive) {
        if (room.night.voleurDone) {
          narrationBox.textContent = "🗡️ Ton choix est fait. La nuit continue...";
        } else {
          const cards = room.extraCards || [];
          narrationBox.textContent = "🗡️ Voici 2 cartes qui n'ont été données à personne. Tu peux échanger ta carte de Villageois contre l'une d'elles, ou garder la tienne.";
          cards.forEach(cardId => {
            const roleDef = ROLES[cardId];
            const btn = document.createElement('button');
            btn.className = 'btn btn-secondary';
            btn.textContent = `${roleDef.icon} Prendre : ${roleDef.name}`;
            btn.onclick = async () => {
              await db.ref(`rooms/${State.roomCode}/players/${State.playerId}/role`).set(cardId);
              await db.ref(`rooms/${State.roomCode}/night/voleurDone`).set(true);
            };
            actionZone.appendChild(btn);
          });
          const keepBtn = document.createElement('button');
          keepBtn.className = 'btn btn-secondary';
          keepBtn.textContent = 'Garder mon rôle';
          keepBtn.onclick = async () => { await db.ref(`rooms/${State.roomCode}/night/voleurDone`).set(true); };
          actionZone.appendChild(keepBtn);
        }
      } else {
        narrationBox.textContent = "🗡️ Le Voleur observe les cartes qui n'ont pas été distribuées...";
      }
      return;
    }

    if (step === 'cupidon') {
      if (me.role === 'cupidon') {
        narrationBox.textContent = "💘 Choisis les deux âmes que tu unis pour la partie (clique 2 joueurs).";
        renderPickerAction(actionZone, targetableOthers.concat([[State.playerId, me]]), 2, async (ids) => {
          await db.ref(`rooms/${State.roomCode}/night/cupidLovers`).set(ids);
          await db.ref(`rooms/${State.roomCode}/lovers`).set(ids);
          await db.ref(`rooms/${State.roomCode}/log/${Date.now()}`).set({round: room.round, text: `💘 Cupidon a formé un couple ce soir...`, ts: Date.now()});
        });
      } else {
        narrationBox.textContent = "💘 Cupidon choisit en secret les deux amoureux de cette partie...";
      }
      return;
    }

    if (step === 'wolves') {
      announceOnce(`howl-${room.round}`, () => { SFX.wolfHowl(); setTimeout(() => SFX.heartbeat(), 800); });
      announceOnce(`switchtab-wolves-${room.round}`, () => {
        if (isWolfSide(me.role)) {
          const wolfTab = document.querySelector('.chat-tab[data-channel="wolves"]');
          if (wolfTab) wolfTab.click();
        }
      });
      if (isWolf(me.role) && me.alive) {
        const wolfVotes = room.night.wolfVotes || {};
        const aliveWolves = alivePlayers.filter(([id,p]) => isWolf(p.role));
        const allVoted = aliveWolves.every(([id]) => wolfVotes[id]);
        const distinctTargets = new Set(aliveWolves.map(([id]) => wolfVotes[id]).filter(Boolean));
        const consensus = allVoted && distinctTargets.size === 1;

        narrationBox.textContent = "🐺 Discutez dans votre chat privé, puis choisissez TOUS la même victime. Vous pouvez changer d'avis tant que vous n'êtes pas d'accord.";
        const nonWolfTargets = alivePlayers.filter(([id,p]) => !isWolf(p.role));
        renderPickerAction(actionZone, nonWolfTargets, 1, async (ids) => {
          await db.ref(`rooms/${State.roomCode}/night/wolfVotes/${State.playerId}`).set(ids[0]);
        }, room.night.wolfVotes && room.night.wolfVotes[State.playerId], true);

        const votesText = Object.entries(wolfVotes).map(([wid, tid]) => `${room.players[wid].name} → ${room.players[tid].name}`).join(' | ');
        const statusP = document.createElement('p');
        statusP.className = 'action-hint';
        statusP.textContent = consensus ? `✅ Vous êtes tous d'accord : la nuit va continuer.` : (votesText ? `🗳️ Votes actuels : ${votesText} — pas encore d'accord unanime.` : 'Personne n\'a encore voté.');
        actionZone.appendChild(statusP);
      } else if ((me.role === 'petite_fille' || me.role === 'loup_blanc') && me.alive) {
        const votesText = Object.entries(room.night.wolfVotes || {}).map(([wid, tid]) => room.players[tid].name).join(', ');
        narrationBox.textContent = `${me.role === 'petite_fille' ? '👧 Tu espionnes discrètement les loups' : '🐺❄️ Tu observes tes alliés délibérer'}... ${votesText ? 'Cible(s) évoquée(s) : ' + votesText : 'Ils délibèrent encore.'}`;
      } else {
        narrationBox.textContent = "🐺 Les loups-garous se réveillent et choisissent leur victime ensemble, en privé. Prenez tout le temps nécessaire.";
      }
      return;
    }

    if (step === 'loup_blanc') {
      if (me.role === 'loup_blanc' && me.alive) {
        const current = room.night.loupBlancTarget;
        const isSkip = current === 'SKIP';
        narrationBox.textContent = "🐺❄️ Une nuit sur deux, tu peux dévorer un loup en secret. Choisis ta cible, ou ne fais rien (tu peux changer d'avis).";
        const wolfTeammates = alivePlayers.filter(([id,p]) => p.role === 'loup_garou');
        renderPickerAction(actionZone, wolfTeammates, 1, async (ids) => {
          await db.ref(`rooms/${State.roomCode}/night/loupBlancTarget`).set(ids[0]);
        }, (current && !isSkip) ? current : undefined, true);
        const skipBtn = document.createElement('button');
        skipBtn.className = 'btn btn-secondary';
        skipBtn.textContent = isSkip ? 'Choix actuel : ne rien faire ✔️' : 'Ne rien faire cette nuit';
        skipBtn.onclick = async () => { await db.ref(`rooms/${State.roomCode}/night/loupBlancTarget`).set('SKIP'); };
        actionZone.appendChild(skipBtn);
      } else {
        narrationBox.textContent = "🐺❄️ Le Loup Blanc rôde seul dans l'ombre...";
      }
      return;
    }

    if (step === 'voyante') {
      announceOnce(`voyante-${room.round}`, () => SFX.magicSparkle());
      if (me.role === 'voyante' && me.alive) {
        if (room.night.seerTarget) {
          const target = room.players[room.night.seerTarget];
          narrationBox.textContent = `🔮 ${target.name} est... ${ROLES[target.role].icon} ${ROLES[target.role].name} !`;
          if (!room.night.seerAck) {
            const ackBtn = document.createElement('button');
            ackBtn.className = 'btn btn-primary';
            ackBtn.textContent = "J'ai bien vu, la nuit peut continuer";
            ackBtn.onclick = async () => { await db.ref(`rooms/${State.roomCode}/night/seerAck`).set(true); };
            actionZone.appendChild(ackBtn);
          } else {
            const doneP = document.createElement('p');
            doneP.className = 'action-hint';
            doneP.textContent = '✅ La nuit continue dès que les autres ont terminé.';
            actionZone.appendChild(doneP);
          }
        } else {
          narrationBox.textContent = "🔮 Choisis un joueur dont tu veux découvrir le rôle véritable.";
          renderPickerAction(actionZone, targetableOthers, 1, async (ids) => {
            await db.ref(`rooms/${State.roomCode}/night/seerTarget`).set(ids[0]);
            await db.ref(`rooms/${State.roomCode}/players/${State.playerId}/knowledge/${ids[0]}`).set(room.players[ids[0]].role);
          });
        }
      } else {
        narrationBox.textContent = "🔮 La Voyante sonde discrètement l'un des habitants du village...";
      }
      return;
    }

    if (step === 'sorciere') {
      announceOnce(`sorciere-${room.round}`, () => SFX.poisonDrip());
      if (me.role === 'sorciere' && me.alive) {
        const victimId = majorityTargetLocal(room.night.wolfVotes || {});
        const victimName = victimId ? room.players[victimId].name : 'personne';
        if (room.night.witchDecided) {
          narrationBox.textContent = "🧪 Tu as fait ton choix pour cette nuit.";
        } else {
          narrationBox.textContent = `🧪 Cette nuit, les loups ont désigné ${victimName}. Que fais-tu ?`;
          renderWitchAction(actionZone, room, victimId);
        }
      } else {
        narrationBox.textContent = "🧪 La Sorcière hésite devant ses fioles...";
      }
      return;
    }

    if (step === 'salvateur') {
      if (me.role === 'salvateur' && me.alive) {
        const current = room.night.salvateurTarget;
        narrationBox.textContent = "🛡️ Choisis qui tu protèges cette nuit (tu ne peux pas protéger le même joueur deux fois de suite). Tu peux changer d'avis.";
        const forbidden = me.lastProtected;
        const options = targetableOthers.filter(([id]) => id !== forbidden).concat([[State.playerId, me]].filter(([id]) => id !== forbidden));
        renderPickerAction(actionZone, options, 1, async (ids) => {
          await db.ref(`rooms/${State.roomCode}/night/salvateurTarget`).set(ids[0]);
          await db.ref(`rooms/${State.roomCode}/players/${State.playerId}/lastProtected`).set(ids[0]);
        }, current, true);
      } else {
        narrationBox.textContent = "🛡️ Le Salvateur veille sur le village...";
      }
      return;
    }

    if (step === 'corbeau') {
      if (me.role === 'corbeau' && me.alive) {
        const current = room.night.corbeauTarget;
        narrationBox.textContent = "🐦‍⬛ Désigne un joueur qui recevra 2 voix supplémentaires au vote de demain. Tu peux changer d'avis.";
        renderPickerAction(actionZone, targetableOthers, 1, async (ids) => {
          await db.ref(`rooms/${State.roomCode}/night/corbeauTarget`).set(ids[0]);
        }, current, true);
      } else {
        narrationBox.textContent = "🐦‍⬛ Un croassement retentit au loin...";
      }
      return;
    }

    if (step === 'renard') {
      if (me.role === 'renard' && me.alive) {
        if (me.renardBlind) {
          narrationBox.textContent = "🦊 Tu as perdu ton flair, tu ne sens plus rien cette nuit...";
        } else if (room.night.renardTargets) {
          const found = room.night.renardTargets.some(t => room.players[t] && isWolfSide(room.players[t].role));
          narrationBox.textContent = found
            ? "🦊 Ton flair frémit : il y a bien au moins un loup dans ce groupe !"
            : "🦊 Rien... aucun loup dans ce groupe. Ton flair vient de s'éteindre pour le reste de la partie.";
          if (!room.night.renardAck) {
            const ackBtn = document.createElement('button');
            ackBtn.className = 'btn btn-primary';
            ackBtn.textContent = "J'ai bien senti, la nuit peut continuer";
            ackBtn.onclick = async () => { await db.ref(`rooms/${State.roomCode}/night/renardAck`).set(true); };
            actionZone.appendChild(ackBtn);
          } else {
            const doneP = document.createElement('p');
            doneP.className = 'action-hint';
            doneP.textContent = '✅ La nuit continue dès que les autres ont terminé.';
            actionZone.appendChild(doneP);
          }
        } else {
          narrationBox.textContent = "🦊 Choisis un groupe de 3 joueurs à flairer.";
          renderPickerAction(actionZone, alivePlayers, 3, async (ids) => {
            await db.ref(`rooms/${State.roomCode}/night/renardTargets`).set(ids);
          });
        }
      } else {
        narrationBox.textContent = "🦊 Le Renard flaire discrètement les environs...";
      }
      return;
    }

    narrationBox.textContent = "🌙 Tout le monde a fait son choix... le village sombre dans un sommeil profond. Le réveil approche.";
    return;
  }

  if (room.status === 'day-reveal') {
    const deaths = room.deathsThisRound || [];
    if (deaths.length === 0) narrationBox.textContent = "🌅 Le village se réveille... et personne ne manque à l'appel !";
    else narrationBox.textContent = "🌅 Le village se réveille et découvre avec horreur : " + deaths.map(id => room.players[id] ? room.players[id].name : '???').join(', ') + '.';
    return;
  }

  if (room.status === 'day-discuss') {
    if (room.day && room.day.speakerPhase === 'turns') {
      narrationBox.textContent = "🎙️ Chacun son tour de parole avant le débat libre. Prépare tes arguments !";
    } else {
      narrationBox.textContent = "☀️ C'est l'heure du débat libre. Qui soupçonnez-vous ?";
    }
    if (State.isHost) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-secondary';
      btn.textContent = 'Passer au vote maintenant';
      btn.onclick = () => db.ref(`rooms/${State.roomCode}`).update({ status: 'day-vote', phaseEndsAt: Date.now() + 45000 });
      actionZone.appendChild(btn);
    }
    return;
  }

  if (room.status === 'day-vote') {
    if (me.alive && me.canVote !== false) {
      narrationBox.textContent = "🗳️ Votez pour éliminer un suspect. Vous pouvez changer d'avis tant que tout le monde n'a pas voté.";
      const myVote = room.day && room.day.votes && room.day.votes[State.playerId];
      renderPickerAction(actionZone, targetableOthers, 1, async (ids) => {
        await db.ref(`rooms/${State.roomCode}/day/votes/${State.playerId}`).set(ids[0]);
      }, myVote, true);
    } else if (me.alive) {
      narrationBox.textContent = "🗳️ Tu as perdu ton droit de vote (Idiot du Village révélé). Observe le village décider...";
    } else {
      narrationBox.textContent = "🗳️ Le village vote. En tant que fantôme, observe en silence...";
    }
    return;
  }

  if (room.status === 'hunter') {
    if (State.playerId === room.night.hunterShooterId) {
      narrationBox.textContent = "🏹 Tu meurs... mais avant de partir, choisis qui tu emportes avec toi !";
      renderPickerAction(actionZone, targetableOthers, 1, async (ids) => {
        await db.ref(`rooms/${State.roomCode}/night/hunterTarget`).set(ids[0]);
      });
    } else {
      const shooter = room.players[room.night.hunterShooterId];
      narrationBox.textContent = `🏹 ${shooter ? shooter.name : 'Le Chasseur'} agonise et s'apprête à tirer une dernière flèche...`;
    }
    return;
  }
}

function renderActionProgressBar(room) {
  const el = document.getElementById('action-progress');
  if (!el) return;
  let done = 0, total = 0, label = '';

  if (room.status === 'day-vote') {
    const voters = Object.entries(room.players).filter(([id,p]) => p.alive && p.canVote !== false);
    total = voters.length;
    done = voters.filter(([id]) => room.day && room.day.votes && room.day.votes[id]).length;
    label = '🗳️ Votes';
  } else if (room.status === 'mayor-candidacy') {
    const alive = Object.entries(room.players).filter(([id,p]) => p.alive);
    total = alive.length;
    done = alive.filter(([id]) => room.candidacyResponses && room.candidacyResponses[id] !== undefined).length;
    label = '🗳️ Réponses';
  } else if (room.status === 'mayor-election') {
    const alive = Object.entries(room.players).filter(([id,p]) => p.alive);
    total = alive.length;
    done = alive.filter(([id]) => room.mayorVotes && room.mayorVotes[id]).length;
    label = '👑 Votes';
  } else if (room.status === 'night' && room.night && room.night.steps[room.night.stepIndex] === 'wolves') {
    const wolves = Object.entries(room.players).filter(([id,p]) => p.alive && isWolf(p.role));
    total = wolves.length;
    done = wolves.filter(([id]) => room.night.wolfVotes && room.night.wolfVotes[id]).length;
    label = '🐺 Loups prêts';
  }

  if (total <= 0) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  const pct = Math.round((done / total) * 100);
  el.innerHTML = `<span>${label} : ${done}/${total}</span><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>`;
}

function renderHostControls(room) {
  if (!State.isHost) return;
  const forceable = ['night', 'mayor-candidacy', 'mayor-speeches', 'mayor-election', 'mayor-succession', 'hunter', 'day-vote'];
  if (!forceable.includes(room.status)) return;
  const zone = document.getElementById('action-zone');
  const row = document.createElement('div');
  row.className = 'host-force-row';
  const btn = document.createElement('button');
  btn.className = 'mini-btn';
  btn.textContent = '⏭️ Forcer le passage (hôte)';
  btn.title = "Utile si quelqu'un est absent et bloque la partie";
  btn.onclick = () => db.ref(`rooms/${State.roomCode}`).update({ phaseEndsAt: Date.now() });
  row.appendChild(btn);
  zone.appendChild(row);
}

function majorityTargetLocal(votesObj) {
  const counts = {};
  Object.values(votesObj || {}).forEach(t => { counts[t] = (counts[t] || 0) + 1; });
  let best = null, bestCount = 0;
  Object.entries(counts).forEach(([id, c]) => { if (c > bestCount) { best = id; bestCount = c; } });
  return best;
}

function renderPickerAction(container, options, maxPick, onConfirm, preSelected, allowChange) {
  const hint = document.createElement('p');
  hint.className = 'action-hint';
  hint.textContent = `Clique sur ${maxPick > 1 ? maxPick + ' joueurs' : 'un joueur'} dans la liste ci-dessous, puis confirme.`;
  container.appendChild(hint);

  if (preSelected && !allowChange) {
    const done = document.createElement('p');
    done.className = 'action-hint';
    done.textContent = '✅ Choix déjà envoyé. En attente des autres...';
    container.appendChild(done);
    return;
  }

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'btn btn-primary';
  confirmBtn.textContent = preSelected ? 'Changer mon choix' : 'Confirmer';
  confirmBtn.onclick = () => {
    onConfirm(State.selectedTargets);
    confirmBtn.textContent = 'Choix envoyé ✔️ (tu peux encore changer d\'avis)';
  };
  container.appendChild(confirmBtn);

  State._pickerMax = maxPick;
  State._pickerConfirmBtn = confirmBtn;
  State._allowSelf = options.some(([id]) => id === State.playerId);

  if (preSelected) {
    const preArr = Array.isArray(preSelected) ? preSelected : [preSelected];
    State.selectedTargets = preArr.slice(0, maxPick);
  }
  confirmBtn.disabled = State.selectedTargets.length !== maxPick;
}

function renderWitchAction(container, room, victimId) {
  const me = room.players[State.playerId];
  const row = document.createElement('div');

  if (!me.witchHealUsed && victimId) {
    const healBtn = document.createElement('button');
    healBtn.className = 'btn btn-secondary';
    healBtn.textContent = '💚 Sauver la victime';
    healBtn.onclick = async () => {
      await db.ref(`rooms/${State.roomCode}/night`).update({ witchDecided: true, witchHeal: true, witchHealTarget: victimId });
      await db.ref(`rooms/${State.roomCode}/players/${State.playerId}/witchHealUsed`).set(true);
    };
    row.appendChild(healBtn);
  }

  if (!me.witchPoisonUsed) {
    const poisonBtn = document.createElement('button');
    poisonBtn.className = 'btn btn-secondary';
    poisonBtn.textContent = '☠️ Empoisonner quelqu\'un';
    poisonBtn.onclick = () => {
      row.innerHTML = '';
      const others = Object.entries(room.players).filter(([id,p]) => p.alive);
      renderPickerAction(row, others, 1, async (ids) => {
        await db.ref(`rooms/${State.roomCode}/night`).update({ witchDecided: true, witchPoisonTarget: ids[0] });
        await db.ref(`rooms/${State.roomCode}/players/${State.playerId}/witchPoisonUsed`).set(true);
      });
    };
    row.appendChild(poisonBtn);
  }

  const skipBtn = document.createElement('button');
  skipBtn.className = 'btn btn-secondary';
  skipBtn.textContent = 'Ne rien faire';
  skipBtn.onclick = async () => {
    await db.ref(`rooms/${State.roomCode}/night`).update({ witchDecided: true, witchHeal: false, witchPoisonTarget: null });
  };
  row.appendChild(skipBtn);

  container.appendChild(row);
}

function renderPlayersGrid(room, me) {
  const grid = document.getElementById('players-grid');
  grid.innerHTML = '';
  const seeWolves = isWolfSide(me.role);
  const currentSpeakerId = (room.status === 'day-discuss' && room.day && room.day.speakerPhase === 'turns') ? room.day.speakOrder[room.day.speakerIndex] : null;

  const votesTally = {};
  if (room.status === 'day-vote') {
    const voters = Object.entries(room.players).filter(([id,p]) => p.alive && p.canVote !== false);
    voters.forEach(([voterId]) => {
      const targetId = room.day && room.day.votes && room.day.votes[voterId];
      if (!targetId) return;
      const weight = room.players[voterId].isMayor ? 2 : 1;
      votesTally[targetId] = (votesTally[targetId] || 0) + weight;
    });
    const corbeauTarget = room.night && room.night.corbeauTarget;
    if (corbeauTarget && room.players[corbeauTarget] && room.players[corbeauTarget].alive) {
      votesTally[corbeauTarget] = (votesTally[corbeauTarget] || 0) + 2;
    }
  }

  if (!State._prevAlive) State._prevAlive = {};
  Object.entries(room.players).forEach(([id, p]) => {
    const justDied = State._prevAlive[id] === true && p.alive === false;
    State._prevAlive[id] = p.alive;
    const card = document.createElement('div');
    card.className = 'player-card' + (p.alive ? '' : ' dead') + (justDied ? ' just-died' : '') + (id === currentSpeakerId ? ' speaking' : '') + (State._pickerConfirmBtn && State.selectedTargets.includes(id) ? ' selected' : '');
    if (State._pickerConfirmBtn && p.alive && id !== State.playerId) card.classList.add('selectable');
    if (State._pickerConfirmBtn && id === State.playerId && State._allowSelf && p.alive) card.classList.add('selectable');

    let roleTag = '';
    if (!p.alive) roleTag = ROLES[p.role] ? ROLES[p.role].name : '';
    else if (seeWolves && p.role === 'loup_garou' && id !== State.playerId) roleTag = '🐺 Loup';
    else if (id === State.playerId) roleTag = ROLES[p.role] ? ROLES[p.role].name : '';
    else if (p.revealed) roleTag = ROLES[p.role] ? `${ROLES[p.role].name} (révélé)` : '';

    const isLover = (room.lovers || []).includes(id);
    const cos = p.cosmetics || {};

    card.innerHTML = `
      ${isLover ? '<span class="lover-mark">💘</span>' : ''}
      ${p.isMayor ? '<span class="mayor-mark">👑</span>' : ''}
      ${votesTally[id] ? `<span class="vote-count">${votesTally[id]}</span>` : ''}
      <div class="avatar ${p.alive ? (cos.frameClass || '') : ''}">${cos.hatIcon && p.alive ? `<span class="hat-mark">${cos.hatIcon}</span>` : ''}${p.alive ? avatarFor(p.name) : '💀'}</div>
      <div class="pname ${cos.nameColorClass || ''}">${escapeHtml(p.name)}${p.isBot ? ' 🤖' : ''}</div>
      ${roleTag ? `<div class="ptag">${roleTag}</div>` : ''}
    `;

    card.addEventListener('click', () => {
      if (!State._pickerConfirmBtn) return;
      if (!p.alive) return;
      if (id === State.playerId && !State._allowSelf) return;
      const idx = State.selectedTargets.indexOf(id);
      if (idx >= 0) { State.selectedTargets.splice(idx, 1); card.classList.remove('selected'); }
      else {
        if (State.selectedTargets.length >= State._pickerMax) {
          const firstId = State.selectedTargets.shift();
          const firstCard = [...grid.children].find(c => c.dataset.pid === firstId);
          if (firstCard) firstCard.classList.remove('selected');
        }
        State.selectedTargets.push(id);
        card.classList.add('selected');
      }
      State._pickerConfirmBtn.disabled = State.selectedTargets.length !== State._pickerMax;
    });
    card.dataset.pid = id;
    grid.appendChild(card);
  });
}

/* ---------------- FIN DE PARTIE ---------------- */
function bindEndScreen() {
  document.getElementById('btn-back-home').addEventListener('click', () => {
    localStorage.removeItem(`lg_seen_role_${State.roomCode}`);
    leaveRoom();
  });
}

function renderEnd(room) {
  const winner = room.winner;
  const map = {
    village: ['🏆 Le Village triomphe !', 'Tous les loups-garous ont été éliminés.'],
    wolves: ['🐺 Les Loups-Garous l\'emportent !', 'Ils ont dévoré le village jusqu\'à en prendre le contrôle.'],
    lovers: ['💘 Les Amoureux gagnent !', 'Envers et contre tous, leur amour a survécu à tout le village.'],
    loup_blanc: ['🐺❄️ Le Loup Blanc triomphe, seul !', 'Il a éliminé amis et ennemis sans exception.']
  };
  const [title, subtitle] = map[winner] || ['Fin de partie', ''];
  document.getElementById('end-title').textContent = title;
  document.getElementById('end-subtitle').textContent = subtitle;
  const panel = document.querySelector('#screen-end .end-panel');
  panel.classList.remove('win-wolves', 'win-village', 'win-lovers');
  if (winner === 'wolves' || winner === 'loup_blanc') panel.classList.add('win-wolves');
  else if (winner === 'lovers') panel.classList.add('win-lovers');
  else panel.classList.add('win-village');

  const recapEl = document.getElementById('reward-recap');
  if (State._lastReward) {
    const r = State._lastReward;
    let html = `<div class="rr-coins">🪙 +${r.coinsEarned} pièces gagnées</div>`;
    if (r.newAchievements.length) {
      html += r.newAchievements.map(a => `<div class="rr-ach">🏆 Succès débloqué : <strong>${escapeHtml(a.name)}</strong> (+${a.reward} 🪙)</div>`).join('');
    }
    html += `<div class="rr-ach">Solde actuel : 🪙 ${Profile.load().coins} — visite la <strong>Boutique</strong> pour dépenser tes gains !</div>`;
    recapEl.innerHTML = html;
    recapEl.classList.remove('hidden');
  } else {
    recapEl.classList.add('hidden');
  }

  const list = document.getElementById('end-roles-list');
  list.innerHTML = Object.values(room.players).map(p => {
    const role = ROLES[p.role] || {};
    const cos = p.cosmetics || {};
    return `<div class="er-row"><span>${p.alive ? '🟢' : '⚫'} ${cos.hatIcon ? cos.hatIcon + ' ' : ''}<span class="${cos.nameColorClass || ''}">${escapeHtml(p.name)}</span>${p.isBot ? ' 🤖' : ''}</span><span>${role.icon || ''} ${role.name || '???'}</span></div>`;
  }).join('');
}

/* ---------------- UTILS ---------------- */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

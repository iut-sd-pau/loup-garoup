/* ============================================================
   ROLES.JS
   Definition des roles, camps, et logique de distribution
   Supporte de 1 a 50 joueurs (avec bots pour completer)
   ============================================================ */

const TEAM = { VILLAGE: 'village', WOLF: 'wolf', SOLO: 'solo' };

const ROLES = {
  loup_garou: {
    id: 'loup_garou', name: 'Loup-Garou', icon: '🐺', team: TEAM.WOLF,
    desc: "Chaque nuit, toi et les autres loups choisissez ensemble une victime a devorer. Le jour, fais profil bas et fais accuser les villageois."
  },
  villageois: {
    id: 'villageois', name: 'Villageois', icon: '👤', team: TEAM.VILLAGE,
    desc: "Tu n'as pas de pouvoir special. Ta seule arme : observer, deduire, et convaincre le village de voter juste."
  },
  voyante: {
    id: 'voyante', name: 'Voyante', icon: '🔮', team: TEAM.VILLAGE,
    desc: "Chaque nuit, tu peux sonder un joueur et decouvrir son role exact. Garde cette information secrete... ou utilise-la avec ruse."
  },
  sorciere: {
    id: 'sorciere', name: 'Sorciere', icon: '🧪', team: TEAM.VILLAGE,
    desc: "Tu possedes deux potions a usage unique : une de soin (sauve la victime des loups) et une de poison (tue un joueur de ton choix)."
  },
  chasseur: {
    id: 'chasseur', name: 'Chasseur', icon: '🏹', team: TEAM.VILLAGE,
    desc: "Si tu meurs, tu emportes immediatement quelqu'un avec toi dans la tombe."
  },
  cupidon: {
    id: 'cupidon', name: 'Cupidon', icon: '💘', team: TEAM.VILLAGE,
    desc: "La premiere nuit, tu lies deux joueurs (toi y compris si tu veux) par un lien amoureux eternel. Si l'un meurt, l'autre meurt de chagrin. Si les deux amoureux sont les 2 derniers survivants, ils gagnent ensemble, peu importe leurs camps."
  },
  petite_fille: {
    id: 'petite_fille', name: 'Petite Fille', icon: '👧', team: TEAM.VILLAGE,
    desc: "Tu peux espionner les loups pendant leur reunion nocturne... mais si tu es reperee, tu risques gros."
  },
  salvateur: {
    id: 'salvateur', name: 'Salvateur', icon: '🛡️', team: TEAM.VILLAGE,
    desc: "Chaque nuit, tu proteges un joueur (jamais deux fois de suite le meme) contre l'attaque des loups."
  },
  bouc_emissaire: {
    id: 'bouc_emissaire', name: 'Bouc Emissaire', icon: '🐐', team: TEAM.VILLAGE,
    desc: "En cas d'egalite des votes le jour, c'est toi qui es elimine a la place de tout le monde."
  },
  idiot_village: {
    id: 'idiot_village', name: 'Idiot du Village', icon: '🤪', team: TEAM.VILLAGE,
    desc: "Si le village vote pour t'eliminer, tu survis (ton role est revele a tous) mais tu perds ton droit de vote pour le reste de la partie."
  },
  ancien: {
    id: 'ancien', name: 'Ancien', icon: '🧓', team: TEAM.VILLAGE,
    desc: "Tu resistes a la premiere attaque des loups (il t'en faudra deux pour t'achever). Le poison et le vote du village restent mortels des le premier coup."
  },
  corbeau: {
    id: 'corbeau', name: 'Corbeau', icon: '🐦‍⬛', team: TEAM.VILLAGE,
    desc: "Chaque nuit, tu designes en secret un joueur qui recevra 2 voix supplementaires au vote du village le lendemain."
  },
  renard: {
    id: 'renard', name: 'Renard', icon: '🦊', team: TEAM.VILLAGE,
    desc: "Chaque nuit, flaire un groupe de 3 joueurs. S'il y a au moins un loup parmi eux, tu le sens et tu gardes ton flair. Sinon, tu perds ton pouvoir pour le reste de la partie."
  },
  voleur: {
    id: 'voleur', name: 'Voleur', icon: '🗡️', team: TEAM.VILLAGE,
    desc: "Au tout debut de la partie, tu decouvres 2 cartes de role non distribuees et tu peux echanger ta carte contre l'une d'elles — au risque de devenir Loup-Garou !"
  },
  loup_blanc: {
    id: 'loup_blanc', name: 'Loup Blanc', icon: '🐺❄️', team: TEAM.SOLO,
    desc: "Tu votes avec les loups chaque nuit et connais leur identite, mais tu joues pour toi seul : une nuit sur deux, tu peux devorer un loup en secret. Tu gagnes seul si tu es l'unique survivant."
  }
};

/**
 * Calcule le nombre de loups-garous adapte a la taille du village,
 * de 1 a 50 joueurs.
 */
function wolfCountFor(playerCount) {
  if (playerCount <= 6) return 1;
  if (playerCount <= 9) return 2;
  if (playerCount <= 14) return 3;
  if (playerCount <= 20) return 4;
  if (playerCount <= 28) return 5;
  if (playerCount <= 36) return 6;
  if (playerCount <= 44) return 7;
  return 8;
}

/**
 * Determine la composition des roles selon le nombre de joueurs
 * et les reglages choisis par l'hote. Si le Voleur est active,
 * genere 2 cartes supplementaires non distribuees (deck.length = playerCount + 2).
 */
function buildRoleDeck(playerCount, settings) {
  const deck = [];
  const wolfCount = wolfCountFor(playerCount);
  const hasLoupBlanc = !!settings.loup_blanc && playerCount >= 7;

  for (let i = 0; i < wolfCount; i++) deck.push('loup_garou');
  if (hasLoupBlanc) deck.push('loup_blanc');

  const specials = [];
  if (settings.voyante) specials.push('voyante');
  if (settings.sorciere) specials.push('sorciere');
  if (settings.chasseur) specials.push('chasseur');
  if (settings.cupidon) specials.push('cupidon');
  if (settings.petitefille) specials.push('petite_fille');
  if (settings.salvateur) specials.push('salvateur');
  if (settings.boucemissaire) specials.push('bouc_emissaire');
  if (settings.idiot_village) specials.push('idiot_village');
  if (settings.ancien) specials.push('ancien');
  if (settings.corbeau) specials.push('corbeau');
  if (settings.renard) specials.push('renard');

  const targetLength = playerCount + (settings.voleur ? 2 : 0);
  const remainingSlots = targetLength - deck.length;
  shuffleArray(specials).slice(0, Math.max(0, remainingSlots)).forEach(r => deck.push(r));

  while (deck.length < targetLength) deck.push('villageois');

  let finalDeck = shuffleArray(deck);

  if (settings.voleur && playerCount >= 3) {
    // Reserve 2 cartes "extra" en fin de deck pour le Voleur, en evitant
    // si possible de lui laisser voir deux loups d'entree de jeu.
    finalDeck = finalDeck.slice(0, playerCount + 2);
  }

  return finalDeck;
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isWolf(role) { return ROLES[role] && ROLES[role].team === TEAM.WOLF; }
function isWolfSide(role) { return isWolf(role) || role === 'loup_blanc'; }

const BOT_NAMES = [
  'Bob (bot)', 'Alice (bot)', 'Marcel (bot)', 'Ginette (bot)', 'Kevin (bot)', 'Nadia (bot)',
  'Le Curé (bot)', 'Toto (bot)', 'Mémé Odette (bot)', 'Le Boulanger (bot)', 'Zorro (bot)',
  'Camille (bot)', 'Julot (bot)', 'La Meunière (bot)', 'Gaston (bot)', 'Fifi (bot)',
  'Le Forgeron (bot)', 'Suzanne (bot)', 'Bernard (bot)', 'Le Garde-Champêtre (bot)',
  'Colette (bot)', 'Momo (bot)', 'Le Fossoyeur (bot)', 'Yvette (bot)', 'Le Braconnier (bot)'
];

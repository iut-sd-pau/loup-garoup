/* ============================================================
   SHOP.JS
   Profil joueur persistant (local a l'appareil, pas de compte
   en ligne), monnaie gagnee en jouant, boutique cosmetique
   100% visuelle (aucun avantage de jeu), succes.
   ============================================================ */

const SHOP_ITEMS = {
  hat: [
    { id: 'hat_none', name: 'Aucun', icon: '', price: 0, starter: true },
    { id: 'hat_tophat', name: 'Haut-de-forme', icon: '🎩', price: 60 },
    { id: 'hat_cap', name: 'Casquette', icon: '🧢', price: 60 },
    { id: 'hat_grad', name: 'Toque de sage', icon: '🎓', price: 90 },
    { id: 'hat_pumpkin', name: 'Citrouille', icon: '🎃', price: 90 },
    { id: 'hat_star', name: 'Étoile filante', icon: '🌟', price: 150 },
    { id: 'hat_fire', name: 'Flamme ardente', icon: '🔥', price: 200 },
    { id: 'hat_clover', name: 'Trèfle porte-bonheur', icon: '🍀', price: 120 },
    { id: 'hat_frog', name: 'Grenouille (?!)', icon: '🐸', price: 80 },
    { id: 'hat_crown', name: 'Couronne dorée', icon: '👑', price: 350, epic: true },
  ],
  frame: [
    { id: 'frame_none', name: 'Aucun', className: '', price: 0, starter: true },
    { id: 'frame_bronze', name: 'Cadre Bronze', className: 'frame-bronze', price: 60 },
    { id: 'frame_argent', name: 'Cadre Argent', className: 'frame-argent', price: 130 },
    { id: 'frame_or', name: 'Cadre Or', className: 'frame-or', price: 250 },
    { id: 'frame_feu', name: 'Cadre Braise', className: 'frame-feu', price: 300, epic: true },
    { id: 'frame_glace', name: 'Cadre Givre', className: 'frame-glace', price: 300, epic: true },
    { id: 'frame_arcenciel', name: 'Cadre Arc-en-ciel', className: 'frame-arcenciel', price: 500, epic: true },
  ],
  nameColor: [
    { id: 'color_none', name: 'Défaut', className: '', price: 0, starter: true },
    { id: 'color_rouge', name: 'Rouge Loup', className: 'name-rouge', price: 50 },
    { id: 'color_bleu', name: 'Bleu Nuit', className: 'name-bleu', price: 50 },
    { id: 'color_vert', name: 'Vert Forêt', className: 'name-vert', price: 50 },
    { id: 'color_violet', name: 'Violet Mystique', className: 'name-violet', price: 80 },
    { id: 'color_or', name: 'Or Légendaire', className: 'name-or', price: 220, epic: true },
  ],
  title: [
    { id: 'title_none', name: 'Aucun titre', label: '', price: 0, starter: true },
    { id: 'title_curieux', name: 'Villageois Curieux', label: 'Villageois Curieux', price: 40 },
    { id: 'title_chasseur', name: 'Chasseur de Primes', label: 'Chasseur de Primes', price: 100 },
    { id: 'title_oracle', name: "Oracle du Village", label: 'Oracle du Village', price: 100 },
    { id: 'title_ame', name: 'Âme Sombre', label: 'Âme Sombre', price: 150 },
    { id: 'title_legende', name: 'Légende du Village', label: 'Légende du Village', price: 0, achievementLocked: 'village_win' },
    { id: 'title_terreur', name: 'Terreur Nocturne', label: 'Terreur Nocturne', price: 0, achievementLocked: 'wolf_win' },
  ]
};

const ACHIEVEMENTS = {
  first_game:  { name: 'Première partie',      desc: 'Termine ta première partie.',              reward: 20 },
  first_win:   { name: 'Première victoire',     desc: 'Gagne une partie, n\'importe quel camp.',  reward: 30 },
  five_games:  { name: 'Habitué du village',    desc: 'Joue 5 parties.',                          reward: 40 },
  survivor:    { name: 'Survivant',             desc: 'Termine une partie encore en vie.',        reward: 25 },
  wolf_win:    { name: 'Loup Alpha',            desc: 'Gagne en tant que Loup-Garou.',            reward: 35 },
  village_win: { name: 'Sauveur du Village',    desc: 'Gagne en tant que membre du Village.',     reward: 35 },
  twenty_games:{ name: 'Pilier du village',     desc: 'Joue 20 parties.',                          reward: 80 },
};

const Profile = {
  data: null,

  load() {
    let raw = localStorage.getItem('lg_profile');
    if (raw) {
      try { this.data = JSON.parse(raw); } catch (e) { this.data = null; }
    }
    if (!this.data) {
      this.data = {
        id: 'u_' + Math.random().toString(36).slice(2, 10),
        coins: 30,
        owned: ['hat_none', 'frame_none', 'color_none', 'title_none'],
        equipped: { hat: 'hat_none', frame: 'frame_none', nameColor: 'color_none', title: 'title_none' },
        stats: { gamesPlayed: 0, wins: 0 },
        achievements: []
      };
      this.save();
    }
    // Retro-compatibilite si des champs manquent (mise a jour du jeu)
    this.data.owned = this.data.owned || ['hat_none', 'frame_none', 'color_none', 'title_none'];
    this.data.equipped = this.data.equipped || { hat: 'hat_none', frame: 'frame_none', nameColor: 'color_none', title: 'title_none' };
    this.data.stats = this.data.stats || { gamesPlayed: 0, wins: 0 };
    this.data.achievements = this.data.achievements || [];
    return this.data;
  },

  save() {
    localStorage.setItem('lg_profile', JSON.stringify(this.data));
  },

  addCoins(n) {
    this.data.coins += n;
    this.save();
  },

  owns(itemId) { return this.data.owned.includes(itemId); },

  buy(category, itemId) {
    const item = (SHOP_ITEMS[category] || []).find(i => i.id === itemId);
    if (!item || this.owns(itemId)) return false;
    if (item.achievementLocked) return false; // s'obtient par succes, pas a l'achat
    if (this.data.coins < item.price) return false;
    this.data.coins -= item.price;
    this.data.owned.push(itemId);
    this.save();
    return true;
  },

  equip(category, itemId) {
    if (!this.owns(itemId)) return false;
    this.data.equipped[category] = itemId;
    this.save();
    return true;
  },

  unlockFree(itemId) {
    if (!this.owns(itemId)) { this.data.owned.push(itemId); this.save(); }
  },

  grantAchievement(key) {
    if (this.data.achievements.includes(key)) return null;
    const ach = ACHIEVEMENTS[key];
    if (!ach) return null;
    this.data.achievements.push(key);
    this.data.coins += ach.reward;
    if (key === 'wolf_win') this.unlockFree('title_terreur');
    if (key === 'village_win') this.unlockFree('title_legende');
    this.save();
    return ach;
  },

  // Calcule et applique les recompenses de fin de partie. Retourne un
  // resume { coinsEarned, newAchievements } pour affichage.
  applyGameResult({ won, survived }) {
    let coinsEarned = 0;
    const newAchievements = [];

    coinsEarned += 10; // participation
    if (won) coinsEarned += 20;
    if (survived) coinsEarned += 10;

    this.data.stats.gamesPlayed += 1;
    if (won) this.data.stats.wins += 1;
    this.save();
    this.addCoins(coinsEarned);

    const check = (key, cond) => { if (cond) { const a = this.grantAchievement(key); if (a) newAchievements.push({ key, ...a }); } };
    check('first_game', this.data.stats.gamesPlayed >= 1);
    check('five_games', this.data.stats.gamesPlayed >= 5);
    check('twenty_games', this.data.stats.gamesPlayed >= 20);
    check('first_win', won);
    check('survivor', survived);

    return { coinsEarned, newAchievements };
  },

  getEquippedCosmetics() {
    const eq = this.data.equipped;
    const hat = SHOP_ITEMS.hat.find(i => i.id === eq.hat) || SHOP_ITEMS.hat[0];
    const frame = SHOP_ITEMS.frame.find(i => i.id === eq.frame) || SHOP_ITEMS.frame[0];
    const nameColor = SHOP_ITEMS.nameColor.find(i => i.id === eq.nameColor) || SHOP_ITEMS.nameColor[0];
    const title = SHOP_ITEMS.title.find(i => i.id === eq.title) || SHOP_ITEMS.title[0];
    return {
      hatIcon: hat.icon || '',
      frameClass: frame.className || '',
      nameColorClass: nameColor.className || '',
      titleLabel: title.label || ''
    };
  }
};

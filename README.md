# 🐺 LOUPS-GAROUS NOUVELLE GENERATION — En ligne (V9)

Jeu du Loup-Garou multijoueur en temps réel, jouable dans le navigateur, entre amis, avec des inconnus, ou avec des bots. De 1 a 50 joueurs.

## V9 — Les bots ecoutent et suivent vraiment les loups humains

Correctif cible sur un vrai probleme signale : dans le chat prive des loups, un loup humain qui demandait de changer de cible n'etait pas suivi par le bot, qui forcait l'inverse (le joueur humain devait s'aligner sur le bot au lieu du contraire).

- 🐺 **Priorite systematique au loup humain** : dans un groupe de loups mixte (humain + bots), les bots se rallient desormais TOUJOURS au choix du loup humain plutot qu'a un choix de bot ou a un tirage au sort. S'il n'y a que des bots, ils convergent entre eux comme avant.
- 🔁 **Reconciliation continue** : si le loup humain change d'avis en cours de nuit, les bots s'en apercoivent et changent de cible avec lui — ce n'etait pas le cas avant (les bots ne votaient qu'une seule fois et n'y revenaient jamais).
- 💬 **Vraie ecoute du chat des loups** : quand un loup humain ecrit un message dans le chat prive mentionnant le nom d'une cible, les bots-loups le "lisent", changent leur vote pour suivre cette suggestion, et repondent naturellement dans le chat ("D'accord, va pour {nom}.", "Ok, je change pour {nom}."), au lieu de rester silencieux et robotiques.
- 💬 **Chat du village plus vivant** : les bots reagissent parfois (pas a chaque message, pour ne pas spammer) aux messages des joueurs humains en journee, en mentionnant le nom cite et en donnant un avis (d'accord / pas convaincu), plutot que d'envoyer des messages generiques sans lien avec la conversation.
- ✅ **Teste** : un test d'integration simule exactement le scenario signale (loup humain qui vote, puis change d'avis, puis l'exprime au chat) et verifie que le bot suit a chaque etape.

## Nouveautes V8 (toujours presentes)

- 🎵 Vraie musique d'ambiance generative (menu / nuit / jour), plus un simple bourdonnement
- 🖱️ Bruitage de clic sur tous les boutons
- 🗣️ Voix du narrateur corrigee (pitch naturel, meilleure selection de voix)
- 📱 Passe complete d'adaptation mobile (plus de debordement horizontal, tailles fluides, HUD repense)

## Nouveautes V7 (toujours presentes)

- 🐛 Correctif critique : la nuit se resout desormais toujours automatiquement (petit compte a rebours) une fois que tout le monde a fini.

## Nouveautes V5/V6 (toujours presentes)

- 🪙 Monnaie gagnée en jouant (pas d'argent réel) + boutique cosmétique 100% visuelle
- 🏆 7 succès à débloquer, 🔗 lien d'invitation, ✂️ exclure un joueur (hôte), 🔉 volume ajustable
- 🐺 Les loups doivent vraiment se mettre d'accord sur UNE victime (consensus), avec chat privé qui s'active automatiquement
- 🔮 La Voyante (et le Renard) voient vraiment leur résultat, avec un accusé de lecture avant de continuer
- 🌙 La nuit n'a pas de minuteur pour les décisions ; seule la journée a une durée fixée à l'avance
- 🔁 On peut changer d'avis (loups, votes, Salvateur, Corbeau, Loup Blanc) avant que l'étape ne soit validée

## Nouveautes V3/V4 (toujours presentes)

- 🤖 Bots (IA) ajoutables dans le lobby
- 🌍 Salles publiques / matchmaking, partie aléatoire
- 👥 1 à 50 joueurs, nombre de loups adapté automatiquement
- 🎭 6 rôles supplémentaires : Idiot du Village, Ancien, Corbeau, Renard, Voleur, Loup Blanc
- ⏭️ Passer son tour, tour de parole adaptatif, "Forcer le passage" côté hôte, rappel de rôle

## ⚠️ A propos de la communication vocale

Un vrai vocal en direct façon "WePlay" demande une infrastructure serveur dediee (SFU/relais media) des qu'on depasse une poignee de joueurs — un site statique + Firebase ne peut pas tenir ça a 50 joueurs de façon fiable. Choix assume : le chat texte est boosté avec un vrai tour de parole adaptatif + passer son tour + debat libre garanti, a la place. Voir plus bas pour des pistes serieuses (Daily.co, LiveKit) si tu veux investir dans une vraie infra un jour.

## ⚠️ Limites connues (honnêtes, pas cachées)

- **La monnaie et les objets sont stockes localement dans le navigateur** (`localStorage`), pas sur un compte en ligne. Si tu changes de navigateur, d'appareil, ou vides les donnees de site, tu perds ta progression. Ce n'est pas un vrai systeme de compte avec connexion — en ajouter un demanderait une authentification et une base de donnees utilisateurs securisee, hors de portee d'un site 100% statique.
- Regles Firebase ouvertes (`.read/.write: true`) : suffisant entre amis ou en public detendu, pas un systeme anti-triche/anti-abus robuste. Rien n'empeche techniquement quelqu'un de bidouiller son solde de pieces localement — puisque ca ne donne aucun avantage de jeu, l'enjeu est nul.
- Si l'hote ferme completement son onglet en pleine partie, la resolution s'arrete (pas de bascule automatique vers un autre hote).
- Regle de fin simplifiee pour le Loup Blanc.
- **Consensus des loups avec des bots** : les loups-bots se rallient automatiquement au premier vote deja exprime pour converger vers l'unanimite. Si des loups humains votent ensuite pour quelqu'un d'autre, les bots ne changeront pas spontanement d'avis (ils n'agissent qu'une fois) — il faut alors qu'un joueur humain vote pour la meme cible que les bots, ou que l'hote force le passage. En pratique ca se resout tres vite puisque le nombre de loups reste petit.

## Fonctionnalités de base (V1/V2, toujours presentes)

- Roles : Loup-Garou, Villageois, Voyante, Sorciere, Chasseur, Cupidon, Petite Fille, Salvateur, Bouc Emissaire, Maire + les 6 roles V3
- Cycle Nuit -> Jour (reveil, debat, vote) -> Nuit... jusqu'a victoire d'un camp
- Narrateur vocal (synthese vocale navigateur) + ambiance sonore generee en direct (Web Audio API)
- Chat en temps reel : canal Village, canal prive Loups (+ Loup Blanc), canal Fantomes
- Reactions emoji volantes en direct
- Reconnexion automatique
- 100% cote client (HTML/CSS/JS vanilla) + Firebase Realtime Database, hebergeable gratuitement sur GitHub Pages

## Mise en route (5 minutes)

### 1. Cree ton projet Firebase (gratuit)

1. Va sur https://console.firebase.google.com et cree un projet
2. Ajoute une Web App (icone `</>`)
3. Copie la config fournie dans `js/firebase-config.js` (remplace les `REMPLACE_MOI`)
4. Dans "Build > Realtime Database", cree une base (region europe-west1 par ex.)
5. Onglet "Regles", mets pour demarrer simplement :
   ```json
   { "rules": { ".read": true, ".write": true } }
   ```

### 2. Teste en local

```bash
npx serve .
```
Firebase ne fonctionne pas en `file://`, il faut un vrai serveur local ou en ligne.

### 3. Deploie sur GitHub Pages

```bash
git init
git add .
git commit -m "Loups-Garous en ligne V3"
git remote add origin https://github.com/TON-COMPTE/loup-garou.git
git push -u origin main
```
Puis Settings du repo > Pages > Source: branche `main`, dossier `/ (root)`.

## Structure des fichiers

```
loup-garou/
├── index.html            Toutes les vues (accueil, salles publiques, lobby, jeu, fin)
├── css/style.css          Theme + toutes les animations
└── js/
    ├── firebase-config.js    Config Firebase (a remplir)
    ├── roles.js               Roles + distribution (1 a 50 joueurs)
    ├── ui.js                  Navigation d'ecrans, toasts
    ├── narrator.js            Narrateur vocal (Web Speech API)
    ├── sfx.js                  Sons generes en direct (Web Audio API)
    ├── music.js                Musique d'ambiance generative (accords + arpege)
    ├── shop.js                  Profil, monnaie, boutique cosmetique, succes
    ├── host-engine.js         Machine a etats (executee par le client hote)
    ├── bots.js                 IA des bots (executee par le client hote)
    └── game.js                  Rendu temps reel + actions joueurs + matchmaking
```

## Pistes d'amelioration futures

- Vrai vocal via un service tiers (Daily.co / LiveKit) si tu veux investir dans une infra dediee
- Failover d'hote automatique si l'hote quitte en pleine partie
- Regles Firebase plus strictes + moderation des salles publiques
- Historique/replay de partie, statistiques de victoires

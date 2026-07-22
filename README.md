# 🐺 LOUPS-GAROUS NOUVELLE GENERATION — En ligne (V7)

Jeu du Loup-Garou multijoueur en temps réel, jouable dans le navigateur, entre amis, avec des inconnus, ou avec des bots. De 1 a 50 joueurs.

## V7 — Correctif critique : la nuit ne finissait jamais

Un vrai bug bloquant a ete trouve et corrige : en V6, une fois que tout le monde avait fini ses actions de nuit, la derniere etape interne ("resolution") n'avait aucune condition pour se declencher automatiquement — resultat, la nuit restait bloquee indefiniment sans que l'hote force manuellement le passage. Corrige : des que tout le monde a fini, un **petit compte a rebours de quelques secondes** se declenche ("le village sombre dans un sommeil profond..."), puis la nuit se resout automatiquement, puis le jour se leve normalement. Les etapes ou un joueur doit encore reflechir restent, elles, sans limite de temps comme demande.

Ce correctif a ete verifie avec un test d'integration automatise simulant un cycle complet (vote des loups → Voyante avec accuse de lecture → compte a rebours → reveil du village), en plus des tests de distribution des roles de la V6.

## Nouveautes V5/V6 (toujours presentes)

- 🪙 Monnaie gagnée en jouant (pas d'argent réel) + boutique cosmétique 100% visuelle
- 🏆 7 succès à débloquer, 🔗 lien d'invitation, ✂️ exclure un joueur (hôte), 🔉 volume ajustable
- 🐺 Les loups doivent vraiment se mettre d'accord sur UNE victime (consensus), avec chat privé qui s'active automatiquement
- 🔮 La Voyante (et le Renard) voient vraiment leur résultat, avec un accusé de lecture avant de continuer
- 🌙 La nuit n'a pas de minuteur pour les décisions ; seule la journée a une durée fixée à l'avance
- 🔁 On peut changer d'avis (loups, votes, Salvateur, Corbeau, Loup Blanc) avant que l'étape ne soit validée
- 🐛 Plus aucune étape de nuit ne peut rester bloquée faute de titulaire du rôle

## Nouveautes V4 (toujours presentes)

- ⏭️ Passer son tour pendant le tour de parole
- 🎙️ Tour de parole adaptatif à la durée de débat, avec débat libre garanti
- 👀 Aperçu "à suivre", mise en surbrillance du joueur qui parle
- 📊 Barres de progression en direct pendant les votes
- ⏭️ "Forcer le passage" côté hôte en cas d'absence d'un joueur
- 🎭 Rappel de rôle à tout moment via le HUD

## Nouveautes V3 (toujours presentes)

- 🤖 Bots (IA) ajoutables dans le lobby, qui votent, jouent leur rôle la nuit et discutent au chat
- 🌍 Salles publiques / matchmaking, partie aléatoire
- 👥 1 à 50 joueurs, nombre de loups adapté automatiquement
- 🎭 6 rôles supplémentaires : Idiot du Village, Ancien, Corbeau, Renard, Voleur, Loup Blanc

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

# 🐺 LOUPS-GAROUS NOUVELLE GENERATION — En ligne (V11)

Jeu du Loup-Garou multijoueur en temps réel, jouable dans le navigateur, entre amis, avec des inconnus, ou avec des bots. De 1 a 50 joueurs.

## V11 — Des bots qui parlent vraiment comme des humains

Refonte complete du dialogue des bots en journee, pour que ca ressemble a une vraie conversation plutot qu'a des phrases toutes faites sans rapport avec la partie :

- 🔍 **Aider sans dénoncer** : la Voyante (bot) qui a sondé quelqu'un et découvert que c'est un loup ne va JAMAIS l'annoncer frontalement ("c'est un loup !"). Elle glisse plutôt un soupçon discret et humain ("j'ai un mauvais pressentiment sur {nom}", "je me méfierais de {nom} si j'étais vous..."), exactement comme le ferait un joueur qui préfère orienter le village sans se griller. A l'inverse, si son info est rassurante, elle défend discrètement la personne. Testé : aucun indice ne mentionne jamais explicitement le rôle découvert.
- 💬 **Vraies réponses, pas des phrases hors-sujet** : chaque message d'un bot est désormais généré à partir de ce qui se passe réellement — une réaction à ce que le dernier message disait (suspicion, confiance, question), une référence à la mort de la nuit précédente, ou une remarque adaptée au stade de la partie (début prudent vs fin de partie tendue). Fini les lignes génériques sans lien avec le moment.
- 🔁 **Les bots se répondent aussi entre eux** : avant, un bot ignorait systématiquement les messages d'un autre bot (pour éviter les boucles). Il peut désormais occasionnellement réagir à un autre bot aussi (avec une limite pour ne pas partir en boucle infinie et laisser la place aux humains), ce qui donne une vraie ambiance de village qui discute plutôt que des monologues isolés.
- ✅ **Testé** : détection du ton d'un message, indices qui ne dénoncent jamais explicitement, réponses liées au message reçu, réaction aux morts récentes — tout est vérifié par un test automatisé.

## Nouveautes V10 (toujours presentes)

- 🎗️ Élection du Maire enrichie : candidature facultative, discours à tour de rôle, vote parmi les candidats

## Nouveautes V9 (toujours presentes)

- 🐺 Les bots-loups priorisent et suivent toujours le choix d'un loup humain, y compris s'il change d'avis ou l'exprime dans le chat privé

## Nouveautes V8 (toujours presentes)

- 🎵 Vraie musique d'ambiance generative, 🖱️ bruitage de clic, 🗣️ voix du narrateur corrigee, 📱 adaptation mobile complete

## Nouveautes V7 (toujours presentes)

- 🐛 Correctif critique : la nuit se resout desormais toujours automatiquement une fois que tout le monde a fini.

## Nouveautes V5/V6 (toujours presentes)

- 🪙 Monnaie gagnée en jouant (pas d'argent réel) + boutique cosmétique 100% visuelle
- 🏆 7 succès à débloquer, 🔗 lien d'invitation, ✂️ exclure un joueur (hôte), 🔉 volume ajustable
- 🐺 Les loups doivent vraiment se mettre d'accord sur UNE victime (consensus)
- 🔮 La Voyante (et le Renard) voient vraiment leur résultat, avec un accusé de lecture
- 🌙 La nuit n'a pas de minuteur pour les décisions ; seule la journée a une durée fixée à l'avance

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

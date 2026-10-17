# 🎬 SHOWTIME – Ce soir, c'est vous les stars !

Jeu télévisé interactif pour soirées, jouable dans le navigateur, sans application.
Un écran (ordinateur ou télé) sert de **plateau**, les **smartphones** servent de buzzers.

**Contenu de ce prototype (V1) :**
accueil · création de salon avec QR code et code à 4 lettres · prénoms et avatars ·
écriture secrète · **Grand Quiz** (près de 50 questions, 5 thèmes, bonus de rapidité et de série) ·
**Qui a osé dire ça ?** · classements animés · **Grande Finale** avec compte à rebours, podium et confettis ·
animateur virtuel « Max Paillettes » (textes + voix de synthèse) · bruitages synthétisés ·
mode même pièce et mode à distance · reconnexion automatique des joueurs.

---

## 1. Lancer le jeu chez soi (5 minutes)

Il faut [Node.js](https://nodejs.org) version 18 ou plus récente (prendre la version « LTS »).

```bash
npm install
npm start
```

Le terminal affiche deux adresses :

```
Écran hôte (cet ordinateur) : http://localhost:3000
Depuis un téléphone (même Wi-Fi) : http://192.168.1.42:3000
```

1. Sur l'ordinateur, ouvrez **http://localhost:3000** puis cliquez **Créer un salon**.
   Branchez l'ordinateur sur la télé (HDMI ou recopie d'écran) pour l'effet plateau, et montez le son.
2. Cliquez **Ouvrir le plateau** (ce clic autorise le navigateur à jouer le son et la voix).
3. Chaque joueur **scanne le QR code** avec l'appareil photo de son téléphone, choisit un prénom et un avatar.
4. Réglez le nombre de questions et les thèmes, puis **Lever le rideau !**

> **Windows :** au premier lancement, le pare-feu demande d'autoriser Node.js. Cochez **Réseaux privés**,
> sinon les téléphones ne pourront pas se connecter.
>
> **Le QR code pointe vers une mauvaise adresse ?** (ordinateur avec VPN, plusieurs cartes réseau…)
> Indiquez l'adresse Wi-Fi de l'ordinateur : `set LAN_IP=192.168.1.42 && npm start` (Windows, invite de commandes)
> ou `LAN_IP=192.168.1.42 npm start` (Mac/Linux).

### Tester seul, sans 5 téléphones

Créez un salon, notez son code (ex. `KPRT`), puis dans un **second** terminal :

```bash
npm run bots -- KPRT 3
```

Trois robots rejoignent le salon et jouent au hasard. Vous pouvez aussi ouvrir `http://localhost:3000/play?room=KPRT`
dans plusieurs onglets ou navigateurs (en navigation privée, chaque fenêtre est un joueur différent).

### Test automatique

```bash
npm test
```

Lance un serveur, fait jouer 4 robots une partie complète et vérifie : création, QR code, jonction,
sécurité de base, coupure et reconnexion d'un joueur, toutes les phases, cohérence des scores, « Rejouer ».

### Pendant la partie

| Bouton (en haut à droite) | Effet |
| --- | --- |
| **Suivant ⏭** | passe l'écran en cours (révélation, classement, intro…) |
| **Finale 🏁** | abrège la partie et lance directement le podium |
| 🗣️ / 🔊 | coupe la voix de l'animateur / les bruitages |
| ⛶ | plein écran (conseillé sur la télé) |

Un joueur qui perd le réseau ou verrouille son téléphone **retrouve sa place automatiquement** en rouvrant la page.
L'hôte peut aussi recharger sa page sans perdre la partie.

---

## 2. Jouer à distance (mettre le jeu en ligne)

Le mode « À distance » fonctionne ainsi : l'organisateur **partage l'écran du plateau** dans une visio
(Zoom, Meet, Teams, WhatsApp…) et envoie le lien aux invités, qui jouent sur leur téléphone.
Sur les téléphones, la question et les phrases de l'animateur s'affichent aussi, au cas où la visio est petite.

Pour que des amis éloignés puissent se connecter, le jeu doit être **hébergé sur Internet**.
Solution la plus simple et gratuite : **Render**.

1. Créez un compte sur [GitHub](https://github.com) et déposez-y ce dossier (bouton *Add file → Upload files*,
   sans le dossier `node_modules`).
2. Créez un compte sur [render.com](https://render.com), puis **New → Web Service** et choisissez votre dépôt.
   Render lit le fichier `render.yaml` : build `npm install`, démarrage `npm start`, offre **Free**.
3. Après 2 ou 3 minutes, le jeu est en ligne sur une adresse du type `https://showtime-xxxx.onrender.com`.
   Le QR code utilise automatiquement cette adresse.

**À savoir sur l'offre gratuite de Render :** le serveur s'endort après 15 minutes sans visite ;
la première ouverture prend alors 30 à 60 secondes. Ouvrez la page quelques minutes avant la soirée.
Les parties sont gardées en mémoire : un redémarrage du serveur efface les salons en cours (pas les joueurs, qui n'ont rien à réinstaller).

Alternatives : Railway ou Fly.io (≈ 5 €/mois, pas de mise en veille), ou un petit serveur VPS (≈ 4 €/mois).
Tout hébergeur Node.js qui accepte les WebSockets convient. Variables utiles :
`PORT` (fourni par l'hébergeur) et `PUBLIC_URL` (pour forcer l'adresse utilisée dans le QR code).

---

## 3. Architecture technique

Choix volontairement pragmatique : **un seul serveur Node.js**, aucune base de données, aucun framework front.
Facile à comprendre, à modifier et à héberger pour quelques euros.

```
 Téléphones (play.html) ──┐                        ┌── Écran hôte (host.html)
   actions : répondre,    │   Socket.IO (WebSocket) │   actions : lancer, suivant,
   voter, écrire          ▼                        ▼   réglages, rejouer
                  ┌──────────────────────────────────────┐
                  │ server/index.js  HTTP + temps réel    │
                  │   ├─ salons en mémoire (Map)          │
                  │   ├─ /api/join-info → QR code (SVG)   │
                  │   └─ limitation de débit, nettoyage   │
                  │ server/room.js   machine à états      │
                  │   lobby → writing → roundIntro →      │
                  │   quizQuestion ⇄ quizReveal →         │
                  │   leaderboard → whoVote ⇄ whoReveal → │
                  │   final                               │
                  │ server/animator.js  répliques de Max  │
                  │ server/content/     questions, amorces│
                  └──────────────────────────────────────┘
```

**Principe clé : le serveur fait autorité.** Les minuteurs, les bonnes réponses, les scores et l'enchaînement
des écrans sont calculés côté serveur. Après chaque changement, il envoie à chaque écran **sa propre vue**
de l'état (l'hôte voit qui a répondu ; un joueur voit seulement ses propres réponses ; la bonne réponse n'est
envoyée qu'à la révélation). Conséquences : synchronisation fiable, triche impossible depuis le navigateur,
et reconnexion triviale (on renvoie simplement l'état courant).

| Fichier | Rôle |
| --- | --- |
| `server/index.js` | serveur HTTP, Socket.IO, QR code, codes de salon, sécurité, nettoyage des salons |
| `server/room.js` | règles du jeu : phases, minuteurs, calcul des points, vues hôte/joueur |
| `server/animator.js` | toutes les phrases de l'animateur (remplaçable par une IA plus tard) |
| `server/content/questions.js` | banque de questions du quiz (bonne réponse en premier) |
| `server/content/prompts.js` | amorces de « Qui a osé dire ça ? » |
| `public/index.html` | page d'accueil |
| `public/host.html`, `js/host.js` | plateau TV : animations, minuteur, classement, podium, voix |
| `public/play.html`, `js/play.js` | manette smartphone |
| `public/js/common.js` | bruitages synthétisés (Web Audio), voix (Web Speech), confettis |
| `scripts/bots.js`, `scripts/e2e.js` | robots joueurs et test de bout en bout |

**Barème actuel :**
Quiz : 500 à 1 000 points selon la rapidité, +100 par bonne réponse consécutive (max +300).
Qui a osé dire ça ? : +500 pour qui démasque l'auteur, +200 pour l'auteur par joueur berné.

**Sécurité et données personnelles (minimum raisonnable pour un prototype) :**
aucun compte, aucun cookie de suivi, aucune base de données ; prénoms et réponses vivent en mémoire
le temps du salon puis sont effacés (salon inactif 30 min sans personne, ou 4 h maximum).
Jetons aléatoires pour l'hôte et chaque joueur, actions de l'hôte réservées à l'hôte,
toutes les saisies nettoyées et bornées, affichage sans injection HTML, limitation du nombre de messages,
12 joueurs max par salon.

---

## 4. Plan par étapes

| Étape | Contenu | État |
| --- | --- | --- |
| **V1 – Prototype jouable** | salon + QR, avatars, Grand Quiz, Qui a osé dire ça ?, classements, Grande Finale, animateur texte + voix, mode distant, reconnexion | ✅ ce livrable |
| **V1.1 – Retours de vos tests** | ajuster durées, barème, textes de Max ; enrichir les questions (viser 300+) ; page « règles » | à faire après vos soirées test |
| **V2 – Les 5 manches** | **Défi Surprise** (mimes et défis chronométrés, votes du public) ; **Grand Duel** (2 joueurs en face-à-face, les autres misent des points virtuels) ; **Grande Finale** avec une épreuve dédiée avant le podium ; choix des manches au salon | conception prête : chaque manche = de nouvelles phases dans `room.js` + vues hôte/joueur |
| **V3 – Version commerciale** | découverte gratuite ≈ 15 min puis **Soirée premium à 4,99 €** via Stripe Checkout (paiement côté hôte uniquement, webhook qui « débloque » le salon) ; packs de questions thématiques ; personnalisation (nom de l'équipe, questions perso) ; base de données légère (SQLite/Postgres) pour les achats ; Redis si plusieurs serveurs | à démarrer quand le jeu plaît |
| **V4 – Animateur augmenté** | voix plus naturelles (TTS en ligne), répliques générées par IA à partir du contexte de la partie, avatar animé | l'animateur est déjà isolé dans `animator.js` et `Voice.speak()` |

Pour la limite des 15 minutes gratuites, le point d'accroche existe déjà : chaque salon connaît sa date de création
et la machine à états centralise les transitions ; il suffira d'y vérifier un drapeau `premium` avant de lancer une nouvelle manche.

---

## 5. Personnaliser

- **Ajouter des questions** : `server/content/questions.js`, une ligne par question, **bonne réponse en premier**
  (l'ordre est mélangé automatiquement à chaque partie).
- **Ajouter des amorces** pour « Qui a osé dire ça ? » : `server/content/prompts.js`.
- **Changer les répliques de l'animateur** : `server/animator.js`.
- **Durées** (temps de réponse, révélations…) : constante `DURATIONS` en haut de `server/room.js`.

Après une modification, relancez `npm start` (ou utilisez `npm run dev`, qui redémarre tout seul).

## 6. Limites connues du prototype

- Les parties sont en mémoire : un redémarrage du serveur les efface, et il faut un seul serveur (pas de répartition de charge).
- La voix de synthèse dépend de l'appareil : très naturelle sur Edge (voix « Online/Natural »), plus robotique ailleurs.
  Elle peut être coupée avec 🗣️.
- Sur iPhone, le vibreur n'est pas disponible (limitation d'Apple) ; tout le reste fonctionne.
- Aucune musique : seuls des bruitages générés par le navigateur sont utilisés (aucun droit d'auteur).

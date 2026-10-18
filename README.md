# 🎬 SHOWTIME – Ce soir, c'est vous les stars !

Jeu télévisé interactif pour soirées, jouable dans le navigateur, sans application.
Un écran (ordinateur ou télé) sert de **plateau**, les **smartphones** servent de buzzers.

Dans le salon, l'hôte choisit son programme :

| 🎬 **Le Grand Show** (plusieurs manches, podium final) | ⚡ **Partie rapide** (un seul jeu, 5 à 15 min) |
| --- | --- |
| 🧠 **Le Grand Quiz** : 4 réponses, bonus de rapidité et de série (aussi jouable seul en partie rapide) | 📝 **Le Petit Bac** : une lettre, 5 catégories, « STOP ! », contestation des réponses |
| 🤫 **Qui a osé dire ça ?** : réponses secrètes, devinez l'auteur | 🕵️ **L'Imposteur** : un mot secret pour tous sauf un, indices et votes (3 joueurs min.) |
| 🎭 **Défi Surprise** : mimes à faire deviner, défis notés par le public | 🔤 **Le Mot mystère** : pendu collectif, lettres et mot entier |
| ⚔️ **Le Grand Duel** : face-à-face, le public mise des points virtuels | 🎯 **L'Estimation** : un nombre, le plus proche gagne |

**🎲 Jeux de plateau** (dés, pions, plateau animé à la télé) : 🐴 **Les Petits Chevaux** (2 à 4 joueurs) ·
🎡 **La Roue des Savoirs** (quiz sur plateau, étoiles à collectionner) · 🛤️ **Le Chemin de la Vie** (parcours de vie, fortune virtuelle) ·
📅 **Fin de Mois** (calendrier, factures et bonnes affaires, argent fictif).
Les trois derniers sont *inspirés* de grands classiques, mais avec nos propres noms, plateaux, règles et contenus.

**🃏 Jeux de cartes** (les cartes restent cachées sur chaque téléphone, la table s'affiche à la télé) :
🂡 **La Belote** (4 joueurs en équipes : prise, atout, obligations de fournir/monter/couper, belote-rebelote, dix de der, capot) ·
♠️ **Le Poker** Texas Hold'em (2 à 8, blindes qui montent, tapis et pots annexes) · 👑 **Le Président** (3 à 8, échanges de cartes) ·
🎴 **Le 8 américain** (2 à 8) · 🎰 **Le 21** (blackjack contre le croupier, tous en même temps) · 🃏 **La Bataille royale** (2 à 12).
Jetons et argent toujours **virtuels**.

**✋ Je suis prêt** : dans le salon, chaque joueur se déclare prêt sur son téléphone ; quand tout le monde l'est,
un compte à rebours de 10 s lance la partie (l'hôte peut l'arrêter, ou relancer les retardataires avec « 📣 Qui est prêt ? »).

**🧠 Quiz à thèmes** (350 questions, 25 thèmes à cocher dans le menu d'accueil) :
- **Sport** : Sport général, Football, Foot insolite, Clubs de L1 (18 clubs), Vie des stars du foot (faits publics uniquement), Rugby, Tennis, Sports divers
- **Époques** : Années 80, 90, 2000 · **Culture** : Culture générale, Géographie, Histoire, Cuisine, Hauts-de-France, Animaux, Sciences & espace, Expressions françaises
- **Divertissement** : Musique, Cinéma, Télé & séries, Jeux vidéo · **Société** : Politique & institutions (faits neutres)
- **Pour adultes** : Coquin 🔞 (désactivé par défaut, confirmation « joueurs majeurs », jamais vulgaire, rien sur des personnes réelles)
- À distance, les joueurs qui votent pour le quiz cochent aussi leurs thèmes préférés : les plus demandés sont retenus.


Et partout : QR code et code à 4 lettres, prénoms et avatars, classements animés, **Grande Finale**
avec compte à rebours, podium et confettis, animateur virtuel « Max Paillettes » (textes + voix),
bruitages synthétisés, durée Courte / Normale / Longue, mode même pièce ou à distance,
reconnexion automatique des joueurs.

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
| **⏸️ Pause** | met la partie en pause pour tout le monde (voir ci-dessous) |
| **Suivant ⏭** | passe l'écran en cours (révélation, classement, intro…) |
| **Finale 🏁** | abrège la partie et lance directement le podium |
| 🗣️ / 🔊 | coupe la voix de l'animateur / les bruitages |
| ⛶ | plein écran (conseillé sur la télé) |

Un joueur qui perd le réseau ou verrouille son téléphone **retrouve sa place automatiquement** en rouvrant la page.
L'hôte peut aussi recharger sa page sans perdre la partie.

**📺 Mettre le plateau sur la télé.** Sur l'écran de l'animateur, touchez **📺 Télé** en haut. Trois solutions s'affichent :
1. **Télé connectée** (Smart TV, Android TV, box, console) : ouvrez le navigateur internet de la télé, allez sur l'adresse du site suivie de `/tv` (par exemple `https://votre-site.onrender.com/tv`), puis tapez le **code télé à 6 chiffres** affiché sur l'ordinateur.
2. **Chromecast ou Google TV** : dans Chrome ou Edge, touchez **📡 Caster sur la télé** (ou menu ⋮ → « Caster… »).
3. **Câble HDMI** : ⊞ Windows + P → « Dupliquer ». Sans câble, essayez ⊞ Windows + K (télé compatible Miracast).

Avec les solutions 1 et 2, la télé affiche le spectacle et l'ordinateur reste la télécommande. Le son passe alors sur la télé, et l'ordinateur coupe le sien automatiquement.

**Pause.** Chaque joueur peut mettre la partie en pause avec le bouton ⏸️ en haut de son téléphone, et l'hôte peut le faire avec **⏸️ Pause**.
Tout s'arrête : le minuteur est figé là où il en était. N'importe qui (joueur ou hôte) peut toucher **▶️ Reprendre la partie**, et le jeu repart au même endroit.
Si personne ne reprend dans les **50 minutes**, la partie s'arrête et le classement final s'affiche. Un compte à rebours est visible sur tous les écrans.

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
                  │ server/room.js   salon : joueurs,     │
                  │   minuteur, programme, classements,   │
                  │   finale. Lobby → jeu 1 → classement  │
                  │   → jeu 2 → … → podium                │
                  │ server/rounds/   un module par jeu    │
                  │   (ses phases, ses règles, ses vues)  │
                  │ server/animator.js  répliques de Max  │
                  │ server/content/  questions, mots…     │
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
| `server/room.js` | le salon : joueurs, minuteur, enchaînement des jeux, classements, finale |
| `server/rounds/` | un fichier par jeu (`quiz.js`, `whosaid.js`, `defi.js`, `duel.js`, `petitbac.js`, `undercover.js`, `pendu.js`, `estimation.js`) ; `index.js` en fait le catalogue |
| `server/animator.js` | toutes les phrases de l'animateur (remplaçable par une IA plus tard) |
| `server/content/` | contenus : questions du quiz, amorces, mimes et défis, catégories du Petit Bac, paires de mots, mots mystères, estimations |
| `public/index.html` | page d'accueil |
| `public/host.html`, `js/host.js`, `js/host-games.js` | plateau TV : animations, minuteur, classement, podium, voix, écrans de chaque jeu |
| `public/play.html`, `js/play.js`, `js/play-games.js` | manette smartphone, écrans de chaque jeu |
| `public/js/common.js` | bruitages synthétisés (Web Audio), voix (Web Speech), confettis |
| `scripts/bots.js`, `scripts/e2e.js` | robots joueurs et test de bout en bout |

**Barème actuel :**
- Quiz : 500 à 1 000 points selon la rapidité, +100 par bonne réponse consécutive (max +300).
- Qui a osé dire ça ? : +500 pour qui démasque l'auteur, +200 pour l'auteur par joueur berné.
- Défi Surprise : mime trouvé = +400 pour le mime et +400 pour qui trouve ; défi = 150 points par étoile de moyenne.
- Grand Duel : +600 au vainqueur ; les parieurs gagnent ou perdent leur mise (100, 300 ou 500 points virtuels).
- Petit Bac : 100 par réponse valide et unique, 50 si un autre joueur a la même ; refusée si la majorité conteste.
- L'Imposteur : +500 à chaque citoyen si l'imposteur est démasqué, +1 200 à l'imposteur s'il survit.
- Mot mystère : +50 par lettre trouvée (par occurrence), +300 pour le mot complet (+50 par lettre encore cachée).
- L'Estimation : 500 / 300 / 150 pour les trois plus proches, 1 000 pour une réponse exacte.

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
| **V1 – Prototype jouable** | salon + QR, avatars, Grand Quiz, Qui a osé dire ça ?, classements, Grande Finale, animateur texte + voix, mode distant, reconnexion | ✅ fait |
| **Vague 1 – Plus de jeux** | menu Grand Show / Partie rapide ; **Défi Surprise**, **Grand Duel** ; parties rapides **Petit Bac**, **L'Imposteur**, **Mot mystère**, **L'Estimation** ; réglage de durée | ✅ fait |
| **Vague 2 – Jeux de plateau** | Petits Chevaux, Roue des Savoirs, Chemin de la Vie, Fin de Mois ; nouvelle page d'accueil ; bouton 🏠 Accueil pendant les parties ; choix de la voix | ✅ fait |
| **Vague 3 – Contenu et finitions** | centaines de questions avec niveaux, nouveaux thèmes, animateur plus personnalisé, épreuve dédiée de Grande Finale, règles réglables | à venir |
| **V3 – Version commerciale** | découverte gratuite ≈ 15 min puis **Soirée premium à 4,99 €** via Stripe Checkout (paiement côté hôte uniquement, webhook qui « débloque » le salon) ; packs de questions thématiques ; personnalisation (nom de l'équipe, questions perso) ; base de données légère (SQLite/Postgres) pour les achats ; Redis si plusieurs serveurs | à démarrer quand le jeu plaît |
| **V4 – Animateur augmenté** | voix plus naturelles (TTS en ligne), répliques générées par IA à partir du contexte de la partie, avatar animé | l'animateur est déjà isolé dans `animator.js` et `Voice.speak()` |

Pour la limite des 15 minutes gratuites, le point d'accroche existe déjà : chaque salon connaît sa date de création
et la machine à états centralise les transitions ; il suffira d'y vérifier un drapeau `premium` avant de lancer une nouvelle manche.

---

## 5. Personnaliser

- **Ajouter des questions** : `server/content/questions.js`, `quiz-themes.js` (thèmes) ou `quiz-clubs.js` (clubs), une ligne par question, **bonne réponse en premier**
  (l'ordre est mélangé automatiquement à chaque partie).
- **Ajouter des amorces** pour « Qui a osé dire ça ? » : `server/content/prompts.js`.
- **Changer les répliques de l'animateur** : `server/animator.js`.
- **Mimes, défis, mots, catégories, estimations** : les autres fichiers de `server/content/`.
- **Durées et barèmes** : constantes en haut de chaque fichier de `server/rounds/` (ex. `QUESTION_MS`, `WIN_POINTS`).
- **Ajouter un jeu** : créer un module dans `server/rounds/` sur le modèle de `quiz.js`, l'ajouter au catalogue
  `server/rounds/index.js`, puis ses écrans dans `public/js/host-games.js` et `public/js/play-games.js`.

Après une modification, relancez `npm start` (ou utilisez `npm run dev`, qui redémarre tout seul).

## 6. Limites connues du prototype

- Les parties sont en mémoire : un redémarrage du serveur les efface, et il faut un seul serveur (pas de répartition de charge).
- La voix de synthèse dépend du navigateur. Pour une voix **naturelle et gratuite**, ouvrez le plateau dans **Microsoft Edge**
  puis, dans le menu 🗣️, choisissez une voix marquée ⭐ « Online (Natural) ». Sur Chrome, prenez « Google français ».
- Sur iPhone, le vibreur n'est pas disponible (limitation d'Apple) ; tout le reste fonctionne.
- Aucune musique : seuls des bruitages générés par le navigateur sont utilisés (aucun droit d'auteur).

---

## 7. Comptes, historique, souvenirs et photos

- **Compte facultatif** (page « 👤 Mon répertoire », lien en haut de l'accueil) : e-mail, mot de passe, pseudo et avatar.
  Un joueur connecté retrouve chaque soirée dans son **historique** : jeux joués, classement, **cartes souvenirs** et **photos**.
- **Cartes souvenirs automatiques** : le podium, le buzzer le plus rapide, le bluff de la soirée, la meilleure performance,
  le plus gros pot au poker, le roi du bluff à l'Imposteur, le capot à la belote…
- **📸 Photos** : bouton appareil photo sur chaque téléphone ; la photo s'affiche quelques secondes sur la télé (façon polaroïd)
  et rejoint les souvenirs. L'hôte peut **désactiver les photos** dans le salon ou retirer une photo de l'écran (🗑️).
- **Jouer sans compte puis le créer à la fin** : le bouton « Garder cette soirée » rattache la partie en cours au nouveau compte.
- **Vie privée** : mots de passe chiffrés, photos visibles uniquement par les joueurs de la soirée, chacun peut supprimer
  ses photos ou tout son compte (les classements restent, sans lien avec la personne). Un rappel invite à demander l'accord
  des personnes photographiées avant la première photo.

### Répertoire des adhérents

La page « 👤 Mon répertoire » (lien en haut de l'accueil) est l'espace personnel de chaque adhérent, avec deux onglets :
- **📚 Mes soirées** : l'historique (date, jeux joués, classement, cartes souvenirs, photos).
- **🖼️ Photos et captures** : toutes les images de ses soirées, rangées dans un dossier par soirée (la plus récente en haut),
  à télécharger (⬇️) ou supprimer si on les a envoyées soi-même (🗑️).

Dans une soirée, le bouton **« ➕ Ajouter des photos ou captures »** permet d'ajouter après coup des **captures d'écran**
ou des photos du téléphone ou de l'ordinateur (jusqu'à 20 à la fois, 60 par personne et par soirée). Toutes les images
(PNG, JPEG…) sont réduites et converties en JPEG avant l'envoi. Elles ne sont visibles que par les joueurs de cette soirée,
et elles sont effacées si leur auteur supprime son compte.

### Brancher la base de données Neon (gratuit, 10 minutes)

Sans base de données, tout est enregistré dans le dossier `data/` de l'ordinateur (pratique pour tester chez soi).
En ligne, Render efface ses fichiers à chaque redémarrage : il faut donc une base **Neon** (PostgreSQL gratuit).

1. Allez sur **neon.tech** → **Sign up** (connexion possible avec GitHub ou Google). Aucune carte bancaire n'est demandée.
2. Créez un projet : nom `showtime`, région **Europe (Frankfurt)**, version PostgreSQL proposée par défaut.
3. Sur le tableau de bord, cliquez **Connect** : copiez la « Connection string » qui commence par `postgresql://…`
   (gardez-la secrète : c'est la clé de votre base).
4. Sur **Render** → votre service *Showtime* → **Environment** → **Add Environment Variable** :
   *Key* = `DATABASE_URL`, *Value* = la chaîne copiée → **Save changes**. Render redémarre le jeu.
5. Dans les journaux Render (**Logs**), vous devez voir `💾 Stockage : PostgreSQL`. Les tables se créent toutes seules.

L'offre gratuite de Neon (0,5 Go) permet de garder plusieurs milliers de photos (elles sont réduites à ~150 Ko sur le téléphone).

## 8. Jouer à distance : écran sur le téléphone et vote des jeux

- **📺 Écran partagé** : en mode « À distance », chaque joueur voit le **plateau télé en direct sur la moitié haute de son
  téléphone** (questions, plateaux, cartes, classements, podium…) et sa manette en dessous. Plus besoin de partager l'écran en visio.
  Boutons « ⤢ Agrandir » et « ✕ Masquer » ; en mode « Même pièce », chacun peut l'afficher avec « 📺 Voir l'écran ».
  Le son et la voix de l'animateur s'activent en touchant 🔊 sur le mini-écran.
- **🗳️ Vote des jeux** : dans le salon, chaque joueur vote sur son téléphone pour le jeu qu'il veut (Grand Show, quiz,
  plateaux, cartes). La télé affiche le décompte en direct ; au lancement (bouton de l'hôte ou « tous prêts »), le jeu le plus
  voté est lancé, avec tirage au sort en cas d'égalité. Activé d'office à distance ; l'hôte peut choisir « 🎛️ Je choisis ».

### 💬 Le chat entre joueurs à distance
En mode « 🌍 À distance », chaque téléphone a un bouton **💬** (avec une pastille pour les messages non lus). On peut écrire des messages (200 caractères maximum, un par seconde au plus) ou envoyer une réaction rapide 😂 👏 🔥 😱 ❤️ 🤔.
Les messages s’affichent aussi quelques secondes en bulles sur l’écran principal — **sauf pendant les jeux privés pour adultes**, où ils restent sur les téléphones.
L’animateur peut couper le chat dans le salon (réglage « Chat »). Dans la même pièce, le chat n’apparaît pas.
## 9. Jeu privé pour adultes : « Entre nous » 🔥

Un jeu à **deux exactement**, pour les couples, rangé dans la famille « 🔞 Pour adultes » (accueil et « Changer de jeu »).
Une confirmation « adultes consentants » est demandée avant de l'ouvrir. Il ne fait jamais partie des votes ni du Grand Show.

- **Trois niveaux**, choisis dans le salon : 💗 Douceur (tendresse, compliments), 💞 Complicité (massages, baisers),
  🔥 Audace (pour pimenter, toujours avec l'accord de l'autre).
- **Quatre types d'étapes** : « Je te connais » (l'un répond, l'autre devine), Vérité, Défi, Envie secrète.
- **Consentement** : chaque vérité ou défi peut être passé avec le **Joker**. Pour les envies secrètes, seules celles où
  les deux ont dit « oui » ou « peut-être » sont révélées ; un « non » n'est **jamais** dévoilé.
- **Confidentialité** : les questions ne s'affichent que sur les deux téléphones ; la télé montre seulement
  « Regardez vos téléphones ». **Rien n'est enregistré** (ni historique, ni souvenirs) et les **photos sont désactivées**.
- Durée : courte (8 étapes), normale (12) ou longue (16). À la fin, chacun retrouve sur son téléphone la liste des envies partagées.
- Contenus modifiables dans `server/content/couple.js`.
## 10. Les jeux télé 📺

Six jeux inspirés des grands formats de la télé, avec nos propres noms, plateaux et règles :

| Jeu | Le principe |
| --- | --- |
| 🟥 **Lettre à Lettre** | La première lettre du mot est donnée. Chacun son tour, on propose un mot de la bonne longueur : case **rouge** = lettre bien placée, rond **jaune** = lettre mal placée. Six essais ; plus on trouve vite, plus ça rapporte. |
| 🔺 **Mot pour Mot** | Un joueur voit un mot secret sur son téléphone et donne **un seul mot d’indice**. Les autres ont une réponse par indice. Trouvé au 1er indice : 400 points pour le devineur **et** pour celui qui fait deviner, puis 300, 200, 100. (2 joueurs minimum) |
| 📊 **Le Grand Sondage** | « Nous avons demandé à 100 personnes… » Chacun tape ses réponses : la première personne qui découvre une réponse du tableau gagne ses points. 4 essais par question. Le sondage est imaginaire (nos propres chiffres). |
| 🔠 **La Roue des Lettres** | Chacun son tour : on fait tourner la roue, on propose une consonne (chaque lettre trouvée vaut la somme de la roue), on achète une voyelle (250) ou on tente de résoudre. **Banqueroute** remet la cagnotte à zéro ! Celui qui résout gagne sa cagnotte + 300. |
| 🏝️ **L’Île des Défis** | Deux tribus s’affrontent sur des épreuves au téléphone : la course aux noix de coco (tapez le plus vite possible), les poteaux (gardez le doigt appuyé, le dernier en place gagne) et le défi des sages (quiz). La tribu perdante vote **en secret** au conseil pour éliminer l’un des siens (qui rejoint le jury). Les survivants s’affrontent enfin sur les poteaux : le dernier debout gagne ! (4 joueurs minimum) |
| 💕 **Les Tourtereaux** | Les joueurs forment des duos (un trio si le nombre est impair). À chaque manche, une question porte sur l’un des deux (« Quel est le plat préféré de Lou ? ») : il répond pour lui en secret, son partenaire devine. Réponses identiques : +200 chacun ! Si c’est presque pareil, les autres joueurs votent « ça compte ? » ; à deux, c’est la personne concernée qui valide. |

On les trouve dans la famille « 📺 Jeux télé » de l’accueil et du menu des jeux, et les joueurs à distance peuvent voter pour eux.

### Brûlant 🌶️ (Action ou Vérité coquin pour couple)
Dans la famille « 🔞 Pour adultes ». À deux exactement, chacun sur son téléphone : on choisit **Action** ou **Vérité**, et la température monte au fil des tours (🌶️ sensuel → 🌶️🌶️ coquin → 🌶️🌶️🌶️ osé), sans dépasser le niveau choisi dans le salon (« Jusqu’à… »).
Consentement : joker toujours possible, et le partenaire peut répondre **« Pas ce soir 🙅 »** à n’importe quelle action, sans pénalité.
Confidentialité : comme pour « Entre nous », l’écran principal ne montre jamais les cartes, rien n’est enregistré et les photos sont désactivées. Confirmation 18+ à l’ouverture.

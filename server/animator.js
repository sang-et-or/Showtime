// L'animateur virtuel « Max Paillettes ».
// Toutes ses répliques passent par ce module : il renvoie du texte, que l'écran hôte
// affiche et lit en synthèse vocale. Pour faire évoluer l'animateur (IA générative,
// voix enregistrées, avatar animé…), il suffit de remplacer ces fonctions : le reste
// du jeu ne connaît que `animator.xxx(...) -> string`.

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const NAME = 'Max Paillettes';

const lines = {
  welcome: () => pick([
    `Bonsoir, bonsoir ! Ici ${NAME}. Sortez vos téléphones, scannez le code… et devenez les stars de la soirée !`,
    `Mesdames et messieurs, bienvenue sur le plateau de SHOWTIME ! Je suis ${NAME}, et ce soir, c'est VOUS les stars !`,
  ]),
  playerJoined: (name) => pick([
    `Accueillons ${name} sous les projecteurs !`,
    `${name} entre sur le plateau, quelle classe !`,
    `Voici ${name} ! Le public est en délire !`,
    `${name} est là ! On sent déjà l'odeur de la victoire… ou de la panique.`,
    `Un tonnerre d'applaudissements pour ${name} !`,
  ]),
  writingIntro: () => pick([
    `Avant de commencer, un petit travail d'écriture ! Répondez en secret sur vos téléphones. Soyez drôles… on saura peut-être que c'était vous !`,
    `Premier exercice : répondez anonymement aux questions sur vos téléphones. Lâchez-vous, personne ne saura… enfin, presque.`,
  ]),
  writingWait: (names) => `On attend encore ${names}. Pas de pression… mais tout le monde vous regarde.`,
  quizIntro: () => pick([
    `Première manche : le Grand Quiz ! Bonne réponse, c'est des points. Réponse rapide, c'est encore plus de points !`,
    `Place au Grand Quiz ! Culture, musique, cinéma, sport… Plus vous êtes rapides, plus vous gagnez !`,
  ]),
  question: (i, total, cat) => i === total
    ? `Dernière question, catégorie ${cat}. Tout peut encore basculer !`
    : pick([`Question ${i} sur ${total}, catégorie ${cat} !`, `Question ${i}, on parle ${cat} !`, `Catégorie ${cat}, question ${i} sur ${total}. Concentration !`]),
  allWrong: () => pick([
    `Personne ! Absolument personne ! Je vais devoir appeler vos anciens professeurs.`,
    `Zéro bonne réponse… Le silence est assourdissant.`,
  ]),
  allRight: () => pick([`Tout le monde a trouvé ! C'était trop facile, ou vous êtes des génies ?`, `Sans faute général ! Je suis ému.`]),
  fastest: (name) => pick([
    `${name} a dégainé le plus vite ! Quels réflexes !`,
    `Le plus rapide, c'est ${name}. Des doigts en or !`,
    `${name}, plus rapide que son ombre !`,
  ]),
  leaderboard: (leader, last) => pick([
    `${leader} est en tête ! ${last}, ne lâche rien, le spectacle n'est pas fini.`,
    `${leader} mène la danse. ${last}… on y croit encore. Un peu.`,
    `En tête, ${leader} ! Et ${last} nous prépare sûrement une remontée historique.`,
  ]),
  whoSaidIntro: () => pick([
    `Manche suivante : Qui a osé dire ça ? Je lis une réponse, vous devinez qui l'a écrite. Et si personne ne vous démasque, vous marquez des points !`,
    `Qui a osé dire ça ? Démasquez l'auteur de chaque réponse… ou bluffez pour ne pas être reconnu !`,
  ]),
  whoSaidSkip: () => `Pas assez de réponses secrètes pour la manche Qui a osé dire ça. Vous êtes bien timides ce soir !`,
  whoSaidItem: () => pick([`Quelqu'un a osé écrire ça…`, `Lisez bien. Qui a pu écrire une chose pareille ?`, `Accrochez-vous, voici la réponse suivante.`]),
  whoSaidReveal: (author, found, fooled) => {
    if (found === 0 && fooled > 0) return pick([`C'était ${author} ! Et personne n'a rien vu venir. Bluff parfait !`, `${author} ! Agent secret de la soirée, personne n'a rien vu !`]);
    if (fooled === 0 && found > 0) return pick([`C'était ${author}, et tout le monde a trouvé ! Trop prévisible !`, `${author} ! Vous vous connaissez trop bien.`]);
    return pick([`Et c'était… ${author} !`, `C'était… ${author} ! Bravo aux fins limiers.`]);
  },
  // ----- Défi Surprise -----
  defiIntro: () => pick([
    `Défi Surprise ! Chacun son tour, vous recevez un défi secret. Mimes, imitations, performances… le public est votre juge !`,
    `Place au Défi Surprise ! Sortez de votre zone de confort, les caméras tournent !`,
  ]),
  defiTurn: (name) => pick([`${name}, à toi de briller ! Regarde ton téléphone, en toute discrétion.`, `Projecteurs sur ${name} ! Ton défi t'attend sur ton téléphone.`]),
  mimeGo: (name) => pick([`${name} mime en silence ! Criez vos propositions !`, `Silence total pour ${name}… mais vous, criez !`]),
  defiGo: (name) => pick([`À toi, ${name} ! Le public te regarde.`, `Moteur… action, ${name} !`]),
  mimeFound: (perf, finder) => pick([`${finder} a trouvé ! Bravo à ${perf} pour ce mime de génie !`, `Bien joué ${finder} ! Et ${perf}, quel talent d'acteur !`]),
  mimeFail: (perf) => pick([`Personne n'a trouvé… ${perf}, on garde ton numéro pour le théâtre, mais pas tout de suite.`, `Raté ! Le mime de ${perf} restera un mystère.`]),
  defiVote: (name) => pick([`Public, à vos téléphones ! Combien d'étoiles pour ${name} ?`, `Le jury, c'est vous : notez ${name} !`]),
  defiScore: (name, avg) => (avg >= 4
    ? pick([`${avg} étoiles de moyenne pour ${name} ! Une standing ovation !`, `${name} fait un triomphe : ${avg} étoiles !`])
    : avg >= 2.5 ? `${avg} étoiles pour ${name}. Honnête, très honnête !`
      : pick([`${avg} étoiles pour ${name}… Le public est sévère ce soir !`, `${name} récolte ${avg} étoiles. Il y aura une revanche !`])),

  // ----- Grand Duel -----
  duelIntro: () => pick([
    `Le Grand Duel ! Deux stars face à face, premier à 3 points. Et vous, le public, misez sur votre champion !`,
    `L'heure du Grand Duel a sonné ! Un contre un, et le public parie ses points. Qui va tout rafler ?`,
  ]),
  duelBet: (a, b) => pick([`${a} contre ${b} ! Public, faites vos jeux !`, `Ce soir, ${a} affronte ${b}. Misez sur le bon cheval !`]),
  duelPoint: (name) => pick([`Point pour ${name} !`, `${name} dégaine et marque !`, `Et c'est ${name} qui prend le point !`]),
  duelNoPoint: () => pick([`Personne ne marque, la tension monte !`, `Raté des deux côtés !`]),
  duelWin: (name) => pick([`${name} remporte le Grand Duel ! Quelle bataille !`, `Victoire de ${name} ! Les parieurs malins se frottent les mains.`]),
  duelDraw: () => `Match nul ! Les mises sont rendues, tout le monde respire.`,

  // ----- Petit Bac -----
  bacIntro: () => pick([
    `Le Petit Bac ! Une lettre, cinq catégories. Le premier qui a tout rempli peut crier STOP !`,
    `Sortez vos méninges, c'est le Petit Bac ! Réponses originales = plus de points.`,
  ]),
  bacLetter: (letter) => pick([`La lettre est… ${letter} ! C'est parti !`, `Tout commence par la lettre ${letter}. Top chrono !`]),
  bacStop: (name) => pick([`STOP ! ${name} a tout rempli ! Plus que 10 secondes pour les autres !`, `${name} crie STOP ! Dépêchez-vous, 10 secondes !`]),
  bacReview: () => pick([`Vérification ! Contestez les réponses douteuses sur vos téléphones.`, `Place à l'arbitrage : une réponse vous paraît louche ? Contestez-la !`]),
  bacBest: (name) => pick([`${name} remporte cette manche du Petit Bac !`, `Meilleur score pour ${name} !`]),

  // ----- L'Imposteur -----
  undIntro: () => pick([
    `L'Imposteur ! Vous avez tous le même mot secret… sauf un. Donnez un indice chacun votre tour, puis démasquez l'intrus !`,
    `Méfiance ! Un imposteur se cache parmi vous avec un mot différent. Écoutez bien les indices !`,
  ]),
  undClues: (first) => pick([`${first} commence ! Un seul mot d'indice chacun, à voix haute.`, `On fait le tour des indices, en commençant par ${first}.`]),
  undVote: () => pick([`Aux votes ! Qui est l'imposteur ?`, `Le moment de vérité : votez contre le suspect !`]),
  undTie: () => `Égalité ! Personne n'est éliminé, on refait un tour d'indices.`,
  undOut: (name, wasImpostor) => (wasImpostor
    ? pick([`${name} était bien l'IMPOSTEUR ! Bien joué l'équipe !`, `Démasqué ! ${name} était l'imposteur !`])
    : pick([`${name} n'avait rien à se reprocher… Oups ! L'imposteur court toujours.`, `Erreur judiciaire ! ${name} n'était pas l'imposteur.`])),
  undWinCivils: () => pick([`Les citoyens gagnent ! L'imposteur n'a pas tenu le coup.`, `Victoire de l'équipe ! L'intrus a été démasqué.`]),
  undWinImpostor: (names) => pick([`L'imposteur gagne ! Bravo ${names}, quel bluff !`, `${names} vous a tous bernés ! Victoire de l'imposteur !`]),

  // ----- Mot mystère -----
  penduIntro: () => pick([
    `Le Mot mystère ! Proposez des lettres sur vos téléphones. Une bonne lettre rapporte des points, mais attention aux erreurs !`,
    `Mot mystère ! Lettre par lettre… ou tentez le mot entier si vous êtes sûrs de vous !`,
  ]),
  penduWord: (hint) => pick([`Indice : ${hint}. À vos lettres !`, `Nouveau mot ! Petit indice : ${hint}.`]),
  penduSolved: (name) => pick([`${name} a trouvé le mot ! Bravo !`, `Et c'est ${name} qui craque le code !`]),
  penduLost: () => pick([`Perdu ! Le mot vous a échappé.`, `Trop d'erreurs ! Le mot mystère reste un mystère.`]),

  // ----- L'Estimation -----
  estIntro: () => pick([
    `L'Estimation ! Tapez un nombre, le plus proche gagne. Et si vous tombez pile, c'est le jackpot !`,
    `Place à l'Estimation ! Pas besoin de savoir, il faut juste viser juste.`,
  ]),
  estAsk: (i, total) => (i === total ? `Dernière estimation ! Tout se joue maintenant.` : `Estimation ${i} sur ${total} !`),
  estExact: (name) => pick([`PILE ! ${name} a trouvé la réponse exacte ! Incroyable !`, `${name} tombe pile dessus ! Jackpot !`]),
  estClosest: (name) => pick([`${name} vise le plus juste !`, `Le meilleur tir, c'est ${name} !`]),

  // ----- Petits Chevaux -----
  ludoIntro: () => pick([
    `Les Petits Chevaux ! Un 6 ou un 1 pour sortir, un 6 pour rejouer, et pas de pitié pour les adversaires !`,
    `En selle pour les Petits Chevaux ! Que le meilleur cavalier gagne !`,
  ]),
  ludoCapture: (name, victims) => pick([`${name} renvoie ${victims} au box ! Sans pitié !`, `Aïe ! ${name} mange ${victims} !`]),
  ludoHome: (name) => pick([`Un cheval de ${name} rentre à l'écurie !`, `${name} rentre un cheval au paddock !`]),
  ludoSix: (name) => pick([`Un 6 ! ${name} rejoue !`, `Six ! Encore à toi, ${name} !`]),
  ludoWin: (name) => pick([`${name} rentre tous ses chevaux et remporte la course !`, `Victoire au galop pour ${name} !`]),

  // ----- La Roue des Savoirs -----
  roueIntro: () => pick([
    `La Roue des Savoirs ! Avancez, répondez, et collectionnez les étoiles de chaque thème !`,
    `Bienvenue sur la Roue des Savoirs ! Une bonne réponse, et vous rejouez !`,
  ]),
  roueAsk: (name, cat) => pick([`Question ${cat} pour ${name} !`, `${name}, thème ${cat}. Tout le monde peut répondre aussi !`]),
  roueStar: (name, cat) => pick([`Case étoile ! ${name}, une bonne réponse en ${cat} et l'étoile est à toi !`, `Attention, étoile ${cat} en jeu pour ${name} !`]),
  roueRight: (name) => pick([`Bonne réponse, ${name} rejoue !`, `Bravo ${name}, on continue !`]),
  roueStarWon: (name) => pick([`${name} décroche une étoile !`, `Une étoile de plus pour ${name} !`]),
  roueWrong: (name) => pick([`Raté pour ${name}, au suivant !`, `Pas cette fois, ${name}. La main passe !`]),
  roueWin: (name) => pick([`${name} a toutes ses étoiles et remporte la Roue des Savoirs !`, `Bravo ${name}, maître incontesté de la Roue des Savoirs !`]),

  // ----- Jeux de parcours -----
  vieIntro: () => pick([
    `Le Chemin de la Vie ! Études, bébés, maison, coups de chance et coups durs… Qui partira à la retraite le plus riche ?`,
    `Faites tourner la roue de la vie ! Argent fictif, émotions bien réelles !`,
  ]),
  moisIntro: () => pick([
    `Fin de Mois ! Factures, bonnes affaires et loto : qui bouclera son budget avec le plus d'argent ?`,
    `Un mois entier de surprises dans la boîte aux lettres ! Gardez un œil sur votre budget !`,
  ]),

  finalIntro: () => pick([
    `Le moment tant attendu… La Grande Finale ! Roulement de tambour…`,
    `Mesdames et messieurs, voici le classement final. Le suspense est insoutenable !`,
  ]),
  champion: (name) => pick([
    `${name} remporte la couronne ! La grande star de la soirée, c'est ${name} !`,
    `Et la star de ce soir est… ${name} ! Bravo, bravo, bravo !`,
  ]),
};

module.exports = { NAME, ...lines };

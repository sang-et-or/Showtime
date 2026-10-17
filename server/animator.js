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

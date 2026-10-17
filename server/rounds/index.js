// Catalogue des jeux. Pour ajouter un jeu : créer un module dans ce dossier
// (voir quiz.js comme modèle) puis l'ajouter à SHOW_ROUNDS et/ou QUICK_GAMES.
//
// Un module expose :
//   id, title, icon, subtitle, pitch, minPlayers, phases[]
//   introLine(room)            → phrase de l'animateur à l'annonce
//   cannotPlay(room)?          → texte si le jeu ne peut pas avoir lieu (pas assez de joueurs…)
//   begin(room)                → démarre le jeu ; appelle room.finishRound() à la fin
//   act(room, player, msg)     → action d'un joueur
//   check(room)?               → « tout le monde a fini ? » (après une déconnexion)
//   onJoin(room, player)?      → un joueur arrive en cours de jeu
//   hostView(room) / playerView(room, player) → ce qu'affichent la télé et le téléphone

const modules = [
  require('./writing'),
  require('./quiz'),
  require('./whosaid'),
  require('./defi'),
  require('./duel'),
  require('./petitbac'),
  require('./undercover'),
  require('./pendu'),
  require('./estimation'),
  require('./ludo'),
  require('./roue'),
  require('./vie'),
  require('./mois'),
  require('./cards/bataille'),
  require('./cards/blackjack'),
  require('./cards/poker'),
  require('./cards/belote'),
  require('./cards/president'),
  require('./cards/huit'),
];

const ROUNDS = Object.fromEntries(modules.map((m) => [m.id, m]));
const SHOW_ROUNDS = ['quiz', 'whosaid', 'defi', 'duel'];
const QUICK_GAMES = ['quiz', 'petitbac', 'undercover', 'pendu', 'estimation'];
const BOARD_GAMES = ['ludo', 'roue', 'vie', 'mois'];
const CARD_GAMES = ['belote', 'poker', 'president', 'huit', 'blackjack', 'bataille'];

const PHASE_OWNER = new Map();
for (const m of modules) {
  for (const ph of m.phases) {
    if (PHASE_OWNER.has(ph)) throw new Error(`Phase en double : ${ph}`);
    PHASE_OWNER.set(ph, m);
  }
}
const ownerOf = (phase) => PHASE_OWNER.get(phase) || null;

module.exports = { ROUNDS, SHOW_ROUNDS, QUICK_GAMES, BOARD_GAMES, CARD_GAMES, ownerOf };

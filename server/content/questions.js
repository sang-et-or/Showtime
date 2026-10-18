// Banque de questions du Grand Quiz.
// Format : { cat, q, a: [bonne réponse, mauvaise 1, mauvaise 2, mauvaise 3] }
// La bonne réponse est TOUJOURS en premier ici ; l'ordre est mélangé à chaque partie.
// Pour ajouter des questions : copier une ligne, garder la bonne réponse en premier.

// group : famille d'affichage dans le salon ; adult : réservé aux adultes, jamais proposé par défaut.
const CATEGORIES = {
  culture: { label: 'Culture générale', icon: '🧠', group: 'Culture' },
  geo: { label: 'Géographie', icon: '🌍', group: 'Culture' },
  histoire: { label: 'Histoire', icon: '🏰', group: 'Culture' },
  cuisine: { label: 'Cuisine', icon: '🍽️', group: 'Culture' },
  nord: { label: 'Hauts-de-France', icon: '⛏️', group: 'Culture' },
  musique: { label: 'Musique', icon: '🎵', group: 'Divertissement' },
  cinema: { label: 'Cinéma', icon: '🎬', group: 'Divertissement' },
  tele: { label: 'Télé & séries', icon: '📺', group: 'Divertissement' },
  jeux: { label: 'Jeux vidéo', icon: '🎮', group: 'Divertissement' },
  annees80: { label: 'Années 80', icon: '📼', group: 'Époques' },
  annees90: { label: 'Années 90', icon: '💿', group: 'Époques' },
  annees2000: { label: 'Années 2000', icon: '📱', group: 'Époques' },
  sport: { label: 'Sport général', icon: '🏅', group: 'Sport' },
  foot: { label: 'Football', icon: '⚽', group: 'Sport' },
  footfun: { label: 'Foot insolite', icon: '🤪', group: 'Sport' },
  clubs: { label: 'Clubs de L1', icon: '🏟️', group: 'Sport' },
  footpeople: { label: 'Vie des stars du foot', icon: '⭐', group: 'Sport' },
  rugby: { label: 'Rugby', icon: '🏉', group: 'Sport' },
  tennis: { label: 'Tennis', icon: '🎾', group: 'Sport' },
  sportsdivers: { label: 'Sports divers', icon: '🚴', group: 'Sport' },
  politique: { label: 'Politique & institutions', icon: '🏛️', group: 'Société' },
  animaux: { label: 'Animaux', icon: '🦁', group: 'Culture' },
  sciences: { label: 'Sciences & espace', icon: '🔬', group: 'Culture' },
  expressions: { label: 'Expressions françaises', icon: '🗣️', group: 'Culture' },
  coquin: { label: 'Coquin', icon: '🌶️', group: 'Pour adultes', adult: true },
};
// Thèmes proposés par défaut (tout public).
const DEFAULT_CATEGORIES = ['culture', 'musique', 'cinema', 'sport', 'foot'];

const QUESTIONS = [
  // Culture générale
  { cat: 'culture', q: "Quelle est la capitale de l'Australie ?", a: ['Canberra', 'Sydney', 'Melbourne', 'Perth'] },
  { cat: 'culture', q: 'Combien de côtés possède un hexagone ?', a: ['6', '5', '7', '8'] },
  { cat: 'culture', q: 'Quel est le plus grand océan du monde ?', a: ['Pacifique', 'Atlantique', 'Indien', 'Arctique'] },
  { cat: 'culture', q: 'Qui a peint « La Joconde » ?', a: ['Léonard de Vinci', 'Michel-Ange', 'Raphaël', 'Botticelli'] },
  { cat: 'culture', q: "Quel est le symbole chimique de l'or ?", a: ['Au', 'Ag', 'Or', 'Go'] },
  { cat: 'culture', q: 'Combien de pattes a une araignée ?', a: ['8', '6', '10', '12'] },
  { cat: 'culture', q: "En quelle année l'homme a-t-il marché sur la Lune pour la première fois ?", a: ['1969', '1965', '1972', '1959'] },
  { cat: 'culture', q: 'Quelle planète est surnommée « la planète rouge » ?', a: ['Mars', 'Vénus', 'Jupiter', 'Mercure'] },
  { cat: 'culture', q: 'Quel est le plus long fleuve de France ?', a: ['La Loire', 'La Seine', 'Le Rhône', 'La Garonne'] },
  { cat: 'culture', q: "Combien y a-t-il de minutes dans une journée ?", a: ['1 440', '1 240', '1 600', '1 000'] },
  { cat: 'culture', q: "Quel est l'animal terrestre le plus rapide ?", a: ['Le guépard', 'Le lion', "L'antilope", 'Le lévrier'] },
  { cat: 'culture', q: 'Dans quel pays se trouve le Machu Picchu ?', a: ['Pérou', 'Mexique', 'Chili', 'Bolivie'] },
  { cat: 'culture', q: "Combien d'os compte le squelette d'un adulte ?", a: ['206', '186', '226', '312'] },
  { cat: 'culture', q: 'Quel gaz les plantes absorbent-elles pour la photosynthèse ?', a: ['Le dioxyde de carbone', "L'oxygène", "L'azote", "L'hélium"] },

  // Musique
  { cat: 'musique', q: 'Quel groupe a chanté « Bohemian Rhapsody » ?', a: ['Queen', 'The Beatles', 'Pink Floyd', 'The Rolling Stones'] },
  { cat: 'musique', q: 'Combien de cordes possède une guitare classique ?', a: ['6', '4', '5', '7'] },
  { cat: 'musique', q: 'Qui a composé « Les Quatre Saisons » ?', a: ['Vivaldi', 'Mozart', 'Bach', 'Beethoven'] },
  { cat: 'musique', q: 'Quel chanteur français était surnommé « l’idole des jeunes » ?', a: ['Johnny Hallyday', 'Eddy Mitchell', 'Claude François', 'Michel Sardou'] },
  { cat: 'musique', q: 'De quel pays vient le groupe ABBA ?', a: ['Suède', 'Norvège', 'Danemark', 'Pays-Bas'] },
  { cat: 'musique', q: 'Quel artiste est surnommé le « King of Pop » ?', a: ['Michael Jackson', 'Elvis Presley', 'Prince', 'Freddie Mercury'] },
  { cat: 'musique', q: 'Qui a rendu célèbre la chanson « La Vie en rose » ?', a: ['Édith Piaf', 'Dalida', 'Barbara', 'Juliette Gréco'] },
  { cat: 'musique', q: 'Stromae est originaire de quel pays ?', a: ['Belgique', 'France', 'Suisse', 'Canada'] },
  { cat: 'musique', q: 'Combien de touches compte un piano standard ?', a: ['88', '76', '96', '64'] },

  // Cinéma
  { cat: 'cinema', q: 'Dans « Le Roi Lion », comment s’appelle le père de Simba ?', a: ['Mufasa', 'Scar', 'Rafiki', 'Zazu'] },
  { cat: 'cinema', q: 'Quel film de James Cameron sorti en 1997 raconte un célèbre naufrage ?', a: ['Titanic', 'Abyss', 'Avatar', 'Poseidon'] },
  { cat: 'cinema', q: 'Dans « Star Wars », qui est le père de Luke Skywalker ?', a: ['Dark Vador', 'Obi-Wan Kenobi', 'Yoda', 'Han Solo'] },
  { cat: 'cinema', q: 'Quel acteur incarne Jack Sparrow dans « Pirates des Caraïbes » ?', a: ['Johnny Depp', 'Orlando Bloom', 'Brad Pitt', 'Keanu Reeves'] },
  { cat: 'cinema', q: '« Bienvenue chez les Ch’tis » se déroule principalement dans quelle ville ?', a: ['Bergues', 'Lille', 'Dunkerque', 'Calais'] },
  { cat: 'cinema', q: 'Dans « Harry Potter », dans quelle maison Harry est-il envoyé ?', a: ['Gryffondor', 'Serpentard', 'Poufsouffle', 'Serdaigle'] },
  { cat: 'cinema', q: 'Qui a réalisé « Jurassic Park » ?', a: ['Steven Spielberg', 'George Lucas', 'James Cameron', 'Ridley Scott'] },
  { cat: 'cinema', q: 'Dans quel quartier de Paris vit Amélie Poulain ?', a: ['Montmartre', 'Le Marais', 'Belleville', 'Saint-Germain'] },
  { cat: 'cinema', q: 'Comment s’appelle le cow-boy de « Toy Story » ?', a: ['Woody', 'Buzz', 'Jessie', 'Zigzag'] },

  // Sport
  { cat: 'sport', q: 'Combien de joueurs par équipe sont sur le terrain au basket ?', a: ['5', '6', '7', '4'] },
  { cat: 'sport', q: 'Dans quel sport utilise-t-on un volant ?', a: ['Badminton', 'Squash', 'Ping-pong', 'Padel'] },
  { cat: 'sport', q: 'Combien d’anneaux figurent sur le drapeau olympique ?', a: ['5', '4', '6', '7'] },
  { cat: 'sport', q: 'Quelle est la distance officielle d’un marathon ?', a: ['42,195 km', '40 km', '45,5 km', '38,6 km'] },
  { cat: 'sport', q: 'Sur le Tour de France, quelle est la couleur du maillot du leader ?', a: ['Jaune', 'Vert', 'Blanc', 'À pois'] },
  { cat: 'sport', q: 'Quel tournoi du Grand Chelem de tennis se joue sur terre battue ?', a: ['Roland-Garros', 'Wimbledon', "L'US Open", "L'Open d'Australie"] },
  { cat: 'sport', q: 'Quelle ville a accueilli les Jeux olympiques d’été 2024 ?', a: ['Paris', 'Los Angeles', 'Tokyo', 'Londres'] },
  { cat: 'sport', q: 'Au rugby, combien de points rapporte un essai (sans transformation) ?', a: ['5', '3', '4', '7'] },

  // Football
  { cat: 'foot', q: 'Combien de joueurs par équipe sont sur un terrain de football ?', a: ['11', '10', '12', '9'] },
  { cat: 'foot', q: 'Quel pays a remporté la Coupe du monde 2018 ?', a: ['France', 'Croatie', 'Belgique', 'Brésil'] },
  { cat: 'foot', q: 'Quel pays a remporté la Coupe du monde 2022 au Qatar ?', a: ['Argentine', 'France', 'Maroc', 'Croatie'] },
  { cat: 'foot', q: 'Quel Français a reçu le Ballon d’Or en 1998 ?', a: ['Zinédine Zidane', 'Thierry Henry', 'Didier Deschamps', 'Fabien Barthez'] },
  { cat: 'foot', q: 'Combien de temps dure un match de football réglementaire (hors prolongations) ?', a: ['90 minutes', '80 minutes', '100 minutes', '120 minutes'] },
  { cat: 'foot', q: 'Quel club joue ses matchs à domicile au Parc des Princes ?', a: ['Paris Saint-Germain', 'Paris FC', 'Red Star', 'Stade Français'] },
  { cat: 'foot', q: 'Quel pays a remporté le plus de Coupes du monde ?', a: ['Brésil', 'Allemagne', 'Italie', 'Argentine'] },
  { cat: 'foot', q: 'Dans quel stade joue l’Olympique de Marseille ?', a: ['Le Vélodrome', 'Le Groupama Stadium', "L'Allianz Riviera", 'Le stade Pierre-Mauroy'] },
  { cat: 'foot', q: 'Combien vaut un but marqué directement sur coup franc direct ?', a: ['1 but, comme les autres', '2 buts', '1 but et demi', 'Il ne compte pas'] },
];

QUESTIONS.push(...require('./quiz-themes'), ...require('./quiz-themes2'), ...require('./quiz-clubs').QUESTIONS);
// Questions supplémentaires (une trentaine de plus par thème, pour éviter les répétitions).
QUESTIONS.push(...require('./quiz-more1'), ...require('./quiz-more2'), ...require('./quiz-more3'), ...require('./quiz-more4'));
const { CLUBS } = require('./quiz-clubs');

module.exports = { CATEGORIES, DEFAULT_CATEGORIES, QUESTIONS, CLUBS };

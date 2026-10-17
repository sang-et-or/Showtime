// Quiz « Clubs de L1 » : quelques questions par club, sur des faits durables
// (fondation, stade, surnom, couleurs, grands titres). Pas d'effectif actuel, qui change chaque saison.
// Format : { cat: 'clubs', club, q, a: [bonne réponse, ...] }

const CLUBS = {
  psg: { label: 'Paris SG', icon: '🔵' },
  om: { label: 'Marseille', icon: '⚪' },
  ol: { label: 'Lyon', icon: '🦁' },
  lens: { label: 'Lens', icon: '🟡' },
  losc: { label: 'Lille', icon: '🐶' },
  monaco: { label: 'Monaco', icon: '🔴' },
  nice: { label: 'Nice', icon: '🦅' },
  rennes: { label: 'Rennes', icon: '⚫' },
  nantes: { label: 'Nantes', icon: '🐤' },
  strasbourg: { label: 'Strasbourg', icon: '🔷' },
  toulouse: { label: 'Toulouse', icon: '🟣' },
  brest: { label: 'Brest', icon: '⚓' },
  lorient: { label: 'Lorient', icon: '🐟' },
  auxerre: { label: 'Auxerre', icon: '🔹' },
  lehavre: { label: 'Le Havre', icon: '🌊' },
  angers: { label: 'Angers', icon: '🏰' },
  metz: { label: 'Metz', icon: '🐉' },
  parisfc: { label: 'Paris FC', icon: '🗼' },
};

const Q = (club, q, a) => ({ cat: 'clubs', club, q, a });

const QUESTIONS = [
  Q('psg', 'En quelle année le Paris Saint-Germain a-t-il été fondé ?', ['1970', '1904', '1932', '1985']),
  Q('psg', 'Contre quel club le PSG remporte-t-il sa première Ligue des champions en 2025 ?', ['L’Inter Milan', 'Le Real Madrid', 'Le Bayern Munich', 'Manchester City']),
  Q('psg', 'Quel joueur devient en 2023 le meilleur buteur de l’histoire du PSG ?', ['Kylian Mbappé', 'Edinson Cavani', 'Zlatan Ibrahimović', 'Pauleta']),
  Q('psg', 'Quel fonds d’investissement possède le PSG depuis 2011 ?', ['Qatar Sports Investments', 'Red Bird', 'Abu Dhabi United Group', 'Canal+']),

  Q('om', 'En quelle année l’Olympique de Marseille a-t-il été fondé ?', ['1899', '1920', '1945', '1970']),
  Q('om', 'Quelle devise figure sur le blason de l’OM ?', ['« Droit au but »', '« Allez l’OM »', '« Toujours plus haut »', '« À jamais les premiers »']),
  Q('om', 'Qui marque de la tête le but de la victoire en finale de la Ligue des champions 1993 ?', ['Basile Boli', 'Rudi Völler', 'Alen Bokšić', 'Didier Deschamps']),
  Q('om', 'Quelle est la couleur principale du maillot domicile de l’OM ?', ['Blanc', 'Bleu ciel', 'Rouge', 'Noir']),

  Q('ol', 'Combien de titres de champion de France consécutifs l’OL a-t-il gagnés de 2002 à 2008 ?', ['7', '5', '6', '8']),
  Q('ol', 'Dans quelle commune se trouve le stade de l’OL inauguré en 2016 ?', ['Décines-Charpieu', 'Villeurbanne', 'Vénissieux', 'Gerland']),
  Q('ol', 'Quel président a dirigé l’OL de 1987 à 2023 ?', ['Jean-Michel Aulas', 'Bernard Tapie', 'Louis Nicollin', 'Jean-Louis Triaud']),
  Q('ol', 'Quel Brésilien, roi des coups francs, a brillé à l’OL dans les années 2000 ?', ['Juninho', 'Sonny Anderson', 'Fred', 'Cris']),

  Q('lens', 'En quelle année le Racing Club de Lens a-t-il été fondé ?', ['1906', '1923', '1945', '1898']),
  Q('lens', 'Dans quel stade joue le RC Lens ?', ['Bollaert-Delelis', 'Pierre-Mauroy', 'Geoffroy-Guichard', 'La Licorne']),
  Q('lens', 'En quelle année le RC Lens a-t-il été champion de France ?', ['1998', '1977', '2002', '1965']),
  Q('lens', 'Comment surnomme-t-on les joueurs du RC Lens ?', ['Les Sang et Or', 'Les Canaris', 'Les Dogues', 'Les Merlus']),
  Q('lens', 'Quelle chanson de Pierre Bachelet le stade lensois chante-t-il à la mi-temps ?', ['« Les Corons »', '« Elle est d’ailleurs »', '« Emmanuelle »', '« Vingt ans »']),

  Q('losc', 'Comment s’appelle le grand stade du LOSC à Villeneuve-d’Ascq ?', ['Le stade Pierre-Mauroy', 'Le stade Bollaert', 'Le stadium Nord', 'Le stade Grimonprez-Jooris']),
  Q('losc', 'Que signifie le sigle LOSC ?', ['Lille Olympique Sporting Club', 'Lille Omnisports Sporting Club', 'Lille Olympique Stade Club', 'Ligue Olympique du Sport Ch’ti']),
  Q('losc', 'Quel est le surnom des joueurs du LOSC ?', ['Les Dogues', 'Les Lions', 'Les Ch’tis', 'Les Géants']),
  Q('losc', 'Quel club est champion de France 2021, devant le PSG ?', ['Lille', 'Monaco', 'Lyon', 'Marseille']),
  Q('losc', 'En quelle année le LOSC réalise-t-il le doublé Coupe-Championnat avec Eden Hazard ?', ['2011', '2005', '2014', '2021']),

  Q('monaco', 'Dans quel stade joue l’AS Monaco ?', ['Le stade Louis-II', 'L’Allianz Riviera', 'Le stade Rainier-III', 'Le stade du Ray']),
  Q('monaco', 'Contre quel club Monaco perd-il la finale de la Ligue des champions 2004 ?', ['Le FC Porto', 'Le Real Madrid', 'Chelsea', 'Le Bayern Munich']),
  Q('monaco', 'En quelle année Monaco est-il champion de France avec le jeune Kylian Mbappé ?', ['2017', '2014', '2019', '2012']),
  Q('monaco', 'Quelles sont les couleurs de l’AS Monaco ?', ['Rouge et blanc', 'Bleu et blanc', 'Rouge et noir', 'Vert et blanc']),

  Q('nice', 'Comment s’appelle le stade de l’OGC Nice inauguré en 2013 ?', ['L’Allianz Riviera', 'Le stade du Ray', 'Le stade Louis-II', 'Le Vélodrome']),
  Q('nice', 'Quel est le surnom des joueurs de l’OGC Nice ?', ['Les Aiglons', 'Les Faucons', 'Les Dauphins', 'Les Lions']),
  Q('nice', 'Quelles sont les couleurs de l’OGC Nice ?', ['Rouge et noir', 'Bleu et blanc', 'Jaune et vert', 'Violet et blanc']),

  Q('rennes', 'Comment s’appelle le stade du Stade Rennais ?', ['Le Roazhon Park', 'La Beaujoire', 'Le Moustoir', 'Francis-Le Blé']),
  Q('rennes', 'Contre quel club Rennes remporte-t-il la Coupe de France 2019 ?', ['Le PSG', 'Nantes', 'Lyon', 'Guingamp']),
  Q('rennes', 'Quelles sont les couleurs du Stade Rennais ?', ['Rouge et noir', 'Jaune et vert', 'Bleu et rouge', 'Blanc et bleu']),

  Q('nantes', 'Comment s’appelle le stade du FC Nantes ?', ['La Beaujoire', 'Le Roazhon Park', 'La Mosson', 'Le Moustoir']),
  Q('nantes', 'Quel est le surnom des joueurs du FC Nantes ?', ['Les Canaris', 'Les Merlus', 'Les Aiglons', 'Les Dogues']),
  Q('nantes', 'Combien de titres de champion de France le FC Nantes a-t-il remportés ?', ['8', '5', '10', '3']),

  Q('strasbourg', 'Comment s’appelle le stade du RC Strasbourg ?', ['La Meinau', 'Saint-Symphorien', 'Le Stadium', 'Bonal']),
  Q('strasbourg', 'En quelle année le RC Strasbourg a-t-il été champion de France ?', ['1979', '1998', '1965', '2005']),
  Q('strasbourg', 'Quelles sont les couleurs du RC Strasbourg ?', ['Bleu et blanc', 'Rouge et blanc', 'Vert et blanc', 'Jaune et bleu']),

  Q('toulouse', 'Quel est le surnom du Toulouse FC ?', ['Les Violets', 'Les Rouges', 'Les Pitchouns', 'Les Canaris']),
  Q('toulouse', 'Comment s’appelle le stade du Toulouse FC ?', ['Le Stadium', 'Ernest-Wallon', 'La Mosson', 'Chaban-Delmas']),
  Q('toulouse', 'Quel trophée Toulouse remporte-t-il en 2023 ?', ['La Coupe de France', 'Le championnat de France', 'La Coupe de la Ligue', 'Le Trophée des champions']),

  Q('brest', 'Comment s’appelle le stade du Stade Brestois ?', ['Francis-Le Blé', 'Le Moustoir', 'Le Roudourou', 'La Beaujoire']),
  Q('brest', 'À quelle compétition Brest se qualifie-t-il pour la première fois en 2024 ?', ['La Ligue des champions', 'La Ligue Europa Conférence', 'La Coupe Intertoto', 'La Coupe de l’UEFA']),

  Q('lorient', 'Quel est le surnom des joueurs du FC Lorient ?', ['Les Merlus', 'Les Thoniers', 'Les Canaris', 'Les Korrigans']),
  Q('lorient', 'Comment s’appelle le stade du FC Lorient ?', ['Le Moustoir', 'Le Roudourou', 'Francis-Le Blé', 'La Route de Lorient']),

  Q('auxerre', 'Quel entraîneur emblématique a dirigé l’AJ Auxerre pendant plus de 40 ans ?', ['Guy Roux', 'Arsène Wenger', 'Aimé Jacquet', 'Raymond Goethals']),
  Q('auxerre', 'Comment s’appelle le stade de l’AJ Auxerre ?', ['L’Abbé-Deschamps', 'Gaston-Gérard', 'Auguste-Delaune', 'Saint-Symphorien']),
  Q('auxerre', 'En quelle année l’AJ Auxerre réalise-t-elle le doublé Coupe-Championnat ?', ['1996', '1986', '2003', '1999']),

  Q('lehavre', 'Le Havre AC, plus ancien club de France encore en activité, a été fondé en…', ['1872', '1899', '1906', '1920']),
  Q('lehavre', 'Quelles sont les couleurs du Havre AC ?', ['Ciel et marine', 'Rouge et noir', 'Vert et blanc', 'Jaune et noir']),

  Q('angers', 'Comment s’appelle le stade d’Angers SCO ?', ['Raymond-Kopa', 'Jean-Bouin', 'La Licorne', 'Saint-Symphorien']),
  Q('angers', 'Quelles sont les couleurs d’Angers SCO ?', ['Noir et blanc', 'Bleu et blanc', 'Rouge et blanc', 'Jaune et noir']),

  Q('metz', 'Comment s’appelle le stade du FC Metz ?', ['Saint-Symphorien', 'La Meinau', 'Marcel-Picot', 'Auguste-Bonal']),
  Q('metz', 'Quelle est la couleur emblématique du FC Metz ?', ['Grenat', 'Vert', 'Orange', 'Bleu ciel']),

  Q('parisfc', 'Quelle célèbre famille d’entrepreneurs a pris le contrôle du Paris FC en 2024 ?', ['La famille Arnault', 'La famille Pinault', 'La famille Bolloré', 'La famille Bettencourt']),
];

module.exports = { CLUBS, QUESTIONS };

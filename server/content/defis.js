// Contenu du « Défi Surprise ».
// MIMES : le joueur mime le mot en silence, les autres crient leurs propositions.
// DEFIS : petite performance devant tout le monde, notée par le public de 1 à 5 étoiles.

const MIMES = [
  { cat: 'Animal', w: 'Un kangourou' }, { cat: 'Animal', w: 'Un pingouin' }, { cat: 'Animal', w: 'Une girafe' },
  { cat: 'Animal', w: 'Un crabe' }, { cat: 'Animal', w: 'Un serpent' }, { cat: 'Animal', w: 'Un gorille' },
  { cat: 'Animal', w: 'Une poule' }, { cat: 'Animal', w: 'Un éléphant' }, { cat: 'Animal', w: 'Un dauphin' },
  { cat: 'Métier', w: 'Un pompier' }, { cat: 'Métier', w: 'Un dentiste' }, { cat: 'Métier', w: 'Un chef d’orchestre' },
  { cat: 'Métier', w: 'Un coiffeur' }, { cat: 'Métier', w: 'Un pilote d’avion' }, { cat: 'Métier', w: 'Un arbitre de foot' },
  { cat: 'Métier', w: 'Un magicien' }, { cat: 'Métier', w: 'Un serveur de restaurant' }, { cat: 'Métier', w: 'Un photographe' },
  { cat: 'Sport', w: 'Le tennis' }, { cat: 'Sport', w: 'La boxe' }, { cat: 'Sport', w: 'Le ski' },
  { cat: 'Sport', w: 'Le surf' }, { cat: 'Sport', w: 'Le bowling' }, { cat: 'Sport', w: 'L’haltérophilie' },
  { cat: 'Sport', w: 'Le golf' }, { cat: 'Sport', w: 'La natation' }, { cat: 'Sport', w: 'Un penalty' },
  { cat: 'Action', w: 'Se brosser les dents' }, { cat: 'Action', w: 'Faire un selfie' }, { cat: 'Action', w: 'Monter une tente' },
  { cat: 'Action', w: 'Changer une couche' }, { cat: 'Action', w: 'Faire des crêpes' }, { cat: 'Action', w: 'Rater son bus' },
  { cat: 'Action', w: 'Passer l’aspirateur' }, { cat: 'Action', w: 'Promener un chien têtu' }, { cat: 'Action', w: 'Se réveiller en retard' },
  { cat: 'Objet', w: 'Un parapluie' }, { cat: 'Objet', w: 'Une machine à laver' }, { cat: 'Objet', w: 'Un grille-pain' },
  { cat: 'Objet', w: 'Une trottinette' }, { cat: 'Objet', w: 'Un sèche-cheveux' }, { cat: 'Objet', w: 'Une télécommande' },
  { cat: 'Film', w: 'Titanic' }, { cat: 'Film', w: 'Le Roi Lion' }, { cat: 'Film', w: 'Harry Potter' },
  { cat: 'Film', w: 'Les Dents de la mer' }, { cat: 'Film', w: 'Spider-Man' }, { cat: 'Film', w: 'Astérix et Obélix' },
];

const DEFIS = [
  'Imite une poule qui vient de pondre un œuf en or, pendant 20 secondes.',
  'Présente la météo de demain comme si c’était la fin du monde.',
  'Fais la publicité la plus enthousiaste possible pour… une cuillère.',
  'Chante « Joyeux anniversaire » comme un chanteur d’opéra.',
  'Imite quelqu’un de la soirée, sans dire son prénom. Le public doit deviner !',
  'Fais un défilé de mode digne de la Fashion Week jusqu’au bout de la pièce.',
  'Raconte ta journée d’hier comme un commentateur de match de foot survolté.',
  'Danse comme un robot qui découvre la musique pour la première fois.',
  'Fais une déclaration d’amour passionnée à un objet de la pièce.',
  'Imite un singe qui essaie d’ouvrir une banane… sans y arriver.',
  'Dis l’alphabet le plus vite possible, en entier.',
  'Prends la pose de 5 statues célèbres, l’une après l’autre.',
  'Fais le discours de victoire d’un prix que tu viens de gagner (les larmes sont bienvenues).',
  'Mime une partie de tennis contre toi-même, au ralenti.',
  'Vends ton téléphone aux enchères comme un vrai commissaire-priseur.',
  'Raconte « Le Petit Chaperon rouge » en 30 secondes, en accéléré.',
  'Fais 10 secondes de beatbox. Le public est indulgent… normalement.',
  'Imite le bruit d’au moins 5 animaux différents à la suite.',
  'Présente le journal télévisé avec une seule information : « Il y a des chips dans la cuisine ».',
  'Fais rire quelqu’un de ton choix sans le toucher, en 20 secondes.',
  'Récite une recette de cuisine comme si c’était un poème dramatique.',
  'Marche comme un mannequin… sur un sol imaginaire en glace.',
  'Imite un GPS qui a complètement perdu le nord.',
  'Fais une danse de la victoire comme si tu venais de gagner la Coupe du monde.',
];

module.exports = { MIMES, DEFIS };

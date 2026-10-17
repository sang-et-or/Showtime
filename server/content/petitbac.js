// Contenu du Petit Bac : catégories (5 tirées au sort par manche) et lettres jouables.

const CATEGORIES = [
  'Prénom', 'Pays', 'Ville', 'Animal', 'Métier', 'Fruit ou légume', 'Objet de la maison', 'Marque',
  'Célébrité', 'Sport', 'Film ou série', 'Plat ou dessert', 'Couleur', 'Instrument de musique',
  'Moyen de transport', 'Vêtement', 'Personnage de dessin animé', 'Chose qu’on emporte en vacances',
  'Partie du corps', 'Chanteur ou chanteuse', 'Excuse pour ne pas faire la vaisselle', 'Mot qui fait rire',
];

// Lettres « faisables » (pas de K, Q, W, X, Y, Z).
const LETTERS = 'ABCDEFGHIJLMNOPRSTUV'.split('');

module.exports = { CATEGORIES, LETTERS };

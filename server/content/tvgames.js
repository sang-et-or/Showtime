// Contenu des « Jeux télé » de SHOWTIME (nos propres jeux, inspirés des grands formats télé).

// ----- Lettre à Lettre : mots de 6 ou 7 lettres, sans accents (la première lettre est donnée). -----
const MOTUS = [
  'BALCON', 'BATEAU', 'BOUGIE', 'CAMION', 'CANARD', 'CERISE', 'CHEVAL', 'CITRON', 'COUSIN', 'DESSIN',
  'DRAGON', 'ECHARPE', 'ETOILE', 'FAMILLE', 'FENETRE', 'FROMAGE', 'GARAGE', 'GIRAFE', 'GUITARE', 'HIBOU',
  'JARDIN', 'JOUEUR', 'LAPIN', 'LUMIERE', 'MAISON', 'MANEGE', 'MIROIR', 'MOUTON', 'NUAGE', 'ORANGE',
  'PALAIS', 'PAPIER', 'PARAPLUIE', 'PIRATE', 'PLANETE', 'POULET', 'PRINCE', 'QUARTIER', 'RADIO', 'RAISIN',
  'REQUIN', 'RIVIERE', 'ROBOT', 'SALADE', 'SAPIN', 'SOLEIL', 'SOURIS', 'STADE', 'TABLEAU', 'TAMBOUR',
  'TOMATE', 'TORTUE', 'TRESOR', 'VACANCE', 'VALISE', 'VOLCAN', 'VOYAGE', 'ZEBRE', 'CHATEAU', 'CUISINE',
  'MUSIQUE', 'CINEMA', 'PISCINE', 'BOUTEILLE', 'CAROTTE', 'CLAVIER', 'CONCERT', 'COSTUME', 'DOMINO', 'FUSEE',
  'GATEAU', 'HAMSTER', 'JOURNAL', 'LICORNE', 'MARMITE', 'MOUCHOIR', 'PANTALON', 'PINCEAU', 'POMPIER', 'SIRENE',
].filter((w) => w.length >= 6 && w.length <= 8);

// ----- Mot pour Mot : mots à faire deviner avec un seul mot d'indice à la fois. -----
const MOTPOURMOT = [
  'plage', 'avion', 'chocolat', 'football', 'hôpital', 'boulangerie', 'vampire', 'mariage', 'neige', 'pirate',
  'téléphone', 'école', 'cirque', 'dentiste', 'pizza', 'sorcière', 'vacances', 'montagne', 'piscine', 'anniversaire',
  'policier', 'fromage', 'guitare', 'dinosaure', 'fantôme', 'château', 'pompier', 'banane', 'lune', 'désert',
  'robot', 'requin', 'parapluie', 'cinéma', 'bibliothèque', 'train', 'cuisine', 'chaussette', 'volcan', 'trésor',
  'jardin', 'lion', 'miroir', 'bougie', 'clown', 'fusée', 'hiver', 'tortue', 'boxe', 'carnaval',
  'moustache', 'valise', 'sapin', 'ordinateur', 'chameau', 'arc-en-ciel', 'reine', 'cowboy', 'pingouin', 'karaoké',
];

// ----- Le Grand Sondage : notre propre sondage imaginaire (100 personnes). -----
// Chaque réponse : [texte affiché, points, ...variantes acceptées]
const SONDAGE = [
  { q: 'Citez un animal que l’on trouve dans une ferme', a: [['La vache', 32, 'vache', 'veau', 'boeuf'], ['La poule', 24, 'poule', 'coq', 'poussin'], ['Le cochon', 18, 'cochon', 'porc', 'truie'], ['Le mouton', 12, 'mouton', 'brebis', 'agneau'], ['Le cheval', 9, 'cheval', 'poney', 'jument'], ['La chèvre', 5, 'chevre', 'bouc']] },
  { q: 'Citez quelque chose que l’on emporte à la plage', a: [['La serviette', 30, 'serviette', 'drap de plage'], ['La crème solaire', 25, 'creme', 'creme solaire', 'solaire'], ['Le parasol', 16, 'parasol'], ['Le maillot de bain', 12, 'maillot', 'maillot de bain'], ['Les lunettes de soleil', 10, 'lunettes', 'lunettes de soleil'], ['Le ballon', 7, 'ballon', 'raquettes', 'jeux']] },
  { q: 'Citez une chose que l’on fait le dimanche matin', a: [['Faire la grasse matinée', 35, 'grasse matinee', 'dormir', 'trainer au lit'], ['Aller au marché', 20, 'marche'], ['Prendre un bon petit-déjeuner', 15, 'petit dejeuner', 'dejeuner', 'croissant', 'croissants'], ['Faire du sport', 12, 'sport', 'courir', 'footing', 'jogging'], ['Aller à la boulangerie', 10, 'boulangerie', 'pain'], ['Aller à la messe', 8, 'messe', 'eglise']] },
  { q: 'Citez un objet que l’on trouve dans une salle de bain', a: [['La brosse à dents', 28, 'brosse a dents', 'dentifrice'], ['La serviette', 22, 'serviette'], ['Le savon', 18, 'savon', 'gel douche'], ['Le miroir', 14, 'miroir', 'glace'], ['Le shampoing', 10, 'shampoing', 'shampooing'], ['Le sèche-cheveux', 8, 'seche cheveux', 'seche-cheveux']] },
  { q: 'Citez un métier qui fait rêver les enfants', a: [['Pompier', 30, 'pompier'], ['Footballeur', 22, 'footballeur', 'joueur de foot'], ['Vétérinaire', 16, 'veterinaire', 'veto'], ['Astronaute', 13, 'astronaute', 'cosmonaute'], ['Policier', 11, 'policier', 'police', 'gendarme'], ['Chanteur', 8, 'chanteur', 'chanteuse', 'star']] },
  { q: 'Citez une raison d’arriver en retard au travail', a: [['Les embouteillages', 34, 'embouteillage', 'bouchon', 'bouchons', 'trafic', 'circulation'], ['Le réveil n’a pas sonné', 25, 'reveil', 'panne de reveil'], ['Une grève des transports', 14, 'greve', 'train', 'metro', 'bus'], ['Les enfants', 12, 'enfants', 'enfant', 'ecole'], ['Une panne de voiture', 9, 'panne', 'voiture', 'crevaison'], ['La météo', 6, 'meteo', 'neige', 'pluie']] },
  { q: 'Citez un fruit que l’on mange en été', a: [['La fraise', 28, 'fraise'], ['La pastèque', 22, 'pasteque'], ['Le melon', 18, 'melon'], ['La pêche', 14, 'peche', 'nectarine', 'brugnon'], ['La cerise', 10, 'cerise'], ['L’abricot', 8, 'abricot']] },
  { q: 'Citez un sport que l’on regarde à la télé', a: [['Le football', 40, 'foot', 'football'], ['Le rugby', 18, 'rugby'], ['Le tennis', 15, 'tennis'], ['Le cyclisme', 11, 'velo', 'cyclisme', 'tour de france'], ['La Formule 1', 9, 'formule 1', 'f1', 'course auto'], ['Le handball', 7, 'hand', 'handball']] },
  { q: 'Citez quelque chose qui fait peur aux enfants', a: [['Le noir', 33, 'noir', 'obscurite', 'nuit'], ['Les monstres', 22, 'monstre', 'monstres', 'croque mitaine'], ['Les araignées', 15, 'araignee'], ['L’orage', 12, 'orage', 'tonnerre'], ['Le dentiste', 10, 'dentiste', 'docteur', 'piqure'], ['Les clowns', 8, 'clown']] },
  { q: 'Citez un plat que l’on mange à Noël', a: [['La dinde', 30, 'dinde', 'chapon'], ['Le foie gras', 25, 'foie gras'], ['La bûche', 18, 'buche'], ['Les huîtres', 13, 'huitre', 'fruits de mer'], ['Le saumon', 8, 'saumon'], ['Les chocolats', 6, 'chocolat', 'papillotes']] },
  { q: 'Citez un objet que l’on perd souvent', a: [['Les clés', 38, 'cle', 'cles', 'clef', 'clefs'], ['Le téléphone', 20, 'telephone', 'portable'], ['Les lunettes', 15, 'lunettes'], ['La télécommande', 12, 'telecommande'], ['Le portefeuille', 9, 'portefeuille', 'porte monnaie'], ['Les chaussettes', 6, 'chaussette']] },
  { q: 'Citez quelque chose que l’on fait pendant les vacances', a: [['Se baigner', 28, 'baigner', 'nager', 'baignade', 'plage'], ['Dormir', 22, 'dormir', 'se reposer', 'repos', 'sieste'], ['Visiter', 18, 'visiter', 'visite', 'musee', 'tourisme'], ['Lire', 12, 'lire', 'lecture', 'livre'], ['Faire la fête', 11, 'fete', 'soiree', 'danser'], ['Bronzer', 9, 'bronzer', 'bronzage']] },
  { q: 'Citez un super-héros', a: [['Superman', 30, 'superman'], ['Spider-Man', 26, 'spiderman', 'spider man', 'homme araignee'], ['Batman', 22, 'batman'], ['Iron Man', 10, 'iron man', 'ironman'], ['Wonder Woman', 7, 'wonder woman'], ['Hulk', 5, 'hulk']] },
  { q: 'Citez un endroit où l’on fait la queue', a: [['Au supermarché', 33, 'supermarche', 'caisse', 'magasin', 'courses'], ['À la poste', 22, 'poste'], ['À la boulangerie', 14, 'boulangerie'], ['Au cinéma', 12, 'cinema'], ['À la banque', 10, 'banque'], ['Dans un parc d’attractions', 9, 'parc', 'manege', 'attraction', 'disney']] },
  { q: 'Citez un instrument de musique', a: [['La guitare', 34, 'guitare'], ['Le piano', 28, 'piano'], ['La batterie', 14, 'batterie'], ['Le violon', 12, 'violon'], ['La flûte', 7, 'flute'], ['La trompette', 5, 'trompette', 'saxophone', 'saxo']] },
  { q: 'Citez une chose que l’on trouve dans un sac à main', a: [['Le portefeuille', 30, 'portefeuille', 'porte monnaie', 'argent'], ['Les clés', 24, 'cle', 'cles', 'clef'], ['Le téléphone', 16, 'telephone', 'portable'], ['Le maquillage', 13, 'maquillage', 'rouge a levres', 'gloss'], ['Les mouchoirs', 10, 'mouchoir', 'mouchoirs'], ['Les lunettes', 7, 'lunettes']] },
  { q: 'Citez un pays où l’on rêve de partir en vacances', a: [['L’Italie', 24, 'italie'], ['L’Espagne', 20, 'espagne'], ['Les États-Unis', 18, 'etats unis', 'usa', 'amerique'], ['La Grèce', 15, 'grece'], ['Le Japon', 12, 'japon'], ['Le Maroc', 11, 'maroc']] },
  { q: 'Citez quelque chose qui sonne', a: [['Le téléphone', 32, 'telephone', 'portable'], ['Le réveil', 26, 'reveil'], ['La sonnette', 18, 'sonnette', 'porte'], ['Les cloches', 12, 'cloche', 'eglise'], ['L’alarme', 7, 'alarme', 'sirene'], ['La sonnerie de l’école', 5, 'sonnerie', 'ecole']] },
  { q: 'Citez un dessert préféré des Français', a: [['La mousse au chocolat', 28, 'mousse', 'mousse au chocolat'], ['La crème brûlée', 20, 'creme brulee'], ['La tarte aux pommes', 17, 'tarte', 'tarte aux pommes', 'tarte tatin'], ['Le tiramisu', 14, 'tiramisu'], ['L’île flottante', 11, 'ile flottante'], ['La glace', 10, 'glace', 'sorbet']] },
  { q: 'Citez une chose que l’on fait avant de dormir', a: [['Se brosser les dents', 34, 'dents', 'brosser', 'brosse a dents'], ['Lire', 22, 'lire', 'livre', 'lecture'], ['Regarder son téléphone', 16, 'telephone', 'portable', 'ecran'], ['Mettre son pyjama', 11, 'pyjama'], ['Regarder la télé', 10, 'tele', 'television', 'serie'], ['Faire un bisou', 7, 'bisou', 'calin']] },
  { q: 'Citez un personnage de conte', a: [['Le Petit Chaperon rouge', 30, 'chaperon', 'petit chaperon rouge'], ['Cendrillon', 22, 'cendrillon'], ['Blanche-Neige', 18, 'blanche neige'], ['Le grand méchant loup', 12, 'loup'], ['La Belle au bois dormant', 10, 'belle au bois dormant', 'aurore'], ['Le Petit Poucet', 8, 'poucet', 'petit poucet']] },
  { q: 'Citez un moyen de transport', a: [['La voiture', 35, 'voiture', 'auto'], ['Le train', 20, 'train', 'tgv'], ['L’avion', 16, 'avion'], ['Le vélo', 13, 'velo', 'bicyclette'], ['Le bus', 9, 'bus', 'car'], ['Le métro', 7, 'metro', 'tram', 'tramway']] },
  { q: 'Citez quelque chose que l’on fait à un mariage', a: [['Danser', 30, 'danser', 'danse', 'bal'], ['Manger', 22, 'manger', 'repas', 'diner', 'banquet'], ['Dire « oui »', 16, 'oui', 'echanger les voeux', 'voeux'], ['Lancer le bouquet', 12, 'bouquet'], ['S’embrasser', 11, 'embrasser', 'bisou', 'baiser'], ['Couper la pièce montée', 9, 'piece montee', 'gateau']] },
  { q: 'Citez une couleur de voiture', a: [['Noir', 28, 'noir', 'noire'], ['Blanc', 25, 'blanc', 'blanche'], ['Gris', 20, 'gris', 'grise', 'argent'], ['Rouge', 14, 'rouge'], ['Bleu', 9, 'bleu', 'bleue'], ['Jaune', 4, 'jaune']] },
  { q: 'Citez un lieu où il faut parler à voix basse', a: [['La bibliothèque', 34, 'bibliotheque'], ['L’église', 24, 'eglise', 'messe'], ['L’hôpital', 14, 'hopital'], ['Le cinéma', 11, 'cinema'], ['Un musée', 9, 'musee'], ['La chambre d’un bébé', 8, 'bebe', 'chambre']] },
];

// ----- La Roue des Lettres : expressions et titres à reconstituer (sans accents). -----
const ROUE = [
  { cat: 'Expression', p: 'POSER UN LAPIN' }, { cat: 'Expression', p: 'AVOIR LE CAFARD' }, { cat: 'Expression', p: 'TOMBER DANS LES POMMES' },
  { cat: 'Expression', p: 'COUTER LES YEUX DE LA TETE' }, { cat: 'Expression', p: 'METTRE LES PIEDS DANS LE PLAT' }, { cat: 'Expression', p: 'AVOIR LA CHAIR DE POULE' },
  { cat: 'Expression', p: 'RACONTER DES SALADES' }, { cat: 'Expression', p: 'DONNER SA LANGUE AU CHAT' }, { cat: 'Expression', p: 'IL PLEUT DES CORDES' },
  { cat: 'Proverbe', p: 'PETIT A PETIT L OISEAU FAIT SON NID' }, { cat: 'Proverbe', p: 'QUI VA A LA CHASSE PERD SA PLACE' }, { cat: 'Proverbe', p: 'L HABIT NE FAIT PAS LE MOINE' },
  { cat: 'Proverbe', p: 'APRES LA PLUIE LE BEAU TEMPS' }, { cat: 'Proverbe', p: 'LA NUIT PORTE CONSEIL' }, { cat: 'Proverbe', p: 'TOUT VIENT A POINT A QUI SAIT ATTENDRE' },
  { cat: 'Film', p: 'LE DINER DE CONS' }, { cat: 'Film', p: 'LA GRANDE VADROUILLE' }, { cat: 'Film', p: 'LE ROI LION' }, { cat: 'Film', p: 'LA REINE DES NEIGES' },
  { cat: 'Film', p: 'RETOUR VERS LE FUTUR' }, { cat: 'Film', p: 'LES VISITEURS' }, { cat: 'Film', p: 'LE SEIGNEUR DES ANNEAUX' }, { cat: 'Film', p: 'LES DENTS DE LA MER' },
  { cat: 'Chanson', p: 'LA VIE EN ROSE' }, { cat: 'Chanson', p: 'LES LACS DU CONNEMARA' }, { cat: 'Chanson', p: 'ALLUMER LE FEU' }, { cat: 'Chanson', p: 'NE ME QUITTE PAS' },
  { cat: 'Lieu', p: 'LA TOUR EIFFEL' }, { cat: 'Lieu', p: 'LE MONT SAINT MICHEL' }, { cat: 'Lieu', p: 'LES CHAMPS ELYSEES' }, { cat: 'Lieu', p: 'LE CHATEAU DE VERSAILLES' },
  { cat: 'Lieu', p: 'LA PLACE ROUGE' }, { cat: 'Lieu', p: 'LA STATUE DE LA LIBERTE' }, { cat: 'Lieu', p: 'LE CANAL DU MIDI' },
  { cat: 'Cuisine', p: 'LA TARTE AUX POMMES' }, { cat: 'Cuisine', p: 'LE CROQUE MONSIEUR' }, { cat: 'Cuisine', p: 'LA MOUSSE AU CHOCOLAT' }, { cat: 'Cuisine', p: 'LE BOEUF BOURGUIGNON' },
  { cat: 'Cuisine', p: 'LES CREPES AU SUCRE' }, { cat: 'Objet', p: 'UNE MACHINE A LAVER' }, { cat: 'Objet', p: 'UN APPAREIL PHOTO' }, { cat: 'Objet', p: 'UNE BROSSE A DENTS' },
  { cat: 'Sport', p: 'LA COUPE DU MONDE' }, { cat: 'Sport', p: 'LE TOUR DE FRANCE' }, { cat: 'Sport', p: 'LES JEUX OLYMPIQUES' }, { cat: 'Sport', p: 'UN COUP FRANC DIRECT' },
];

module.exports = { MOTUS, MOTPOURMOT, SONDAGE, ROUE };

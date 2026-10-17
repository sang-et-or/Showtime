// Contenu du jeu de couple « Entre nous ». Trois niveaux d'intensité, toujours dans le consentement :
// chaque défi peut être refusé (joker), et les « envies secrètes » ne sont révélées que si les deux ont dit oui.
// Formulations neutres (« l'autre ») pour convenir à tous les couples.

const LEVELS = {
  douceur: { label: 'Douceur', icon: '💗', pitch: 'Tendresse, compliments et souvenirs à deux.' },
  complicite: { label: 'Complicité', icon: '💞', pitch: 'Massages, baisers et petites envies.' },
  audace: { label: 'Audace', icon: '🔥', pitch: 'Pour pimenter la soirée… si vous êtes d’accord.' },
};

// « Je te connais » : l'un répond pour lui-même, l'autre devine.
const GUESS = {
  douceur: [
    { q: 'Mon moment préféré pour un câlin', a: ['Le matin au réveil', 'Le soir devant un film', 'Sous la couette quand il pleut', 'À l’improviste, n’importe quand'] },
    { q: 'Ce qui me fait le plus fondre chez toi', a: ['Ton sourire', 'Ton regard', 'Ta voix', 'Tes mains'] },
    { q: 'Le baiser que je préfère recevoir', a: ['Dans le cou', 'Sur le front', 'Un long baiser lent', 'Un baiser volé'] },
    { q: 'Ma soirée parfaite à deux', a: ['Dîner aux chandelles', 'Plaid et série', 'Balade sous les étoiles', 'Bain moussant'] },
    { q: 'Le compliment qui me fait le plus d’effet', a: ['Sur mon physique', 'Sur mon humour', 'Sur mon intelligence', 'Sur ma façon d’aimer'] },
    { q: 'Ce qui me rassure le plus dans notre couple', a: ['Tes bras', 'Nos fous rires', 'Tes petits messages', 'Ta patience'] },
  ],
  complicite: [
    { q: 'Là où j’adore être caressé·e', a: ['Le dos', 'La nuque', 'Les cheveux', 'Le ventre'] },
    { q: 'Ce qui me met le plus dans l’ambiance', a: ['Une musique douce', 'Un message coquin dans la journée', 'Un massage', 'Un regard appuyé'] },
    { q: 'La tenue que je préfère sur toi', a: ['Rien qu’une chemise', 'Une tenue de soirée', 'Des sous-vêtements assortis', 'Ton pyjama tout doux'] },
    { q: 'Le lieu qui me tente le plus pour un moment à deux', a: ['Une chambre d’hôtel', 'Une cabane dans les bois', 'Un spa privé', 'Notre lit, tout simplement'] },
    { q: 'Ce que je préfère dans nos moments intimes', a: ['Prendre notre temps', 'La passion soudaine', 'Les surprises', 'Les jeux'] },
    { q: 'Le parfum d’huile de massage qui me fait craquer', a: ['Vanille', 'Monoï', 'Fleur d’oranger', 'Amande douce'] },
  ],
  audace: [
    { q: 'Ce qui m’excite le plus', a: ['Être surpris·e', 'Mener la danse', 'Me laisser guider', 'Des mots doux murmurés à l’oreille'] },
    { q: 'Le moment de la journée où j’ai le plus envie de toi', a: ['Le matin', 'À la sieste', 'Le soir', 'En pleine nuit'] },
    { q: 'La partie de ton corps que je préfère', a: ['Tes lèvres', 'Tes épaules', 'Tes mains', 'Tes fesses'] },
    { q: 'Pour pimenter, je dirais plutôt oui à', a: ['Un bandeau sur les yeux', 'Un jeu de rôle', 'Un strip-tease', 'Un massage très sensuel'] },
    { q: 'Ce que j’aimerais que tu oses plus souvent', a: ['Prendre l’initiative', 'Me dire ce que tu veux', 'Me surprendre', 'Prendre ton temps'] },
    { q: 'Mon fantasme le plus avouable', a: ['Une nuit dans un hôtel chic', 'Un bain à deux à la bougie', 'Un week-end sans sortir de la chambre', 'Un dîner où l’on se dévore des yeux'] },
  ],
};

// Vérités : à dire à voix haute à l'autre.
const TRUTHS = {
  douceur: [
    'Raconte le moment où tu as su que tu craquais pour l’autre.',
    'Dis trois choses que tu trouves irrésistibles chez l’autre.',
    'Quel est ton plus beau souvenir à deux ?',
    'Qu’est-ce qui te fait te sentir le plus aimé·e ?',
    'Quel petit geste de l’autre te fait sourire à chaque fois ?',
  ],
  complicite: [
    'Quel baiser de l’autre n’oublieras-tu jamais ?',
    'Qu’est-ce que l’autre fait, sans le savoir, qui te fait craquer ?',
    'Décris votre soirée idéale, du dîner jusqu’au réveil.',
    'Quelle tenue de l’autre te fait le plus d’effet ?',
    'À quel moment as-tu eu le plus envie de l’autre récemment ?',
  ],
  audace: [
    'Raconte ta plus belle nuit avec l’autre.',
    'Quelle envie n’as-tu encore jamais osé proposer ?',
    'Murmure à l’oreille de l’autre ce que tu aimerais vivre ce soir.',
    'Où aimes-tu être embrassé·e, que l’autre oublie trop souvent ?',
    'Quelle est la chose la plus sensuelle que l’autre t’ait jamais dite ?',
  ],
};

// Défis : à faire à l'autre, seulement s'il ou elle est d'accord (joker toujours possible).
const DARES = {
  douceur: [
    'Prends l’autre dans tes bras pendant 30 secondes, sans un mot.',
    'Masse les mains de l’autre pendant une minute.',
    'Fais trois compliments à l’autre en le regardant dans les yeux.',
    'Dépose un baiser tendre sur le front de l’autre.',
    'Caresse les cheveux de l’autre pendant une minute.',
  ],
  complicite: [
    'Masse la nuque et les épaules de l’autre pendant une minute.',
    'Embrasse l’autre comme lors de votre premier rendez-vous.',
    'Dansez un slow très serré le temps d’une chanson.',
    'Chuchote un compliment coquin à l’oreille de l’autre.',
    'Dépose cinq baisers sur le visage de l’autre, lentement.',
  ],
  audace: [
    'Embrasse le cou de l’autre pendant 15 secondes.',
    'Retire un vêtement à l’autre… seulement s’il ou elle est d’accord.',
    'Bande les yeux de l’autre et embrasse-le à trois endroits surprise.',
    'Offre à l’autre un massage sensuel du dos pendant deux minutes.',
    'Laisse l’autre choisir un endroit où tu dois l’embrasser.',
  ],
};

// Envies secrètes : chacun répond en secret ; seules les envies partagées sont révélées.
const WISHES = {
  douceur: [
    'Un petit-déjeuner au lit', 'Un bain moussant à deux', 'Un week-end en amoureux surprise',
    'Une soirée sans téléphone, rien que nous', 'Une séance de massages l’un après l’autre', 'Revoir le film de notre premier rendez-vous',
  ],
  complicite: [
    'Un massage à l’huile chaude', 'S’envoyer des messages coquins dans la journée', 'Une nuit à l’hôtel avec jacuzzi',
    'Danser un slow en sous-vêtements', 'Prendre une douche à deux', 'Un dîner où l’on se fait goûter les plats les yeux fermés',
  ],
  audace: [
    'Un bandeau sur les yeux', 'Un jeu de rôle', 'Un strip-tease', 'Faire l’amour ailleurs que dans la chambre',
    'Une lingerie choisie par l’autre', 'Un dé coquin pour décider de la suite', 'Une nuit entière sans dormir… ou presque',
  ],
};

module.exports = { LEVELS, GUESS, TRUTHS, DARES, WISHES };

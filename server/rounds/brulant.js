// Jeu privé pour adultes « Brûlant » : Action ou Vérité coquin, pour un couple (deux joueurs exactement).
// Confidentialité : les cartes ne s'affichent que sur les deux téléphones ; l'écran principal reste neutre ;
// rien n'est enregistré (ni historique, ni souvenirs, ni photos). Consentement : joker toujours possible,
// et le partenaire peut refuser toute action (« Pas ce soir »), sans pénalité.
const { shuffle } = require('../util');

const CHOOSE_MS = 25_000;
const CARD_MS = 120_000;
const AFTER_MS = 3_000;
const END_MS = 15_000;
const TURNS = { short: 12, normal: 18, long: 24 };
const MAX_HEAT = { douceur: 1, complicite: 2, audace: 3 };
const HEAT = [null, { icon: '🌶️', label: 'Sensuel' }, { icon: '🌶️🌶️', label: 'Coquin' }, { icon: '🌶️🌶️🌶️', label: 'Osé' }];

// Cartes : formulées en « tu » pour la personne qui joue, « moi » désigne son ou sa partenaire.
const TRUTHS = {
  1: [
    'Quelle est la première chose qui t’a attiré·e physiquement chez moi ?', 'Quel est ton souvenir le plus sensuel avec moi ?',
    'Quelle partie de mon corps préfères-tu embrasser ?', 'Quelle tenue aimerais-tu me voir porter ce soir ?',
    'Quel compliment de ma part te ferait le plus d’effet ?', 'Câlins du matin ou câlins du soir ? Pourquoi ?',
    'Quel baiser entre nous t’a le plus troublé·e ?', 'Quelle musique te met le plus dans l’ambiance ?',
    'Où aimes-tu être caressé·e quand on regarde un film ?', 'Quel est ton parfum préféré sur moi ?',
    'À quel moment de la journée as-tu le plus envie de moi ?', 'Raconte la première fois que tu as eu envie de moi.',
    'Quel geste tendre aimerais-tu que je fasse plus souvent ?', 'Quelle est ta zone la plus sensible aux bisous ?',
  ],
  2: [
    'Quel est ton fantasme le plus avouable ?', 'Où as-tu déjà eu envie de faire l’amour avec moi, sans oser le dire ?',
    'Quelle est la pensée la plus coquine que tu as eue sur moi aujourd’hui ?', 'Préfères-tu mener la danse ou te laisser guider ?',
    'Quel sous-vêtement à moi te fait le plus d’effet ?', 'Quelle caresse que je te fais préfères-tu ?',
    'As-tu déjà rêvé de nous deux de façon très coquine ? Raconte.', 'Lumière allumée ou éteinte ? Pourquoi ?',
    'Quel message coquin rêverais-tu de recevoir de moi ?', 'Quelle position préfères-tu avec moi ?',
    'Qu’est-ce qui t’excite le plus dans les préliminaires ?', 'Quelle pièce de la maison n’avons-nous pas encore « testée » ?',
    'Quel accessoire aimerais-tu essayer avec moi ?', 'Qu’est-ce que je fais au lit qui te rend fou ou folle ?',
    'Ce soir : rapide et passionné, ou lent et langoureux ?',
  ],
  3: [
    'Quel fantasme secret ne m’as-tu encore jamais avoué ?', 'Décris en détail ce que tu aimerais que je te fasse ce soir.',
    'Quelle nuit avec moi t’a le plus marqué·e, et pourquoi ?', 'Qu’est-ce qui te ferait perdre la tête en moins d’une minute ?',
    'Quel jeu de rôle aimerais-tu essayer avec moi ?', 'Quel est l’endroit le plus fou où tu aimerais faire l’amour avec moi ?',
    'Un bandeau sur les yeux… pour toi ou pour moi ? Raconte ce que tu imagines.', 'Quel mot coquin aimerais-tu que je te murmure ?',
    'Qu’est-ce que tu n’as jamais osé me demander au lit ?', 'Dominer ou être dominé·e, juste pour jouer ? Explique.',
    'Quelle partie de mon corps aimerais-tu explorer plus longtemps ?', 'Quelle est la chose la plus osée que tu aimerais vivre avec moi cette année ?',
    'Si tu pouvais me donner un ordre coquin ce soir, lequel ?', 'Raconte ton plus grand moment de plaisir avec moi.',
    'Quel jouet coquin aimerais-tu qu’on découvre ensemble ?',
  ],
};
const DARES = {
  1: [
    'Embrasse-moi dans le cou pendant 20 secondes.', 'Fais-moi un massage des épaules pendant une minute.',
    'Murmure-moi trois compliments à l’oreille.', 'Embrasse-moi comme lors de notre premier rendez-vous.',
    'Caresse mes cheveux pendant une minute en me regardant dans les yeux.', 'Danse un slow collé-serré avec moi le temps d’une chanson.',
    'Dépose cinq baisers où tu veux sur mon visage.', 'Regarde-moi dans les yeux 30 secondes sans rire.',
    'Masse-moi les mains, lentement.', 'Choisis une chanson sexy et fais-moi une petite danse.',
    'Embrasse l’intérieur de mon poignet.', 'Mordille doucement le lobe de mon oreille.',
  ],
  2: [
    'Retire un vêtement de ton choix.', 'Retire-moi un vêtement de ton choix.',
    'Embrasse-moi à un endroit où tu ne m’as encore jamais embrassé·e.', 'Masse-moi le dos pendant deux minutes, sans haut.',
    'Murmure-moi ce que tu as envie de me faire ce soir.', 'Fais-moi un strip-tease de 30 secondes.',
    'Bande-moi les yeux et embrasse-moi à trois endroits surprise.', 'Fais glisser un glaçon (ou le bout de tes doigts) le long de mon dos.',
    'Assieds-toi sur mes genoux et embrasse-moi pendant 30 secondes.', 'Embrasse mon ventre, très lentement.',
    'Envoie-moi le message le plus coquin possible… alors qu’on est côte à côte.', 'Laisse-moi choisir l’endroit où tu dois m’embrasser.',
  ],
  3: [
    'Retire deux vêtements, très lentement.', 'Offre-moi un massage sensuel à l’huile pendant cinq minutes.',
    'Laisse-moi te bander les yeux pendant deux minutes : interdiction de bouger.', 'Embrasse-moi du cou jusqu’au bas du ventre.',
    'Montre-moi avec tes mains comment tu aimes être caressé·e.', 'Fais-moi un strip-tease complet sur la musique de ton choix.',
    'Pendant une minute, je n’ai pas le droit de te toucher… mais toi, tu as tous les droits.', 'Choisis une pièce de la maison : c’est là qu’on finira la partie.',
    'Murmure-moi ton fantasme pendant que je t’embrasse.', 'Lance un jeu de rôle de deux minutes : tu choisis les personnages.',
    'Fais-moi frissonner avec ta bouche pendant une minute.', 'Mets la tenue la plus sexy que tu possèdes et reviens me voir.',
  ],
};

const G = (room) => room.ctx.br;

function heatOf(room) {
  const g = G(room);
  return Math.min(MAX_HEAT[room.settings.coupleLevel] || 1, 1 + Math.floor(g.turn / 4));
}

function draw(g, kind, heat) {
  const key = `${kind}${heat}`;
  if (!g.decks[key] || !g.decks[key].length) g.decks[key] = shuffle((kind === 'truth' ? TRUTHS : DARES)[heat]);
  return g.decks[key].pop();
}

function nextTurn(room) {
  const g = G(room);
  g.turn++;
  if (g.turn >= g.total) { end(room); return; }
  g.seq++;
  room.enter('brChoose', { who: g.seats[g.turn % 2], heat: heatOf(room) });
  room.say(`${room.players.get(g.seats[g.turn % 2])?.name || ''}, action ou vérité ? Regardez vos téléphones…`);
  room.setTimer(CHOOSE_MS, () => pickCard(room, 'truth'), true);
  room.sync();
}

function pickCard(room, kind) {
  room.clearTimer();
  const g = G(room);
  const d = room.data;
  g.seq++;
  room.enter('brCard', { who: d.who, heat: d.heat, kind, text: draw(g, kind, d.heat), result: null });
  room.say(kind === 'dare' ? 'Une action… seulement si vous êtes d’accord tous les deux.' : 'Une vérité… à dire les yeux dans les yeux.');
  room.setTimer(CARD_MS, () => finish(room, 'done'), true);
  room.sync();
}

function finish(room, result) {
  room.clearTimer();
  const g = G(room);
  const d = room.data;
  d.result = result;
  if (result === 'done') { g.done[d.kind]++; room.addScore(d.who, 50); } else g.skipped++;
  g.seq++;
  room.sync();
  room.setTimer(AFTER_MS, () => nextTurn(room));
}

function end(room) {
  room.clearTimer();
  const g = G(room);
  g.seq++;
  room.say('La partie est finie… mais la soirée ne fait que commencer ! 🔥');
  room.enter('brEnd', {});
  room.setTimer(END_MS, () => room.finishRound());
  room.sync();
}

module.exports = {
  id: 'brulant',
  title: 'Brûlant',
  icon: '🌶️',
  adult: true,
  privateGame: true,
  subtitle: 'Action ou Vérité coquin pour pimenter une soirée en couple.',
  pitch: 'Action ou Vérité très coquin, pour un couple. Réservé aux adultes consentants.',
  rules: 'À deux, chacun sur son téléphone. Choisissez Action ou Vérité : la température monte au fil des tours (sensuel, coquin, osé) jusqu’au niveau choisi. Joker toujours possible, et l’autre peut refuser une action. Rien n’est enregistré, rien ne s’affiche sur l’écran principal.',
  players: '2 joueurs',
  duration: '15 à 40 min',
  minPlayers: 2,
  phases: ['brChoose', 'brCard', 'brEnd'],
  CARDS: { TRUTHS, DARES },
  introLine: () => 'Brûlant… Installez-vous confortablement, tout se passe sur vos téléphones. Rien ne sera enregistré.',
  cannotPlay: (room) => (room.connectedPlayers().length !== 2 ? 'Brûlant se joue à deux exactement.' : null),

  begin(room) {
    room.ctx.br = { seats: shuffle(room.connectedPlayers().map((p) => p.id)), turn: -1, seq: 0, total: TURNS[room.settings.length], decks: {}, done: { truth: 0, dare: 0 }, skipped: 0 };
    nextTurn(room);
  },

  check(room) {
    if (G(room) && G(room).seats.every((id) => !room.players.get(id)?.connected)) room.clearTimer();
  },

  act(room, p, msg) {
    const g = G(room);
    const d = room.data;
    if (!g.seats.includes(p.id)) return;
    if (room.phase === 'brChoose' && p.id === d.who && (msg.type === 'truth' || msg.type === 'dare')) pickCard(room, msg.type);
    else if (room.phase === 'brCard' && !d.result) {
      if (p.id === d.who && (msg.type === 'done' || msg.type === 'joker')) finish(room, msg.type);
      else if (p.id !== d.who && msg.type === 'veto' && d.kind === 'dare') finish(room, 'veto');
    }
  },

  // L'écran principal reste neutre : jamais le contenu des cartes.
  hostView(room) {
    const g = G(room);
    const d = room.data;
    const h = HEAT[d.heat || heatOf(room)] || HEAT[1];
    if (room.phase === 'brEnd') return { key: 'brEnd', br: { done: g.done, skipped: g.skipped, players: g.seats.map((id) => room.pub(id)) } };
    return { key: `br:${g.seq}`, br: { turn: g.turn + 1, total: g.total, heat: h, kind: d.kind || null, result: d.result || null, who: room.pub(d.who), players: g.seats.map((id) => room.pub(id)) } };
  },

  playerView(room, p) {
    const g = G(room);
    const d = room.data;
    const base = { br: { turn: g.turn + 1, total: g.total, heat: HEAT[d.heat || 1], who: room.pub(d.who), isMe: d.who === p.id, partner: room.pub(g.seats.find((id) => id !== p.id)) } };
    if (room.phase === 'brChoose') return { ...base, key: `brChoose:${g.seq}` };
    if (room.phase === 'brCard') return { ...base, key: `brCard:${g.seq}`, kind: d.kind, text: d.text, result: d.result };
    return { ...base, key: 'brEnd', done: g.done, skipped: g.skipped };
  },
};

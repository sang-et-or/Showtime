// Jeu de cartes « Le 8 américain » : videz votre main le premier !
// On pose une carte de même couleur ou de même valeur. Le 8 change la couleur, le Valet fait passer
// le tour du suivant, l'As inverse le sens, le 2 fait piocher 2 cartes au suivant.
const animator = require('../../animator');
const { deck, pub, nextSeat, SUITS } = require('./cards');
const { shuffle } = require('../../util');

const TURN_MS = 20_000;
const AUTO_MS = 1_200;
const RESULT_MS = 7_000;
const END_MS = 8_000;
const MANCHES = { short: 1, normal: 2, long: 3 };
const SUIT_NAMES = { S: 'Pique', H: 'Cœur', D: 'Carreau', C: 'Trèfle' };

function newManche(room) {
  const g = room.ctx.ht;
  if (g.manche >= g.total) { end(room); return; }
  g.manche++;
  const n = g.seats.length;
  g.draw = deck();
  const per = n > 6 ? 5 : 7;
  g.hands = g.seats.map(() => g.draw.splice(0, per));
  let first = g.draw.pop();
  while (first.r === '8') { g.draw.unshift(first); first = g.draw.pop(); }
  g.discard = [first];
  g.suit = first.s;
  g.dir = 1;
  g.drewThisTurn = false;
  g.turn = (g.manche - 1) % n;
  g.lastEvent = '';
  room.say(animator.htStart(room.players.get(g.seats[g.turn])?.name || '?'));
  prompt(room);
}

const top = (g) => g.discard[g.discard.length - 1];
const playable = (g, c) => c.r === '8' || c.s === g.suit || c.r === top(g).r;

function drawCard(g) {
  // pioche vide : on remélange la défausse (sauf la carte du dessus)
  if (!g.draw.length && g.discard.length > 1) { const t = g.discard.pop(); g.draw = shuffle(g.discard); g.discard = [t]; }
  return g.draw.pop() || null;
}

function prompt(room) {
  const g = room.ctx.ht;
  g.seq++;
  room.enter('htPlay', {});
  const seat = g.turn;
  room.setTimer(room.players.get(g.seats[seat])?.connected ? TURN_MS : AUTO_MS, () => auto(room, seat), true);
  room.sync();
}

/** Coup automatique : première carte jouable (le 8 choisit la couleur la plus présente), sinon piocher puis passer. */
function auto(room, seat) {
  const g = room.ctx.ht;
  if (!g || !g.hands[seat]) return; // plus personne à la table (tout le monde est parti)
  const card = g.hands[seat].find((c) => playable(g, c) && c.r !== '8') || g.hands[seat].find((c) => playable(g, c));
  if (card) { play(room, seat, card.id, bestSuit(g.hands[seat], card)); return; }
  if (!g.drewThisTurn) { draw(room, seat); if (g.turn === seat && room.phase === 'htPlay') auto(room, seat); return; }
  passTurn(room, seat);
}

function bestSuit(hand, played) {
  const counts = {};
  hand.filter((c) => c !== played).forEach((c) => { counts[c.s] = (counts[c.s] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || played.s;
}

function advanceTurn(g, skip = 0) {
  const n = g.seats.length;
  let s = g.turn;
  for (let k = 0; k <= skip; k++) s = nextSeat(n, s, () => true, g.dir);
  g.turn = s;
  g.drewThisTurn = false;
}

function play(room, seat, cardId, suit) {
  const g = room.ctx.ht;
  const card = g.hands[seat].find((c) => c.id === cardId);
  if (!card || !playable(g, card)) return false;
  room.clearTimer();
  g.hands[seat] = g.hands[seat].filter((c) => c.id !== cardId);
  g.discard.push(card);
  g.suit = card.r === '8' && SUITS.includes(suit) ? suit : card.s;
  const name = room.players.get(g.seats[seat])?.name || '?';
  const n = g.seats.length;
  g.lastEvent = '';
  if (!g.hands[seat].length) { results(room, seat); return true; }
  let skip = 0;
  if (card.r === '8') { g.lastEvent = `${name} change la couleur : ${SUIT_NAMES[g.suit]} !`; }
  else if (card.r === 'J') { skip = 1; g.lastEvent = `Valet ! ${room.players.get(g.seats[nextSeat(n, seat, () => true, g.dir)])?.name} passe son tour.`; }
  else if (card.r === 'A') { g.dir = -g.dir; if (n === 2) skip = 1; g.lastEvent = 'As : on change de sens !'; }
  else if (card.r === '2') {
    const victim = nextSeat(n, seat, () => true, g.dir);
    g.hands[victim].push(...[drawCard(g), drawCard(g)].filter(Boolean));
    skip = 1;
    g.lastEvent = `${room.players.get(g.seats[victim])?.name} pioche 2 cartes !`;
  }
  if (g.hands[seat].length === 1) room.say(animator.htLastCard(name));
  else if (g.lastEvent) room.say(g.lastEvent);
  advanceTurn(g, skip);
  prompt(room);
  return true;
}

function draw(room, seat) {
  const g = room.ctx.ht;
  if (g.drewThisTurn) return false;
  const c = drawCard(g);
  if (c) g.hands[seat].push(c);
  g.drewThisTurn = true;
  g.lastEvent = `${room.players.get(g.seats[seat])?.name} pioche.`;
  g.seq++;
  room.sync();
  return true;
}

function passTurn(room, seat) {
  const g = room.ctx.ht;
  if (!g.drewThisTurn) return false;
  room.clearTimer();
  advanceTurn(g);
  prompt(room);
  return true;
}

function results(room, winnerSeat) {
  room.clearTimer();
  const g = room.ctx.ht;
  const rows = g.seats.map((id, s) => {
    const left = g.hands[s].length;
    const pts = s === winnerSeat ? 500 : Math.max(0, 200 - left * 20);
    room.addScore(id, pts);
    g.totals[id] = (g.totals[id] || 0) + pts;
    return { id, left, pts, winner: s === winnerSeat };
  }).sort((a, b) => a.left - b.left);
  room.say(animator.htWin(room.players.get(g.seats[winnerSeat])?.name || '?'));
  g.seq++;
  room.enter('htResult', { rows });
  room.setTimer(RESULT_MS, () => newManche(room));
  room.sync();
}

function end(room) {
  room.clearTimer();
  const g = room.ctx.ht;
  const rows = g.seats.map((id) => ({ id, points: g.totals[id] || 0 })).sort((a, b) => b.points - a.points);
  room.enter('htEnd', { rows });
  room.setTimer(END_MS, () => room.finishRound());
  room.sync();
}

function tableView(room) {
  const g = room.ctx.ht;
  return {
    manche: g.manche, total: g.total, seq: g.seq, top: pub(top(g)), suit: g.suit, suitName: SUIT_NAMES[g.suit], dir: g.dir, drawCount: g.draw.length,
    turn: room.phase === 'htPlay' ? g.turn : null, lastEvent: g.lastEvent,
    seats: g.seats.map((id, s) => ({ player: room.pub(id), cards: g.hands[s].length })),
  };
}

module.exports = {
  id: 'huit',
  title: 'Le 8 américain',
  icon: '🎴',
  subtitle: 'Même couleur ou même valeur… et le 8 change tout ! Videz votre main le premier.',
  pitch: 'Cousin du Uno avec un vrai jeu de cartes : 8, Valet, As et 2 spéciaux. 2 à 8 joueurs.',
  rules: 'Posez une carte de même couleur ou de même valeur que la pile. Le 8 se pose sur tout et change la couleur, le Valet fait passer le tour du suivant, l’As inverse le sens, le 2 fait piocher 2 cartes. Vous ne pouvez pas jouer ? Piochez !',
  players: '2 à 8 joueurs',
  duration: '5 à 15 min',
  minPlayers: 2,
  phases: ['htPlay', 'htResult', 'htEnd'],

  introLine: () => animator.htIntro(),
  cannotPlay: (room) => (room.connectedPlayers().length < 2 ? 'Il faut au moins 2 joueurs pour le 8 américain.' : null),

  begin(room) {
    const seats = room.connectedPlayers().slice(0, 8).map((p) => p.id);
    room.ctx.ht = { seats, manche: 0, total: MANCHES[room.settings.length], seq: 0, totals: {}, hands: [], draw: [], discard: [], suit: 'S', dir: 1, turn: 0, drewThisTurn: false, lastEvent: '' };
    newManche(room);
  },

  act(room, p, msg) {
    const g = room.ctx.ht;
    const seat = g.seats.indexOf(p.id);
    if (room.phase !== 'htPlay' || seat !== g.turn) return;
    let ok = false;
    if (msg.type === 'play') ok = play(room, seat, String(msg.card), msg.suit);
    else if (msg.type === 'draw') ok = draw(room, seat);
    else if (msg.type === 'pass') ok = passTurn(room, seat);
    if (!ok) room.sync();
  },

  hostView(room) {
    const d = room.data;
    const base = { ht: tableView(room) };
    if (room.phase === 'htPlay') return { ...base, key: `ht:table:${room.ctx.ht.manche}` };
    if (room.phase === 'htResult') return { ...base, key: `htResult:${room.ctx.ht.manche}`, rows: d.rows.map((r) => ({ ...r, player: room.pub(r.id) })) };
    return { ...base, key: 'htEnd', rows: d.rows.map((r) => ({ ...r, player: room.pub(r.id) })) };
  },

  playerView(room, p) {
    const g = room.ctx.ht;
    const d = room.data;
    const seat = g.seats.indexOf(p.id);
    const hand = seat === -1 ? [] : g.hands[seat];
    const base = { ht: { ...tableView(room), seat, hand: hand.map(pub) } };
    if (room.phase === 'htResult') return { ...base, key: `htResult:${g.manche}`, row: d.rows.find((r) => r.id === p.id) || null };
    if (room.phase === 'htEnd') return { ...base, key: 'htEnd', row: d.rows.find((r) => r.id === p.id) || null };
    const myTurn = seat === g.turn;
    return {
      ...base, key: `ht:${g.seq}:${myTurn}`, myTurn, turnPlayer: room.pub(g.seats[g.turn]),
      playable: myTurn ? hand.filter((c) => playable(g, c)).map((c) => c.id) : [], canDraw: myTurn && !g.drewThisTurn, canPass: myTurn && g.drewThisTurn,
    };
  },
};

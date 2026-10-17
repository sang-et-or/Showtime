// Jeu de cartes « La Belote » (classique, 4 joueurs en 2 équipes, 32 cartes).
// Prise au premier tour (couleur de la retournée) ou au second (autre couleur), obligation de fournir,
// de monter à l'atout, de couper et de surcouper (sauf si le partenaire est maître),
// belote-rebelote, dix de der, capot. Les annonces (tierce, carré…) ne sont pas jouées.
const animator = require('../../animator');
const { deck, pub, RANKS32, SUITS } = require('./cards');

const BID_MS = 20_000;
const PLAY_MS = 25_000;
const AUTO_MS = 1_200;
const TRICK_MS = 1_800;
const SCORE_MS = 8_000;
const END_MS = 8_000;
const DONNES = { short: 2, normal: 4, long: 6 };
const TRUMP_ORDER = ['7', '8', 'Q', 'K', '10', 'A', '9', 'J'];
const PLAIN_ORDER = ['7', '8', '9', 'J', 'Q', 'K', '10', 'A'];
const TRUMP_PTS = { J: 20, 9: 14, A: 11, 10: 10, K: 4, Q: 3, 8: 0, 7: 0 };
const PLAIN_PTS = { A: 11, 10: 10, K: 4, Q: 3, J: 2, 9: 0, 8: 0, 7: 0 };
const SUIT_NAMES = { S: 'Pique', H: 'Cœur', D: 'Carreau', C: 'Trèfle' };

const team = (seat) => seat % 2;
const cardPts = (c, trump) => (c.s === trump ? TRUMP_PTS[c.r] : PLAIN_PTS[c.r]);
const strength = (c, trump, led) => (c.s === trump ? 100 + TRUMP_ORDER.indexOf(c.r) : c.s === led ? PLAIN_ORDER.indexOf(c.r) : -1);

function trickWinner(trick, trump) {
  const led = trick[0].card.s;
  return trick.reduce((best, t) => (strength(t.card, trump, led) > strength(best.card, trump, led) ? t : best)).seat;
}

/** Cartes jouables selon les obligations de la belote. */
function legalCards(hand, trick, trump, seat) {
  if (!trick.length) return hand;
  const led = trick[0].card.s;
  const trumpRank = (c) => TRUMP_ORDER.indexOf(c.r);
  const highestTrump = Math.max(-1, ...trick.filter((t) => t.card.s === trump).map((t) => trumpRank(t.card)));
  const follow = hand.filter((c) => c.s === led);
  if (led === trump) {
    if (!follow.length) return hand;
    const higher = follow.filter((c) => trumpRank(c) > highestTrump);
    return higher.length ? higher : follow; // obligation de monter à l'atout
  }
  if (follow.length) return follow; // obligation de fournir
  if (team(trickWinner(trick, trump)) === team(seat)) return hand; // partenaire maître : on joue ce qu'on veut
  const trumps = hand.filter((c) => c.s === trump);
  if (!trumps.length) return hand;
  if (highestTrump >= 0) {
    const over = trumps.filter((c) => trumpRank(c) > highestTrump);
    return over.length ? over : hand; // surcouper si possible
  }
  return trumps; // obligation de couper
}

function sortHand(hand, trump) {
  const order = trump ? [trump, ...SUITS.filter((s) => s !== trump)] : SUITS;
  return [...hand].sort((a, b) => order.indexOf(a.s) - order.indexOf(b.s) || strength(b, trump, b.s) - strength(a, trump, a.s));
}

function newDonne(room) {
  const g = room.ctx.bl;
  if (g.donne >= g.total) { end(room); return; }
  g.dealer = (g.dealer + 1) % 4;
  const cards = deck(RANKS32);
  const h = { hands: [[], [], [], []], turned: null, talon: [], bidRound: 1, bidder: (g.dealer + 1) % 4, passes: 0, trump: null, taker: null, trick: [], leader: null, won: [[], []], tricks: [0, 0], lastWinner: null, belote: null, beloteSaid: { K: false, Q: false } };
  for (const n of [3, 2]) for (let k = 1; k <= 4; k++) h.hands[(g.dealer + k) % 4].push(...cards.splice(0, n));
  h.turned = cards.shift();
  h.talon = cards;
  g.h = h;
  g.seq++;
  room.say(animator.blDeal(SUIT_NAMES[h.turned.s]));
  promptBid(room);
}

function promptBid(room) {
  const g = room.ctx.bl;
  g.seq++;
  room.enter('blBid', {});
  const pid = g.seats[g.h.bidder];
  room.setTimer(room.players.get(pid)?.connected ? BID_MS : AUTO_MS, () => bid(room, g.h.bidder, null), true);
  room.sync();
}

function bid(room, seat, suit) {
  room.clearTimer();
  const g = room.ctx.bl;
  const h = g.h;
  const name = room.players.get(g.seats[seat])?.name || '?';
  if (suit) {
    h.trump = suit; h.taker = seat;
    room.say(animator.blTake(name, SUIT_NAMES[suit]));
    // le preneur ramasse la retournée + 2 cartes, les autres 3
    h.hands[seat].push(h.turned);
    for (let k = 1; k <= 4; k++) { const s = (g.dealer + k) % 4; h.hands[s].push(...h.talon.splice(0, s === seat ? 2 : 3)); }
    h.hands = h.hands.map((hd) => sortHand(hd, h.trump));
    h.hands.forEach((hd, s) => { if (hd.some((c) => c.s === h.trump && c.r === 'K') && hd.some((c) => c.s === h.trump && c.r === 'Q')) h.belote = s; });
    h.leader = (g.dealer + 1) % 4;
    g.donne++;
    promptPlay(room);
    return;
  }
  h.passes++;
  if (h.passes === 4 && h.bidRound === 1) { h.bidRound = 2; h.passes = 0; room.say('Personne ne prend ! Second tour : choisissez une autre couleur.'); }
  else if (h.passes === 4 && h.bidRound === 2) { room.say('Tout le monde passe ! On redistribue.'); newDonne(room); return; }
  h.bidder = (h.bidder + 1) % 4;
  promptBid(room);
}

function current(g) { return (g.h.leader + g.h.trick.length) % 4; }

function promptPlay(room) {
  const g = room.ctx.bl;
  g.seq++;
  room.enter('blPlay', { trickDone: false });
  const seat = current(g);
  const pid = g.seats[seat];
  room.setTimer(room.players.get(pid)?.connected ? PLAY_MS : AUTO_MS, () => {
    const legal = legalCards(g.h.hands[seat], g.h.trick, g.h.trump, seat);
    const cheapest = [...legal].sort((a, b) => cardPts(a, g.h.trump) - cardPts(b, g.h.trump) || strength(a, g.h.trump, a.s) - strength(b, g.h.trump, b.s))[0];
    play(room, seat, cheapest.id);
  }, true);
  room.sync();
}

function play(room, seat, cardId) {
  const g = room.ctx.bl;
  const h = g.h;
  const legal = legalCards(h.hands[seat], h.trick, h.trump, seat);
  const card = legal.find((c) => c.id === cardId);
  if (!card) return false;
  room.clearTimer();
  h.hands[seat] = h.hands[seat].filter((c) => c.id !== cardId);
  h.trick.push({ seat, card });
  if (h.belote === seat && card.s === h.trump && (card.r === 'K' || card.r === 'Q')) {
    const first = !h.beloteSaid.K && !h.beloteSaid.Q;
    h.beloteSaid[card.r] = true;
    room.say(first ? `Belote ! (${room.players.get(g.seats[seat])?.name})` : 'Rebelote !');
  }
  if (h.trick.length < 4) { promptPlay(room); return true; }
  // pli complet : on le montre un instant puis on le ramasse
  const winner = trickWinner(h.trick, h.trump);
  g.seq++;
  room.enter('blPlay', { trickDone: true, winner });
  room.setTimer(TRICK_MS, () => collect(room, winner));
  room.sync();
  return true;
}

function collect(room, winner) {
  const g = room.ctx.bl;
  const h = g.h;
  h.won[team(winner)].push(...h.trick.map((t) => t.card));
  h.tricks[team(winner)]++;
  h.lastWinner = winner;
  h.trick = [];
  h.leader = winner;
  if (h.hands.every((hd) => !hd.length)) { score(room); return; }
  promptPlay(room);
}

function score(room) {
  const g = room.ctx.bl;
  const h = g.h;
  const base = [0, 1].map((t) => h.won[t].reduce((a, c) => a + cardPts(c, h.trump), 0));
  base[team(h.lastWinner)] += 10; // dix de der
  const bel = [0, 0];
  if (h.belote != null) bel[team(h.belote)] = 20;
  const takerTeam = team(h.taker);
  const def = 1 - takerTeam;
  let result = [0, 0]; let verdict;
  const capot = h.tricks[0] === 8 ? 0 : h.tricks[1] === 8 ? 1 : null;
  if (capot != null) {
    result[capot] = 252 + bel[capot]; result[1 - capot] = bel[1 - capot]; verdict = 'capot';
  } else if (base[takerTeam] + bel[takerTeam] > base[def] + bel[def]) {
    result = [base[0] + bel[0], base[1] + bel[1]]; verdict = 'fait';
  } else {
    result[def] = 162 + bel[def]; result[takerTeam] = bel[takerTeam]; verdict = 'dedans';
  }
  g.scores[0] += result[0]; g.scores[1] += result[1];
  if (verdict === 'capot') room.highlight('capot', 1, { emoji: '💥', title: 'Capot à la belote !', body: `L’équipe de ${g.seats.filter((_, s) => team(s) === capot).map((id) => room.players.get(id)?.name).join(' et ')} remporte les 8 plis !`, players: g.seats.filter((_, s) => team(s) === capot) });
  if (verdict === 'dedans') room.highlight('dedans', 1, { emoji: '😱', title: 'Dedans !', body: `${room.players.get(g.seats[h.taker])?.name} a pris à ${SUIT_NAMES[h.trump]}… et l’équipe est tombée dedans !`, players: [g.seats[h.taker]] });
  const takerName = room.players.get(g.seats[h.taker])?.name || '?';
  room.say(verdict === 'capot' ? 'CAPOT ! Tous les plis pour la même équipe !' : verdict === 'fait' ? animator.blMade(takerName) : animator.blDedans(takerName));
  g.seq++;
  room.enter('blScore', { base, bel, result, verdict, takerTeam, tricks: h.tricks });
  room.setTimer(SCORE_MS, () => newDonne(room));
  room.sync();
}

function end(room) {
  room.clearTimer();
  const g = room.ctx.bl;
  const win = g.scores[0] === g.scores[1] ? null : g.scores[0] > g.scores[1] ? 0 : 1;
  g.seats.forEach((id, s) => room.addScore(id, g.scores[team(s)] + (win === team(s) ? 300 : 0)));
  const names = (t) => g.seats.filter((_, s) => team(s) === t).map((id) => room.players.get(id)?.name || '?').join(' et ');
  room.say(win == null ? 'Égalité parfaite à la belote !' : `Victoire de ${names(win)} à la belote !`);
  room.enter('blEnd', { win, scores: g.scores });
  room.setTimer(END_MS, () => room.finishRound());
  room.sync();
}

function tableView(room) {
  const g = room.ctx.bl;
  const h = g.h;
  return {
    seq: g.seq, donne: g.donne, total: g.total, scores: g.scores, dealer: g.dealer,
    seats: g.seats.map((id, s) => ({ player: room.pub(id), team: team(s), cards: h ? h.hands[s].length : 0 })),
    trump: h?.trump || null, trumpName: h?.trump ? SUIT_NAMES[h.trump] : '', taker: h?.taker ?? null,
    turned: h && !h.trump ? pub(h.turned) : null, bidRound: h?.bidRound || 1, bidder: h && !h.trump ? h.bidder : null,
    trick: h ? h.trick.map((t) => ({ seat: t.seat, card: pub(t.card) })) : [], toPlay: room.phase === 'blPlay' && !room.data.trickDone ? current(g) : null,
    tricks: h?.tricks || [0, 0],
  };
}

module.exports = {
  id: 'belote',
  title: 'La Belote',
  icon: '🂡',
  subtitle: 'Deux équipes, un atout, et des plis à remporter. Belote… rebelote !',
  pitch: 'La belote classique à 4, en équipes de 2. Cartes dans le téléphone !',
  rules: 'Équipes face à face (1er et 3e contre 2e et 4e). Prenez à la couleur de la retournée ou choisissez-en une autre au 2e tour. Fournissez, montez à l’atout, coupez… L’équipe qui prend doit faire plus de points que l’autre, sinon elle est dedans !',
  players: '4 joueurs',
  duration: '15 à 25 min',
  minPlayers: 4,
  phases: ['blBid', 'blPlay', 'blScore', 'blEnd'],
  legalCards,

  introLine: () => animator.blIntro(),
  cannotPlay: (room) => (room.connectedPlayers().length < 4 ? 'La belote se joue à 4 joueurs exactement.' : null),

  begin(room) {
    const seats = room.connectedPlayers().slice(0, 4).map((p) => p.id);
    room.ctx.bl = { seats, scores: [0, 0], donne: 0, total: DONNES[room.settings.length], dealer: 3, seq: 0, h: null };
    if (room.connectedPlayers().length > 4) room.say('Quatre joueurs à la table, les autres sont les kibitz ! Regardez sans souffler…');
    newDonne(room);
  },

  act(room, p, msg) {
    const g = room.ctx.bl;
    const seat = g.seats.indexOf(p.id);
    if (seat === -1) return;
    if (room.phase === 'blBid' && g.h.bidder === seat) {
      if (msg.type === 'pass') bid(room, seat, null);
      else if (msg.type === 'take') {
        if (g.h.bidRound === 1) bid(room, seat, g.h.turned.s);
        else if (SUITS.includes(msg.suit) && msg.suit !== g.h.turned.s) bid(room, seat, msg.suit);
      }
      return;
    }
    if (room.phase === 'blPlay' && !room.data.trickDone && current(g) === seat && msg.type === 'play') play(room, seat, String(msg.card));
  },

  hostView(room) {
    const d = room.data;
    const base = { bl: tableView(room) };
    if (room.phase === 'blScore') return { ...base, key: `blScore:${room.ctx.bl.donne}`, result: d };
    if (room.phase === 'blEnd') return { ...base, key: 'blEnd', win: d.win };
    return { ...base, key: 'bl:table', trickDone: !!d.trickDone, winner: d.winner ?? null };
  },

  playerView(room, p) {
    const g = room.ctx.bl;
    const h = g.h;
    const d = room.data;
    const seat = g.seats.indexOf(p.id);
    const base = { bl: { ...tableView(room), seat, myTeam: seat === -1 ? null : team(seat), partner: seat === -1 ? null : room.pub(g.seats[(seat + 2) % 4]) } };
    if (room.phase === 'blScore') return { ...base, key: `blScore:${g.donne}`, result: d };
    if (room.phase === 'blEnd') return { ...base, key: 'blEnd', win: d.win };
    const hand = seat === -1 || !h ? [] : h.hands[seat];
    const myTurn = (room.phase === 'blPlay' && !d.trickDone && current(g) === seat) || (room.phase === 'blBid' && h.bidder === seat);
    const legal = room.phase === 'blPlay' && myTurn ? legalCards(hand, h.trick, h.trump, seat).map((c) => c.id) : [];
    return {
      ...base, key: `bl:${g.seq}:${myTurn}`,
      hand: sortHand(hand, h?.trump).map(pub), legal, myTurn,
      bidSuits: room.phase === 'blBid' && h.bidRound === 2 ? SUITS.filter((s) => s !== h.turned.s) : null,
      turnPlayer: room.pub(g.seats[room.phase === 'blBid' ? h.bidder : current(g)]),
    };
  },
};

// Jeu de cartes « Le 21 » (blackjack) contre le croupier Max Paillettes. Jetons virtuels uniquement.
// Tout le monde mise, puis joue sa main EN MÊME TEMPS (carte / je reste / doubler) : c'est rapide en soirée.
const animator = require('../../animator');
const { deck, pub } = require('./cards');

const BET_MS = 14_000;
const PLAY_MS = 22_000;
const DEALER_MS = 3_500;
const RESULT_MS = 6_000;
const END_MS = 7_000;
const START_CHIPS = 1_000;
const BETS = [50, 100, 200, 500];
const ROUNDS = { short: 4, normal: 6, long: 9 };

function handValue(cards) {
  let total = 0; let aces = 0;
  for (const c of cards) {
    if (c.r === 'A') { total += 11; aces++; } else if (['K', 'Q', 'J'].includes(c.r)) total += 10; else total += Number(c.r);
  }
  while (total > 21 && aces) { total -= 10; aces--; }
  return total;
}
const isBJ = (cards) => cards.length === 2 && handValue(cards) === 21;
const draw = (g) => { if (!g.shoe.length) g.shoe = deck(undefined, 2); return g.shoe.pop(); };

function nextRound(room) {
  const g = room.ctx.bj;
  g.round++;
  if (g.round > g.total) { end(room); return; }
  for (const id of g.seats) {
    if (g.chips[id] < BETS[0]) { g.chips[id] = BETS[0]; g.helped.add(id); } // le croupier fait crédit d'une mise
  }
  g.shoe = deck(undefined, 2);
  g.seq++;
  room.enter('bjBet', { bets: new Map() });
  room.say(g.round === 1 ? animator.bjFirst() : animator.bjBet(g.round, g.total));
  room.setTimer(BET_MS, () => deal(room), true);
  room.sync();
}

function deal(room) {
  room.clearTimer();
  const g = room.ctx.bj;
  const bets = room.data.bets;
  const seated = g.seats.filter((id) => room.players.get(id)?.connected || bets.has(id));
  g.hands = {};
  for (const id of seated) {
    const bet = bets.get(id) || Math.min(100, g.chips[id]);
    g.chips[id] -= bet;
    g.hands[id] = { cards: [draw(g), draw(g)], bet, done: false, doubled: false };
    if (isBJ(g.hands[id].cards)) g.hands[id].done = true;
  }
  g.dealer = [draw(g), draw(g)];
  g.seq++;
  room.enter('bjPlay', {});
  room.setTimer(PLAY_MS, () => dealerTurn(room), true);
  room.sync();
  checkAllDone(room);
}

function checkAllDone(room) {
  const g = room.ctx.bj;
  if (room.phase === 'bjPlay' && Object.entries(g.hands).every(([id, h]) => h.done || !room.players.get(id)?.connected)) room.setTimer(700, () => dealerTurn(room));
}

function dealerTurn(room) {
  room.clearTimer();
  const g = room.ctx.bj;
  Object.values(g.hands).forEach((h) => { h.done = true; });
  const anyAlive = Object.values(g.hands).some((h) => handValue(h.cards) <= 21 && !isBJ(h.cards));
  if (anyAlive) while (handValue(g.dealer) < 17) g.dealer.push(draw(g));
  g.seq++;
  room.enter('bjDealer', {});
  const v = handValue(g.dealer);
  room.say(v > 21 ? animator.bjDealerBust() : isBJ(g.dealer) ? 'Blackjack pour le croupier ! Aïe aïe aïe…' : `Le croupier fait ${v}.`);
  room.setTimer(DEALER_MS + (g.dealer.length - 2) * 600, () => results(room));
  room.sync();
}

function results(room) {
  const g = room.ctx.bj;
  const dv = handValue(g.dealer);
  const dBJ = isBJ(g.dealer);
  const rows = Object.entries(g.hands).map(([id, h]) => {
    const v = handValue(h.cards);
    let outcome; let gain;
    if (v > 21) { outcome = 'bust'; gain = -h.bet; } else if (isBJ(h.cards) && !dBJ) { outcome = 'blackjack'; gain = Math.floor(h.bet * 1.5); } else if (dBJ && !isBJ(h.cards)) { outcome = 'lose'; gain = -h.bet; } else if (dv > 21 || v > dv) { outcome = 'win'; gain = h.bet; } else if (v === dv) { outcome = 'push'; gain = 0; } else { outcome = 'lose'; gain = -h.bet; }
    g.chips[id] += h.bet + gain;
    if (outcome === 'blackjack') room.highlight('blackjack', gain, { emoji: '🃏', title: 'Blackjack !', body: `${room.players.get(id)?.name} sort un blackjack et empoche ${gain} jetons !`, players: [id] });
    return { id, outcome, gain, value: v };
  });
  const winners = rows.filter((r) => r.gain > 0).length;
  room.say(winners ? animator.bjWinners(winners) : 'La banque gagne tout ! Le croupier se frotte les mains.');
  g.seq++;
  room.enter('bjResult', { rows });
  room.setTimer(RESULT_MS, () => nextRound(room));
  room.sync();
}

function end(room) {
  room.clearTimer();
  const g = room.ctx.bj;
  const rows = g.seats.map((id) => ({ id, chips: g.chips[id], points: Math.max(0, Math.round(g.chips[id] / 2)) })).sort((a, b) => b.chips - a.chips);
  rows.forEach((r) => room.addScore(r.id, r.points));
  room.say(`Le casino ferme ses portes ! ${room.players.get(rows[0]?.id)?.name || '?'} repart avec le plus de jetons !`);
  room.enter('bjEnd', { rows });
  room.setTimer(END_MS, () => room.finishRound());
  room.sync();
}

function tableView(room, revealDealer) {
  const g = room.ctx.bj;
  const hands = g.hands || {};
  return {
    round: g.round, total: g.total, seq: g.seq,
    dealer: revealDealer ? g.dealer.map(pub) : g.dealer ? [pub(g.dealer[0]), null] : [],
    dealerValue: revealDealer && g.dealer ? handValue(g.dealer) : null,
    seats: g.seats.map((id) => {
      const h = hands[id];
      return { player: room.pub(id), chips: g.chips[id], hand: h ? { cards: h.cards.map(pub), value: handValue(h.cards), bet: h.bet, done: h.done, bj: isBJ(h.cards) } : null };
    }),
  };
}

module.exports = {
  id: 'blackjack',
  title: 'Le 21',
  icon: '🎰',
  subtitle: 'Approchez-vous de 21 sans le dépasser et battez le croupier ! Jetons virtuels.',
  pitch: 'Blackjack contre le croupier Max, tout le monde joue en même temps. Jetons virtuels.',
  rules: 'Misez vos jetons virtuels, puis demandez des cartes pour approcher 21 sans dépasser. Les figures valent 10, l’As 1 ou 11. Le croupier tire jusqu’à 17. Blackjack (As + figure) = mise × 1,5 !',
  players: '1 à 8 joueurs',
  duration: '5 à 10 min',
  minPlayers: 1,
  phases: ['bjBet', 'bjPlay', 'bjDealer', 'bjResult', 'bjEnd'],
  handValue,

  introLine: () => animator.bjIntro(),

  begin(room) {
    const seats = room.connectedPlayers().slice(0, 8).map((p) => p.id);
    room.ctx.bj = { seats, chips: Object.fromEntries(seats.map((id) => [id, START_CHIPS])), round: 0, total: ROUNDS[room.settings.length], seq: 0, helped: new Set(), hands: {}, dealer: null, shoe: [] };
    nextRound(room);
  },

  act(room, p, msg) {
    const g = room.ctx.bj;
    if (!g.seats.includes(p.id)) return;
    if (room.phase === 'bjBet' && msg.type === 'bet' && !room.data.bets.has(p.id)) {
      const bet = Number(msg.amount);
      if (!BETS.includes(bet) || bet > g.chips[p.id]) return;
      room.data.bets.set(p.id, bet);
      this.check(room);
      room.sync();
      return;
    }
    const h = g.hands?.[p.id];
    if (room.phase !== 'bjPlay' || !h || h.done) return;
    if (msg.type === 'hit') {
      h.cards.push(draw(g));
      if (handValue(h.cards) >= 21) h.done = true;
    } else if (msg.type === 'stand') {
      h.done = true;
    } else if (msg.type === 'double' && h.cards.length === 2 && g.chips[p.id] >= h.bet) {
      g.chips[p.id] -= h.bet; h.bet *= 2; h.doubled = true;
      h.cards.push(draw(g)); h.done = true;
    } else return;
    g.seq++;
    checkAllDone(room);
    room.sync();
  },

  check(room) {
    const g = room.ctx.bj;
    if (room.phase === 'bjBet') {
      const need = g.seats.filter((id) => room.players.get(id)?.connected);
      if (need.length && need.every((id) => room.data.bets.has(id))) room.setTimer(600, () => deal(room));
    } else if (room.phase === 'bjPlay') checkAllDone(room);
  },

  hostView(room) {
    const d = room.data;
    const g = room.ctx.bj;
    const reveal = ['bjDealer', 'bjResult'].includes(room.phase);
    const base = { bj: tableView(room, reveal) };
    switch (room.phase) {
      case 'bjBet': return { ...base, key: `bjBet:${g.round}`, bets: Object.fromEntries(d.bets) };
      case 'bjPlay': return { ...base, key: `bjTable:${g.round}` };
      case 'bjDealer': return { ...base, key: `bjTable:${g.round}` };
      case 'bjResult': return { ...base, key: `bjTable:${g.round}`, results: d.rows };
      default: return { ...base, key: 'bjEnd', rows: d.rows.map((r) => ({ ...r, player: room.pub(r.id) })) };
    }
  },

  playerView(room, p) {
    const g = room.ctx.bj;
    const d = room.data;
    const h = g.hands?.[p.id];
    const base = { bj: { round: g.round, total: g.total, chips: g.chips[p.id] ?? 0, seated: g.seats.includes(p.id), helped: g.helped.has(p.id) } };
    const mine = h ? { cards: h.cards.map(pub), value: handValue(h.cards), bet: h.bet, done: h.done, bj: isBJ(h.cards), canDouble: h.cards.length === 2 && !h.done && (g.chips[p.id] >= h.bet) } : null;
    switch (room.phase) {
      case 'bjBet': {
        const bet = d.bets.get(p.id) || null;
        return { ...base, key: `bjBet:${g.round}:${!!bet}`, bet, bets: BETS.filter((b) => b <= (g.chips[p.id] ?? 0)) };
      }
      case 'bjPlay': return { ...base, key: `bjPlay:${g.round}:${mine?.cards.length}:${mine?.done}`, mine, dealerUp: pub(g.dealer[0]) };
      case 'bjDealer': return { ...base, key: `bjDealer:${g.round}`, mine, dealer: g.dealer.map(pub), dealerValue: handValue(g.dealer) };
      case 'bjResult': return { ...base, key: `bjResult:${g.round}`, mine, result: d.rows.find((r) => r.id === p.id) || null };
      default: return { ...base, key: 'bjEnd', row: d.rows.find((r) => r.id === p.id) || null };
    }
  },
};

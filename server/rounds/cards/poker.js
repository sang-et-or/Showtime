// Jeu de cartes « Le Poker » (Texas Hold'em), jetons virtuels uniquement.
// Blindes qui montent, paroles chronométrées, tapis et pots annexes gérés correctement.
const animator = require('../../animator');
const { deck, pub, nextSeat, bestHand, compareScore } = require('./cards');

const ACT_MS = 25_000;
const AUTO_MS = 1_200; // joueur déconnecté : on joue pour lui (parole ou couché)
const STREET_MS = 1_500;
const SHOW_MS = 7_500;
const FOLD_WIN_MS = 3_500;
const END_MS = 8_000;
const START_CHIPS = 1_000;
const HANDS = { short: 6, normal: 10, long: 16 };
const CAP_MIN = { short: 10, normal: 15, long: 22 };
const STREETS = ['preflop', 'flop', 'turn', 'river'];
const LABELS = { preflop: 'Avant le flop', flop: 'Flop', turn: 'Turn', river: 'River' };

const blindsFor = (handNo) => { const lvl = Math.floor((handNo - 1) / 4); const bb = 20 * 2 ** lvl; return { sb: bb / 2, bb }; };

function startHand(room) {
  const g = room.ctx.pk;
  const eligible = (s) => g.chips[g.seats[s]] > 0 && room.players.get(g.seats[s])?.connected;
  const players = g.seats.filter((_, s) => eligible(s));
  if (g.handNo >= g.total || players.length < 2 || Date.now() > g.endsAt) { end(room); return; }
  g.handNo++;
  const n = g.seats.length;
  g.button = nextSeat(n, g.button, eligible);
  const { sb, bb } = blindsFor(g.handNo);
  const h = {
    deck: deck(), board: [], hole: {}, inHand: new Set(), allIn: new Set(), bet: {}, contrib: {}, acted: new Set(),
    street: 'preflop', currentBet: 0, minRaise: bb, sb, bb, toAct: -1, last: {},
  };
  g.h = h;
  g.seats.forEach((id, s) => { if (eligible(s)) { h.inHand.add(id); h.hole[id] = [h.deck.pop(), h.deck.pop()]; h.bet[id] = 0; h.contrib[id] = 0; } });
  const heads = h.inHand.size === 2;
  const sbSeat = heads ? g.button : nextSeat(n, g.button, eligible);
  const bbSeat = nextSeat(n, sbSeat, eligible);
  put(g, g.seats[sbSeat], sb); h.last[g.seats[sbSeat]] = `Petite blinde ${sb}`;
  put(g, g.seats[bbSeat], bb); h.last[g.seats[bbSeat]] = `Grosse blinde ${bb}`;
  h.currentBet = bb;
  h.toAct = nextSeat(n, bbSeat, (s) => canAct(g, g.seats[s]));
  if (g.handNo > 1 && (g.handNo - 1) % 4 === 0) room.say(animator.pkBlinds(sb, bb));
  else room.say(animator.pkDeal(g.handNo, g.total));
  if (h.toAct === -1) { advance(room); return; }
  prompt(room);
}

const canAct = (g, id) => g.h.inHand.has(id) && !g.h.allIn.has(id);

function put(g, id, amount) {
  const a = Math.min(amount, g.chips[id]);
  g.chips[id] -= a; g.h.bet[id] += a; g.h.contrib[id] += a;
  if (g.chips[id] === 0) g.h.allIn.add(id);
  return a;
}

function prompt(room) {
  const g = room.ctx.pk;
  g.seq++;
  room.enter('pkPlay', {});
  const id = g.seats[g.h.toAct];
  const auto = () => { const h = g.h; doAction(room, id, h.bet[id] === h.currentBet ? { type: 'check' } : { type: 'fold' }); };
  room.setTimer(room.players.get(id)?.connected ? ACT_MS : AUTO_MS, auto, true);
  room.sync();
}

function doAction(room, id, msg) {
  const g = room.ctx.pk;
  const h = g.h;
  const toCall = h.currentBet - h.bet[id];
  const name = room.players.get(id)?.name || '?';
  switch (msg.type) {
    case 'fold':
      h.inHand.delete(id); h.last[id] = 'Couché'; break;
    case 'check':
      if (toCall > 0) return false;
      h.last[id] = 'Parole'; break;
    case 'call': {
      if (toCall <= 0) return false;
      const paid = put(g, id, toCall);
      h.last[id] = h.allIn.has(id) ? `Tapis (${paid})` : `Suit ${paid}`;
      break;
    }
    case 'raise': {
      const to = Math.floor(Number(msg.to));
      const maxTo = h.bet[id] + g.chips[id];
      if (!Number.isFinite(to) || to <= h.currentBet || to > maxTo) return false;
      if (to - h.currentBet < h.minRaise && to !== maxTo) return false;
      put(g, id, to - h.bet[id]);
      if (to - h.currentBet >= h.minRaise) h.minRaise = to - h.currentBet;
      h.currentBet = to;
      h.acted = new Set();
      h.last[id] = h.allIn.has(id) ? `TAPIS ${to}` : `Relance à ${to}`;
      if (h.allIn.has(id)) room.say(animator.pkAllIn(name));
      break;
    }
    default: return false;
  }
  room.clearTimer();
  h.acted.add(id);
  advance(room);
  return true;
}

function bettingDone(g) {
  const h = g.h;
  const active = [...h.inHand].filter((id) => !h.allIn.has(id));
  if (active.length === 0) return true;
  // tous ceux qui peuvent encore jouer ont parlé et égalisé la mise
  if (active.every((id) => h.acted.has(id) && h.bet[id] === h.currentBet)) return true;
  // un seul joueur peut encore agir et il couvre déjà la plus grosse mise : rien à décider
  return active.length === 1 && h.bet[active[0]] >= h.currentBet;
}
function advance(room) {
  const g = room.ctx.pk;
  const h = g.h;
  if (h.inHand.size === 1) { showdown(room, true); return; }
  if (!bettingDone(g)) {
    const n = g.seats.length;
    h.toAct = nextSeat(n, h.toAct, (s) => { const id = g.seats[s]; return canAct(g, id) && !(h.acted.has(id) && h.bet[id] === h.currentBet); });
    if (h.toAct !== -1) { prompt(room); return; }
  }
  // tour d'enchères terminé : on passe à la rue suivante
  const i = STREETS.indexOf(h.street);
  if (i === STREETS.length - 1) { showdown(room, false); return; }
  h.street = STREETS[i + 1];
  for (const id of Object.keys(h.bet)) h.bet[id] = 0;
  h.currentBet = 0; h.minRaise = h.bb; h.acted = new Set();
  for (const id of h.inHand) if (!h.allIn.has(id) && h.last[id] !== 'Couché') h.last[id] = '';
  h.deck.pop(); // carte brûlée
  const count = h.street === 'flop' ? 3 : 1;
  for (let k = 0; k < count; k++) h.board.push(h.deck.pop());
  room.say(`${LABELS[h.street]} !`);
  const active = [...h.inHand].filter((id) => !h.allIn.has(id));
  g.seq++;
  room.enter('pkPlay', { dealing: true });
  room.sync();
  if (active.length <= 1) { room.setTimer(STREET_MS + 800, () => advance(room)); return; } // tapis : on déroule le tableau
  const n = g.seats.length;
  h.toAct = nextSeat(n, g.button, (s) => canAct(g, g.seats[s]));
  room.setTimer(STREET_MS, () => prompt(room));
}

/** Abattage : pots annexes calculés selon ce que chacun a misé, partagés en cas d'égalité. */
function showdown(room, byFold) {
  room.clearTimer();
  const g = room.ctx.pk;
  const h = g.h;
  const pots = [];
  const hands = {};
  if (byFold) {
    const winner = [...h.inHand][0];
    const total = Object.values(h.contrib).reduce((a, b) => a + b, 0);
    g.chips[winner] += total;
    pots.push({ amount: total, winners: [winner] });
    room.say(animator.pkFoldWin(room.players.get(winner)?.name || '?', total));
  } else {
    while (h.board.length < 5) h.board.push(h.deck.pop());
    for (const id of h.inHand) hands[id] = bestHand([...h.hole[id], ...h.board]);
    const levels = [...new Set(Object.values(h.contrib).filter((v) => v > 0))].sort((a, b) => a - b);
    let prev = 0;
    for (const lvl of levels) {
      const amount = Object.values(h.contrib).reduce((a, c) => a + Math.max(0, Math.min(c, lvl) - prev), 0);
      const eligible = [...h.inHand].filter((id) => h.contrib[id] >= lvl);
      prev = lvl;
      if (!amount || !eligible.length) continue;
      let best = null; let winners = [];
      for (const id of eligible) {
        const c = best ? compareScore(hands[id].score, best) : 1;
        if (c > 0) { best = hands[id].score; winners = [id]; } else if (c === 0) winners.push(id);
      }
      const share = Math.floor(amount / winners.length);
      winners.forEach((id, k) => { g.chips[id] += share + (k === 0 ? amount - share * winners.length : 0); });
      const last = pots[pots.length - 1];
      if (last && last.winners.join() === winners.join()) last.amount += amount; else pots.push({ amount, winners });
    }
    const main = pots[0];
    if (main) room.highlight('pot', main.amount, { emoji: '💰', title: 'Le plus gros pot', body: `${main.winners.map((id) => room.players.get(id)?.name).join(' et ')} ramasse ${main.amount.toLocaleString('fr-FR')} jetons avec ${hands[main.winners[0]].name.toLowerCase()} !`, players: main.winners });
    if (main) room.say(animator.pkShowdown(main.winners.map((id) => room.players.get(id)?.name || '?').join(' et '), hands[main.winners[0]].name));
  }
  g.seq++;
  room.enter('pkShow', {
    byFold, pots,
    hands: Object.fromEntries(Object.entries(hands).map(([id, r]) => [id, { name: r.name, cards: h.hole[id].map(pub), best: r.cards.map((c) => c.id) }])),
  });
  room.setTimer(byFold ? FOLD_WIN_MS : SHOW_MS, () => startHand(room));
  room.sync();
}

function end(room) {
  room.clearTimer();
  const g = room.ctx.pk;
  const rows = g.seats.map((id) => ({ id, chips: g.chips[id], points: Math.round(g.chips[id] / 2) })).sort((a, b) => b.chips - a.chips);
  rows.forEach((r) => room.addScore(r.id, r.points));
  room.say(`Fin de la partie de poker ! ${room.players.get(rows[0]?.id)?.name || '?'} repart avec le plus gros tapis !`);
  room.enter('pkEnd', { rows });
  room.setTimer(END_MS, () => room.finishRound());
  room.sync();
}

function tableView(room) {
  const g = room.ctx.pk;
  const h = g.h;
  const pot = h ? Object.values(h.contrib).reduce((a, b) => a + b, 0) : 0;
  return {
    handNo: g.handNo, total: g.total, seq: g.seq, button: g.button, blinds: h ? { sb: h.sb, bb: h.bb } : null,
    street: h?.street, streetLabel: h ? LABELS[h.street] : '', board: h ? h.board.map(pub) : [], pot, toAct: room.phase === 'pkPlay' && !room.data.dealing ? h?.toAct : -1,
    endsInMs: Math.max(0, g.endsAt - Date.now()),
    seats: g.seats.map((id) => ({
      player: room.pub(id), chips: g.chips[id], bet: h?.bet[id] || 0, inHand: !!h?.inHand.has(id), dealt: !!h?.hole[id],
      allIn: !!h?.allIn.has(id), last: h?.last[id] || '',
    })),
  };
}

module.exports = {
  id: 'poker',
  title: 'Le Poker',
  icon: '♠️',
  subtitle: 'Texas Hold’em : deux cartes cachées, cinq sur la table, et du bluff ! Jetons virtuels.',
  pitch: 'Texas Hold’em entre amis : blindes, relances, tapis et bluff. Jetons virtuels.',
  rules: 'Chacun reçoit 2 cartes secrètes sur son téléphone, 5 cartes communes arrivent sur la table. Suivez, relancez ou couchez-vous ! La meilleure combinaison de 5 cartes remporte le pot. Les blindes montent toutes les 4 donnes.',
  players: '2 à 8 joueurs',
  duration: '15 à 25 min',
  minPlayers: 2,
  phases: ['pkPlay', 'pkShow', 'pkEnd'],

  introLine: () => animator.pkIntro(),
  cannotPlay: (room) => (room.connectedPlayers().length < 2 ? 'Il faut au moins 2 joueurs pour le poker.' : null),

  begin(room) {
    const seats = room.connectedPlayers().slice(0, 8).map((p) => p.id);
    room.ctx.pk = {
      seats, chips: Object.fromEntries(seats.map((id) => [id, START_CHIPS])), button: -1, handNo: 0, seq: 0, h: null,
      total: HANDS[room.settings.length], endsAt: Date.now() + (Number(process.env.SHOWTIME_GAME_CAP_MS) || CAP_MIN[room.settings.length] * 60_000),
    };
    startHand(room);
  },

  act(room, p, msg) {
    const g = room.ctx.pk;
    if (room.phase !== 'pkPlay' || room.data.dealing || g.seats[g.h.toAct] !== p.id) return;
    if (doAction(room, p.id, msg) === false) room.sync();
  },

  hostView(room) {
    const d = room.data;
    const base = { pk: tableView(room) };
    if (room.phase === 'pkPlay') return { ...base, key: 'pk:table' };
    if (room.phase === 'pkShow') return { ...base, key: 'pk:table', show: { byFold: d.byFold, pots: d.pots.map((x) => ({ amount: x.amount, winners: x.winners.map((id) => room.pub(id)) })), hands: d.hands } };
    return { ...base, key: 'pkEnd', rows: d.rows.map((r) => ({ ...r, player: room.pub(r.id) })) };
  },

  playerView(room, p) {
    const g = room.ctx.pk;
    const h = g.h;
    const d = room.data;
    const me = p.id;
    const seated = g.seats.includes(me);
    const base = {
      pk: {
        seated, chips: g.chips[me] ?? 0, hole: h?.hole[me]?.map(pub) || [], board: h ? h.board.map(pub) : [], street: h ? LABELS[h.street] : '',
        pot: h ? Object.values(h.contrib).reduce((a, b) => a + b, 0) : 0, inHand: !!h?.inHand.has(me), handNo: g.handNo, total: g.total,
      },
    };
    if (room.phase === 'pkEnd') return { ...base, key: 'pkEnd', row: d.rows.find((r) => r.id === me) || null };
    if (room.phase === 'pkShow') {
      const won = d.pots.filter((x) => x.winners.includes(me)).reduce((a, x) => a + Math.floor(x.amount / x.winners.length), 0);
      return { ...base, key: `pkShow:${g.handNo}`, won, byFold: d.byFold, myHand: d.hands[me]?.name || (h?.hole[me] && h.board.length >= 3 ? bestHand([...h.hole[me], ...h.board]).name : null), winners: d.pots[0]?.winners.map((id) => room.pub(id)) || [] };
    }
    const isTurn = !d.dealing && g.seats[h.toAct] === me;
    const toCall = h ? Math.max(0, h.currentBet - (h.bet[me] || 0)) : 0;
    const maxTo = (h?.bet[me] || 0) + (g.chips[me] || 0);
    const minTo = Math.min(maxTo, (h?.currentBet || 0) + (h?.minRaise || 0));
    const pot = base.pk.pot;
    const presets = isTurn ? [...new Set([minTo, Math.min(maxTo, h.currentBet + Math.max(h.minRaise, pot)), maxTo])].filter((v) => v > h.currentBet) : [];
    return {
      ...base,
      key: `pkPlay:${g.handNo}:${h.street}:${isTurn}:${g.seq}`,
      turn: {
        isTurn, toCall: Math.min(toCall, g.chips[me] || 0), canCheck: toCall === 0, minTo, maxTo, presets,
        myBet: h?.bet[me] || 0, currentBet: h?.currentBet || 0, turnPlayer: room.pub(g.seats[h.toAct]) || null,
        myHand: h?.hole[me] && h.board.length >= 3 ? bestHand([...h.hole[me], ...h.board]).name : null,
      },
    };
  },
};

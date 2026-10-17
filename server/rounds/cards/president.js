// Jeu de cartes « Le Président » : se débarrasser de ses cartes le premier.
// On pose 1 à 4 cartes de même valeur ; les suivants doivent poser autant de cartes, plus fortes, ou passer.
// Ordre : 3 (la plus faible) … Roi, As, 2 (la plus forte). Entre deux manches, le Clochard donne
// ses meilleures cartes au Président, qui lui rend ses plus faibles.
const animator = require('../../animator');
const { deck, pub, nextSeat } = require('./cards');

const ORDER = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const TURN_MS = 22_000;
const AUTO_MS = 1_200;
const CLEAR_MS = 1_800;
const RESULT_MS = 8_000;
const END_MS = 8_000;
const MANCHES = { short: 2, normal: 3, long: 5 };

const val = (c) => ORDER.indexOf(c.r);
const sortHand = (hand) => [...hand].sort((a, b) => val(a) - val(b) || a.s.localeCompare(b.s));

function titles(n) {
  return Array.from({ length: n }, (_, i) => {
    if (i === 0) return { name: 'Président', icon: '👑', pts: 400 };
    if (i === n - 1) return { name: 'Clochard', icon: '🥾', pts: 0 };
    if (n >= 4 && i === 1) return { name: 'Vice-Président', icon: '🎩', pts: 250 };
    if (n >= 4 && i === n - 2) return { name: 'Vice-Clochard', icon: '🧦', pts: 50 };
    return { name: 'Neutre', icon: '🙂', pts: 120 };
  });
}

function newManche(room) {
  const g = room.ctx.pr;
  if (g.manche >= g.total) { end(room); return; }
  g.manche++;
  const n = g.seats.length;
  const cards = deck();
  g.hands = g.seats.map(() => []);
  cards.forEach((c, i) => g.hands[i % n].push(c));
  g.exchange = [];
  if (g.lastOrder) {
    // échanges : le Clochard donne ses meilleures cartes, le Président rend ses plus faibles
    const swap = (rich, poor, count) => {
      const best = sortHand(g.hands[poor]).slice(-count);
      g.hands[poor] = g.hands[poor].filter((c) => !best.includes(c)); g.hands[rich].push(...best);
      const worst = sortHand(g.hands[rich]).slice(0, count);
      g.hands[rich] = g.hands[rich].filter((c) => !worst.includes(c)); g.hands[poor].push(...worst);
      g.exchange.push({ rich: g.seats[rich], poor: g.seats[poor], count });
    };
    const o = g.lastOrder.map((id) => g.seats.indexOf(id)).filter((s) => s >= 0);
    if (o.length >= 2) swap(o[0], o[o.length - 1], 2);
    if (o.length >= 4) swap(o[1], o[o.length - 2], 1);
  }
  g.hands = g.hands.map(sortHand);
  g.finished = [];
  g.pile = null; g.passed = new Set(); g.lastPlayer = null;
  const threeClubs = g.hands.findIndex((hd) => hd.some((c) => c.r === '3' && c.s === 'C'));
  g.turn = g.lastOrder ? g.seats.indexOf(g.lastOrder[g.lastOrder.length - 1]) : threeClubs;
  if (g.turn < 0) g.turn = 0;
  room.say(g.lastOrder ? animator.prExchange(room.players.get(g.lastOrder[0])?.name || '?', room.players.get(g.lastOrder[g.lastOrder.length - 1])?.name || '?') : animator.prStart(room.players.get(g.seats[g.turn])?.name || '?'));
  prompt(room);
}

const active = (g, s) => g.hands[s].length > 0 && !g.finished.includes(g.seats[s]);

function prompt(room) {
  const g = room.ctx.pr;
  g.seq++;
  room.enter('prPlay', { clearing: false });
  const pid = g.seats[g.turn];
  room.setTimer(room.players.get(pid)?.connected ? TURN_MS : AUTO_MS, () => {
    if (!g.pile) play(room, g.turn, [sortHand(g.hands[g.turn])[0].id]); // l'ouvreur pose sa plus petite carte
    else pass(room, g.turn);
  }, true);
  room.sync();
}

/** Combinaison valide ? Même valeur, 1 à 4 cartes, et plus forte que la pile (même nombre de cartes). */
function validPlay(g, cards) {
  if (!cards.length || cards.length > 4 || cards.some((c) => c.r !== cards[0].r)) return false;
  if (!g.pile) return true;
  return cards.length === g.pile.cards.length && val(cards[0]) > val(g.pile.cards[0]);
}

function play(room, seat, ids) {
  const g = room.ctx.pr;
  const cards = ids.map((id) => g.hands[seat].find((c) => c.id === id)).filter(Boolean);
  if (cards.length !== ids.length || new Set(ids).size !== ids.length || !validPlay(g, cards)) return false;
  room.clearTimer();
  g.hands[seat] = g.hands[seat].filter((c) => !ids.includes(c.id));
  g.pile = { seat, cards };
  g.lastPlayer = seat;
  const name = room.players.get(g.seats[seat])?.name || '?';
  if (!g.hands[seat].length) { g.finished.push(g.seats[seat]); room.say(g.finished.length === 1 ? animator.prPresident(name) : `${name} n’a plus de cartes !`); }
  else if (cards[0].r === '2') room.say(animator.prTwo(name));
  afterMove(room, cards[0].r === '2');
  return true;
}

function pass(room, seat) {
  const g = room.ctx.pr;
  if (!g.pile) return false; // l'ouvreur doit jouer
  room.clearTimer();
  g.passed.add(seat);
  afterMove(room, false);
  return true;
}

function afterMove(room, closed) {
  const g = room.ctx.pr;
  const n = g.seats.length;
  const stillIn = g.seats.map((_, s) => s).filter((s) => active(g, s));
  if (stillIn.length <= 1) {
    if (stillIn.length === 1) g.finished.push(g.seats[stillIn[0]]);
    results(room);
    return;
  }
  const next = nextSeat(n, g.turn, (s) => active(g, s) && !g.passed.has(s) && s !== g.lastPlayer);
  if (closed || next === -1) {
    // tout le monde a passé (ou un 2 a fermé le pli) : le dernier à avoir joué rouvre
    g.seq++;
    room.enter('prPlay', { clearing: true });
    room.sync();
    room.setTimer(CLEAR_MS, () => {
      g.pile = null; g.passed = new Set();
      g.turn = active(g, g.lastPlayer) ? g.lastPlayer : nextSeat(n, g.lastPlayer, (s) => active(g, s));
      prompt(room);
    });
    return;
  }
  g.turn = next;
  prompt(room);
}

function results(room) {
  room.clearTimer();
  const g = room.ctx.pr;
  const t = titles(g.finished.length);
  const rows = g.finished.map((id, i) => ({ id, title: t[i].name, icon: t[i].icon, pts: t[i].pts }));
  rows.forEach((r) => { room.addScore(r.id, r.pts); g.totals[r.id] = (g.totals[r.id] || 0) + r.pts; });
  g.lastOrder = [...g.finished];
  g.seq++;
  room.enter('prResult', { rows });
  room.setTimer(RESULT_MS, () => newManche(room));
  room.sync();
}

function end(room) {
  room.clearTimer();
  const g = room.ctx.pr;
  const rows = g.seats.map((id) => ({ id, points: g.totals[id] || 0 })).sort((a, b) => b.points - a.points);
  room.say(`Fin du Président ! ${room.players.get(rows[0]?.id)?.name || '?'} garde la couronne !`);
  room.enter('prEnd', { rows });
  room.setTimer(END_MS, () => room.finishRound());
  room.sync();
}

function tableView(room) {
  const g = room.ctx.pr;
  const order = g.lastOrder || [];
  const t = titles(order.length);
  return {
    manche: g.manche, total: g.total, seq: g.seq, turn: room.phase === 'prPlay' && !room.data.clearing ? g.turn : null,
    pile: g.pile ? { player: room.pub(g.seats[g.pile.seat]), cards: g.pile.cards.map(pub) } : null,
    exchange: g.exchange.map((e) => ({ rich: room.pub(e.rich), poor: room.pub(e.poor), count: e.count })),
    seats: g.seats.map((id, s) => {
      const k = order.indexOf(id);
      return { player: room.pub(id), cards: g.hands[s].length, passed: g.passed.has(s), out: g.finished.includes(id), title: k >= 0 ? t[k] : null };
    }),
  };
}

module.exports = {
  id: 'president',
  title: 'Le Président',
  icon: '👑',
  subtitle: 'Débarrassez-vous de vos cartes le premier pour devenir Président !',
  pitch: 'Le jeu de soirée par excellence : Président, Vice, Neutres… et Clochard ! 3 à 8 joueurs.',
  rules: 'Posez 1 à 4 cartes de même valeur ; les suivants doivent poser autant de cartes, plus fortes, ou passer. Le 2 est la plus forte et ferme le pli. Le premier sans carte est Président, le dernier Clochard… qui devra lui donner ses meilleures cartes !',
  players: '3 à 8 joueurs',
  duration: '10 à 20 min',
  minPlayers: 3,
  phases: ['prPlay', 'prResult', 'prEnd'],
  validPlay: (pile, cards) => validPlay({ pile }, cards),

  introLine: () => animator.prIntro(),
  cannotPlay: (room) => (room.connectedPlayers().length < 3 ? 'Il faut au moins 3 joueurs pour le Président.' : null),

  begin(room) {
    const seats = room.connectedPlayers().slice(0, 8).map((p) => p.id);
    room.ctx.pr = { seats, manche: 0, total: MANCHES[room.settings.length], seq: 0, totals: {}, lastOrder: null, hands: [], finished: [], passed: new Set(), pile: null, exchange: [] };
    newManche(room);
  },

  act(room, p, msg) {
    const g = room.ctx.pr;
    const seat = g.seats.indexOf(p.id);
    if (room.phase !== 'prPlay' || room.data.clearing || seat !== g.turn) return;
    let ok = false;
    if (msg.type === 'play' && Array.isArray(msg.cards)) ok = play(room, seat, msg.cards.map(String).slice(0, 4));
    else if (msg.type === 'pass') ok = pass(room, seat);
    if (!ok) room.sync();
  },

  hostView(room) {
    const d = room.data;
    const base = { pr: tableView(room) };
    if (room.phase === 'prPlay') return { ...base, key: `pr:table:${room.ctx.pr.manche}`, clearing: !!d.clearing };
    if (room.phase === 'prResult') return { ...base, key: `prResult:${room.ctx.pr.manche}`, rows: d.rows.map((r) => ({ ...r, player: room.pub(r.id) })) };
    return { ...base, key: 'prEnd', rows: d.rows.map((r) => ({ ...r, player: room.pub(r.id) })) };
  },

  playerView(room, p) {
    const g = room.ctx.pr;
    const d = room.data;
    const seat = g.seats.indexOf(p.id);
    const base = { pr: { ...tableView(room), seat, hand: seat === -1 ? [] : sortHand(g.hands[seat]).map(pub) } };
    if (room.phase === 'prResult') return { ...base, key: `prResult:${g.manche}`, row: d.rows.find((r) => r.id === p.id) || null };
    if (room.phase === 'prEnd') return { ...base, key: 'prEnd', row: d.rows.find((r) => r.id === p.id) || null };
    const myTurn = !d.clearing && seat === g.turn;
    return { ...base, key: `pr:${g.seq}:${myTurn}`, myTurn, need: g.pile ? g.pile.cards.length : null, canPass: myTurn && !!g.pile, turnPlayer: room.pub(g.seats[g.turn]), out: g.finished.includes(p.id) };
  },
};

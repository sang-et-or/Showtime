// Jeu de plateau « La Roue des Savoirs » : quiz sur un plateau en anneau.
// (Inspiré des quiz à camemberts, avec notre propre plateau, nos règles et nos questions.)
// On lance le dé, on avance, on répond à une question de la couleur de la case.
// Sur une case « Étoile », une bonne réponse rapporte l'étoile de ce thème. Tout le monde peut
// répondre en même temps pour grappiller des points, mais seul le joueur actif avance.
const crypto = require('crypto');
const animator = require('../animator');
const { CATEGORIES, QUESTIONS } = require('../content/questions');
const { shuffle } = require('../util');

const CATS = ['culture', 'musique', 'cinema', 'sport', 'foot'];
const SIZE = 20;
const TARGET = { short: 3, normal: 4, long: 5 };
const CAP_MIN = { short: 8, normal: 12, long: 18 };
const ROLL_MS = 12_000;
const MOVE_MS = 1_500;
const QUESTION_MS = 18_000;
const ANSWER_MS = 5_000;
const END_MS = 8_000;
const PTS_ACTIVE = 200;
const PTS_STAR = 500;
const PTS_OTHERS = 100;

// Case i : thème CATS[i % 5] ; les cases 0, 4, 8, 12, 16 sont des « Étoiles » (une par thème).
const BOARD = Array.from({ length: SIZE }, (_, i) => ({ cat: CATS[i % CATS.length], star: i % 4 === 0 }));

function pickQuestion(room, cat) {
  const used = room.ctx.usedQuestions;
  let pool = QUESTIONS.filter((q) => q.cat === cat && !used.has(q.q));
  if (!pool.length) { QUESTIONS.filter((q) => q.cat === cat).forEach((q) => used.delete(q.q)); pool = QUESTIONS.filter((q) => q.cat === cat); }
  const q = shuffle(pool)[0];
  used.add(q.q);
  const order = shuffle([0, 1, 2, 3]);
  return { cat, text: q.q, choices: order.map((k) => q.a[k]), correct: order.indexOf(0) };
}

function startTurn(room, sameSeat = false) {
  const g = room.ctx.roue;
  if (Date.now() > g.endsAt || g.winner) { end(room); return; }
  if (!sameSeat) {
    let next = -1;
    for (let k = 1; k <= g.seats.length; k++) {
      const s = (g.turn + k) % g.seats.length;
      if (room.players.get(g.seats[s])?.connected) { next = s; break; }
    }
    if (next === -1) { end(room); return; }
    g.turn = next;
  }
  g.seq++;
  room.enter('rouePlay', { stage: 'roll', dice: null });
  room.setTimer(ROLL_MS, () => roll(room), true);
  room.sync();
}

function roll(room) {
  room.clearTimer();
  const g = room.ctx.roue;
  const pid = g.seats[g.turn];
  const dice = 1 + crypto.randomInt(6);
  const from = g.pos[pid];
  g.pos[pid] = from < 0 ? dice - 1 : (from + dice) % SIZE;
  g.seq++;
  room.enter('rouePlay', { stage: 'move', dice, from, to: g.pos[pid] });
  room.setTimer(MOVE_MS, () => ask(room), false);
  room.sync();
}

function ask(room) {
  const g = room.ctx.roue;
  const pid = g.seats[g.turn];
  const sq = BOARD[g.pos[pid]];
  const q = pickQuestion(room, sq.cat);
  g.seq++;
  room.enter('roueQ', { pid, star: sq.star && !g.stars[pid].includes(sq.cat), q, answers: new Map(), startedAt: Date.now() });
  room.say(sq.star ? animator.roueStar(room.players.get(pid)?.name || '?', CATEGORIES[sq.cat].label) : animator.roueAsk(room.players.get(pid)?.name || '?', CATEGORIES[sq.cat].label));
  room.setTimer(QUESTION_MS, () => reveal(room), true);
  room.sync();
}

function reveal(room) {
  room.clearTimer();
  const g = room.ctx.roue;
  const d = room.data;
  const mine = d.answers.get(d.pid);
  const ok = !!mine && mine === d.q.correct + 1;
  const results = [];
  for (const [id, a] of d.answers) {
    const correct = a === d.q.correct + 1;
    let gained = 0;
    if (id === d.pid) gained = correct ? PTS_ACTIVE + (d.star ? PTS_STAR : 0) : 0;
    else if (correct) gained = PTS_OTHERS;
    room.addScore(id, gained);
    results.push({ id, correct, gained });
  }
  let wonStar = false;
  if (ok && d.star) { g.stars[d.pid].push(d.q.cat); wonStar = true; }
  if (g.stars[d.pid].length >= g.target) g.winner = d.pid;
  const name = room.players.get(d.pid)?.name || '?';
  room.say(ok ? (wonStar ? animator.roueStarWon(name) : animator.roueRight(name)) : animator.roueWrong(name));
  g.seq++;
  room.enter('roueA', { ...d, ok, wonStar, results });
  room.setTimer(ANSWER_MS, () => (g.winner ? end(room) : startTurn(room, ok)));
  room.sync();
}

function end(room) {
  room.clearTimer();
  const g = room.ctx.roue;
  if (g.winner) room.addScore(g.winner, 1000);
  const rows = g.seats.map((pid) => ({ id: pid, stars: g.stars[pid], winner: g.winner === pid })).sort((a, b) => b.stars.length - a.stars.length);
  const top = room.players.get(rows[0]?.id);
  room.say(g.winner ? animator.roueWin(room.players.get(g.winner)?.name || '?') : `Temps écoulé ! ${top?.name || '?'} a récolté le plus d'étoiles.`);
  room.enter('roueEnd', { rows });
  room.setTimer(END_MS, () => room.finishRound());
  room.sync();
}

function boardView(room) {
  const g = room.ctx.roue;
  return {
    board: BOARD, cats: CATS, target: g.target, turn: g.turn, seq: g.seq,
    seats: g.seats.map((pid) => ({ player: room.pub(pid), pos: g.pos[pid], stars: g.stars[pid] })),
    endsInMs: Math.max(0, g.endsAt - Date.now()),
  };
}

const qView = (q) => ({ cat: q.cat, text: q.text, choices: q.choices });

module.exports = {
  id: 'roue',
  title: 'La Roue des Savoirs',
  icon: '🎡',
  subtitle: 'Avancez sur la roue, répondez aux questions, récoltez les étoiles de chaque thème !',
  pitch: 'Quiz sur plateau : dé, cases de couleur et étoiles à collectionner.',
  rules: 'Lancez le dé et répondez à la question du thème de votre case. Sur une case Étoile, une bonne réponse rapporte l’étoile du thème. Bonne réponse = vous rejouez. Tout le monde peut répondre pour grappiller des points !',
  players: '2 à 8 joueurs',
  duration: '10 à 15 min',
  minPlayers: 1,
  phases: ['rouePlay', 'roueQ', 'roueA', 'roueEnd'],

  introLine: () => animator.roueIntro(),

  begin(room) {
    const seats = shuffle(room.connectedPlayers().map((p) => p.id)).slice(0, 8);
    room.ctx.roue = {
      seats, pos: Object.fromEntries(seats.map((id) => [id, -1])), stars: Object.fromEntries(seats.map((id) => [id, []])),
      turn: -1, seq: 0, winner: null, target: TARGET[room.settings.length], endsAt: Date.now() + (Number(process.env.SHOWTIME_GAME_CAP_MS) || CAP_MIN[room.settings.length] * 60_000),
    };
    startTurn(room);
  },

  act(room, p, msg) {
    const g = room.ctx.roue;
    const d = room.data;
    if (room.phase === 'rouePlay' && msg.type === 'roll' && d.stage === 'roll' && g.seats[g.turn] === p.id) { roll(room); return; }
    if (room.phase === 'roueQ' && msg.type === 'answer' && !d.answers.has(p.id)) {
      if (!Number.isInteger(msg.choice) || msg.choice < 0 || msg.choice > 3) return;
      d.answers.set(p.id, msg.choice + 1); // +1 pour distinguer « réponse 0 » de « pas de réponse »
      this.check(room);
      room.sync();
    }
  },

  check(room) {
    if (room.phase !== 'roueQ') return;
    const d = room.data;
    const c = room.connectedPlayers();
    if (c.length && c.every((p) => d.answers.has(p.id))) room.setTimer(800, () => reveal(room));
  },

  hostView(room) {
    const d = room.data;
    const base = { roue: boardView(room) };
    switch (room.phase) {
      case 'rouePlay': return { ...base, key: 'roue:board', stage: d.stage, dice: d.dice };
      case 'roueQ': return { ...base, key: `roueQ:${room.ctx.roue.seq}`, active: room.pub(d.pid), star: d.star, q: qView(d.q), answered: [...d.answers.keys()] };
      case 'roueA': return {
        ...base, key: `roueA:${room.ctx.roue.seq}`, active: room.pub(d.pid), star: d.star, q: qView(d.q), correct: d.q.correct, ok: d.ok, wonStar: d.wonStar,
        results: d.results.map((r) => ({ ...r, player: room.pub(r.id) })),
      };
      default: return { ...base, key: 'roueEnd', rows: d.rows.map((r) => ({ ...r, player: room.pub(r.id) })) };
    }
  },

  playerView(room, p) {
    const g = room.ctx.roue;
    const d = room.data;
    const isTurn = g.seats[g.turn] === p.id;
    const base = { roue: { turnPlayer: room.pub(g.seats[g.turn]), isTurn, myStars: g.stars[p.id] || [], target: g.target, cats: CATS } };
    switch (room.phase) {
      case 'rouePlay': return { ...base, key: `roue:${g.seq}:${isTurn}`, stage: d.stage, dice: d.dice };
      case 'roueQ': {
        const a = d.answers.get(p.id);
        return { ...base, key: `roueQ:${g.seq}:${!!a}`, star: d.star, q: qView(d.q), mine: a ? a - 1 : null };
      }
      case 'roueA': return { ...base, key: `roueA:${g.seq}`, ok: d.ok, wonStar: d.wonStar, q: qView(d.q), correct: d.q.correct, myResult: d.results.find((r) => r.id === p.id) || null, activeName: room.players.get(d.pid)?.name };
      default: return { ...base, key: 'roueEnd', row: d.rows.find((r) => r.id === p.id) || null };
    }
  },
};

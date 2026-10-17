// Manche « Le Grand Quiz » : 4 réponses, la rapidité rapporte des points.
const animator = require('../animator');
const { CATEGORIES, QUESTIONS } = require('../content/questions');
const { shuffle } = require('../util');

const QUESTION_MS = 20_000;
const REVEAL_MS = 6_000;
const LEADERBOARD_EVERY = 4;
const COUNT = { short: 5, normal: 8, long: 12 };

/** Pioche n questions des thèmes choisis, sans répéter celles déjà posées pendant la soirée. */
function pickQuestions(room, n) {
  const used = room.ctx.usedQuestions;
  const cats = room.settings.categories;
  let pool = QUESTIONS.filter((q) => cats.includes(q.cat) && !used.has(q.q));
  if (pool.length < n) pool = QUESTIONS.filter((q) => !used.has(q.q));
  if (pool.length < n) { used.clear(); pool = QUESTIONS; }
  pool = shuffle(pool);
  const byCat = new Map();
  for (const q of pool) { if (!byCat.has(q.cat)) byCat.set(q.cat, []); byCat.get(q.cat).push(q); }
  const picked = [];
  while (picked.length < n && [...byCat.values()].some((l) => l.length)) {
    for (const c of shuffle([...byCat.keys()])) {
      const l = byCat.get(c);
      if (l.length && picked.length < n) picked.push(l.pop());
    }
  }
  picked.forEach((q) => used.add(q.q));
  return picked.map((q) => {
    const order = shuffle([0, 1, 2, 3]);
    return { cat: q.cat, text: q.q, choices: order.map((k) => q.a[k]), correct: order.indexOf(0) };
  });
}

function next(room) {
  const qz = room.ctx.quiz;
  qz.i++;
  if (qz.i >= qz.list.length) { room.finishRound(); return; }
  const q = qz.list[qz.i];
  room.enter('quizQuestion', { index: qz.i + 1, total: qz.list.length, ...q, answers: new Map(), startedAt: Date.now() });
  room.say(animator.question(qz.i + 1, qz.list.length, CATEGORIES[q.cat].label));
  room.setTimer(QUESTION_MS, () => reveal(room), true);
  room.sync();
}

function reveal(room) {
  room.clearTimer();
  const d = room.data;
  const results = [];
  for (const p of room.players.values()) {
    const a = d.answers.get(p.id);
    const correct = !!a && a.choice === d.correct;
    let gained = 0;
    if (correct) {
      p.streak++;
      gained = Math.round(1000 - 500 * (Math.min(a.ms, QUESTION_MS) / QUESTION_MS)) + Math.min(p.streak - 1, 3) * 100;
    } else {
      p.streak = 0;
    }
    p.score += gained;
    results.push({ id: p.id, choice: a ? a.choice : null, ms: a ? a.ms : null, correct, gained, streak: p.streak });
  }
  const winners = results.filter((r) => r.correct).sort((a, b) => a.ms - b.ms);
  if (winners.length === 0) room.say(animator.allWrong());
  else if (winners.length === results.length && results.length > 1) room.say(animator.allRight());
  else room.say(animator.fastest(room.players.get(winners[0].id).name));

  const counts = [0, 0, 0, 0];
  for (const a of d.answers.values()) counts[a.choice]++;
  room.enter('quizReveal', { ...d, results, counts });
  const qz = room.ctx.quiz;
  const showBoard = qz.i + 1 < qz.list.length && (qz.i + 1) % LEADERBOARD_EVERY === 0;
  room.setTimer(REVEAL_MS, () => (showBoard ? room.goLeaderboard('Classement provisoire', () => next(room)) : next(room)));
  room.sync();
}

const qView = (d) => ({ index: d.index, total: d.total, cat: d.cat, text: d.text, choices: d.choices });

module.exports = {
  id: 'quiz',
  title: 'Le Grand Quiz',
  icon: '🧠',
  subtitle: 'Bonne réponse = points. Réponse rapide = encore plus de points !',
  pitch: 'Culture, musique, cinéma, sport : 4 réponses, le plus rapide gagne.',
  phases: ['quizQuestion', 'quizReveal'],
  pickQuestions,

  introLine: () => animator.quizIntro(),

  begin(room) {
    room.ctx.quiz = { i: -1, list: pickQuestions(room, COUNT[room.settings.length]) };
    next(room);
  },

  act(room, p, msg) {
    if (room.phase !== 'quizQuestion' || msg.type !== 'answer' || room.data.answers.has(p.id)) return;
    if (!Number.isInteger(msg.choice) || msg.choice < 0 || msg.choice > 3) return;
    room.data.answers.set(p.id, { choice: msg.choice, ms: Date.now() - room.data.startedAt });
    this.check(room);
    room.sync();
  },

  check(room) {
    if (room.phase !== 'quizQuestion') return;
    const c = room.connectedPlayers();
    if (c.length && c.every((p) => room.data.answers.has(p.id))) room.setTimer(800, () => reveal(room));
  },

  hostView(room) {
    const d = room.data;
    if (room.phase === 'quizQuestion') return { key: `quizQuestion:${d.index}`, q: qView(d), answered: [...d.answers.keys()] };
    return { key: `quizReveal:${d.index}`, q: qView(d), correct: d.correct, counts: d.counts, results: d.results };
  },

  playerView(room, p) {
    const d = room.data;
    if (room.phase === 'quizQuestion') {
      const a = d.answers.get(p.id);
      return { key: `quizQuestion:${d.index}:${!!a}`, q: qView(d), myAnswer: a ? a.choice : null };
    }
    return { key: `quizReveal:${d.index}`, q: qView(d), correct: d.correct, myResult: d.results.find((r) => r.id === p.id) || null };
  },
};

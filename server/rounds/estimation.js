// Partie rapide « L'Estimation » : une réponse chiffrée, le plus proche gagne.
const animator = require('../animator');
const QUESTIONS = require('../content/estimation');
const { shuffle } = require('../util');

const ASK_MS = 25_000;
const REVEAL_MS = 7_000;
const COUNT = { short: 5, normal: 7, long: 10 };
const PODIUM = [500, 300, 150];
const EXACT = 1000;

function next(room) {
  const es = room.ctx.est;
  es.i++;
  if (es.i >= es.list.length) { room.finishRound(); return; }
  const q = es.list[es.i];
  room.enter('estAsk', { index: es.i + 1, total: es.list.length, ...q, guesses: new Map() });
  room.say(animator.estAsk(es.i + 1, es.list.length));
  room.setTimer(ASK_MS, () => reveal(room), true);
  room.sync();
}

function reveal(room) {
  room.clearTimer();
  const d = room.data;
  const rows = [...d.guesses.entries()]
    .filter(([pid]) => room.players.has(pid))
    .map(([pid, value]) => ({ id: pid, value, diff: Math.abs(value - d.a) }))
    .sort((x, y) => x.diff - y.diff);
  // Les ex aequo partagent le même rang.
  let rank = 0; let last = null;
  rows.forEach((r, i) => {
    if (r.diff !== last) { rank = i + 1; last = r.diff; }
    r.rank = rank;
    r.gained = r.diff === 0 ? EXACT : (PODIUM[rank - 1] || 0);
    room.addScore(r.id, r.gained);
  });
  if (rows.length && rows[0].diff === 0) room.say(animator.estExact(room.players.get(rows[0].id).name));
  else if (rows.length) room.say(animator.estClosest(room.players.get(rows[0].id).name));
  else room.say('Personne n’a osé répondre ? Allez, on tente sa chance la prochaine fois !');
  room.enter('estReveal', { ...d, rows });
  room.setTimer(REVEAL_MS, () => next(room));
  room.sync();
}

const qView = (d) => ({ index: d.index, total: d.total, text: d.q, unit: d.unit });

module.exports = {
  id: 'estimation',
  title: 'L’Estimation',
  icon: '🎯',
  subtitle: 'Tapez un nombre : le plus proche gagne, la réponse exacte rapporte le jackpot !',
  pitch: 'Années, distances, quantités : tapez un nombre, le plus proche gagne.',
  rules: 'Une question, une réponse chiffrée : année, distance, quantité… Tapez votre estimation, le plus proche gagne, et la réponse exacte rapporte le jackpot !',
  players: '1 à 12 joueurs',
  duration: '5 à 10 min',
  minPlayers: 1,
  phases: ['estAsk', 'estReveal'],

  introLine: () => animator.estIntro(),

  begin(room) {
    room.ctx.est = { i: -1, list: shuffle(QUESTIONS).slice(0, COUNT[room.settings.length]) };
    next(room);
  },

  act(room, p, msg) {
    const d = room.data;
    if (room.phase !== 'estAsk' || msg.type !== 'guess' || d.guesses.has(p.id)) return;
    const value = Number(String(msg.value ?? '').replace(/[\s  ]/g, '').replace(',', '.'));
    if (!Number.isFinite(value) || Math.abs(value) > 1e12) return;
    d.guesses.set(p.id, value);
    this.check(room);
    room.sync();
  },

  check(room) {
    if (room.phase !== 'estAsk') return;
    const c = room.connectedPlayers();
    if (c.length && c.every((p) => room.data.guesses.has(p.id))) room.setTimer(800, () => reveal(room));
  },

  hostView(room) {
    const d = room.data;
    if (room.phase === 'estAsk') return { key: `estAsk:${d.index}`, est: qView(d), answered: [...d.guesses.keys()] };
    return { key: `estReveal:${d.index}`, est: { ...qView(d), answer: d.a }, rows: d.rows.map((r) => ({ ...r, player: room.pub(r.id) })) };
  },

  playerView(room, p) {
    const d = room.data;
    if (room.phase === 'estAsk') {
      const mine = d.guesses.has(p.id) ? d.guesses.get(p.id) : null;
      return { key: `estAsk:${d.index}:${mine !== null}`, est: qView(d), mine };
    }
    return { key: `estReveal:${d.index}`, est: { ...qView(d), answer: d.a }, mine: d.rows.find((r) => r.id === p.id) || null, count: d.rows.length };
  },
};

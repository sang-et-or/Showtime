// Manche « Grand Duel » : deux joueurs face à face (premier à 3 points),
// le public mise des points virtuels sur le vainqueur. Aucun argent réel.
const animator = require('../animator');
const { pickQuestions } = require('./quiz');

const BET_MS = 15_000;
const QUESTION_MS = 15_000;
const POINT_MS = 3_500;
const END_MS = 7_000;
const TARGET = 3;
const MAX_QUESTIONS = 7;
const STAKES = [100, 300, 500];
const DUELS = { short: 1, normal: 2, long: 3 };
const WIN_POINTS = 600;

const spectators = (room) => room.connectedPlayers().filter((p) => p.id !== room.data.a && p.id !== room.data.b);

function nextDuel(room) {
  const du = room.ctx.duel;
  du.k++;
  if (du.k >= du.pairs.length) { room.finishRound(); return; }
  const [a, b] = du.pairs[du.k];
  room.enter('duelBet', { index: du.k + 1, total: du.pairs.length, a, b, scoreA: 0, scoreB: 0, qi: -1, qs: pickQuestions(room, MAX_QUESTIONS), bets: new Map() });
  room.say(animator.duelBet(room.players.get(a).name, room.players.get(b).name));
  room.setTimer(spectators(room).length ? BET_MS : 4_000, () => nextQuestion(room), true);
  room.sync();
}

function nextQuestion(room) {
  const d = room.data;
  d.qi++;
  room.enter('duelQ', { ...d, answers: new Map(), startedAt: Date.now() });
  room.setTimer(QUESTION_MS, () => point(room, null), true);
  room.sync();
}

function point(room, scorerId) {
  room.clearTimer();
  const d = room.data;
  if (scorerId === d.a) d.scoreA++;
  if (scorerId === d.b) d.scoreB++;
  room.say(scorerId ? animator.duelPoint(room.players.get(scorerId)?.name || '?') : animator.duelNoPoint());
  room.enter('duelPoint', { ...d, scorerId });
  const over = d.scoreA >= TARGET || d.scoreB >= TARGET || d.qi + 1 >= MAX_QUESTIONS;
  room.setTimer(POINT_MS, () => (over ? end(room) : nextQuestion(room)));
  room.sync();
}

function end(room) {
  const d = room.data;
  const winnerId = d.scoreA > d.scoreB ? d.a : d.scoreB > d.scoreA ? d.b : null;
  const betResults = [];
  if (winnerId) {
    room.addScore(winnerId, WIN_POINTS);
    for (const [pid, bet] of d.bets) {
      const gain = bet.target === winnerId ? bet.stake : -bet.stake;
      room.addScore(pid, gain);
      betResults.push({ id: pid, target: bet.target, stake: bet.stake, gain });
    }
    room.say(animator.duelWin(room.players.get(winnerId)?.name || '?'));
    const loserId = winnerId === d.a ? d.b : d.a;
    room.highlight('duel', d.bets.size, { emoji: '⚔️', title: 'Le Grand Duel', body: `${room.players.get(winnerId)?.name} bat ${room.players.get(loserId)?.name} ${Math.max(d.scoreA, d.scoreB)} à ${Math.min(d.scoreA, d.scoreB)} !`, players: [winnerId, loserId] });
  } else {
    for (const [pid, bet] of d.bets) betResults.push({ id: pid, target: bet.target, stake: bet.stake, gain: 0 });
    room.say(animator.duelDraw());
  }
  room.enter('duelEnd', { ...d, winnerId, betResults });
  room.setTimer(END_MS, () => nextDuel(room));
  room.sync();
}

function duelView(room, d) {
  return { index: d.index, total: d.total, a: room.pub(d.a), b: room.pub(d.b), scoreA: d.scoreA, scoreB: d.scoreB, target: TARGET };
}
const qView = (d) => {
  const q = d.qs[d.qi];
  return q ? { n: d.qi + 1, text: q.text, choices: q.choices } : null;
};
function betSummary(d) {
  const s = { a: { count: 0, total: 0 }, b: { count: 0, total: 0 } };
  for (const bet of d.bets.values()) { const side = bet.target === d.a ? s.a : s.b; side.count++; side.total += bet.stake; }
  return s;
}

module.exports = {
  id: 'duel',
  title: 'Le Grand Duel',
  icon: '⚔️',
  subtitle: 'Face-à-face éclair, premier à 3 points. Le public mise sur son champion !',
  pitch: 'Un contre un sur des questions éclair, le public mise des points virtuels.',
  minPlayers: 2,
  phases: ['duelBet', 'duelQ', 'duelPoint', 'duelEnd'],
  STAKES,

  introLine: () => animator.duelIntro(),

  cannotPlay(room) {
    return room.connectedPlayers().length < 2 ? 'Il faut au moins 2 joueurs pour un duel.' : null;
  },

  begin(room) {
    // Les duels opposent les joueurs voisins au classement : 1er contre 2e, 3e contre 4e…
    const order = room.ranking().filter((r) => room.players.get(r.id).connected).map((r) => r.id);
    const n = Math.min(Math.floor(order.length / 2), DUELS[room.settings.length]);
    const pairs = [];
    for (let i = 0; i < n; i++) pairs.push([order[2 * i], order[2 * i + 1]]);
    room.ctx.duel = { k: -1, pairs };
    nextDuel(room);
  },

  act(room, p, msg) {
    const d = room.data;
    const isDuelist = p.id === d.a || p.id === d.b;
    if (room.phase === 'duelBet' && msg.type === 'bet' && !isDuelist && !d.bets.has(p.id)) {
      const stake = Number(msg.stake);
      if (!STAKES.includes(stake) || ![d.a, d.b].includes(msg.target)) return;
      if (stake > Math.max(p.score, STAKES[0])) return;
      d.bets.set(p.id, { target: msg.target, stake });
      this.check(room);
      room.sync();
      return;
    }
    if (room.phase === 'duelQ' && msg.type === 'answer' && isDuelist && !d.answers.has(p.id)) {
      if (!Number.isInteger(msg.choice) || msg.choice < 0 || msg.choice > 3) return;
      const correct = msg.choice === d.qs[d.qi].correct;
      d.answers.set(p.id, { choice: msg.choice, correct });
      if (correct) { point(room, p.id); return; }
      this.check(room);
      room.sync();
    }
  },

  check(room) {
    const d = room.data;
    if (room.phase === 'duelBet') {
      const s = spectators(room);
      if (s.length && s.every((p) => d.bets.has(p.id))) room.setTimer(1_000, () => nextQuestion(room), true);
    } else if (room.phase === 'duelQ') {
      const live = [d.a, d.b].filter((id) => room.players.get(id)?.connected);
      if (live.every((id) => d.answers.has(id))) point(room, null);
    }
  },

  hostView(room) {
    const d = room.data;
    const base = { duel: duelView(room, d) };
    switch (room.phase) {
      case 'duelBet': return { ...base, key: `duelBet:${d.index}`, bets: betSummary(d), betted: [...d.bets.keys()], spectators: spectators(room).map((p) => p.id) };
      case 'duelQ': return { ...base, key: `duelQ:${d.index}:${d.qi}`, q: qView(d), wrong: [...d.answers.keys()] };
      case 'duelPoint': return { ...base, key: `duelPoint:${d.index}:${d.qi}`, q: qView(d), correct: d.qs[d.qi].correct, scorerId: d.scorerId, answers: Object.fromEntries(d.answers) };
      default: return { ...base, key: `duelEnd:${d.index}`, winnerId: d.winnerId, betResults: d.betResults, bets: betSummary(d) };
    }
  },

  playerView(room, p) {
    const d = room.data;
    const role = p.id === d.a ? 'a' : p.id === d.b ? 'b' : 'spectator';
    const base = { duel: duelView(room, d), role };
    switch (room.phase) {
      case 'duelBet': {
        const myBet = d.bets.get(p.id) || null;
        return { ...base, key: `duelBet:${d.index}:${!!myBet}`, myBet, stakes: STAKES.filter((s) => s <= Math.max(p.score, STAKES[0])) };
      }
      case 'duelQ': {
        const mine = d.answers.get(p.id) || null;
        return { ...base, key: `duelQ:${d.index}:${d.qi}:${!!mine}`, q: qView(d), mine, myBet: d.bets.get(p.id) || null };
      }
      case 'duelPoint': return { ...base, key: `duelPoint:${d.index}:${d.qi}`, q: qView(d), correct: d.qs[d.qi].correct, scorerId: d.scorerId };
      default: return { ...base, key: `duelEnd:${d.index}`, winnerId: d.winnerId, myBet: d.betResults.find((r) => r.id === p.id) || null };
    }
  },
};

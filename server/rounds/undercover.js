// Partie rapide « L'Imposteur » : tout le monde a le même mot secret, sauf l'imposteur.
// Tour d'indices à voix haute, puis vote pour éliminer un suspect.
const animator = require('../animator');
const PAIRS = require('../content/undercover');
const { shuffle } = require('../util');

const CLUES_MS = 120_000;
const VOTE_MS = 30_000;
const REVEAL_MS = 6_000;
const END_MS = 9_000;
const MAX_VOTES = 6;
const GAMES = { short: 1, normal: 2, long: 3 };
const WIN_CIVIL = 500;
const WIN_IMPOSTOR = 1200;

function newGame(room) {
  const un = room.ctx.und;
  un.g++;
  if (un.g > un.total || room.connectedPlayers().length < 3) { room.finishRound(); return; }
  const players = shuffle(room.connectedPlayers().map((p) => p.id));
  const [civil, impostor] = shuffle(PAIRS.filter((pair) => !un.usedPairs.includes(pair[0])))[0] || PAIRS[0];
  un.usedPairs.push(civil);
  const nbImp = players.length >= 7 ? 2 : 1;
  const roles = new Map(players.map((id, i) => [id, i < nbImp ? 'impostor' : 'civil']));
  un.game = { civil, impostor, roles, alive: new Set(players), round: 0, order: shuffle(players), lastOut: null };
  clues(room);
}

function clues(room) {
  const game = room.ctx.und.game;
  game.round++;
  const order = game.order.filter((id) => game.alive.has(id));
  room.enter('undClues', { g: room.ctx.und.g, total: room.ctx.und.total, round: game.round, order });
  room.say(animator.undClues(room.players.get(order[0])?.name || 'le premier joueur'));
  room.setTimer(CLUES_MS, () => vote(room), true);
  room.sync();
}

const voters = (room) => [...room.ctx.und.game.alive].filter((id) => room.players.get(id)?.connected);

function vote(room) {
  room.enter('undVote', { ...room.data, votes: new Map() });
  room.say(animator.undVote());
  room.setTimer(VOTE_MS, () => reveal(room), true);
  room.sync();
}

function reveal(room) {
  room.clearTimer();
  const d = room.data;
  const game = room.ctx.und.game;
  const tally = new Map();
  for (const target of d.votes.values()) tally.set(target, (tally.get(target) || 0) + 1);
  const max = Math.max(0, ...tally.values());
  const top = [...tally.entries()].filter(([, n]) => n === max).map(([id]) => id);
  let outId = null;
  if (max > 0 && top.length === 1) {
    outId = top[0];
    game.alive.delete(outId);
    room.say(animator.undOut(room.players.get(outId)?.name || '?', game.roles.get(outId) === 'impostor'));
  } else {
    room.say(animator.undTie());
  }
  game.lastOut = outId;
  const alive = [...game.alive];
  const impAlive = alive.filter((id) => game.roles.get(id) === 'impostor').length;
  const civAlive = alive.length - impAlive;
  const winner = impAlive === 0 ? 'civil' : (impAlive >= civAlive || game.round >= MAX_VOTES) ? 'impostor' : null;
  room.enter('undReveal', { ...d, outId, outRole: outId ? game.roles.get(outId) : null, tally: Object.fromEntries(tally), winner });
  room.setTimer(REVEAL_MS, () => (winner ? end(room, winner) : clues(room)));
  room.sync();
}

function end(room, winner) {
  const game = room.ctx.und.game;
  const winners = [...game.roles.entries()].filter(([, r]) => r === winner).map(([id]) => id);
  for (const id of winners) room.addScore(id, winner === 'civil' ? WIN_CIVIL : WIN_IMPOSTOR);
  if (winner === 'civil') room.say(animator.undWinCivils());
  else room.say(animator.undWinImpostor(winners.map((id) => room.players.get(id)?.name || '?').join(' et ')));
  room.enter('undEnd', { g: room.ctx.und.g, total: room.ctx.und.total, winner, winners });
  room.setTimer(END_MS, () => newGame(room));
  room.sync();
}

module.exports = {
  id: 'undercover',
  title: 'L’Imposteur',
  icon: '🕵️',
  subtitle: 'Tout le monde a le même mot secret… sauf un. Démasquez l’imposteur !',
  pitch: 'Un mot secret pour tous, sauf l’imposteur. Indices à voix haute et vote.',
  minPlayers: 3,
  phases: ['undClues', 'undVote', 'undReveal', 'undEnd'],

  introLine: () => animator.undIntro(),

  cannotPlay(room) {
    return room.connectedPlayers().length < 3 ? 'Il faut au moins 3 joueurs pour démasquer un imposteur.' : null;
  },

  begin(room) {
    room.ctx.und = { g: 0, total: GAMES[room.settings.length], usedPairs: [] };
    newGame(room);
  },

  act(room, p, msg) {
    const d = room.data;
    const game = room.ctx.und.game;
    if (room.phase !== 'undVote' || msg.type !== 'vote' || !game.alive.has(p.id) || d.votes.has(p.id)) return;
    const target = String(msg.target || '');
    if (target === p.id || !game.alive.has(target)) return;
    d.votes.set(p.id, target);
    this.check(room);
    room.sync();
  },

  check(room) {
    if (room.phase !== 'undVote') return;
    const v = voters(room);
    if (v.length && v.every((id) => room.data.votes.has(id))) room.setTimer(800, () => reveal(room));
  },

  hostView(room) {
    const d = room.data;
    const game = room.ctx.und.game;
    const base = { und: { g: d.g, total: d.total, alive: [...game.alive], order: game.order.filter((id) => game.alive.has(id)), round: game.round } };
    switch (room.phase) {
      case 'undClues': return { ...base, key: `undClues:${d.g}:${d.round}` };
      case 'undVote': return { ...base, key: `undVote:${d.g}:${d.round}`, voted: [...d.votes.keys()], voters: voters(room) };
      case 'undReveal': return { ...base, key: `undReveal:${d.g}:${d.round}`, outId: d.outId, outRole: d.outRole, tally: d.tally, winner: d.winner };
      default: return {
        ...base, key: `undEnd:${d.g}`, winner: d.winner, winners: d.winners, words: { civil: game.civil, impostor: game.impostor },
        impostors: [...game.roles.entries()].filter(([, r]) => r === 'impostor').map(([id]) => id),
      };
    }
  },

  playerView(room, p) {
    const d = room.data;
    const game = room.ctx.und.game;
    const role = game.roles.get(p.id);
    // L'imposteur ne sait pas qu'il est l'imposteur : il voit simplement un autre mot.
    const word = role === 'impostor' ? game.impostor : role === 'civil' ? game.civil : null;
    const base = { und: { g: d.g, total: d.total, round: game.round }, word, alive: game.alive.has(p.id), inGame: !!role };
    const order = game.order.filter((id) => game.alive.has(id));
    switch (room.phase) {
      case 'undClues': return { ...base, key: `undClues:${d.g}:${d.round}`, order: order.map((id) => room.pub(id)), myTurn: order.indexOf(p.id) + 1 };
      case 'undVote': {
        const myVote = d.votes.get(p.id) || null;
        return { ...base, key: `undVote:${d.g}:${d.round}:${!!myVote}`, myVote, candidates: order.filter((id) => id !== p.id).map((id) => room.pub(id)) };
      }
      case 'undReveal': return { ...base, key: `undReveal:${d.g}:${d.round}`, out: d.outId ? room.pub(d.outId) : null, outRole: d.outRole, itsMe: d.outId === p.id };
      default: return {
        ...base, key: `undEnd:${d.g}`, winner: d.winner, iWon: d.winners.includes(p.id), role,
        words: { civil: game.civil, impostor: game.impostor },
        gain: d.winners.includes(p.id) ? (d.winner === 'civil' ? WIN_CIVIL : WIN_IMPOSTOR) : 0,
      };
    }
  },
};

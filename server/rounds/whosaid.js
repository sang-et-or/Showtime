// Manche « Qui a osé dire ça ? » : on devine l'auteur de chaque réponse secrète.
const animator = require('../animator');
const { shuffle } = require('../util');

const VOTE_MS = 25_000;
const REVEAL_MS = 7_000;
const MAX_ITEMS = 8;

function buildItems(room) {
  const items = [];
  const writings = room.ctx.writings || new Map();
  for (const [pid, answers] of writings) {
    if (!room.players.has(pid)) continue;
    const prompts = room.ctx.assign.get(pid) || [];
    answers.forEach((text, k) => { if (text && prompts[k]) items.push({ prompt: prompts[k], text, authorId: pid }); });
  }
  // On évite que le même auteur passe deux fois de suite.
  let list = shuffle(items).slice(0, MAX_ITEMS);
  for (let tries = 0; tries < 20; tries++) {
    if (list.every((it, k) => k === 0 || it.authorId !== list[k - 1].authorId)) break;
    list = shuffle(list);
  }
  return list;
}

const voters = (room) => room.connectedPlayers().filter((p) => p.id !== room.data.authorId);

function next(room) {
  const w = room.ctx.who;
  w.i++;
  if (w.i >= w.items.length) { room.finishRound(); return; }
  room.enter('whoVote', { index: w.i + 1, total: w.items.length, ...w.items[w.i], votes: new Map() });
  room.say(animator.whoSaidItem());
  room.setTimer(voters(room).length ? VOTE_MS : 4_000, () => reveal(room), true);
  room.sync();
}

function reveal(room) {
  room.clearTimer();
  const d = room.data;
  const author = room.players.get(d.authorId);
  const results = [];
  let found = 0; let fooled = 0;
  for (const [voter, target] of d.votes) {
    if (!room.players.has(voter)) continue;
    const correct = target === d.authorId;
    if (correct) found++; else fooled++;
    room.addScore(voter, correct ? 500 : 0);
    results.push({ id: voter, target, correct, gained: correct ? 500 : 0 });
  }
  const authorGain = fooled * 200;
  room.addScore(d.authorId, authorGain);
  room.say(animator.whoSaidReveal(author ? author.name : 'un mystère', found, fooled));
  if (author && fooled > 0) room.highlight('bluff', fooled, { emoji: '🤫', title: 'Le bluff de la soirée', body: `« ${d.text} » (${d.prompt.replace(/ :$/, '')}) : ${author.name} a berné ${fooled} joueur${fooled > 1 ? 's' : ''} !`, players: [d.authorId] });
  room.enter('whoReveal', { ...d, results, authorGain, found, fooled });
  room.setTimer(REVEAL_MS, () => next(room));
  room.sync();
}

const whoView = (d) => ({ index: d.index, total: d.total, prompt: d.prompt, text: d.text });

module.exports = {
  id: 'whosaid',
  title: 'Qui a osé dire ça ?',
  icon: '🤫',
  subtitle: 'Devinez qui a écrit chaque réponse. Bluffez pour ne pas être démasqué !',
  pitch: 'Chacun écrit des réponses drôles en secret… à vous de deviner qui a osé.',
  minPlayers: 2,
  phases: ['whoVote', 'whoReveal'],
  introExtraMs: 2_000,

  introLine: () => animator.whoSaidIntro(),

  cannotPlay(room) {
    room.ctx.whoItems = buildItems(room);
    if (room.players.size < 2) return 'Il faut au moins 2 joueurs pour cette manche.';
    if (!room.ctx.whoItems.length) return 'Pas assez de réponses secrètes pour cette manche.';
    return null;
  },

  begin(room) {
    room.ctx.who = { i: -1, items: room.ctx.whoItems };
    next(room);
  },

  act(room, p, msg) {
    const d = room.data;
    if (room.phase !== 'whoVote' || msg.type !== 'vote') return;
    if (p.id === d.authorId || d.votes.has(p.id)) return;
    const target = String(msg.target || '');
    if (target === p.id || !room.players.has(target)) return;
    d.votes.set(p.id, target);
    this.check(room);
    room.sync();
  },

  check(room) {
    if (room.phase !== 'whoVote') return;
    const v = voters(room);
    if (v.length && v.every((p) => room.data.votes.has(p.id))) room.setTimer(800, () => reveal(room));
  },

  hostView(room) {
    const d = room.data;
    if (room.phase === 'whoVote') {
      return { key: `whoVote:${d.index}`, who: whoView(d), voted: [...d.votes.keys()], voters: voters(room).map((p) => p.id) };
    }
    return { key: `whoReveal:${d.index}`, who: whoView(d), authorId: d.authorId, results: d.results, authorGain: d.authorGain, found: d.found, fooled: d.fooled };
  },

  playerView(room, p) {
    const d = room.data;
    if (room.phase === 'whoVote') {
      const myVote = d.votes.get(p.id) || null;
      return {
        key: `whoVote:${d.index}:${!!myVote}`, who: whoView(d), isAuthor: d.authorId === p.id, myVote,
        candidates: [...room.players.values()].filter((x) => x.id !== p.id).map((x) => room.publicPlayer(x)),
      };
    }
    return {
      key: `whoReveal:${d.index}`, who: whoView(d), isAuthor: d.authorId === p.id,
      author: room.pub(d.authorId), authorGain: d.authorGain, myResult: d.results.find((r) => r.id === p.id) || null,
    };
  },
};

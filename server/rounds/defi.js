// Manche « Défi Surprise » : chacun son tour, un mime secret à faire deviner
// ou une petite performance notée par le public.
const animator = require('../animator');
const { MIMES, DEFIS } = require('../content/defis');
const { shuffle } = require('../util');

const GET_MS = 20_000;
const MIME_MS = 45_000;
const DEFI_MS = 40_000;
const VOTE_MS = 15_000;
const REVEAL_MS = 6_000;
const TURNS = { short: 3, normal: 5, long: 8 };

function buildTurns(room) {
  const people = shuffle(room.connectedPlayers().map((p) => p.id));
  const n = Math.min(TURNS[room.settings.length], people.length * 2);
  const mimes = shuffle(MIMES); const defis = shuffle(DEFIS);
  const turns = [];
  for (let i = 0; i < n; i++) {
    const kind = i % 2 === 0 ? 'mime' : 'defi';
    turns.push({ pid: people[i % people.length], kind, item: kind === 'mime' ? mimes[i % mimes.length] : defis[i % defis.length] });
  }
  return turns;
}

function next(room) {
  const df = room.ctx.defi;
  df.i++;
  // On saute les joueurs partis entre-temps.
  while (df.i < df.turns.length && !room.players.get(df.turns[df.i].pid)?.connected) df.i++;
  if (df.i >= df.turns.length) { room.finishRound(); return; }
  const t = df.turns[df.i];
  room.enter('defiGet', { index: df.i + 1, total: df.turns.length, ...t });
  room.say(animator.defiTurn(room.players.get(t.pid).name));
  room.setTimer(GET_MS, () => act(room), true);
  room.sync();
}

function act(room) {
  const d = room.data;
  const name = room.players.get(d.pid)?.name || 'notre star';
  room.enter('defiAct', { ...d, startedAt: Date.now() });
  if (d.kind === 'mime') {
    room.say(animator.mimeGo(name));
    room.setTimer(MIME_MS, () => reveal(room, null), true);
  } else {
    room.say(animator.defiGo(name));
    room.setTimer(DEFI_MS, () => vote(room), true);
  }
  room.sync();
}

function vote(room) {
  const d = room.data;
  room.enter('defiVote', { ...d, stars: new Map() });
  room.say(animator.defiVote(room.players.get(d.pid)?.name || 'notre star'));
  room.setTimer(judges(room).length ? VOTE_MS : 2_000, () => reveal(room, null), true);
  room.sync();
}

const judges = (room) => room.connectedPlayers().filter((p) => p.id !== room.data.pid);

function reveal(room, finderId) {
  room.clearTimer();
  const d = room.data;
  const perf = room.players.get(d.pid);
  const res = { finderId, perfGain: 0, finderGain: 0, avg: null, votes: 0 };
  if (d.kind === 'mime') {
    if (finderId) {
      res.perfGain = 400; res.finderGain = 400;
      room.addScore(d.pid, 400); room.addScore(finderId, 400);
      room.say(animator.mimeFound(perf?.name || '?', room.players.get(finderId)?.name || '?'));
    } else {
      room.say(animator.mimeFail(perf?.name || '?'));
    }
  } else {
    const stars = d.stars ? [...d.stars.values()] : [];
    res.votes = stars.length;
    res.avg = stars.length ? Math.round((stars.reduce((a, b) => a + b, 0) / stars.length) * 10) / 10 : 0;
    res.perfGain = Math.round(res.avg * 150);
    room.addScore(d.pid, res.perfGain);
    if (stars.length) room.highlight('perf', res.avg, { emoji: '🎤', title: 'La performance de la soirée', body: `${perf?.name} : « ${d.item} » → ${String(res.avg).replace('.', ',')} / 5`, players: [d.pid] });
    room.say(stars.length ? animator.defiScore(perf?.name || '?', String(res.avg).replace('.', ',')) : 'Personne n’a voté… Le public s’est endormi ?');
  }
  room.enter('defiReveal', { ...d, ...res });
  room.setTimer(REVEAL_MS, () => next(room));
  room.sync();
}

function turnView(room, d) {
  return { index: d.index, total: d.total, kind: d.kind, performer: room.pub(d.pid) };
}

module.exports = {
  id: 'defi',
  title: 'Défi Surprise',
  icon: '🎭',
  subtitle: 'Mimes et défis chronométrés : le public est votre juge !',
  pitch: 'Mimes à faire deviner et défis rigolos notés par le public.',
  minPlayers: 2,
  phases: ['defiGet', 'defiAct', 'defiVote', 'defiReveal'],

  introLine: () => animator.defiIntro(),

  cannotPlay(room) {
    return room.connectedPlayers().length < 2 ? 'Il faut au moins 2 joueurs pour les défis.' : null;
  },

  begin(room) {
    room.ctx.defi = { i: -1, turns: buildTurns(room) };
    next(room);
  },

  act(room, p, msg) {
    const d = room.data;
    if (room.phase === 'defiGet' && msg.type === 'ready' && p.id === d.pid) { room.clearTimer(); act(room); return; }
    if (room.phase === 'defiAct' && p.id === d.pid) {
      if (d.kind === 'mime' && msg.type === 'found') {
        const target = msg.target ? String(msg.target) : null;
        if (target && (target === p.id || !room.players.has(target))) return;
        reveal(room, target);
      } else if (d.kind === 'defi' && msg.type === 'done') {
        vote(room);
      }
      return;
    }
    if (room.phase === 'defiVote' && msg.type === 'stars' && p.id !== d.pid && !d.stars.has(p.id)) {
      if (!Number.isInteger(msg.n) || msg.n < 1 || msg.n > 5) return;
      d.stars.set(p.id, msg.n);
      this.check(room);
      room.sync();
    }
  },

  check(room) {
    if (room.phase !== 'defiVote') return;
    const j = judges(room);
    if (j.length && j.every((p) => room.data.stars.has(p.id))) room.setTimer(800, () => reveal(room, null));
  },

  hostView(room) {
    const d = room.data;
    const base = { key: `${room.phase}:${d.index}`, turn: turnView(room, d) };
    switch (room.phase) {
      case 'defiGet': return base;
      case 'defiAct': return { ...base, cat: d.kind === 'mime' ? d.item.cat : null, text: d.kind === 'defi' ? d.item : null };
      case 'defiVote': return { ...base, text: d.item, voted: [...d.stars.keys()], judges: judges(room).map((p) => p.id) };
      default: return {
        ...base, word: d.kind === 'mime' ? d.item.w : null, cat: d.kind === 'mime' ? d.item.cat : null, text: d.kind === 'defi' ? d.item : null,
        finder: d.finderId ? room.pub(d.finderId) : null, perfGain: d.perfGain, finderGain: d.finderGain, avg: d.avg, votes: d.votes,
      };
    }
  },

  playerView(room, p) {
    const d = room.data;
    const me = p.id === d.pid;
    const base = { key: `${room.phase}:${d.index}`, turn: turnView(room, d), isPerformer: me };
    switch (room.phase) {
      case 'defiGet': return { ...base, secret: me ? d.item : null };
      case 'defiAct': return {
        ...base, secret: me ? d.item : null, text: d.kind === 'defi' ? d.item : null, cat: d.kind === 'mime' ? d.item.cat : null,
        others: me && d.kind === 'mime' ? [...room.players.values()].filter((x) => x.id !== p.id).map((x) => room.publicPlayer(x)) : null,
      };
      case 'defiVote': return { ...base, key: `defiVote:${d.index}:${d.stars.has(p.id)}`, text: d.item, myStars: d.stars.get(p.id) || null };
      default: return {
        ...base, word: d.kind === 'mime' ? d.item.w : null, text: d.kind === 'defi' ? d.item : null,
        finder: d.finderId ? room.pub(d.finderId) : null, perfGain: d.perfGain, finderGain: d.finderGain, avg: d.avg,
        iFound: d.finderId === p.id,
      };
    }
  },
};

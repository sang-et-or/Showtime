// Jeu de cartes « La Bataille royale » : tout le monde retourne sa carte en même temps,
// la plus forte remporte le pli. Égalité au sommet : BATAILLE ! (une carte cachée, une carte visible).
const animator = require('../../animator');
const { deck, pub, rank52 } = require('./cards');

const FLIP_MS = 7_000;
const REVEAL_MS = 3_200;
const STEP_MS = 1_600;
const END_MS = 7_000;
const ROUNDS = { short: 10, normal: 15, long: 25 };

const alive = (g) => g.seats.filter((id) => g.piles[id].length > 0);

function nextRound(room) {
  const g = room.ctx.bat;
  g.round++;
  if (g.round > g.total || alive(g).length <= 1) { end(room); return; }
  g.seq++;
  room.enter('batFlip', { flipped: new Set() });
  room.setTimer(FLIP_MS, () => resolve(room), true);
  room.sync();
}

/** Toutes les cartes sont retournées : on règle le pli, batailles comprises. */
function resolve(room) {
  room.clearTimer();
  const g = room.ctx.bat;
  const pot = [];
  const steps = [];
  let contenders = alive(g);
  for (let guard = 0; guard < 10 && contenders.length > 1; guard++) {
    if (steps.length) contenders.forEach((id) => { const hidden = g.piles[id].shift(); if (hidden) pot.push(hidden); }); // carte cachée
    const shown = {};
    contenders.forEach((id) => { const c = g.piles[id].shift(); if (c) { shown[id] = c; pot.push(c); } });
    const ids = Object.keys(shown);
    if (!ids.length) break;
    const best = Math.max(...ids.map((id) => rank52(shown[id])));
    const top = ids.filter((id) => rank52(shown[id]) === best);
    steps.push({ shown: Object.fromEntries(ids.map((id) => [id, pub(shown[id])])), top });
    contenders = top.filter((id) => g.piles[id].length > 0);
    if (top.length === 1) { contenders = top; break; }
    if (!contenders.length) contenders = [top[0]]; // plus personne n'a de carte : le premier remporte tout
  }
  const winner = contenders[0];
  g.piles[winner].push(...pot);
  const batailles = steps.length - 1;
  if (batailles) room.highlight('bataille', pot.length, { emoji: '⚔️', title: 'La bataille du siècle', body: `${room.players.get(winner)?.name} rafle ${pot.length} cartes après ${batailles > 1 ? `une ${batailles === 2 ? 'double' : 'triple'} bataille` : 'une bataille'} !`, players: [winner] });
  room.say(batailles ? animator.batBataille(room.players.get(winner)?.name || '?', batailles) : animator.batWin(room.players.get(winner)?.name || '?', pot.length));
  g.seq++;
  room.enter('batReveal', { steps, winner, potSize: pot.length });
  room.setTimer(REVEAL_MS + batailles * STEP_MS, () => nextRound(room));
  room.sync();
}

function end(room) {
  room.clearTimer();
  const g = room.ctx.bat;
  const rows = g.seats.map((id) => ({ id, cards: g.piles[id].length, points: g.piles[id].length * 20 })).sort((a, b) => b.cards - a.cards);
  rows.forEach((r) => room.addScore(r.id, r.points));
  room.say(`Fin de la bataille ! ${room.players.get(rows[0]?.id)?.name || '?'} termine avec le plus de cartes !`);
  room.enter('batEnd', { rows });
  room.setTimer(END_MS, () => room.finishRound());
  room.sync();
}

function tableView(room) {
  const g = room.ctx.bat;
  return { round: g.round, total: g.total, seq: g.seq, seats: g.seats.map((id) => ({ player: room.pub(id), cards: g.piles[id].length })) };
}

module.exports = {
  id: 'bataille',
  title: 'La Bataille royale',
  icon: '🃏',
  subtitle: 'Tout le monde retourne sa carte : la plus forte rafle tout. Égalité ? BATAILLE !',
  pitch: 'Le grand classique, mais tous en même temps ! 2 à 12 joueurs.',
  rules: 'Chaque manche, tout le monde retourne la carte du dessus de son paquet. La plus forte remporte toutes les cartes. En cas d’égalité : bataille ! Une carte cachée, une carte visible. À la fin, on compte les cartes.',
  players: '2 à 12 joueurs',
  duration: '5 min',
  minPlayers: 2,
  phases: ['batFlip', 'batReveal', 'batEnd'],

  introLine: () => animator.batIntro(),
  cannotPlay: (room) => (room.connectedPlayers().length < 2 ? 'Il faut au moins 2 joueurs pour une bataille.' : null),

  begin(room) {
    const seats = room.connectedPlayers().map((p) => p.id);
    const cards = deck(undefined, seats.length > 6 ? 2 : 1);
    const per = Math.floor(cards.length / seats.length);
    const piles = Object.fromEntries(seats.map((id, i) => [id, cards.slice(i * per, (i + 1) * per)]));
    room.ctx.bat = { seats, piles, round: 0, total: ROUNDS[room.settings.length], seq: 0 };
    nextRound(room);
  },

  act(room, p, msg) {
    const g = room.ctx.bat;
    if (room.phase !== 'batFlip' || msg.type !== 'flip' || !g.piles[p.id]?.length || room.data.flipped.has(p.id)) return;
    room.data.flipped.add(p.id);
    this.check(room);
    room.sync();
  },

  check(room) {
    if (room.phase !== 'batFlip') return;
    const g = room.ctx.bat;
    const need = alive(g).filter((id) => room.players.get(id)?.connected);
    if (need.every((id) => room.data.flipped.has(id))) room.setTimer(500, () => resolve(room));
  },

  hostView(room) {
    const d = room.data;
    const base = { bat: tableView(room) };
    if (room.phase === 'batFlip') return { ...base, key: `batFlip:${room.ctx.bat.round}`, flipped: [...d.flipped] };
    if (room.phase === 'batReveal') return { ...base, key: `batReveal:${room.ctx.bat.round}`, steps: d.steps, winner: room.pub(d.winner), potSize: d.potSize };
    return { ...base, key: 'batEnd', rows: d.rows.map((r) => ({ ...r, player: room.pub(r.id) })) };
  },

  playerView(room, p) {
    const g = room.ctx.bat;
    const d = room.data;
    const base = { bat: { round: g.round, total: g.total, myCards: g.piles[p.id]?.length || 0, inGame: !!g.piles[p.id] } };
    if (room.phase === 'batFlip') return { ...base, key: `batFlip:${g.round}:${d.flipped.has(p.id)}`, flipped: d.flipped.has(p.id) };
    if (room.phase === 'batReveal') {
      const last = d.steps[d.steps.length - 1];
      return { ...base, key: `batReveal:${g.round}`, myCard: d.steps[0].shown[p.id] || null, won: d.winner === p.id, winner: room.pub(d.winner), potSize: d.potSize, bataille: d.steps.length > 1, inBataille: d.steps.length > 1 && d.steps[0].top.includes(p.id), lastMine: last.shown[p.id] || null };
    }
    return { ...base, key: 'batEnd', row: d.rows.find((r) => r.id === p.id) || null };
  },
};

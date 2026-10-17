// Jeu de plateau « Les Petits Chevaux » (jeu traditionnel, libre de droits).
// 2 à 4 joueurs, chacun sa couleur. Sortie du box avec un 6 ou un 1, un 6 fait rejouer,
// arriver sur la case d'un adversaire le renvoie au box. Le premier à rentrer tous ses chevaux gagne.
const crypto = require('crypto');
const animator = require('../animator');
const { shuffle } = require('../util');

const START = [0, 13, 26, 39]; // case de départ de chaque couleur sur l'anneau de 52 cases
const SAFE = new Set(START); // on ne peut pas être mangé sur une case de départ
const LAST_TRACK = 50; // dernière case de l'anneau avant la ligne d'arrivée
const HOME = 56; // cheval arrivé
const HORSES = { short: 2, normal: 3, long: 4 };
const CAP_MIN = { short: 7, normal: 12, long: 18 };
const ROLL_MS = 12_000;
const CHOOSE_MS = 12_000;
const MOVE_MS = 1_400;
const NOMOVE_MS = 1_900;
const END_MS = 8_000;
const COLORS = ['Rouge', 'Vert', 'Jaune', 'Bleu'];

const ringIndex = (seat, prog) => (START[seat] + prog) % 52;
const die = () => 1 + crypto.randomInt(6);

function optionsFor(g, seat, dice) {
  return g.horses[seat].map((p, h) => ({ h, from: p, to: p === -1 ? 0 : p + dice }))
    .filter((o) => (o.from === -1 ? dice === 6 || dice === 1 : o.from < HOME && o.to <= HOME))
    .map((o) => ({ ...o, captures: capturesAt(g, seat, o.to).length }));
}

function capturesAt(g, seat, to) {
  if (to > LAST_TRACK) return [];
  const idx = ringIndex(seat, to);
  if (SAFE.has(idx)) return [];
  const out = [];
  g.horses.forEach((list, s) => {
    if (s === seat) return;
    list.forEach((p, h) => { if (p >= 0 && p <= LAST_TRACK && ringIndex(s, p) === idx) out.push({ seat: s, h }); });
  });
  return out;
}

/** Choix automatique quand le joueur ne décide pas : manger > rentrer > sortir > avancer le plus avancé. */
function bestOption(opts) {
  const score = (o) => o.captures * 1000 + (o.to === HOME ? 500 : 0) + (o.from === -1 ? 300 : 0) + o.from;
  return [...opts].sort((a, b) => score(b) - score(a))[0];
}

function startTurn(room, sameSeat = false) {
  const g = room.ctx.ludo;
  if (Date.now() > g.endsAt || g.winner != null) { end(room); return; }
  if (!sameSeat) {
    g.sixes = 0;
    let next = -1;
    for (let k = 1; k <= g.seats.length; k++) {
      const s = (g.turn + k) % g.seats.length;
      if (room.players.get(g.seats[s])?.connected) { next = s; break; }
    }
    if (next === -1) { end(room); return; }
    g.turn = next;
  }
  g.seq++;
  room.enter('ludoPlay', { stage: 'roll', dice: null, options: [], lastMove: g.lastMove });
  room.setTimer(ROLL_MS, () => roll(room), true);
  room.sync();
}

function roll(room) {
  room.clearTimer();
  const g = room.ctx.ludo;
  const dice = die();
  const opts = optionsFor(g, g.turn, dice);
  g.seq++;
  if (!opts.length) {
    room.enter('ludoPlay', { stage: 'nomove', dice, options: [], lastMove: g.lastMove });
    room.setTimer(NOMOVE_MS, () => afterMove(room, dice));
    room.sync();
    return;
  }
  if (opts.length === 1) { move(room, dice, opts[0]); return; }
  room.enter('ludoPlay', { stage: 'choose', dice, options: opts, lastMove: g.lastMove });
  room.setTimer(CHOOSE_MS, () => move(room, dice, bestOption(opts)), true);
  room.sync();
}

function move(room, dice, opt) {
  room.clearTimer();
  const g = room.ctx.ludo;
  const caught = capturesAt(g, g.turn, opt.to);
  for (const c of caught) g.horses[c.seat][c.h] = -1;
  g.captures[g.turn] += caught.length;
  g.horses[g.turn][opt.h] = opt.to;
  g.lastMove = { seat: g.turn, h: opt.h, from: opt.from, to: opt.to, caught };
  const name = room.players.get(g.seats[g.turn])?.name || '?';
  if (caught.length) room.say(animator.ludoCapture(name, caught.map((c) => room.players.get(g.seats[c.seat])?.name || '?').join(' et ')));
  else if (opt.to === HOME) room.say(animator.ludoHome(name));
  if (g.horses[g.turn].every((p) => p === HOME)) g.winner = g.turn;
  g.seq++;
  room.enter('ludoPlay', { stage: 'move', dice, options: [], lastMove: g.lastMove });
  room.setTimer(MOVE_MS, () => afterMove(room, dice));
  room.sync();
}

function afterMove(room, dice) {
  const g = room.ctx.ludo;
  if (g.winner != null) { end(room); return; }
  if (dice === 6 && g.sixes < 2) { g.sixes++; room.say(animator.ludoSix(room.players.get(g.seats[g.turn])?.name || '?')); startTurn(room, true); return; }
  startTurn(room);
}

function end(room) {
  room.clearTimer();
  const g = room.ctx.ludo;
  const rows = g.seats.map((pid, s) => {
    const progress = g.horses[s].reduce((a, p) => a + Math.max(0, p), 0);
    const out = g.horses[s].filter((p) => p >= 0).length;
    const home = g.horses[s].filter((p) => p === HOME).length;
    const points = out * 50 + progress * 10 + home * 200 + g.captures[s] * 100 + (g.winner === s ? 1000 : 0);
    room.addScore(pid, points);
    return { id: pid, color: s, home, captures: g.captures[s], points, winner: g.winner === s };
  }).sort((a, b) => b.points - a.points);
  const top = room.players.get(rows[0]?.id);
  room.say(g.winner != null ? animator.ludoWin(top?.name || '?') : `Temps écoulé ! ${top?.name || '?'} termine en tête de la course.`);
  room.enter('ludoEnd', { rows });
  room.setTimer(END_MS, () => room.finishRound());
  room.sync();
}

function boardView(room) {
  const g = room.ctx.ludo;
  return {
    seats: g.seats.map((pid, s) => ({ player: room.pub(pid), color: s, colorName: COLORS[s], horses: g.horses[s], captures: g.captures[s] })),
    turn: g.turn, endsInMs: Math.max(0, g.endsAt - Date.now()),
  };
}

module.exports = {
  id: 'ludo',
  title: 'Les Petits Chevaux',
  icon: '🐴',
  subtitle: 'Sortez avec un 6 ou un 1, mangez les adversaires, rentrez tous vos chevaux !',
  pitch: 'Le grand classique : dés, chevaux et coups bas. 2 à 4 joueurs.',
  rules: 'Lancez le dé sur votre téléphone. Un 6 ou un 1 fait sortir un cheval, un 6 fait rejouer. Tombez sur un adversaire pour le renvoyer au box. Premier à rentrer tous ses chevaux !',
  players: '2 à 4 joueurs',
  duration: '10 à 15 min',
  minPlayers: 2,
  phases: ['ludoPlay', 'ludoEnd'],

  introLine: () => animator.ludoIntro(),

  cannotPlay(room) {
    return room.connectedPlayers().length < 2 ? 'Il faut au moins 2 joueurs pour les Petits Chevaux.' : null;
  },

  begin(room) {
    const seats = shuffle(room.connectedPlayers().map((p) => p.id)).slice(0, 4);
    const n = HORSES[room.settings.length];
    room.ctx.ludo = {
      seats, horses: seats.map(() => Array(n).fill(-1)), captures: seats.map(() => 0),
      turn: -1, sixes: 0, seq: 0, winner: null, lastMove: null, endsAt: Date.now() + (Number(process.env.SHOWTIME_GAME_CAP_MS) || CAP_MIN[room.settings.length] * 60_000),
    };
    if (room.connectedPlayers().length > 4) room.say('Quatre cavaliers en piste ! Les autres, encouragez-les depuis les tribunes !');
    startTurn(room);
  },

  act(room, p, msg) {
    const g = room.ctx.ludo;
    if (room.phase !== 'ludoPlay' || g.seats[g.turn] !== p.id) return;
    if (msg.type === 'roll' && room.data.stage === 'roll') roll(room);
    else if (msg.type === 'choose' && room.data.stage === 'choose') {
      const opt = room.data.options.find((o) => o.h === msg.h);
      if (opt) move(room, room.data.dice, opt);
    }
  },

  hostView(room) {
    const d = room.data;
    if (room.phase === 'ludoEnd') return { key: 'ludoEnd', ludo: boardView(room), rows: d.rows.map((r) => ({ ...r, player: room.pub(r.id) })) };
    return { key: 'ludo:board', ludo: { ...boardView(room), seq: room.ctx.ludo.seq, stage: d.stage, dice: d.dice, options: d.options, lastMove: d.lastMove } };
  },

  playerView(room, p) {
    const g = room.ctx.ludo;
    const d = room.data;
    const seat = g.seats.indexOf(p.id);
    if (room.phase === 'ludoEnd') return { key: 'ludoEnd', row: d.rows.find((r) => r.id === p.id) || null, rows: d.rows.map((r) => ({ ...r, player: room.pub(r.id) })) };
    const isTurn = seat === g.turn;
    return {
      key: `ludo:${g.seq}:${isTurn}`,
      ludo: {
        seat: seat === -1 ? null : seat, colorName: seat === -1 ? null : COLORS[seat], horses: seat === -1 ? [] : g.horses[seat],
        turnPlayer: room.pub(g.seats[g.turn]), turnColor: COLORS[g.turn], isTurn, stage: d.stage, dice: d.dice, options: isTurn ? d.options : [],
        lastMove: d.lastMove ? { ...d.lastMove, mine: d.lastMove.seat === seat, hitMe: d.lastMove.caught.some((c) => c.seat === seat) } : null,
      },
    };
  },
};

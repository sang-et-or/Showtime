// Moteur commun aux jeux de parcours (« Le Chemin de la Vie », « Fin de Mois ») :
// chacun son tour, on lance le dé, on avance sur un parcours de cases, et la case déclenche
// un événement (gain, dépense, choix à faire…). On compte la fortune virtuelle à la fin.
const crypto = require('crypto');
const { shuffle } = require('../util');

const ROLL_MS = 12_000;
const MOVE_MS = 1_600;
const EVENT_MS = 4_200;
const CHOICE_MS = 15_000;
const RESULT_MS = 3_200;
const END_MS = 8_000;
const CAP_MIN = { short: 8, normal: 12, long: 18 };

/**
 * cfg : { id, title, icon, subtitle, pitch, rules, players, duration, minPlayers, introLine,
 *         sides, currency, buildBoard(room), initSeat(room, seat), firstTurn?(room, seat, api),
 *         maxPos(seat), resolve(room, seat, square, api) → carte, onPass?(room, seat, from, to, api) → textes,
 *         finalTotal(seat), points(total), summary(seat), endLine(room, top) }
 * Une « carte » : { icon, title, text, delta?, choice?: { yes, no, onChoose(yes) → carte } }
 */
function createTrackGame(cfg) {
  const T = `${cfg.id}Turn`;
  const E = `${cfg.id}Event`;
  const END = `${cfg.id}End`;
  const G = (room) => room.ctx[cfg.id];

  const api = (room) => ({
    roll: (n = cfg.sides) => 1 + crypto.randomInt(n),
    seats: () => G(room).seats.map((id) => G(room).st[id]),
    name: (seat) => room.players.get(seat.id)?.name || '?',
    pay: (seat, amount) => { seat.money += amount; return amount; },
    game: () => G(room),
  });

  function startTurn(room) {
    const g = G(room);
    if (Date.now() > g.endsAt || g.seats.every((id) => g.st[id].done)) { end(room); return; }
    let next = -1;
    for (let k = 1; k <= g.seats.length; k++) {
      const s = (g.turn + k) % g.seats.length;
      const id = g.seats[s];
      if (!g.st[id].done && room.players.get(id)?.connected) { next = s; break; }
    }
    if (next === -1) { end(room); return; }
    g.turn = next;
    const seat = g.st[g.seats[next]];
    if (cfg.firstTurn && !seat.started) {
      seat.started = true;
      showCard(room, seat, cfg.firstTurn(room, seat, api(room)), () => rollStage(room));
      return;
    }
    seat.started = true;
    rollStage(room);
  }

  function rollStage(room) {
    const g = G(room);
    g.seq++;
    room.enter(T, { stage: 'roll', roll: null });
    room.say(cfg.turnLine(room.players.get(g.seats[g.turn])?.name || '?'));
    room.setTimer(ROLL_MS, () => roll(room), true);
    room.sync();
  }

  function roll(room) {
    room.clearTimer();
    const g = G(room);
    const seat = g.st[g.seats[g.turn]];
    const r = 1 + crypto.randomInt(cfg.sides);
    const from = seat.pos;
    const to = Math.min(from + r, cfg.maxPos(seat));
    const passed = cfg.onPass ? cfg.onPass(room, seat, from, to, api(room)) : [];
    seat.pos = to;
    g.seq++;
    room.enter(T, { stage: 'move', roll: r, from, to, passed });
    room.setTimer(MOVE_MS + passed.length * 900, () => land(room));
    room.sync();
  }

  function land(room) {
    const g = G(room);
    const seat = g.st[g.seats[g.turn]];
    const card = cfg.resolve(room, seat, g.board[seat.pos], api(room));
    showCard(room, seat, card, () => startTurn(room));
  }

  function showCard(room, seat, card, next) {
    const g = G(room);
    g.pending = { card, next, seat };
    g.seq++;
    room.enter(E, { card: cleanCard(card), choice: card.choice ? { yes: card.choice.yes, no: card.choice.no } : null, chosen: null });
    if (card.choice) room.setTimer(CHOICE_MS, () => choose(room, false), true);
    else room.setTimer(EVENT_MS, () => next());
    room.sync();
  }

  function choose(room, yes) {
    room.clearTimer();
    const g = G(room);
    const { card, next } = g.pending;
    const result = card.choice.onChoose(yes);
    g.seq++;
    room.enter(E, { card: cleanCard(result), choice: null, chosen: yes ? 'yes' : 'no' });
    room.setTimer(RESULT_MS, () => next());
    room.sync();
  }

  function end(room) {
    room.clearTimer();
    const g = G(room);
    const rows = g.seats.map((id) => {
      const seat = g.st[id];
      const total = cfg.finalTotal(seat);
      const points = cfg.points(total);
      room.addScore(id, points);
      return { id, total, points, summary: cfg.summary(seat), done: seat.done };
    }).sort((a, b) => b.total - a.total);
    room.say(cfg.endLine(room.players.get(rows[0]?.id)?.name || '?'));
    room.enter(END, { rows });
    room.setTimer(END_MS, () => room.finishRound());
    room.sync();
  }

  const cleanCard = (c) => ({ icon: c.icon, title: c.title, text: c.text, delta: c.delta ?? null, tone: c.tone || (c.delta > 0 ? 'good' : c.delta < 0 ? 'bad' : 'neutral') });

  function boardView(room) {
    const g = G(room);
    return {
      id: cfg.id, currency: cfg.currency, board: g.board, cols: cfg.cols, turn: g.turn, seq: g.seq,
      seats: g.seats.map((id) => ({ player: room.pub(id), pos: g.st[id].pos, money: g.st[id].money, done: g.st[id].done, summary: cfg.summary(g.st[id]) })),
      endsInMs: Math.max(0, g.endsAt - Date.now()), header: cfg.header ? cfg.header(g) : '',
    };
  }

  return {
    id: cfg.id, title: cfg.title, icon: cfg.icon, subtitle: cfg.subtitle, pitch: cfg.pitch, rules: cfg.rules,
    players: cfg.players, duration: cfg.duration, minPlayers: cfg.minPlayers || 1,
    phases: [T, E, END],
    introLine: cfg.introLine,

    begin(room) {
      const seats = shuffle(room.connectedPlayers().map((p) => p.id)).slice(0, 8);
      const g = { seats, st: {}, turn: -1, seq: 0, board: cfg.buildBoard(room), endsAt: Date.now() + (Number(process.env.SHOWTIME_GAME_CAP_MS) || CAP_MIN[room.settings.length] * 60_000), pending: null };
      room.ctx[cfg.id] = g;
      for (const id of seats) g.st[id] = { id, pos: 0, money: 0, done: false, started: false, ...cfg.initSeat(room) };
      if (cfg.init) cfg.init(room, g);
      startTurn(room);
    },

    act(room, p, msg) {
      const g = G(room);
      const active = g.seats[g.turn] === p.id;
      if (!active) return;
      if (room.phase === T && msg.type === 'roll' && room.data.stage === 'roll') roll(room);
      else if (room.phase === E && msg.type === 'decide' && room.data.choice && !room.data.chosen) choose(room, !!msg.yes);
    },

    hostView(room) {
      const d = room.data;
      if (room.phase === END) return { key: END, track: boardView(room), rows: d.rows.map((r) => ({ ...r, player: room.pub(r.id) })) };
      return { key: `${cfg.id}:board`, track: boardView(room), stage: d.stage || null, roll: d.roll ?? null, passed: d.passed || [], card: d.card || null, choice: d.choice || null, chosen: d.chosen || null };
    },

    playerView(room, p) {
      const g = G(room);
      const d = room.data;
      const seat = g.st[p.id];
      const mine = seat ? { pos: seat.pos, money: seat.money, done: seat.done, summary: cfg.summary(seat) } : null;
      if (room.phase === END) return { key: END, track: { id: cfg.id, currency: cfg.currency, mine }, row: d.rows.find((r) => r.id === p.id) || null };
      const isTurn = g.seats[g.turn] === p.id;
      return {
        key: `${cfg.id}:${g.seq}:${isTurn}`,
        track: { id: cfg.id, currency: cfg.currency, mine, isTurn, turnPlayer: room.pub(g.seats[g.turn]), square: seat ? g.board[seat.pos] : null },
        stage: d.stage || null, roll: d.roll ?? null, card: d.card || null, choice: isTurn ? d.choice : null, hasChoice: !!d.choice, chosen: d.chosen || null,
      };
    },
  };
}

module.exports = { createTrackGame };

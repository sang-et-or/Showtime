// Préparation de « Qui a osé dire ça ? » : chacun répond en secret à 2 amorces.
const animator = require('../animator');
const PROMPTS = require('../content/prompts');
const { shuffle, sanitizeText } = require('../util');

const WRITING_MS = 120_000;

function assign(room, players) {
  const pool = shuffle(PROMPTS);
  let k = (room.ctx.assign.size * 2) % pool.length;
  for (const p of players) {
    room.ctx.assign.set(p.id, [pool[k % pool.length], pool[(k + 1) % pool.length]]);
    k += 2;
  }
}

module.exports = {
  id: 'writing',
  prep: true,
  phases: ['writing'],

  begin(room) {
    room.ctx.assign = new Map();
    room.ctx.writings = new Map();
    assign(room, [...room.players.values()]);
    room.enter('writing');
    room.say(animator.writingIntro());
    room.setTimer(WRITING_MS, () => room.finishRound(), true);
    room.sync();
  },

  onJoin(room, p) { assign(room, [p]); },

  act(room, p, msg) {
    if (msg.type !== 'write' || !room.ctx.assign.has(p.id) || room.ctx.writings.has(p.id)) return;
    if (!Array.isArray(msg.answers)) return;
    room.ctx.writings.set(p.id, msg.answers.slice(0, 2).map((a) => sanitizeText(a, 80)));
    this.check(room);
    room.sync();
  },

  check(room) {
    const c = room.connectedPlayers();
    if (c.length && c.every((p) => room.ctx.writings.has(p.id))) room.setTimer(1_500, () => room.finishRound());
  },

  hostView(room) {
    return { done: [...room.ctx.writings.keys()] };
  },

  playerView(room, p) {
    const submitted = room.ctx.writings.has(p.id);
    return { key: `writing:${submitted}`, prompts: room.ctx.assign.get(p.id) || [], submitted };
  },
};

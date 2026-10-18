// Jeu télé « La Roue des Lettres » (inspiré des jeux de roue et de lettres) : chacun son tour on fait
// tourner la roue, on propose une consonne (chaque lettre trouvée vaut la somme de la roue), on achète
// une voyelle ou on tente de résoudre. Gare à la Banqueroute ! Argent virtuel uniquement.
const { ROUE } = require('../content/tvgames');
const crypto = require('crypto');
const { shuffle, norm, sanitizeText } = require('../util');

const TURN_MS = 20_000;
const SPIN_SHOW_MS = 2_600;
const REVEAL_MS = 6_000;
const PUZZLE_MS = Math.min(4 * 60_000, Number(process.env.SHOWTIME_GAME_CAP_MS) || Infinity); // une énigme ne s'éternise jamais
const VOWEL_COST = 250;
const VOWELS = 'AEIOUY';
const COUNT = { short: 2, normal: 3, long: 5 };
// Les cases de la roue (dans l'ordre affiché à l'écran).
const WHEEL = [300, 500, 200, 'BANQUEROUTE', 400, 600, 250, 800, 'PASSE', 350, 1000, 450, 200, 'BANQUEROUTE', 700, 300, 500, 'PASSE', 900, 400];

const letters = (p) => [...new Set([...p].filter((c) => /[A-Z]/.test(c)))];
const hiddenCount = (d) => letters(d.puzzle.p).filter((l) => !d.shown.has(l)).length;

function nextPuzzle(room) {
  const g = room.ctx.rl;
  g.i++;
  if (g.i >= g.items.length) { room.finishRound(); return; }
  room.enter('rlTurn', { index: g.i + 1, total: g.items.length, puzzle: g.items[g.i], shown: new Set(), used: new Set(), bank: new Map(), stage: 'spin', spin: null, spinSeq: 0, log: [], endsAt: Date.now() + PUZZLE_MS });
  g.turn = (g.turn + 1) % g.order.length;
  room.say(`Catégorie : ${g.items[g.i].cat} ! Faites tourner la roue…`);
  startTurn(room, true);
}

function activeId(room) {
  const g = room.ctx.rl;
  for (let k = 0; k < g.order.length; k++) {
    const id = g.order[(g.turn + k) % g.order.length];
    if (room.players.get(id)?.connected) { g.turn = (g.turn + k) % g.order.length; return id; }
  }
  return null;
}

function startTurn(room, keep) {
  const d = room.data;
  if (!keep) room.ctx.rl.turn = (room.ctx.rl.turn + 1) % room.ctx.rl.order.length;
  const id = activeId(room);
  if (!id || Date.now() > d.endsAt) { reveal(room, null); return; }
  d.active = id;
  d.stage = 'spin';
  d.err = null;
  room.setTimer(TURN_MS, () => { log(room, { who: room.pub(id), text: 'trop lent… au suivant !' }); startTurn(room, false); }, true);
  room.sync();
}

function log(room, entry) { const d = room.data; d.log.unshift(entry); d.log.length = Math.min(d.log.length, 5); }

function reveal(room, solverId) {
  room.clearTimer();
  const d = room.data;
  let pts = 0;
  if (solverId) { pts = (d.bank.get(solverId) || 0) + 300; room.addScore(solverId, pts); }
  room.say(solverId ? `Bravo ${room.players.get(solverId)?.name || ''} ! Vous remportez ${pts} points !` : `La réponse était : ${d.puzzle.p.toLowerCase()}.`);
  room.enter('rlReveal', { ...d, solverId, pts });
  room.setTimer(REVEAL_MS, () => nextPuzzle(room));
  room.sync();
}

module.exports = {
  id: 'rouelettres',
  title: 'La Roue des Lettres',
  icon: '🔠',
  subtitle: 'Faites tourner la roue, proposez des lettres et devinez l’expression mystère !',
  pitch: 'Tournez la roue, gagnez des points par lettre trouvée… mais gare à la Banqueroute !',
  rules: 'Chacun son tour : faites tourner la roue puis proposez une consonne. Chaque fois qu’elle apparaît, vous gagnez la somme indiquée. Achetez une voyelle (250) ou tentez de résoudre. Banqueroute : votre cagnotte retombe à zéro ! Celui qui résout empoche sa cagnotte + 300 points.',
  players: '1 à 8 joueurs',
  duration: '8 à 15 min',
  minPlayers: 1,
  phases: ['rlTurn', 'rlReveal'],
  WHEEL,
  introLine: () => 'Place à la Roue des Lettres ! Faites tourner la roue, trouvez les lettres… et attention à la Banqueroute !',

  begin(room) {
    room.ctx.rl = { i: -1, turn: -1, order: shuffle(room.connectedPlayers().map((p) => p.id)).slice(0, 8), items: shuffle(ROUE).slice(0, COUNT[room.settings.length]) };
    nextPuzzle(room);
  },

  check(room) { if (room.phase === 'rlTurn' && !room.players.get(room.data.active)?.connected) { room.clearTimer(); startTurn(room, false); } },

  act(room, p, msg) {
    const d = room.data;
    if (room.phase !== 'rlTurn' || d.active !== p.id) return;
    const bank = d.bank.get(p.id) || 0;
    if (msg.type === 'spin' && d.stage === 'spin') {
      if (letters(d.puzzle.p).filter((l) => !VOWELS.includes(l)).every((l) => d.used.has(l))) { d.err = 'Plus de consonne à trouver : achète une voyelle ou résous !'; room.sync(); return; }
      room.clearTimer();
      const slot = crypto.randomInt(WHEEL.length);
      const value = WHEEL[slot];
      d.spin = { slot, value }; d.spinSeq++;
      d.stage = 'spinning';
      room.sync();
      room.setTimer(SPIN_SHOW_MS, () => {
        if (value === 'BANQUEROUTE') { d.bank.set(p.id, 0); log(room, { who: room.publicPlayer(p), text: 'BANQUEROUTE ! 💸', ko: true }); room.say(`Oh non ! Banqueroute pour ${p.name} !`); startTurn(room, false); return; }
        if (value === 'PASSE') { log(room, { who: room.publicPlayer(p), text: 'passe son tour', ko: true }); room.say(`Passe ! Au suivant…`); startTurn(room, false); return; }
        d.stage = 'letter';
        room.say(`${value} points ! ${p.name}, une consonne ?`);
        room.setTimer(TURN_MS, () => startTurn(room, false), true);
        room.sync();
      });
    } else if (msg.type === 'letter' && (d.stage === 'letter' || d.stage === 'spin')) {
      const l = String(msg.l || '').toUpperCase();
      if (!/^[A-Z]$/.test(l) || d.used.has(l)) return;
      const vowel = VOWELS.includes(l);
      if (vowel && (d.stage !== 'spin' || bank < VOWEL_COST)) { d.err = `Une voyelle coûte ${VOWEL_COST} : il te faut une cagnotte suffisante.`; room.sync(); return; }
      if (!vowel && d.stage !== 'letter') return;
      room.clearTimer();
      d.used.add(l);
      const n = [...d.puzzle.p].filter((c) => c === l).length;
      if (vowel) d.bank.set(p.id, bank - VOWEL_COST);
      if (n) {
        d.shown.add(l);
        if (!vowel) d.bank.set(p.id, bank + n * d.spin.value);
        log(room, { who: room.publicPlayer(p), text: `${l} ×${n}${vowel ? '' : ` → +${n * d.spin.value}`}`, ok: true });
        if (hiddenCount(d) === 0) { reveal(room, p.id); return; }
        startTurn(room, true);
      } else {
        log(room, { who: room.publicPlayer(p), text: `pas de ${l}…`, ko: true });
        startTurn(room, false);
      }
    } else if (msg.type === 'solve' && d.stage === 'spin') {
      const text = norm(sanitizeText(msg.text, 60));
      if (!text) return;
      room.clearTimer();
      if (text.replace(/ /g, '') === norm(d.puzzle.p).replace(/ /g, '')) {
        letters(d.puzzle.p).forEach((l) => d.shown.add(l));
        reveal(room, p.id);
      } else {
        log(room, { who: room.publicPlayer(p), text: `tente « ${sanitizeText(msg.text, 60)} »… raté !`, ko: true });
        startTurn(room, false);
      }
    }
  },

  hostView(room) {
    const d = room.data;
    const all = room.phase === 'rlReveal';
    const base = {
      rl: { index: d.index, total: d.total, cat: d.puzzle.cat, cells: [...d.puzzle.p].map((c) => (c === ' ' ? ' ' : /[A-Z]/.test(c) ? (all || d.shown.has(c) ? c : null) : c)),
        used: [...d.used], wheel: WHEEL, spin: d.spin, spinSeq: d.spinSeq, log: d.log, bank: room.ctx.rl.order.map((id) => ({ player: room.pub(id), v: d.bank.get(id) || 0 })).filter((x) => x.player) },
    };
    if (room.phase === 'rlTurn') return { ...base, key: `rlTurn:${d.index}`, active: room.pub(d.active), stage: d.stage };
    return { ...base, key: `rlReveal:${d.index}`, solver: d.solverId ? room.pub(d.solverId) : null, pts: d.pts };
  },

  playerView(room, p) {
    const d = room.data;
    const all = room.phase === 'rlReveal';
    const base = { rl: { index: d.index, total: d.total, cat: d.puzzle.cat, cells: [...d.puzzle.p].map((c) => (c === ' ' ? ' ' : /[A-Z]/.test(c) ? (all || d.shown.has(c) ? c : null) : c)), used: [...d.used], bank: d.bank.get(p.id) || 0, vowelCost: VOWEL_COST, spin: d.spin } };
    if (room.phase === 'rlTurn') {
      const isTurn = d.active === p.id;
      return { ...base, key: `rlTurn:${d.index}:${isTurn}:${d.stage}`, isTurn, active: room.pub(d.active), stage: d.stage, err: isTurn ? d.err : null };
    }
    return { ...base, key: `rlReveal:${d.index}`, solver: d.solverId ? room.pub(d.solverId) : null, pts: d.pts, iSolved: d.solverId === p.id, answer: d.puzzle.p };
  },
};

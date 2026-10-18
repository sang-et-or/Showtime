// Jeu télé « Lettre à Lettre » (inspiré des jeux de mots en grille) : la première lettre est donnée,
// chacun son tour propose un mot de la bonne longueur. Lettre bien placée = rouge, mal placée = jaune.
const { MOTUS } = require('../content/tvgames');
const { shuffle, norm, sanitizeText, pick } = require('../util');

const TURN_MS = 30_000;
const REVEAL_MS = 5_500;
const ROWS = 6;
const MAX_TURNS = 12; // tours passés compris, pour ne jamais bloquer
const COUNT = { short: 3, normal: 5, long: 7 };

/** Compare une proposition au mot : 'ok' bien placée, 'mis' mal placée, 'no' absente (comme au jeu télé). */
function score(guess, word) {
  const res = [...guess].map((l) => ({ l, st: 'no' }));
  const left = {};
  [...word].forEach((l, i) => { if (guess[i] === l) res[i].st = 'ok'; else left[l] = (left[l] || 0) + 1; });
  res.forEach((r) => { if (r.st !== 'ok' && left[r.l]) { r.st = 'mis'; left[r.l]--; } });
  return res;
}

function nextWord(room) {
  const g = room.ctx.motus;
  g.i++;
  if (g.i >= g.words.length) { room.finishRound(); return; }
  const word = g.words[g.i];
  const known = [...word].map((l, k) => (k === 0 ? l : null));
  room.enter('motusPlay', { index: g.i + 1, total: g.words.length, word, rows: [], known, turns: 0, err: null });
  g.turn = (g.turn + 1) % Math.max(1, g.order.length);
  room.say(`Un mot de ${word.length} lettres qui commence par ${word[0]}… À vous !`);
  startTurn(room);
}

function activeId(room) {
  const g = room.ctx.motus;
  for (let k = 0; k < g.order.length; k++) {
    const id = g.order[(g.turn + k) % g.order.length];
    if (room.players.get(id)?.connected) { g.turn = (g.turn + k) % g.order.length; return id; }
  }
  return null;
}

function startTurn(room) {
  const d = room.data;
  const id = activeId(room);
  if (!id || d.turns >= MAX_TURNS || d.rows.length >= ROWS) { reveal(room, null); return; }
  d.active = id;
  d.err = null;
  room.setTimer(TURN_MS, () => passTurn(room, true), true);
  room.sync();
}

function passTurn(room, timeout) {
  const g = room.ctx.motus;
  const d = room.data;
  d.turns++;
  if (timeout) {
    // Personne n'a proposé : on dévoile une lettre en cadeau, comme à la télé.
    const hidden = d.known.map((l, k) => (l ? -1 : k)).filter((k) => k >= 0);
    if (hidden.length > 1) { const k = pick(hidden); d.known[k] = d.word[k]; }
    room.say(`Temps écoulé ! Une lettre en cadeau… au suivant !`);
  }
  g.turn = (g.turn + 1) % g.order.length;
  startTurn(room);
}

function reveal(room, solverId) {
  room.clearTimer();
  const d = room.data;
  room.say(solverId ? `Bravo ${room.players.get(solverId)?.name || ''} ! Le mot était « ${d.word} ».` : `Dommage ! Le mot était « ${d.word} ».`);
  room.enter('motusReveal', { ...d, solverId });
  room.setTimer(REVEAL_MS, () => nextWord(room));
  room.sync();
}

module.exports = {
  id: 'motus',
  title: 'Lettre à Lettre',
  icon: '🟥',
  subtitle: 'Trouvez le mot caché : rouge, bien placée ; jaune, mal placée !',
  pitch: 'Le grand jeu de mots en grille : la première lettre est donnée, à vous de trouver le reste.',
  rules: 'Chacun son tour, proposez un mot de la bonne longueur qui commence par la lettre donnée. Case rouge : lettre bien placée. Rond jaune : lettre présente mais mal placée. Six essais pour trouver ; plus vous trouvez vite, plus ça rapporte !',
  players: '1 à 12 joueurs',
  duration: '5 à 10 min',
  minPlayers: 1,
  phases: ['motusPlay', 'motusReveal'],
  introLine: () => 'Place à Lettre à Lettre ! Rouge, c’est bien placé. Jaune, c’est mal placé. Chacun son tour, à vos mots !',

  begin(room) {
    room.ctx.motus = { i: -1, turn: -1, order: shuffle(room.connectedPlayers().map((p) => p.id)), words: shuffle(MOTUS).slice(0, COUNT[room.settings.length]) };
    nextWord(room);
  },

  onJoin(room, p) { const g = room.ctx.motus; if (g && !g.order.includes(p.id)) g.order.push(p.id); },

  check(room) { if (room.phase === 'motusPlay' && !room.players.get(room.data.active)?.connected) { room.clearTimer(); passTurn(room, false); } },

  act(room, p, msg) {
    const d = room.data;
    if (room.phase !== 'motusPlay' || msg.type !== 'word' || d.active !== p.id) return;
    const guess = norm(sanitizeText(msg.text, 20)).replace(/ /g, '');
    if (guess.length !== d.word.length || !/^[A-Z]+$/.test(guess)) { d.err = { pid: p.id, text: `Il faut un mot de ${d.word.length} lettres.` }; room.sync(); return; }
    if (guess[0] !== d.word[0]) { d.err = { pid: p.id, text: `Le mot doit commencer par ${d.word[0]}.` }; room.sync(); return; }
    room.clearTimer();
    const row = score(guess, d.word);
    let fresh = 0;
    row.forEach((r, k) => { if (r.st === 'ok' && !d.known[k]) { d.known[k] = r.l; fresh++; } });
    d.rows.push({ who: room.publicPlayer(p), cells: row });
    if (fresh) room.addScore(p.id, fresh * 20);
    if (guess === d.word) {
      const pts = 150 + (ROWS - d.rows.length + 1) * 70;
      room.addScore(p.id, pts);
      d.pts = pts;
      if (d.rows.length <= 2) room.highlight('motus', 10 - d.rows.length, { emoji: '🟥', title: 'Lettre à Lettre express', body: `${p.name} trouve « ${d.word} » en ${d.rows.length} essai${d.rows.length > 1 ? 's' : ''} !`, players: [p.id] });
      reveal(room, p.id);
      return;
    }
    if (d.rows.length >= ROWS) { reveal(room, null); return; }
    passTurn(room, false);
  },

  hostView(room) {
    const d = room.data;
    const base = { motus: { index: d.index, total: d.total, len: d.word.length, rows: d.rows, known: d.known, max: ROWS } };
    if (room.phase === 'motusPlay') return { ...base, key: `motusPlay:${d.index}`, active: room.pub(d.active) };
    return { ...base, key: `motusReveal:${d.index}`, word: d.word, solver: d.solverId ? room.pub(d.solverId) : null, pts: d.pts || 0 };
  },

  playerView(room, p) {
    const d = room.data;
    const base = { motus: { index: d.index, total: d.total, len: d.word.length, rows: d.rows, known: d.known, max: ROWS } };
    if (room.phase === 'motusPlay') {
      return { ...base, key: `motusPlay:${d.index}:${d.rows.length}:${d.active}`, isTurn: d.active === p.id, active: room.pub(d.active), err: d.err && d.err.pid === p.id ? d.err.text : null };
    }
    return { ...base, key: `motusReveal:${d.index}`, word: d.word, solver: d.solverId ? room.pub(d.solverId) : null, iSolved: d.solverId === p.id, pts: d.pts || 0 };
  },
};

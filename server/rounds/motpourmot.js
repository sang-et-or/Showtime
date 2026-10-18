// Jeu télé « Mot pour Mot » (inspiré des jeux où l'on fait deviner un mot avec un seul mot d'indice) :
// un joueur voit le mot secret sur son téléphone et donne UN mot d'indice ; les autres ont une seule
// réponse par indice. Plus on trouve tôt, plus ça rapporte (au devineur ET à celui qui fait deviner).
const { MOTPOURMOT } = require('../content/tvgames');
const { shuffle, norm, sanitizeText } = require('../util');

const CLUE_MS = 30_000;
const GUESS_MS = 25_000;
const REVEAL_MS = 5_000;
const VALUES = [400, 300, 200, 100];
const COUNT = { short: 4, normal: 6, long: 8 };

const root = (w) => norm(w).replace(/ /g, '').slice(0, 4);
const bare = (w) => norm(w).replace(/ /g, '').replace(/(S|X)$/, '');

function nextWord(room) {
  const g = room.ctx.mpm;
  g.i++;
  const givers = g.order.filter((id) => room.players.get(id)?.connected);
  if (g.i >= g.total || givers.length < 2) { room.finishRound(); return; }
  const giver = givers[g.i % givers.length];
  room.enter('mpmClue', { index: g.i + 1, total: g.total, word: g.words[g.i], giver, clues: [], guesses: [], err: null, step: 0 });
  room.say(`${room.players.get(giver)?.name || ''} va nous faire deviner un mot… Un seul mot d’indice à la fois !`);
  room.setTimer(CLUE_MS, () => reveal(room, null), true);
  room.sync();
}

function openGuess(room) {
  const d = room.data;
  room.enter('mpmGuess', { ...d, answered: new Map(), err: null });
  room.setTimer(GUESS_MS, () => afterGuess(room), true);
  room.sync();
}

function afterGuess(room) {
  room.clearTimer();
  const d = room.data;
  if (d.clues.length >= VALUES.length) { reveal(room, null); return; }
  room.say(`Pas encore ! ${room.players.get(d.giver)?.name || ''}, un autre indice… pour ${VALUES[d.clues.length]} points.`);
  room.enter('mpmClue', { ...d, err: null });
  room.setTimer(CLUE_MS, () => reveal(room, null), true);
  room.sync();
}

function reveal(room, finderId) {
  room.clearTimer();
  const d = room.data;
  const pts = finderId ? VALUES[d.clues.length - 1] : 0;
  if (finderId) { room.addScore(finderId, pts); room.addScore(d.giver, pts); }
  room.say(finderId ? `Trouvé ! ${room.players.get(finderId)?.name || ''} et ${room.players.get(d.giver)?.name || ''} marquent ${pts} points !` : `Le mot était « ${d.word} ». Personne ne l’a trouvé…`);
  room.enter('mpmReveal', { ...d, finderId, pts });
  room.setTimer(REVEAL_MS, () => nextWord(room));
  room.sync();
}

const guessers = (room) => room.connectedPlayers().filter((p) => p.id !== room.data.giver);

module.exports = {
  id: 'motpourmot',
  title: 'Mot pour Mot',
  icon: '🔺',
  subtitle: 'Un seul mot d’indice à la fois : faites deviner le mot secret le plus vite possible !',
  pitch: 'Faites deviner un mot avec un seul mot d’indice. Plus c’est rapide, plus ça rapporte !',
  rules: 'À tour de rôle, un joueur reçoit un mot secret sur son téléphone et donne UN seul mot d’indice. Les autres ont une seule réponse par indice. Trouvé au 1er indice : 400 points pour le devineur et pour celui qui fait deviner, puis 300, 200, 100.',
  players: '2 à 12 joueurs',
  duration: '5 à 10 min',
  minPlayers: 2,
  phases: ['mpmClue', 'mpmGuess', 'mpmReveal'],
  introLine: () => 'Place à Mot pour Mot ! Un seul mot d’indice à la fois… et pas le droit de dire le mot, bien sûr !',
  cannotPlay: (room) => (room.connectedPlayers().length < 2 ? 'Mot pour Mot se joue à deux joueurs minimum.' : null),

  begin(room) {
    const order = shuffle(room.connectedPlayers().map((p) => p.id));
    room.ctx.mpm = { i: -1, order, total: Math.max(COUNT[room.settings.length], Math.min(order.length, 8)), words: shuffle(MOTPOURMOT) };
    nextWord(room);
  },

  check(room) {
    const d = room.data;
    if (!d.giver) return;
    if (!room.players.get(d.giver)?.connected) { reveal(room, null); return; }
    if (room.phase === 'mpmGuess' && guessers(room).every((p) => d.answered.has(p.id))) afterGuess(room);
  },

  act(room, p, msg) {
    const d = room.data;
    if (room.phase === 'mpmClue' && msg.type === 'clue' && p.id === d.giver) {
      const clue = sanitizeText(msg.text, 24);
      if (!clue || /\s/.test(clue)) { d.err = 'Un seul mot, sans espace !'; room.sync(); return; }
      const c = bare(clue); const w = bare(d.word);
      if (c.includes(root(d.word)) || w.includes(c) || c === w) { d.err = 'Interdit : ton indice ressemble trop au mot secret !'; room.sync(); return; }
      if (d.clues.some((x) => bare(x) === c)) { d.err = 'Tu as déjà donné cet indice.'; room.sync(); return; }
      room.clearTimer();
      d.clues.push(clue);
      room.say(`Indice : « ${clue} » !`);
      openGuess(room);
    } else if (room.phase === 'mpmGuess' && msg.type === 'guess' && p.id !== d.giver && !d.answered.has(p.id)) {
      const text = sanitizeText(msg.text, 30);
      if (!text) return;
      const ok = bare(text) === bare(d.word);
      d.answered.set(p.id, ok);
      d.guesses.push({ who: room.publicPlayer(p), text, ok, step: d.clues.length });
      if (ok) { reveal(room, p.id); return; }
      if (guessers(room).every((x) => d.answered.has(x.id))) { afterGuess(room); return; }
      room.sync();
    }
  },

  hostView(room) {
    const d = room.data;
    const base = { mpm: { index: d.index, total: d.total, giver: room.pub(d.giver), clues: d.clues, guesses: d.guesses.filter((x) => x.step === d.clues.length), values: VALUES, letters: d.word.length } };
    if (room.phase === 'mpmClue') return { ...base, key: `mpmClue:${d.index}:${d.clues.length}` };
    if (room.phase === 'mpmGuess') return { ...base, key: `mpmGuess:${d.index}:${d.clues.length}`, answered: [...d.answered.keys()] };
    return { ...base, key: `mpmReveal:${d.index}`, word: d.word, finder: d.finderId ? room.pub(d.finderId) : null, pts: d.pts };
  },

  playerView(room, p) {
    const d = room.data;
    const isGiver = p.id === d.giver;
    const base = { mpm: { index: d.index, total: d.total, giver: room.pub(d.giver), clues: d.clues, values: VALUES, letters: d.word.length }, isGiver, word: isGiver ? d.word : null };
    if (room.phase === 'mpmClue') return { ...base, key: `mpmClue:${d.index}:${d.clues.length}:${isGiver}`, err: isGiver ? d.err : null };
    if (room.phase === 'mpmGuess') return { ...base, key: `mpmGuess:${d.index}:${d.clues.length}:${d.answered.has(p.id)}`, mine: d.answered.has(p.id) ? d.answered.get(p.id) : null };
    return { ...base, key: `mpmReveal:${d.index}`, word: d.word, finder: d.finderId ? room.pub(d.finderId) : null, pts: d.pts, iWon: d.finderId === p.id || (isGiver && !!d.finderId) };
  },
};

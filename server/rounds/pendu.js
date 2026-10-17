// Partie rapide « Mot mystère » (pendu) : lettres proposées depuis les téléphones,
// chaque bonne lettre rapporte des points, et on peut tenter le mot entier.
const animator = require('../animator');
const WORDS = require('../content/pendu');
const { shuffle, norm, sanitizeText } = require('../util');

const PLAY_MS = 90_000;
const REVEAL_MS = 5_000;
const MAX_ERRORS = 8;
const COOLDOWN_MS = 2_500;
const PTS_LETTER = 50;
const PTS_SOLVE = 300;
const COUNT = { short: 3, normal: 5, long: 8 };

const letterOf = (ch) => norm(ch).charAt(0); // « É » → « E »
const isLetter = (ch) => /^[A-Z]$/.test(letterOf(ch));

function mask(word, tried) {
  return [...word].map((ch) => (isLetter(ch) && !tried.has(letterOf(ch)) ? null : ch));
}
const hidden = (word, tried) => mask(word, tried).filter((c) => c === null).length;

function nextWord(room) {
  const pe = room.ctx.pendu;
  pe.i++;
  if (pe.i >= pe.words.length) { room.finishRound(); return; }
  const { w, hint } = pe.words[pe.i];
  room.enter('penduPlay', {
    index: pe.i + 1, total: pe.words.length, word: w, hint,
    tried: new Set(), good: new Set(), errors: 0, cooldown: new Map(), locked: new Set(), log: [],
  });
  room.say(animator.penduWord(hint));
  room.setTimer(PLAY_MS, () => reveal(room, null), true);
  room.sync();
}

function reveal(room, solverId) {
  room.clearTimer();
  const d = room.data;
  room.say(solverId ? animator.penduSolved(room.players.get(solverId)?.name || '?') : animator.penduLost());
  room.enter('penduReveal', { ...d, solverId });
  room.setTimer(REVEAL_MS, () => nextWord(room));
  room.sync();
}

const pushLog = (d, entry) => { d.log.unshift(entry); d.log.length = Math.min(d.log.length, 6); };

module.exports = {
  id: 'pendu',
  title: 'Le Mot mystère',
  icon: '🔤',
  subtitle: 'Proposez des lettres, trouvez le mot avant que les erreurs s’accumulent !',
  pitch: 'Le pendu en équipe : chaque bonne lettre rapporte, le mot entier encore plus.',
  minPlayers: 1,
  phases: ['penduPlay', 'penduReveal'],

  introLine: () => animator.penduIntro(),

  begin(room) {
    room.ctx.pendu = { i: -1, words: shuffle(WORDS).slice(0, COUNT[room.settings.length]) };
    nextWord(room);
  },

  act(room, p, msg) {
    const d = room.data;
    if (room.phase !== 'penduPlay') return;
    if (msg.type === 'letter') {
      const l = String(msg.l || '').toUpperCase();
      if (!/^[A-Z]$/.test(l) || d.tried.has(l)) return;
      if (Date.now() - (d.cooldown.get(p.id) || 0) < COOLDOWN_MS) return;
      d.cooldown.set(p.id, Date.now());
      d.tried.add(l);
      const hits = [...d.word].filter((ch) => isLetter(ch) && letterOf(ch) === l).length;
      if (hits) {
        d.good.add(l);
        room.addScore(p.id, hits * PTS_LETTER);
        pushLog(d, { who: room.publicPlayer(p), l, ok: true, pts: hits * PTS_LETTER });
        if (hidden(d.word, d.tried) === 0) { room.addScore(p.id, PTS_SOLVE); reveal(room, p.id); return; }
      } else {
        d.errors++;
        pushLog(d, { who: room.publicPlayer(p), l, ok: false });
        if (d.errors >= MAX_ERRORS) { reveal(room, null); return; }
      }
      room.sync();
    } else if (msg.type === 'guess') {
      if (d.locked.has(p.id)) return;
      const guess = sanitizeText(msg.text, 40);
      if (!guess) return;
      if (norm(guess) === norm(d.word)) {
        room.addScore(p.id, PTS_SOLVE + hidden(d.word, d.tried) * PTS_LETTER);
        pushLog(d, { who: room.publicPlayer(p), guess: true, ok: true });
        reveal(room, p.id);
        return;
      }
      d.locked.add(p.id);
      d.errors++;
      pushLog(d, { who: room.publicPlayer(p), guess: true, ok: false, text: guess });
      if (d.errors >= MAX_ERRORS) { reveal(room, null); return; }
      room.sync();
    }
  },

  hostView(room) {
    const d = room.data;
    const base = { pendu: { index: d.index, total: d.total, hint: d.hint, errors: d.errors, max: MAX_ERRORS, tried: [...d.tried], good: [...d.good], log: d.log } };
    if (room.phase === 'penduPlay') return { ...base, key: `penduPlay:${d.index}`, mask: mask(d.word, d.tried) };
    return { ...base, key: `penduReveal:${d.index}`, word: d.word, solver: d.solverId ? room.pub(d.solverId) : null };
  },

  playerView(room, p) {
    const d = room.data;
    const base = { pendu: { index: d.index, total: d.total, hint: d.hint, errors: d.errors, max: MAX_ERRORS, tried: [...d.tried], good: [...d.good] } };
    if (room.phase === 'penduPlay') {
      const wait = Math.max(0, COOLDOWN_MS - (Date.now() - (d.cooldown.get(p.id) || 0)));
      return { ...base, key: `penduPlay:${d.index}`, mask: mask(d.word, d.tried), locked: d.locked.has(p.id), cooldownMs: wait };
    }
    return { ...base, key: `penduReveal:${d.index}`, word: d.word, solver: d.solverId ? room.pub(d.solverId) : null, iSolved: d.solverId === p.id };
  },
};

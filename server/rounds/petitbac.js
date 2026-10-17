// Partie rapide « Petit Bac » : une lettre, 5 catégories, réponses originales récompensées.
const animator = require('../animator');
const { CATEGORIES, LETTERS } = require('../content/petitbac');
const { shuffle, sanitizeText, norm } = require('../util');

const WRITE_MS = 90_000;
const STOP_MS = 10_000;
const REVIEW_MS = 45_000;
const REVEAL_MS = 10_000;
const NB_CATS = 5;
const ROUNDS = { short: 2, normal: 3, long: 5 };
const ARTICLES = /^(LE|LA|LES|L|UN|UNE|DES|DU|DE|D)\s+/;

const clean = (arr) => Array.from({ length: NB_CATS }, (_, i) => sanitizeText(Array.isArray(arr) ? arr[i] : '', 30));

/** Contrôle automatique : la réponse commence-t-elle par la bonne lettre ? */
function autoCheck(text, letter) {
  const n = norm(text);
  if (!n) return 'empty';
  if (n.replace(/ /g, '').length < 2) return 'bad';
  return n.startsWith(letter) || n.replace(ARTICLES, '').startsWith(letter) ? 'ok' : 'bad';
}

function nextRound(room) {
  const bac = room.ctx.bac;
  bac.r++;
  if (bac.r > bac.total) { room.finishRound(); return; }
  const letter = shuffle(LETTERS.filter((l) => !bac.used.includes(l)))[0] || 'M';
  bac.used.push(letter);
  room.enter('bacWrite', { round: bac.r, total: bac.total, letter, cats: shuffle(CATEGORIES).slice(0, NB_CATS), answers: new Map(), done: new Set(), stopBy: null });
  room.say(animator.bacLetter(letter));
  room.setTimer(WRITE_MS, () => review(room), true);
  room.sync();
}

function review(room) {
  room.clearTimer();
  const d = room.data;
  const entries = [];
  for (const [pid, answers] of d.answers) {
    if (!room.players.has(pid) || answers.every((a) => !a)) continue;
    answers.forEach((text, ci) => entries.push({ id: `${pid}:${ci}`, pid, ci, text, auto: autoCheck(text, d.letter) }));
  }
  room.enter('bacReview', { ...d, entries, rejects: new Map(), reviewed: new Set() });
  room.say(animator.bacReview());
  room.setTimer(entries.length ? REVIEW_MS : 2_000, () => reveal(room), true);
  room.sync();
}

function reveal(room) {
  room.clearTimer();
  const d = room.data;
  const connected = room.connectedPlayers();
  for (const e of d.entries) {
    const judges = connected.filter((p) => p.id !== e.pid).length;
    const rejects = d.rejects.get(e.id)?.size || 0;
    e.rejects = rejects;
    e.valid = e.auto === 'ok' && !(judges > 0 && rejects > judges / 2);
  }
  // Une réponse unique vaut 100 points, une réponse donnée par plusieurs joueurs 50.
  const totals = {};
  for (let ci = 0; ci < NB_CATS; ci++) {
    const valid = d.entries.filter((e) => e.ci === ci && e.valid);
    for (const e of valid) {
      const same = valid.filter((x) => norm(x.text) === norm(e.text)).length;
      e.points = same > 1 ? 50 : 100;
    }
  }
  for (const e of d.entries) {
    e.points = e.valid ? e.points : 0;
    totals[e.pid] = (totals[e.pid] || 0) + e.points;
  }
  for (const [pid, pts] of Object.entries(totals)) room.addScore(pid, pts);
  const best = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
  room.say(best && best[1] > 0 ? animator.bacBest(room.players.get(best[0])?.name || '?') : 'Pas un seul point sur cette manche… La lettre était vicieuse !');
  room.enter('bacReveal', { ...d, totals });
  room.setTimer(REVEAL_MS, () => nextRound(room));
  room.sync();
}

function table(room, d, withPoints) {
  const rows = [];
  for (const [pid, answers] of d.answers) {
    if (!room.players.has(pid)) continue;
    rows.push({
      player: room.pub(pid),
      cells: answers.map((text, ci) => {
        const e = d.entries.find((x) => x.id === `${pid}:${ci}`);
        if (!e) return { text, status: 'empty' };
        const status = withPoints ? (e.valid ? 'ok' : e.auto === 'empty' ? 'empty' : 'bad') : e.auto;
        return { id: e.id, text, status, rejects: d.rejects.get(e.id)?.size || 0, points: withPoints ? e.points : null };
      }),
      total: withPoints ? (d.totals[pid] || 0) : null,
    });
  }
  return rows;
}

module.exports = {
  id: 'petitbac',
  title: 'Le Petit Bac',
  icon: '📝',
  subtitle: 'Une lettre, cinq catégories. Le premier qui a tout rempli crie STOP !',
  pitch: 'Une lettre, 5 catégories : prénom, pays, animal… Le plus original gagne.',
  rules: 'Une lettre est tirée au sort. Remplissez les 5 catégories sur votre téléphone ; le premier qui a tout rempli crie STOP. Ensuite, contestez les réponses douteuses : une réponse unique vaut 100, une réponse en double 50.',
  players: '1 à 12 joueurs',
  duration: '5 à 10 min',
  minPlayers: 1,
  phases: ['bacWrite', 'bacReview', 'bacReveal'],

  introLine: () => animator.bacIntro(),

  begin(room) {
    room.ctx.bac = { r: 0, total: ROUNDS[room.settings.length], used: [] };
    nextRound(room);
  },

  act(room, p, msg) {
    const d = room.data;
    if (room.phase === 'bacWrite' && (msg.type === 'bacDraft' || msg.type === 'bacSubmit') && !d.done.has(p.id)) {
      const answers = clean(msg.answers);
      d.answers.set(p.id, answers);
      if (msg.type === 'bacSubmit') {
        d.done.add(p.id);
        if (!d.stopBy && answers.every((a) => a)) {
          d.stopBy = p.id;
          room.say(animator.bacStop(p.name));
          room.shortenTimer(STOP_MS);
        }
        this.check(room);
      }
      room.sync();
      return;
    }
    if (room.phase === 'bacReview') {
      if (msg.type === 'bacReject') {
        const e = d.entries.find((x) => x.id === msg.id);
        if (!e || e.pid === p.id || e.auto !== 'ok' || d.reviewed.has(p.id)) return;
        if (!d.rejects.has(e.id)) d.rejects.set(e.id, new Set());
        if (msg.on) d.rejects.get(e.id).add(p.id); else d.rejects.get(e.id).delete(p.id);
        room.sync();
      } else if (msg.type === 'bacReviewed') {
        d.reviewed.add(p.id);
        this.check(room);
        room.sync();
      }
    }
  },

  check(room) {
    const d = room.data;
    const c = room.connectedPlayers();
    if (!c.length) return;
    if (room.phase === 'bacWrite' && c.every((p) => d.done.has(p.id))) room.setTimer(1_000, () => review(room));
    if (room.phase === 'bacReview' && c.every((p) => d.reviewed.has(p.id))) room.setTimer(800, () => reveal(room));
  },

  hostView(room) {
    const d = room.data;
    const base = { bac: { round: d.round, total: d.total, letter: d.letter, cats: d.cats, stopBy: d.stopBy ? room.pub(d.stopBy) : null } };
    if (room.phase === 'bacWrite') {
      const progress = {};
      for (const [pid, a] of d.answers) progress[pid] = a.filter(Boolean).length;
      return { ...base, key: `bacWrite:${d.round}`, done: [...d.done], progress };
    }
    if (room.phase === 'bacReview') return { ...base, key: `bacReview:${d.round}`, rows: table(room, d, false), reviewed: [...d.reviewed] };
    return { ...base, key: `bacReveal:${d.round}`, rows: table(room, d, true) };
  },

  playerView(room, p) {
    const d = room.data;
    const base = { bac: { round: d.round, total: d.total, letter: d.letter, cats: d.cats, stopBy: d.stopBy ? room.pub(d.stopBy) : null } };
    if (room.phase === 'bacWrite') {
      const done = d.done.has(p.id);
      return { ...base, key: `bacWrite:${d.round}:${done}`, mine: d.answers.get(p.id) || clean([]), done };
    }
    if (room.phase === 'bacReview') {
      const reviewed = d.reviewed.has(p.id);
      return {
        ...base, key: `bacReview:${d.round}:${reviewed}`, reviewed,
        entries: d.entries.filter((e) => e.auto !== 'empty').map((e) => ({
          id: e.id, ci: e.ci, text: e.text, auto: e.auto, mine: e.pid === p.id, author: room.pub(e.pid),
          rejected: !!d.rejects.get(e.id)?.has(p.id),
        })),
      };
    }
    const mine = d.entries.filter((e) => e.pid === p.id);
    return { ...base, key: `bacReveal:${d.round}`, total: d.totals[p.id] || 0, mine: mine.map((e) => ({ ci: e.ci, text: e.text, points: e.points, valid: e.valid })) };
  },
};

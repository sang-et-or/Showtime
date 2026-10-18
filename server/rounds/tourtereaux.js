// Jeu télé « Les Tourtereaux » (inspiré des jeux de couples où l'on devine les réponses de l'autre) :
// les joueurs forment des duos ; à chaque manche, une question porte sur l'un des deux. Il répond pour lui
// en secret, son partenaire devine. Réponses identiques = points ! Sinon, le public vote : « ça compte ? ».
const { shuffle, norm, sanitizeText } = require('../util');

const WRITE_MS = 35_000;
const JUDGE_MS = 15_000;
const REVEAL_MS = 7_000;
const PTS = 200;
const ROUNDS = { short: 4, normal: 6, long: 8 };

// {n} = prénom de la personne concernée. Questions tout public, pour amis, familles et couples.
const QUESTIONS = [
  'Quel est le plat préféré de {n} ?', 'Quelle destination fait rêver {n} ?', 'Quel est l’animal préféré de {n} ?',
  'Quel film {n} pourrait revoir cent fois ?', 'Qu’est-ce qui énerve le plus {n} ?', 'Quelle chanson {n} chante sous la douche ?',
  'Quel superpouvoir {n} voudrait avoir ?', 'Quel métier {n} voulait faire enfant ?', 'Quel est le plus gros défaut de {n} ?',
  'Quelle est la plus grande qualité de {n} ?', 'Quel objet {n} emporterait sur une île déserte ?', 'Quelle est la couleur préférée de {n} ?',
  'Quelle est la saison préférée de {n} ?', 'De quoi {n} a-t-il ou elle le plus peur ?', 'Quelle boisson {n} commande au bar ?',
  'Quel sport {n} regarde ou pratique le plus ?', 'Quel est le dessert préféré de {n} ?', 'Quel chanteur ou quelle chanteuse {n} adore ?',
  'Quelle série {n} a dévorée ?', 'Quel était le surnom de {n} enfant ?', 'Quel cadeau ferait le plus plaisir à {n} ?',
  'Où {n} partirait pour un week-end en amoureux ?', 'Quel est le péché mignon de {n} ?', 'Que fait {n} en premier en rentrant chez soi ?',
  'Quelle est l’appli que {n} ouvre le plus ?', 'Quel est le plus grand rêve de {n} ?', 'Quel personnage de dessin animé ressemble à {n} ?',
  'Que commande {n} au restaurant chinois (ou japonais) ?', 'Quel est le mot que {n} dit tout le temps ?', 'Quelle tâche ménagère {n} déteste ?',
  'Quel est le meilleur souvenir de vacances de {n} ?', 'Avec quelle célébrité {n} aimerait dîner ?', 'Quelle est la pire manie de {n} ?',
  'Quel parfum de glace choisit {n} ?', 'Quel est le jeu de société préféré de {n} ?', 'Si {n} était un animal, ce serait…',
  'Quel est le premier concert de {n} ?', 'Que ferait {n} en gagnant au loto ?', 'Quelle est l’heure de réveil idéale de {n} ?',
  'Quelle émission de télé {n} ne rate jamais ?',
];

const close = (a, b) => {
  const x = norm(a).replace(/(S|X)\b/g, ''); const y = norm(b).replace(/(S|X)\b/g, '');
  return !!x && !!y && (x === y || (x.length >= 4 && y.includes(x)) || (y.length >= 4 && x.includes(y)));
};

function makeDuos(ids) {
  const s = shuffle(ids);
  const duos = [];
  for (let i = 0; i + 1 < s.length; i += 2) duos.push([s[i], s[i + 1]]);
  if (s.length % 2 === 1) { if (duos.length) duos[duos.length - 1].push(s[s.length - 1]); else duos.push([s[0]]); }
  return duos;
}

function nextRound(room) {
  const g = room.ctx.tz;
  g.r++;
  if (g.r >= g.total) { room.finishRound(); return; }
  const q = g.questions[g.r];
  const pairs = g.duos.map((members, k) => {
    const subject = members[g.r % members.length];
    return { k, members, subject, q: q.replace('{n}', room.players.get(subject)?.name || '?'), answers: new Map(), votes: new Map(), auto: false, ok: false, judged: null };
  });
  room.enter('tzWrite', { round: g.r + 1, total: g.total, pairs });
  room.say(`Manche ${g.r + 1} ! Chacun répond en secret… et on verra si vous vous connaissez vraiment !`);
  room.setTimer(WRITE_MS, () => judge(room), true);
  room.sync();
}

const pairOf = (room, id) => room.data.pairs?.find((p) => p.members.includes(id));
const guessers = (p) => p.members.filter((id) => id !== p.subject);

function judge(room) {
  room.clearTimer();
  const d = room.data;
  d.pairs.forEach((p) => {
    const sub = p.answers.get(p.subject);
    p.guesses = guessers(p).map((id) => ({ id, text: p.answers.get(id) || '', auto: !!sub && close(sub, p.answers.get(id) || '') }));
    p.auto = p.guesses.length > 0 && p.guesses.every((x) => x.auto);
  });
  // Tout est déjà réglé (réponses identiques, ou personne pour juger) : on révèle directement.
  const toJudge = d.pairs.filter((p) => !p.auto && p.answers.get(p.subject) && p.guesses.some((x) => x.text));
  if (!toJudge.length) { reveal(room); return; }
  room.enter('tzJudge', { ...d });
  room.say(d.pairs.length > 1 ? 'À vous de juger : ces réponses, ça compte ou pas ?' : 'Alors, est-ce que ça compte ?');
  room.setTimer(JUDGE_MS, () => reveal(room), true);
  room.sync();
}

function verdict(room, p) {
  if (p.auto) return true;
  if (!p.answers.get(p.subject) || !p.guesses?.some((x) => x.text)) return false;
  if (room.ctx.tz.duos.length === 1) return p.judged === true; // un seul duo : la personne concernée valide
  const yes = [...p.votes.values()].filter(Boolean).length;
  const no = [...p.votes.values()].filter((v) => !v).length;
  return yes > no;
}

function reveal(room) {
  room.clearTimer();
  const d = room.data;
  let hits = 0;
  d.pairs.forEach((p) => {
    p.ok = verdict(room, p);
    if (p.ok) { hits++; p.members.forEach((id) => room.addScore(id, PTS)); }
  });
  room.say(hits ? `${hits} duo${hits > 1 ? 's' : ''} sur la même longueur d’onde ! 💕` : 'Aïe… personne ne se connaît vraiment ce soir ! 😅');
  room.enter('tzReveal', { ...d });
  room.setTimer(REVEAL_MS, () => nextRound(room));
  room.sync();
}

function pairView(room, p, opts = {}) {
  const show = opts.all;
  return {
    k: p.k, q: p.q, subject: room.pub(p.subject), members: p.members.map((id) => room.pub(id)).filter(Boolean),
    written: p.members.filter((id) => p.answers.has(id)),
    answer: show ? p.answers.get(p.subject) || '' : null,
    guesses: show ? (p.guesses || []).map((x) => ({ who: room.pub(x.id), text: x.text, auto: x.auto })) : null,
    auto: p.auto, ok: p.ok, yes: [...p.votes.values()].filter(Boolean).length, no: [...p.votes.values()].filter((v) => !v).length,
  };
}

module.exports = {
  id: 'tourtereaux',
  title: 'Les Tourtereaux',
  icon: '💕',
  subtitle: 'En duo : devinez les réponses de votre partenaire !',
  pitch: 'Vous croyez bien vous connaître ? Répondez pour l’autre… et croisez les doigts !',
  rules: 'Les joueurs forment des duos. À chaque manche, une question porte sur l’un des deux : il répond pour lui en secret, son partenaire devine. Réponses identiques : +200 chacun ! Si c’est presque pareil, les autres joueurs votent « ça compte ? ».',
  players: '2 à 12 joueurs',
  duration: '8 à 15 min',
  minPlayers: 2,
  phases: ['tzWrite', 'tzJudge', 'tzReveal'],
  introLine: () => 'Bienvenue aux Tourtereaux ! Formez vos duos… Vous croyez bien vous connaître ? On va vérifier !',
  cannotPlay: (room) => (room.connectedPlayers().length < 2 ? 'Les Tourtereaux se jouent à deux joueurs minimum.' : null),

  begin(room) {
    const duos = makeDuos(room.connectedPlayers().map((p) => p.id));
    room.ctx.tz = { duos, r: -1, total: ROUNDS[room.settings.length], questions: shuffle(QUESTIONS) };
    nextRound(room);
  },

  check(room) {
    const d = room.data;
    if (room.phase === 'tzWrite' && d.pairs.every((p) => p.members.filter((id) => room.players.get(id)?.connected).every((id) => p.answers.has(id)))) judge(room);
  },

  act(room, p, msg) {
    const d = room.data;
    const mine = pairOf(room, p.id);
    if (room.phase === 'tzWrite' && msg.type === 'answer' && mine && !mine.answers.has(p.id)) {
      const text = sanitizeText(msg.text, 40);
      if (!text) return;
      mine.answers.set(p.id, text);
      if (d.pairs.every((x) => x.members.filter((id) => room.players.get(id)?.connected).every((id) => x.answers.has(id)))) { room.clearTimer(); room.setTimer(800, () => judge(room)); }
      room.sync();
    } else if (room.phase === 'tzJudge' && msg.type === 'judge') {
      const target = d.pairs.find((x) => x.k === msg.k);
      if (!target) return;
      if (room.ctx.tz.duos.length === 1) { if (p.id === target.subject) { target.judged = !!msg.ok; reveal(room); } return; }
      if (target.members.includes(p.id)) return; // on ne juge pas son propre duo
      target.votes.set(p.id, !!msg.ok);
      room.sync();
    }
  },

  hostView(room) {
    const d = room.data;
    const base = { tz: { round: d.round, total: d.total } };
    if (room.phase === 'tzWrite') return { ...base, key: `tzWrite:${d.round}`, pairs: d.pairs.map((x) => pairView(room, x)) };
    if (room.phase === 'tzJudge') return { ...base, key: `tzJudge:${d.round}`, pairs: d.pairs.map((x) => pairView(room, x, { all: true })) };
    return { ...base, key: `tzReveal:${d.round}`, pairs: d.pairs.map((x) => pairView(room, x, { all: true })) };
  },

  playerView(room, p) {
    const d = room.data;
    const mine = pairOf(room, p.id);
    const base = { tz: { round: d.round, total: d.total } };
    if (room.phase === 'tzWrite') {
      return { ...base, key: `tzWrite:${d.round}:${!!mine?.answers.has(p.id)}`, inGame: !!mine, isSubject: mine?.subject === p.id, q: mine?.q || '', subject: mine ? room.pub(mine.subject) : null,
        partners: mine ? mine.members.filter((id) => id !== p.id).map((id) => room.pub(id)) : [], done: !!mine?.answers.has(p.id) };
    }
    if (room.phase === 'tzJudge') {
      const solo = room.ctx.tz.duos.length === 1;
      const canJudge = (x) => (solo ? x.subject === p.id : !x.members.includes(p.id));
      return { ...base, key: `tzJudge:${d.round}`, solo,
        toJudge: d.pairs.filter((x) => canJudge(x) && !x.auto && x.answers.get(x.subject) && x.guesses?.some((y) => y.text)).map((x) => ({ ...pairView(room, x, { all: true }), myVote: x.votes.has(p.id) ? x.votes.get(p.id) : null })) };
    }
    return { ...base, key: `tzReveal:${d.round}`, mine: mine ? pairView(room, mine, { all: true }) : null };
  },
};

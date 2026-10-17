// Jeu privé pour un couple : « Entre nous ». Deux joueurs exactement, trois niveaux d'intensité.
// Confidentialité : le contenu n'est envoyé qu'aux deux téléphones ; l'écran principal reste neutre ;
// rien n'est enregistré (ni historique, ni souvenirs, ni photos) ; un « non » n'est jamais révélé.
const { LEVELS, GUESS, TRUTHS, DARES, WISHES } = require('../content/couple');
const { shuffle } = require('../util');

const GUESS_MS = 35_000;
const TALK_MS = 90_000;
const WISH_MS = 30_000;
const REVEAL_MS = 5_000;
const END_MS = 15_000;
const STEPS = { short: 8, normal: 12, long: 16 };
const PATTERN = ['guess', 'truth', 'wish', 'dare', 'guess', 'wish', 'truth', 'dare'];
const ORDER = ['douceur', 'complicite', 'audace'];

/** Le niveau choisi en priorité, complété par les niveaux plus doux si besoin. */
function pool(source, level) {
  const upto = ORDER.slice(0, ORDER.indexOf(level) + 1);
  return [...shuffle(source[level]), ...shuffle(upto.filter((l) => l !== level).flatMap((l) => source[l]))];
}

function buildSteps(room) {
  const level = LEVELS[room.settings.coupleLevel] ? room.settings.coupleLevel : 'douceur';
  const pools = { guess: pool(GUESS, level), truth: pool(TRUTHS, level), dare: pool(DARES, level), wish: pool(WISHES, level) };
  const used = { guess: 0, truth: 0, dare: 0, wish: 0 };
  return Array.from({ length: STEPS[room.settings.length] }, (_, i) => {
    const kind = PATTERN[i % PATTERN.length];
    const item = pools[kind][used[kind]++ % pools[kind].length];
    return { kind, item, who: i % 2 };
  });
}

function next(room) {
  const g = room.ctx.cp;
  g.i++;
  if (g.i >= g.steps.length) { end(room); return; }
  const st = g.steps[g.i];
  g.seq++;
  const name = room.players.get(g.seats[st.who])?.name || '';
  if (st.kind === 'guess') {
    room.enter('cpGuess', { answers: new Map() });
    room.say(`${name} se confie… et l’autre devine ! Regardez vos téléphones.`);
    room.setTimer(GUESS_MS, () => revealGuess(room), true);
  } else if (st.kind === 'wish') {
    room.enter('cpWish', { answers: new Map() });
    room.say('Envie secrète : répondez chacun de votre côté. Seules les envies partagées seront révélées.');
    room.setTimer(WISH_MS, () => revealWish(room), true);
  } else {
    room.enter('cpTalk', { done: null });
    room.say(st.kind === 'truth' ? `Une vérité pour ${name}… regardez vos téléphones.` : `Un défi pour ${name}… regardez vos téléphones.`);
    room.setTimer(TALK_MS, () => finishTalk(room, true), true);
  }
  room.sync();
}

const both = (room, pts) => room.ctx.cp.seats.forEach((id) => room.addScore(id, pts));

function revealGuess(room) {
  room.clearTimer();
  const g = room.ctx.cp;
  const st = g.steps[g.i];
  const subject = g.seats[st.who];
  const guesser = g.seats[1 - st.who];
  const a = room.data.answers.get(subject);
  const b = room.data.answers.get(guesser);
  const match = a != null && a === b;
  if (match) { both(room, 150); g.matches++; }
  room.say(match ? 'Vous vous connaissez par cœur ! 💞' : 'Raté… il y a encore des choses à découvrir ! 😏');
  g.seq++;
  room.enter('cpGuessReveal', { a, b, match });
  room.setTimer(REVEAL_MS, () => next(room));
  room.sync();
}

function finishTalk(room, done) {
  room.clearTimer();
  if (done) both(room, 100);
  room.ctx.cp.seq++;
  room.ctx.cp.joker += done ? 0 : 1;
  next(room);
}

function revealWish(room) {
  room.clearTimer();
  const g = room.ctx.cp;
  const st = g.steps[g.i];
  const ans = g.seats.map((id) => room.data.answers.get(id));
  // Partagée si les deux ont dit « oui » ou « peut-être » ; sinon on ne dit pas qui a refusé.
  const shared = ans.every((x) => x === 'yes' || x === 'maybe');
  if (shared) { g.wishes.push({ text: st.item, sure: ans.every((x) => x === 'yes') }); both(room, 100); }
  room.say(shared ? 'Envie partagée ! 🔥' : 'On garde ça pour plus tard… Suite !');
  g.seq++;
  room.enter('cpWishReveal', { shared });
  room.setTimer(REVEAL_MS, () => next(room));
  room.sync();
}

function end(room) {
  room.clearTimer();
  const g = room.ctx.cp;
  room.say(`Fin de la partie… La suite vous appartient ! ${g.wishes.length} envie${g.wishes.length > 1 ? 's' : ''} partagée${g.wishes.length > 1 ? 's' : ''}.`);
  g.seq++;
  room.enter('cpEnd', {});
  room.setTimer(END_MS, () => room.finishRound());
  room.sync();
}

module.exports = {
  id: 'couple',
  title: 'Entre nous',
  icon: '🔥',
  adult: true,
  privateGame: true,
  subtitle: 'Le jeu privé pour les couples : complicité, confidences et envies partagées.',
  pitch: 'Jeu privé pour un couple : confidences, défis et envies secrètes. Réservé aux adultes.',
  rules: 'À deux, chacun sur son téléphone. Devinez les goûts de l’autre, dites-vous des vérités, relevez des défis (joker toujours possible) et découvrez vos envies communes : un « non » n’est jamais révélé. Rien n’est enregistré.',
  players: '2 joueurs',
  duration: '15 à 30 min',
  minPlayers: 2,
  phases: ['cpGuess', 'cpGuessReveal', 'cpTalk', 'cpWish', 'cpWishReveal', 'cpEnd'],
  LEVELS,

  introLine: () => 'Entre nous… Installez-vous confortablement. Tout se passe sur vos téléphones, et rien ne sera enregistré.',

  cannotPlay(room) {
    return room.connectedPlayers().length !== 2 ? 'Le jeu « Entre nous » se joue à deux exactement.' : null;
  },

  begin(room) {
    room.ctx.cp = { seats: room.connectedPlayers().map((p) => p.id), steps: buildSteps(room), i: -1, seq: 0, wishes: [], matches: 0, joker: 0 };
    next(room);
  },

  act(room, p, msg) {
    const g = room.ctx.cp;
    const seat = g.seats.indexOf(p.id);
    if (seat === -1) return;
    const st = g.steps[g.i];
    const d = room.data;
    if (room.phase === 'cpGuess' && msg.type === 'answer' && !d.answers.has(p.id)) {
      if (!Number.isInteger(msg.choice) || msg.choice < 0 || msg.choice >= st.item.a.length) return;
      d.answers.set(p.id, msg.choice);
      if (g.seats.every((id) => d.answers.has(id))) room.setTimer(700, () => revealGuess(room));
      room.sync();
    } else if (room.phase === 'cpWish' && msg.type === 'wish' && !d.answers.has(p.id) && ['yes', 'maybe', 'no'].includes(msg.value)) {
      d.answers.set(p.id, msg.value);
      if (g.seats.every((id) => d.answers.has(id))) room.setTimer(700, () => revealWish(room));
      room.sync();
    } else if (room.phase === 'cpTalk' && st.who === seat && (msg.type === 'done' || msg.type === 'joker')) {
      finishTalk(room, msg.type === 'done');
    }
  },

  check(room) {
    const g = room.ctx.cp;
    if (!g || g.seats.some((id) => room.players.get(id)?.connected)) return;
    room.clearTimer();
  },

  // L'écran principal reste neutre : jamais le contenu des questions ni des réponses.
  hostView(room) {
    const g = room.ctx.cp;
    const st = g.steps[g.i] || {};
    return {
      key: room.phase === 'cpEnd' ? 'cpEnd' : `cp:${g.seq}`,
      cp: { step: Math.min(g.i + 1, g.steps.length), total: g.steps.length, kind: st.kind || null, shared: g.wishes.length, players: g.seats.map((id) => room.pub(id)), match: room.data.match ?? null, wishShared: room.data.shared ?? null },
    };
  },

  playerView(room, p) {
    const g = room.ctx.cp;
    const seat = g.seats.indexOf(p.id);
    const st = g.steps[g.i] || {};
    const d = room.data;
    const partner = room.pub(g.seats[1 - seat]);
    const base = { cp: { step: Math.min(g.i + 1, g.steps.length), total: g.steps.length, kind: st.kind, partner, isMe: st.who === seat, subjectName: room.players.get(g.seats[st.who])?.name } };
    switch (room.phase) {
      case 'cpGuess': {
        const mine = d.answers.has(p.id) ? d.answers.get(p.id) : null;
        return { ...base, key: `cpGuess:${g.seq}:${mine !== null}`, item: st.item, mine };
      }
      case 'cpGuessReveal': return { ...base, key: `cpGuessReveal:${g.seq}`, item: st.item, a: d.a, b: d.b, match: d.match };
      case 'cpTalk': return { ...base, key: `cpTalk:${g.seq}`, text: st.item };
      case 'cpWish': {
        const mine = d.answers.get(p.id) || null;
        return { ...base, key: `cpWish:${g.seq}:${!!mine}`, text: st.item, mine };
      }
      case 'cpWishReveal': return { ...base, key: `cpWishReveal:${g.seq}`, text: st.item, shared: d.shared };
      default: return { ...base, key: 'cpEnd', wishes: g.wishes, matches: g.matches, jokers: g.joker };
    }
  },
};

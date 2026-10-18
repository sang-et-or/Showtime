// Jeu télé « L'Île des Défis » (inspiré des jeux d'aventure en tribus, avec nos propres règles) :
// deux tribus s'affrontent sur des épreuves jouées au téléphone (rapidité, poteaux, quiz),
// la tribu perdante tient son conseil et élimine l'un des siens par un vote secret,
// puis les survivants s'affrontent sur les poteaux de l'épreuve finale.
const crypto = require('crypto');
const { QUESTIONS, CATEGORIES, DEFAULT_CATEGORIES } = require('../content/questions');
const { shuffle, pick } = require('../util');

const READY_MS = 3_500;
const TAP_MS = 10_000;
const HOLD_START_MS = 4_000; // délai pour poser son doigt une fois le top donné
const HOLD_CAP_MS = 45_000;
const FINAL_CAP_MS = 60_000;
const QUIZ_Q_MS = 12_000;
const QUIZ_COUNT = 3;
const RESULT_MS = 6_000;
const VOTE_MS = 25_000;
const COUNCIL_STEP_MS = 1_800;
const END_MS = 9_000;
const EPISODES = { short: 2, normal: 3, long: 4 };
const TRIBES = [
  { id: 0, name: 'Les Coraux', icon: '🪸', color: '#f97316' },
  { id: 1, name: 'Les Volcans', icon: '🌋', color: '#ef4444' },
];
const CHALLENGES = {
  tap: { icon: '🥥', title: 'La course aux noix de coco', rule: 'Tapez le plus vite possible sur votre téléphone pendant 10 secondes ! La tribu avec la meilleure moyenne gagne.' },
  hold: { icon: '🪵', title: 'Les poteaux', rule: 'Gardez le doigt appuyé sur votre téléphone. Le dernier encore en place fait gagner sa tribu !' },
  quiz: { icon: '🧠', title: 'Le défi des sages', rule: 'Trois questions : la tribu avec le plus de bonnes réponses (en proportion) gagne.' },
};

const G = (room) => room.ctx.ile;
const alive = (room) => G(room).players.filter((id) => !G(room).out.includes(id) && room.players.get(id)?.connected);
const aliveIn = (room, t) => alive(room).filter((id) => G(room).tribe[id] === t);

function quizQuestions(n) {
  return shuffle(QUESTIONS.filter((q) => DEFAULT_CATEGORIES.includes(q.cat) && !CATEGORIES[q.cat].adult)).slice(0, n).map((q) => {
    const order = shuffle([0, 1, 2, 3]);
    return { text: q.q, choices: order.map((k) => q.a[k]), correct: order.indexOf(0) };
  });
}

// ---------- déroulé ----------
function nextEpisode(room) {
  const g = G(room);
  g.ep++;
  const tribesOk = TRIBES.every((t) => aliveIn(room, t.id).length >= 1);
  if (g.ep > g.episodes || !tribesOk || alive(room).length <= 3) { startFinal(room); return; }
  const kind = g.deck.shift() || pick(Object.keys(CHALLENGES));
  g.kind = kind;
  room.enter('ileChallenge', { stage: 'ready', kind, final: false, taps: new Map(), holding: new Map(), outAt: new Map(), qi: -1, qs: kind === 'quiz' ? quizQuestions(QUIZ_COUNT) : null, answers: new Map(), correct: new Map() });
  room.say(`Épisode ${g.ep} ! Épreuve : ${CHALLENGES[kind].title}. ${CHALLENGES[kind].rule}`);
  room.setTimer(READY_MS + 2_500, () => go(room), true);
  room.sync();
}

function go(room) {
  const d = room.data;
  d.stage = 'go';
  d.goAt = Date.now();
  if (d.kind === 'tap') { room.say('Top ! Tapez, tapez, tapez !'); room.setTimer(TAP_MS, () => endChallenge(room), true); }
  else if (d.kind === 'hold') { room.say('Top ! Posez votre doigt… et ne le lâchez plus !'); room.setTimer(HOLD_START_MS, () => checkHold(room)); }
  else { nextQuiz(room); return; }
  room.sync();
}

function nextQuiz(room) {
  const d = room.data;
  d.qi++;
  if (d.qi >= d.qs.length) { endChallenge(room); return; }
  d.answers = new Map();
  room.setTimer(QUIZ_Q_MS, () => nextQuiz(room), true);
  room.sync();
}

/** Poteaux : élimine ceux qui n'ont jamais posé le doigt, puis vérifie s'il reste un vainqueur. */
function checkHold(room) {
  const d = room.data;
  const contenders = d.final ? G(room).finalists : alive(room);
  contenders.forEach((id) => { if (!d.holding.has(id) && !d.outAt.has(id)) d.outAt.set(id, Date.now()); });
  if (holdDecided(room)) { endChallenge(room); return; }
  room.setTimer((d.final ? FINAL_CAP_MS : HOLD_CAP_MS) - (Date.now() - d.goAt), () => endChallenge(room), true);
  room.sync();
}

function holdDecided(room) {
  const d = room.data;
  const still = (d.final ? G(room).finalists : alive(room)).filter((id) => !d.outAt.has(id));
  if (d.final) return still.length <= 1;
  return TRIBES.some((t) => still.filter((id) => G(room).tribe[id] === t.id).length === 0);
}

function tribeScores(room) {
  const d = room.data;
  return TRIBES.map((t) => {
    const ids = aliveIn(room, t.id);
    if (!ids.length) return 0;
    if (d.kind === 'tap') return ids.reduce((s, id) => s + (d.taps.get(id) || 0), 0) / ids.length;
    if (d.kind === 'quiz') return ids.reduce((s, id) => s + (d.correct.get(id) || 0), 0) / ids.length;
    // poteaux : la tribu dont le dernier membre a tenu le plus longtemps
    return Math.max(...ids.map((id) => (d.outAt.has(id) ? d.outAt.get(id) : Date.now() + 1) - d.goAt));
  });
}

function endChallenge(room) {
  room.clearTimer();
  const g = G(room);
  const d = room.data;
  if (d.final) { endFinal(room); return; }
  const scores = tribeScores(room);
  const winner = scores[0] === scores[1] ? crypto.randomInt(2) : scores[0] > scores[1] ? 0 : 1;
  const loser = 1 - winner;
  aliveIn(room, winner).forEach((id) => room.addScore(id, 150));
  g.wins[winner]++;
  room.say(`${TRIBES[winner].name} remportent l’épreuve ! ${TRIBES[loser].name}, rendez-vous au conseil ce soir…`);
  room.enter('ileResult', { kind: d.kind, winner, scores, taps: [...d.taps.entries()], tribesAlive: TRIBES.map((t) => aliveIn(room, t.id)) });
  room.setTimer(RESULT_MS, () => (aliveIn(room, loser).length >= 2 ? startVote(room, loser) : nextEpisode(room)));
  room.sync();
}

function startVote(room, t) {
  room.enter('ileVote', { tribe: t, votes: new Map() });
  room.say(`${TRIBES[t].name}, l’heure du conseil a sonné. Votez en secret pour la personne qui doit quitter l’île.`);
  room.setTimer(VOTE_MS, () => council(room), true);
  room.sync();
}

function council(room) {
  room.clearTimer();
  const g = G(room);
  const d = room.data;
  const voters = aliveIn(room, d.tribe);
  // Vote manquant : bulletin tiré au sort parmi les autres membres de la tribu.
  voters.forEach((id) => { if (!d.votes.has(id)) d.votes.set(id, pick(voters.filter((x) => x !== id))); });
  const count = new Map();
  [...d.votes.values()].forEach((id) => count.set(id, (count.get(id) || 0) + 1));
  const max = Math.max(...count.values());
  const tied = [...count.keys()].filter((id) => count.get(id) === max);
  const outId = tied.length > 1 ? pick(tied) : tied[0];
  g.out.push(outId);
  voters.filter((id) => id !== outId).forEach((id) => room.addScore(id, 50));
  const ballots = shuffle([...d.votes.values()]).map((id) => room.pub(id));
  room.enter('ileCouncil', { tribe: d.tribe, ballots, outId, tie: tied.length > 1 });
  room.setTimer(ballots.length * COUNCIL_STEP_MS + 5_000, () => {
    room.say(`${room.players.get(outId)?.name || ''}, la tribu a parlé : tu quittes l’île… mais tu restes avec nous au jury !`);
    room.sync();
    room.setTimer(4_000, () => nextEpisode(room));
  });
  room.sync();
}

function startFinal(room) {
  const g = G(room);
  g.finalists = alive(room);
  if (g.finalists.length < 2) { endGame(room, g.finalists[0] || null); return; }
  room.enter('ileChallenge', { stage: 'ready', kind: 'hold', final: true, holding: new Map(), outAt: new Map(), taps: new Map() });
  room.say(`L’épreuve finale ! ${g.finalists.length} aventuriers sur les poteaux. Le dernier encore debout remporte l’Île des Défis !`);
  room.setTimer(READY_MS + 2_500, () => go(room), true);
  room.sync();
}

function endFinal(room) {
  const d = room.data;
  const g = G(room);
  const still = g.finalists.filter((id) => !d.outAt.has(id));
  const order = [...g.finalists].sort((a, b) => (d.outAt.get(b) || Infinity) - (d.outAt.get(a) || Infinity));
  const winner = still.length ? pick(still) : order[0];
  endGame(room, winner, order);
}

function endGame(room, winner, order = []) {
  room.clearTimer();
  const g = G(room);
  if (winner) room.addScore(winner, 600);
  if (order[1]) room.addScore(order[1], 250);
  if (winner) room.highlight('ile', 10, { emoji: '🏝️', title: 'Survivant de l’Île des Défis', body: `${room.players.get(winner)?.name || ''} remporte l’épreuve finale des poteaux !`, players: [winner] });
  room.say(winner ? `${room.players.get(winner)?.name || ''} remporte l’Île des Défis ! Quelle aventure !` : 'Fin de l’aventure !');
  room.enter('ileEnd', { winner, order, out: [...g.out] });
  room.setTimer(END_MS, () => room.finishRound());
  room.sync();
}

// ---------- vues ----------
function tribesView(room) {
  const g = G(room);
  return TRIBES.map((t) => ({ ...t, wins: g.wins[t.id], members: g.players.filter((id) => g.tribe[id] === t.id).map((id) => ({ ...room.pub(id), out: g.out.includes(id) })).filter((p) => p.id) }));
}

module.exports = {
  id: 'ile',
  title: 'L’Île des Défis',
  icon: '🏝️',
  subtitle: 'Deux tribus, des épreuves au téléphone, un conseil… et un seul survivant !',
  pitch: 'L’aventure en tribus : épreuves sur téléphone, conseil secret et finale sur les poteaux.',
  rules: 'Deux tribus s’affrontent sur des épreuves jouées au téléphone : course aux noix de coco (tapez vite !), poteaux (gardez le doigt appuyé) et défi des sages (quiz). La tribu perdante vote en secret pour éliminer l’un des siens. À la fin, les survivants s’affrontent sur les poteaux : le dernier debout gagne !',
  players: '4 à 12 joueurs',
  duration: '10 à 20 min',
  minPlayers: 4,
  phases: ['ileIntro', 'ileChallenge', 'ileResult', 'ileVote', 'ileCouncil', 'ileEnd'],
  introLine: () => 'Bienvenue sur l’Île des Défis ! Deux tribus, des épreuves, des conseils… Un seul survivant !',
  cannotPlay: (room) => (room.connectedPlayers().length < 4 ? 'L’Île des Défis se joue à 4 joueurs minimum.' : null),

  begin(room) {
    const players = shuffle(room.connectedPlayers().map((p) => p.id));
    const tribe = {};
    players.forEach((id, k) => { tribe[id] = k % 2; });
    room.ctx.ile = { players, tribe, out: [], wins: [0, 0], ep: 0, episodes: EPISODES[room.settings.length], deck: shuffle(Object.keys(CHALLENGES)).concat(shuffle(Object.keys(CHALLENGES))), finalists: [] };
    room.enter('ileIntro', {});
    room.say(`Voici les deux tribus : ${TRIBES[0].name} et ${TRIBES[1].name} ! Que l’aventure commence !`);
    room.setTimer(7_000, () => nextEpisode(room));
    room.sync();
  },

  onJoin(room, p) {
    const g = G(room);
    if (g && !g.players.includes(p.id)) { g.players.push(p.id); g.out.push(p.id); } // arrivé en cours : il rejoint le jury
  },

  check(room) {
    const d = room.data;
    if (room.phase === 'ileChallenge' && d.stage === 'go' && d.kind === 'hold') {
      (d.final ? G(room).finalists : alive(room)).forEach((id) => { if (!room.players.get(id)?.connected && !d.outAt.has(id)) d.outAt.set(id, Date.now()); });
      if (holdDecided(room)) endChallenge(room);
    } else if (room.phase === 'ileVote' && aliveIn(room, d.tribe).every((id) => d.votes.has(id))) council(room);
  },

  act(room, p, msg) {
    const g = G(room);
    const d = room.data;
    const playing = room.phase === 'ileChallenge' && d.stage === 'go' && (d.final ? g.finalists.includes(p.id) : alive(room).includes(p.id));
    if (playing && d.kind === 'tap' && msg.type === 'taps') {
      // Plafond réaliste : 16 tapes par seconde au maximum.
      const cap = Math.ceil(((Date.now() - d.goAt) / 1000) * 16);
      d.taps.set(p.id, Math.max(d.taps.get(p.id) || 0, Math.min(cap, Math.floor(Number(msg.n) || 0))));
      room.sync();
    } else if (playing && d.kind === 'hold' && msg.type === 'hold' && !d.outAt.has(p.id) && !d.holding.has(p.id)) {
      d.holding.set(p.id, Date.now());
      room.sync();
    } else if (playing && d.kind === 'hold' && msg.type === 'release' && !d.outAt.has(p.id)) {
      d.outAt.set(p.id, Date.now());
      room.say(`${p.name} lâche les poteaux !`);
      if (holdDecided(room)) { endChallenge(room); return; }
      room.sync();
    } else if (playing && d.kind === 'quiz' && msg.type === 'answer' && d.qi >= 0 && !d.answers.has(p.id) && Number.isInteger(msg.choice)) {
      d.answers.set(p.id, msg.choice);
      if (msg.choice === d.qs[d.qi].correct) d.correct.set(p.id, (d.correct.get(p.id) || 0) + 1);
      if (alive(room).every((id) => d.answers.has(id))) { room.clearTimer(); room.setTimer(800, () => nextQuiz(room)); }
      room.sync();
    } else if (room.phase === 'ileVote' && msg.type === 'vote' && aliveIn(room, d.tribe).includes(p.id) && !d.votes.has(p.id)) {
      const target = String(msg.target || '');
      if (target === p.id || !aliveIn(room, d.tribe).includes(target)) return;
      d.votes.set(p.id, target);
      if (aliveIn(room, d.tribe).every((id) => d.votes.has(id))) { council(room); return; }
      room.sync();
    }
  },

  hostView(room) {
    const g = G(room);
    const d = room.data;
    const base = { ile: { ep: g.ep, episodes: g.episodes, tribes: tribesView(room) } };
    switch (room.phase) {
      case 'ileIntro': return { ...base, key: 'ileIntro' };
      case 'ileChallenge': {
        const ch = d.final ? { icon: '🏆', title: 'L’épreuve finale : les poteaux', rule: 'Le dernier aventurier encore appuyé remporte l’Île des Défis !' } : CHALLENGES[d.kind];
        const q = d.kind === 'quiz' && d.qi >= 0 ? { index: d.qi + 1, total: d.qs.length, text: d.qs[d.qi].text, choices: d.qs[d.qi].choices, answered: [...d.answers.keys()] } : null;
        return {
          ...base, key: `ileChallenge:${g.ep}:${d.final}:${d.stage}:${d.qi}`, stage: d.stage, kind: d.kind, final: d.final, challenge: ch, q,
          taps: Object.fromEntries(d.taps), holding: [...d.holding.keys()], out: [...d.outAt.keys()], finalists: d.final ? g.finalists.map((id) => room.pub(id)) : null,
        };
      }
      case 'ileResult': return { ...base, key: `ileResult:${g.ep}`, kind: d.kind, winner: d.winner, scores: d.scores, challenge: CHALLENGES[d.kind] };
      case 'ileVote': return { ...base, key: `ileVote:${g.ep}`, tribe: d.tribe, voted: [...d.votes.keys()] };
      case 'ileCouncil': return { ...base, key: `ileCouncil:${g.ep}`, tribe: d.tribe, ballots: d.ballots, outPlayer: room.pub(d.outId), tie: d.tie, stepMs: COUNCIL_STEP_MS };
      default: return { ...base, key: 'ileEnd', winner: d.winner ? room.pub(d.winner) : null, order: d.order.map((id) => room.pub(id)).filter(Boolean) };
    }
  },

  playerView(room, p) {
    const g = G(room);
    const d = room.data;
    const myTribe = TRIBES[g.tribe[p.id]] || null;
    const isOut = g.out.includes(p.id);
    const base = { ile: { ep: g.ep, episodes: g.episodes, tribe: myTribe, out: isOut } };
    switch (room.phase) {
      case 'ileIntro': return { ...base, key: 'ileIntro', mates: g.players.filter((id) => g.tribe[id] === g.tribe[p.id] && id !== p.id).map((id) => room.pub(id)).filter(Boolean) };
      case 'ileChallenge': {
        const playing = d.final ? g.finalists.includes(p.id) : !isOut;
        const ch = d.final ? { icon: '🏆', title: 'L’épreuve finale : les poteaux' } : CHALLENGES[d.kind];
        const q = d.kind === 'quiz' && d.qi >= 0 ? { index: d.qi + 1, total: d.qs.length, text: d.qs[d.qi].text, choices: d.qs[d.qi].choices } : null;
        return {
          ...base, key: `ileChallenge:${g.ep}:${d.final}:${d.stage}:${d.qi}:${playing}`, stage: d.stage, kind: d.kind, final: d.final, challenge: ch, playing, q,
          myAnswer: d.answers?.has(p.id) ? d.answers.get(p.id) : null, myTaps: d.taps.get(p.id) || 0, holdOut: d.outAt.has(p.id), holding: d.holding.has(p.id),
          stillHolding: (d.final ? g.finalists : alive(room)).filter((id) => d.holding.has(id) && !d.outAt.has(id)).length,
        };
      }
      case 'ileResult': return { ...base, key: `ileResult:${g.ep}`, won: myTribe && d.winner === myTribe.id && !isOut, winnerTribe: TRIBES[d.winner] };
      case 'ileVote': {
        const voter = !isOut && g.tribe[p.id] === d.tribe;
        return { ...base, key: `ileVote:${g.ep}:${d.votes.has(p.id)}`, voter, voted: d.votes.has(p.id), tribeVoting: TRIBES[d.tribe],
          candidates: voter ? aliveIn(room, d.tribe).filter((id) => id !== p.id).map((id) => room.pub(id)) : [] };
      }
      case 'ileCouncil': return { ...base, key: `ileCouncil:${g.ep}`, outPlayer: room.pub(d.outId), iAmOut: d.outId === p.id, tribeVoting: TRIBES[d.tribe], stepMs: COUNCIL_STEP_MS, ballots: d.ballots.length };
      default: return { ...base, key: 'ileEnd', winner: d.winner ? room.pub(d.winner) : null, iWon: d.winner === p.id };
    }
  },
};

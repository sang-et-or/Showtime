// Jeu télé « Le Grand Sondage » (inspiré des jeux de sondage en famille) : « Nous avons demandé à 100 personnes… ».
// Tout le monde tape ses réponses en même temps ; chaque réponse du tableau découverte rapporte ses points
// à celui qui l'a trouvée en premier. Attention aux croix : 4 essais par question !
const { SONDAGE } = require('../content/tvgames');
const { shuffle, norm, sanitizeText } = require('../util');

const ASK_MS = 45_000;
const REVEAL_MS = 7_000;
const TRIES = 4;
const COUNT = { short: 3, normal: 5, long: 7 };

const words = (t) => ` ${norm(t).split(' ').map((w) => w.replace(/(S|X)$/, '')).join(' ')} `;

/** Indice de la réponse du tableau correspondant à la proposition (ou -1). */
function match(item, text) {
  const t = words(text);
  return item.a.findIndex(([label, , ...alts]) => [label, ...alts].some((alt) => {
    const a = words(alt).trim();
    return a.length >= 2 && t.includes(` ${a} `);
  }));
}

function nextQuestion(room) {
  const g = room.ctx.sondage;
  g.i++;
  if (g.i >= g.items.length) { room.finishRound(); return; }
  room.enter('sdAsk', { index: g.i + 1, total: g.items.length, item: g.items[g.i], found: new Map(), tries: new Map(), strikes: [], last: new Map() });
  room.say(`Nous avons demandé à 100 personnes : ${g.items[g.i].q.toLowerCase()}… À vos téléphones !`);
  room.setTimer(ASK_MS, () => reveal(room), true);
  room.sync();
}

function reveal(room) {
  room.clearTimer();
  const d = room.data;
  room.say(d.found.size === d.item.a.length ? 'Tableau complet ! Bravo à tous !' : 'Voyons ce qui se cachait encore au tableau…');
  room.enter('sdReveal', { ...d });
  room.setTimer(REVEAL_MS, () => nextQuestion(room));
  room.sync();
}

const allDone = (room) => room.data.found.size === room.data.item.a.length
  || room.connectedPlayers().every((p) => (room.data.tries.get(p.id) || 0) >= TRIES);

function board(room, all) {
  const d = room.data;
  return d.item.a.map(([label, pts], k) => {
    const f = d.found.get(k);
    return f || all ? { k, label, pts, by: f ? room.pub(f) : null } : { k, label: null, pts: null, by: null };
  });
}

module.exports = {
  id: 'sondage',
  title: 'Le Grand Sondage',
  icon: '📊',
  subtitle: 'Nous avons demandé à 100 personnes… Trouvez les réponses les plus populaires !',
  pitch: 'Devinez les réponses préférées du public. Chaque bonne réponse découverte rapporte ses points !',
  rules: 'Une question de sondage s’affiche (notre sondage imaginaire auprès de 100 personnes). Tapez vos réponses sur le téléphone : la première personne qui découvre une réponse du tableau remporte ses points. 4 essais par question, attention aux croix !',
  players: '1 à 12 joueurs',
  duration: '5 à 10 min',
  minPlayers: 1,
  phases: ['sdAsk', 'sdReveal'],
  introLine: () => 'Bienvenue au Grand Sondage ! Nous avons interrogé 100 personnes… Saurez-vous trouver leurs réponses ?',

  begin(room) {
    room.ctx.sondage = { i: -1, items: shuffle(SONDAGE).slice(0, COUNT[room.settings.length]) };
    nextQuestion(room);
  },

  check(room) { if (room.phase === 'sdAsk' && allDone(room)) reveal(room); },

  act(room, p, msg) {
    const d = room.data;
    if (room.phase !== 'sdAsk' || msg.type !== 'answer') return;
    const used = d.tries.get(p.id) || 0;
    if (used >= TRIES) return;
    const text = sanitizeText(msg.text, 40);
    if (!text) return;
    d.tries.set(p.id, used + 1);
    const k = match(d.item, text);
    if (k >= 0 && !d.found.has(k)) {
      d.found.set(k, p.id);
      room.addScore(p.id, d.item.a[k][1] * 10);
      d.last.set(p.id, { ok: true, text: d.item.a[k][0], pts: d.item.a[k][1] * 10 });
      if (k === 0) room.highlight('sondage', d.item.a[k][1], { emoji: '📊', title: 'La réponse n°1', body: `${p.name} trouve la réponse préférée du public : « ${d.item.a[k][0]} » !`, players: [p.id] });
    } else if (k >= 0) {
      d.last.set(p.id, { ok: false, already: true, text: d.item.a[k][0] });
    } else {
      d.strikes.push({ who: room.publicPlayer(p), text });
      d.last.set(p.id, { ok: false, text });
    }
    if (allDone(room)) { reveal(room); return; }
    room.sync();
  },

  hostView(room) {
    const d = room.data;
    const base = { sd: { index: d.index, total: d.total, q: d.item.q, tries: TRIES } };
    if (room.phase === 'sdAsk') return { ...base, key: `sdAsk:${d.index}`, board: board(room, false), strikes: d.strikes.slice(-6) };
    return { ...base, key: `sdReveal:${d.index}`, board: board(room, true) };
  },

  playerView(room, p) {
    const d = room.data;
    const base = { sd: { index: d.index, total: d.total, q: d.item.q, tries: TRIES } };
    if (room.phase === 'sdAsk') {
      return { ...base, key: `sdAsk:${d.index}`, board: board(room, false), left: TRIES - (d.tries.get(p.id) || 0), last: d.last.get(p.id) || null };
    }
    const mine = [...d.found.entries()].filter(([, id]) => id === p.id).reduce((s, [k]) => s + d.item.a[k][1] * 10, 0);
    return { ...base, key: `sdReveal:${d.index}`, board: board(room, true), mine };
  },
};

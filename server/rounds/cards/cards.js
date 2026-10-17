// Outils communs aux jeux de cartes : paquets, mélange, tours de jeu, évaluateur de mains de poker.
const { shuffle } = require('../../util');

const SUITS = ['S', 'H', 'D', 'C']; // pique, cœur, carreau, trèfle
const RANKS52 = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANKS32 = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

/** Un paquet mélangé. Chaque carte : { r: 'A', s: 'H', id: 'AH' } (id unique même avec plusieurs paquets). */
function deck(ranks = RANKS52, copies = 1) {
  const cards = [];
  for (let k = 0; k < copies; k++) {
    for (const s of SUITS) for (const r of ranks) cards.push({ r, s, id: `${r}${s}${copies > 1 ? `.${k}` : ''}` });
  }
  return shuffle(cards);
}

const pub = (c) => (c ? { r: c.r, s: c.s, id: c.id } : null);
const rank52 = (c) => RANKS52.indexOf(c.r); // 2 → 0 … As → 12

/** Prochain siège (dans l'ordre des places) qui remplit la condition, après `from`. -1 si aucun. */
function nextSeat(count, from, ok, dir = 1) {
  for (let k = 1; k <= count; k++) {
    const s = (((from + dir * k) % count) + count) % count;
    if (ok(s)) return s;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Évaluateur de poker : meilleure main de 5 cartes parmi 5 à 7.
// Retourne { score: [catégorie, départages…], name } ; on compare les scores avec compareScore.
// ---------------------------------------------------------------------------
const HAND_NAMES = ['Carte haute', 'Paire', 'Double paire', 'Brelan', 'Quinte', 'Couleur', 'Full', 'Carré', 'Quinte flush'];

function eval5(cards) {
  const v = cards.map((c) => rank52(c) + 2).sort((a, b) => b - a); // 2 … 14
  const flush = cards.every((c) => c.s === cards[0].s);
  const uniq = [...new Set(v)];
  let straightHigh = 0;
  if (uniq.length === 5) {
    if (v[0] - v[4] === 4) straightHigh = v[0];
    else if (v[0] === 14 && v[1] === 5) straightHigh = 5; // A-2-3-4-5
  }
  const counts = new Map();
  v.forEach((x) => counts.set(x, (counts.get(x) || 0) + 1));
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const byGroup = groups.map((g) => g[0]);
  if (straightHigh && flush) return [8, straightHigh];
  if (groups[0][1] === 4) return [7, ...byGroup];
  if (groups[0][1] === 3 && groups[1][1] === 2) return [6, ...byGroup];
  if (flush) return [5, ...v];
  if (straightHigh) return [4, straightHigh];
  if (groups[0][1] === 3) return [3, ...byGroup];
  if (groups[0][1] === 2 && groups[1][1] === 2) return [2, ...byGroup];
  if (groups[0][1] === 2) return [1, ...byGroup];
  return [0, ...v];
}

function compareScore(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] || 0) - (b[i] || 0);
    if (d) return d;
  }
  return 0;
}

function bestHand(cards) {
  let best = null; let bestCards = null;
  const n = cards.length;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) for (let e = d + 1; e < n; e++) {
    const five = [cards[a], cards[b], cards[c], cards[d], cards[e]];
    const s = eval5(five);
    if (!best || compareScore(s, best) > 0) { best = s; bestCards = five; }
  }
  return { score: best, name: HAND_NAMES[best[0]], cards: bestCards };
}

module.exports = { SUITS, RANKS52, RANKS32, deck, pub, rank52, nextSeat, bestHand, compareScore, HAND_NAMES };

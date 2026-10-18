// Écrans télé des jeux de plateau (vague 2) : Petits Chevaux, Roue des Savoirs,
// Chemin de la Vie, Fin de Mois. Les plateaux restent affichés d'un tour à l'autre :
// seuls les pions bougent, pour que l'on suive l'action.
/* global h, avatarEl, SHAPES, SFX, later, fmt, VIEWS, state */

const SEAT_COLORS = ['#ef4444', '#22c55e', '#eab308', '#3b82f6'];
const CAT_COLORS = { culture: '#8b5cf6', musique: '#ec4899', cinema: '#06b6d4', sport: '#f97316', foot: '#22c55e' };
const mmss = (ms) => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/** Gros dé animé : roule un instant puis s'arrête sur la valeur. */
function diceEl() {
  const el = h('div', { class: 'dice-big', text: '🎲' });
  let last = null;
  return {
    el,
    show(value, key) {
      if (value == null) { el.textContent = '🎲'; el.classList.remove('rolled'); last = null; return; }
      if (key === last) return;
      last = key;
      SFX.drumroll(0.5);
      let n = 0;
      const spin = setInterval(() => { el.textContent = String(1 + Math.floor(Math.random() * 6)); if (++n > 7) { clearInterval(spin); el.textContent = String(value); el.classList.add('rolled'); SFX.pop(); } }, 70);
    },
  };
}

function sideRow(p, active, extra) {
  if (!p) return '';
  return h('div', { class: `side-row${active ? ' active' : ''}` }, avatarEl(p, 'sm'), h('div', { class: 'side-txt' }, h('b', { text: p.name }), h('small', {}, ...[].concat(extra))));
}

// =====================================================================
// Petits Chevaux
// =====================================================================
const LUDO_PATH = (() => {
  const p = [];
  for (let c = 1; c <= 5; c++) p.push([6, c]);
  for (let r = 5; r >= 0; r--) p.push([r, 6]);
  p.push([0, 7]);
  for (let r = 0; r <= 5; r++) p.push([r, 8]);
  for (let c = 9; c <= 14; c++) p.push([6, c]);
  p.push([7, 14]);
  for (let c = 14; c >= 9; c--) p.push([8, c]);
  for (let r = 9; r <= 14; r++) p.push([r, 8]);
  p.push([14, 7]);
  for (let r = 14; r >= 9; r--) p.push([r, 6]);
  for (let c = 5; c >= 0; c--) p.push([8, c]);
  p.push([7, 0]);
  p.push([6, 0]);
  return p;
})();
const LUDO_START = [0, 13, 26, 39];
const LUDO_HOME = [
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]], [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]], [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
];
const LUDO_YARD = [[0, 0], [0, 9], [9, 9], [9, 0]];
const LUDO_SLOTS = [[1.5, 1.5], [1.5, 3.5], [3.5, 1.5], [3.5, 3.5]];
const LUDO_FINISH = [[7, 6], [6, 7], [7, 8], [8, 7]];

function ludoCell(seat, prog, h) {
  if (prog < 0) { const [r0, c0] = LUDO_YARD[seat]; const [dr, dc] = LUDO_SLOTS[h % 4]; return [r0 + dr, c0 + dc]; }
  if (prog <= 50) return LUDO_PATH[(LUDO_START[seat] + prog) % 52];
  if (prog < 56) return LUDO_HOME[seat][prog - 51];
  return LUDO_FINISH[seat];
}

function ludoBoard() {
  const board = h('div', { class: 'ludo-board' });
  const place = (el, r, c, rs = 1, cs = 1) => { el.style.gridRow = `${r + 1} / span ${rs}`; el.style.gridColumn = `${c + 1} / span ${cs}`; board.append(el); };
  LUDO_YARD.forEach(([r, c], s) => place(h('div', { class: 'ludo-yard', style: `--c:${SEAT_COLORS[s]}` }), r, c, 6, 6));
  LUDO_PATH.forEach(([r, c], i) => {
    const s = LUDO_START.indexOf(i);
    place(h('div', { class: `ludo-cell${s >= 0 ? ' start' : ''}`, style: s >= 0 ? `--c:${SEAT_COLORS[s]}` : '', text: s >= 0 ? '★' : '' }), r, c);
  });
  LUDO_HOME.forEach((cells, s) => cells.forEach(([r, c]) => place(h('div', { class: 'ludo-cell lhome', style: `--c:${SEAT_COLORS[s]}` }), r, c)));
  place(h('div', { class: 'ludo-center', text: '🏁' }), 6, 6, 3, 3);
  const pawns = h('div', { class: 'ludo-pawns' });
  board.append(pawns);
  return { board, pawns };
}

Object.assign(VIEWS, {
  ludoPlay(root, s) {
    SFX.whoosh();
    const { board, pawns } = ludoBoard();
    const dice = diceEl();
    const turnBox = h('div', { class: 'turn-box' });
    const side = h('div', { class: 'side-list' });
    const clock = h('div', { class: 'game-clock' });
    root.append(h('div', { class: 'board-layout' },
      h('div', { class: 'board-wrap square' }, board),
      h('div', { class: 'board-side' }, turnBox, dice.el, side, clock)));
    const pawnEls = new Map();
    let lastSeq = null;
    return {
      update(st) {
        const L = st.ludo;
        const cur = L.seats[L.turn];
        // pions : on garde les mêmes éléments pour que le déplacement soit animé
        const seen = new Set();
        const stack = new Map();
        L.seats.forEach((seat) => seat.horses.forEach((prog, hIdx) => {
          const key = `${seat.color}:${hIdx}`;
          seen.add(key);
          const [r, c] = ludoCell(seat.color, prog, hIdx);
          const sk = `${r},${c}`; const n = stack.get(sk) || 0; stack.set(sk, n + 1);
          let el = pawnEls.get(key);
          if (!el) {
            el = h('div', { class: 'pawn', style: `--c:${SEAT_COLORS[seat.color]}` }, h('span', { text: seat.player?.avatar || '🐴' }));
            pawnEls.set(key, el); pawns.append(el);
          }
          el.style.left = `${((c + n * 0.18) / 15) * 100}%`;
          el.style.top = `${((r - n * 0.18) / 15) * 100}%`;
          const choosable = L.stage === 'choose' && seat.color === L.turn && L.options.some((o) => o.h === hIdx);
          el.classList.toggle('choosable', choosable);
          el.classList.toggle('mine-turn', seat.color === L.turn);
        }));
        for (const [k, el] of pawnEls) if (!seen.has(k)) { el.remove(); pawnEls.delete(k); }

        if (L.seq !== lastSeq) {
          lastSeq = L.seq;
          if (L.stage === 'move' && L.lastMove?.caught?.length) { SFX.wrong(); later(200, () => SFX.applause(1.2)); }
          else if (L.stage === 'move') SFX.tap();
        }
        dice.show(L.stage === 'roll' ? null : L.dice, `${L.seq}:${L.dice}`);
        turnBox.replaceChildren(
          cur ? avatarEl(cur.player, '') : '',
          h('div', {}, h('small', { text: 'À toi de jouer' }), h('b', { style: `color:${SEAT_COLORS[L.turn]}`, text: cur ? `${cur.player?.name} (${cur.colorName})` : '' }),
            h('small', { text: L.stage === 'roll' ? '📱 Lance le dé sur ton téléphone' : L.stage === 'choose' ? '📱 Choisis ton cheval' : L.stage === 'nomove' ? 'Aucun cheval ne peut bouger…' : '' })));
        side.replaceChildren(...L.seats.map((seat) => {
          const box = seat.horses.filter((x) => x < 0).length; const home = seat.horses.filter((x) => x === 56).length;
          if (!seat.player) return '';
          const row = sideRow(seat.player, seat.color === L.turn, [`🏠 ${box} · 🏁 ${home}/${seat.horses.length}`, seat.captures ? ` · 💥 ${seat.captures}` : '']);
          row.style.setProperty('--c', SEAT_COLORS[seat.color]);
          row.classList.add('colored');
          return row;
        }));
        clock.textContent = `⏱ ${mmss(L.endsInMs)} restantes`;
      },
    };
  },

  ludoEnd(root, s) {
    SFX.fanfare(); SFX.applause(2);
    root.append(endTable('🐴 Arrivée de la course', s.rows.map((r) => ({
      player: r.player, main: r.winner ? '🏆 Vainqueur' : `🏁 ${r.home} rentré${r.home > 1 ? 's' : ''}`, sub: r.captures ? `💥 ${r.captures} capture${r.captures > 1 ? 's' : ''}` : '', points: r.points,
    }))));
  },
});

// =====================================================================
// La Roue des Savoirs
// =====================================================================
function roueRing(R, s) {
  const ring = h('div', { class: 'roue-ring' });
  R.board.forEach((sq, i) => {
    const a = (i / R.board.length) * 360 - 90;
    const el = h('div', { class: `roue-sq${sq.star ? ' star' : ''}`, style: `--c:${CAT_COLORS[sq.cat]};--a:${a}deg`, title: s.categories[sq.cat].label },
      h('span', { text: sq.star ? '⭐' : s.categories[sq.cat].icon }));
    ring.append(el);
  });
  return ring;
}

function roueSide(R) {
  return h('div', { class: 'side-list' }, ...R.seats.map((seat, i) => sideRow(seat.player, i === R.turn,
    [h('span', { class: 'stars-line' }, ...R.cats.map((c) => h('i', { class: seat.stars.includes(c) ? 'on' : '', style: `--c:${CAT_COLORS[c]}` }))), ` ${seat.stars.length}/${R.target}`])));
}

Object.assign(VIEWS, {
  rouePlay(root, s) {
    SFX.whoosh();
    const ringWrap = h('div', { class: 'board-wrap square roue-wrap' });
    const pawns = h('div', { class: 'ludo-pawns' });
    const center = h('div', { class: 'roue-center' });
    const dice = diceEl();
    const sideBox = h('div');
    const clock = h('div', { class: 'game-clock' });
    ringWrap.append(roueRing(s.roue, s), pawns, center);
    root.append(h('div', { class: 'board-layout' }, ringWrap, h('div', { class: 'board-side' }, dice.el, sideBox, clock)));
    const pawnEls = new Map();
    return {
      update(st) {
        const R = st.roue;
        const cur = R.seats[R.turn];
        R.seats.forEach((seat, i) => {
          if (!seat.player) return;
          let el = pawnEls.get(seat.player.id);
          if (!el) { el = h('div', { class: 'pawn round', style: `--c:${seat.player.color}` }, h('span', { text: seat.player.avatar })); pawnEls.set(seat.player.id, el); pawns.append(el); }
          const n = R.board.length;
          const off = (i % 4) * 0.035 - 0.05;
          if (seat.pos < 0) { el.style.left = `${46 + (i % 4) * 3}%`; el.style.top = `${60 + Math.floor(i / 4) * 5}%`; } else {
            const ang = ((seat.pos / n) * 360 - 90) * (Math.PI / 180);
            const rad = 0.40 - off;
            el.style.left = `${(0.5 + rad * Math.cos(ang)) * 100 - 3.5}%`;
            el.style.top = `${(0.5 + rad * Math.sin(ang)) * 100 - 3.5}%`;
          }
          el.classList.toggle('mine-turn', i === R.turn);
        });
        dice.show(st.stage === 'roll' ? null : st.dice, `${R.seq}:${st.dice}`);
        center.replaceChildren(h('div', { class: 'roue-logo', text: '🎡' }), cur ? avatarEl(cur.player, '') : '',
          h('b', { text: cur ? `À ${cur.player.name} !` : '' }), h('small', { text: st.stage === 'roll' ? '📱 Lance le dé sur ton téléphone' : 'En route…' }));
        sideBox.replaceChildren(roueSide(R));
        clock.textContent = `⏱ ${mmss(R.endsInMs)} restantes · ${R.target} étoiles pour gagner`;
      },
    };
  },

  roueQ(root, s) {
    SFX.whoosh();
    const cat = s.categories[s.q.cat];
    const strip = h('div', { class: 'answered-strip' });
    root.append(
      h('div', { class: 'q-head' },
        h('span', { class: 'chip', style: `box-shadow:inset 0 0 0 2px ${CAT_COLORS[s.q.cat]}`, text: `${cat.icon} ${cat.label}` }),
        h('span', { class: 'count', text: `Question pour ${s.active.name}` }),
        s.star ? h('span', { class: 'chip on', text: '⭐ Étoile en jeu !' }) : ''),
      h('div', { class: 'q-text', text: s.q.text }),
      h('div', { class: 'answers' }, ...s.q.choices.map((c, i) => h('div', { class: `answer c${i}` }, h('span', { class: 'shape', text: SHAPES[i] }), h('span', { text: c })))),
      h('p', { class: 'spot-sub', style: 'text-align:center;margin-top:.6em', text: `📱 Tout le monde peut répondre (+100), mais seul·e ${s.active.name} avance !` }),
      strip);
    return {
      update(st, prev) {
        const done = new Set(st.answered);
        if (prev && prev.answered && st.answered.length > prev.answered.length) SFX.blip();
        const online = st.players.filter((p) => p.connected);
        strip.replaceChildren(h('span', { class: 'label', text: `${done.size} / ${online.length} ont répondu` }),
          ...online.map((p) => { const a = avatarEl(p, 'sm'); if (!done.has(p.id)) a.classList.add('wait'); return a; }));
      },
    };
  },

  roueA(root, s) {
    (s.ok ? SFX.correct : SFX.wrong)();
    if (s.wonStar) later(300, () => { SFX.fanfare(); SFX.applause(2); });
    root.append(
      h('div', { class: 'q-text', style: 'animation:none;font-size:1.9em', text: s.q.text }),
      h('div', { class: 'answers' }, ...s.q.choices.map((c, i) => h('div', { class: `answer c${i}${i === s.correct ? ' good' : ' dim'}`, style: 'animation:none' },
        h('span', { class: 'shape', text: i === s.correct ? '✓' : SHAPES[i] }), h('span', { text: c })))),
      h('div', { class: 'spot', style: 'margin-top:.8em' },
        h('h1', { class: 'spot-title', style: 'font-size:2em', text: s.wonStar ? `⭐ ${s.active.name} gagne l’étoile !` : s.ok ? `✓ ${s.active.name} rejoue !` : `✗ Raté pour ${s.active.name}` }),
        h('div', { class: 'votes-list' }, ...s.results.filter((r) => r.correct && r.player).map((r) => h('div', { class: 'vote-pill ok' }, avatarEl(r.player, 'sm'), h('span', { text: `${r.player.name} +${r.gained}` }))))));
  },

  roueEnd(root, s) {
    SFX.fanfare(); SFX.applause(2);
    root.append(endTable('🎡 Les maîtres du savoir', s.rows.map((r) => ({
      player: r.player, main: r.winner ? '🏆 Toutes les étoiles !' : `⭐ ${r.stars.length} étoile${r.stars.length > 1 ? 's' : ''}`, sub: '', points: null,
    }))));
  },
});

// =====================================================================
// Le Chemin de la Vie : vrai plateau en perspective, route sinueuse et pions qui avancent case par case
// =====================================================================
const V3 = { W: 100, H: 90, rows: [78, 57, 36, 15], x0: 10, x1: 90, tilt: 48, wheelDelay: 1700, stepMs: 330 };

/** Points régulièrement espacés le long d'une route en serpentin (départ devant, retraite au fond). */
function viePath(n) {
  const fine = [];
  const r = (V3.rows[0] - V3.rows[1]) / 2;
  V3.rows.forEach((y, k) => {
    const ltr = k % 2 === 0;
    for (let t = 0; t <= 40; t++) fine.push([ltr ? V3.x0 + (V3.x1 - V3.x0) * t / 40 : V3.x1 - (V3.x1 - V3.x0) * t / 40, y]);
    if (k < V3.rows.length - 1) { // virage en demi-cercle vers la rangée suivante
      const cx = ltr ? V3.x1 : V3.x0;
      for (let t = 1; t < 24; t++) {
        const a = Math.PI / 2 + (Math.PI * t) / 24;
        fine.push([cx + (ltr ? -1 : 1) * r * Math.cos(a), y - r - r * Math.sin(a)]);
      }
    }
  });
  const acc = [0];
  for (let i = 1; i < fine.length; i++) acc.push(acc[i - 1] + Math.hypot(fine[i][0] - fine[i - 1][0], fine[i][1] - fine[i - 1][1]));
  const total = acc[acc.length - 1];
  const out = [];
  for (let k = 0, j = 1; k < n; k++) {
    const d = (total * k) / (n - 1);
    while (j < fine.length - 1 && acc[j] < d) j++;
    const f = (d - acc[j - 1]) / (acc[j] - acc[j - 1] || 1);
    out.push([fine[j - 1][0] + (fine[j][0] - fine[j - 1][0]) * f, fine[j - 1][1] + (fine[j][1] - fine[j - 1][1]) * f]);
  }
  return { pts: out, fine };
}

/** Roue de la vie numérotée de 1 à 10, qui tourne et s'arrête sous le repère. */
function lifeWheel() {
  const COLORS = ['#ff3d8b', '#22d3ee', '#facc15', '#a3e635', '#c084fc', '#fb923c', '#60a5fa', '#f472b6', '#34d399', '#fde047'];
  const disc = h('div', { class: 'lw-disc', style: `background:conic-gradient(${COLORS.map((c, i) => `${c} ${i * 36}deg ${(i + 1) * 36}deg`).join(',')})` },
    ...COLORS.map((_, i) => h('b', { style: `--a:${i * 36 + 18}deg`, text: String(i + 1) })));
  const el = h('div', { class: 'life-wheel' }, h('i', { class: 'lw-pin' }), disc, h('div', { class: 'lw-hub', text: '🛤️' }));
  let angle = 0; let last = null;
  return {
    el,
    show(value, key) {
      if (value == null) { el.classList.remove('rolled'); last = null; return; }
      if (key === last) return;
      last = key;
      SFX.drumroll(1.2);
      const target = 360 - ((value - 1) * 36 + 18); // le numéro tiré s'arrête en haut, sous le repère
      angle += 360 * 4 + ((target - (angle % 360)) + 360) % 360;
      disc.style.transform = `rotate(${angle}deg)`;
      setTimeout(() => { el.classList.add('rolled'); SFX.pop(); }, V3.wheelDelay - 200);
    },
  };
}

function vieScene(T) {
  const { pts, fine } = viePath(T.board.length);
  const plane = h('div', { class: 'v3-plane', style: `--tilt:${V3.tilt}deg` });
  const stage = h('div', { class: 'v3-stage' }, plane);
  const pct = ([x, y]) => `left:${x}%;top:${(y / V3.H) * 100}%`;
  // La route (SVG généré ici à partir de nos propres coordonnées).
  const d = fine.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
  const road = h('div', { class: 'v3-road' });
  road.innerHTML = `<svg viewBox="0 0 ${V3.W} ${V3.H}" preserveAspectRatio="none" aria-hidden="true">
    <path d="${d}" fill="none" stroke="#f8fafc" stroke-width="10.4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="#3f4352" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="#facc15" stroke-width="0.45" stroke-dasharray="1.6 1.6"/></svg>`;
  plane.append(h('i', { class: 'v3-edge' }), road);
  // Décor : arbres, maisons, montagnes… debout, à l'écart de la route.
  const DECOR = ['🌳', '🌲', '🏡', '🌻', '🐄', '🌳', '⛪', '🏫', '🌲', '🏥', '🌷', '🏢', '🐑', '🌳'];
  let seed = 7;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let k = 0; k < 70; k++) {
    const x = 3 + rnd() * 94; const y = 3 + rnd() * 84;
    if (fine.some(([fx, fy]) => Math.hypot(fx - x, fy - y) < 8)) continue;
    plane.append(h('div', { class: 'v3-bb v3-decor', style: `${pct([x, y])};--s:${(0.8 + rnd() * 0.6).toFixed(2)}`, text: DECOR[k % DECOR.length] }));
  }
  plane.append(h('div', { class: 'v3-bb v3-decor big', style: `${pct([96, 6])};--s:1.6`, text: '⛰️' }), h('div', { class: 'v3-bb v3-decor big', style: `${pct([5, 5])};--s:1.4`, text: '🏰' }));
  // Les cases, et un panneau debout pour les étapes importantes de la vie.
  const tiles = T.board.map((sq, i) => {
    const t = h('div', { class: `v3-tile t-${sq.type}`, style: pct(pts[i]) }, h('span', { text: sq.icon }), h('small', { text: String(i) }));
    plane.append(t);
    if (sq.type !== 'event' && sq.type !== 'paie') plane.append(h('div', { class: `v3-bb v3-sign t-${sq.type}`, style: pct([pts[i][0], pts[i][1] - 4.6]) }, h('b', { text: `${sq.icon} ${sq.label}` })));
    return t;
  });
  fitPlane(stage, plane, 1.3);
  return { el: stage, update: pawnLayer(plane, pts, V3.H, tiles, V3.wheelDelay) };
}

/** Le plateau prend toute la place disponible (unité --u = 1 % de sa largeur). */
function fitPlane(stage, plane, ratio) {
  new ResizeObserver(() => {
    const w = Math.max(10, Math.min(stage.clientWidth * 0.84, stage.clientHeight > 60 ? stage.clientHeight * ratio : Infinity));
    plane.style.setProperty('--pw', `${w}px`);
    plane.style.setProperty('--u', `${w / 100}px`);
  }).observe(stage);
}

/** Pions debout qui avancent case par case (commun aux plateaux en perspective). */
function pawnLayer(plane, pts, H, tiles, delay) {
  const pawns = new Map(); // id → { el, shown, timers }
  function placePawn(p, pos, slot) {
    const [x, y] = pts[pos];
    const a = (slot * 2.4);
    p.el.style.left = `${x + (slot ? Math.cos(a) * 2.2 : 0)}%`;
    p.el.style.top = `${((y + (slot ? Math.sin(a) * 1.6 : 0)) / H) * 100}%`;
  }
  return function update(st, cur) {
      const TT = st.track;
      const slots = new Map();
      TT.seats.forEach((seat) => {
        if (!seat.player) return;
        let p = pawns.get(seat.player.id);
        if (!p) {
          p = { el: h('div', { class: 'v3-bb v3-pawn', style: `--c:${seat.player.color}` }, h('div', { class: 'peg' }, h('span', { text: seat.player.avatar }), h('i'))), shown: seat.pos, timers: [] };
          pawns.set(seat.player.id, p); plane.append(p.el);
        }
        p.el.classList.toggle('mine-turn', seat.player.id === cur?.player.id);
        const slot = slots.get(seat.pos) || 0; slots.set(seat.pos, slot + 1);
        if (seat.pos > p.shown && st.stage === 'move') {
          // Le pion avance case par case, après l'arrêt de la roue.
          p.timers.forEach(clearTimeout); p.timers = [];
          const from = p.shown; const to = seat.pos;
          p.shown = to;
          for (let k = from + 1; k <= to; k++) {
            p.timers.push(setTimeout(() => {
              placePawn(p, k, 0);
              p.el.classList.remove('hop'); void p.el.offsetWidth; p.el.classList.add('hop');
              tiles[k].classList.add('lit'); setTimeout(() => tiles[k].classList.remove('lit'), 500);
              SFX.blip();
            }, delay + (k - from - 1) * V3.stepMs));
          }
          p.timers.push(setTimeout(() => { placePawn(p, to, slot); p.timers = []; }, delay + (to - from) * V3.stepMs + 150));
        } else if (seat.pos !== p.shown || !p.timers.length) {
          p.timers.forEach(clearTimeout); p.timers = [];
          p.shown = seat.pos;
          placePawn(p, seat.pos, slot);
        }
      });
  };
}

// =====================================================================
// Fin de Mois : le calendrier du mois posé sur un plateau de jeu, vu en hauteur
// =====================================================================
const M3 = { H: 82, x0: 5, x1: 95, y0: 24, y1: 78, cols: 7, rows: 5, diceDelay: 900 };
const MOIS_DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

function moisScene(T) {
  const plane = h('div', { class: 'v3-plane m3-plane', style: `--tilt:44deg;aspect-ratio:100/${M3.H}` });
  const stage = h('div', { class: 'v3-stage' }, plane);
  const cw = (M3.x1 - M3.x0) / M3.cols;
  const ch = (M3.y1 - M3.y0) / M3.rows;
  const pct = ([x, y]) => `left:${x}%;top:${(y / M3.H) * 100}%`;
  // Case 0 = « Début du mois », posée en haut à gauche ; jours 1 à 31 rangés comme un vrai calendrier.
  const pts = T.board.map((sq, i) => (i === 0 ? [M3.x0 + cw * 0.9, 9] : [M3.x0 + cw * (((i - 1) % 7) + 0.5), M3.y0 + ch * (Math.floor((i - 1) / 7) + 0.5)]));
  const potBox = h('div', { class: 'm3-pots' });
  plane.append(h('i', { class: 'v3-edge m3-edge' }),
    h('div', { class: 'm3-title', style: pct([60, 9]) }, h('b', { text: '📅 FIN DE MOIS' }), potBox),
    ...MOIS_DAYS.map((d, k) => h('div', { class: `m3-wd${k >= 5 ? ' we' : ''}`, style: `${pct([M3.x0 + cw * (k + 0.5), M3.y0 - 2.6])};width:calc(var(--u) * ${cw - 0.8})`, text: d })));
  const tiles = T.board.map((sq, i) => {
    const size = i === 0 ? `width:calc(var(--u) * ${cw * 1.5});height:calc(var(--u) * ${ch * 1.15})` : `width:calc(var(--u) * ${cw - 0.8});height:calc(var(--u) * ${ch - 0.8})`;
    const t = h('div', { class: `m3-tile t-${sq.type}`, style: `${pct(pts[i])};${size}` },
      h('b', { class: 'm3-day', text: i === 0 ? '' : String(sq.day) }), h('span', { text: sq.icon }), h('small', { text: i === 0 ? 'Début du mois' : sq.label }));
    plane.append(t);
    return t;
  });
  // Décor posé sur le plateau : la banque, la tirelire, des billets, le courrier…
  [['🏦', 92, 4, 1.5], ['🐷', 6, 80, 1.2], ['💶', 20, 80.5, 1], ['🪙', 33, 80.5, 0.9], ['✉️', 80, 80.5, 1], ['🧾', 92, 80.5, 0.9]].forEach(([e, x, y, sc]) => plane.append(h('div', { class: 'v3-bb v3-decor', style: `${pct([x, y])};--s:${sc}`, text: e })));
  fitPlane(stage, plane, 1.25);
  const move = pawnLayer(plane, pts, M3.H, tiles, M3.diceDelay);
  return {
    el: stage,
    update(st, cur) {
      potBox.textContent = st.track.header || '';
      move(st, cur);
    },
  };
}

/** Écran télé des jeux de parcours en perspective : plateau + lanceur (roue ou dé) + joueurs. */
function board3dView(root, s, scene, roller, rollText) {
  const turnBox = h('div', { class: 'turn-box' });
  const side = h('div', { class: 'side-list' });
  const clock = h('div', { class: 'game-clock' });
  const overlay = h('div', { class: 'card-overlay hidden' });
  const passed = h('div', { class: 'passed-list' });
  root.append(h('div', { class: 'board-layout' },
    h('div', { class: 'board-wrap track-wrap v3-wrap' }, scene.el, overlay),
    h('div', { class: 'board-side' }, turnBox, roller.el, passed, side, clock)));
  let lastCard = null;
  return {
    update(st) {
      const TT = st.track;
      const cur = TT.seats[TT.turn];
      scene.update(st, cur);
      roller.show(st.stage === 'roll' || st.stage == null ? null : st.roll, `${TT.seq}:${st.roll}`);
      passed.replaceChildren(...(st.passed || []).map((t) => h('div', { class: 'gain ok rise', text: t })));
      turnBox.replaceChildren(cur ? avatarEl(cur.player, '') : '',
        h('div', {}, h('small', { text: 'À toi de jouer' }), h('b', { text: cur?.player.name || '' }),
          h('small', { text: st.stage === 'roll' ? rollText : st.choice && !st.chosen ? '📱 À toi de choisir…' : '' })));
      side.replaceChildren(...TT.seats.map((seat, i) => sideRow(seat.player, i === TT.turn, [`${fmt(seat.money)} ${TT.currency}`, seat.summary ? ` · ${seat.summary}` : ''])));
      clock.textContent = `⏱ ${mmss(TT.endsInMs)} restantes`;
      if (st.card) {
        const k = JSON.stringify(st.card) + st.chosen;
        if (k !== lastCard) {
          lastCard = k;
          if (st.card.tone === 'good') SFX.correct(); else if (st.card.tone === 'bad') SFX.wrong(); else SFX.reveal();
        }
        overlay.classList.remove('hidden');
        overlay.replaceChildren(h('div', { class: `event-card tone-${st.card.tone} pop` },
          h('div', { class: 'ev-icon', text: st.card.icon }), h('h2', { text: st.card.title }), h('p', { text: st.card.text }),
          st.card.delta ? h('div', { class: `ev-delta ${st.card.delta > 0 ? 'plus' : 'minus'}`, text: `${st.card.delta > 0 ? '+' : '−'}${fmt(Math.abs(st.card.delta))} ${TT.currency}` }) : '',
          st.choice ? h('div', { class: 'ev-choice' }, h('span', { class: 'chip', text: st.choice.yes }), h('b', { text: 'ou' }), h('span', { class: 'chip', text: st.choice.no }),
            h('small', { text: `📱 ${cur?.player.name || ''} choisit sur son téléphone` })) : ''));
      } else {
        overlay.classList.add('hidden');
        lastCard = null;
      }
    },
  };
}

// =====================================================================
// Jeux de parcours : Chemin de la Vie, Fin de Mois
// =====================================================================
function trackBoardView(root, s) {
  SFX.whoosh();
  const T = s.track;
  if (T.id === 'vie') return vieBoardView(root, s);
  if (T.id === 'mois') return board3dView(root, s, moisScene(T), diceEl(), '📱 Lance le dé !');
  const grid = h('div', { class: `track-grid ${T.id}`, style: `--cols:${T.cols}` });
  const cells = [];
  const order = T.id === 'mois' ? T.board.slice(1) : T.board; // le calendrier commence au jour 1
  const rows = Math.ceil(order.length / T.cols);
  order.forEach((sq, k) => {
    const row = Math.floor(k / T.cols);
    let col = k % T.cols;
    if (T.id === 'vie' && row % 2 === 1) col = T.cols - 1 - col; // parcours en serpentin
    const el = h('div', { class: `track-sq t-${sq.type}`, style: `grid-row:${row + 1};grid-column:${col + 1}` },
      T.id === 'mois' ? h('small', { class: 'day', text: `${sq.wd} ${sq.day}` }) : h('small', { class: 'day', text: String(k) }),
      h('span', { class: 'ic', text: sq.icon }), h('em', { text: sq.label }), h('div', { class: 'sq-pawns' }));
    grid.append(el);
    cells[T.id === 'mois' ? k + 1 : k] = el;
  });
  grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
  const startBox = h('div', { class: 'start-box' });
  const dice = diceEl();
  const turnBox = h('div', { class: 'turn-box' });
  const side = h('div', { class: 'side-list' });
  const header = h('div', { class: 'track-header' });
  const clock = h('div', { class: 'game-clock' });
  const overlay = h('div', { class: 'card-overlay hidden' });
  const passed = h('div', { class: 'passed-list' });
  root.append(h('div', { class: 'board-layout' },
    h('div', { class: 'board-wrap track-wrap' }, header, startBox, grid, overlay),
    h('div', { class: 'board-side' }, turnBox, dice.el, passed, side, clock)));
  let lastCard = null;
  return {
    update(st) {
      const TT = st.track;
      const cur = TT.seats[TT.turn];
      cells.forEach((c) => c && c.querySelector('.sq-pawns').replaceChildren());
      startBox.replaceChildren();
      TT.seats.forEach((seat) => {
        if (!seat.player) return;
        const pawn = avatarEl(seat.player, 'sm');
        pawn.classList.add('track-pawn');
        if (seat.player.id === cur?.player.id) pawn.classList.add('mine-turn');
        if (seat.pos === 0 && TT.id === 'mois') startBox.append(pawn);
        else cells[seat.pos]?.querySelector('.sq-pawns').append(pawn);
      });
      if (TT.id === 'mois' && !startBox.children.length) startBox.append(h('small', { text: '🗓️ Début du mois' }));
      if (TT.id === 'vie') startBox.classList.add('hidden');
      header.textContent = TT.header || '';
      header.classList.toggle('hidden', !TT.header);
      dice.show(st.stage === 'roll' || st.stage == null ? null : st.roll, `${TT.seq}:${st.roll}`);
      dice.el.classList.toggle('wheel', TT.id === 'vie');
      passed.replaceChildren(...(st.passed || []).map((t) => h('div', { class: 'gain ok rise', text: t })));
      turnBox.replaceChildren(cur ? avatarEl(cur.player, '') : '',
        h('div', {}, h('small', { text: 'À toi de jouer' }), h('b', { text: cur?.player.name || '' }),
          h('small', { text: st.stage === 'roll' ? (TT.id === 'vie' ? '📱 Fais tourner la roue !' : '📱 Lance le dé !') : st.choice && !st.chosen ? '📱 À toi de choisir…' : '' })));
      side.replaceChildren(...TT.seats.map((seat, i) => sideRow(seat.player, i === TT.turn, [`${fmt(seat.money)} ${TT.currency}`, seat.summary ? ` · ${seat.summary}` : ''])));
      clock.textContent = `⏱ ${mmss(TT.endsInMs)} restantes`;

      // carte événement
      if (st.card) {
        const k = JSON.stringify(st.card) + st.chosen;
        if (k !== lastCard) {
          lastCard = k;
          if (st.card.tone === 'good') SFX.correct(); else if (st.card.tone === 'bad') SFX.wrong(); else SFX.reveal();
        }
        overlay.classList.remove('hidden');
        overlay.replaceChildren(h('div', { class: `event-card tone-${st.card.tone} pop` },
          h('div', { class: 'ev-icon', text: st.card.icon }), h('h2', { text: st.card.title }), h('p', { text: st.card.text }),
          st.card.delta ? h('div', { class: `ev-delta ${st.card.delta > 0 ? 'plus' : 'minus'}`, text: `${st.card.delta > 0 ? '+' : '−'}${fmt(Math.abs(st.card.delta))} ${TT.currency}` }) : '',
          st.choice ? h('div', { class: 'ev-choice' }, h('span', { class: 'chip', text: st.choice.yes }), h('b', { text: 'ou' }), h('span', { class: 'chip', text: st.choice.no }),
            h('small', { text: `📱 ${cur?.player.name || ''} choisit sur son téléphone` })) : ''));
      } else {
        overlay.classList.add('hidden');
        lastCard = null;
      }
    },
  };
}

/** Écran télé du Chemin de la Vie : plateau en perspective + roue de la vie + joueurs. */
function vieBoardView(root, s) { return board3dView(root, s, vieScene(s.track), lifeWheel(), '📱 Fais tourner la roue !'); }

function trackEnd(root, s) {
  SFX.fanfare(); SFX.applause(2);
  root.append(endTable(s.track.id === 'vie' ? '🏖️ Fortunes à la retraite' : '📅 Bilan des comptes', s.rows.map((r) => ({
    player: r.player, main: `${fmt(r.total)} ${s.track.currency}`, sub: r.summary, points: r.points,
  }))));
}

Object.assign(VIEWS, { vieTurn: trackBoardView, vieEvent: trackBoardView, moisTurn: trackBoardView, moisEvent: trackBoardView, vieEnd: trackEnd, moisEnd: trackEnd });

/** Tableau de fin de partie commun aux jeux de plateau. */
function endTable(title, rows) {
  return h('div', { class: 'end-wrap' },
    h('div', { class: 'board-title', text: title }),
    h('div', { class: 'est-list' }, ...rows.map((r, k) => {
      const row = h('div', { class: `est-row rise${k === 0 ? ' exact' : ''}`, style: 'grid-template-columns:2.4em auto 1fr auto auto' },
        h('span', { class: 'pos', text: String(k + 1) }), avatarEl(r.player, 'sm'), h('span', { class: 'nm', text: `${r.player.name}${r.sub ? ` · ${r.sub}` : ''}` }),
        h('span', { class: 'guess', text: r.main }), h('b', { text: r.points != null ? `+${fmt(r.points)} pts` : '' }));
      row.style.animationDelay = `${0.3 + k * 0.15}s`;
      return row;
    })));
}

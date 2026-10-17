// Écrans téléphone des jeux de plateau (vague 2).
/* global h, avatarEl, SHAPES, SFX, fmt, buzz, act, center, timerBar, PVIEWS, state, sentScreen, resultScreen */

const COLOR_HEX = { Rouge: '#ef4444', Vert: '#22c55e', Jaune: '#eab308', Bleu: '#3b82f6' };
const CAT_ICON = { culture: '🧠', musique: '🎵', cinema: '🎬', sport: '🏅', foot: '⚽' };
const CAT_HEX = { culture: '#8b5cf6', musique: '#ec4899', cinema: '#06b6d4', sport: '#f97316', foot: '#22c55e' };

/** Gros bouton « lancer » pour le joueur dont c'est le tour. */
function rollButton(root, label, emoji) {
  buzz([120, 60, 120]);
  const btn = h('button', {
    class: 'roll-btn', onclick: () => {
      act({ type: 'roll' }); SFX.tap(); buzz(60);
      btn.disabled = true; btn.classList.add('rolling'); btn.querySelector('span').textContent = '…';
    },
  }, h('span', { text: emoji }), h('b', { text: label }));
  return btn;
}

const waitScreen = (root, player, text, extra) => {
  center(root).append(player ? avatarEl(player, 'lg') : '', h('h1', { text: `Au tour de ${player?.name || '…'}` }), text ? h('p', { text }) : '', extra || '');
};

Object.assign(PVIEWS, {
  // ================= Petits Chevaux =================
  ludoPlay(root, s) {
    const L = s.ludo;
    const color = L.colorName ? h('div', { class: 'color-tag', style: `--c:${COLOR_HEX[L.colorName]}`, text: `Tes chevaux : ${L.colorName}` }) : '';
    const status = L.seat != null ? h('p', { text: `🏠 Au box : ${L.horses.filter((x) => x < 0).length} · 🐎 En course : ${L.horses.filter((x) => x >= 0 && x < 56).length} · 🏁 Arrivés : ${L.horses.filter((x) => x === 56).length}` }) : '';
    if (L.lastMove?.hitMe) { SFX.wrong(); buzz([300, 100, 300]); }
    if (L.seat == null) { waitScreen(root, L.turnPlayer, '🍿 Tu es en tribune : 4 cavaliers maximum. Encourage-les !'); return; }
    if (!L.isTurn) {
      waitScreen(root, L.turnPlayer, L.dice && L.stage !== 'roll' ? `🎲 ${L.dice}` : 'Prépare-toi, ton tour arrive…', h('div', {}, color, status,
        L.lastMove?.hitMe ? h('div', { class: 'error', text: '💥 Un de tes chevaux a été renvoyé au box !' }) : ''));
      return;
    }
    center(root);
    if (L.stage === 'roll') {
      root.append(color, h('h1', { text: 'À toi !' }), rollButton(root, 'Lancer le dé', '🎲'), status,
        h('p', { text: 'Un 6 ou un 1 pour sortir un cheval. Un 6 fait rejouer !' }), timerBar());
    } else if (L.stage === 'choose') {
      buzz(80);
      root.append(h('div', { class: 'dice-phone', text: String(L.dice) }), h('h1', { text: 'Quel cheval bouger ?' }), timerBar(),
        h('div', { class: 'opt-list' }, ...L.options.map((o) => h('button', {
          class: 'opt-btn', onclick: () => { act({ type: 'choose', h: o.h }); SFX.tap(); sentScreen(root, '🐎', 'Hue !', ''); },
        }, h('b', { text: `Cheval ${o.h + 1}` }),
        h('span', { text: o.from === -1 ? 'Sortir du box' : o.to === 56 ? 'Rentrer à l’arrivée 🏁' : `Avancer de ${L.dice} (${o.from} → ${o.to})` }),
        o.captures ? h('em', { text: '💥 Mange un adversaire !' }) : ''))));
    } else {
      root.append(h('div', { class: 'dice-phone', text: String(L.dice || '…') }),
        h('h1', { text: L.stage === 'nomove' ? 'Aucun cheval ne peut bouger…' : L.lastMove?.caught?.length ? '💥 Croqué !' : 'Hue !' }), status);
    }
  },

  ludoEnd(root, s) {
    const r = s.row;
    if (!r) { resultScreen(root, null, '🐴', 'Course terminée !'); return; }
    resultScreen(root, r.winner || r.points > 0, r.winner ? '🏆' : '🐴', r.winner ? 'Tu gagnes la course !' : 'Course terminée !', `+${fmt(r.points)}`,
      `🏁 ${r.home} cheval${r.home > 1 ? 'x' : ''} rentré${r.home > 1 ? 's' : ''}${r.captures ? ` · 💥 ${r.captures} capture${r.captures > 1 ? 's' : ''}` : ''}`);
  },

  // ================= La Roue des Savoirs =================
  rouePlay(root, s) {
    const R = s.roue;
    const stars = h('div', { class: 'stars-phone' }, ...R.cats.map((c) => h('span', { class: R.myStars.includes(c) ? 'on' : '', style: `--c:${CAT_HEX[c]}`, text: CAT_ICON[c] })));
    if (!R.isTurn) { waitScreen(root, R.turnPlayer, s.stage === 'move' ? `🎲 ${s.dice}` : 'Prépare-toi : tu pourras répondre aussi !', stars); return; }
    center(root);
    if (s.stage === 'roll') root.append(h('h1', { text: 'À toi !' }), rollButton(root, 'Lancer le dé', '🎲'), stars, h('p', { text: `Mes étoiles : ${R.myStars.length} / ${R.target}` }), timerBar());
    else root.append(h('div', { class: 'dice-phone', text: String(s.dice) }), h('h1', { text: 'En route…' }), stars);
  },

  roueQ(root, s) {
    const R = s.roue;
    if (s.mine != null) { center(root).append(h('div', { class: `p-btn c${s.mine}`, style: 'width:130px;height:130px;flex:none' }, h('span', { class: 'shape', text: SHAPES[s.mine] })), h('h1', { text: 'Réponse envoyée !' }), timerBar()); return; }
    root.append(
      h('div', { class: 'cat-tag', style: `--c:${CAT_HEX[s.q.cat]}`, text: `${CAT_ICON[s.q.cat]} ${R.isTurn ? (s.star ? '⭐ Étoile en jeu pour toi !' : 'Ta question !') : `Question pour ${R.turnPlayer?.name} (+100 si tu trouves)`}` }),
      h('div', { class: 'p-q', text: s.q.text }), timerBar(),
      h('div', { class: 'p-btns' }, ...s.q.choices.map((c, i) => h('button', {
        class: `p-btn c${i}`, onclick: () => { act({ type: 'answer', choice: i }); SFX.tap(); buzz(40); root.querySelectorAll('.p-btn').forEach((b) => { b.disabled = true; b.classList.add('dim'); }); },
      }, h('span', { class: 'shape', text: SHAPES[i] }), h('span', { text: c })))));
  },

  roueA(root, s) {
    const R = s.roue;
    const mine = s.myResult;
    const good = `Bonne réponse : ${s.q.choices[s.correct]}`;
    if (R.isTurn) resultScreen(root, s.ok, s.wonStar ? '⭐' : s.ok ? '🎉' : '😬', s.wonStar ? 'Étoile gagnée !' : s.ok ? 'Bravo, tu rejoues !' : 'Raté…', mine?.gained ? `+${mine.gained}` : '', good);
    else resultScreen(root, mine ? mine.correct : null, mine?.correct ? '👍' : '🤔', mine?.correct ? 'Bien joué !' : `${s.activeName} ${s.ok ? 'a trouvé' : 's’est trompé·e'}`, mine?.gained ? `+${mine.gained}` : '', good);
  },

  roueEnd(root, s) {
    const r = s.row;
    resultScreen(root, r?.winner || null, r?.winner ? '🏆' : '🎡', r?.winner ? 'Toutes les étoiles !' : 'Fin de la Roue des Savoirs', '', r ? `⭐ ${r.stars.length} étoile${r.stars.length > 1 ? 's' : ''}` : '');
  },
});

// ================= Jeux de parcours =================
function trackTurn(root, s) {
  const T = s.track;
  const wheel = T.id === 'vie';
  const money = T.mine ? h('div', { class: 'money-tag', text: `${fmt(T.mine.money)} ${T.currency}${T.mine.summary ? ` · ${T.mine.summary}` : ''}` }) : '';
  if (!T.isTurn) { waitScreen(root, T.turnPlayer, s.stage === 'move' ? `${wheel ? '🎡' : '🎲'} ${s.roll}` : 'Regarde le plateau !', money); return; }
  center(root);
  if (s.stage === 'roll') root.append(h('h1', { text: 'À toi !' }), rollButton(root, wheel ? 'Faire tourner la roue' : 'Lancer le dé', wheel ? '🎡' : '🎲'), money, timerBar());
  else root.append(h('div', { class: 'dice-phone', text: String(s.roll) }), h('h1', { text: 'En route…' }), money);
}

function trackEvent(root, s) {
  const T = s.track;
  const c = s.card;
  center(root);
  if (!c) return;
  const card = h('div', { class: `event-card small tone-${c.tone}` }, h('div', { class: 'ev-icon', text: c.icon }), h('h2', { text: c.title }), h('p', { text: c.text }),
    c.delta ? h('div', { class: `ev-delta ${c.delta > 0 ? 'plus' : 'minus'}`, text: `${c.delta > 0 ? '+' : '−'}${fmt(Math.abs(c.delta))} ${T.currency}` }) : '');
  if (T.isTurn && s.choice && !s.chosen) {
    buzz([100, 60, 100]);
    root.append(card, timerBar(), h('div', { class: 'choice-row' },
      h('button', { class: 'btn gold big', onclick: () => { act({ type: 'decide', yes: true }); SFX.tap(); sentScreen(root, '👍', 'C’est noté !', ''); } }, s.choice.yes),
      h('button', { class: 'btn ghost big', onclick: () => { act({ type: 'decide', yes: false }); SFX.tap(); sentScreen(root, '👌', 'C’est noté !', ''); } }, s.choice.no)));
    return;
  }
  if (T.isTurn && c.delta) { if (c.delta > 0) { SFX.correct(); buzz([60, 40, 60]); } else { SFX.wrong(); buzz(200); } }
  root.append(T.isTurn ? '' : h('small', { text: `Pour ${T.turnPlayer?.name}` }), card,
    s.hasChoice && !T.isTurn ? h('p', { text: `${T.turnPlayer?.name} réfléchit…` }) : '',
    T.mine ? h('div', { class: 'money-tag', text: `Toi : ${fmt(T.mine.money)} ${T.currency}` }) : '');
}

function trackEnd(root, s) {
  const r = s.row;
  if (!r) { resultScreen(root, null, '🏁', 'Partie terminée !'); return; }
  resultScreen(root, r.points > 0, s.track.id === 'vie' ? '🏖️' : '💶', `${fmt(r.total)} ${s.track.currency}`, `+${fmt(r.points)} pts`, r.summary);
}

Object.assign(PVIEWS, { vieTurn: trackTurn, moisTurn: trackTurn, vieEvent: trackEvent, moisEvent: trackEvent, vieEnd: trackEnd, moisEnd: trackEnd });

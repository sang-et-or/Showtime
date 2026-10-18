// Téléphones : les « Jeux télé » (Lettre à Lettre, Mot pour Mot, Le Grand Sondage, La Roue des Lettres).
/* global h, avatarEl, SFX, fmt, buzz, act, center, timerBar, PVIEWS, sentScreen, resultScreen, tap */

/** Petit formulaire « une ligne + bouton » commun aux jeux télé. */
function lineForm(placeholder, button, onSend, opts = {}) {
  const input = h('input', { type: 'text', maxlength: String(opts.max || 30), placeholder, autocomplete: 'off', autocapitalize: opts.caps ? 'characters' : 'off', spellcheck: 'false', class: `tv-input${opts.caps ? ' caps' : ''}` });
  if (opts.value) input.value = opts.value;
  const form = h('form', { class: 'guess-form', onsubmit: (e) => { e.preventDefault(); const v = input.value.trim(); if (!v) return; onSend(v); tap(); input.value = opts.keep ? v : ''; } },
    input, h('button', { class: 'btn gold', type: 'submit' }, button));
  setTimeout(() => input.focus(), 150);
  return { form, input };
}

// =====================================================================
// Lettre à Lettre
// =====================================================================
function motusMini(M) {
  const grid = h('div', { class: 'mt-grid mini', style: `--len:${M.len}` });
  const rows = M.rows.slice(-3);
  rows.forEach((row) => row.cells.forEach((c) => grid.append(h('div', { class: `mt-cell ${c.st}`, text: c.l }))));
  M.known.forEach((l) => grid.append(h('div', { class: `mt-cell${l ? ' hint' : ''}`, text: l || '•' })));
  return grid;
}

Object.assign(PVIEWS, {
  motusPlay(root, s) {
    center(root);
    const M = s.motus;
    if (!s.isTurn) {
      root.append(h('b', { text: `Mot ${M.index}/${M.total} · ${M.len} lettres` }), motusMini(M), timerBar(),
        s.active ? avatarEl(s.active, '') : '', h('p', { text: `C’est à ${s.active?.name || '…'} de proposer un mot.` }));
      return;
    }
    buzz([80, 40, 80]);
    const err = h('div', { class: 'error hidden' });
    const { form, input } = lineForm(`${M.len} lettres, commence par ${M.known[0]}`, 'Valider', (v) => act({ type: 'word', text: v }), { max: M.len, caps: true, value: M.known[0], keep: true });
    root.append(h('h1', { text: 'À toi !' }), h('p', { text: `Un mot de ${M.len} lettres qui commence par ${M.known[0]}` }), motusMini(M), timerBar(), form, err);
    return {
      update(st) {
        if (st.err) { err.textContent = st.err; err.classList.remove('hidden'); buzz(200); input.focus(); } else err.classList.add('hidden');
      },
    };
  },
  motusReveal(root, s) {
    resultScreen(root, s.iSolved ? true : s.solver ? null : false, s.iSolved ? '🏆' : s.solver ? '🟥' : '😶',
      s.iSolved ? 'Tu as trouvé !' : s.solver ? `${s.solver.name} a trouvé !` : 'Personne n’a trouvé…', s.iSolved ? `+${s.pts}` : '', `Le mot était : ${s.word}`);
  },
});

// =====================================================================
// Mot pour Mot
// =====================================================================
Object.assign(PVIEWS, {
  mpmClue(root, s) {
    center(root);
    const M = s.mpm;
    if (!s.isGiver) {
      root.append(avatarEl(M.giver, 'lg'), h('h1', { text: `${M.giver?.name || ''} cherche un indice…` }), timerBar(),
        M.clues.length ? h('div', { class: 'chips-line' }, ...M.clues.map((c) => h('span', { class: 'chip', text: c }))) : h('p', { text: 'Prépare-toi à deviner !' }));
      return;
    }
    buzz([80, 40, 80]);
    const err = h('div', { class: 'error hidden' });
    const { form } = lineForm('Un seul mot', 'Envoyer', (v) => act({ type: 'clue', text: v }), { max: 24 });
    root.append(h('small', { text: 'Fais deviner ce mot :' }), h('div', { class: 'mpm-secret', text: s.word }), timerBar(),
      h('p', { text: `Indice n°${M.clues.length + 1} : ${M.values[M.clues.length]} points en jeu. Un seul mot, sans dire le mot secret !` }), form, err,
      M.clues.length ? h('div', { class: 'chips-line' }, ...M.clues.map((c) => h('span', { class: 'chip', text: c }))) : '');
    return { update(st) { if (st.err) { err.textContent = st.err; err.classList.remove('hidden'); buzz(200); } else err.classList.add('hidden'); } };
  },
  mpmGuess(root, s) {
    center(root);
    const M = s.mpm;
    const clue = M.clues[M.clues.length - 1];
    if (s.isGiver) { root.append(h('div', { class: 'big-emoji', text: '🤞' }), h('h1', { text: 'Ils réfléchissent…' }), h('p', { text: `Ton indice : « ${clue} »` }), timerBar()); return; }
    if (s.mine != null) { sentScreen(root, '🤞', 'Réponse envoyée', 'Verdict sur le grand écran !'); return; }
    const { form } = lineForm('Ta réponse', 'Je tente !', (v) => { act({ type: 'guess', text: v }); sentScreen(root, '🤞', 'Réponse envoyée', 'Verdict sur le grand écran !'); });
    root.append(h('small', { text: `Indice de ${M.giver?.name || ''} :` }), h('div', { class: 'mpm-secret', text: clue }),
      h('p', { text: `${M.letters} lettres · ${M.values[M.clues.length - 1]} points · une seule réponse !` }), timerBar(), form);
  },
  mpmReveal(root, s) {
    resultScreen(root, s.iWon ? true : s.finder ? null : false, s.iWon ? '🏆' : s.finder ? '🔺' : '😶',
      s.iWon ? 'Gagné !' : s.finder ? `${s.finder.name} a trouvé !` : 'Personne n’a trouvé…', s.iWon ? `+${s.pts}` : '', `Le mot était : ${s.word}`);
  },
});

// =====================================================================
// Le Grand Sondage
// =====================================================================
Object.assign(PVIEWS, {
  sdAsk(root, s) {
    center(root);
    const fb = h('div', { class: 'sd-fb' });
    const left = h('p');
    const found = h('div', { class: 'sd-mini' });
    const { form, input } = lineForm('Ta réponse', 'Valider', (v) => act({ type: 'answer', text: v }));
    root.append(h('small', { text: 'Nous avons demandé à 100 personnes :' }), h('div', { class: 'p-q', text: s.sd.q }), timerBar(), form, left, fb, found);
    let lastShown = null;
    return {
      update(st) {
        left.textContent = st.left > 0 ? `Encore ${st.left} essai${st.left > 1 ? 's' : ''}` : 'Plus d’essai pour cette question !';
        form.classList.toggle('hidden', st.left <= 0);
        const key = JSON.stringify(st.last);
        if (st.last && key !== lastShown) {
          lastShown = key;
          if (st.last.ok) { SFX.correct(); buzz([60, 40, 60]); fb.className = 'sd-fb ok pop'; fb.textContent = `✓ « ${st.last.text} » : +${st.last.pts} !`; }
          else if (st.last.already) { buzz(80); fb.className = 'sd-fb pop'; fb.textContent = `« ${st.last.text} » est déjà au tableau !`; }
          else { SFX.wrong(); buzz(250); fb.className = 'sd-fb ko pop'; fb.textContent = `✗ « ${st.last.text} » n’est pas au tableau`; }
          input.focus();
        }
        found.replaceChildren(...st.board.map((r, k) => h('div', { class: r.label ? 'on' : '' }, h('b', { text: String(k + 1) }), h('span', { text: r.label || '…' }))));
      },
    };
  },
  sdReveal(root, s) {
    resultScreen(root, s.mine > 0 ? true : null, s.mine > 0 ? '📊' : '🙃', s.mine > 0 ? 'Bien joué !' : 'Pas de réponse trouvée', s.mine > 0 ? `+${fmt(s.mine)}` : '', 'Toutes les réponses sont sur le grand écran');
  },
});

// =====================================================================
// La Roue des Lettres
// =====================================================================
function rlMini(R) {
  // Un groupe par mot : les mots ne sont jamais coupés en fin de ligne.
  const groups = [[]];
  R.cells.forEach((c) => { if (c === ' ') groups.push([]); else groups[groups.length - 1].push(c); });
  return h('div', { class: 'rl-mini' }, ...groups.filter((g) => g.length).map((g) => h('div', { class: 'rl-word' },
    ...g.map((c) => h('span', { class: c ? 'on' : '', text: c || '' })))));
}

Object.assign(PVIEWS, {
  rlTurn(root, s) {
    center(root);
    const R = s.rl;
    const headLine = h('div', { class: 'bac-head' }, h('b', { text: `🎡 ${R.cat}` }), h('span', { class: 'chip', text: `💰 ${fmt(R.bank)}` }));
    if (!s.isTurn) {
      root.append(headLine, rlMini(R), timerBar(), s.active ? avatarEl(s.active, '') : '', h('p', { text: s.stage === 'spinning' ? 'La roue tourne… 🎡' : `C’est à ${s.active?.name || '…'} de jouer.` }));
      return;
    }
    const err = h('div', { class: 'error hidden' });
    if (s.stage === 'spinning') { root.append(headLine, rlMini(R), h('div', { class: 'big-emoji spin', text: '🎡' }), h('h1', { text: 'La roue tourne…' })); return; }
    if (s.stage === 'letter') {
      buzz([60, 30, 60]);
      const keys = h('div', { class: 'keyboard' }, ...'ZRTPQSDFGHJKLMWXCVBN'.split('').map((l) => h('button', {
        class: 'key', text: l, disabled: R.used.includes(l) ? true : undefined, onclick: () => { act({ type: 'letter', l }); tap(); keys.classList.add('cool'); },
      })));
      root.append(headLine, h('h1', { text: `${R.spin?.value} points !` }), h('p', { text: 'Choisis une consonne :' }), rlMini(R), timerBar(), keys);
      return;
    }
    buzz([80, 40, 80]);
    const zone = h('div', { class: 'rl-zone' });
    const vowels = () => zone.replaceChildren(h('p', { text: `Une voyelle coûte ${R.vowelCost} :` }), h('div', { class: 'keyboard' }, ...'AEIOUY'.split('').map((l) => h('button', {
      class: 'key', text: l, disabled: R.used.includes(l) ? true : undefined, onclick: () => { act({ type: 'letter', l }); tap(); },
    }))));
    const solve = () => { const { form } = lineForm('La réponse complète', 'Résoudre', (v) => act({ type: 'solve', text: v }), { max: 60 }); zone.replaceChildren(form); };
    root.append(headLine, h('h1', { text: 'À toi !' }), rlMini(R), timerBar(),
      h('div', { class: 'rl-actions' },
        h('button', { class: 'btn gold big', onclick: () => { act({ type: 'spin' }); tap(); } }, '🎡 Tourner la roue'),
        h('button', { class: 'btn', disabled: R.bank < R.vowelCost ? true : undefined, onclick: vowels }, `🅰️ Voyelle (${R.vowelCost})`),
        h('button', { class: 'btn', onclick: solve }, '💡 Résoudre')),
      zone, err);
    return { update(st) { if (st.err) { err.textContent = st.err; err.classList.remove('hidden'); buzz(200); } else err.classList.add('hidden'); } };
  },
  rlReveal(root, s) {
    resultScreen(root, s.iSolved ? true : s.solver ? null : false, s.iSolved ? '🏆' : s.solver ? '🎡' : '😶',
      s.iSolved ? 'Énigme résolue !' : s.solver ? `${s.solver.name} a résolu !` : 'Personne n’a trouvé…', s.iSolved ? `+${fmt(s.pts)}` : '', `Réponse : ${s.answer.toLowerCase()}`);
  },
});

// =====================================================================
// Les Tourtereaux
// =====================================================================
Object.assign(PVIEWS, {
  tzWrite(root, s) {
    center(root);
    if (!s.inGame) { root.append(h('div', { class: 'big-emoji', text: '🍿' }), h('h1', { text: 'Regarde l’écran !' })); return; }
    if (s.done) { sentScreen(root, '💌', 'Réponse envoyée', s.isSubject ? 'Ton partenaire te connaît-il vraiment ?' : 'Croise les doigts… 🤞'); return; }
    buzz([80, 40, 80]);
    const send = (v) => { act({ type: 'answer', text: v }); sentScreen(root, '💌', 'Réponse envoyée', s.isSubject ? 'Ton partenaire te connaît-il vraiment ?' : 'Croise les doigts… 🤞'); };
    const { form } = lineForm(s.isSubject ? 'Ta réponse' : 'Sa réponse…', 'Envoyer', send, { max: 40 });
    root.append(h('div', { class: 'tz-duo' }, ...s.partners.map((m) => avatarEl(m, 'sm')), h('small', { text: `En duo avec ${s.partners.map((m) => m.name).join(' et ')}` })),
      h('div', { class: 'chip', text: s.isSubject ? '💬 La question parle de TOI' : `🔮 Devine la réponse de ${s.subject?.name || ''}` }),
      h('div', { class: 'p-q', text: s.q }), timerBar(), form);
  },
  tzJudge(root, s) {
    center(root);
    if (!s.toJudge.length) { root.append(h('div', { class: 'big-emoji', text: '⚖️' }), h('h1', { text: 'Le public délibère…' }), timerBar()); return; }
    root.append(h('h1', { text: s.solo ? 'Est-ce la bonne réponse ?' : 'Ça compte ?' }), timerBar());
    s.toJudge.forEach((p) => {
      const yes = h('button', { class: `btn${p.myVote === true ? ' gold' : ''}`, onclick: () => { act({ type: 'judge', k: p.k, ok: true }); tap(); yes.classList.add('gold'); no.classList.remove('gold'); } }, '👍 Oui');
      const no = h('button', { class: `btn${p.myVote === false ? ' gold' : ''}`, onclick: () => { act({ type: 'judge', k: p.k, ok: false }); tap(); no.classList.add('gold'); yes.classList.remove('gold'); } }, '👎 Non');
      root.append(h('div', { class: 'tz-judge' }, h('small', { text: p.q }),
        h('div', { class: 'tz-pair' }, h('div', {}, h('small', { text: p.subject.name }), h('b', { text: p.answer })), ...p.guesses.map((g) => h('div', {}, h('small', { text: g.who?.name || '' }), h('b', { text: g.text || '—' })))),
        h('div', { class: 'tz-btns' }, yes, no)));
    });
  },
  tzReveal(root, s) {
    if (!s.mine) { resultScreen(root, null, '💕', 'Résultats sur l’écran !'); return; }
    resultScreen(root, s.mine.ok, s.mine.ok ? '💕' : '💔', s.mine.ok ? 'Sur la même longueur d’onde !' : 'Raté…', s.mine.ok ? '+200' : '',
      `${s.mine.subject.name} : « ${s.mine.answer || '—'} » · deviné : « ${s.mine.guesses.map((g) => g.text || '—').join(' / ')} »`);
  },
});

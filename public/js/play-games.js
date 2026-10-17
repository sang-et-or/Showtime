// Écrans téléphone des jeux ajoutés en vague 1 : Défi Surprise, Grand Duel, Petit Bac,
// L'Imposteur, Mot mystère, L'Estimation.
/* global h, avatarEl, SHAPES, SFX, fmt, buzz, act, center, timerBar, PVIEWS, state */

/** Affiche tout de suite un écran « c'est envoyé », sans attendre la confirmation du serveur. */
function sentScreen(root, emoji, title, text) {
  root.classList.add('center');
  root.replaceChildren(h('div', { class: 'big-emoji pop', text: emoji }), h('h1', { text: title }), text ? h('p', { text }) : '', timerBar());
}
const tap = () => { SFX.tap(); buzz(40); };
const resultScreen = (root, ok, emoji, title, pts, sub) => {
  center(root);
  if (ok) { SFX.correct(); buzz([60, 40, 60]); } else if (ok === false) { SFX.wrong(); buzz(250); }
  root.append(h('div', { class: 'big-emoji pop', text: emoji }), h('h1', { class: ok ? 'result-ok' : ok === false ? 'result-ko' : '', text: title }),
    pts ? h('div', { class: 'points pop', text: pts }) : '', sub ? h('p', { text: sub }) : '');
};

Object.assign(PVIEWS, {
  // ================= Défi Surprise =================
  defiGet(root, s) {
    center(root);
    if (!s.isPerformer) {
      root.append(avatarEl(s.turn.performer, 'lg'), h('h1', { text: `Au tour de ${s.turn.performer.name} !` }),
        h('p', { text: s.turn.kind === 'mime' ? 'Prépare-toi à deviner son mime 🧐' : 'Prépare-toi à noter sa performance ⭐' }), timerBar());
      return;
    }
    buzz([100, 60, 100]);
    const secret = s.secret;
    root.append(h('div', { class: 'big-emoji', text: s.turn.kind === 'mime' ? '🤐' : '🎤' }), h('h1', { text: 'C’est ton tour !' }),
      h('div', { class: 'secret-card' },
        s.turn.kind === 'mime'
          ? [h('small', { text: `Mime en silence (catégorie ${secret.cat}) :` }), h('b', { text: secret.w })]
          : [h('small', { text: 'Ton défi (tout le monde le verra) :' }), h('b', { class: 'defi-txt', text: secret })]),
      h('p', { text: s.turn.kind === 'mime' ? 'Ne montre pas ton écran ! Pas un mot, pas un bruit.' : 'Lis bien, puis lance-toi !' }),
      h('button', { class: 'btn gold big', onclick: () => { act({ type: 'ready' }); tap(); } }, 'Je suis prêt·e ▶'),
      timerBar());
  },

  defiAct(root, s) {
    center(root);
    const t = s.turn;
    if (s.isPerformer && t.kind === 'mime') {
      root.append(h('div', { class: 'secret-card' }, h('small', { text: 'Tu mimes :' }), h('b', { text: s.secret.w })), timerBar(),
        h('h2', { text: 'Qui a trouvé ?' }),
        h('div', { class: 'cand-grid', style: 'width:100%' }, ...s.others.map((c) => h('button', {
          class: 'cand', onclick: () => { act({ type: 'found', target: c.id }); tap(); },
        }, avatarEl(c), h('span', { class: 'nm', text: c.name })))),
        h('button', { class: 'btn ghost', onclick: () => { act({ type: 'found', target: null }); tap(); } }, 'Personne n’a trouvé 😩'));
    } else if (s.isPerformer) {
      root.append(h('div', { class: 'big-emoji', text: '🎤' }), h('h1', { text: 'À toi de jouer !' }),
        h('div', { class: 'secret-card' }, h('b', { class: 'defi-txt', text: s.secret })), timerBar(),
        h('button', { class: 'btn gold big', onclick: () => { act({ type: 'done' }); tap(); } }, 'J’ai terminé ✓'));
    } else if (t.kind === 'mime') {
      root.append(h('div', { class: 'big-emoji', style: 'animation:pulse .8s infinite', text: '🗣️' }), h('h1', { text: 'Crie tes propositions !' }),
        h('p', { text: `${t.performer.name} mime quelque chose (catégorie : ${s.cat}). Le premier qui trouve à voix haute gagne des points !` }), timerBar());
    } else {
      root.append(h('div', { class: 'big-emoji', text: '👀' }), h('h1', { text: `Regarde ${t.performer.name} !` }),
        h('div', { class: 'mini-quote' }, h('div', { class: 'qt', text: s.text })), h('p', { text: 'Tu vas devoir noter sa performance.' }), timerBar());
    }
  },

  defiVote(root, s) {
    center(root);
    if (s.isPerformer) { root.append(h('div', { class: 'big-emoji', text: '😬' }), h('h1', { text: 'Le jury délibère…' }), timerBar()); return; }
    if (s.myStars) { root.append(h('div', { class: 'big-emoji', text: '⭐' }), h('h1', { text: `Tu as donné ${s.myStars} étoile${s.myStars > 1 ? 's' : ''}` }), timerBar()); return; }
    root.append(avatarEl(s.turn.performer, 'lg'), h('h1', { text: `Note ${s.turn.performer.name} !` }), timerBar(),
      h('div', { class: 'star-row' }, ...[1, 2, 3, 4, 5].map((n) => h('button', {
        class: 'star-btn', 'aria-label': `${n} étoile${n > 1 ? 's' : ''}`,
        onclick: () => { act({ type: 'stars', n }); tap(); sentScreen(root, '⭐', `${n} étoile${n > 1 ? 's' : ''} !`, 'Merci pour ton vote.'); },
      }, h('span', { text: '★' }), h('small', { text: String(n) })))));
  },

  defiReveal(root, s) {
    const t = s.turn;
    if (t.kind === 'mime') {
      if (s.isPerformer) resultScreen(root, !!s.finder, s.finder ? '🎭' : '🙈', s.finder ? 'Mime réussi !' : 'Personne n’a trouvé…', s.finder ? `+${s.perfGain}` : '', `C’était : ${s.word}`);
      else if (s.iFound) resultScreen(root, true, '🎯', 'Bien trouvé !', `+${s.finderGain}`, `C’était : ${s.word}`);
      else resultScreen(root, null, '🤐', `C’était : ${s.word}`, '', s.finder ? `Trouvé par ${s.finder.name}` : 'Personne n’a trouvé.');
    } else if (s.isPerformer) {
      resultScreen(root, (s.avg || 0) >= 2.5, '⭐', `${String(s.avg || 0).replace('.', ',')} étoiles de moyenne`, `+${fmt(s.perfGain)}`);
    } else {
      resultScreen(root, null, '⭐', `${t.performer.name} : ${String(s.avg || 0).replace('.', ',')} / 5`, '', `+${fmt(s.perfGain)} points pour la performance`);
    }
  },

  // ================= Grand Duel =================
  duelBet(root, s) {
    center(root);
    const du = s.duel;
    if (s.role !== 'spectator') {
      const opp = s.role === 'a' ? du.b : du.a;
      buzz([100, 60, 100]);
      root.append(h('div', { class: 'big-emoji', text: '⚔️' }), h('h1', { text: `Duel contre ${opp.name} !` }),
        h('p', { text: `Premier à ${du.target} points. Les questions arrivent sur ton téléphone : sois rapide, une erreur et tu passes ton tour !` }), timerBar());
      return;
    }
    if (s.myBet) {
      const champ = s.myBet.target === du.a.id ? du.a : du.b;
      root.append(avatarEl(champ, 'lg'), h('h1', { text: `${fmt(s.myBet.stake)} pts sur ${champ.name}` }), h('p', { text: 'Pari enregistré. Croise les doigts !' }), timerBar());
      return;
    }
    let target = null; let stake = s.stakes[0];
    const pickBtns = [du.a, du.b].map((p) => h('button', {
      class: 'cand', 'aria-pressed': 'false',
      onclick: (e) => { target = p.id; tap(); pickBtns.forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); sync(); },
    }, avatarEl(p), h('span', { class: 'nm', text: p.name })));
    const stakeBtns = s.stakes.map((v) => h('button', {
      class: `chip${v === stake ? ' on' : ''}`, onclick: (e) => { stake = v; tap(); stakeBtns.forEach((b) => b.classList.toggle('on', b === e.currentTarget)); },
    }, `${fmt(v)} pts`));
    const go = h('button', { class: 'btn gold big', disabled: true, onclick: () => {
      act({ type: 'bet', target, stake }); tap();
      sentScreen(root, '💰', 'Pari enregistré !', `${fmt(stake)} points sur ${target === du.a.id ? du.a.name : du.b.name}.`);
    } }, 'Miser 💰');
    function sync() { go.disabled = !target; }
    root.append(h('h1', { text: 'Sur qui tu mises ?' }), timerBar(),
      h('div', { class: 'duel-pick' }, pickBtns[0], h('span', { class: 'vs-mini', text: 'VS' }), pickBtns[1]),
      h('div', { class: 'stake-row' }, ...stakeBtns),
      h('p', { text: 'Gagné : tu remportes ta mise. Perdu : tu la perds. Points virtuels uniquement !' }), go);
  },

  duelQ(root, s) {
    const du = s.duel;
    const score = h('div', { class: 'mini-score' }, avatarEl(du.a, 'sm'), h('b', { text: `${du.scoreA} – ${du.scoreB}` }), avatarEl(du.b, 'sm'));
    if (s.role === 'spectator') {
      center(root).append(score, h('div', { class: 'p-q', text: s.q.text }), timerBar(),
        h('p', { text: s.myBet ? `Allez ${s.myBet.target === du.a.id ? du.a.name : du.b.name} ! 📣` : 'Regarde l’écran, ça chauffe ! 🔥' }));
      return;
    }
    if (s.mine) {
      resultScreen(root, false, '❌', 'Raté !', '', 'Ton adversaire peut encore répondre…');
      root.append(timerBar());
      return;
    }
    root.append(score, h('div', { class: 'p-q', text: s.q.text }), timerBar(),
      h('div', { class: 'p-btns' }, ...s.q.choices.map((c, i) => h('button', {
        class: `p-btn c${i}`, onclick: () => { act({ type: 'answer', choice: i }); tap(); root.querySelectorAll('.p-btn').forEach((b) => { b.disabled = true; b.classList.add('dim'); }); },
      }, h('span', { class: 'shape', text: SHAPES[i] }), h('span', { text: c })))));
  },

  duelPoint(root, s) {
    const du = s.duel;
    const meId = state.me.id;
    const scorer = s.scorerId === du.a.id ? du.a : s.scorerId === du.b.id ? du.b : null;
    const sub = `Score : ${du.a.name} ${du.scoreA} – ${du.scoreB} ${du.b.name}`;
    if (s.role !== 'spectator') resultScreen(root, s.scorerId === meId ? true : scorer ? false : null, s.scorerId === meId ? '💥' : scorer ? '😤' : '😶', scorer ? (s.scorerId === meId ? 'Point pour toi !' : `Point pour ${scorer.name}`) : 'Personne ne marque', '', sub);
    else resultScreen(root, null, scorer ? '💥' : '😶', scorer ? `Point pour ${scorer.name} !` : 'Personne ne marque', '', sub);
  },

  duelEnd(root, s) {
    const du = s.duel;
    const meId = state.me.id;
    const w = s.winnerId === du.a.id ? du.a : s.winnerId === du.b.id ? du.b : null;
    if (s.role !== 'spectator') {
      if (!w) resultScreen(root, null, '🤝', 'Match nul !');
      else if (w.id === meId) { resultScreen(root, true, '🏆', 'Tu remportes le duel !', '+600'); SFX.fanfare(); }
      else resultScreen(root, false, '😵', `${w.name} remporte le duel`, '', 'La revanche sera terrible.');
    } else if (s.myBet) {
      const g = s.myBet.gain;
      resultScreen(root, g > 0 ? true : g < 0 ? false : null, g > 0 ? '🤑' : g < 0 ? '💸' : '🤝', g > 0 ? 'Pari gagnant !' : g < 0 ? 'Pari perdu…' : 'Mise remboursée', g ? `${g > 0 ? '+' : '−'}${fmt(Math.abs(g))}` : '', w ? `${w.name} gagne le duel.` : 'Match nul.');
    } else {
      resultScreen(root, null, '⚔️', w ? `${w.name} gagne le duel !` : 'Match nul !', '', 'Tu n’avais pas parié.');
    }
  },

  // ================= Petit Bac =================
  bacWrite(root, s) {
    const b = s.bac;
    if (s.done) {
      center(root).append(h('div', { class: 'letter-ball small', text: b.letter }), h('h1', { text: 'Réponses envoyées !' }),
        h('p', { text: 'On attend les autres… ou la fin du chrono.' }), timerBar());
      return null;
    }
    const inputs = b.cats.map((c, i) => h('input', { type: 'text', id: `bac${i}`, maxlength: '30', autocomplete: 'off', autocapitalize: 'words', placeholder: `${b.letter}…`, value: s.mine[i] || '' }));
    let draftTimer = null;
    const values = () => inputs.map((x) => x.value.trim());
    const send = () => act({ type: 'bacDraft', answers: values() });
    inputs.forEach((x) => x.addEventListener('input', () => { clearTimeout(draftTimer); draftTimer = setTimeout(send, 700); }));
    const stopBox = h('div', { class: 'error hidden' });
    const btn = h('button', { class: 'btn gold big', type: 'submit' }, 'J’ai fini ! STOP ✋');
    const form = h('form', { class: 'pview', style: 'animation:none', novalidate: true },
      h('div', { class: 'bac-head' }, h('div', { class: 'letter-ball small', text: b.letter }), h('div', {}, h('b', { text: `Manche ${b.round}/${b.total}` }), h('p', { text: `Tout doit commencer par ${b.letter} !` }))),
      timerBar(), stopBox,
      ...b.cats.map((c, i) => h('div', { class: 'field' }, h('label', { for: `bac${i}`, text: c }), inputs[i])),
      btn);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      clearTimeout(draftTimer);
      act({ type: 'bacSubmit', answers: values() }); tap();
      sentScreen(root, '✋', 'STOP !', 'Réponses envoyées.');
    });
    root.append(form);
    return {
      update(st) {
        if (st.bac.stopBy && st.bac.stopBy.id !== st.me.id && stopBox.classList.contains('hidden')) {
          stopBox.textContent = `✋ ${st.bac.stopBy.name} a crié STOP ! Dépêche-toi !`;
          stopBox.classList.remove('hidden'); buzz([200, 80, 200]); SFX.beep(true);
        }
      },
    };
  },

  bacReview(root, s) {
    if (s.reviewed) {
      center(root).append(h('div', { class: 'big-emoji', text: '⚖️' }), h('h1', { text: 'Vérification terminée' }), h('p', { text: 'On attend les autres arbitres…' }), timerBar());
      return;
    }
    const b = s.bac;
    root.append(h('h1', { text: '⚖️ Vérification' }), h('p', { text: 'Touche « Contester » si une réponse te paraît fausse. Si la majorité conteste, elle vaut 0.' }), timerBar());
    b.cats.forEach((c, ci) => {
      const entries = s.entries.filter((e) => e.ci === ci);
      if (!entries.length) return;
      root.append(h('h2', { class: 'bac-cat-title', text: c }),
        h('div', { class: 'bac-list' }, ...entries.map((e) => {
          let on = e.rejected;
          const btn = (!e.mine && e.auto === 'ok') ? h('button', {
            class: `chip${on ? ' on-bad' : ''}`, onclick: (ev) => { on = !on; tap(); act({ type: 'bacReject', id: e.id, on }); ev.currentTarget.classList.toggle('on-bad', on); ev.currentTarget.textContent = on ? '❌ Contestée' : 'Contester'; },
          }, on ? '❌ Contestée' : 'Contester') : '';
          return h('div', { class: `bac-entry${e.auto === 'bad' ? ' bad' : ''}` }, avatarEl(e.author, 'sm'),
            h('span', { class: 'txt', text: e.text }),
            e.auto === 'bad' ? h('small', { text: 'mauvaise lettre' }) : e.mine ? h('small', { text: 'toi' }) : btn);
        })));
    });
    root.append(h('button', { class: 'btn gold big', style: 'margin-top:8px', onclick: () => { act({ type: 'bacReviewed' }); tap(); sentScreen(root, '⚖️', 'Merci, arbitre !', 'On attend les autres.'); } }, 'J’ai fini de vérifier ✓'));
  },

  bacReveal(root, s) {
    const b = s.bac;
    resultScreen(root, s.total > 0 ? true : false, s.total >= 400 ? '🏆' : s.total > 0 ? '📝' : '😶', `Manche ${b.round} : +${fmt(s.total)} pts`);
    root.append(h('div', { class: 'mini-board' }, ...s.mine.map((e) => h('div', {},
      h('span', { class: 'n', text: `${b.cats[e.ci]} : ${e.text || '—'}` }), h('b', { text: e.points ? `+${e.points}` : '0' })))));
  },

  // ================= L'Imposteur =================
  undClues(root, s) {
    center(root);
    if (!s.inGame) { root.append(h('div', { class: 'big-emoji', text: '🍿' }), h('h1', { text: 'Partie en cours' }), h('p', { text: 'Tu joueras à la prochaine partie. Profite du spectacle !' })); return; }
    if (!s.alive) { root.append(h('div', { class: 'big-emoji', text: '👻' }), h('h1', { text: 'Tu es éliminé·e' }), h('p', { text: `Ton mot était « ${s.word} ». Chut, ne dis rien !` })); return; }
    let shown = false;
    const card = h('button', { class: 'secret-card word-card', onclick: () => { shown = !shown; paint(); tap(); } });
    function paint() {
      card.replaceChildren(h('small', { text: shown ? 'Ton mot secret (touche pour cacher)' : 'Touche pour voir ton mot secret' }), h('b', { text: shown ? s.word : '• • • • •' }));
    }
    paint();
    root.append(h('h1', { text: 'Tour d’indices 🗣️' }), card,
      h('p', { text: 'Dis UN mot à voix haute pour décrire ton mot, sans le donner. Attention : quelqu’un a un mot différent… et ce n’est peut-être pas toi !' }),
      h('div', { class: 'order-phone' }, ...s.order.map((p, i) => h('div', { class: p.id === s.me.id ? 'me' : '' }, h('b', { text: `${i + 1}.` }), avatarEl(p, 'sm'), h('span', { text: p.name })))),
      timerBar());
  },

  undVote(root, s) {
    if (!s.alive) { center(root).append(h('div', { class: 'big-emoji', text: '👻' }), h('h1', { text: 'Les vivants votent…' }), timerBar()); return; }
    if (s.myVote) { center(root).append(h('div', { class: 'big-emoji', text: '🗳️' }), h('h1', { text: 'Vote enregistré' }), timerBar()); return; }
    root.append(h('h1', { text: 'Qui est l’imposteur ?' }), h('p', { text: `Ton mot : « ${s.word} »` }), timerBar(),
      h('div', { class: 'cand-grid' }, ...s.candidates.map((c) => h('button', {
        class: 'cand', onclick: () => { act({ type: 'vote', target: c.id }); tap(); sentScreen(root, '🗳️', `Vote contre ${c.name}`, 'Suspense…'); },
      }, avatarEl(c), h('span', { class: 'nm', text: c.name })))));
  },

  undReveal(root, s) {
    center(root).append(h('div', { class: 'big-emoji', style: 'animation:pulse .5s infinite', text: '🥁' }), h('h1', { text: 'Verdict…' }));
    setTimeout(() => {
      if (state.key !== s.key) return;
      root.replaceChildren();
      if (!s.out) resultScreen(root, null, '⚖️', 'Égalité !', '', 'Personne n’est éliminé.');
      else if (s.itsMe) resultScreen(root, null, s.outRole === 'impostor' ? '😱' : '😇', 'Tu es éliminé·e !', '', s.outRole === 'impostor' ? 'Tu étais l’imposteur…' : 'Et tu étais innocent·e !');
      else resultScreen(root, null, s.outRole === 'impostor' ? '🎯' : '😬', `${s.out.name} est éliminé·e`, '', s.outRole === 'impostor' ? 'C’était l’imposteur !' : 'Ce n’était pas l’imposteur…');
    }, 1500);
  },

  undEnd(root, s) {
    if (!s.inGame) { resultScreen(root, null, '🍿', s.winner === 'civil' ? 'Les citoyens gagnent !' : 'L’imposteur gagne !'); return; }
    const imp = s.role === 'impostor';
    resultScreen(root, s.iWon, s.iWon ? '🏆' : '😵', s.iWon ? 'Victoire !' : 'Défaite…', s.gain ? `+${fmt(s.gain)}` : '',
      imp ? 'Tu étais l’IMPOSTEUR 😈' : 'Tu étais citoyen·ne 😇');
    root.append(h('div', { class: 'mini-board' },
      h('div', {}, h('span', { class: 'n', text: 'Mot des citoyens' }), h('b', { text: s.words.civil })),
      h('div', {}, h('span', { class: 'n', text: 'Mot de l’imposteur' }), h('b', { text: s.words.impostor }))));
  },

  // ================= Mot mystère =================
  penduPlay(root, s) {
    const masked = h('div', { class: 'p-mask' });
    const info = h('p');
    const keys = h('div', { class: 'keyboard' });
    const guessBox = h('div', { class: 'guess-box' });
    let cooldownUntil = 0;
    root.append(h('div', { class: 'bac-head' }, h('b', { text: `Mot ${s.pendu.index}/${s.pendu.total}` }), h('span', { class: 'chip', text: `Indice : ${s.pendu.hint}` })),
      timerBar(), masked, info, keys, guessBox);

    const letters = 'AZERTYUIOPQSDFGHJKLMWXCVBN'.split('');
    const btns = letters.map((l) => h('button', {
      class: 'key', text: l,
      onclick: () => {
        if (Date.now() < cooldownUntil) { buzz(30); return; }
        act({ type: 'letter', l }); tap();
        cooldownUntil = Date.now() + 2500;
        keys.classList.add('cool');
        setTimeout(() => keys.classList.remove('cool'), 2500);
      },
    }));
    keys.append(...btns);

    function paintGuess(locked) {
      if (locked) { guessBox.replaceChildren(h('small', { text: 'Tu as déjà tenté ta chance pour ce mot.' })); return; }
      const input = h('input', { type: 'text', maxlength: '40', placeholder: 'Le mot entier…', autocomplete: 'off' });
      guessBox.replaceChildren(h('form', {
        class: 'guess-form', onsubmit: (e) => { e.preventDefault(); if (input.value.trim()) { act({ type: 'guess', text: input.value }); tap(); input.value = ''; } },
      }, input, h('button', { class: 'btn', type: 'submit' }, 'Je tente !')));
    }
    let lockedShown = null;
    return {
      update(st) {
        const pe = st.pendu;
        masked.textContent = st.mask.map((c) => (c === null ? '_' : c === ' ' ? ' ' : c)).join(' ');
        info.textContent = `Erreurs : ${pe.errors} / ${pe.max}`;
        btns.forEach((b) => {
          const l = b.textContent;
          b.disabled = pe.tried.includes(l);
          b.classList.toggle('good', pe.good.includes(l));
          b.classList.toggle('bad', pe.tried.includes(l) && !pe.good.includes(l));
        });
        if (lockedShown !== st.locked) { lockedShown = st.locked; paintGuess(st.locked); }
      },
    };
  },

  penduReveal(root, s) {
    resultScreen(root, s.iSolved ? true : s.solver ? null : false, s.iSolved ? '🏆' : s.solver ? '🔤' : '💀',
      s.iSolved ? 'Tu as trouvé !' : s.solver ? `${s.solver.name} a trouvé !` : 'Perdu !', '', `Le mot était : ${s.word}`);
  },

  // ================= L'Estimation =================
  estAsk(root, s) {
    if (s.mine != null) {
      center(root).append(h('div', { class: 'big-emoji', text: '🎯' }), h('h1', { text: `Ta réponse : ${fmt(s.mine)} ${s.est.unit}` }), h('p', { text: 'Verdict sur le grand écran !' }), timerBar());
      return;
    }
    const input = h('input', { type: 'text', inputmode: 'decimal', id: 'est', autocomplete: 'off', placeholder: 'Ton estimation', class: 'est-input' });
    const err = h('div', { class: 'error hidden' });
    const form = h('form', { class: 'pview', style: 'animation:none', novalidate: true },
      h('b', { text: `Question ${s.est.index}/${s.est.total}` }), timerBar(),
      h('div', { class: 'p-q', text: s.est.text }),
      h('div', { class: 'est-field' }, input, s.est.unit ? h('span', { text: s.est.unit }) : ''),
      err, h('button', { class: 'btn gold big', type: 'submit' }, 'Valider 🎯'));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = Number(input.value.replace(/[\s  ]/g, '').replace(',', '.'));
      if (input.value.trim() === '' || !Number.isFinite(v)) { err.textContent = 'Tape un nombre.'; err.classList.remove('hidden'); return; }
      act({ type: 'guess', value: String(v) }); tap();
      sentScreen(root, '🎯', `${fmt(v)} ${s.est.unit}`, 'Réponse envoyée !');
    });
    root.append(form);
    setTimeout(() => input.focus(), 150);
  },

  estReveal(root, s) {
    const m = s.mine;
    const sub = `Bonne réponse : ${fmt(s.est.answer)} ${s.est.unit}`;
    if (!m) { resultScreen(root, null, '⏱️', 'Pas de réponse', '', sub); return; }
    resultScreen(root, m.gained > 0, m.diff === 0 ? '🎯' : m.rank === 1 ? '🥇' : m.gained ? '👍' : '😅',
      m.diff === 0 ? 'PILE !' : `${m.rank}e sur ${s.count}`, m.gained ? `+${fmt(m.gained)}` : '', `${sub} · toi : ${fmt(m.value)}`);
  },
});

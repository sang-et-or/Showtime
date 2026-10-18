// Téléphones : « L'Île des Défis » (tribus, épreuves, vote secret au conseil, finale des poteaux).
/* global h, avatarEl, SFX, buzz, act, center, timerBar, PVIEWS, sentScreen, resultScreen, tap, SHAPES, state */

const tribeChip = (t) => (t ? h('span', { class: 'chip ile-chip', style: `--tc:${t.color}`, text: `${t.icon} ${t.name}` }) : '');
const juryScreen = (root, s) => {
  center(root).append(h('div', { class: 'big-emoji', text: '🪑' }), h('h1', { text: 'Tu es au jury' }), h('p', { text: 'Regarde l’aventure sur le grand écran !' }), tribeChip(s.ile.tribe));
};

Object.assign(PVIEWS, {
  ileIntro(root, s) {
    SFX.fanfare(); buzz([100, 50, 100]);
    const t = s.ile.tribe;
    center(root).append(h('small', { text: 'Ta tribu :' }), h('div', { class: 'ile-big-tribe', style: `--tc:${t?.color}` }, h('span', { text: t?.icon }), h('b', { text: t?.name })),
      h('p', { text: 'Avec toi :' }), h('div', { class: 'votes-list' }, ...s.mates.map((m) => h('div', { class: 'vote-pill' }, avatarEl(m, 'sm'), h('span', { text: m.name })))));
  },

  ileChallenge(root, s) {
    if (!s.playing) { juryScreen(root, s); return; }
    center(root);
    if (s.stage === 'ready') {
      buzz([60, 60, 60]);
      root.append(tribeChip(s.ile.tribe), h('div', { class: 'big-emoji pop', text: s.challenge.icon }), h('h1', { text: s.challenge.title }),
        h('p', { text: s.kind === 'tap' ? 'Au top, tape le plus vite possible sur le gros bouton !' : s.kind === 'hold' ? 'Au top, pose ton doigt sur le bouton et ne le lâche plus !' : 'Réponds vite et bien : chaque bonne réponse compte pour ta tribu !' }), timerBar());
      return;
    }
    // ----- La course aux noix de coco : tapes rapides -----
    if (s.kind === 'tap') {
      let n = s.myTaps || 0; let sent = n;
      const count = h('div', { class: 'ile-count', text: String(n) });
      const btn = h('button', { class: 'ile-tap', 'aria-label': 'Taper' }, '🥥');
      btn.addEventListener('pointerdown', (e) => { e.preventDefault(); n++; count.textContent = String(n); btn.classList.remove('hit'); void btn.offsetWidth; btn.classList.add('hit'); if (n % 5 === 0) buzz(10); });
      const iv = setInterval(() => { if (state?.phase !== 'ileChallenge' || state.kind !== 'tap') { clearInterval(iv); return; } if (n !== sent) { sent = n; act({ type: 'taps', n }); } }, 400);
      root.append(tribeChip(s.ile.tribe), h('h1', { text: 'Tape ! Tape ! Tape !' }), timerBar(), btn, count);
      return;
    }
    // ----- Les poteaux : garder le doigt appuyé -----
    if (s.kind === 'hold') {
      if (s.holdOut) { resultScreen(root, false, '🪵', 'Tu as lâché !', '', 'Encourage ceux qui tiennent encore…'); return; }
      const status = h('p', { class: 'ile-hold-status' });
      const btn = h('button', { class: `ile-hold${s.holding ? ' on' : ''}`, 'aria-label': 'Garder le doigt appuyé' }, h('span', { text: s.holding ? '✋' : '👇' }), h('b', { text: s.holding ? 'TIENS BON !' : 'Appuie et garde le doigt ici' }));
      let pressed = !!s.holding;
      const release = () => { if (!pressed) return; pressed = false; act({ type: 'release' }); buzz(300); };
      btn.addEventListener('pointerdown', (e) => { e.preventDefault(); if (pressed) return; pressed = true; btn.setPointerCapture?.(e.pointerId); act({ type: 'hold' }); buzz(40); btn.classList.add('on'); btn.querySelector('b').textContent = 'TIENS BON !'; btn.querySelector('span').textContent = '✋'; });
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
      const onHide = () => { if (document.hidden) release(); };
      document.addEventListener('visibilitychange', onHide, { once: true });
      root.append(tribeChip(s.ile.tribe), h('h1', { text: s.final ? 'Épreuve finale !' : 'Les poteaux' }), btn, status);
      let fell = false;
      return { update(st) { if (fell) return; if (st.holdOut) { fell = true; root.replaceChildren(); resultScreen(root, false, '🪵', 'Tu as lâché !', '', 'Encourage ceux qui tiennent encore…'); return; } status.textContent = `${st.stillHolding} aventurier${st.stillHolding > 1 ? 's' : ''} encore en place`; } };
    }
    // ----- Le défi des sages : quiz -----
    if (!s.q) { root.append(h('div', { class: 'big-emoji', text: '🧠' }), h('h1', { text: 'Le défi des sages' })); return; }
    if (s.myAnswer != null) { sentScreen(root, '🧠', 'Réponse envoyée', 'Question suivante dans un instant…'); return; }
    root.classList.remove('center');
    root.append(h('b', { text: `Question ${s.q.index}/${s.q.total}` }), timerBar(), h('div', { class: 'p-q', text: s.q.text }),
      h('div', { class: 'p-btns ile-btns' }, ...s.q.choices.map((c, i) => h('button', { class: `p-btn c${i}`, onclick: () => { act({ type: 'answer', choice: i }); tap(); sentScreen(root, '🧠', 'Réponse envoyée', 'Question suivante dans un instant…'); } },
        h('span', { class: 'shape', text: SHAPES[i] }), h('span', { text: c })))));
  },

  ileResult(root, s) {
    if (s.ile.out) { juryScreen(root, s); return; }
    resultScreen(root, s.won, s.won ? '🏆' : '😬', s.won ? 'Ta tribu gagne !' : `${s.winnerTribe.name} gagnent…`, s.won ? '+150' : '', s.won ? 'Tu es à l’abri ce soir.' : 'Direction le conseil…');
  },

  ileVote(root, s) {
    center(root);
    if (s.ile.out) { juryScreen(root, s); return; }
    if (!s.voter) { root.append(h('div', { class: 'big-emoji', text: '😌' }), h('h1', { text: `${s.tribeVoting.name} votent…` }), h('p', { text: 'Ta tribu est à l’abri ce soir.' }), timerBar()); return; }
    if (s.voted) { sentScreen(root, '🔥', 'Vote enregistré', 'Le dépouillement va commencer…'); return; }
    buzz([100, 60, 100]);
    root.append(h('div', { class: 'big-emoji ile-torch', text: '🔥' }), h('h1', { text: 'Ton vote secret' }), h('p', { text: 'Qui doit quitter l’île ?' }), timerBar(),
      h('div', { class: 'cand-grid' }, ...s.candidates.map((c) => h('button', { class: 'cand', onclick: () => { act({ type: 'vote', target: c.id }); tap(); sentScreen(root, '🔥', 'Vote enregistré', 'Le dépouillement va commencer…'); } },
        avatarEl(c), h('span', { class: 'nm', text: c.name })))));
  },

  ileCouncil(root, s) {
    center(root).append(h('div', { class: 'big-emoji ile-torch', text: '🔥' }), h('h1', { text: 'Dépouillement…' }), h('p', { text: 'Regarde le grand écran !' }));
    if (s.iAmOut) {
      setTimeout(() => {
        if (state?.phase !== 'ileCouncil') return;
        root.replaceChildren(h('div', { class: 'big-emoji pop', text: '🕯️' }), h('h1', { text: 'Tu quittes l’île…' }), h('p', { text: 'Mais tu restes avec nous au jury ! Tes points sont conservés.' }));
        SFX.wrong(); buzz(400);
      }, 800 + s.ballots * s.stepMs + 1200);
    }
  },

  ileEnd(root, s) {
    resultScreen(root, s.iWon ? true : null, s.iWon ? '🏆' : '🏝️', s.iWon ? 'Tu es le survivant !' : s.winner ? `${s.winner.name} gagne l’aventure !` : 'Fin de l’aventure', s.iWon ? '+600' : '');
  },
});

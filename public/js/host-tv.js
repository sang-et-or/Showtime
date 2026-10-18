// Écrans télé des « Jeux télé » : Lettre à Lettre, Mot pour Mot, Le Grand Sondage, La Roue des Lettres.
/* global h, avatarEl, SFX, later, fmt, VIEWS, head, confetti */

// =====================================================================
// Lettre à Lettre (grille de mots)
// =====================================================================
function motusGrid(M, opts = {}) {
  const grid = h('div', { class: 'mt-grid', style: `--len:${M.len}` });
  for (let r = 0; r < M.max; r++) {
    const row = M.rows[r];
    const isNext = !row && r === M.rows.length && !opts.done;
    for (let c = 0; c < M.len; c++) {
      const cell = row ? row.cells[c] : null;
      const letter = cell ? cell.l : isNext ? (M.known[c] || '•') : '';
      const el = h('div', { class: `mt-cell${cell ? ` ${cell.st}` : ''}${isNext && M.known[c] ? ' hint' : ''}`, text: letter });
      if (row && r === M.rows.length - 1 && opts.animateLast) { el.style.animationDelay = `${c * 0.12}s`; el.classList.add('flip'); }
      grid.append(el);
    }
  }
  return grid;
}

Object.assign(VIEWS, {
  motusPlay(root, s) {
    SFX.whoosh();
    const box = h('div', { class: 'mt-wrap' });
    const side = h('div', { class: 'mt-side' });
    root.append(head(`🟥 Lettre à Lettre · ${s.motus.len} lettres`, `Mot ${s.motus.index} / ${s.motus.total}`), h('div', { class: 'mt-main' }, box, side));
    return {
      update(st, prev) {
        const fresh = prev && prev.motus && st.motus.rows.length > prev.motus.rows.length;
        box.replaceChildren(motusGrid(st.motus, { animateLast: fresh }));
        if (fresh) st.motus.rows[st.motus.rows.length - 1].cells.forEach((c, k) => later(k * 120, () => (c.st === 'ok' ? SFX.blip() : c.st === 'mis' ? SFX.tick() : SFX.tock())));
        side.replaceChildren(st.active ? avatarEl(st.active, 'lg') : '', h('b', { text: st.active ? `À toi, ${st.active.name} !` : '' }),
          h('small', { text: '📱 Propose un mot sur ton téléphone' }),
          h('div', { class: 'mt-legend' }, h('span', { class: 'mt-cell ok', text: 'A' }), h('small', { text: 'bien placée' }), h('span', { class: 'mt-cell mis', text: 'B' }), h('small', { text: 'mal placée' })));
      },
    };
  },
  motusReveal(root, s) {
    (s.solver ? SFX.fanfare : SFX.wrong)();
    if (s.solver) confetti(2000);
    root.append(head(`🟥 Lettre à Lettre`, `Mot ${s.motus.index} / ${s.motus.total}`),
      h('div', { class: 'mt-main' }, h('div', { class: 'mt-wrap' }, motusGrid(s.motus, { done: true })),
        h('div', { class: 'mt-side' }, h('small', { text: 'Le mot était' }), h('div', { class: 'reveal-word pop', text: s.word }),
          s.solver ? h('div', { class: 'duo pop' }, avatarEl(s.solver, ''), h('b', { text: `${s.solver.name} +${s.pts}` })) : h('p', { class: 'spot-sub', text: 'Personne ne l’a trouvé…' }))));
  },
});

// =====================================================================
// Mot pour Mot (pyramide d'indices)
// =====================================================================
function mpmPyramid(M, extra) {
  const step = M.clues.length;
  const pyr = h('div', { class: 'mpm-pyr' }, ...M.values.map((v, k) => h('div', {
    class: `mpm-step${k < step - (extra ? 0 : 1) ? ' used' : ''}${k === step - 1 || (extra && k === step) ? ' now' : ''}`, style: `--w:${100 - k * 18}%`,
  }, h('b', { text: String(v) }), h('span', { text: M.clues[k] ? `« ${M.clues[k]} »` : '' }))).reverse());
  return pyr;
}

Object.assign(VIEWS, {
  mpmClue(root, s) {
    SFX.whoosh();
    const M = s.mpm;
    root.append(head('🔺 Mot pour Mot', `Mot ${M.index} / ${M.total}`),
      h('div', { class: 'mpm-main' }, mpmPyramid(M, true),
        h('div', { class: 'mpm-side' }, avatarEl(M.giver, 'lg'), h('b', { text: `${M.giver?.name || ''} cherche un indice…` }),
          h('div', { class: 'mpm-blanks', text: '_ '.repeat(M.letters).trim() }), h('small', { text: `📱 Un seul mot, pour ${M.values[M.clues.length] || 0} points` }))));
  },
  mpmGuess(root, s) {
    SFX.reveal();
    const M = s.mpm;
    const strip = h('div', { class: 'mpm-guesses' });
    root.append(head('🔺 Mot pour Mot', `Mot ${M.index} / ${M.total}`),
      h('div', { class: 'mpm-main' }, mpmPyramid(M, false),
        h('div', { class: 'mpm-side' }, h('small', { text: `Indice de ${M.giver?.name || ''}` }), h('div', { class: 'mpm-clue pop', text: M.clues[M.clues.length - 1] }),
          h('div', { class: 'mpm-blanks', text: '_ '.repeat(M.letters).trim() }), h('small', { text: '📱 Une seule réponse par indice !' }), strip)));
    return {
      update(st, prev) {
        if (prev?.mpm && st.mpm.guesses.length > prev.mpm.guesses.length) SFX.wrong();
        strip.replaceChildren(...st.mpm.guesses.map((g) => h('div', { class: 'vote-pill ko' }, avatarEl(g.who, 'sm'), h('span', { text: `« ${g.text} » ✗` }))));
      },
    };
  },
  mpmReveal(root, s) {
    (s.finder ? SFX.fanfare : SFX.wrong)();
    if (s.finder) confetti(2000);
    const M = s.mpm;
    root.append(head('🔺 Mot pour Mot', `Mot ${M.index} / ${M.total}`),
      h('div', { class: 'spot' }, h('div', { class: 'spot-sub', text: 'Le mot secret était' }), h('div', { class: 'reveal-word pop', text: s.word }),
        s.finder ? h('div', { class: 'duo pop' }, avatarEl(s.finder, ''), avatarEl(M.giver, ''), h('b', { text: `${s.finder.name} et ${M.giver.name} : +${s.pts} chacun !` }))
          : h('p', { class: 'spot-sub', text: 'Personne n’a trouvé…' }),
        h('div', { class: 'chips-line' }, ...M.clues.map((c) => h('span', { class: 'chip', text: c })))));
  },
});

// =====================================================================
// Le Grand Sondage (tableau de réponses)
// =====================================================================
function sdBoard(board, prevBoard) {
  return h('div', { class: 'sd-board' }, ...board.map((r, k) => {
    const isNew = r.label && prevBoard && !prevBoard[k]?.label;
    return h('div', { class: `sd-row${r.label ? ' open' : ''}${isNew ? ' flip' : ''}${r.label && !r.by ? ' missed' : ''}` },
      h('span', { class: 'sd-n', text: String(k + 1) }),
      h('span', { class: 'sd-label', text: r.label || '' }),
      r.by ? avatarEl(r.by, 'sm') : h('span'),
      h('b', { class: 'sd-pts', text: r.pts != null ? String(r.pts) : '' }));
  }));
}

Object.assign(VIEWS, {
  sdAsk(root, s) {
    SFX.whoosh();
    const boardBox = h('div');
    const strikes = h('div', { class: 'sd-strikes' });
    const bigX = h('div', { class: 'sd-bigx hidden', text: '✗' });
    root.append(head('📊 Le Grand Sondage', `Question ${s.sd.index} / ${s.sd.total}`),
      h('div', { class: 'sd-q' }, h('small', { text: 'Nous avons demandé à 100 personnes :' }), h('b', { text: s.sd.q })),
      boardBox, strikes, bigX);
    return {
      update(st, prev) {
        boardBox.replaceChildren(sdBoard(st.board, prev?.board));
        const newFound = prev?.board && st.board.some((r, k) => r.label && !prev.board[k]?.label);
        if (newFound) SFX.correct();
        if (prev?.strikes && st.strikes.length > prev.strikes.length && !newFound) {
          SFX.wrong();
          bigX.classList.remove('hidden', 'pop'); void bigX.offsetWidth; bigX.classList.add('pop');
          later(700, () => bigX.classList.add('hidden'));
        }
        strikes.replaceChildren(...st.strikes.map((x) => h('div', { class: 'vote-pill ko' }, avatarEl(x.who, 'sm'), h('span', { text: `« ${x.text} » ✗` }))));
      },
    };
  },
  sdReveal(root, s) {
    SFX.reveal();
    root.append(head('📊 Le Grand Sondage', `Question ${s.sd.index} / ${s.sd.total}`),
      h('div', { class: 'sd-q' }, h('small', { text: 'Nous avons demandé à 100 personnes :' }), h('b', { text: s.sd.q })),
      sdBoard(s.board, null));
  },
});

// =====================================================================
// La Roue des Lettres (roue + tableau de lettres)
// =====================================================================
const RL_COLORS = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
function rlWheel(values) {
  const n = values.length;
  const seg = 360 / n;
  const color = (v, i) => (v === 'BANQUEROUTE' ? '#111827' : v === 'PASSE' ? '#f8fafc' : RL_COLORS[i % RL_COLORS.length]);
  const disc = h('div', { class: 'rlw-disc', style: `background:conic-gradient(${values.map((v, i) => `${color(v, i)} ${i * seg}deg ${(i + 1) * seg}deg`).join(',')})` },
    ...values.map((v, i) => h('b', { class: v === 'PASSE' ? 'dark' : '', style: `--a:${i * seg + seg / 2}deg`, text: v === 'BANQUEROUTE' ? '💸' : v === 'PASSE' ? 'PASSE' : String(v) })));
  const el = h('div', { class: 'rl-wheel' }, h('i', { class: 'lw-pin' }), disc, h('div', { class: 'lw-hub', text: '🎡' }));
  let angle = 0; let last = null;
  return {
    el,
    spin(slot, key) {
      if (key === last || slot == null) return;
      last = key;
      SFX.drumroll(2);
      const target = 360 - (slot * seg + seg / 2);
      angle += 360 * 5 + ((target - (angle % 360)) + 360) % 360;
      disc.style.transform = `rotate(${angle}deg)`;
    },
    set(slot) { if (slot == null) return; angle = 360 - (slot * seg + seg / 2); disc.style.transition = 'none'; disc.style.transform = `rotate(${angle}deg)`; void disc.offsetWidth; disc.style.transition = ''; },
  };
}

/** Tableau de lettres façon jeu télé : les mots ne sont jamais coupés en fin de ligne. */
function rlBoard(cells, width = 14) {
  let cur = [];
  const lines = [];
  let word = [];
  const flush = () => { if (!word.length) return; if (cur.length && cur.length + 1 + word.length > width) { lines.push(cur); cur = []; } if (cur.length) cur.push(' '); cur.push(...word); word = []; };
  cells.forEach((c) => { if (c === ' ') flush(); else word.push(c); });
  flush(); if (cur.length) lines.push(cur);
  return h('div', { class: 'rl-board', style: `--w:${width}` }, ...lines.map((line) => h('div', { class: 'rl-line' },
    ...line.map((c) => (c === ' ' ? h('span', { class: 'rl-cell space' }) : h('span', { class: `rl-cell${c === null ? '' : ' on'}${c && !/[A-Z]/.test(c) ? ' sym' : ''}`, text: c || '' }))))));
}

Object.assign(VIEWS, {
  rlTurn(root, s) {
    SFX.whoosh();
    const wheel = rlWheel(s.rl.wheel);
    wheel.set(s.rl.spin?.slot ?? null);
    const boardBox = h('div', { class: 'rl-board-wrap' });
    const info = h('div', { class: 'rl-info' });
    const banks = h('div', { class: 'side-list' });
    const logBox = h('div', { class: 'pendu-log' });
    const used = h('div', { class: 'tried' });
    root.append(head(`🎡 La Roue des Lettres · ${s.rl.cat}`, `Énigme ${s.rl.index} / ${s.rl.total}`),
      h('div', { class: 'rl-main' }, h('div', { class: 'rl-left' }, boardBox, used, logBox), h('div', { class: 'rl-right' }, wheel.el, info, banks)));
    let lastSeq = s.rl.spinSeq;
    return {
      update(st, prev) {
        const R = st.rl;
        if (R.spinSeq !== lastSeq && R.spin) { lastSeq = R.spinSeq; wheel.spin(R.spin.slot, R.spinSeq); }
        if (prev?.rl && R.cells.filter(Boolean).length > prev.rl.cells.filter(Boolean).length) SFX.correct();
        boardBox.replaceChildren(rlBoard(R.cells));
        used.replaceChildren(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((l) => h('span', { class: `k${R.used.includes(l) ? (R.cells.includes(l) ? ' good' : ' bad') : ''}`, text: l })));
        const v = R.spin?.value;
        info.replaceChildren(st.active ? avatarEl(st.active, '') : '', h('div', {}, h('b', { text: st.active ? `À ${st.active.name} !` : '' }),
          h('small', { text: st.stage === 'spin' ? '📱 Tourne la roue, achète une voyelle ou résous !' : st.stage === 'spinning' ? 'La roue tourne…' : st.stage === 'letter' ? `${v} points par lettre : une consonne ?` : '' })));
        banks.replaceChildren(...R.bank.map((b) => h('div', { class: `side-row${b.player.id === st.active?.id ? ' active' : ''}` }, avatarEl(b.player, 'sm'), h('div', { class: 'side-txt' }, h('b', { text: b.player.name }), h('small', { text: `💰 ${fmt(b.v)}` })))));
        logBox.replaceChildren(...R.log.map((e) => h('div', { class: `gain ${e.ok ? 'ok' : 'ko'}` }, avatarEl(e.who, 'sm'), h('span', { text: e.text }))));
      },
    };
  },
  rlReveal(root, s) {
    (s.solver ? SFX.fanfare : SFX.wrong)();
    if (s.solver) confetti(2500);
    root.append(head(`🎡 La Roue des Lettres · ${s.rl.cat}`, `Énigme ${s.rl.index} / ${s.rl.total}`),
      h('div', { class: 'spot' }, rlBoard(s.rl.cells),
        s.solver ? h('div', { class: 'duo pop' }, avatarEl(s.solver, ''), h('b', { text: `${s.solver.name} résout l’énigme : +${fmt(s.pts)} !` }))
          : h('p', { class: 'spot-sub', text: 'Personne n’a résolu l’énigme…' })));
  },
});

// =====================================================================
// Les Tourtereaux (duos qui devinent les réponses l'un de l'autre)
// =====================================================================
function tzCard(p, mode) {
  const names = p.members.map((m) => m.name).join(' & ');
  const card = h('div', { class: `tz-card${mode === 'reveal' ? (p.ok ? ' ok' : ' ko') : ''}` },
    h('div', { class: 'tz-duo' }, ...p.members.map((m) => { const a = avatarEl(m, 'sm'); if (mode === 'write' && !p.written.includes(m.id)) a.classList.add('wait'); return a; }), h('b', { text: names })),
    h('div', { class: 'tz-q', text: p.q }));
  if (mode !== 'write') {
    card.append(h('div', { class: 'tz-answers' },
      h('div', { class: 'tz-ans subject' }, h('small', { text: `${p.subject.name} a répondu` }), h('b', { text: p.answer || '—' })),
      ...p.guesses.map((g) => h('div', { class: `tz-ans${g.auto ? ' same' : ''}` }, h('small', { text: `${g.who?.name || ''} a deviné` }), h('b', { text: g.text || '—' })))));
    if (mode === 'judge' && !p.auto) card.append(h('div', { class: 'tz-votes', text: `👍 ${p.yes}   👎 ${p.no}` }));
    if (mode === 'reveal') card.append(h('div', { class: 'tz-verdict pop', text: p.ok ? '💕 +200 chacun !' : '💔 Raté !' }));
  }
  return card;
}

Object.assign(VIEWS, {
  tzWrite(root, s) {
    SFX.whoosh();
    const grid = h('div', { class: 'tz-grid' });
    root.append(head('💕 Les Tourtereaux', `Manche ${s.tz.round} / ${s.tz.total}`), h('p', { class: 'spot-sub', style: 'text-align:center', text: '📱 Répondez en secret : l’un pour lui-même, l’autre en devinant !' }), grid);
    return { update(st, prev) { if (prev?.pairs && st.pairs.reduce((n, p) => n + p.written.length, 0) > prev.pairs.reduce((n, p) => n + p.written.length, 0)) SFX.blip(); grid.replaceChildren(...st.pairs.map((p) => tzCard(p, 'write'))); } };
  },
  tzJudge(root, s) {
    SFX.reveal();
    const grid = h('div', { class: 'tz-grid' });
    root.append(head('💕 Les Tourtereaux', `Manche ${s.tz.round} / ${s.tz.total}`), h('p', { class: 'spot-sub', style: 'text-align:center', text: s.pairs.length > 1 ? '📱 Le public juge : ça compte ou pas ?' : '📱 Alors, est-ce la bonne réponse ?' }), grid);
    return { update(st) { grid.replaceChildren(...st.pairs.map((p) => tzCard(p, 'judge'))); } };
  },
  tzReveal(root, s) {
    const hits = s.pairs.filter((p) => p.ok).length;
    (hits ? SFX.fanfare : SFX.wrong)();
    root.append(head('💕 Les Tourtereaux', `Manche ${s.tz.round} / ${s.tz.total}`), h('div', { class: 'tz-grid' }, ...s.pairs.map((p) => tzCard(p, 'reveal'))));
  },
});

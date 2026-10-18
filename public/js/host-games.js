// Écrans télé des jeux ajoutés en vague 1 : Défi Surprise, Grand Duel, Petit Bac,
// L'Imposteur, Mot mystère, L'Estimation. Chaque vue reçoit l'état du serveur.
/* global h, avatarEl, SHAPES, SFX, later, fmt, countUp, VIEWS */

const byId = (s) => new Map(s.players.map((p) => [p.id, p]));
const head = (label, count) => h('div', { class: 'q-head' }, h('span', { class: 'chip', text: label }), count ? h('span', { class: 'count', text: count }) : '');
const stars = (avg) => '★'.repeat(Math.round(avg)) + '☆'.repeat(5 - Math.round(avg));

/** Bandeau d'avatars « qui a déjà répondu ». */
function progressStrip(label) {
  const strip = h('div', { class: 'answered-strip', style: 'justify-content:center' });
  return {
    el: strip,
    update(players, doneIds, prevCount) {
      const done = new Set(doneIds);
      if (prevCount != null && done.size > prevCount) SFX.blip();
      strip.replaceChildren(h('span', { class: 'label', text: `${done.size} / ${players.length} ${label}` }),
        ...players.map((p) => { const a = avatarEl(p, 'sm'); if (!done.has(p.id)) a.classList.add('wait'); return a; }));
    },
  };
}

Object.assign(VIEWS, {
  // ================= Défi Surprise =================
  defiGet(root, s) {
    SFX.whoosh();
    const t = s.turn;
    root.append(head('🎭 Défi Surprise', `Défi ${t.index} / ${t.total}`),
      h('div', { class: 'spot' },
        avatarEl(t.performer, 'lg'),
        h('h1', { class: 'spot-title', text: `Au tour de ${t.performer.name} !` }),
        h('div', { class: `kind-badge ${t.kind}`, text: t.kind === 'mime' ? '🤐 MIME' : '🎤 DÉFI' }),
        h('p', { class: 'spot-sub', text: `${t.performer.name}, regarde ton téléphone en cachette… et appuie sur « Je suis prêt·e ».` })));
  },

  defiAct(root, s) {
    const t = s.turn;
    SFX.whoosh();
    if (t.kind === 'mime') {
      root.append(head('🤐 Mime', `Défi ${t.index} / ${t.total}`),
        h('div', { class: 'spot' },
          avatarEl(t.performer, 'lg'),
          h('h1', { class: 'spot-title', text: `${t.performer.name} mime…` }),
          h('div', { class: 'kind-badge mime', text: `Catégorie : ${s.cat}` }),
          h('p', { class: 'spot-sub big', text: '🗣️ Criez vos propositions à voix haute !' })));
    } else {
      root.append(head('🎤 Défi', `Défi ${t.index} / ${t.total}`),
        h('div', { class: 'quote-card panel defi-card' }, h('div', { class: 'prompt', text: `Le défi de ${t.performer.name} :` }), h('div', { class: 'quote plain', text: s.text })),
        h('div', { class: 'spot', style: 'margin-top:1em' }, avatarEl(t.performer, ''), h('p', { class: 'spot-sub', text: 'Regardez bien : vous allez noter la performance !' })));
    }
  },

  defiVote(root, s) {
    const t = s.turn;
    const strip = progressStrip('ont noté');
    root.append(head('⭐ Notez la performance', `Défi ${t.index} / ${t.total}`),
      h('div', { class: 'spot' }, avatarEl(t.performer, 'lg'),
        h('h1', { class: 'spot-title', text: `Combien d’étoiles pour ${t.performer.name} ?` }),
        h('div', { class: 'stars-big', text: '★★★★★' }),
        h('p', { class: 'spot-sub', text: '📱 Votez sur votre téléphone, de 1 à 5 étoiles.' })),
      strip.el);
    return { update(st, prev) { strip.update(st.players.filter((p) => st.judges.includes(p.id)), st.voted, prev?.voted?.length); } };
  },

  defiReveal(root, s) {
    const t = s.turn;
    if (t.kind === 'mime') {
      const found = !!s.finder;
      (found ? SFX.correct : SFX.wrong)();
      root.append(head('🤐 Mime', `Défi ${t.index} / ${t.total}`),
        h('div', { class: 'spot' },
          h('div', { class: 'spot-sub', text: 'Il fallait trouver :' }),
          h('div', { class: 'reveal-word pop', text: s.word }),
          found
            ? h('div', { class: 'duo pop' }, avatarEl(t.performer, ''), h('span', { text: '🤝' }), avatarEl(s.finder, ''),
              h('b', { text: `${s.finder.name} a trouvé ! +${s.finderGain} chacun` }))
            : h('p', { class: 'spot-sub', text: 'Personne n’a trouvé… 0 point.' })));
      if (found) SFX.applause(1.5);
    } else {
      SFX.drumroll(1.2);
      const result = h('div', { class: 'stars-result' });
      later(1300, () => {
        SFX.reveal();
        result.replaceChildren(h('div', { class: 'stars-big pop', text: stars(s.avg || 0) }),
          h('div', { class: 'points pop', text: `${String(s.avg || 0).replace('.', ',')} / 5` }),
          h('b', { text: `+${fmt(s.perfGain)} points pour ${t.performer.name}` }));
        if ((s.avg || 0) >= 4) SFX.applause(2.5);
      });
      root.append(head('🎤 Défi', `Défi ${t.index} / ${t.total}`),
        h('div', { class: 'spot' }, avatarEl(t.performer, 'lg'), h('h1', { class: 'spot-title', text: 'Le verdict du public…' }), result));
    }
  },

  // ================= Grand Duel =================
  duelBet(root, s) {
    SFX.whoosh(); later(300, SFX.fanfare);
    const du = s.duel;
    const bars = h('div', { class: 'bet-bars' });
    const strip = progressStrip('ont misé');
    root.append(head('⚔️ Le Grand Duel', du.total > 1 ? `Duel ${du.index} / ${du.total}` : ''),
      versus(du),
      h('p', { class: 'spot-sub', style: 'text-align:center', text: `Premier à ${du.target} points. Public : misez vos points sur votre champion ! 📱` }),
      bars, strip.el);
    return {
      update(st, prev) {
        const b = st.bets;
        bars.replaceChildren(
          h('div', { class: 'bet-side a', style: `flex:${b.a.total || 1}` }, h('b', { text: `${b.a.count} pari${b.a.count > 1 ? 's' : ''} · ${fmt(b.a.total)} pts` })),
          h('div', { class: 'bet-side b', style: `flex:${b.b.total || 1}` }, h('b', { text: `${b.b.count} pari${b.b.count > 1 ? 's' : ''} · ${fmt(b.b.total)} pts` })));
        strip.update(st.players.filter((p) => st.spectators.includes(p.id)), st.betted, prev?.betted?.length);
      },
    };
  },

  duelQ(root, s) {
    SFX.whoosh();
    const wrongBox = h('div', { class: 'duel-wrong' });
    root.append(scoreBar(s.duel), h('div', { class: 'q-text', text: s.q.text }),
      h('div', { class: 'answers' }, ...s.q.choices.map((c, i) => h('div', { class: `answer c${i}` }, h('span', { class: 'shape', text: SHAPES[i] }), h('span', { text: c })))),
      wrongBox);
    return {
      update(st, prev) {
        if (prev && prev.wrong && st.wrong.length > prev.wrong.length) SFX.wrong();
        const ids = byId(st);
        wrongBox.replaceChildren(...st.wrong.map((id) => h('div', { class: 'gain ko pop' }, avatarEl(ids.get(id), 'sm'), h('span', { text: `${ids.get(id)?.name} s’est trompé·e !` }))));
      },
    };
  },

  duelPoint(root, s) {
    (s.scorerId ? SFX.correct : SFX.wrong)();
    const scorer = s.scorerId ? byId(s).get(s.scorerId) : null;
    root.append(scoreBar(s.duel, s.scorerId), h('div', { class: 'q-text', style: 'animation:none', text: s.q.text }),
      h('div', { class: 'answers' }, ...s.q.choices.map((c, i) => h('div', { class: `answer c${i}${i === s.correct ? ' good' : ' dim'}`, style: 'animation:none' },
        h('span', { class: 'shape', text: i === s.correct ? '✓' : SHAPES[i] }), h('span', { text: c })))),
      h('div', { class: 'duel-wrong' }, h('div', { class: `gain ${scorer ? 'ok' : 'ko'} pop` },
        scorer ? avatarEl(scorer, 'sm') : '', h('b', { text: scorer ? `Point pour ${scorer.name} !` : 'Personne ne marque' }))));
  },

  duelEnd(root, s) {
    const ids = byId(s);
    const w = s.winnerId ? ids.get(s.winnerId) : null;
    SFX.drumroll(1.2);
    later(1300, () => { SFX.fanfare(); if (w) SFX.applause(3); });
    root.append(head('⚔️ Le Grand Duel', ''),
      h('div', { class: 'spot' },
        w ? avatarEl(w, 'lg') : h('div', { class: 'big-emoji', text: '🤝' }),
        h('h1', { class: 'spot-title pop', style: 'animation-delay:1.3s', text: w ? `${w.name} remporte le duel ! +600` : 'Match nul !' }),
        h('div', { class: 'score-final', text: `${s.duel.a.name} ${s.duel.scoreA} – ${s.duel.scoreB} ${s.duel.b.name}` })),
      h('div', { class: 'votes-list' }, ...s.betResults.filter((r) => ids.has(r.id)).map((r, k) => {
        const pill = h('div', { class: `vote-pill ${r.gain > 0 ? 'ok' : r.gain < 0 ? 'ko' : ''}` }, avatarEl(ids.get(r.id), 'sm'),
          h('span', { text: `${ids.get(r.id).name} ${r.gain > 0 ? `+${fmt(r.gain)}` : r.gain < 0 ? `−${fmt(-r.gain)}` : '(remboursé)'}` }));
        pill.style.animationDelay = `${1.8 + k * 0.1}s`;
        return pill;
      })));
  },

  // ================= Petit Bac =================
  bacWrite(root, s) {
    SFX.whoosh(); later(300, SFX.reveal);
    const b = s.bac;
    const grid = h('div', { class: 'cast-grid', style: 'justify-content:center' });
    const stop = h('div', { class: 'stop-banner hidden' });
    root.append(head('📝 Petit Bac', `Manche ${b.round} / ${b.total}`),
      h('div', { class: 'bac-top' },
        h('div', { class: 'letter-ball pop', text: b.letter }),
        h('div', { class: 'bac-cats' }, ...b.cats.map((c, i) => h('div', { class: 'bac-cat rise', style: `animation-delay:${0.2 + i * 0.1}s`, text: c })))),
      stop, grid);
    return {
      update(st, prev) {
        const done = new Set(st.done);
        if (st.bac.stopBy && !(prev && prev.bac && prev.bac.stopBy)) { SFX.beep(true); stop.classList.remove('hidden'); }
        if (st.bac.stopBy) stop.textContent = `✋ STOP ! ${st.bac.stopBy.name} a tout rempli : plus que quelques secondes !`;
        if (prev && prev.done && st.done.length > prev.done.length) SFX.blip();
        grid.replaceChildren(...st.players.filter((p) => p.connected).map((p) => h('div', { class: 'cast-item' },
          avatarEl(p, done.has(p.id) ? '' : 'off'), h('div', { class: 'name', text: p.name }),
          h('div', { class: 'dots', text: done.has(p.id) ? '✓ Fini' : '●'.repeat(st.progress[p.id] || 0) + '○'.repeat(5 - (st.progress[p.id] || 0)) }))));
      },
    };
  },

  bacReview(root, s) {
    SFX.whoosh();
    const wrap = h('div', { class: 'bac-table-wrap' });
    const strip = progressStrip('ont vérifié');
    root.append(head('📝 Vérification', `Lettre ${s.bac.letter}`),
      h('p', { class: 'spot-sub', style: 'text-align:center;margin:0 0 .6em', text: '📱 Une réponse vous semble fausse ? Contestez-la sur votre téléphone. Majorité = refusée.' }),
      wrap, strip.el);
    return {
      update(st, prev) {
        wrap.replaceChildren(bacTable(st, false));
        strip.update(st.players.filter((p) => p.connected), st.reviewed, prev?.reviewed?.length);
      },
    };
  },

  bacReveal(root, s) {
    SFX.reveal(); later(300, SFX.correct);
    root.append(head('📝 Résultats', `Lettre ${s.bac.letter}`), h('div', { class: 'bac-table-wrap' }, bacTable(s, true)));
  },

  // ================= L'Imposteur =================
  undClues(root, s) {
    SFX.whoosh();
    const ids = byId(s);
    const u = s.und;
    root.append(head('🕵️ L’Imposteur', `Partie ${u.g} / ${u.total} · Tour ${u.round}`),
      h('div', { class: 'spot' },
        h('h1', { class: 'spot-title', text: 'Tour d’indices 🗣️' }),
        h('p', { class: 'spot-sub', text: 'Chacun à son tour dit UN seul mot à voix haute pour décrire son mot secret. Ni trop précis… ni trop vague !' }),
        h('div', { class: 'order-row' }, ...u.order.map((id, i) => {
          const p = ids.get(id);
          if (!p) return '';
          const el = h('div', { class: 'order-item rise' }, h('span', { class: 'order-n', text: String(i + 1) }), avatarEl(p, ''), h('div', { class: 'name', text: p.name }));
          el.style.animationDelay = `${i * 0.12}s`;
          return el;
        })),
        h('p', { class: 'hint-host', text: 'Quand tout le monde a parlé, appuyez sur « Suivant ⏭ » pour passer au vote.' })));
  },

  undVote(root, s) {
    SFX.whoosh();
    const strip = progressStrip('ont voté');
    root.append(head('🕵️ L’Imposteur', `Tour ${s.und.round}`),
      h('div', { class: 'spot' }, h('h1', { class: 'spot-title', text: 'Qui est l’imposteur ? 🤔' }), h('p', { class: 'spot-sub', text: '📱 Votez sur votre téléphone pour éliminer un suspect.' })),
      strip.el);
    return { update(st, prev) { strip.update(st.players.filter((p) => st.voters.includes(p.id)), st.voted, prev?.voted?.length); } };
  },

  undReveal(root, s) {
    const ids = byId(s);
    const out = s.outId ? ids.get(s.outId) : null;
    SFX.drumroll(1.4);
    const verdict = h('div', { class: 'spot-sub big' });
    later(1500, () => {
      if (!out) { SFX.wrong(); verdict.textContent = '🤝 Égalité : personne n’est éliminé.'; return; }
      const imp = s.outRole === 'impostor';
      (imp ? SFX.correct : SFX.wrong)();
      verdict.replaceChildren(h('b', { class: imp ? 'result-ok' : 'result-ko', text: imp ? '😱 C’était l’IMPOSTEUR !' : '😇 Ce n’était pas l’imposteur…' }));
    });
    root.append(head('🕵️ L’Imposteur', `Tour ${s.und.round}`),
      h('div', { class: 'spot' },
        out ? avatarEl(out, 'lg') : h('div', { class: 'big-emoji', text: '⚖️' }),
        h('h1', { class: 'spot-title', text: out ? `${out.name} est éliminé·e…` : 'Les votes sont partagés !' }),
        verdict,
        h('div', { class: 'votes-list' }, ...Object.entries(s.tally || {}).map(([id, n]) => ids.get(id)
          ? h('div', { class: 'vote-pill' }, avatarEl(ids.get(id), 'sm'), h('span', { text: `${ids.get(id).name} : ${n} vote${n > 1 ? 's' : ''}` })) : ''))));
  },

  undEnd(root, s) {
    const ids = byId(s);
    const civils = s.winner === 'civil';
    SFX.fanfare(); SFX.applause(2.5);
    root.append(head('🕵️ L’Imposteur', ''),
      h('div', { class: 'spot' },
        h('h1', { class: 'spot-title pop', text: civils ? '🎉 Les citoyens gagnent !' : '😈 L’imposteur gagne !' }),
        h('div', { class: 'words-reveal' },
          h('div', { class: 'word-box' }, h('small', { text: 'Mot des citoyens' }), h('b', { text: s.words.civil })),
          h('div', { class: 'word-box imp' }, h('small', { text: 'Mot de l’imposteur' }), h('b', { text: s.words.impostor }))),
        h('div', { class: 'votes-list' }, ...s.impostors.map((id) => ids.get(id)
          ? h('div', { class: 'vote-pill ko' }, avatarEl(ids.get(id), 'sm'), h('span', { text: `${ids.get(id).name} était l’imposteur` })) : '')),
        h('p', { class: 'spot-sub', text: civils ? '+500 pour chaque citoyen' : '+1 200 pour l’imposteur' })));
  },

  // ================= Mot mystère =================
  penduPlay(root, s) {
    SFX.whoosh();
    const word = h('div', { class: 'word-tiles' });
    const gallows = h('div', { class: 'gallows' });
    const letters = h('div', { class: 'tried' });
    const log = h('div', { class: 'pendu-log' });
    root.append(head(`🔤 Indice : ${s.pendu.hint}`, `Mot ${s.pendu.index} / ${s.pendu.total}`),
      h('div', { class: 'pendu-main' }, gallows, h('div', { class: 'pendu-right' }, word, letters, log)));
    return {
      update(st, prev) {
        const pe = st.pendu;
        if (prev && prev.pendu) {
          if (pe.good.length > prev.pendu.good.length) SFX.correct();
          else if (pe.errors > prev.pendu.errors) SFX.wrong();
        }
        word.replaceChildren(...st.mask.map((ch) => (ch === ' ' ? h('span', { class: 'gap' })
          : h('span', { class: `tile${ch === null ? '' : ' on'}${/[A-ZÀ-Ü]/i.test(ch || 'A') ? '' : ' sym'}`, text: ch === null ? '' : ch }))));
        gallows.replaceChildren(gallowsSvg(pe.errors), h('div', { class: 'err-count', text: `${pe.errors} / ${pe.max} erreurs` }));
        letters.replaceChildren(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((l) => h('span', {
          class: `k${pe.good.includes(l) ? ' good' : pe.tried.includes(l) ? ' bad' : ''}`, text: l,
        })));
        log.replaceChildren(...pe.log.map((e) => h('div', { class: `gain ${e.ok ? 'ok' : 'ko'}` }, avatarEl(e.who, 'sm'),
          h('span', { text: e.guess ? (e.ok ? 'a trouvé le mot !' : `tente « ${e.text} »… raté !`) : `propose ${e.l}` }),
          h('b', { text: e.guess ? '' : e.ok ? `+${e.pts}` : '✗' }))));
      },
    };
  },

  penduReveal(root, s) {
    (s.solver ? SFX.fanfare : SFX.wrong)();
    root.append(head(`🔤 Indice : ${s.pendu.hint}`, `Mot ${s.pendu.index} / ${s.pendu.total}`),
      h('div', { class: 'spot' },
        h('div', { class: 'spot-sub', text: 'Le mot était :' }),
        h('div', { class: 'reveal-word pop', text: s.word }),
        s.solver ? h('div', { class: 'duo pop' }, avatarEl(s.solver, ''), h('b', { text: `Trouvé par ${s.solver.name} !` }))
          : h('p', { class: 'spot-sub', text: 'Personne ne l’a trouvé à temps…' })));
  },

  // ================= L'Estimation =================
  estAsk(root, s) {
    SFX.whoosh();
    const strip = progressStrip('ont répondu');
    root.append(head('🎯 L’Estimation', `Question ${s.est.index} / ${s.est.total}`),
      h('div', { class: 'q-text', text: s.est.text }),
      s.est.unit ? h('div', { class: 'unit-chip', text: `Réponse en ${s.est.unit}` }) : '',
      h('p', { class: 'spot-sub', style: 'text-align:center', text: '📱 Tapez votre estimation sur le téléphone. Le plus proche gagne !' }),
      strip.el);
    return { update(st, prev) { strip.update(st.players.filter((p) => p.connected), st.answered, prev?.answered?.length); } };
  },

  estReveal(root, s) {
    SFX.drumroll(1);
    const list = h('div', { class: 'est-list' });
    later(1100, () => {
      SFX.reveal();
      if (s.rows[0] && s.rows[0].diff === 0) { SFX.fanfare(); }
      list.replaceChildren(...s.rows.map((r, k) => {
        const row = h('div', { class: `est-row rise${r.diff === 0 ? ' exact' : ''}` },
          h('span', { class: 'pos', text: String(r.rank) }), avatarEl(r.player, 'sm'), h('span', { class: 'nm', text: r.player.name }),
          h('span', { class: 'guess', text: fmt(r.value) }), h('span', { class: 'diff', text: r.diff === 0 ? 'PILE !' : `écart ${fmt(r.diff)}` }),
          h('b', { text: r.gained ? `+${fmt(r.gained)}` : '' }));
        row.style.animationDelay = `${k * 0.12}s`;
        return row;
      }));
    });
    root.append(head('🎯 L’Estimation', `Question ${s.est.index} / ${s.est.total}`),
      h('div', { class: 'q-text', style: 'animation:none;font-size:1.8em', text: s.est.text }),
      h('div', { class: 'reveal-word pop', text: `${fmt(s.est.answer)} ${s.est.unit}` }),
      list);
  },
});

function versus(du) {
  return h('div', { class: 'versus' },
    h('div', { class: 'vs-side' }, avatarEl(du.a, 'lg'), h('b', { text: du.a.name })),
    h('div', { class: 'vs-mid', text: 'VS' }),
    h('div', { class: 'vs-side' }, avatarEl(du.b, 'lg'), h('b', { text: du.b.name })));
}

function scoreBar(du, scorerId) {
  const side = (p, score) => h('div', { class: `sb-side${scorerId === p.id ? ' scored' : ''}` }, avatarEl(p, 'sm'), h('b', { text: p.name }), h('span', { class: 'sb-score', text: String(score) }));
  return h('div', { class: 'scorebar' }, side(du.a, du.scoreA), h('span', { class: 'sb-mid', text: `⚔️ premier à ${du.target}` }), side(du.b, du.scoreB));
}

function bacTable(s, withPoints) {
  const b = s.bac;
  return h('table', { class: 'bac-table' },
    h('thead', {}, h('tr', {}, h('th', { text: '' }), ...b.cats.map((c) => h('th', { text: c })), withPoints ? h('th', { text: 'Total' }) : '')),
    h('tbody', {}, ...s.rows.map((r) => h('tr', {},
      h('th', {}, h('span', { class: 'who-cell' }, avatarEl(r.player, 'sm'), h('span', { text: r.player.name }))),
      ...r.cells.map((c) => h('td', { class: `st-${c.status}` },
        h('span', { text: c.text || '—' }),
        !withPoints && c.rejects ? h('em', { class: 'rej', text: `❌${c.rejects}` }) : '',
        withPoints && c.text ? h('em', { class: 'pts', text: c.points ? `+${c.points}` : '0' }) : '')),
      withPoints ? h('td', { class: 'total', text: `+${fmt(r.total)}` }) : ''))));
}

function gallowsSvg(errors) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 120 140');
  svg.setAttribute('class', 'gallows-svg');
  const parts = [
    ['line', { x1: 10, y1: 135, x2: 110, y2: 135 }], ['line', { x1: 30, y1: 135, x2: 30, y2: 10 }],
    ['line', { x1: 30, y1: 10, x2: 80, y2: 10 }], ['line', { x1: 80, y1: 10, x2: 80, y2: 28 }],
    ['circle', { cx: 80, cy: 40, r: 12 }], ['line', { x1: 80, y1: 52, x2: 80, y2: 90 }],
    ['line', { x1: 80, y1: 62, x2: 64, y2: 78 }], ['line', { x1: 80, y1: 62, x2: 96, y2: 78 }],
  ];
  parts.forEach(([tag, attrs], i) => {
    const el = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    el.setAttribute('class', i < errors ? 'on' : 'off');
    svg.append(el);
  });
  return svg;
}

// =====================================================================
// « Entre nous » (couple) : l'écran principal reste neutre, tout se passe sur les téléphones.
// =====================================================================
function coupleScreen(root, s) {
  SFX.whoosh();
  const C = s.cp;
  const label = { guess: '💞 Je te connais', truth: '💬 Vérité', dare: '🔥 Défi', wish: '🤫 Envie secrète' }[C.kind] || '💞 Entre nous';
  const result = s.phase === 'cpGuessReveal' ? (C.match ? '💞 Vous vous connaissez par cœur !' : '😏 Raté… à vous de vous découvrir !')
    : s.phase === 'cpWishReveal' ? (C.wishShared ? '🔥 Envie partagée !' : '🌙 On garde ça pour plus tard…') : '';
  root.append(h('div', { class: 'spot couple-spot' },
    h('div', { class: 'duo' }, ...C.players.filter(Boolean).map((p) => avatarEl(p, 'lg'))),
    h('div', { class: 'kind-badge defi', text: label }),
    h('h1', { class: 'spot-title', text: result || '📱 Regardez vos téléphones…' }),
    h('p', { class: 'spot-sub', text: `Étape ${C.step} / ${C.total} · ${C.shared} envie${C.shared > 1 ? 's' : ''} partagée${C.shared > 1 ? 's' : ''} · 🔒 rien n’est enregistré` })));
}
Object.assign(VIEWS, {
  cpGuess: coupleScreen, cpGuessReveal: coupleScreen, cpTalk: coupleScreen, cpWish: coupleScreen, cpWishReveal: coupleScreen,
  cpEnd(root, s) {
    SFX.fanfare();
    root.append(h('div', { class: 'spot couple-spot' }, h('div', { class: 'big-emoji', text: '💞' }),
      h('h1', { class: 'spot-title', text: `${s.cp.shared} envie${s.cp.shared > 1 ? 's' : ''} partagée${s.cp.shared > 1 ? 's' : ''}` }),
      h('p', { class: 'spot-sub', text: 'La liste est sur vos téléphones… La suite vous appartient 😉' })));
  },
});

// =====================================================================
// « Brûlant » (Action ou Vérité coquin) : l'écran principal reste neutre, jamais le contenu des cartes.
// =====================================================================
function brulantScreen(root, s) {
  SFX.whoosh();
  const B = s.br;
  const status = s.phase === 'brChoose' ? `${B.who?.name || ''} choisit : action ou vérité ?`
    : B.result === 'done' ? (B.kind === 'dare' ? '🔥 Action relevée !' : '💬 Vérité dite !') : B.result === 'veto' ? '🙅 Pas ce soir… on passe !' : B.result === 'joker' ? '🙈 Joker !'
      : B.kind === 'dare' ? `🔥 ${B.who?.name || ''} relève une action…` : `💬 ${B.who?.name || ''} dit une vérité…`;
  root.append(h('div', { class: 'spot couple-spot' },
    h('div', { class: 'duo' }, ...B.players.filter(Boolean).map((p) => avatarEl(p, 'lg'))),
    h('div', { class: 'kind-badge defi', text: `${B.heat.icon} ${B.heat.label}` }),
    h('h1', { class: 'spot-title', text: status }),
    h('p', { class: 'spot-sub', text: `Tour ${B.turn} / ${B.total} · 📱 Tout se passe sur vos téléphones · 🔒 rien n’est enregistré` })));
}
Object.assign(VIEWS, {
  brChoose: brulantScreen, brCard: brulantScreen,
  brEnd(root, s) {
    SFX.fanfare();
    root.append(h('div', { class: 'spot couple-spot' }, h('div', { class: 'big-emoji', text: '🌶️' }),
      h('h1', { class: 'spot-title', text: `${s.br.done.dare} action${s.br.done.dare > 1 ? 's' : ''} · ${s.br.done.truth} vérité${s.br.done.truth > 1 ? 's' : ''}` }),
      h('p', { class: 'spot-sub', text: 'La partie est finie… la soirée, elle, ne fait que commencer 😉' })));
  },
});

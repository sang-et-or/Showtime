// Écran télé de « L'Île des Défis » : tribus, épreuves en direct, conseil et finale sur les poteaux.
/* global h, avatarEl, SFX, later, VIEWS, head, confetti, SHAPES */

function ileTribes(I, opts = {}) {
  return h('div', { class: 'ile-tribes' }, ...I.tribes.map((t) => h('div', { class: `ile-tribe${opts.winner === t.id ? ' win' : ''}${opts.only != null && opts.only !== t.id ? ' dim' : ''}`, style: `--tc:${t.color}` },
    h('div', { class: 'ile-tname' }, h('span', { text: t.icon }), h('b', { text: t.name }), h('small', { text: `${t.wins} victoire${t.wins > 1 ? 's' : ''}` })),
    h('div', { class: 'ile-members' }, ...t.members.map((m) => { const a = avatarEl(m, 'sm'); if (m.out) a.classList.add('ile-out'); return h('div', { class: 'ile-m' }, a, h('small', { text: m.name })); })))));
}

function ileHead(s) { return head(`🏝️ L’Île des Défis`, s.ile.ep ? `Épisode ${Math.min(s.ile.ep, s.ile.episodes)} / ${s.ile.episodes}` : ''); }

Object.assign(VIEWS, {
  ileIntro(root, s) {
    SFX.fanfare();
    root.append(ileHead(s), h('div', { class: 'ile-title pop', text: '🏝️ Deux tribus. Un seul survivant.' }), ileTribes(s.ile));
  },

  ileChallenge(root, s) {
    const ch = s.challenge;
    if (s.stage === 'ready') {
      SFX.drumroll(2);
      root.append(ileHead(s), h('div', { class: 'spot' }, h('div', { class: 'big-emoji pop', text: ch.icon }), h('h1', { class: 'spot-title', text: ch.title }),
        h('p', { class: 'spot-sub', text: ch.rule }), h('p', { class: 'ile-ready', text: '📱 Prenez vos téléphones… Prêts ?' })));
      return;
    }
    SFX.whoosh();
    const live = h('div', { class: 'ile-live' });
    root.append(ileHead(s), h('div', { class: 'ile-ch-title' }, h('span', { text: ch.icon }), h('b', { text: ch.title })));
    if (s.q) {
      root.append(h('div', { class: 'q-text', text: s.q.text }),
        h('div', { class: 'answers' }, ...s.q.choices.map((c, i) => h('div', { class: `answer c${i}` }, h('span', { class: 'shape', text: SHAPES[i] }), h('span', { text: c })))));
    }
    root.append(live);
    return {
      update(st) {
        const all = st.ile.tribes.flatMap((t) => t.members.filter((m) => !m.out).map((m) => ({ ...m, t })));
        if (st.final) {
          const outSet = new Set(st.out);
          live.replaceChildren(h('div', { class: 'ile-poles' }, ...st.finalists.map((p) => h('div', { class: `ile-pole${outSet.has(p.id) ? ' fell' : st.holding.includes(p.id) ? ' hold' : ''}` },
            avatarEl(p, ''), h('i'), h('small', { text: outSet.has(p.id) ? 'a lâché' : st.holding.includes(p.id) ? 'tient bon !' : '…' })))));
        } else if (st.kind === 'tap') {
          live.replaceChildren(...st.ile.tribes.map((t) => {
            const ms = t.members.filter((m) => !m.out);
            const avg = ms.length ? ms.reduce((sum, m) => sum + (st.taps[m.id] || 0), 0) / ms.length : 0;
            return h('div', { class: 'ile-bar', style: `--tc:${t.color}` }, h('b', { text: `${t.icon} ${t.name}` }),
              h('div', { class: 'ile-track' }, h('i', { style: `width:${Math.min(100, avg / 1.4)}%` })), h('span', { text: `${Math.round(avg)} 🥥` }));
          }));
        } else if (st.kind === 'hold') {
          const outSet = new Set(st.out);
          live.replaceChildren(...st.ile.tribes.map((t) => h('div', { class: 'ile-poles', style: `--tc:${t.color}` }, h('b', { class: 'ile-pl', text: `${t.icon} ${t.name}` }),
            ...all.filter((m) => m.t.id === t.id).map((p) => h('div', { class: `ile-pole${outSet.has(p.id) ? ' fell' : st.holding.includes(p.id) ? ' hold' : ''}` },
              avatarEl(p, 'sm'), h('i'), h('small', { text: p.name }))))));
        } else if (st.q) {
          const done = new Set(st.q.answered);
          live.replaceChildren(h('div', { class: 'answered-strip', style: 'justify-content:center' }, h('span', { class: 'label', text: `${done.size} / ${all.length} ont répondu` }),
            ...all.map((p) => { const a = avatarEl(p, 'sm'); if (!done.has(p.id)) a.classList.add('wait'); return a; })));
        }
      },
    };
  },

  ileResult(root, s) {
    SFX.fanfare(); SFX.applause(2);
    const t = s.ile.tribes[s.winner];
    root.append(ileHead(s), h('div', { class: 'spot' }, h('div', { class: 'big-emoji pop', text: t.icon }),
      h('h1', { class: 'spot-title', text: `${t.name} gagnent l’épreuve !` }), h('p', { class: 'spot-sub', text: '+150 pour chaque membre de la tribu gagnante' })),
    ileTribes(s.ile, { winner: s.winner }));
  },

  ileVote(root, s) {
    SFX.reveal();
    const t = s.ile.tribes[s.tribe];
    const strip = h('div', { class: 'answered-strip', style: 'justify-content:center' });
    root.append(ileHead(s), h('div', { class: 'spot' }, h('div', { class: 'big-emoji ile-torch', text: '🔥' }),
      h('h1', { class: 'spot-title ile-h', text: `Le conseil des ${t.name.replace(/^Les /, '')}` }), h('p', { class: 'spot-sub', text: '📱 Votez en secret pour la personne qui doit quitter l’île.' })), strip);
    return {
      update(st) {
        const members = st.ile.tribes[st.tribe].members.filter((m) => !m.out);
        const done = new Set(st.voted);
        strip.replaceChildren(h('span', { class: 'label', text: `${done.size} / ${members.length} ont voté` }), ...members.map((p) => { const a = avatarEl(p, 'sm'); if (!done.has(p.id)) a.classList.add('wait'); return a; }));
      },
    };
  },

  ileCouncil(root, s) {
    const t = s.ile.tribes[s.tribe];
    const urn = h('div', { class: 'ile-urn' });
    const tally = new Map();
    const tallyBox = h('div', { class: 'votes-list' });
    const verdict = h('div', { class: 'ile-verdict' });
    root.append(ileHead(s), h('div', { class: 'spot' }, h('h1', { class: 'spot-title ile-h', text: `🔥 Dépouillement — ${t.name}` }), urn, tallyBox, verdict));
    s.ballots.forEach((b, k) => later(800 + k * s.stepMs, () => {
      SFX.reveal();
      urn.replaceChildren(h('div', { class: 'ile-ballot pop' }, h('small', { text: `Bulletin ${k + 1}` }), avatarEl(b, 'lg'), h('b', { text: b.name })));
      tally.set(b.id, { p: b, n: (tally.get(b.id)?.n || 0) + 1 });
      tallyBox.replaceChildren(...[...tally.values()].sort((x, y) => y.n - x.n).map((v) => h('div', { class: 'vote-pill' }, avatarEl(v.p, 'sm'), h('span', { text: `${v.p.name} : ${v.n}` }))));
    }));
    later(800 + s.ballots.length * s.stepMs + 1200, () => {
      SFX.wrong();
      urn.replaceChildren();
      verdict.replaceChildren(h('div', { class: 'ile-ballot pop out' }, avatarEl(s.outPlayer, 'lg'), h('b', { text: `${s.outPlayer.name} quitte l’île` }),
        h('small', { text: s.tie ? 'Égalité : le sort a tranché…' : 'La tribu a parlé.' })));
    });
  },

  ileEnd(root, s) {
    SFX.fanfare(); SFX.applause(3); confetti(4000);
    root.append(ileHead(s), h('div', { class: 'spot' }, h('div', { class: 'big-emoji pop', text: '🏆' }),
      s.winner ? avatarEl(s.winner, 'lg') : '', h('h1', { class: 'spot-title', text: s.winner ? `${s.winner.name}, survivant de l’Île des Défis !` : 'Fin de l’aventure' }),
      h('p', { class: 'spot-sub', text: '+600 pour le vainqueur, +250 pour le dernier à avoir lâché' })), ileTribes(s.ile));
  },
});

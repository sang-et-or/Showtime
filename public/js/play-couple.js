// Téléphones : le jeu privé « Entre nous » (couple). Tout le contenu est ici, jamais sur l'écran principal.
/* global h, avatarEl, SFX, fmt, buzz, act, center, timerBar, PVIEWS, sentScreen, resultScreen */

const cpHead = (s, label) => h('div', { class: 'cp-head' }, h('span', { class: 'chip', text: label }), h('small', { text: `${s.cp.step}/${s.cp.total}` }));
const softTap = () => { SFX.tap(); buzz(30); };

Object.assign(PVIEWS, {
  cpGuess(root, s) {
    const me = s.cp.isMe;
    root.classList.add('couple');
    if (s.mine != null) {
      center(root).append(h('div', { class: 'big-emoji', text: '💭' }), h('h1', { text: 'Réponse enregistrée' }), h('p', { text: me ? 'Voyons si l’autre te connaît bien…' : 'Voyons si tu as vu juste…' }), timerBar());
      return;
    }
    root.append(cpHead(s, '💞 Je te connais'),
      h('p', { class: 'cp-intro', text: me ? 'Réponds pour toi, en secret :' : `Devine ce que ${s.cp.subjectName} va répondre :` }),
      h('h1', { class: 'cp-q', text: s.item.q }), timerBar(),
      h('div', { class: 'cp-options' }, ...s.item.a.map((label, i) => h('button', {
        class: 'cp-opt', onclick: () => { act({ type: 'answer', choice: i }); softTap(); sentScreen(root, '💭', 'Réponse enregistrée', ''); },
      }, label))));
  },

  cpGuessReveal(root, s) {
    root.classList.add('couple');
    center(root);
    if (s.match) { SFX.correct(); buzz([60, 40, 60]); }
    root.append(h('div', { class: 'big-emoji pop', text: s.match ? '💞' : '😏' }), h('h1', { text: s.match ? 'Vous vous connaissez par cœur !' : 'Pas tout à fait…' }),
      h('p', { text: s.item.q }),
      h('div', { class: 'cp-answers' },
        h('div', {}, h('small', { text: `${s.cp.subjectName} a répondu` }), h('b', { text: s.a != null ? s.item.a[s.a] : '—' })),
        h('div', {}, h('small', { text: 'Pronostic' }), h('b', { text: s.b != null ? s.item.a[s.b] : '—' }))),
      s.match ? h('div', { class: 'points pop', text: '+150' }) : '');
  },

  cpTalk(root, s) {
    root.classList.add('couple');
    center(root);
    const dare = s.cp.kind === 'dare';
    const label = dare ? '🔥 Défi' : '💬 Vérité';
    if (s.cp.isMe) {
      buzz([80, 40, 80]);
      root.append(cpHead(s, label), h('div', { class: 'cp-card' }, h('b', { text: s.text })),
        h('p', { text: dare ? `À faire à ${s.cp.partner?.name}, seulement s’il ou elle est d’accord.` : `À dire à voix haute à ${s.cp.partner?.name}.` }),
        timerBar(),
        h('div', { class: 'cp-actions' },
          h('button', { class: 'btn gold big', onclick: () => { act({ type: 'done' }); softTap(); } }, dare ? 'C’est fait 💋' : 'C’est dit 💬'),
          h('button', { class: 'btn ghost', onclick: () => { act({ type: 'joker' }); softTap(); } }, 'Joker 🙈 (passer)')));
    } else {
      root.append(cpHead(s, label), h('div', { class: 'cp-card' }, h('b', { text: s.text })),
        h('p', { text: dare ? `${s.cp.subjectName} va relever ce défi… Tu peux toujours dire non 💛` : `${s.cp.subjectName} va te répondre… Écoute bien 💛` }), timerBar());
    }
  },

  cpWish(root, s) {
    root.classList.add('couple');
    center(root);
    if (s.mine) { root.append(h('div', { class: 'big-emoji', text: '🤫' }), h('h1', { text: 'Réponse secrète enregistrée' }), h('p', { text: 'Elle ne sera révélée que si vous êtes d’accord tous les deux.' }), timerBar()); return; }
    const pick = (value, emoji, label) => h('button', { class: `cp-wish ${value}`, onclick: () => { act({ type: 'wish', value }); softTap(); sentScreen(root, '🤫', 'Réponse secrète enregistrée', 'Elle ne sera révélée que si vous êtes d’accord tous les deux.'); } },
      h('span', { text: emoji }), h('b', { text: label }));
    root.append(cpHead(s, '🤫 Envie secrète'), h('p', { text: 'Ça te tente ?' }), h('div', { class: 'cp-card' }, h('b', { text: s.text })), timerBar(),
      h('div', { class: 'cp-wishes' }, pick('yes', '😍', 'Oui !'), pick('maybe', '😊', 'Peut-être'), pick('no', '🙅', 'Non merci')),
      h('small', { class: 'muted', text: 'Si l’un de vous dit non, l’autre ne le saura jamais.' }));
  },

  cpWishReveal(root, s) {
    root.classList.add('couple');
    if (s.shared) { SFX.fanfare(); buzz([100, 50, 100]); }
    center(root).append(h('div', { class: 'big-emoji pop', text: s.shared ? '🔥' : '🌙' }),
      h('h1', { text: s.shared ? 'Envie partagée !' : 'On garde ça pour plus tard' }),
      s.shared ? h('div', { class: 'cp-card' }, h('b', { text: s.text })) : h('p', { text: 'Pas de souci, la soirée continue…' }));
  },

  cpEnd(root, s) {
    root.classList.add('couple');
    center(root).append(h('div', { class: 'big-emoji pop', text: '💞' }), h('h1', { text: 'Vos envies communes' }),
      s.wishes.length ? h('div', { class: 'cp-list' }, ...s.wishes.map((w) => h('div', {}, h('span', { text: w.sure ? '🔥' : '😊' }), h('b', { text: w.text }))))
        : h('p', { text: 'Aucune envie commune cette fois… à refaire avec un autre niveau ?' }),
      h('p', { text: `${s.matches} bonne${s.matches > 1 ? 's' : ''} réponse${s.matches > 1 ? 's' : ''} à « Je te connais »${s.jokers ? ` · ${s.jokers} joker${s.jokers > 1 ? 's' : ''}` : ''}.` }),
      h('small', { class: 'muted', text: '🔒 Rien n’a été enregistré. Ce qui se passe ici reste entre vous.' }));
  },
});

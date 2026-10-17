// Téléphone : la main de cartes (cachée des autres) et les actions des jeux de cartes.
/* global h, avatarEl, SFX, fmt, buzz, act, center, timerBar, PVIEWS, state, sentScreen, resultScreen, waitScreen */

const SUIT_SYM_P = { S: '♠', H: '♥', D: '♦', C: '♣' };
const SUIT_NAME_P = { S: 'Pique', H: 'Cœur', D: 'Carreau', C: 'Trèfle' };
const RANK_FR_P = { J: 'V', Q: 'D', K: 'R', A: 'A' };
const tapCard = () => { SFX.tap(); buzz(30); };

function pCard(card, extra = '', onclick) {
  if (!card) return h('div', { class: `pcard back ${extra}` });
  const red = card.s === 'H' || card.s === 'D';
  return h(onclick ? 'button' : 'div', { class: `pcard ${red ? 'red' : ''} ${extra}`, onclick, 'aria-label': `${card.r} de ${SUIT_NAME_P[card.s]}` },
    h('span', { class: 'cr', text: RANK_FR_P[card.r] || card.r }), h('span', { class: 'cs', text: SUIT_SYM_P[card.s] }));
}
const handRow = (cards, extra) => h('div', { class: 'hand' }, ...cards.map((c) => pCard(c, extra)));

Object.assign(PVIEWS, {
  // ================= Bataille royale =================
  batFlip(root, s) {
    center(root);
    if (!s.bat.inGame || !s.bat.myCards) { root.append(h('div', { class: 'big-emoji', text: '🍿' }), h('h1', { text: 'Plus de cartes…' }), h('p', { text: 'Tu es éliminé·e, regarde la fin de la bataille !' })); return; }
    if (s.flipped) { root.append(pCard(null, 'huge'), h('h1', { text: 'Carte retournée !' }), h('p', { text: `Il te reste ${s.bat.myCards} cartes.` }), timerBar()); return; }
    buzz(60);
    root.append(h('p', { text: `Manche ${s.bat.round}/${s.bat.total} · ${s.bat.myCards} cartes dans ton paquet` }),
      h('button', { class: 'flip-btn', onclick: () => { act({ type: 'flip' }); tapCard(); sentScreen(root, '🃏', 'Carte retournée !', 'Regarde l’écran !'); } }, pCard(null, 'huge'), h('b', { text: 'Retourner ma carte !' })),
      timerBar());
  },
  batReveal(root, s) {
    center(root);
    root.append(s.myCard ? pCard(s.myCard, 'huge pop') : '', h('h1', { class: s.won ? 'result-ok' : '', text: s.won ? `Tu rafles ${s.potSize} cartes !` : s.bataille && s.inBataille ? '⚔️ Bataille !' : `Pli pour ${s.winner?.name}` }),
      h('p', { text: `Tu as maintenant ${s.bat.myCards} cartes.` }));
    if (s.won) { SFX.correct(); buzz([60, 40, 60]); }
  },
  batEnd(root, s) { resultScreen(root, (s.row?.cards || 0) > 0, '🃏', `${s.row?.cards || 0} cartes`, s.row ? `+${fmt(s.row.points)}` : ''); },

  // ================= Le 21 =================
  bjBet(root, s) {
    center(root);
    if (!s.bj.seated) { waitScreen(root, null, 'La table est pleine : regarde la partie !'); return; }
    if (s.bet) { root.append(h('div', { class: 'big-emoji', text: '🪙' }), h('h1', { text: `Mise : ${fmt(s.bet)}` }), h('p', { text: `Il te reste ${fmt(s.bj.chips - s.bet)} jetons.` }), timerBar()); return; }
    root.append(h('h1', { text: 'Faites vos jeux !' }), h('div', { class: 'money-tag', text: `🪙 ${fmt(s.bj.chips)} jetons${s.bj.helped ? ' (crédit du croupier)' : ''}` }), timerBar(),
      h('div', { class: 'bet-grid' }, ...s.bets.map((b) => h('button', { class: 'bet-chip', onclick: () => { act({ type: 'bet', amount: b }); tapCard(); sentScreen(root, '🪙', `Mise : ${fmt(b)}`, 'Bonne chance !'); } }, h('b', { text: fmt(b) })))));
  },
  bjPlay(root, s) {
    center(root);
    const m = s.mine;
    if (!m) { waitScreen(root, null, 'Pas de main pour toi à cette donne.'); return; }
    root.append(h('small', { text: 'Croupier' }), h('div', { class: 'hand' }, pCard(s.dealerUp), pCard(null)),
      h('small', { text: 'Ta main' }), handRow(m.cards, 'big'),
      h('div', { class: `points${m.value > 21 ? ' result-ko' : ''}`, text: m.bj ? 'BLACKJACK !' : m.value > 21 ? `${m.value} – sauté !` : String(m.value) }),
      h('p', { text: `Mise : ${fmt(m.bet)}` }));
    if (m.done) { root.append(h('p', { text: 'En attente du croupier…' }), timerBar()); if (m.value > 21) { SFX.wrong(); buzz(250); } return; }
    root.append(timerBar(), h('div', { class: 'bj-actions' },
      h('button', { class: 'btn gold big', onclick: () => { act({ type: 'hit' }); tapCard(); } }, '🃏 Carte'),
      h('button', { class: 'btn ghost big', onclick: () => { act({ type: 'stand' }); tapCard(); } }, '✋ Je reste'),
      m.canDouble ? h('button', { class: 'btn big', onclick: () => { act({ type: 'double' }); tapCard(); } }, '✌️ Doubler') : ''));
  },
  bjDealer(root, s) {
    center(root).append(h('small', { text: 'Croupier' }), handRow(s.dealer), h('div', { class: 'points', text: s.dealerValue > 21 ? `${s.dealerValue} – saute !` : String(s.dealerValue) }),
      s.mine ? h('p', { text: `Toi : ${s.mine.value}` }) : '');
  },
  bjResult(root, s) {
    const r = s.result;
    if (!r) { resultScreen(root, null, '🎰', 'Fin de la donne'); return; }
    const label = { win: 'Gagné !', blackjack: 'Blackjack !', push: 'Égalité', lose: 'Perdu…', bust: 'Sauté !' }[r.outcome];
    resultScreen(root, r.gain > 0 ? true : r.gain < 0 ? false : null, { win: '🤑', blackjack: '🃏', push: '🤝', lose: '😬', bust: '💥' }[r.outcome], label,
      r.gain ? `${r.gain > 0 ? '+' : '−'}${fmt(Math.abs(r.gain))}` : '', `Jetons : ${fmt(s.bj.chips)}`);
  },
  bjEnd(root, s) { resultScreen(root, (s.row?.chips || 0) > 1000, '🎰', `${fmt(s.row?.chips || 0)} jetons`, s.row ? `+${fmt(s.row.points)} pts` : ''); },

  // ================= Le Poker =================
  pkPlay(root, s) {
    const P = s.pk;
    const t = s.turn;
    if (!P.seated) { waitScreen(root, t?.turnPlayer, 'La table est pleine (8 joueurs) : regarde la partie !'); return; }
    root.append(h('div', { class: 'pk-phone-head' }, h('span', { class: 'money-tag', text: `🪙 ${fmt(P.chips)}` }), h('span', { class: 'chip', text: `Pot ${fmt(P.pot)} · ${P.street}` })),
      h('small', { text: 'Tes cartes (ne les montre à personne !)' }), handRow(P.hole, 'big'),
      t?.myHand ? h('p', { class: 'pk-myhand', text: `Ta main : ${t.myHand}` }) : '',
      P.board.length ? h('div', {}, h('small', { text: 'Table' }), handRow(P.board, 'small')) : '');
    if (!P.inHand) { root.append(h('p', { text: P.hole.length ? 'Tu t’es couché·e pour cette donne.' : 'Tu n’as plus de jetons : regarde la fin !' })); return; }
    if (!t || !t.isTurn) { root.append(h('p', { text: t?.turnPlayer ? `Au tour de ${t.turnPlayer.name}…` : '…' })); return; }
    buzz([100, 50, 100]);
    const raise = t.presets.map((v, i) => h('button', { class: 'btn', onclick: () => { act({ type: 'raise', to: v }); tapCard(); } },
      v === t.maxTo ? `💥 Tapis (${fmt(v)})` : i === 0 ? `Relance à ${fmt(v)}` : `Gros relance ${fmt(v)}`));
    root.append(timerBar(), h('div', { class: 'pk-actions' },
      h('button', { class: 'btn ghost', onclick: () => { act({ type: 'fold' }); tapCard(); } }, '🙅 Se coucher'),
      t.canCheck ? h('button', { class: 'btn gold', onclick: () => { act({ type: 'check' }); tapCard(); } }, '✋ Parole')
        : h('button', { class: 'btn gold', onclick: () => { act({ type: 'call' }); tapCard(); } }, t.toCall >= P.chips ? `Suivre tapis (${fmt(t.toCall)})` : `Suivre ${fmt(t.toCall)}`),
      ...raise));
  },
  pkShow(root, s) {
    const won = s.won;
    resultScreen(root, won > 0 ? true : null, won > 0 ? '🤑' : '🃏', won > 0 ? `Tu remportes ${fmt(won)} !` : `${s.winners.map((w) => w?.name).join(' & ')} remporte le pot`, '', s.myHand ? `Ta main : ${s.myHand}` : '');
    root.append(handRow(s.pk.hole, 'small'), h('div', { class: 'money-tag', text: `🪙 ${fmt(s.pk.chips)}` }));
  },
  pkEnd(root, s) { resultScreen(root, (s.row?.chips || 0) > 1000, '♠️', `${fmt(s.row?.chips || 0)} jetons`, s.row ? `+${fmt(s.row.points)} pts` : ''); },

  // ================= La Belote =================
  blBid(root, s) {
    const B = s.bl;
    if (B.seat === -1) { waitScreen(root, s.turnPlayer, 'Tu regardes la partie (4 joueurs à la table).'); return; }
    root.append(h('div', { class: 'pk-phone-head' }, h('span', { class: 'chip', text: `Équipe ${B.myTeam ? 'B' : 'A'} avec ${B.partner?.name}` })),
      h('small', { text: 'Ta main' }), handRow(s.hand, 'big'), h('small', { text: 'La retournée' }), handRow([B.turned]));
    if (!s.myTurn) { root.append(h('p', { text: `${s.turnPlayer?.name} réfléchit…` })); return; }
    buzz([100, 50, 100]);
    root.append(timerBar(), s.bidSuits
      ? h('div', { class: 'pk-actions' }, ...s.bidSuits.map((su) => h('button', { class: `btn ${su === 'H' || su === 'D' ? '' : 'ghost'}`, onclick: () => { act({ type: 'take', suit: su }); tapCard(); } }, `Prendre à ${SUIT_SYM_P[su]} ${SUIT_NAME_P[su]}`)),
        h('button', { class: 'btn ghost', onclick: () => { act({ type: 'pass' }); tapCard(); } }, 'Passer'))
      : h('div', { class: 'pk-actions' },
        h('button', { class: 'btn gold', onclick: () => { act({ type: 'take' }); tapCard(); } }, `Prendre à ${SUIT_SYM_P[B.turned.s]}`),
        h('button', { class: 'btn ghost', onclick: () => { act({ type: 'pass' }); tapCard(); } }, 'Passer')));
  },
  blPlay(root, s) {
    const B = s.bl;
    if (B.seat === -1) { waitScreen(root, s.turnPlayer, 'Tu regardes la partie (4 joueurs à la table).'); return; }
    const legal = new Set(s.legal);
    root.append(h('div', { class: 'pk-phone-head' }, h('span', { class: `chip on ${B.trump === 'H' || B.trump === 'D' ? 'red' : ''}`, text: `Atout ${SUIT_SYM_P[B.trump]}` }),
      h('span', { class: 'chip', text: `A ${B.scores[0]} · B ${B.scores[1]}` })),
    B.trick.length ? h('div', {}, h('small', { text: 'Pli en cours' }), handRow(B.trick.map((t) => t.card), 'small')) : '',
    h('p', { class: s.myTurn ? 'turn-msg' : '', text: s.myTurn ? '👉 À toi de jouer ! (cartes jouables en couleur)' : `Au tour de ${s.turnPlayer?.name}` }),
    s.myTurn ? timerBar() : '',
    h('div', { class: 'hand big-hand' }, ...s.hand.map((c) => pCard(c, `big${s.myTurn && !legal.has(c.id) ? ' dim' : ''}`, s.myTurn && legal.has(c.id) ? () => {
      act({ type: 'play', card: c.id }); tapCard(); root.querySelectorAll('.pcard').forEach((x) => { x.disabled = true; });
    } : null))));
    if (s.myTurn) buzz([80, 40, 80]);
  },
  blScore(root, s) {
    const r = s.result;
    const mine = s.bl.myTeam;
    resultScreen(root, mine == null ? null : r.result[mine] > r.result[1 - mine], r.verdict === 'capot' ? '💥' : r.verdict === 'dedans' ? '❌' : '✅',
      r.verdict === 'capot' ? 'CAPOT !' : r.verdict === 'dedans' ? 'Dedans !' : 'Contrat rempli', mine == null ? '' : `+${r.result[mine]}`, `A ${s.bl.scores[0]} · B ${s.bl.scores[1]}`);
  },
  blEnd(root, s) { resultScreen(root, s.win != null && s.win === s.bl.myTeam, s.win === s.bl.myTeam ? '🏆' : '🂡', s.win == null ? 'Égalité !' : s.win === s.bl.myTeam ? 'Ton équipe gagne !' : 'L’autre équipe gagne', '', `A ${s.bl.scores[0]} · B ${s.bl.scores[1]}`); },

  // ================= Le Président =================
  prPlay(root, s) {
    const P = s.pr;
    const ORDER = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
    if (P.seat === -1) { waitScreen(root, s.turnPlayer, 'Tu regardes la partie.'); return; }
    if (s.out) { center(root).append(h('div', { class: 'big-emoji', text: '✅' }), h('h1', { text: 'Plus de cartes !' }), h('p', { text: 'Regarde qui sera le Clochard…' })); return; }
    const me = P.seats[P.seat];
    root.append(h('div', { class: 'pk-phone-head' }, me?.title ? h('span', { class: 'chip', text: `${me.title.icon} ${me.title.name}` }) : '', h('span', { class: 'chip', text: `Manche ${P.manche}/${P.total}` })),
      P.pile ? h('div', {}, h('small', { text: `Sur la table (${P.pile.player?.name})` }), handRow(P.pile.cards, 'small')) : h('p', { text: s.myTurn ? 'Tu ouvres : pose ce que tu veux !' : 'Nouveau pli' }),
      h('p', { class: s.myTurn ? 'turn-msg' : '', text: s.myTurn ? (s.need ? `👉 Pose ${s.need} carte${s.need > 1 ? 's' : ''} plus forte${s.need > 1 ? 's' : ''}, ou passe` : '👉 À toi d’ouvrir !') : `Au tour de ${s.turnPlayer?.name}` }));
    const selected = new Set();
    const playBtn = h('button', { class: 'btn gold big', disabled: true }, 'Jouer');
    const valid = () => {
      const cards = P.hand.filter((c) => selected.has(c.id));
      if (!cards.length || cards.some((c) => c.r !== cards[0].r)) return false;
      if (!P.pile) return cards.length <= 4;
      return cards.length === s.need && ORDER.indexOf(cards[0].r) > ORDER.indexOf(P.pile.cards[0].r);
    };
    const hand = h('div', { class: 'hand big-hand' }, ...P.hand.map((c) => {
      const el = pCard(c, 'big', s.myTurn ? () => {
        if (selected.has(c.id)) selected.delete(c.id); else selected.add(c.id);
        el.classList.toggle('sel', selected.has(c.id)); tapCard();
        playBtn.disabled = !valid(); playBtn.textContent = selected.size ? `Jouer ${selected.size} carte${selected.size > 1 ? 's' : ''}` : 'Jouer';
      } : null);
      return el;
    }));
    playBtn.addEventListener('click', () => { if (!valid()) return; act({ type: 'play', cards: [...selected] }); tapCard(); sentScreen(root, '🃏', 'Posé !', ''); });
    root.append(hand);
    if (s.myTurn) {
      buzz([80, 40, 80]);
      root.append(timerBar(), h('div', { class: 'pk-actions' }, playBtn, s.canPass ? h('button', { class: 'btn ghost big', onclick: () => { act({ type: 'pass' }); tapCard(); sentScreen(root, '🙅', 'Je passe', ''); } }, 'Passer') : ''));
    }
  },
  prResult(root, s) { const r = s.row; resultScreen(root, r ? r.pts >= 250 : null, r?.icon || '👑', r ? r.title : 'Fin de manche', r ? `+${r.pts}` : ''); },
  prEnd(root, s) { resultScreen(root, null, '👑', 'Fin du Président', s.row ? `${fmt(s.row.points)} pts` : ''); },

  // ================= Le 8 américain =================
  htPlay(root, s) {
    const T = s.ht;
    if (T.seat === -1) { waitScreen(root, s.turnPlayer, 'Tu regardes la partie.'); return; }
    const playable = new Set(s.playable);
    root.append(h('div', { class: 'ht-phone-top' }, pCard(T.top, 'big'), h('div', {}, h('b', { class: T.suit === 'H' || T.suit === 'D' ? 'red-txt' : '', text: `Couleur : ${SUIT_SYM_P[T.suit]} ${T.suitName}` }),
      h('small', { text: T.lastEvent || '' }))),
    h('p', { class: s.myTurn ? 'turn-msg' : '', text: s.myTurn ? (s.playable.length ? '👉 À toi ! Touche une carte en couleur' : '👉 Aucune carte jouable : pioche !') : `Au tour de ${s.turnPlayer?.name}` }));
    const chooseSuit = (card) => {
      const box = h('div', { class: 'suit-pick' }, h('b', { text: 'Le 8 ! Quelle couleur ?' }),
        ...['S', 'H', 'D', 'C'].map((su) => h('button', { class: `btn ${su === 'H' || su === 'D' ? '' : 'ghost'}`, onclick: () => { act({ type: 'play', card: card.id, suit: su }); tapCard(); sentScreen(root, SUIT_SYM_P[su], `Couleur : ${SUIT_NAME_P[su]}`, ''); } }, `${SUIT_SYM_P[su]} ${SUIT_NAME_P[su]}`)));
      root.append(box);
      box.scrollIntoView({ behavior: 'smooth' });
    };
    root.append(h('div', { class: 'hand big-hand' }, ...T.hand.map((c) => pCard(c, `big${s.myTurn && !playable.has(c.id) ? ' dim' : ''}`, s.myTurn && playable.has(c.id) ? () => {
      if (c.r === '8') { chooseSuit(c); return; }
      act({ type: 'play', card: c.id }); tapCard();
    } : null))));
    if (s.myTurn) {
      buzz([80, 40, 80]);
      root.append(timerBar(), h('div', { class: 'pk-actions' },
        s.canDraw ? h('button', { class: 'btn gold', onclick: () => { act({ type: 'draw' }); tapCard(); } }, '🃏 Piocher') : '',
        s.canPass ? h('button', { class: 'btn ghost', onclick: () => { act({ type: 'pass' }); tapCard(); } }, 'Passer') : ''));
    }
  },
  htResult(root, s) { const r = s.row; resultScreen(root, r?.winner || null, r?.winner ? '🏆' : '🎴', r?.winner ? 'Main vide, bravo !' : `${r?.left ?? 0} carte(s) restante(s)`, r ? `+${r.pts}` : ''); },
  htEnd(root, s) { resultScreen(root, null, '🎴', 'Fin du 8 américain', s.row ? `${fmt(s.row.points)} pts` : ''); },
});

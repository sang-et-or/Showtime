// Écrans télé des jeux de cartes : Bataille royale, 21, Poker, Belote, Président, 8 américain.
// Les cartes cachées restent sur les téléphones ; la télé montre la table.
/* global h, avatarEl, SFX, later, fmt, VIEWS, endTable */

const SUIT_SYM = { S: '♠', H: '♥', D: '♦', C: '♣' };
const RANK_FR = { J: 'V', Q: 'D', K: 'R', A: 'A' };

/** Une carte à jouer (face visible, ou dos si `card` est null). */
function cardEl(card, extra = '') {
  if (!card) return h('div', { class: `pcard back ${extra}` });
  const red = card.s === 'H' || card.s === 'D';
  return h('div', { class: `pcard ${red ? 'red' : ''} ${extra}`, title: `${card.r}${SUIT_SYM[card.s]}` },
    h('span', { class: 'cr', text: RANK_FR[card.r] || card.r }), h('span', { class: 'cs', text: SUIT_SYM[card.s] }));
}
const cardsRow = (cards, extra) => h('div', { class: 'cards-row' }, ...cards.map((c) => cardEl(c, extra)));
const backs = (n) => h('div', { class: 'backs', title: `${n} cartes` }, ...Array.from({ length: Math.min(n, 8) }, () => h('i')), h('b', { text: String(n) }));
const seatBox = (p, cls, ...kids) => (p ? h('div', { class: `cseat ${cls || ''}` }, avatarEl(p, 'sm'), h('div', { class: 'cseat-txt' }, h('b', { text: p.name }), ...kids)) : '');

// =====================================================================
// La Bataille royale
// =====================================================================
Object.assign(VIEWS, {
  batFlip(root, s) {
    SFX.whoosh();
    const grid = h('div', { class: 'bat-grid' });
    root.append(h('div', { class: 'q-head' }, h('span', { class: 'chip', text: '🃏 Bataille royale' }), h('span', { class: 'count', text: `Manche ${s.bat.round} / ${s.bat.total}` })),
      h('h1', { class: 'spot-title', style: 'text-align:center;font-size:2.2em', text: '📱 Retournez votre carte !' }), grid);
    return {
      update(st, prev) {
        if (prev && prev.flipped && st.flipped.length > prev.flipped.length) SFX.tap();
        const flipped = new Set(st.flipped);
        grid.replaceChildren(...st.bat.seats.filter((x) => x.player).map((x) => h('div', { class: `bat-seat${x.cards ? '' : ' out'}` },
          avatarEl(x.player, ''), h('b', { text: x.player.name }), h('small', { text: `${x.cards} cartes` }),
          x.cards ? cardEl(null, flipped.has(x.player.id) ? 'flipped' : 'waiting') : h('small', { text: 'éliminé·e' }))));
      },
    };
  },

  batReveal(root, s) {
    const byId = new Map(s.bat.seats.filter((x) => x.player).map((x) => [x.player.id, x.player]));
    const stage = h('div', { class: 'bat-grid' });
    const banner = h('div', { class: 'bat-banner' });
    root.append(h('div', { class: 'q-head' }, h('span', { class: 'chip', text: '🃏 Bataille royale' }), h('span', { class: 'count', text: `Manche ${s.bat.round} / ${s.bat.total}` })), banner, stage);
    s.steps.forEach((step, k) => later(k * 1600, () => {
      SFX.reveal();
      banner.textContent = k === 0 ? '' : k === 1 ? '⚔️ BATAILLE !' : `⚔️ ${k === 2 ? 'DOUBLE' : 'TRIPLE'} BATAILLE !`;
      if (k > 0) SFX.drumroll(0.8);
      stage.replaceChildren(...Object.entries(step.shown).map(([id, c]) => h('div', { class: `bat-seat${step.top.includes(id) ? ' top' : ''}` },
        avatarEl(byId.get(id), ''), h('b', { text: byId.get(id)?.name || '' }), cardEl(c, 'pop'))));
    }));
    later(s.steps.length * 1600 - 300, () => {
      SFX.correct();
      banner.replaceChildren(h('span', { text: `🏆 ${s.winner?.name} rafle ${s.potSize} cartes !` }));
    });
  },

  batEnd(root, s) {
    SFX.fanfare(); SFX.applause(2);
    root.append(endTable('🃏 Fin de la bataille', s.rows.map((r) => ({ player: r.player, main: `${r.cards} cartes`, sub: '', points: r.points }))));
  },
});

// =====================================================================
// Le 21
// =====================================================================
function bjTable(root, s) {
  SFX.whoosh();
  const dealer = h('div', { class: 'bj-dealer' });
  const seats = h('div', { class: 'bj-seats' });
  root.append(h('div', { class: 'q-head' }, h('span', { class: 'chip', text: '🎰 Le 21' }), h('span', { class: 'count', text: `Donne ${s.bj.round} / ${s.bj.total}` })), dealer, seats);
  let lastSeq = null;
  return {
    update(st) {
      const B = st.bj;
      if (B.seq !== lastSeq) { if (lastSeq != null) SFX.tap(); lastSeq = B.seq; }
      dealer.replaceChildren(h('div', { class: 'bj-dealer-who' }, h('span', { text: '🎙️' }), h('b', { text: 'Croupier Max' }),
        B.dealerValue != null ? h('em', { class: B.dealerValue > 21 ? 'bust' : '', text: B.dealerValue > 21 ? `${B.dealerValue} – saute !` : String(B.dealerValue) }) : ''),
      cardsRow(B.dealer));
      const res = new Map((st.results || []).map((r) => [r.id, r]));
      seats.replaceChildren(...B.seats.filter((x) => x.player && x.hand).map((x) => {
        const r = res.get(x.player.id);
        const badge = r ? { win: `✅ +${fmt(r.gain)}`, blackjack: `🃏 BLACKJACK +${fmt(r.gain)}`, push: '🤝 Égalité', lose: `❌ −${fmt(-r.gain)}`, bust: `💥 Sauté −${fmt(-r.gain)}` }[r.outcome] : x.hand.bj ? '🃏 Blackjack !' : x.hand.value > 21 ? '💥 Sauté' : x.hand.done ? '✋ Reste' : '🤔 Réfléchit…';
        return h('div', { class: `bj-seat${r ? ` r-${r.outcome}` : ''}${!x.hand.done ? ' thinking' : ''}` },
          h('div', { class: 'bj-who' }, avatarEl(x.player, 'sm'), h('b', { text: x.player.name }), h('em', { text: `${x.hand.value}` })),
          cardsRow(x.hand.cards, 'small'),
          h('small', { text: `Mise ${fmt(x.hand.bet)} · Jetons ${fmt(x.chips)}` }), h('div', { class: 'bj-badge', text: badge }));
      }));
    },
  };
}

Object.assign(VIEWS, {
  bjBet(root, s) {
    SFX.whoosh();
    const grid = h('div', { class: 'bat-grid' });
    root.append(h('div', { class: 'q-head' }, h('span', { class: 'chip', text: '🎰 Le 21' }), h('span', { class: 'count', text: `Donne ${s.bj.round} / ${s.bj.total}` })),
      h('h1', { class: 'spot-title', style: 'text-align:center;font-size:2.2em', text: '💰 Faites vos jeux !' }), grid);
    return {
      update(st, prev) {
        if (prev && prev.bets && Object.keys(st.bets).length > Object.keys(prev.bets).length) SFX.pop();
        grid.replaceChildren(...st.bj.seats.filter((x) => x.player).map((x) => h('div', { class: 'bat-seat' }, avatarEl(x.player, ''), h('b', { text: x.player.name }),
          h('small', { text: `${fmt(x.chips)} jetons` }), st.bets[x.player.id] ? h('div', { class: 'chip-stack pop', text: `🪙 ${fmt(st.bets[x.player.id])}` }) : h('small', { text: '…' }))));
      },
    };
  },
  bjPlay: bjTable, bjDealer: bjTable, bjResult: bjTable,
  bjEnd(root, s) {
    SFX.fanfare(); SFX.applause(2);
    root.append(endTable('🎰 Le casino ferme', s.rows.map((r) => ({ player: r.player, main: `${fmt(r.chips)} jetons`, sub: '', points: r.points }))));
  },
});

// =====================================================================
// Le Poker
// =====================================================================
function pokerTable(root) {
  SFX.whoosh();
  const head = h('div', { class: 'q-head' });
  const felt = h('div', { class: 'pk-felt' });
  const board = h('div', { class: 'pk-board' });
  const pot = h('div', { class: 'pk-pot' });
  const seats = h('div', { class: 'pk-seats' });
  const show = h('div', { class: 'pk-show' });
  felt.append(board, pot, show);
  root.append(head, felt, seats);
  let lastBoard = 0;
  return {
    update(st) {
      const P = st.pk;
      head.replaceChildren(h('span', { class: 'chip', text: '♠️ Poker' }), h('span', { class: 'count', text: `Donne ${P.handNo} / ${P.total} · Blindes ${P.blinds ? `${P.blinds.sb}/${P.blinds.bb}` : ''} · ${P.streetLabel}` }));
      if (P.board.length > lastBoard) SFX.reveal();
      lastBoard = P.board.length;
      board.replaceChildren(...Array.from({ length: 5 }, (_, i) => (P.board[i] ? cardEl(P.board[i], 'pop') : h('div', { class: 'pcard slot' }))));
      pot.textContent = `Pot : ${fmt(P.pot)}`;
      const sh = st.show;
      show.replaceChildren(...(sh ? sh.pots.map((x) => h('div', { class: 'pk-win pop', text: `🏆 ${x.winners.map((w) => w?.name).join(' & ')} remporte ${fmt(x.amount)}${!sh.byFold && sh.hands[x.winners[0]?.id] ? ` · ${sh.hands[x.winners[0].id].name}` : ''}` })) : []));
      seats.replaceChildren(...P.seats.map((x, i) => {
        if (!x.player) return '';
        const hand = sh && sh.hands && sh.hands[x.player.id];
        return h('div', { class: `pk-seat${i === P.toAct ? ' turn' : ''}${x.dealt && !x.inHand ? ' folded' : ''}${!x.dealt ? ' out' : ''}` },
          i === P.button ? h('span', { class: 'dealer-btn', text: 'D' }) : '',
          h('div', { class: 'bj-who' }, avatarEl(x.player, 'sm'), h('b', { text: x.player.name })),
          h('small', { text: `🪙 ${fmt(x.chips)}${x.allIn ? ' · TAPIS' : ''}` }),
          hand ? h('div', {}, cardsRow(hand.cards, 'small'), h('em', { text: hand.name })) : (x.inHand ? cardsRow([null, null], 'small') : ''),
          x.bet ? h('div', { class: 'chip-stack', text: `🪙 ${fmt(x.bet)}` }) : '',
          x.last ? h('div', { class: 'pk-last', text: x.last }) : '');
      }));
    },
  };
}
Object.assign(VIEWS, {
  pkPlay: pokerTable, pkShow: pokerTable,
  pkEnd(root, s) {
    SFX.fanfare(); SFX.applause(2);
    root.append(endTable('♠️ Fin de la partie de poker', s.rows.map((r) => ({ player: r.player, main: `${fmt(r.chips)} jetons`, sub: '', points: r.points }))));
  },
});

// =====================================================================
// La Belote
// =====================================================================
const BL_POS = ['south', 'west', 'north', 'east'];
function beloteTable(root) {
  SFX.whoosh();
  const head = h('div', { class: 'q-head' });
  const table = h('div', { class: 'bl-table' });
  const center = h('div', { class: 'bl-center' });
  const seats = BL_POS.map((pos) => h('div', { class: `bl-seat ${pos}` }));
  table.append(...seats, center);
  root.append(head, table);
  let lastLen = 0;
  return {
    update(st) {
      const B = st.bl;
      head.replaceChildren(h('span', { class: 'chip', text: '🂡 Belote' }), h('span', { class: 'count', text: `Donne ${Math.max(1, B.donne)} / ${B.total}` }),
        h('span', { class: 'chip', text: `Équipe A : ${B.scores[0]}` }), h('span', { class: 'chip', text: `Équipe B : ${B.scores[1]}` }),
        B.trump ? h('span', { class: `chip on ${B.trump === 'H' || B.trump === 'D' ? 'red' : ''}`, text: `Atout ${SUIT_SYM[B.trump]} ${B.trumpName}` }) : '');
      if (B.trick.length > lastLen) SFX.tap();
      lastLen = B.trick.length;
      B.seats.forEach((x, s) => {
        const turn = B.toPlay === s || B.bidder === s;
        seats[s].className = `bl-seat ${BL_POS[s]} team${x.team}${turn ? ' turn' : ''}`;
        seats[s].replaceChildren(x.player ? avatarEl(x.player, '') : '', h('b', { text: x.player?.name || '' }),
          h('small', { text: `Équipe ${x.team ? 'B' : 'A'}${B.taker === s ? ' · prend' : ''}${B.dealer === s ? ' · donne' : ''}` }), backs(x.cards));
      });
      if (B.turned) {
        center.replaceChildren(h('div', { class: 'bl-turned' }, cardEl(B.turned), h('small', { text: B.bidRound === 1 ? 'Qui prend ?' : '2e tour : autre couleur ?' })));
      } else {
        center.replaceChildren(...B.trick.map((t) => h('div', { class: `bl-trick ${BL_POS[t.seat]}${st.trickDone && st.winner === t.seat ? ' win' : ''}` }, cardEl(t.card, 'pop'))),
          h('div', { class: 'bl-plis', text: `Plis A ${B.tricks[0]} · B ${B.tricks[1]}` }));
      }
    },
  };
}
Object.assign(VIEWS, {
  blBid: beloteTable, blPlay: beloteTable,
  blScore(root, s) {
    const r = s.result;
    (r.verdict === 'dedans' ? SFX.wrong : SFX.correct)();
    root.append(h('div', { class: 'spot' },
      h('h1', { class: 'spot-title', text: r.verdict === 'capot' ? '💥 CAPOT !' : r.verdict === 'fait' ? '✅ Contrat rempli !' : '❌ DEDANS !' }),
      h('p', { class: 'spot-sub', text: `Équipe ${r.takerTeam ? 'B' : 'A'} avait pris · Plis A ${r.tricks[0]} / B ${r.tricks[1]}` }),
      h('div', { class: 'words-reveal' },
        h('div', { class: 'word-box' }, h('small', { text: 'Équipe A' }), h('b', { text: `+${r.result[0]}` }), h('small', { text: `Total ${s.bl.scores[0]}` })),
        h('div', { class: 'word-box imp' }, h('small', { text: 'Équipe B' }), h('b', { text: `+${r.result[1]}` }), h('small', { text: `Total ${s.bl.scores[1]}` })))));
  },
  blEnd(root, s) {
    SFX.fanfare(); SFX.applause(3);
    const names = (t) => s.bl.seats.filter((x) => x.team === t).map((x) => x.player?.name).join(' & ');
    root.append(h('div', { class: 'spot' }, h('div', { class: 'big-emoji', text: '🏆' }),
      h('h1', { class: 'spot-title', text: s.win == null ? 'Égalité !' : `Victoire de ${names(s.win)} !` }),
      h('p', { class: 'spot-sub', text: `Équipe A ${s.bl.scores[0]} – ${s.bl.scores[1]} Équipe B` })));
  },
});

// =====================================================================
// Le Président
// =====================================================================
function presidentTable(root) {
  SFX.whoosh();
  const head = h('div', { class: 'q-head' });
  const pile = h('div', { class: 'pr-pile' });
  const info = h('div', { class: 'pr-info' });
  const seats = h('div', { class: 'pr-seats' });
  root.append(head, h('div', { class: 'pr-center' }, pile, info), seats);
  let lastPile = '';
  return {
    update(st) {
      const P = st.pr;
      head.replaceChildren(h('span', { class: 'chip', text: '👑 Président' }), h('span', { class: 'count', text: `Manche ${P.manche} / ${P.total}` }));
      const key = P.pile ? P.pile.cards.map((c) => c.id).join() : '';
      if (key && key !== lastPile) SFX.tap();
      lastPile = key;
      pile.replaceChildren(...(P.pile && !st.clearing ? [cardsRow(P.pile.cards, 'pop'), h('small', { text: `posé par ${P.pile.player?.name}` })] : [h('div', { class: 'pcard slot' }), h('small', { text: st.clearing ? 'Pli ramassé !' : 'À l’ouvreur de jouer' })]));
      info.replaceChildren(...P.exchange.map((e) => h('div', { class: 'gain', text: `🔁 ${e.poor?.name} a donné ${e.count} carte${e.count > 1 ? 's' : ''} à ${e.rich?.name}` })));
      seats.replaceChildren(...P.seats.map((x, i) => (x.player ? h('div', { class: `pr-seat${P.turn === i ? ' turn' : ''}${x.out ? ' out' : ''}${x.passed ? ' passed' : ''}` },
        avatarEl(x.player, 'sm'), h('b', { text: x.player.name }), x.title ? h('small', { text: `${x.title.icon} ${x.title.name}` }) : '',
        x.out ? h('em', { text: '✅ Fini' }) : backs(x.cards), x.passed ? h('em', { text: 'Passe' }) : '') : '')));
    },
  };
}
Object.assign(VIEWS, {
  prPlay: presidentTable,
  prResult(root, s) {
    SFX.fanfare();
    root.append(endTable(`👑 Résultats de la manche ${s.pr.manche}`, s.rows.map((r) => ({ player: r.player, main: `${r.icon} ${r.title}`, sub: '', points: r.pts }))));
  },
  prEnd(root, s) {
    SFX.fanfare(); SFX.applause(2);
    root.append(endTable('👑 Fin du Président', s.rows.map((r) => ({ player: r.player, main: '', sub: '', points: r.points }))));
  },
});

// =====================================================================
// Le 8 américain
// =====================================================================
function huitTable(root) {
  SFX.whoosh();
  const head = h('div', { class: 'q-head' });
  const center = h('div', { class: 'ht-center' });
  const event = h('div', { class: 'ht-event' });
  const seats = h('div', { class: 'pr-seats' });
  root.append(head, center, event, seats);
  let lastTop = '';
  return {
    update(st) {
      const T = st.ht;
      head.replaceChildren(h('span', { class: 'chip', text: '🎴 8 américain' }), h('span', { class: 'count', text: `Manche ${T.manche} / ${T.total}` }));
      if (T.top.id !== lastTop) { SFX.tap(); lastTop = T.top.id; }
      center.replaceChildren(
        h('div', { class: 'ht-draw' }, cardEl(null), h('small', { text: `Pioche : ${T.drawCount}` })),
        h('div', { class: 'ht-top' }, cardEl(T.top, 'big pop'), h('div', { class: `ht-suit ${T.suit === 'H' || T.suit === 'D' ? 'red' : ''}`, text: `${SUIT_SYM[T.suit]} ${T.suitName}` })),
        h('div', { class: 'ht-dir', text: T.dir === 1 ? '↻' : '↺', title: 'Sens du jeu' }));
      event.textContent = T.lastEvent || '';
      seats.replaceChildren(...T.seats.map((x, i) => (x.player ? h('div', { class: `pr-seat${T.turn === i ? ' turn' : ''}${x.cards === 1 ? ' last' : ''}` },
        avatarEl(x.player, 'sm'), h('b', { text: x.player.name }), backs(x.cards), x.cards === 1 ? h('em', { text: '⚠️ Dernière carte !' }) : '') : '')));
    },
  };
}
Object.assign(VIEWS, {
  htPlay: huitTable,
  htResult(root, s) {
    SFX.fanfare();
    root.append(endTable(`🎴 Manche ${s.ht.manche}`, s.rows.map((r) => ({ player: r.player, main: r.winner ? '🏆 Main vide !' : `${r.left} carte${r.left > 1 ? 's' : ''}`, sub: '', points: r.pts }))));
  },
  htEnd(root, s) {
    SFX.fanfare(); SFX.applause(2);
    root.append(endTable('🎴 Fin du 8 américain', s.rows.map((r) => ({ player: r.player, main: '', sub: '', points: r.points }))));
  },
});

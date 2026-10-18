// Accueil : choix des jeux plus clair — filtres par famille, recherche, cartes avec vignette
// d'aperçu (une maquette de l'écran du jeu) et fenêtre « Aperçu » avec les règles.
/* global document, location, window */

(() => {
  const link = (params) => window.ShowMode.link(params);
  const m = (tag, cls, text, ...kids) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    // Le 3e argument est soit un texte, soit déjà des éléments enfants (tableau ou élément).
    if (Array.isArray(text) || text instanceof Node) kids.unshift(text);
    else if (text != null && text !== '') el.textContent = text;
    kids.flat().forEach((k) => k && el.append(k));
    return el;
  };
  const SH = ['▲', '◆', '●', '■'];
  const av = (e, c) => { const a = m('span', 'pv-av', e); a.style.setProperty('--c', c); return a; };
  const card = (txt, red, back) => m('span', `pv-card${red ? ' red' : ''}${back ? ' back' : ''}`, back ? '' : txt);

  // ---------- maquettes : une petite reproduction de l'écran de chaque jeu ----------
  const qa = (q, answers, chip) => [m('span', 'pv-chip', chip), m('b', 'pv-q', q),
    m('div', 'pv-answers', answers.map((t, i) => m('span', `pv-ans c${i}`, null, m('i', '', SH[i]), m('span', '', t))))];
  const PREVIEWS = {
    quiz: () => qa('Quelle est la capitale de l’Australie ?', ['Canberra', 'Sydney', 'Melbourne', 'Perth'], 'Question 3 / 8'),
    petitbac: () => [m('span', 'pv-ball', 'M'), m('div', 'pv-rows', [['Pays', 'Maroc'], ['Animal', 'Mouton'], ['Prénom', 'Marie'], ['Métier', 'Médecin']]
      .map(([k, v]) => m('div', 'pv-row', null, m('small', '', k), m('b', '', v), m('i', 'ok', '✓'))))],
    undercover: () => [m('b', 'pv-title', 'Qui est l’imposteur ?'), m('div', 'pv-circle', [['🦊', '#f97316', 'Jaune'], ['🐼', '#22d3ee', 'Sucré'], ['🐸', '#a3e635', 'Singe'], ['🦄', '#c084fc', 'Euh… fruit ?']]
      .map(([e, c, w], k) => m('div', `pv-spk${k === 3 ? ' sus' : ''}`, null, av(e, c), m('span', 'pv-bub', w))))],
    pendu: () => [m('span', 'pv-chip', 'Indice : une ville'), m('div', 'pv-gallows', '🪢'), m('div', 'pv-tiles', [...'PA_I_'].map((l) => m('span', l === '_' ? 'pv-tile' : 'pv-tile on', l === '_' ? '' : l))),
      m('div', 'pv-keys', [...'AEIRSTP'].map((l) => m('span', '', l)))],
    estimation: () => [m('b', 'pv-q', 'Combien mesure la tour Eiffel ?'), m('div', 'pv-est', null, m('span', '', '🎯'), m('b', '', '330 m')),
      m('div', 'pv-gains', [['🦊', '320 m', '+300'], ['🐼', '300 m', '+150']].map(([e, v, p]) => m('span', '', `${e} ${v} ${p}`)))],
    motus: () => {
      const g = m('div', 'pv-motus');
      const rows = [['B', 'A', 'T', 'E', 'A', 'U'], ['B', 'O', 'U', 'G', 'I', 'E']];
      const st = [['ok', 'no', 'no', 'mis', 'no', 'no'], ['ok', 'ok', 'ok', 'ok', 'ok', 'ok']];
      rows.forEach((r, i) => r.forEach((l, k) => g.append(m('span', st[i][k], l))));
      for (let k = 0; k < 18; k++) g.append(m('span', '', k % 6 === 0 && k < 6 ? 'B' : ''));
      return [g];
    },
    motpourmot: () => [m('div', 'pv-pyr', [['100', ''], ['200', ''], ['300', '« Château »'], ['400', '« Sable »']].map(([v, c], k) => m('div', k === 2 ? 'now' : '', null, m('b', '', v), m('span', '', c)))),
      m('span', 'pv-chip', '_ _ _ _ _')],
    sondage: () => [m('b', 'pv-q', 'Citez un animal de la ferme'), m('div', 'pv-feud', [['La vache', 32], [null, 24], ['Le cochon', 18], [null, 12], [null, 9], [null, 5]]
      .map(([l, p], k) => m('span', l ? 'open' : '', null, m('i', '', String(k + 1)), m('span', '', l || ''), m('b', '', l ? String(p) : ''))))],
    rouelettres: () => [m('div', 'pv-wof', [...'LA TOUR E__FEL'].map((c) => m('span', c === ' ' ? 'sp' : c === '_' ? '' : 'on', c === '_' || c === ' ' ? '' : c))), m('span', 'pv-wheel', null, m('i', '', '🔠'))],
    ile: () => [m('div', 'pv-tribes', null, m('span', 'a', '🪸 Les Coraux'), m('span', 'b', '🌋 Les Volcans')),
      m('div', 'pv-poles', [['🦊', '#f97316'], ['🐼', '#22d3ee'], ['🐸', '#a3e635'], ['🦄', '#c084fc']].map(([e, c], k) => m('div', k === 2 ? 'fell' : '', null, av(e, c), m('i')))), m('small', 'pv-cap', '🪵 Les poteaux : le dernier debout gagne !')],
    tourtereaux: () => [m('div', 'pv-duo', null, av('🦊', '#f97316'), m('span', 'pv-heart', '💕'), av('🐼', '#22d3ee')), m('b', 'pv-q', 'Le plat préféré de Lou ?'),
      m('div', 'pv-pair', null, m('span', '', 'Lou : Pizza'), m('span', 'ok', 'Sam : Pizza ✓'))],
    ludo: () => {
      const b = m('div', 'pv-ludo');
      ['r', 'g', 'y', 'b'].forEach((c) => b.append(m('span', `yard ${c}`)));
      b.append(m('span', 'cross'), m('span', 'mid', '🏁'));
      return [b];
    },
    roue: () => {
      const r = m('div', 'pv-ring');
      const cols = ['#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#22c55e'];
      for (let k = 0; k < 20; k++) { const s = m('span'); s.style.setProperty('--a', `${k * 18}deg`); s.style.setProperty('--c', cols[k % 5]); r.append(s); }
      r.append(m('b', '', '🎡'));
      return [r];
    },
    vie: () => [m('div', 'pv-tilt green', null, m('div', 'pv-road'), m('span', 'pv-pawn', '🦊'), m('span', 'pv-tree a', '🌳'), m('span', 'pv-tree b', '🏡'), m('span', 'pv-tree c', '🏰')), m('span', 'pv-wheel small')],
    mois: () => {
      const cal = m('div', 'pv-cal');
      for (let d = 1; d <= 21; d++) cal.append(m('span', d % 7 === 0 ? 'sun' : d === 5 ? 'bill' : d === 15 ? 'gold' : '', String(d)));
      return [m('div', 'pv-tilt wood', null, m('span', 'pv-caltitle', '📅 FIN DE MOIS'), cal), m('span', 'pv-dice', '⚄')];
    },
    belote: () => [m('div', 'pv-felt', null, m('div', 'pv-hand', card('V♥', true), card('9♥', true), card('A♠'), card('10♦', true), card('R♣')), m('span', 'pv-chip', 'Atout ♥'))],
    poker: () => [m('div', 'pv-felt', null, m('div', 'pv-board', card('A♠'), card('K♥', true), card('7♣'), card('', false, true), card('', false, true)), m('div', 'pv-hand small', card('A♦', true), card('A♣')), m('span', 'pv-chips', '🪙 1 200'))],
    president: () => [m('div', 'pv-felt', null, m('div', 'pv-board', card('2♠'), card('2♥', true)), m('span', 'pv-chip', '👑 Président'))],
    huit: () => [m('div', 'pv-felt', null, m('div', 'pv-board', card('', false, true), card('8♣')), m('span', 'pv-chip', 'Couleur : ♦'))],
    blackjack: () => [m('div', 'pv-felt', null, m('div', 'pv-board', card('K♠'), card('', false, true)), m('div', 'pv-hand small', card('A♥', true), card('Q♦', true)), m('span', 'pv-chip', '21 ! Blackjack'))],
    bataille: () => [m('div', 'pv-felt', null, m('div', 'pv-versus', null, card('R♠'), m('b', '', 'VS'), card('7♦', true)))],
    couple: () => [m('div', 'pv-duo', null, av('💗', '#ec4899'), m('span', 'pv-heart', '💞'), av('💗', '#8b5cf6')), m('b', 'pv-q', 'Regardez vos téléphones…'), m('small', 'pv-cap', '🔒 Rien n’est enregistré')],
    brulant: () => [m('div', 'pv-br', null, m('span', 'truth', '💬 Vérité'), m('span', 'dare', '🔥 Action')), m('small', 'pv-cap', '🌶️ Sensuel → 🌶️🌶️🌶️ Osé · 🔒 privé')],
  };
  const FAMILY_BG = { quick: 'pv-bg-quick', tv: 'pv-bg-tv', board: 'pv-bg-board', cards: 'pv-bg-cards', adult: 'pv-bg-adult' };

  function preview(g, family) {
    const s = m('div', `pv-screen ${FAMILY_BG[family] || ''} pvg-${g.id}`);
    s.setAttribute('aria-hidden', 'true');
    s.append(...(PREVIEWS[g.id] ? PREVIEWS[g.id]() : [m('span', 'pv-big', g.icon)]));
    return s;
  }

  // ---------- lancement (confirmation 18+ pour les jeux privés) ----------
  function launch(g, family, e) {
    if (family === 'adult' && !window.confirm('🔞 Jeu privé réservé aux adultes consentants (2 joueurs).\nRien n’est enregistré. Continuer ?')) { e?.preventDefault(); return false; }
    return true;
  }

  // ---------- fenêtre « Aperçu » ----------
  let modal = null;
  function openPreview(g, family) {
    modal?.remove();
    const play = m('a', 'btn gold big', '▶ Lancer ce jeu');
    play.dataset.launch = `format=quick&game=${g.id}`;
    play.href = link(play.dataset.launch);
    play.addEventListener('click', (e) => launch(g, family, e));
    const close = () => { modal.remove(); modal = null; document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const shut = m('button', 'pv-close', '✕');
    shut.type = 'button';
    shut.setAttribute('aria-label', 'Fermer l’aperçu');
    shut.addEventListener('click', close);
    modal = m('div', 'pv-modal', null, m('div', 'pv-dialog', null,
      shut,
      preview(g, family),
      m('div', 'pv-info', null,
        m('h3', '', `${g.icon} ${g.title}`),
        m('p', 'pv-pitch', g.pitch),
        m('p', 'pv-rules', g.rules),
        m('div', 'pv-meta', null, m('span', '', `👥 ${g.players || '1 à 12 joueurs'}`), m('span', '', `⏱ ${g.duration || '10 min'}`), m('span', '', '📱 Chacun son téléphone')),
        play)));
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', `Aperçu : ${g.title}`);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    document.addEventListener('keydown', onKey);
    document.body.append(modal);
    play.focus();
  }

  // ---------- cartes de jeu ----------
  function gameCard(g, family) {
    const el = m('article', `game-card${family === 'adult' ? ' adult' : ''}`);
    el.dataset.family = family;
    el.dataset.search = `${g.title} ${g.pitch} ${g.rules || ''}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const thumb = m('button', 'gc-thumb', null, preview(g, family), m('span', 'gc-eye', '👁 Aperçu'));
    thumb.type = 'button';
    thumb.setAttribute('aria-label', `Voir l’aperçu de ${g.title}`);
    thumb.addEventListener('click', () => openPreview(g, family));
    const play = m('a', 'btn gold', 'Jouer ▶');
    play.dataset.launch = `format=quick&game=${g.id}`;
    play.href = link(play.dataset.launch);
    play.addEventListener('click', (e) => launch(g, family, e));
    const more = m('button', 'btn ghost', 'Aperçu');
    more.type = 'button';
    more.addEventListener('click', () => openPreview(g, family));
    el.append(thumb, m('div', 'gc-body', null,
      m('div', 'gc-head', null, m('span', 'gc-ic', g.icon), m('b', '', g.title)),
      m('p', 'gc-pitch', g.pitch),
      m('small', 'gc-meta', `👥 ${g.players || '1 à 12 joueurs'} · ⏱ ${g.duration || '10 min'}`),
      m('div', 'gc-actions', null, play, more)));
    return el;
  }

  // ---------- filtres + recherche ----------
  const FAMILIES = [
    { id: 'quick', label: '⚡ Rapides', title: '⚡ Parties rapides', sub: 'un seul jeu, 5 à 15 minutes' },
    { id: 'tv', label: '📺 Jeux télé', title: '📺 Jeux télé', sub: 'comme à la télé, avec nos propres règles' },
    { id: 'board', label: '🎲 Plateau', title: '🎲 Jeux de plateau', sub: 'dés, pions et coups bas' },
    { id: 'cards', label: '🃏 Cartes', title: '🃏 Jeux de cartes', sub: 'vos cartes restent cachées sur votre téléphone' },
    { id: 'adult', label: '🔞 Adultes', title: '🔞 Pour adultes', sub: 'jeux privés pour les couples, rien n’est enregistré' },
  ];
  window.buildGamePicker = function buildGamePicker(catalog, root) {
    let current = 'all';
    let query = '';
    const chips = m('div', 'gp-chips');
    const search = m('input', 'gp-search');
    search.type = 'search';
    search.placeholder = '🔎 Chercher un jeu (ex. poker, mots, quiz…)';
    search.setAttribute('aria-label', 'Chercher un jeu');
    const empty = m('p', 'gp-empty hidden', 'Aucun jeu ne correspond. Essayez un autre mot !');
    const sections = FAMILIES.map((f) => {
      const list = catalog[f.id] || [];
      const sec = m('section', 'gp-family', null, m('h3', 'family', f.title, m('small', '', f.sub)),
        m('div', 'gp-grid', list.map((g) => gameCard(g, f.id))));
      sec.dataset.family = f.id;
      return sec;
    });
    const all = [{ id: 'all', label: `Tous (${FAMILIES.reduce((n, f) => n + (catalog[f.id] || []).length, 0)})` }, ...FAMILIES.map((f) => ({ id: f.id, label: `${f.label} (${(catalog[f.id] || []).length})` }))];
    const chipEls = all.map((f) => {
      const b = m('button', 'chip', f.label);
      b.type = 'button';
      b.addEventListener('click', () => { current = f.id; apply(); });
      b.dataset.f = f.id;
      return b;
    });
    chips.append(...chipEls);
    function apply() {
      const q = query.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
      let shown = 0;
      chipEls.forEach((b) => { const on = b.dataset.f === current; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
      sections.forEach((sec) => {
        let n = 0;
        sec.querySelectorAll('.game-card').forEach((c) => { const ok = (current === 'all' || c.dataset.family === current) && (!q || c.dataset.search.includes(q)); c.hidden = !ok; if (ok) n++; });
        sec.hidden = !n;
        shown += n;
      });
      empty.classList.toggle('hidden', shown > 0);
    }
    search.addEventListener('input', () => { query = search.value; apply(); });
    root.append(m('div', 'gp-bar', null, chips, search), ...sections, empty);
    apply();
  };
})();

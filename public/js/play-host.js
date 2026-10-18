// Mode « téléphones seulement » : le téléphone de l'organisateur crée le salon, en est l'animateur
// (inviter, choisir le jeu, lancer, Suivant, Pause, Finale…) ET y joue comme les autres.
// Une seconde connexion « animateur » est ouverte à côté de la connexion « joueur ».
/* global io, h, toast, SFX, confirm, navigator, location */

const Organizer = (() => {
  const KEY = 'showtime-host';
  const params = new URLSearchParams(location.search);
  let created = false;
  let hs = null; // connexion animateur
  let hst = null; // dernier état « écran principal » reçu
  let catalog = null;
  let sheet = null;
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
  const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* */ } };
  const action = (type, extra = {}) => hs?.emit('host:action', { type, ...extra });
  const send = (patch) => action('settings', { settings: { ...hst.settings, ...patch } });

  function open() {
    if (hs) return hs;
    hs = io({ transports: ['websocket', 'polling'], forceNew: true });
    hs.on('state', (s) => { hst = s; paint(); });
    hs.on('connect', () => {
      const saved = load();
      if (saved && created) hs.emit('host:resume', { code: saved.code, hostToken: saved.token }, () => {});
    });
    fetch('/api/catalog').then((r) => r.json()).then((c) => { catalog = c; }).catch(() => {});
    return hs;
  }

  // ---------- invitation ----------
  async function invite() {
    let url = `${location.origin}/play?room=${hst?.code}`;
    try { const info = await (await fetch(`/api/join-info?room=${hst.code}`)).json(); if (info.url) url = info.url; } catch { /* */ }
    const text = `🎬 Rejoins ma partie SHOWTIME ! Code ${hst.code}`;
    if (navigator.share) { try { await navigator.share({ title: 'SHOWTIME', text, url }); return; } catch { /* annulé */ } }
    try { await navigator.clipboard.writeText(`${text} : ${url}`); toast('🔗 Lien copié ! Colle-le dans un SMS ou sur WhatsApp.', 4000); } catch { toast(url, 6000); }
  }

  // ---------- choix du jeu ----------
  function gameSheet() {
    if (!catalog) { toast('Chargement des jeux…'); return; }
    const se = hst.settings;
    const pick = (patch, adult) => {
      if (adult && !confirm('🔞 Jeu privé réservé aux adultes consentants (2 joueurs). Rien n’est enregistré. Continuer ?')) return;
      send(patch); SFX.pop(); closeSheet();
    };
    const tile = (g, family) => h('button', { class: se.format === 'quick' && se.game === g.id ? 'on' : '', onclick: () => pick({ format: 'quick', game: g.id }, family === 'adult') },
      h('span', { text: g.icon }), g.title);
    const fams = [['quick', '⚡ Parties rapides'], ['tv', '📺 Jeux télé'], ['board', '🎲 Plateau'], ['cards', '🃏 Cartes'], ['adult', '🔞 Pour adultes']];
    openSheet(h('div', { class: 'org-head' }, h('h3', { text: '🎮 Choisir le jeu' }), h('button', { class: 'chat-close', onclick: closeSheet }, '✕')),
      h('div', { class: 'org-grid' }, h('button', { class: se.format === 'show' ? 'on' : '', onclick: () => pick({ format: 'show' }) }, h('span', { text: '🎬' }), 'Le Grand Show')),
      ...fams.flatMap(([id, label]) => [h('p', { class: 'org-fam', text: label }), h('div', { class: 'org-grid' }, ...(catalog[id] || []).map((g) => tile(g, id)))]),
      h('p', { class: 'org-fam', text: '⏱ Durée' }),
      h('div', { class: 'org-row' }, ...[['short', 'Courte'], ['normal', 'Normale'], ['long', 'Longue']].map(([k, l]) => h('button', { class: `chip${se.length === k ? ' on' : ''}`, onclick: () => { send({ length: k }); closeSheet(); } }, l))));
  }

  // ---------- commandes pendant la partie ----------
  function controlSheet() {
    const inGame = hst.phase !== 'lobby' && hst.phase !== 'final';
    openSheet(h('div', { class: 'org-head' }, h('h3', { text: '👑 Animateur' }), h('button', { class: 'chat-close', onclick: closeSheet }, '✕')),
      h('div', { class: 'org-code', text: hst.code }),
      h('button', { class: 'btn', onclick: invite }, '📤 Inviter des joueurs'),
      h('div', { class: 'org-actions' },
        h('button', { class: 'btn gold', disabled: !hst.canSkip || undefined, onclick: () => { action('skip'); closeSheet(); } }, '⏭ Suivant'),
        inGame ? h('button', { class: 'btn', onclick: () => { action(hst.paused ? 'resume' : 'pause'); closeSheet(); } }, hst.paused ? '▶️ Reprendre' : '⏸ Pause') : '',
        inGame ? h('button', { class: 'btn', onclick: () => { if (confirm('Passer directement au classement final ?')) { action('end'); closeSheet(); } } }, '🏁 Finale') : '',
        h('button', { class: 'btn ghost', onclick: () => { if (confirm('Revenir au salon pour choisir un autre jeu ?')) { action('restart'); closeSheet(); } } }, '🏠 Salon')),
      h('small', { class: 'muted', text: 'Tu es aussi joueur : ton écran de jeu reste juste en dessous.' }));
  }

  function openSheet(...kids) {
    closeSheet();
    sheet = h('div', { class: 'org-sheet', role: 'dialog', 'aria-label': 'Commandes de l’animateur' }, ...kids);
    document.body.append(sheet);
  }
  function closeSheet() { sheet?.remove(); sheet = null; }

  // ---------- barre de l'animateur ----------
  function paint() {
    if (!hst) return;
    document.body.classList.add('organizer');
    let bar = document.getElementById('org-bar');
    let crown = document.getElementById('org-crown');
    if (hst.phase === 'lobby') {
      crown?.remove();
      if (!bar) { bar = h('div', { id: 'org-bar', class: 'org-bar' }); document.body.append(bar); }
      const se = hst.settings;
      const all = catalog ? [...catalog.quick, ...catalog.tv, ...catalog.board, ...catalog.cards, ...catalog.adult] : [];
      const game = se.format === 'show' ? { icon: '🎬', title: 'Le Grand Show' } : all.find((g) => g.id === se.game) || { icon: '🎮', title: se.game };
      const n = hst.players.filter((p) => p.connected).length;
      bar.replaceChildren(
        h('button', { class: 'btn', onclick: invite }, '📤 Inviter'),
        h('button', { class: 'btn ghost org-game', onclick: gameSheet }, `${game.icon} ${game.title} ▾`),
        h('button', { class: 'btn gold', onclick: () => { action('start'); SFX.pop(); } }, `🚀 Lancer (${n})`));
    } else {
      bar?.remove();
      if (!crown) { crown = h('button', { id: 'org-crown', class: 'org-crown', 'aria-label': 'Commandes de l’animateur', onclick: controlSheet }, '👑'); document.body.append(crown); }
    }
  }

  return {
    /** Ce téléphone est-il en train de créer une partie (mode téléphones seulement) ? */
    creating: () => params.get('create') === '1' && !created,
    /** Crée le salon avec le jeu choisi sur l'accueil ; renvoie son code. */
    create() {
      open();
      return new Promise((ok, ko) => {
        const go = () => hs.emit('host:create', { mode: 'remote', format: params.get('format'), game: params.get('game'), themes: params.get('themes') || undefined }, (res) => {
          if (res.error) { ko(new Error(res.error)); return; }
          created = true;
          save({ code: res.code, token: res.hostToken, phones: true });
          ok(res.code);
        });
        if (hs.connected) go(); else hs.once('connect', go);
      });
    },
    /** Au rechargement de la page : si ce téléphone anime ce salon, on reprend les commandes. */
    resume(roomCode) {
      const saved = load();
      if (!saved || !saved.phones || saved.code !== roomCode || hs) return;
      created = true;
      open();
    },
  };
})();

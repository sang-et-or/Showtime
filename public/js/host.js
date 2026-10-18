// Écran hôte : le « plateau télé ». Il affiche l'état envoyé par le serveur et joue l'ambiance.
/* global io, $, h, avatarEl, SHAPES, SFX, Voice, confetti, keepAwake, makeCountdown, toast, fmt */

const socket = io({ transports: ['websocket', 'polling'] });
const STORE = 'showtime-host';
let params = new URLSearchParams(location.search);
// Mode « mini-écran » : la page télé affichée en lecture seule dans le téléphone d'un joueur à distance.
const SPECTATE = params.get('spectate') === '1';
if (SPECTATE) document.body.classList.add('mini');
// Mode « télé » : le plateau affiché sur une télé (Chromecast, navigateur de la télé…), en lecture seule.
const TV_PIN = /^\d{6}$/.test(params.get('tv') || '') ? params.get('tv') : null;
if (TV_PIN) document.body.classList.add('tv');
let state = null;
let viewKey = null;
let view = null; // { update(state) } de la vue courante
let curtainOpen = false;
let lastLine = { id: -1, text: '' };
let knownPlayers = new Set();
let joinInfo = null;
let timeouts = [];

const later = (ms, fn) => timeouts.push(setTimeout(fn, ms));
const clearLater = () => { timeouts.forEach(clearTimeout); timeouts = []; };
const action = (type, extra = {}) => socket.emit('host:action', { type, ...extra });
const loadHost = () => { try { return JSON.parse(localStorage.getItem(STORE)); } catch { return null; } };
const saveHost = (code, token) => { try { localStorage.setItem(STORE, JSON.stringify({ code, token })); } catch { /* navigation privée */ } };

// ---------------------------------------------------------------------------
// Connexion / reprise
// ---------------------------------------------------------------------------
socket.on('connect', () => {
  $('.offline-banner')?.remove();
  if (SPECTATE) { spectate(); return; }
  if (TV_PIN) { watchTv(); return; }
  const saved = loadHost();
  const room = params.get('room');
  if (room) {
    if (!saved || saved.code !== room) return expired();
    socket.emit('host:resume', { code: saved.code, hostToken: saved.token }, (res) => { if (res.error) expired(); else ready(); });
  } else if (params.get('new')) {
    socket.emit('host:create', { mode: params.get('new') === 'remote' ? 'remote' : 'local', format: params.get('format'), game: params.get('game'), themes: params.get('themes') || undefined }, (res) => {
      if (res.error) { toast(res.error, 6000); return; }
      saveHost(res.code, res.hostToken);
      history.replaceState(null, '', `/host?room=${res.code}`);
      params = new URLSearchParams(location.search);
      ready();
    });
  } else {
    location.href = '/';
  }
});

socket.on('disconnect', () => {
  if (!$('.offline-banner')) document.body.append(h('div', { class: 'offline-banner', text: 'Connexion perdue… reconnexion en cours' }));
});

socket.on('state', (s) => render(s));

// 📸 Une photo vient d'être prise : on l'affiche quelques secondes façon polaroïd.
const photoQueue = [];
let photoShowing = false;
socket.on('photo', (p) => { photoQueue.push(p); if (!photoShowing) nextPhoto(); });
function photoAuth() {
  if (SPECTATE) {
    const ident = JSON.parse(localStorage.getItem('showtime-player') || '{}');
    return { 'x-room': ident.code, 'x-player-id': ident.playerId, 'x-player-token': ident.token };
  }
  if (TV_PIN) return { 'x-room': state?.code || '', 'x-tv-pin': TV_PIN };
  const saved = loadHost();
  return { 'x-room': saved.code, 'x-host-token': saved.token };
}

async function nextPhoto() {
  const p = photoQueue.shift();
  if (!p) { photoShowing = false; return; }
  photoShowing = true;
  const auth = photoAuth();
  try {
    const res = await fetch(`/api/photos/${p.id}`, { headers: auth });
    if (!res.ok) throw new Error();
    const url = URL.createObjectURL(await res.blob());
    SFX.pop();
    const pola = h('div', { class: 'polaroid' }, h('img', { src: url, alt: `Photo de ${p.by.name}` }), h('b', { text: `📸 ${p.by.avatar} ${p.by.name}` }),
      h('button', { class: 'pola-del', title: 'Retirer cette photo', onclick: async () => {
        await fetch(`/api/photos/${p.id}`, { method: 'DELETE', headers: { 'x-showtime': '1', ...auth } });
        pola.remove(); toast('Photo retirée');
      } }, '🗑️'));
    document.body.append(pola);
    setTimeout(() => { pola.classList.add('out'); setTimeout(() => { pola.remove(); URL.revokeObjectURL(url); nextPhoto(); }, 600); }, 6000);
  } catch { nextPhoto(); }
}

/** Lecture seule : on s'identifie avec les identifiants du joueur enregistrés sur ce téléphone. */
function spectate() {
  $('#curtain').classList.add('hidden');
  let ident = null;
  try { ident = JSON.parse(localStorage.getItem('showtime-player')); } catch { /* */ }
  if (!ident) return;
  socket.emit('spectator:watch', ident, (res) => {
    if (res.error) $('#view').replaceChildren(h('div', { class: 'round-intro' }, h('p', { text: 'Écran indisponible : rejoins d’abord la partie.' })));
  });
}

/** La télé se connecte avec le code télé ; le rideau reste pour débloquer le son (une touche de la télécommande). */
function watchTv() {
  socket.emit('tv:watch', { pin: TV_PIN }, (res) => {
    if (res.error) {
      $('#curtain').classList.add('hidden');
      $('#view').replaceChildren(h('div', { class: 'round-intro' }, h('div', { class: 'icon', text: '📺' }), h('h1', { text: 'Code télé inconnu' }),
        h('p', { text: res.error }), h('a', { class: 'btn gold big', href: '/tv', text: 'Retaper le code' })));
      return;
    }
    if (curtainOpen) return;
    const b = $('#open-curtain');
    b.disabled = false;
    b.textContent = 'Afficher le plateau 📺';
    b.focus();
  });
}

/** Panneau « Sur la télé » : Chromecast en un clic, code télé pour les télés connectées, ou câble HDMI. */
function openTvPanel() {
  if ($('.tv-pop')) { $('.tv-pop').remove(); return; }
  const pin = state.tvPin;
  const base = joinInfo ? new URL(joinInfo.url).origin : location.origin;
  const tvUrl = `${location.origin}/host?tv=${pin}`;
  const close = () => pop.remove();
  const castBtn = 'PresentationRequest' in window ? h('button', { class: 'btn gold', onclick: async () => {
    try {
      const req = new PresentationRequest([tvUrl]);
      await req.start();
      toast('📺 Plateau envoyé sur la télé ! Touchez « Afficher le plateau » avec la télécommande si besoin.', 6000);
      close();
    } catch (e) { if (e.name !== 'AbortError' && e.name !== 'NotAllowedError') toast('Aucune télé compatible trouvée. Essayez le menu ⋮ de Chrome → « Caster… ».', 6000); }
  } }, '📡 Caster sur la télé (Chromecast, Google TV)') : '';
  const pop = h('div', { class: 'tv-pop panel', role: 'dialog', 'aria-label': 'Afficher le plateau sur la télé' },
    h('div', { class: 'tv-pop-head' }, h('b', { text: '📺 Mettre le plateau sur la télé' }), h('button', { class: 'tool', 'aria-label': 'Fermer', onclick: close }, '✕')),
    state.tvCount ? h('p', { class: 'tv-ok', text: `✅ ${state.tvCount} écran${state.tvCount > 1 ? 's' : ''} télé connecté${state.tvCount > 1 ? 's' : ''}` }) : '',
    h('section', {}, h('h4', { text: '1. Télé connectée (Smart TV, Android TV, box, console)' }),
      h('p', {}, 'Ouvrez le navigateur internet de la télé, allez sur ', h('b', { text: `${base.replace(/^https?:\/\//, '')}/tv` }), ' puis tapez ce code :'),
      h('div', { class: 'tv-pin', text: pin.replace(/(\d{3})(\d{3})/, '$1 $2') })),
    h('section', {}, h('h4', { text: '2. Chromecast ou Google TV' }),
      castBtn || h('p', { text: 'Ouvrez ce plateau dans Google Chrome ou Microsoft Edge pour caster en un clic.' }),
      h('p', { class: 'muted', text: 'Autre solution : menu ⋮ de Chrome → « Caster… » → choisissez la télé (l’onglet entier s’affiche).' })),
    h('section', {}, h('h4', { text: '3. Avec un câble HDMI ou en Wi-Fi (Windows)' }),
      h('p', { class: 'muted', text: 'Branchez l’ordinateur à la télé avec un câble HDMI, puis appuyez sur ⊞ Windows + P → « Dupliquer ». Sans câble : ⊞ Windows + K pour choisir une télé compatible Miracast. Puis ⛶ pour le plein écran.' })),
    h('p', { class: 'muted small', text: 'Avec les solutions 1 et 2, l’ordinateur reste votre télécommande : Suivant, Pause, réglages… et la télé affiche le spectacle.' }));
  document.body.append(pop);
}
$('#btn-tv').addEventListener('click', () => openTvPanel());

function ready() {
  const b = $('#open-curtain');
  b.disabled = false;
  b.textContent = 'Ouvrir le plateau 🎬';
}

function expired() {
  $('#curtain').classList.add('hidden');
  $('#view').replaceChildren(h('div', { class: 'round-intro' },
    h('div', { class: 'icon', text: '🕰️' }),
    h('h1', { text: 'Salon expiré' }),
    h('p', { text: 'Ce salon n’existe plus (le serveur a peut-être redémarré). Créez-en un nouveau, ça prend 2 secondes !' }),
    h('a', { class: 'btn gold big', href: '/host?new=1', text: 'Créer un nouveau salon' })));
}

// ---------------------------------------------------------------------------
// Boutons de la barre du haut
// ---------------------------------------------------------------------------
$('#open-curtain').addEventListener('click', () => {
  SFX.unlock();
  curtainOpen = true;
  $('#curtain').classList.add('open');
  setTimeout(() => $('#curtain').classList.add('hidden'), 1000);
  SFX.fanfare();
  keepAwake();
  if (state) setTimeout(() => speak(state.line.text), 900);
});
$('#btn-skip').addEventListener('click', () => action('skip'));
$('#btn-pause').addEventListener('click', () => action('pause'));
$('#btn-end').addEventListener('click', () => { if (confirm('Passer directement à la Grande Finale ?')) action('end'); });
$('#btn-home').addEventListener('click', () => {
  if (confirm('Annuler la partie en cours et revenir au salon ?\nLes joueurs restent connectés : vous pourrez choisir un autre jeu.')) action('restart');
});

// Menu « voix de l'animateur » : activer/couper, choisir la voix, tester.
$('#btn-voice').addEventListener('click', () => {
  if ($('.voice-pop')) { $('.voice-pop').remove(); return; }
  const voices = Voice.voices();
  const select = h('select', { class: 'voice-select', 'aria-label': 'Voix' }, ...voices.map((v) => h('option', { value: v.name, text: `${v.natural ? '⭐ ' : ''}${v.name}` })));
  select.value = Voice.current;
  select.addEventListener('change', () => { Voice.use(select.value); speak('Bonsoir ! Ici Max Paillettes, prêt pour le show !'); paint(); });
  const toggle = h('button', { class: 'chip' });
  const tip = h('p', { class: 'voice-tip' });
  function paint() {
    toggle.textContent = Voice.enabled ? '🔊 Voix activée' : '🔇 Voix coupée';
    toggle.classList.toggle('on', Voice.enabled);
    $('#btn-voice').setAttribute('aria-pressed', String(Voice.enabled));
    tip.textContent = Voice.natural
      ? '⭐ Voix naturelle sélectionnée.'
      : 'Astuce : pour une voix bien plus naturelle (et gratuite), ouvrez le plateau dans Microsoft Edge, puis choisissez une voix marquée ⭐ « Online (Natural) ». Sur Chrome, préférez « Google français ».';
  }
  toggle.addEventListener('click', () => { Voice.enabled = !Voice.enabled; paint(); });
  const pop = h('div', { class: 'voice-pop panel', role: 'dialog', 'aria-label': 'Voix de l’animateur' },
    h('b', { text: '🗣️ Voix de Max Paillettes' }), toggle,
    voices.length ? select : h('p', { text: 'Aucune voix française trouvée sur cet appareil.' }),
    h('button', { class: 'chip', onclick: () => speak('Mesdames et messieurs, bienvenue sur le plateau de Chô-taïme ! Ce soir, c’est vous les stars !') }, '▶️ Tester'),
    tip);
  paint();
  document.body.append(pop);
});
$('#btn-sound').addEventListener('click', (e) => {
  SFX.muted = !SFX.muted;
  e.currentTarget.setAttribute('aria-pressed', String(!SFX.muted));
});
$('#btn-fs').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => {});
});
if (!Voice.supported) $('#btn-voice').hidden = true;
if (SPECTATE) {
  SFX.muted = true; Voice.enabled = false;
  $('#btn-sound').setAttribute('aria-pressed', 'false');
  $('#btn-sound').title = 'Activer le son et la voix de l’animateur';
  $('#btn-sound').addEventListener('click', () => {
    SFX.unlock();
    curtainOpen = true;
    Voice.enabled = !SFX.muted;
  });
}

// ---------------------------------------------------------------------------
// L'animateur
// ---------------------------------------------------------------------------
function speak(text) {
  const mic = $('#mic');
  Voice.speak(text, () => mic.classList.add('talking'), () => mic.classList.remove('talking'));
}

function showLine(line) {
  if (!line || line.id === lastLine.id) return;
  lastLine = line;
  const said = $('#said');
  said.replaceChildren(...line.text.split(' ').map((w, i) => {
    const s = h('span', { text: `${w} ` });
    s.style.animationDelay = `${i * 45}ms`;
    return s;
  }));
  if (curtainOpen) speak(line.text);
}

// ---------------------------------------------------------------------------
// Minuteur
// ---------------------------------------------------------------------------
// Pas de tic-tac pendant les phases d'écriture ou de discussion (trop stressant).
const NO_TICK = new Set(['writing', 'bacWrite', 'undClues', 'defiGet']);
const CIRC = 276.5;
const countdown = makeCountdown((left, total, sec, changed) => {
  const t = $('#timer');
  if (!total) { t.classList.add('hidden'); return; }
  t.classList.remove('hidden');
  $('#timer-bar').setAttribute('stroke-dashoffset', String(CIRC * (1 - left / total)));
  $('#timer-num').textContent = sec;
  t.classList.toggle('hurry', sec <= 5);
  if (changed && sec <= 5 && sec > 0 && state && !NO_TICK.has(state.phase)) (sec % 2 ? SFX.tick : SFX.tock)();
});

// ---------------------------------------------------------------------------
// Rendu principal
// ---------------------------------------------------------------------------
const PHASE_LABEL = { lobby: 'Salon d’attente', writing: 'Préparation', leaderboard: 'Classement', final: 'La Grande Finale' };

function roundLabel(s) {
  if (PHASE_LABEL[s.phase]) return PHASE_LABEL[s.phase];
  if (s.phase === 'roundIntro') return s.round.quick ? 'Partie rapide' : `Manche ${s.round.num}`;
  return s.game ? `${s.game.icon} ${s.game.title}` : '';
}

function render(s) {
  const prev = state;
  state = s;
  $('#code-pill').hidden = false;
  $('#code-txt').textContent = s.code;
  $('#round-label').textContent = roundLabel(s);
  $('#btn-skip').hidden = !s.canSkip || s.phase === 'lobby';
  $('#btn-end').hidden = ['lobby', 'final'].includes(s.phase);
  $('#btn-home').hidden = s.phase === 'lobby';
  $('#btn-tv').hidden = !s.tvPin;
  // Une télé affiche le plateau : le son sort de la télé, on le coupe sur l'ordinateur (et on le rétablit si elle se déconnecte).
  if (!TV_PIN && !SPECTATE && prev && !!s.tvCount !== !!prev.tvCount) {
    SFX.muted = !!s.tvCount; Voice.enabled = !s.tvCount;
    $('#btn-sound').setAttribute('aria-pressed', String(!SFX.muted));
    toast(s.tvCount ? '📺 Télé connectée ! Le son sort maintenant de la télé (coupé sur l’ordinateur).' : '📺 Télé déconnectée : le son revient sur l’ordinateur.', 5000);
  }
  $('#btn-pause').hidden = !s.canPause || !!s.paused;
  PauseOverlay.set(s.paused, SPECTATE || TV_PIN ? null : () => action('resume'));

  // Nouveaux arrivants : petit « pop » sonore.
  const ids = new Set(s.players.map((p) => p.id));
  if (prev && [...ids].some((id) => !knownPlayers.has(id))) SFX.pop();
  knownPlayers = ids;

  if (s.key !== viewKey) {
    viewKey = s.key;
    clearLater();
    const builder = VIEWS[s.phase] || VIEWS.lobby;
    const root = h('div', { class: 'view' });
    $('#view').replaceWith(root);
    root.id = 'view';
    view = builder(root, s) || {};
  }
  if (view.update) view.update(s, prev);
  countdown.set(s.timer ? s.remainingMs : 0, s.timer ? s.totalMs : 0);
  showLine(s.line);
}

// ---------------------------------------------------------------------------
// Vues
// ---------------------------------------------------------------------------
const VIEWS = {
  lobby(root, s) {
    const qr = h('div', { class: 'qr', 'aria-label': 'QR code pour rejoindre' });
    const url = h('div', { class: 'url' });
    const remoteTip = h('div', { class: 'remote-tip hidden' });
    const joinCard = h('div', { class: 'join-card panel' },
      h('div', { style: 'font-weight:800;font-size:1.3em', text: '📱 Scannez pour jouer !' }),
      qr,
      h('div', { style: 'color:var(--muted)', text: 'ou allez sur le site et tapez le code' }),
      h('div', { class: 'big-code', text: s.code }),
      url, remoteTip);

    const fillJoin = () => {
      if (!joinInfo) return;
      qr.innerHTML = joinInfo.svg; // SVG généré par notre propre serveur
      url.replaceChildren(h('b', { text: joinInfo.url.replace(/^https?:\/\//, '') }));
    };
    if (joinInfo && joinInfo.code === s.code) fillJoin();
    else {
      fetch(`/api/join-info?room=${encodeURIComponent(s.code)}`).then((r) => r.json()).then((j) => { joinInfo = { ...j, code: s.code }; fillJoin(); view.update(state); });
    }

    const castGrid = h('div', { class: 'cast-grid' });
    const castTitle = h('h3');
    const cast = h('div', { class: 'cast panel' }, castTitle, castGrid);
    const settings = h('div', { class: 'settings panel' });
    const startBtn = h('button', { class: 'btn gold big', onclick: () => action('start') }, 'Lever le rideau ! ✨');
    const hint = h('div', { class: 'hint' });
    const readyBox = h('div', { class: 'ready-box' });
    const autoBanner = h('div', { class: 'auto-banner hidden' });
    root.append(h('div', { class: 'lobby' }, joinCard, h('div', { class: 'lobby-right' }, cast, settings, autoBanner, h('div', { class: 'start-row' }, startBtn, h('div', { class: 'start-info' }, readyBox, hint)))));
    let autoTick = null;

    const chip = (label, on, onclick) => h('button', { class: `chip${on ? ' on' : ''}`, 'aria-pressed': String(on), onclick }, label);
    const send = (patch) => action('settings', { settings: { ...state.settings, ...patch } });

    return {
      update(st, prev) {
        castTitle.textContent = `⭐ Les stars de ce soir (${st.players.length}/12)`;
        if (!st.players.length) castGrid.replaceChildren(h('div', { class: 'empty-cast', text: 'En attente des premières stars… Scannez le QR code !' }));
        else {
          castGrid.replaceChildren(...st.players.map((p) => h('div', { class: 'cast-item' },
            avatarEl(p, p.connected ? '' : 'off'),
            st.ready.includes(p.id) ? h('span', { class: 'ready-badge pop', title: 'Prêt', text: '✅' }) : '',
            h('div', { class: 'name', text: p.name }),
            h('button', { class: 'kick', title: `Retirer ${p.name}`, 'aria-label': `Retirer ${p.name}`, onclick: () => { if (confirm(`Retirer ${p.name} du plateau ?`)) action('kick', { playerId: p.id }); } }, '✕'))));
        }

        const se = st.settings;
        const cat = st.catalog;
        const online = st.players.filter((p) => p.connected).length;
        const allGames = [...cat.quick, ...cat.tv, ...cat.board, ...cat.cards, ...cat.adult];
        const game = allGames.find((g) => g.id === se.game) || allGames[0];
        const usesQuiz = se.format === 'show' ? (se.rounds.quiz || se.rounds.duel) : se.game === 'quiz';
        const changeBtn = h('button', { class: 'btn ghost', onclick: () => openPicker(st) }, '🔄 Changer de jeu');

        // Grande carte « programme choisi », lisible de loin.
        const hero = se.format === 'show'
          ? h('div', { class: 'prog-hero' },
            h('span', { class: 'prog-ic', text: '🎬' }),
            h('div', { class: 'prog-txt' }, h('small', { text: 'Programme' }), h('b', { text: 'Le Grand Show' }),
              h('span', { text: 'Plusieurs manches, classements et podium final. Cochez les manches :' })),
            changeBtn)
          : h('div', { class: 'prog-hero' },
            h('span', { class: 'prog-ic', text: game.icon }),
            h('div', { class: 'prog-txt' }, h('small', { text: cat.tv.some((g) => g.id === game.id) ? '📺 Jeu télé' : cat.board.some((g) => g.id === game.id) ? 'Jeu de plateau' : cat.cards.some((g) => g.id === game.id) ? 'Jeu de cartes' : cat.adult.some((g) => g.id === game.id) ? '🔞 Jeu privé pour adultes' : 'Partie rapide' }), h('b', { text: game.title }),
              h('span', { text: game.rules }),
              h('em', { class: online < game.min ? 'warn' : '', text: `👥 ${game.players} · ⏱ ${game.duration}` })),
            changeBtn);

        // 🗳️ Vote des joueurs : on affiche le décompte en direct à la place du jeu choisi.
        const voteHero = se.vote ? h('div', { class: 'prog-hero vote-hero' },
          h('span', { class: 'prog-ic', text: '🗳️' }),
          h('div', { class: 'prog-txt' }, h('small', { text: 'Vote des joueurs' }),
            h('b', { text: st.tally.length ? `${st.tally[0].icon} ${st.tally[0].title} en tête !` : 'Votez sur vos téléphones !' }),
            h('span', { text: `${st.voters} / ${online} ont voté · le jeu le plus voté sera lancé (égalité : tirage au sort)` }),
            h('div', { class: 'tally' }, ...st.tally.slice(0, 6).map((t) => h('div', { class: 'tally-row' },
              h('span', { text: `${t.icon} ${t.title}` }), h('i', { style: `width:${Math.round((t.n / Math.max(1, st.voters)) * 100)}%` }), h('b', { text: String(t.n) })))),
            st.themeTally.length ? h('span', { class: 'theme-votes', text: `🧠 Thèmes demandés : ${st.themeTally.map((t) => `${t.icon} ${t.label} (${t.n})`).join(' · ')}` }) : '')) : null;
        settings.replaceChildren(
          voteHero || hero,
          se.format === 'show' && !se.vote
            ? h('div', { class: 'row' }, ...cat.show.map((r) => chip(`${r.icon} ${r.title}`, se.rounds[r.id], () => send({ rounds: { ...se.rounds, [r.id]: !se.rounds[r.id] } }))))
            : '',
          usesQuiz ? themePicker(st, chip, send) : '',
          se.format === 'quick' && cat.adult.some((g) => g.id === se.game) && !se.vote ? h('div', { class: 'row' }, h('span', { text: se.game === 'brulant' ? 'Jusqu’à' : 'Niveau' }),
            ...Object.entries(cat.coupleLevels).map(([k, l], i) => chip(se.game === 'brulant' ? ['🌶️ Sensuel', '🌶️🌶️ Coquin', '🌶️🌶️🌶️ Osé'][i] : `${l.icon} ${l.label}`, se.coupleLevel === k, () => send({ coupleLevel: k })))) : '',
          h('div', { class: 'row' }, h('span', { text: 'Durée' }),
            chip('Courte', se.length === 'short', () => send({ length: 'short' })),
            chip('Normale', se.length === 'normal', () => send({ length: 'normal' })),
            chip('Longue', se.length === 'long', () => send({ length: 'long' }))),
          h('div', { class: 'row' }, h('span', { text: 'Choix du jeu' }),
            chip('🗳️ Vote des joueurs', se.vote, () => send({ vote: true })),
            chip('🎛️ Je choisis', !se.vote, () => send({ vote: false }))),
          se.format === 'quick' && cat.adult.some((g) => g.id === se.game) && !se.vote ? h('div', { class: 'row' }, h('span', { text: 'Photos' }), h('small', { text: '🔒 Aucune photo ni historique pour ce jeu privé' }))
            : h('div', { class: 'row' }, h('span', { text: 'Photos' }),
              chip('📸 Autorisées', se.photos, () => send({ photos: true })),
              chip('🚫 Désactivées', !se.photos, () => send({ photos: false }))),
          h('div', { class: 'row' }, h('span', { text: 'Chat' }),
            chip('💬 Activé', se.chat, () => send({ chat: true })),
            chip('🔇 Désactivé', !se.chat, () => send({ chat: false }))),
        );

        const needed = se.format === 'quick' ? game.min : 1;
        startBtn.disabled = online < 1;
        hint.textContent = online < 1 ? 'Il faut au moins une star pour commencer.'
          : online < needed ? `Ce jeu se joue à ${needed} minimum : attendez encore ${needed - online} star(s).`
            : online < 3 ? 'Astuce : c’est plus drôle à partir de 3 joueurs !' : 'Tout le monde est là ? C’est parti !';
        if (online < needed) startBtn.disabled = true;

        // « Je suis prêt » : compteur, relance des retardataires, compte à rebours automatique.
        const readyIds = new Set(st.ready);
        const readyOnline = st.players.filter((p) => p.connected && readyIds.has(p.id)).length;
        if (prev && prev.ready && st.ready.length > prev.ready.length) SFX.blip();
        readyBox.replaceChildren(
          online ? h('b', { class: readyOnline === online ? 'all' : '', text: `✅ ${readyOnline}/${online} prêt${readyOnline > 1 ? 's' : ''}` }) : '',
          online && readyOnline < online && !st.autoStart ? h('button', { class: 'chip', onclick: () => action('nudge') }, '📣 Qui est prêt ?') : '');
        autoBanner.classList.toggle('hidden', !st.autoStart);
        clearInterval(autoTick);
        if (st.autoStart) {
          const end = Date.now() + st.remainingMs;
          const paint = () => {
            const sec = Math.max(0, Math.ceil((end - Date.now()) / 1000));
            autoBanner.replaceChildren(h('span', { text: '🚀 Tout le monde est prêt ! Le show commence dans' }), h('b', { class: 'pop', text: String(sec) }),
              h('button', { class: 'chip', onclick: () => action('cancelStart') }, '✋ Attendre'));
          };
          paint();
          autoTick = setInterval(paint, 250);
        }
        if (st.settings.mode === 'remote') {
          remoteTip.classList.remove('hidden');
          const local = joinInfo && /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(joinInfo.base || '');
          remoteTip.replaceChildren(
            h('div', { text: local
              ? 'ℹ️ Ce lien marche sur votre Wi-Fi. Pour inviter des amis éloignés, hébergez le jeu en ligne (voir le guide).'
              : '🌍 Des invités à distance ? Envoyez-leur ce lien : l’écran du jeu s’affiche aussi sur leur téléphone.' }),
            joinInfo ? h('button', { class: 'chip', style: 'margin-top:0.5em', onclick: () => navigator.clipboard?.writeText(joinInfo.url).then(() => toast('Lien copié !')) }, '📋 Copier le lien') : '');
        } else remoteTip.classList.add('hidden');
      },
    };
  },

  writing(root) {
    SFX.whoosh();
    const grid = h('div', { class: 'cast-grid', style: 'justify-content:center' });
    root.append(h('div', { class: 'round-intro', style: 'justify-content:flex-start;padding-top:1em' },
      h('div', { class: 'icon', style: 'font-size:4em', text: '✍️' }),
      h('h1', { style: 'font-size:2.8em', text: 'Écriture secrète' }),
      h('p', { text: 'Sur vos téléphones, répondez à 2 petites questions. C’est anonyme… jusqu’à la manche « Qui a osé dire ça ? » 😈' }),
      grid));
    return {
      update(st, prev) {
        const done = new Set(st.done);
        if (prev && prev.done && st.done.length > prev.done.length) SFX.blip();
        grid.replaceChildren(...st.players.map((p) => h('div', { class: 'cast-item' },
          avatarEl(p, done.has(p.id) ? '' : 'off'),
          h('div', { class: 'name', text: p.name }),
          h('div', { style: `font-size:0.85em;font-weight:700;color:${done.has(p.id) ? 'var(--green)' : 'var(--muted)'}`, text: done.has(p.id) ? '✓ Prêt' : '✏️ écrit…' }))));
      },
    };
  },

  roundIntro(root, s) {
    SFX.whoosh();
    if (s.round.cancelled) later(400, SFX.wrong); else later(400, SFX.fanfare);
    root.append(h('div', { class: `round-intro${s.round.cancelled ? ' cancelled' : ''}` },
      h('div', { class: 'num', text: s.round.quick ? 'PARTIE RAPIDE' : `MANCHE ${s.round.num}` }),
      h('div', { class: 'icon', text: s.round.icon }),
      h('h1', { text: s.round.title }),
      h('p', { text: s.round.subtitle })));
  },

  quizQuestion(root, s) {
    SFX.whoosh();
    const cat = s.categories[s.q.cat];
    const strip = h('div', { class: 'answered-strip' });
    root.append(
      h('div', { class: 'q-head' }, h('span', { class: 'chip', text: `${cat.icon} ${cat.label}` }), h('span', { class: 'count', text: `Question ${s.q.index} / ${s.q.total}` })),
      h('div', { class: 'q-text', text: s.q.text }),
      h('div', { class: 'answers' }, ...s.q.choices.map((c, i) => h('div', { class: `answer c${i}` }, h('span', { class: 'shape', text: SHAPES[i] }), h('span', { text: c })))),
      strip);
    return {
      update(st, prev) {
        const done = new Set(st.answered);
        if (prev && prev.answered && st.answered.length > prev.answered.length) SFX.blip();
        const online = st.players.filter((p) => p.connected);
        strip.replaceChildren(h('span', { class: 'label', text: `${done.size} / ${online.length} ont répondu` }),
          ...online.map((p) => { const a = avatarEl(p, 'sm'); if (!done.has(p.id)) a.classList.add('wait'); return a; }));
      },
    };
  },

  quizReveal(root, s) {
    const cat = s.categories[s.q.cat];
    const total = Math.max(1, s.counts.reduce((a, b) => a + b, 0));
    const tiles = s.q.choices.map((c, i) => {
      const bar = h('div', { class: 'count-bar', style: 'width:0%' });
      later(300, () => { bar.style.width = `${(s.counts[i] / total) * 100}%`; });
      return h('div', { class: `answer c${i}${i === s.correct ? ' good' : ' dim'}`, style: 'animation:none' },
        h('span', { class: 'shape', text: i === s.correct ? '✓' : SHAPES[i] }), h('span', { text: c }), h('span', { class: 'n', text: `${s.counts[i]} 👤` }), bar);
    });
    const byId = new Map(s.players.map((p) => [p.id, p]));
    const results = [...s.results].filter((r) => byId.has(r.id)).sort((a, b) => b.gained - a.gained);
    root.append(
      h('div', { class: 'q-head' }, h('span', { class: 'chip', text: `${cat.icon} ${cat.label}` }), h('span', { class: 'count', text: `Question ${s.q.index} / ${s.q.total}` })),
      h('div', { class: 'q-text', style: 'animation:none', text: s.q.text }),
      h('div', { class: 'answers' }, ...tiles),
      h('div', { class: 'gains' }, ...results.map((r, k) => {
        const g = h('div', { class: `gain ${r.correct ? 'ok' : 'ko'}` }, avatarEl(byId.get(r.id), 'sm'),
          h('span', { text: byId.get(r.id).name }),
          h('b', { text: r.correct ? `+${fmt(r.gained)}` : (r.choice == null ? '⏱️' : '✗') }),
          r.correct && r.streak >= 2 ? h('small', { text: `🔥×${r.streak}` }) : null);
        g.style.animationDelay = `${0.6 + k * 0.08}s`;
        return g;
      })));
    SFX.reveal();
    later(350, () => (results.some((r) => r.correct) ? SFX.correct() : SFX.wrong()));
  },

  leaderboard(root, s) {
    SFX.whoosh();
    const board = h('div', { class: 'board' });
    root.append(h('div', { class: 'board-title', text: s.title }), board);
    const rows = s.ranking;
    const prevOrder = [...rows].sort((a, b) => a.prevRank - b.prevRank);
    requestAnimationFrame(() => {
      const step = Math.min(board.clientHeight / Math.max(rows.length, 1), 72);
      board.style.height = `${step * rows.length}px`;
      const els = new Map();
      prevOrder.forEach((r, i) => {
        const sc = h('span', { class: 'sc', text: fmt(r.prevScore) });
        const pos = h('span', { class: 'pos', text: String(r.prevRank) });
        const move = h('span', { class: 'move' });
        const row = h('div', { class: 'board-row', style: `top:${i * step}px;height:${step - 8}px` }, pos, avatarEl(r, 'sm'), h('span', { class: 'nm', text: r.name }), move, sc);
        if (step < 50) row.style.fontSize = '0.9em';
        board.append(row);
        els.set(r.id, { row, sc, pos, move });
      });
      later(900, () => {
        SFX.drumroll(0.9);
        rows.forEach((r, i) => {
          const e = els.get(r.id);
          e.row.style.top = `${i * step}px`;
          e.pos.textContent = String(r.rank);
          if (r.rank === 1) e.row.classList.add('first');
          if (r.rank < r.prevRank) { e.move.textContent = '▲'; e.move.className = 'move up'; }
          else if (r.rank > r.prevRank) { e.move.textContent = '▼'; e.move.className = 'move down'; }
          countUp(e.sc, r.prevScore, r.score, 1100);
        });
      });
    });
  },

  whoVote(root, s) {
    SFX.whoosh();
    const strip = h('div', { class: 'answered-strip', style: 'justify-content:center' });
    root.append(
      h('div', { class: 'q-head' }, h('span', { class: 'chip', text: '🤫 Qui a osé dire ça ?' }), h('span', { class: 'count', text: `Réponse ${s.who.index} / ${s.who.total}` })),
      h('div', { class: 'quote-card panel' }, h('div', { class: 'prompt', text: s.who.prompt }), h('div', { class: 'quote', text: s.who.text })),
      h('p', { style: 'text-align:center;font-size:1.3em;font-weight:700;margin:1em 0 0', text: '📱 Votez sur votre téléphone : qui a écrit ça ?' }),
      strip);
    return {
      update(st, prev) {
        const done = new Set(st.voted);
        if (prev && prev.voted && st.voted.length > prev.voted.length) SFX.blip();
        const voters = st.players.filter((p) => st.voters.includes(p.id));
        strip.replaceChildren(h('span', { class: 'label', text: `${done.size} / ${voters.length} ont voté` }),
          ...voters.map((p) => { const a = avatarEl(p, 'sm'); if (!done.has(p.id)) a.classList.add('wait'); return a; }));
      },
    };
  },

  whoReveal(root, s) {
    const byId = new Map(s.players.map((p) => [p.id, p]));
    const author = byId.get(s.authorId);
    SFX.drumroll(1.5);
    later(1600, () => SFX.reveal());
    later(1900, () => (s.fooled > 0 && s.found === 0 ? SFX.applause(2) : SFX.correct()));
    root.append(
      h('div', { class: 'q-head' }, h('span', { class: 'chip', text: '🤫 Qui a osé dire ça ?' }), h('span', { class: 'count', text: `Réponse ${s.who.index} / ${s.who.total}` })),
      h('div', { class: 'quote-card panel', style: 'animation:none' }, h('div', { class: 'prompt', text: s.who.prompt }), h('div', { class: 'quote', text: s.who.text })),
      author ? h('div', { class: 'reveal-author' },
        avatarEl(author, 'lg'),
        h('div', { class: 'who-name', text: `C'était ${author.name} !` }),
        s.authorGain ? h('div', { class: 'bluff', text: `+${fmt(s.authorGain)} pour le bluff 😏` }) : null) : '',
      h('div', { class: 'votes-list' }, ...s.results.filter((r) => byId.has(r.id) && byId.has(r.target)).map((r, k) => {
        const pill = h('div', { class: `vote-pill ${r.correct ? 'ok' : 'ko'}` },
          avatarEl(byId.get(r.id), 'sm'), h('span', { text: `${byId.get(r.id).name} → ${byId.get(r.target).name}` }),
          h('span', { text: r.correct ? ' ✓ +500' : ' ✗' }));
        pill.style.animationDelay = `${2.4 + k * 0.1}s`;
        return pill;
      })));
  },

  final(root, s) {
    const r = s.ranking;
    const cd = h('div', { class: 'countdown' });
    const step = (p, cls) => {
      if (!p) return h('div', { class: `step ${cls}` });
      return h('div', { class: `step ${cls}` },
        h('div', { class: 'who' }, cls === 'p1' ? h('div', { class: 'crown', text: '👑' }) : null, avatarEl(p, cls === 'p1' ? '' : 'lg'),
          h('div', { class: 'nm', text: p.name }), h('div', { class: 'sc', text: `${fmt(p.score)} pts` })),
        h('div', { class: 'block', text: String(p.rank) }));
    };
    const s1 = step(r[0], 'p1'); const s2 = step(r[1], 'p2'); const s3 = step(r[2], 'p3');
    const rest = h('div', { class: 'final-rest' }, ...r.slice(3).map((p) => h('div', { class: 'gain' }, avatarEl(p, 'sm'), h('span', { text: `${p.rank}. ${p.name}` }), h('b', { style: 'color:var(--gold)', text: fmt(p.score) }))));
    const note = h('p', { class: 'final-note', text: '📚 Les joueurs connectés retrouvent cette soirée, ses souvenirs et ses photos dans « Mon compte ».' });
    const actions = h('div', { class: 'final-actions' },
      h('button', { class: 'btn gold big', onclick: () => action('restart') }, 'Rejouer avec la même équipe 🔁'),
      h('a', { class: 'btn ghost big', href: '/' }, 'Accueil'));
    root.append(h('div', { class: 'final' }, cd, h('div', { class: 'podium' }, s2, s1, s3), rest, actions, note));

    SFX.drumroll(3);
    [3, 2, 1].forEach((n, i) => later(i * 1000, () => { cd.replaceChildren(h('span', { text: String(n) })); SFX.beep(false); }));
    later(3000, () => cd.replaceChildren());
    later(3300, () => { if (r[2]) { s3.classList.add('show'); SFX.pop(); } });
    later(4800, () => { if (r[1]) { s2.classList.add('show'); SFX.pop(); } });
    later(6600, () => { s1.classList.add('show'); SFX.fanfare(); SFX.applause(4); confetti(6000); });
    later(8500, () => { rest.classList.add('show'); actions.classList.add('show'); });
  },
};

/** Thèmes du quiz, rangés par famille ; le thème adulte demande confirmation ; choix des clubs de L1. */
function themePicker(st, chip, send) {
  const se = st.settings;
  const groups = {};
  Object.entries(st.categories).forEach(([k, c]) => { (groups[c.group] = groups[c.group] || []).push([k, c]); });
  const toggle = (k, c) => {
    const on = se.categories.includes(k);
    if (!on && c.adult && !confirm('🔞 Thème réservé aux adultes : questions coquines sur l’amour et la séduction (jamais vulgaires).\nTous les joueurs sont-ils majeurs et d’accord ?')) return;
    const cats = on ? se.categories.filter((x) => x !== k) : [...se.categories, k];
    if (cats.length) send({ categories: cats });
  };
  const box = h('div', { class: 'theme-box' },
    h('div', { class: 'theme-head' }, h('b', { text: '🧠 Thèmes du quiz' }), h('small', { text: `${se.categories.length} choisi${se.categories.length > 1 ? 's' : ''}` })),
    ...Object.entries(groups).map(([g, list]) => h('div', { class: 'row' }, h('span', { text: g }),
      ...list.map(([k, c]) => {
        const el = chip(`${c.icon} ${c.label}${c.adult ? ' 🔞' : ''}`, se.categories.includes(k), () => toggle(k, c));
        if (c.adult) el.classList.add('adult');
        return el;
      }))));
  if (se.categories.includes('clubs')) {
    const clubs = se.clubs || [];
    box.append(h('div', { class: 'row clubs-row' }, h('span', { text: 'Vos clubs' }),
      chip('Tous', clubs.length === 0, () => send({ clubs: [] })),
      ...Object.entries(st.clubs).map(([k, c]) => chip(`${c.icon} ${c.label}`, clubs.includes(k), () => {
        send({ clubs: clubs.includes(k) ? clubs.filter((x) => x !== k) : [...clubs, k] });
      }))));
  }
  return box;
}
/** Grand sélecteur de jeux en plein écran (salon). */
function openPicker(st) {
  const cat = st.catalog;
  const close = () => overlay.remove();
  const pickIt = (patch) => { action('settings', { settings: { ...state.settings, ...patch } }); SFX.pop(); close(); };
  const ADULT_OK = '🔞 Jeu privé réservé aux adultes consentants (2 joueurs). Rien n’est enregistré. Continuer ?';
  const tile = (g, adult) => h('button', { class: `tile${adult ? ' adult-tile' : ''}${st.settings.format === 'quick' && st.settings.game === g.id ? ' on' : ''}`,
    onclick: () => { if (!adult || confirm(ADULT_OK)) pickIt({ format: 'quick', game: g.id }); } },
    h('span', { class: 'tile-ic', text: g.icon }), h('b', { text: g.title }), h('span', { class: 'tile-pitch', text: g.pitch }),
    h('small', { class: 'tile-meta', text: `👥 ${g.players} · ⏱ ${g.duration}` }));
  const overlay = h('div', { class: 'picker-overlay', onclick: (e) => { if (e.target === overlay) close(); } },
    h('div', { class: 'picker' },
      h('div', { class: 'picker-head' }, h('h2', { text: 'Choisissez votre jeu' }), h('button', { class: 'tool', 'aria-label': 'Fermer', onclick: close }, '✕')),
      h('button', { class: `show-card${st.settings.format === 'show' ? ' on' : ''}`, onclick: () => pickIt({ format: 'show' }) },
        h('span', { class: 'show-ic', text: '🎬' }),
        h('span', { class: 'show-txt' }, h('b', { text: 'Le Grand Show' }), h('span', { text: 'Plusieurs manches et un podium final.' }))),
      h('h3', { class: 'family', text: '⚡ Parties rapides' }), h('div', { class: 'tile-grid' }, ...cat.quick.map((g) => tile(g))),
      h('h3', { class: 'family', text: '📺 Jeux télé' }), h('div', { class: 'tile-grid' }, ...cat.tv.map((g) => tile(g))),
      h('h3', { class: 'family', text: '🎲 Jeux de plateau' }), h('div', { class: 'tile-grid' }, ...cat.board.map((g) => tile(g))),
      h('h3', { class: 'family', text: '🃏 Jeux de cartes' }), h('div', { class: 'tile-grid' }, ...cat.cards.map((g) => tile(g))),
      h('h3', { class: 'family', text: '🔞 Pour adultes' }), h('div', { class: 'tile-grid' }, ...cat.adult.map((g) => tile(g, true)))));
  document.body.append(overlay);
}
function countUp(el, from, to, ms) {
  const t0 = performance.now();
  (function f(now) {
    const k = Math.min(1, (now - t0) / ms);
    el.textContent = fmt(Math.round(from + (to - from) * (1 - (1 - k) ** 3)));
    if (k < 1) requestAnimationFrame(f);
  }(t0));
}
// 💬 Chat des joueurs à distance : les messages s'affichent quelques secondes en bulles sur l'écran principal.
socket.on('chat', (m) => {
  if (SPECTATE || !state || state.settings.mode !== 'remote' || !state.settings.chat) return; // le téléphone a déjà son propre chat
  let stack = $('.chat-stack');
  if (!stack) { stack = h('div', { class: 'chat-stack', 'aria-live': 'polite' }); document.body.append(stack); }
  const bubble = h('div', { class: 'chat-toast' }, avatarEl(m.who, 'sm'), h('span', {}, h('b', { text: m.who.name }), ` ${m.text}`));
  stack.append(bubble);
  while (stack.children.length > 4) stack.firstChild.remove();
  SFX.blip();
  setTimeout(() => { bubble.classList.add('out'); setTimeout(() => bubble.remove(), 500); }, 8000);
});
// Téléphone du joueur : buzzer et manette. Interface volontairement très simple.
/* global io, $, h, avatarEl, SHAPES, AVATARS, SFX, keepAwake, makeCountdown, toast, fmt */

const socket = io({ transports: ['websocket', 'polling'] });
const STORE = 'showtime-player';
const PREFS = 'showtime-prefs';
const params = new URLSearchParams(location.search);
let code = (params.get('room') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
let state = null;
let viewKey = null;
let view = null;
let localAnswer = null; // réponse tapée, affichée avant même la confirmation du serveur
let localChoice = null;
let localVote = null;
let joining = false;

const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* navigation privée */ } };
const buzz = (p) => { try { navigator.vibrate?.(p); } catch { /* */ } };
document.addEventListener('pointerdown', () => SFX.unlock(), { once: true });

// ---------------------------------------------------------------------------
// Connexion, reprise automatique après coupure (Wi-Fi, écran verrouillé…)
// ---------------------------------------------------------------------------
socket.on('connect', () => {
  $('.offline-banner')?.remove();
  const ident = read(STORE);
  if (ident && ident.code === code && ident.playerId) {
    socket.emit('player:resume', ident, (res) => {
      if (res.error) { localStorage.removeItem(STORE); showJoin(); }
    });
  } else if (!state) {
    showJoin();
  }
});
socket.on('disconnect', () => {
  if (!$('.offline-banner')) document.body.append(h('div', { class: 'offline-banner', text: 'Connexion perdue… on te reconnecte' }));
});
socket.on('kicked', () => {
  localStorage.removeItem(STORE);
  state = null; viewKey = null;
  $('#me-bar').classList.add('hidden');
  setView(h('main', { class: 'pview center' },
    h('div', { class: 'big-emoji', text: '👋' }), h('h1', { text: 'Tu as quitté le plateau' }),
    h('button', { class: 'btn big', onclick: () => showJoin() }, 'Revenir dans la partie')));
});
socket.on('state', (s) => { render(s); cameraButton(s); miniScreen(s); });

// ---------------------------------------------------------------------------
// 📺 Écran partagé : le plateau télé en direct en haut du téléphone (activé d'office à distance).
// ---------------------------------------------------------------------------
let screenPref = null;
try { screenPref = localStorage.getItem('showtime-screen'); } catch { /* */ }
function miniScreen(s) {
  const want = screenPref ? screenPref === 'on' : s.mode === 'remote';
  const setPref = (v) => { screenPref = v; try { localStorage.setItem('showtime-screen', v); } catch { /* */ } miniScreen(state); };
  let wrap = $('#mini-wrap');
  let show = $('#screen-show');
  if (want && !wrap) {
    wrap = h('div', { id: 'mini-wrap', class: 'mini-wrap' },
      h('iframe', { src: `/host?room=${encodeURIComponent(s.code)}&spectate=1`, title: 'Écran du jeu en direct', allow: 'autoplay' }),
      h('div', { class: 'mini-tools' },
        h('button', { onclick: () => { wrap.classList.toggle('big'); document.body.classList.toggle('split-big'); } }, '⤢ Agrandir'),
        h('button', { onclick: () => setPref('off') }, '✕ Masquer')));
    document.body.prepend(wrap);
    document.body.classList.add('split');
  } else if (!want && wrap) {
    wrap.remove();
    document.body.classList.remove('split', 'split-big');
  }
  if (!want && !show) {
    show = h('button', { id: 'screen-show', class: 'screen-toggle', onclick: () => setPref('on') }, '📺 Voir l’écran');
    document.body.append(show);
  } else if (want && show) show.remove();
}

// ---------------------------------------------------------------------------
// 📸 Photos souvenirs : prises avec l'appareil du téléphone, réduites avant envoi.
// ---------------------------------------------------------------------------
let camInput = null;
function cameraButton(s) {
  let btn = $('#cam-btn');
  if (!s.photos) { btn?.remove(); return; }
  if (btn) return;
  camInput = h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'hidden' });
  camInput.addEventListener('change', () => { if (camInput.files[0]) uploadPhoto(camInput.files[0]); camInput.value = ''; });
  btn = h('button', { id: 'cam-btn', class: 'cam-btn', 'aria-label': 'Prendre une photo souvenir', onclick: () => {
    let agreed = false;
    try { agreed = localStorage.getItem('showtime-photo-ok') === '1'; } catch { /* */ }
    if (!agreed) {
      if (!confirm('📸 Photo souvenir\n\nElle s’affichera sur l’écran et sera gardée dans l’historique des joueurs de la soirée.\nDemande toujours l’accord des personnes photographiées !\n\nContinuer ?')) return;
      try { localStorage.setItem('showtime-photo-ok', '1'); } catch { /* */ }
    }
    camInput.click();
  } }, '📸');
  document.body.append(btn, camInput);
}

/** Réduit l'image (1280 px max, JPEG) pour qu'elle soit légère, puis l'envoie au serveur. */
async function uploadPhoto(file) {
  const ident = read(STORE);
  if (!ident) return;
  toast('📸 Envoi de la photo…');
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
    const img = bitmap || await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = URL.createObjectURL(file); });
    const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
    const canvas = h('canvas');
    canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', 0.8));
    const res = await fetch('/api/photos', { method: 'POST', body: blob, headers: { 'content-type': 'image/jpeg', 'x-showtime': '1', 'x-room': ident.code, 'x-player-id': ident.playerId, 'x-player-token': ident.token } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Envoi impossible');
    SFX.pop(); buzz(60);
    toast('✅ Photo envoyée sur l’écran !');
  } catch (e) { toast(`❌ ${e.message}`, 4000); }
}
// L'hôte relance les retardataires : vibration, son et bouton qui clignote.
socket.on('nudge', () => {
  buzz([200, 100, 200, 100, 400]);
  SFX.beep(true);
  const b = $('.ready-btn');
  if (b) { b.classList.remove('nudged'); void b.offsetWidth; b.classList.add('nudged'); }
});

function setView(el) {
  el.id = 'pview';
  $('#pview').replaceWith(el);
}

// ---------------------------------------------------------------------------
// Formulaire pour rejoindre
// ---------------------------------------------------------------------------
function showJoin(errorMsg) {
  viewKey = 'join';
  const prefs = read(PREFS) || {};
  let avatar = prefs.avatar && AVATARS.includes(prefs.avatar) ? prefs.avatar : AVATARS[Math.floor(Math.random() * AVATARS.length)];
  const err = h('div', { class: `error${errorMsg ? '' : ' hidden'}`, role: 'alert', text: errorMsg || '' });
  const codeInput = h('input', { type: 'text', id: 'f-code', class: 'code-input', maxlength: '4', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'ABCD', value: code });
  codeInput.addEventListener('input', () => { codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z]/g, ''); });
  const nameInput = h('input', { type: 'text', id: 'f-name', maxlength: '16', autocomplete: 'given-name', enterkeyhint: 'go', placeholder: 'Ton prénom', value: prefs.name || '' });
  const grid = h('div', { class: 'avatars-grid', role: 'radiogroup', 'aria-label': 'Choisis ton avatar' }, ...AVATARS.map((a) => h('button', {
    type: 'button', class: 'avatar-pick', 'aria-pressed': String(a === avatar), 'aria-label': `Avatar ${a}`, text: a,
    onclick: (e) => { avatar = a; SFX.tap(); grid.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); },
  })));
  const submit = h('button', { class: 'btn gold big', type: 'submit' }, 'Entrer sur le plateau ✨');
  const accountBox = h('div', { class: 'account-box' });
  const form = h('form', { class: 'pview', novalidate: true },
    h('div', { style: 'text-align:center' }, h('div', { class: 'logo', style: 'font-size:2.6rem', text: 'SHOWTIME' }), h('p', { text: 'Ce soir, c’est toi la star !' })),
    h('div', { class: `field${code.length === 4 ? ' hidden' : ''}` }, h('label', { for: 'f-code', text: 'Code du salon (affiché à l’écran)' }), codeInput),
    h('div', { class: 'field' }, h('label', { for: 'f-name', text: 'Ton prénom de star' }), nameInput),
    h('div', { class: 'field' }, h('label', { text: 'Ton avatar' }), grid),
    err, submit, accountBox);
  // Compte facultatif : si la personne est connectée, sa soirée ira dans son historique.
  fetch('/api/auth/me').then((r) => r.json()).then(({ user }) => {
    if (user) {
      accountBox.replaceChildren(h('span', { text: `✅ Connecté·e : ${user.avatar} ${user.name} — cette soirée ira dans ton historique.` }));
      if (!nameInput.value) nameInput.value = user.name;
    } else {
      accountBox.replaceChildren(h('a', { href: `/compte?mode=register&next=${encodeURIComponent(`/play?room=${code || codeInput.value}`)}`, text: '👤 Créer un compte (facultatif) pour garder l’historique et les photos' }));
    }
  }).catch(() => {});
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (joining) return;
    SFX.unlock();
    const name = nameInput.value.trim();
    const c = codeInput.value.trim();
    if (c.length !== 4) { err.textContent = 'Le code fait 4 lettres.'; err.classList.remove('hidden'); return; }
    if (!name) { err.textContent = 'Il nous faut ton prénom !'; err.classList.remove('hidden'); nameInput.focus(); return; }
    joining = true; submit.disabled = true;
    socket.emit('player:join', { code: c, name, avatar }, (res) => {
      joining = false; submit.disabled = false;
      if (res.error) { err.textContent = res.error; err.classList.remove('hidden'); buzz(200); return; }
      code = res.code;
      write(STORE, { code: res.code, playerId: res.playerId, token: res.token });
      write(PREFS, { name, avatar });
      if (params.get('room') !== res.code) history.replaceState(null, '', `/play?room=${res.code}`);
      SFX.pop(); buzz(60); keepAwake();
    });
  });
  setView(form);
  if (!nameInput.value) setTimeout(() => (code.length === 4 ? nameInput : codeInput).focus(), 100);
}

// ---------------------------------------------------------------------------
// Rendu
// ---------------------------------------------------------------------------
const timer = makeCountdown((left, total) => {
  const bar = $('#ptimer');
  if (bar) bar.style.transform = `scaleX(${total ? left / total : 0})`;
});

/** Clé de la vue : fournie par le serveur, complétée par les réponses tapées mais pas encore confirmées. */
function keyOf(s) {
  if (s.phase === 'quizQuestion' && localAnswer === s.q.index) return `quizQuestion:${s.q.index}:true`;
  if (s.phase === 'whoVote' && localVote === s.who.index) return `whoVote:${s.who.index}:true`;
  return s.key;
}

/** Envoie une action de jeu au serveur. */
const act = (msg) => socket.emit('player:act', msg);
function render(s) {
  state = s;
  $('#me-bar').classList.remove('hidden');
  $('#me-bar').replaceChildren(avatarEl(s.me, 'sm'), h('div', { class: 'nm', text: s.me.name }), h('div', { class: 'score', text: `${fmt(s.me.score)} pts` }));
  const rl = $('#remote-line');
  if (s.line && s.line.text) { rl.textContent = `🎙️ ${s.line.text}`; rl.classList.remove('hidden'); } else rl.classList.add('hidden');

  const key = keyOf(s);
  if (key !== viewKey) {
    viewKey = key;
    const root = h('main', { class: 'pview' });
    view = (PVIEWS[s.phase] || PVIEWS.lobby)(root, s) || {};
    setView(root);
  }
  if (view.update) view.update(s);
  timer.set(s.timer ? s.remainingMs : 0, s.timer ? s.totalMs : 0);
}

const timerBar = () => h('div', { class: 'p-timer' }, h('i', { id: 'ptimer' }));
const center = (root) => { root.classList.add('center'); return root; };

const PVIEWS = {
  lobby(root, s) {
    center(root);
    const faces = h('div', { class: 'lobby-faces' });
    const count = h('p', { class: 'ready-count' });
    const nudge = h('div', { class: 'nudge-msg hidden', text: '👀 Les autres sont prêts… et toi ?' });
    const auto = h('div', { class: 'auto-phone hidden' });
    const btn = h('button', { class: 'ready-btn', onclick: () => { const on = !state.ready; act({ type: 'ready', on }); SFX.tap(); buzz(on ? [60, 40, 60] : 40); paintBtn(on); } });
    function paintBtn(on) {
      btn.classList.toggle('on', on);
      btn.replaceChildren(h('span', { text: on ? '✅' : '✋' }), h('b', { text: on ? 'Prêt·e !' : 'Je suis prêt·e !' }), h('small', { text: on ? 'Touche pour annuler' : 'Touche quand tu es prêt·e' }));
    }
    const voteBox = h('div', { class: 'vote-box' });
    root.append(avatarEl(s.me, 'lg'), h('h1', { text: `Bienvenue, ${s.me.name} !` }), btn, nudge, count, auto, voteBox, faces,
      h('button', { class: 'leave', onclick: () => { if (confirm('Quitter la partie ?')) { socket.emit('player:leave'); localStorage.removeItem(STORE); } } }, 'Quitter la partie'));
    let autoTick = null;
    return {
      update(st) {
        paintBtn(st.ready);
        count.textContent = st.total ? `${st.readyCount}/${st.total} joueur${st.total > 1 ? 's' : ''} prêt${st.readyCount > 1 ? 's' : ''}` : '';
        nudge.classList.toggle('hidden', !st.othersWaiting || st.autoStart);
        faces.replaceChildren(...st.players.map((p) => { const a = avatarEl(p, 'sm'); if (!p.ready) a.classList.add('wait'); return a; }));
        // 🗳️ Vote pour le jeu : chacun choisit, le plus voté est lancé.
        if (!st.vote) voteBox.replaceChildren();
        else {
          const counts = new Map(st.vote.tally.map((t) => [t.id, t.n]));
          voteBox.replaceChildren(h('h2', { text: st.vote.mine ? '🗳️ Ton vote (tu peux changer)' : '🗳️ Vote pour le jeu !' }),
            h('div', { class: 'vote-grid' }, ...st.vote.options.map((o) => {
              const ok = st.vote.online >= o.min;
              return h('button', {
                class: `vote-opt${st.vote.mine === o.id ? ' on' : ''}`, disabled: !ok, title: ok ? o.title : `${o.min} joueurs minimum`,
                onclick: () => { act({ type: 'voteGame', game: o.id }); SFX.tap(); buzz(30); },
              }, h('span', { text: o.icon }), h('b', { text: o.title }), counts.get(o.id) ? h('em', { text: `${counts.get(o.id)} 🗳️` }) : '');
            })));
          // Le quiz (ou le Grand Show) a ma voix : je coche aussi mes thèmes préférés (5 max).
          if (st.vote.mine === 'quiz' || st.vote.mine === 'show') {
            const mineT = new Set(st.vote.myThemes);
            const tcount = new Map(st.vote.themeTally.map((t) => [t.id, t.n]));
            voteBox.append(h('h2', { text: `🧠 Tes thèmes de quiz (${mineT.size}/5)` }),
              h('div', { class: 'theme-chips' }, ...st.vote.themes.map((t) => h('button', {
                class: `chip${mineT.has(t.id) ? ' on' : ''}`,
                onclick: () => {
                  if (mineT.has(t.id)) mineT.delete(t.id); else if (mineT.size < 5) mineT.add(t.id); else { toast('5 thèmes maximum'); return; }
                  act({ type: 'voteThemes', themes: [...mineT] }); SFX.tap();
                },
              }, `${t.icon} ${t.label}${tcount.get(t.id) ? ` · ${tcount.get(t.id)}` : ''}`))));
          }
        }
        auto.classList.toggle('hidden', !st.autoStart);
        clearInterval(autoTick);
        if (st.autoStart) {
          const end = Date.now() + st.remainingMs;
          const paint = () => { auto.textContent = `🚀 Ça commence dans ${Math.max(0, Math.ceil((end - Date.now()) / 1000))} s !`; };
          paint();
          autoTick = setInterval(paint, 250);
        }
      },
    };
  },
  writing(root, s) {
    if (s.submitted) {
      center(root).append(h('div', { class: 'big-emoji', text: '🤫' }), h('h1', { text: 'Top secret !' }),
        h('p', { text: 'Tes réponses sont enregistrées. On attend les autres stars…' }), timerBar());
      return null;
    }
    const fields = s.prompts.map((pr, i) => {
      const ta = h('textarea', { id: `w${i}`, maxlength: '80', rows: '2', placeholder: 'Ta réponse la plus drôle…' });
      const cnt = h('div', { class: 'cnt', text: '0/80' });
      ta.addEventListener('input', () => { cnt.textContent = `${ta.value.length}/80`; });
      return { ta, el: h('div', { class: 'field' }, h('label', { for: `w${i}`, text: pr }), ta, cnt) };
    });
    const err = h('div', { class: 'error hidden', role: 'alert' });
    const form = h('form', { class: 'pview', style: 'animation:none' },
      h('h1', { text: '✍️ Écriture secrète' }),
      h('p', { text: 'Réponds anonymement. Les autres devront deviner que c’était toi… ou pas !' }),
      timerBar(), ...fields.map((f) => f.el), err,
      h('button', { class: 'btn gold big', type: 'submit' }, 'Envoyer en secret 🤫'));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const answers = fields.map((f) => f.ta.value.trim());
      if (answers.every((a) => !a)) { err.textContent = 'Écris au moins une réponse !'; err.classList.remove('hidden'); return; }
      act({ type: 'write', answers });
      SFX.blip(); buzz(40);
    });
    root.append(form);
    return null;
  },

  roundIntro(root, s) {
    buzz([80, 60, 80]);
    center(root).append(h('div', { style: 'color:var(--cyan);font-family:var(--display);letter-spacing:.2em', text: s.round.quick ? 'PARTIE RAPIDE' : `MANCHE ${s.round.num}` }),
      h('div', { class: 'big-emoji pop', text: s.round.icon }), h('h1', { text: s.round.title }), h('p', { text: s.round.subtitle }));
  },

  quizQuestion(root, s) {
    const answered = s.myAnswer != null ? s.myAnswer : (localAnswer === s.q.index ? localChoice : null);
    if (answered != null) {
      center(root).append(h('div', { class: `p-btn c${answered}`, style: 'width:150px;height:150px;flex:none' }, h('span', { class: 'shape', text: SHAPES[answered] })),
        h('h1', { text: 'Réponse envoyée !' }), h('p', { text: 'Croise les doigts 🤞 et regarde l’écran.' }), timerBar());
      return null;
    }
    const remote = s.mode === 'remote';
    root.append(
      h('div', { style: 'display:flex;justify-content:space-between;font-weight:700;color:var(--muted)' }, h('span', { text: `Question ${s.q.index}/${s.q.total}` }), h('span', { text: 'Vite !' })),
      timerBar(),
      remote ? h('div', { class: 'p-q', text: s.q.text }) : '',
      h('div', { class: 'p-btns' }, ...s.q.choices.map((c, i) => h('button', {
        class: `p-btn c${i}`, 'aria-label': `Réponse ${SHAPES[i]} : ${c}`,
        onclick: () => {
          localAnswer = s.q.index; localChoice = i;
          act({ type: 'answer', choice: i });
          SFX.tap(); buzz(50);
          render(state);
        },
      }, h('span', { class: 'shape', text: SHAPES[i] }), h('span', { text: c })))));
    return null;
  },

  quizReveal(root, s) {
    center(root);
    const r = s.myResult;
    if (r && r.correct) {
      SFX.correct(); buzz([60, 40, 60]);
      root.append(h('div', { class: 'big-emoji pop', text: r.streak >= 3 ? '🔥' : '🎉' }), h('h1', { class: 'result-ok', text: 'Bonne réponse !' }),
        h('div', { class: 'points pop', text: `+${fmt(r.gained)}` }), r.streak >= 2 ? h('p', { text: `Série de ${r.streak} bonnes réponses !` }) : '');
    } else {
      SFX.wrong(); buzz(300);
      root.append(h('div', { class: 'big-emoji', style: 'animation:shake .5s', text: r && r.choice != null ? '😬' : '⏱️' }),
        h('h1', { class: 'result-ko', text: r && r.choice != null ? 'Raté !' : 'Trop tard !' }),
        h('p', { text: 'La bonne réponse était :' }),
        h('div', { class: `p-btn c${s.correct}`, style: 'min-height:70px;width:100%' }, h('span', { text: `${SHAPES[s.correct]} ${s.q.choices[s.correct]}` })));
    }
  },

  leaderboard(root, s) {
    center(root);
    const n = s.ranking.length;
    const me = s.ranking.find((r) => r.id === s.me.id);
    const rank = me ? me.rank : '?';
    root.append(h('div', { class: 'big-emoji', text: rank === 1 ? '👑' : rank === n && n > 1 ? '🐢' : '📊' }),
      h('h1', { text: rank === 1 ? 'Tu es en tête !' : `Tu es ${rank}e sur ${n}` }),
      miniBoard(s.ranking, s.me.id, 5));
  },

  whoVote(root, s) {
    if (s.isAuthor) {
      center(root).append(h('div', { class: 'big-emoji', text: '😇' }), h('h1', { text: 'C’est TA réponse !' }),
        h('p', { text: 'Fais ta tête la plus innocente… Chaque joueur que tu bernes te rapporte 200 points.' }), timerBar());
      return null;
    }
    if (s.myVote || localVote === s.who.index) {
      center(root).append(h('div', { class: 'big-emoji', text: '🕵️' }), h('h1', { text: 'Vote enregistré !' }), h('p', { text: 'Suspense…' }), timerBar());
      return null;
    }
    root.append(
      h('div', { class: 'mini-quote' }, h('div', { class: 'pr', text: s.who.prompt }), h('div', { class: 'qt', text: `« ${s.who.text} »` })),
      timerBar(),
      h('h2', { text: 'Qui a osé dire ça ?' }),
      h('div', { class: 'cand-grid' }, ...s.candidates.map((c) => h('button', {
        class: 'cand', 'aria-label': `Voter pour ${c.name}`,
        onclick: () => { localVote = s.who.index; act({ type: 'vote', target: c.id }); SFX.tap(); buzz(50); render(state); },
      }, avatarEl(c), h('span', { class: 'nm', text: c.name })))));
    return null;
  },

  whoReveal(root, s) {
    // Petit roulement de tambour pour ne pas dévoiler l'auteur avant le grand écran.
    center(root).append(h('div', { class: 'big-emoji', style: 'animation:pulse .5s infinite', text: '🥁' }), h('h1', { text: 'Et c’était…' }));
    setTimeout(() => {
      if (viewKey !== `wr:${s.who.index}`) return;
      root.replaceChildren();
      PVIEWS.whoRevealResult(root, s);
    }, 1700);
  },

  whoRevealResult(root, s) {
    const a = s.author;
    if (s.isAuthor) {
      const gain = s.authorGain || 0;
      if (gain) { SFX.correct(); buzz([60, 40, 60]); } else SFX.wrong();
      root.append(h('div', { class: 'big-emoji pop', text: gain ? '😏' : '🙈' }),
        h('h1', { text: gain ? 'Bluff réussi !' : 'Démasqué !' }),
        gain ? h('div', { class: 'points pop', text: `+${fmt(gain)}` }) : h('p', { text: 'Tout le monde t’a reconnu. Trop célèbre !' }));
      return;
    }
    const r = s.myResult;
    if (r && r.correct) {
      SFX.correct(); buzz([60, 40, 60]);
      root.append(h('div', { class: 'big-emoji pop', text: '🎯' }), h('h1', { class: 'result-ok', text: 'Bien vu !' }), h('div', { class: 'points pop', text: '+500' }));
    } else {
      if (r) { SFX.wrong(); buzz(300); }
      root.append(h('div', { class: 'big-emoji', text: r ? '🤦' : '🤷' }), h('h1', { class: r ? 'result-ko' : '', text: r ? 'Raté !' : 'Pas de vote' }));
    }
    if (a) root.append(h('p', { text: 'C’était…' }), avatarEl(a, 'lg'), h('h2', { text: a.name }));
  },

  final(root, s) {
    center(root);
    const me = s.ranking.find((r) => r.id === s.me.id);
    root.append(h('div', { class: 'big-emoji', style: 'animation:pulse .6s infinite', text: '🥁' }), h('h1', { text: 'Regarde l’écran…' }));
    setTimeout(() => {
      if (viewKey !== 'final') return;
      const rank = me ? me.rank : null;
      const medal = { 1: '🥇', 2: '🥈', 3: '🥉' }[rank] || '🎬';
      if (rank === 1) { SFX.fanfare(); buzz([100, 50, 100, 50, 300]); } else SFX.pop();
      root.replaceChildren(h('div', { class: 'big-emoji pop', text: medal }),
        h('h1', { text: rank === 1 ? 'Tu es LA star de la soirée !' : `Tu termines ${rank}e !` }),
        h('div', { class: 'points', text: `${fmt(me ? me.score : 0)} pts` }),
        miniBoard(s.ranking, s.me.id, 12),
        h('p', { text: 'Merci d’avoir joué ! L’hôte peut relancer une partie avec la même équipe.' }),
        s.account ? h('a', { class: 'btn ghost', href: '/compte' }, '📚 Voir cette soirée dans mon historique')
          : h('a', { class: 'btn ghost', href: '/compte?mode=register&claim=1' }, '💾 Garder cette soirée : créer mon compte'));
    }, 6600);
  },
};

function miniBoard(ranking, meId, max) {
  const top = ranking.slice(0, max);
  const me = ranking.find((r) => r.id === meId);
  if (me && !top.includes(me)) top.push(me);
  return h('div', { class: 'mini-board' }, ...top.map((r) => h('div', { class: r.id === meId ? 'me' : '' },
    h('b', { text: `${r.rank}.`, style: 'color:var(--text);width:1.8em;text-align:right' }), avatarEl(r, 'sm'), h('span', { class: 'n', text: r.name }), h('b', { text: fmt(r.score) }))));
}

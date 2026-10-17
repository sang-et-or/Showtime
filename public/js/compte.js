// Page « Mon compte » : connexion / création de compte, historique des soirées, souvenirs et photos.
/* global $, h, AVATARS, toast */

const params = new URLSearchParams(location.search);
const next = /^\/(play|host)\?room=[A-Z]{4}$/.test(params.get('next') || '') ? params.get('next') : null;
const app = $('#app');
let me = null;

async function api(method, url, body) {
  const res = await fetch(`/api${url}`, { method, headers: { 'x-showtime': '1', ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Erreur');
  return json;
}
const fmtDate = (d) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtTime = (d) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const header = (...extra) => h('div', { class: 'account-head' }, h('a', { class: 'logo account-logo', href: '/', text: 'SHOWTIME' }), ...extra);

/** Si ce navigateur a joué sans être connecté, on propose de rattacher la partie au compte. */
async function claimCurrentGame() {
  try {
    const ident = JSON.parse(localStorage.getItem('showtime-player') || 'null');
    if (!ident || !ident.code) return false;
    const r = await api('POST', '/auth/claim', { code: ident.code, playerId: ident.playerId, token: ident.token });
    if (r.ok) toast('🎉 Ta partie en cours est rattachée à ton compte !', 4000);
    return r.ok;
  } catch { return false; }
}

// ---------------------------------------------------------------------------
// Connexion / inscription
// ---------------------------------------------------------------------------
function showAuth(mode = 'login') {
  let avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
  const err = h('div', { class: 'error hidden', role: 'alert' });
  const email = h('input', { type: 'email', id: 'a-email', autocomplete: 'email', required: true, placeholder: 'vous@exemple.fr' });
  const pwd = h('input', { type: 'password', id: 'a-pwd', autocomplete: mode === 'login' ? 'current-password' : 'new-password', required: true, minlength: '8', placeholder: mode === 'login' ? 'Votre mot de passe' : '8 caractères minimum' });
  const name = h('input', { type: 'text', id: 'a-name', maxlength: '16', placeholder: 'Votre prénom de star' });
  const grid = h('div', { class: 'avatars-grid' }, ...AVATARS.map((a) => h('button', {
    type: 'button', class: 'avatar-pick', 'aria-pressed': String(a === avatar), text: a,
    onclick: (e) => { avatar = a; grid.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); },
  })));
  const form = h('form', { class: 'account-card panel', novalidate: true },
    h('div', { class: 'tabs' },
      h('button', { type: 'button', class: mode === 'login' ? 'on' : '', onclick: () => showAuth('login') }, 'Se connecter'),
      h('button', { type: 'button', class: mode === 'register' ? 'on' : '', onclick: () => showAuth('register') }, 'Créer un compte')),
    mode === 'register' ? h('p', { class: 'muted', text: 'Le compte est facultatif : il sert à retrouver l’historique de vos soirées, vos cartes souvenirs et vos photos.' }) : '',
    h('div', { class: 'field' }, h('label', { for: 'a-email', text: 'E-mail' }), email),
    h('div', { class: 'field' }, h('label', { for: 'a-pwd', text: 'Mot de passe' }), pwd),
    mode === 'register' ? h('div', { class: 'field' }, h('label', { for: 'a-name', text: 'Prénom ou pseudo' }), name) : '',
    mode === 'register' ? h('div', { class: 'field' }, h('label', { text: 'Avatar' }), grid) : '',
    err,
    h('button', { class: 'btn gold big', type: 'submit' }, mode === 'login' ? 'Se connecter' : 'Créer mon compte'),
    mode === 'register' ? h('p', { class: 'muted small', text: 'Nous ne gardons que votre e-mail, votre pseudo, votre avatar, vos soirées et vos photos. Vous pouvez tout supprimer à tout moment depuis cette page.' }) : '');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.classList.add('hidden');
    try {
      const body = { email: email.value, password: pwd.value };
      if (mode === 'register') Object.assign(body, { name: name.value, avatar });
      me = (await api('POST', mode === 'login' ? '/auth/login' : '/auth/register', body)).user;
      await claimCurrentGame();
      if (next) { location.href = next; return; }
      showHistory();
    } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); }
  });
  app.replaceChildren(header(), next ? h('p', { class: 'muted-center', text: 'Connectez-vous, puis vous reviendrez directement dans la partie.' }) : '', form);
  setTimeout(() => email.focus(), 100);
}

// ---------------------------------------------------------------------------
// Historique
// ---------------------------------------------------------------------------
async function showHistory() {
  app.replaceChildren(header(), h('p', { class: 'muted-center', text: 'Chargement de vos soirées…' }));
  const { soirees } = await api('GET', '/me/soirees');
  const profile = h('div', { class: 'account-card panel profile' },
    h('div', { class: 'avatar lg', text: me.avatar }),
    h('div', { class: 'profile-txt' }, h('b', { text: me.name }), h('small', { text: me.email })),
    h('div', { class: 'profile-actions' },
      next ? h('a', { class: 'btn gold', href: next }, '↩️ Retour à la partie') : h('a', { class: 'btn gold', href: '/' }, '🎬 Jouer'),
      h('button', { class: 'btn ghost', onclick: async () => { await api('POST', '/auth/logout', {}); me = null; showAuth(); } }, 'Se déconnecter')));
  const list = soirees.length ? h('div', { class: 'soiree-list' }, ...soirees.map((s) => h('button', { class: 'soiree-item panel', onclick: () => showSoiree(s.id) },
    h('div', { class: 'si-date' }, h('b', { text: fmtDate(s.startedAt) }), h('small', { text: `à ${fmtTime(s.startedAt)} · salon ${s.code}` })),
    h('div', { class: 'si-games', text: (s.summary.games || []).map((g) => `${g.icon} ${g.title}`).join(' · ') || 'Partie en cours…' }),
    h('div', { class: 'si-meta' },
      h('span', { text: s.rank ? `${s.rank === 1 ? '🥇' : s.rank === 2 ? '🥈' : s.rank === 3 ? '🥉' : `${s.rank}e`} · ${s.score.toLocaleString('fr-FR')} pts` : `${s.score.toLocaleString('fr-FR')} pts` }),
      h('span', { text: `👥 ${s.players}` }), h('span', { text: `✨ ${s.souvenirs}` }), h('span', { text: `📸 ${s.photos}` })))))
    : h('div', { class: 'account-card panel empty' }, h('div', { class: 'big-emoji', text: '🎬' }), h('b', { text: 'Pas encore de soirée' }),
      h('p', { class: 'muted', text: 'Rejoignez une partie en étant connecté : elle apparaîtra ici avec ses souvenirs et ses photos.' }));
  app.replaceChildren(header(), profile, h('h2', { class: 'family', text: '📚 Mes soirées' }), list, dangerZone());
}

async function showSoiree(id) {
  app.replaceChildren(header(), h('p', { class: 'muted-center', text: 'Chargement…' }));
  const { soiree: s, me: myId } = await api('GET', `/me/soirees/${id}`);
  const back = h('button', { class: 'btn ghost', onclick: () => showHistory() }, '← Mes soirées');
  const ranking = h('div', { class: 'mini-board' }, ...s.participants.map((p) => h('div', { class: p.userId === myId ? 'me' : '' },
    h('b', { text: p.rank ? `${p.rank}.` : '–', style: 'width:1.8em;text-align:right;color:var(--text)' }), h('span', { class: 'avatar sm', text: p.avatar }),
    h('span', { class: 'n', text: p.name }), h('b', { text: p.score.toLocaleString('fr-FR') }))));
  const games = h('div', { class: 'chips-line' }, ...(s.summary.games || []).map((g) => h('span', { class: 'chip', text: `${g.icon} ${g.title}` })));
  const cards = h('div', { class: 'souvenir-grid' }, ...s.souvenirs.map(souvenirCard));
  const gallery = h('div', { class: 'photo-grid' }, ...s.photos.map((p) => {
    const fig = h('figure', { class: 'photo' },
      h('a', { href: `/api/photos/${p.id}`, target: '_blank', rel: 'noopener' }, h('img', { src: `/api/photos/${p.id}`, alt: `Photo de ${p.uploaderName}`, loading: 'lazy' })),
      h('figcaption', {}, h('span', { text: `📸 ${p.uploaderName} · ${fmtTime(p.createdAt)}` }),
        h('a', { class: 'chip', href: `/api/photos/${p.id}`, download: `showtime-${s.code}-${p.id.slice(0, 6)}.jpg` }, '⬇️'),
        p.uploaderUserId === myId ? h('button', { class: 'chip', title: 'Supprimer ma photo', onclick: async () => { if (!confirm('Supprimer définitivement cette photo ?')) return; await api('DELETE', `/photos/${p.id}`); fig.remove(); toast('Photo supprimée'); } }, '🗑️') : ''));
    return fig;
  }));
  app.replaceChildren(header(back),
    h('div', { class: 'account-card panel' }, h('h1', { class: 'soiree-title', text: fmtDate(s.startedAt) }), h('p', { class: 'muted', text: `Salon ${s.code} · ${fmtTime(s.startedAt)}${s.endedAt ? ` → ${fmtTime(s.endedAt)}` : ''}` }), games),
    h('h2', { class: 'family', text: '🏆 Classement' }), ranking,
    h('h2', { class: 'family', text: `✨ Cartes souvenirs (${s.souvenirs.length})` }), s.souvenirs.length ? cards : h('p', { class: 'muted', text: 'Pas encore de souvenir pour cette soirée.' }),
    h('h2', { class: 'family', text: `📸 Photos (${s.photos.length})` }), s.photos.length ? gallery : h('p', { class: 'muted', text: 'Aucune photo prise pendant cette soirée.' }));
}

function souvenirCard(v) {
  const p = v.payload || {};
  return h('article', { class: `souvenir ${v.kind}` },
    h('div', { class: 'sv-emoji', text: p.emoji || '✨' }),
    h('small', { class: 'sv-game', text: p.game || 'SHOWTIME' }),
    h('h3', { text: v.title }),
    p.top ? h('div', { class: 'sv-podium' }, ...p.top.map((t, i) => h('div', { class: `sv-step s${i + 1}` }, h('span', { class: 'avatar sm', text: t.avatar }), h('b', { text: t.name }), h('small', { text: `${t.score.toLocaleString('fr-FR')} pts` })))) : '',
    v.body ? h('p', { text: v.body }) : '',
    p.players && p.players.length && !p.top ? h('div', { class: 'sv-players' }, ...p.players.map((x) => h('span', { class: 'avatar sm', title: x.name, text: x.avatar }))) : '',
    h('small', { class: 'sv-date', text: new Date(v.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) }));
}

function dangerZone() {
  return h('details', { class: 'account-card panel danger' }, h('summary', { text: '⚙️ Mon compte et mes données' }),
    h('p', { class: 'muted', text: 'Supprimer le compte efface votre profil et toutes les photos que vous avez envoyées. Les classements des soirées restent visibles pour les autres joueurs, sans lien avec vous.' }),
    h('button', { class: 'btn ghost', onclick: async () => {
      const pwd = prompt('Pour confirmer, tapez votre mot de passe :');
      if (!pwd) return;
      try { await api('DELETE', '/auth/me', { password: pwd }); me = null; toast('Compte supprimé.'); showAuth(); } catch (e) { toast(e.message, 4000); }
    } }, '🗑️ Supprimer mon compte'));
}

(async () => {
  try { me = (await api('GET', '/auth/me')).user; } catch { me = null; }
  if (me) { if (params.get('claim')) await claimCurrentGame(); showHistory(); } else showAuth(params.get('mode') === 'register' ? 'register' : 'login');
})();

// API HTTP des comptes, de l'historique et des photos.
// Sécurité : mots de passe hachés (scrypt + sel), sessions par cookie HttpOnly (jeton aléatoire stocké haché),
// limitation des tentatives de connexion, photos visibles uniquement par les joueurs de la soirée.
const crypto = require('crypto');
const express = require('express');
const store = require('./store');
const { sanitizeText } = require('./util');

const COOKIE = 'st_session';
const SESSION_DAYS = 60;
const MAX_PHOTO = 2 * 1024 * 1024;
const AVATAR_RE = /^[\p{Extended_Pictographic}\p{Emoji_Component}‍️]{1,8}$/u;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

// ---------- mots de passe et sessions ----------
const scrypt = (pwd, salt) => new Promise((ok, ko) => crypto.scrypt(pwd, salt, 64, (e, k) => (e ? ko(e) : ok(k))));
async function hashPassword(pwd) {
  const salt = crypto.randomBytes(16);
  return `${salt.toString('hex')}:${(await scrypt(pwd, salt)).toString('hex')}`;
}
async function checkPassword(pwd, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const k = await scrypt(pwd, Buffer.from(salt, 'hex'));
  return crypto.timingSafeEqual(k, Buffer.from(hash, 'hex'));
}
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');

function parseCookies(header) {
  const out = {};
  String(header || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

/** Utilisateur connecté d'après l'en-tête Cookie (ou null). */
async function userFromCookie(header) {
  const tok = parseCookies(header)[COOKIE];
  if (!tok || tok.length > 100) return null;
  try { return await store.sessionUser(sha(tok)); } catch { return null; }
}

const publicUser = (u) => (u ? { id: u.id, email: u.email, name: u.name, avatar: u.avatar } : null);

function createApi({ rooms }) {
  const api = express.Router();
  api.use(express.json({ limit: '20kb' }));

  // Protection simple contre les requêtes venues d'autres sites : on exige un en-tête ajouté par nos pages.
  api.use((req, res, next) => {
    if (req.method !== 'GET' && req.get('x-showtime') !== '1') return res.status(403).json({ error: 'Requête refusée.' });
    next();
  });

  api.use(async (req, res, next) => { req.user = await userFromCookie(req.headers.cookie); next(); });

  const setSession = async (req, res, user) => {
    const tok = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
    await store.createSession(sha(tok), user.id, expires);
    const secure = req.secure || req.get('x-forwarded-proto') === 'https';
    res.setHeader('Set-Cookie', `${COOKIE}=${tok}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure ? '; Secure' : ''}`);
  };
  const needUser = (req, res, next) => (req.user ? next() : res.status(401).json({ error: 'Connectez-vous d’abord.' }));

  // Limitation des tentatives : 10 essais par quart d'heure et par adresse.
  const attempts = new Map();
  const limited = (req) => {
    const k = req.ip; const now = Date.now();
    const a = attempts.get(k) || { n: 0, reset: now + 15 * 60_000 };
    if (now > a.reset) { a.n = 0; a.reset = now + 15 * 60_000; }
    a.n++; attempts.set(k, a);
    return a.n > 10;
  };

  // ---------- comptes ----------
  api.post('/auth/register', async (req, res) => {
    if (limited(req)) return res.status(429).json({ error: 'Trop de tentatives, réessayez dans quelques minutes.' });
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const name = sanitizeText(req.body.name, 16);
    const avatar = AVATAR_RE.test(req.body.avatar || '') ? req.body.avatar : '🙂';
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Adresse e-mail invalide.' });
    if (password.length < 8 || password.length > 200) return res.status(400).json({ error: 'Le mot de passe doit faire au moins 8 caractères.' });
    if (!name) return res.status(400).json({ error: 'Choisissez un prénom ou un pseudo.' });
    try {
      const user = await store.createUser({ id: crypto.randomUUID(), email, name, avatar, passHash: await hashPassword(password) });
      await setSession(req, res, user);
      res.json({ user: publicUser(user) });
    } catch (e) {
      if (e.message === 'EXISTS') return res.status(409).json({ error: 'Un compte existe déjà avec cette adresse.' });
      console.error(e); res.status(500).json({ error: 'Erreur serveur.' });
    }
  });

  api.post('/auth/login', async (req, res) => {
    if (limited(req)) return res.status(429).json({ error: 'Trop de tentatives, réessayez dans quelques minutes.' });
    const user = await store.userByEmail(String(req.body.email || '').trim().toLowerCase());
    if (!user || !(await checkPassword(String(req.body.password || ''), user.passHash))) return res.status(401).json({ error: 'E-mail ou mot de passe incorrect.' });
    await setSession(req, res, user);
    res.json({ user: publicUser(user) });
  });

  api.post('/auth/logout', async (req, res) => {
    const tok = parseCookies(req.headers.cookie)[COOKIE];
    if (tok) await store.deleteSession(sha(tok));
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    res.json({ ok: true });
  });

  api.get('/auth/me', (req, res) => res.json({ user: publicUser(req.user), storage: store.kind }));

  api.patch('/auth/me', needUser, async (req, res) => {
    const name = sanitizeText(req.body.name, 16) || req.user.name;
    const avatar = AVATAR_RE.test(req.body.avatar || '') ? req.body.avatar : req.user.avatar;
    res.json({ user: publicUser(await store.updateUser(req.user.id, { name, avatar })) });
  });

  // Suppression du compte (RGPD) : profil, sessions et photos envoyées. Les classements restent, anonymisés.
  api.delete('/auth/me', needUser, async (req, res) => {
    if (!(await checkPassword(String(req.body.password || ''), req.user.passHash))) return res.status(401).json({ error: 'Mot de passe incorrect.' });
    await store.deleteUser(req.user.id);
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    res.json({ ok: true });
  });

  /** Rattacher à son compte une soirée jouée sans être connecté (tant que le salon existe encore). */
  api.post('/auth/claim', needUser, async (req, res) => {
    const room = rooms.get(String(req.body.code || '').toUpperCase());
    const ok = room && room.linkPlayerToUser(String(req.body.playerId || ''), String(req.body.token || ''), req.user.id);
    res.json({ ok: !!ok });
  });

  // ---------- historique ----------
  api.get('/me/soirees', needUser, async (req, res) => res.json({ soirees: await store.soireesOfUser(req.user.id) }));

  api.get('/me/soirees/:id', needUser, async (req, res) => {
    if (!/^[0-9a-f-]{36}$/.test(req.params.id) || !(await store.isParticipant(req.params.id, req.user.id))) return res.status(404).json({ error: 'Soirée introuvable.' });
    res.json({ soiree: await store.soireeDetail(req.params.id), me: req.user.id });
  });

  // ---------- photos ----------
  // Qui est l'appelant dans un salon en cours ? (hôte ou joueur, via des en-têtes, jamais dans l'URL)
  const roomCaller = (req) => {
    const room = rooms.get(String(req.get('x-room') || '').toUpperCase());
    if (!room) return null;
    if (req.get('x-host-token') && req.get('x-host-token') === room.hostToken) return { room, host: true };
    const p = room.players.get(String(req.get('x-player-id') || ''));
    if (p && p.token === req.get('x-player-token')) return { room, player: p };
    return null;
  };

  api.post('/photos', express.raw({ type: 'image/jpeg', limit: MAX_PHOTO }), async (req, res) => {
    const who = roomCaller(req);
    if (!who || !who.player) return res.status(403).json({ error: 'Seuls les joueurs du salon peuvent envoyer des photos.' });
    const { room, player } = who;
    if (!room.settings.photos) return res.status(403).json({ error: 'L’hôte a désactivé les photos.' });
    const data = req.body;
    if (!Buffer.isBuffer(data) || data.length < 100 || data[0] !== 0xff || data[1] !== 0xd8 || data[2] !== 0xff) return res.status(400).json({ error: 'Image invalide (JPEG attendu).' });
    if (!room.canUploadPhoto(player.id)) return res.status(429).json({ error: 'Doucement ! Une photo toutes les 10 secondes.' });
    try {
      const soireeId = await room.ensureSoiree();
      const id = crypto.randomUUID();
      await store.addPhoto({ id, soireeId, uploaderUserId: player.userId || null, uploaderPkey: player.id, uploaderName: player.name, mime: 'image/jpeg', data });
      room.onPhoto(id, player);
      res.json({ id });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Impossible d’enregistrer la photo.' }); }
  });

  api.get('/photos/:id', async (req, res) => {
    if (!/^[0-9a-f-]{36}$/.test(req.params.id)) return res.status(404).end();
    const photo = await store.getPhoto(req.params.id);
    if (!photo) return res.status(404).end();
    const who = roomCaller(req);
    const allowed = (who && who.room.soireeId === photo.soireeId) || (req.user && await store.isParticipant(photo.soireeId, req.user.id));
    if (!allowed) return res.status(403).end();
    res.setHeader('Content-Type', photo.mime);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.end(photo.data);
  });

  api.delete('/photos/:id', async (req, res) => {
    const photo = /^[0-9a-f-]{36}$/.test(req.params.id) ? await store.getPhoto(req.params.id) : null;
    if (!photo) return res.status(404).json({ error: 'Photo introuvable.' });
    const who = roomCaller(req);
    const mine = (req.user && photo.uploaderUserId === req.user.id) || (who?.player && who.player.id === photo.uploaderPkey && who.room.soireeId === photo.soireeId);
    const host = who?.host && who.room.soireeId === photo.soireeId;
    if (!mine && !host) return res.status(403).json({ error: 'Vous ne pouvez supprimer que vos propres photos.' });
    await store.deletePhoto(photo.id);
    res.json({ ok: true });
  });

  return api;
}

module.exports = { createApi, userFromCookie };

// Point d'entrée : serveur HTTP (fichiers statiques + QR code) et temps réel (Socket.IO).

const path = require('path');
const http = require('http');
const os = require('os');
const crypto = require('crypto');
const express = require('express');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const { Room, catalog } = require('./room');
const { sanitizeText } = require('./util');
const { createApi, userFromCookie } = require('./api');
const store = require('./store');

const PORT = Number(process.env.PORT) || 3000;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sans I ni O, pour éviter les confusions
const MAX_ROOMS = 500;
// Codes à éviter à l'écran (gros mots et ressemblances).
const BAD_CODES = /^(F[UX]CK|FXXK|SHIT|CACA|PIPI|PUTE|PUTA|CONS|CONE|BITE|CULS|NAZI|SUCE|SEXE|SEXY|MERD|KKK.|PD..)$/;

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});
// « no-cache » : le navigateur revérifie chaque fichier, pour que tout le monde ait la dernière version après une mise à jour.
app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'], setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));

const server = http.createServer(app);
const io = new Server(server, { pingInterval: 10_000, pingTimeout: 8_000, maxHttpBufferSize: 10_000 });

/** @type {Map<string, Room>} */
const rooms = new Map();
const send = (socketId, event, payload) => io.to(socketId).emit(event, payload);

// ---------- adresse publique (pour le QR code) ----------
function lanAddress() {
  if (process.env.LAN_IP) return process.env.LAN_IP;
  const candidates = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const i of list || []) {
      if (i.family !== 'IPv4' || i.internal || i.address.startsWith('169.254.')) continue;
      // On évite les cartes réseau virtuelles (WSL, Hyper-V, VirtualBox, VPN…).
      let score = /vethernet|virtual|vmware|vbox|wsl|docker|tailscale|zerotier|vpn/i.test(name) ? 0 : 2;
      if (i.address.startsWith('192.168.')) score += 1;
      candidates.push({ address: i.address, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates.length ? candidates[0].address : null;
}

function publicBase(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`).split(',')[0].trim();
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
  // Si l'hôte ouvre la page en « localhost », les téléphones ne pourraient pas joindre cette adresse :
  // on la remplace par l'adresse IP de l'ordinateur sur le Wi-Fi.
  if (/^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(host)) {
    const ip = lanAddress();
    if (ip) return `${proto}://${ip}:${PORT}`;
  }
  return `${proto}://${host}`;
}

app.get('/api/join-info', async (req, res) => {
  const code = String(req.query.room || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  const base = publicBase(req);
  const url = `${base}/play?room=${code}`;
  try {
    const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#12062b', light: '#ffffff' } });
    res.json({ url, base, svg });
  } catch {
    res.status(500).json({ error: 'QR indisponible' });
  }
});

app.get('/api/catalog', (req, res) => res.json(catalog()));

app.use('/api', createApi({ rooms }));

app.get('/healthz', (req, res) => res.json({ ok: true, rooms: rooms.size }));

// ---------- salons ----------
function newCode() {
  for (let n = 0; n < 1000; n++) {
    let code = '';
    for (let i = 0; i < 4; i++) code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
    if (!rooms.has(code) && !BAD_CODES.test(code)) return code;
  }
  throw new Error('Plus de codes disponibles');
}

const tvAttempts = new Map();
setInterval(() => { const now = Date.now(); for (const [k, v] of tvAttempts) if (now > v.reset) tvAttempts.delete(k); }, 60_000).unref();
const cleanCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
const AVATAR_RE = /^[\p{Extended_Pictographic}\p{Emoji_Component}‍️]{1,8}$/u;

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    room.tick();
    const nobody = !room.hostSocket && room.connectedPlayers().length === 0;
    if (now - room.lastActivity > 4 * 3600_000 || (nobody && !room.paused && now - room.lastActivity > 30 * 60_000)) {
      room.destroy();
      rooms.delete(code);
    }
  }
}, 15_000).unref();

// ---------- temps réel ----------
io.on('connection', (socket) => {
  // Limitation de débit très simple : 30 messages par tranche de 5 secondes et par connexion.
  let budget = 30;
  const refill = setInterval(() => { budget = 30; }, 5_000);
  socket.use((packet, next) => (budget-- > 0 ? next() : next(new Error('Trop de messages'))));
  socket.on('error', () => {});

  const ack = (cb, payload) => { if (typeof cb === 'function') cb(payload); };
  const roomOfSocket = () => rooms.get(socket.data.code);

  // --- écran hôte ---
  socket.on('host:create', (opts, cb) => {
    if (rooms.size >= MAX_ROOMS) return ack(cb, { error: 'Serveur complet, réessayez plus tard.' });
    const code = newCode();
    const room = new Room(code, send);
    // La page d'accueil peut pré-choisir le mode, le format et le jeu.
    if (opts && opts.mode === 'remote') room.settings.vote = true;
    if (opts && typeof opts === 'object') room.updateSettings({ mode: opts.mode, format: opts.format, game: opts.game, categories: typeof opts.themes === 'string' ? opts.themes.split(',') : undefined });
    rooms.set(code, room);
    room.hostSocket = socket.id;
    socket.data = { code, role: 'host' };
    ack(cb, { code, hostToken: room.hostToken });
    room.sync();
  });

  socket.on('host:resume', (msg, cb) => {
    const room = rooms.get(cleanCode(msg && msg.code));
    if (!room || !msg || msg.hostToken !== room.hostToken) return ack(cb, { error: 'Salon introuvable ou expiré.' });
    room.hostSocket = socket.id;
    socket.data = { code: room.code, role: 'host' };
    room.touch();
    ack(cb, { code: room.code });
    room.sync();
  });

  socket.on('host:action', (msg) => {
    const room = roomOfSocket();
    if (!room || room.hostSocket !== socket.id || !msg) return;
    room.touch();
    switch (msg.type) {
      case 'start': return room.start();
      case 'skip': return room.skip();
      case 'kick': return room.kick(String(msg.playerId || ''));
      case 'settings': return room.updateSettings(msg.settings);
      case 'restart': return room.restart();
      case 'end': return room.endNow();
      case 'nudge': return room.nudge();
      case 'cancelStart': return room.cancelAutoStart();
      case 'pause': return room.pause('L’animateur');
      case 'resume': return room.resume('L’animateur');
      default:
    }
  });

  // --- joueurs ---
  socket.on('player:join', async (msg, cb) => {
    const room = rooms.get(cleanCode(msg && msg.code));
    if (!room) return ack(cb, { error: 'Aucun salon avec ce code. Vérifie les 4 lettres affichées à l’écran !' });
    const name = sanitizeText(msg.name, 16);
    if (name.length < 1) return ack(cb, { error: 'Choisis un prénom !' });
    const avatar = typeof msg.avatar === 'string' && AVATAR_RE.test(msg.avatar) ? msg.avatar : '🙂';
    const user = await userFromCookie(socket.handshake.headers.cookie); // joueur connecté à son compte ?
    const res = room.addPlayer(name, avatar, socket.id, user ? user.id : null);
    if (res.error) return ack(cb, { error: res.error });
    socket.data = { code: room.code, role: 'player', pid: res.player.id };
    ack(cb, { code: room.code, playerId: res.player.id, token: res.player.token });
    room.sync();
  });

  socket.on('player:resume', (msg, cb) => {
    const room = rooms.get(cleanCode(msg && msg.code));
    const p = room && room.resumePlayer(String(msg.playerId || ''), String(msg.token || ''), socket.id);
    if (!p) return ack(cb, { error: 'Session expirée' });
    socket.data = { code: room.code, role: 'player', pid: p.id };
    ack(cb, { ok: true });
  });

  // Une télé affiche le plateau : elle tape le code télé à 6 chiffres montré par l'hôte (essais limités).
  socket.on('tv:watch', (msg, cb) => {
    const ip = socket.handshake.address;
    const now = Date.now();
    const a = tvAttempts.get(ip) || { n: 0, reset: now + 60_000 };
    if (now > a.reset) { a.n = 0; a.reset = now + 60_000; }
    a.n++; tvAttempts.set(ip, a);
    if (a.n > 15) return ack(cb, { error: 'Trop d’essais, patientez une minute.' });
    const pin = String((msg && msg.pin) || '').replace(/\D/g, '');
    const room = pin.length === 6 ? [...rooms.values()].find((r) => r.tvPin === pin) : null;
    if (!room) return ack(cb, { error: 'Code télé inconnu. Vérifiez les 6 chiffres affichés sur l’ordinateur.' });
    socket.data = { code: room.code, role: 'tv' };
    room.tvCount = (room.tvCount || 0) + 1;
    room.addTv(socket.id);
    ack(cb, { code: room.code });
  });

  // Un joueur à distance affiche l'écran télé sur son téléphone (lecture seule).
  socket.on('spectator:watch', (msg, cb) => {
    const room = rooms.get(cleanCode(msg && msg.code));
    const ok = room && room.addSpectator(socket.id, String(msg.playerId || ''), String(msg.token || ''));
    if (!ok) return ack(cb, { error: 'Accès refusé' });
    socket.data = { code: room.code, role: 'spectator' };
    ack(cb, { ok: true });
  });

  const playerAction = (fn) => (msg) => {
    const room = roomOfSocket();
    if (!room || socket.data.role !== 'player') return;
    const p = room.players.get(socket.data.pid);
    if (!p || p.socketId !== socket.id) return;
    fn(room, p, msg || {});
  };
  // Toutes les actions de jeu passent par un seul message : { type: 'answer' | 'vote' | 'letter' | … }.
  socket.on('player:act', playerAction((room, p, msg) => room.act(p, msg)));
  socket.on('player:leave', playerAction((room, p) => room.kick(p.id)));
  // Chat entre joueurs à distance (texte libre ou réaction rapide).
  socket.on('chat:send', playerAction((room, p, msg) => room.sendChat(p, msg.text)));
  socket.on('chat:history', (msg, cb) => {
    const room = roomOfSocket();
    if (!room || typeof cb !== 'function') return;
    const allowed = socket.data.role === 'player' || (!room.isPrivate() && (socket.data.role === 'host' || socket.data.role === 'spectator'));
    cb(allowed && room.chatOn() ? room.chatLog : []);
  });

  socket.on('disconnect', () => {
    clearInterval(refill);
    const room = roomOfSocket();
    if (room) room.disconnectSocket(socket.id);
    if (room && socket.data.role === 'tv') { room.tvCount = Math.max(0, (room.tvCount || 1) - 1); room.sync(); }
  });
});

store.init().then(() => console.log(`  💾 Stockage : ${store.kind}`)).catch((e) => console.error('Stockage indisponible :', e.message));

server.listen(PORT, () => {
  const ip = lanAddress();
  console.log('\n  🎬  SHOWTIME est en ligne !\n');
  console.log(`  Écran hôte (cet ordinateur) : http://localhost:${PORT}`);
  if (ip) console.log(`  Depuis un téléphone (même Wi-Fi) : http://${ip}:${PORT}`);
  console.log('');
});

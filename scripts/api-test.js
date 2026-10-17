// Test des comptes, de l'historique, des souvenirs et des photos (stockage local temporaire).
// Usage : npm run test:api
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { io } = require('socket.io-client');
const { startBot } = require('./bots');

const PORT = 3998;
const URL = `http://localhost:${PORT}`;
const assert = (cond, msg) => { if (!cond) throw new Error(`ÉCHEC : ${msg}`); console.log(`  ✓ ${msg}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Une petite image JPEG valide (1×1 pixel).
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');

async function call(method, url, { body, cookie, headers = {} } = {}) {
  const res = await fetch(`${URL}${url}`, {
    method, headers: { 'x-showtime': '1', ...(body && !Buffer.isBuffer(body) ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...headers },
    body: body ? (Buffer.isBuffer(body) ? body : JSON.stringify(body)) : undefined,
  });
  const setCookie = res.headers.get('set-cookie');
  const type = res.headers.get('content-type') || '';
  return { status: res.status, cookie: setCookie ? setCookie.split(';')[0] : null, json: type.includes('json') ? await res.json() : null, buf: type.includes('image') ? Buffer.from(await res.arrayBuffer()) : null };
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'showtime-test-'));
  const server = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], { env: { ...process.env, PORT: String(PORT), SHOWTIME_DATA_DIR: dataDir, DATABASE_URL: '' }, stdio: 'ignore' });
  try {
    for (let i = 0; i < 50; i++) { try { if ((await fetch(`${URL}/healthz`)).ok) break; } catch { await sleep(100); } }

    // ----- comptes -----
    let r = await call('POST', '/api/auth/register', { body: { email: 'Fanny@Exemple.fr', password: 'court', name: 'Fanny', avatar: '🐙' } });
    assert(r.status === 400, 'mot de passe trop court refusé');
    r = await call('POST', '/api/auth/register', { body: { email: 'Fanny@Exemple.fr', password: 'motdepasse123', name: 'Fanny', avatar: '🐙' } });
    assert(r.status === 200 && r.cookie && r.json.user.email === 'fanny@exemple.fr', 'création de compte + connexion automatique');
    const cookie = r.cookie;
    r = await call('POST', '/api/auth/register', { body: { email: 'fanny@exemple.fr', password: 'motdepasse123', name: 'Bis', avatar: '🐙' } });
    assert(r.status === 409, 'e-mail déjà utilisé refusé');
    r = await call('POST', '/api/auth/login', { body: { email: 'fanny@exemple.fr', password: 'mauvais' } });
    assert(r.status === 401, 'mauvais mot de passe refusé');
    r = await call('POST', '/api/auth/login', { body: { email: 'fanny@exemple.fr', password: 'motdepasse123' } });
    assert(r.status === 200 && r.cookie, 'connexion avec le bon mot de passe');
    r = await call('GET', '/api/auth/me', { cookie });
    assert(r.json.user && r.json.user.name === 'Fanny', `profil lu (stockage : ${r.json.storage})`);
    r = await call('POST', '/api/auth/logout', { body: {} });
    assert(r.status === 200, 'déconnexion');
    r = await call('POST', '/api/auth/login', { body: {} , headers: { 'x-showtime': '' } });
    assert(r.status === 403, 'requête sans en-tête de sécurité refusée');

    // ----- une soirée avec un joueur connecté -----
    const host = io(URL, { transports: ['websocket'], forceNew: true });
    let hs = null;
    host.on('state', (s) => { hs = s; });
    const photoEvents = [];
    host.on('photo', (p) => photoEvents.push(p));
    const created = await new Promise((res) => host.emit('host:create', { mode: 'local', format: 'quick', game: 'estimation' }, res));
    const fanny = io(URL, { transports: ['websocket'], forceNew: true, extraHeaders: { cookie } });
    let fs1 = null;
    fanny.on('state', (s) => { fs1 = s; });
    const joined = await new Promise((res) => fanny.on('connect', () => fanny.emit('player:join', { code: created.code, name: 'Fanny', avatar: '🐙' }, res)));
    const bots = [await startBot(URL, created.code, 0), await startBot(URL, created.code, 1)];
    await sleep(300);
    assert(fs1.account === true, 'le joueur est reconnu comme connecté à son compte');

    host.emit('host:action', { type: 'settings', settings: { length: 'short' } });
    host.emit('host:action', { type: 'start' });
    fanny.on('state', (s) => { if (s.phase === 'estAsk' && s.mine == null) fanny.emit('player:act', { type: 'guess', value: '1789' }); });
    await sleep(800);

    // photo pendant la partie
    const ph = (extra = {}) => ({ 'content-type': 'image/jpeg', 'x-room': created.code, 'x-player-id': joined.playerId, 'x-player-token': joined.token, ...extra });
    r = await call('POST', '/api/photos', { body: JPEG, headers: ph() });
    assert(r.status === 200 && r.json.id, 'photo envoyée depuis le téléphone');
    const photoId = r.json.id;
    await sleep(200);
    assert(photoEvents.some((p) => p.id === photoId), 'la télé est prévenue de la nouvelle photo');
    r = await call('POST', '/api/photos', { body: JPEG, headers: ph() });
    assert(r.status === 429, 'anti-rafale : une photo toutes les 10 s');
    r = await call('POST', '/api/photos', { body: Buffer.from('pas une image'), headers: ph({ 'content-type': 'image/jpeg' }) });
    assert(r.status === 400 || r.status === 429, 'fichier qui n’est pas une image refusé');
    r = await call('GET', `/api/photos/${photoId}`, { headers: { 'x-room': created.code, 'x-host-token': created.hostToken } });
    assert(r.status === 200 && r.buf && r.buf.length === JPEG.length, 'la télé (hôte) peut afficher la photo');
    r = await call('GET', `/api/photos/${photoId}`);
    assert(r.status === 403, 'un inconnu ne peut pas voir la photo');

    // on joue jusqu'au podium
    const t0 = Date.now();
    while (hs.phase !== 'final' && Date.now() - t0 < 90_000) {
      if (hs.canSkip && !['estAsk'].includes(hs.phase)) host.emit('host:action', { type: 'skip' });
      await sleep(250);
    }
    assert(hs.phase === 'final', 'partie terminée');
    await sleep(800);

    // ----- historique -----
    r = await call('GET', '/api/me/soirees', { cookie });
    assert(r.json.soirees.length === 1 && r.json.soirees[0].players === 3, 'la soirée apparaît dans l’historique (3 joueurs)');
    const sid = r.json.soirees[0].id;
    r = await call('GET', `/api/me/soirees/${sid}`, { cookie });
    const so = r.json.soiree;
    assert(so.summary.games.length === 1 && so.summary.games[0].id === 'estimation', 'la partie jouée est enregistrée');
    assert(so.souvenirs.some((x) => x.kind === 'podium'), `carte souvenir « podium » créée (${so.souvenirs.map((x) => x.title).join(' | ')})`);
    assert(so.photos.length === 1 && so.photos[0].uploaderUserId, 'la photo est rattachée au compte');
    r = await call('GET', `/api/photos/${photoId}`, { cookie });
    assert(r.status === 200, 'le joueur retrouve sa photo depuis son historique');

    // un autre compte ne voit rien
    const other = await call('POST', '/api/auth/register', { body: { email: 'autre@exemple.fr', password: 'motdepasse123', name: 'Autre', avatar: '🦊' } });
    r = await call('GET', `/api/me/soirees/${sid}`, { cookie: other.cookie });
    assert(r.status === 404, 'un autre compte ne peut pas ouvrir cette soirée');
    r = await call('GET', `/api/photos/${photoId}`, { cookie: other.cookie });
    assert(r.status === 403, 'un autre compte ne peut pas voir la photo');

    // répertoire : capture d'écran ajoutée après la soirée
    const jpg = { 'content-type': 'image/jpeg' };
    r = await call('POST', `/api/me/soirees/${sid}/photos`, { cookie, body: JPEG, headers: jpg });
    assert(r.status === 200 && r.json.id, 'un adhérent ajoute une capture à sa soirée');
    const captureId = r.json.id;
    r = await call('POST', `/api/me/soirees/${sid}/photos`, { cookie: other.cookie, body: JPEG, headers: jpg });
    assert(r.status === 404, 'un autre compte ne peut pas ajouter d’image à cette soirée');
    r = await call('POST', `/api/me/soirees/${sid}/photos`, { body: JPEG, headers: jpg });
    assert(r.status === 401, 'il faut être connecté pour ajouter une capture');
    r = await call('GET', '/api/me/photos', { cookie });
    assert(r.json.photos.length === 2 && r.json.photos.some((p) => p.id === captureId && p.code === created.code), 'le répertoire liste photos et captures de la soirée');
    r = await call('GET', '/api/me/photos', { cookie: other.cookie });
    assert(r.json.photos.length === 0, 'le répertoire d’un autre compte reste vide');

    // rattacher après coup un joueur qui n'était pas connecté
    r = await call('POST', '/api/auth/claim', { cookie: other.cookie, body: { code: created.code, playerId: bots[0].id, token: bots[0].token } });
    assert(r.json.ok, 'un joueur peut rattacher la soirée à son compte après coup');
    await sleep(300);
    r = await call('GET', '/api/me/soirees', { cookie: other.cookie });
    assert(r.json.soirees.length === 1, 'la soirée apparaît dans l’historique du compte rattaché');
    r = await call('GET', `/api/photos/${captureId}`, { cookie: other.cookie });
    assert(r.status === 200, 'les joueurs de la soirée voient la capture ajoutée');

    // suppression du compte (RGPD)
    r = await call('DELETE', '/api/auth/me', { cookie, body: { password: 'motdepasse123' } });
    assert(r.status === 200, 'suppression du compte');
    r = await call('GET', `/api/photos/${photoId}`, { cookie: other.cookie });
    assert(r.status === 404, 'les photos du compte supprimé sont effacées');

    host.close(); fanny.close(); bots.forEach((b) => b.socket.close());
    console.log('\n🎉 Comptes, historique, souvenirs et photos : tous les tests sont passés.');
  } finally {
    server.kill();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });

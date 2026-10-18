// Test du chat entre joueurs à distance : diffusion, historique, anti-spam, désactivation, jeux privés.
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { io } = require('socket.io-client');

const PORT = 3996;
const URL = `http://localhost:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const assert = (ok, label) => { console.log(`${ok ? '✅' : '❌'} ${label}`); if (!ok) failed++; };
const connect = () => new Promise((r) => { const s = io(URL, { transports: ['websocket'], forceNew: true }); s.on('connect', () => r(s)); });

async function main() {
  const server = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], { env: { ...process.env, PORT: String(PORT), DATABASE_URL: '', SHOWTIME_DATA_DIR: path.join(os.tmpdir(), 'showtime-chat-test') }, stdio: 'ignore' });
  try {
    for (let i = 0; i < 50; i++) { try { if ((await fetch(`${URL}/healthz`)).ok) break; } catch { await sleep(100); } }
    const host = await connect();
    const hostMsgs = [];
    let hs = null;
    host.on('chat', (m) => hostMsgs.push(m));
    host.on('state', (s) => { hs = s; });
    const room = await new Promise((r) => host.emit('host:create', { mode: 'remote', format: 'quick', game: 'quiz' }, r));
    const a = await connect(); const b = await connect();
    const got = { a: [], b: [] };
    let as = null;
    a.on('chat', (m) => got.a.push(m)); b.on('chat', (m) => got.b.push(m)); a.on('state', (s) => { as = s; });
    await new Promise((r) => a.emit('player:join', { code: room.code, name: 'Lou', avatar: '🦊' }, r));
    await new Promise((r) => b.emit('player:join', { code: room.code, name: 'Sam', avatar: '🐼' }, r));
    await sleep(300);
    assert(as.chat === true, 'à distance : le chat est proposé aux joueurs');

    a.emit('chat:send', { text: '  Bonsoir   tout le monde ! ' });
    await sleep(300);
    assert(got.b.length === 1 && got.b[0].text === 'Bonsoir tout le monde !' && got.b[0].who.name === 'Lou', 'un message arrive chez l’autre joueur (texte nettoyé)');
    assert(got.a.length === 1, 'l’auteur reçoit aussi son message');
    assert(hostMsgs.length === 1, 'le message s’affiche sur l’écran principal');
    a.emit('chat:send', { text: 'spam' });
    await sleep(200);
    assert(got.b.length === 1, 'anti-spam : pas deux messages en moins d’une seconde');
    await sleep(900);
    b.emit('chat:send', { text: 'x'.repeat(500) });
    await sleep(300);
    assert(got.a[got.a.length - 1].text.length === 200, 'les messages sont limités à 200 caractères');
    const hist = await new Promise((r) => b.emit('chat:history', {}, r));
    assert(hist.length === 2, 'l’historique est disponible pour un téléphone qui se reconnecte');

    // Jeu privé pour adultes : les téléphones discutent, mais rien sur l'écran principal.
    host.emit('host:action', { type: 'settings', settings: { ...hs.settings, format: 'quick', game: 'brulant' } });
    await sleep(300);
    host.emit('host:action', { type: 'start' });
    await sleep(1200);
    const before = hostMsgs.length;
    await sleep(1000);
    a.emit('chat:send', { text: 'Message privé' });
    await sleep(300);
    assert(got.b.some((m) => m.text === 'Message privé') && hostMsgs.length === before, 'jeu privé : le message reste sur les téléphones, rien sur l’écran principal');

    // L'animateur coupe le chat.
    host.emit('host:action', { type: 'restart' });
    await sleep(300);
    host.emit('host:action', { type: 'settings', settings: { ...hs.settings, chat: false } });
    await sleep(300);
    await sleep(1000);
    a.emit('chat:send', { text: 'Encore là ?' });
    await sleep(300);
    assert(as.chat === false && !got.b.some((m) => m.text === 'Encore là ?'), 'chat désactivé par l’animateur : plus aucun message');

    // Même pièce : pas de chat.
    host.emit('host:action', { type: 'settings', settings: { ...hs.settings, chat: true, mode: 'local' } });
    await sleep(300);
    assert(as.chat === false, 'dans la même pièce : pas de chat');
    host.close(); a.close(); b.close();
  } finally { server.kill(); }
  if (failed) { console.log(`\n${failed} test(s) en échec`); process.exit(1); }
  console.log('\n🎉 Chat : tous les tests sont passés.');
  process.exit(0);
}
main();

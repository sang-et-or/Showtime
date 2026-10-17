// Test de la pause : un joueur met en pause, le minuteur est figé, reprise au même point ;
// sans reprise dans le délai (raccourci ici à 3 s), la partie s'arrête sur le classement final.
const path = require('path');
const { spawn } = require('child_process');
const { io } = require('socket.io-client');
const { startBot } = require('./bots');

const PORT = 3997;
const URL = `http://localhost:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const assert = (ok, label) => { console.log(`${ok ? '✅' : '❌'} ${label}`); if (!ok) failed++; };

async function main() {
  const server = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], { env: { ...process.env, PORT: String(PORT), SHOWTIME_PAUSE_MAX_MS: '3000', DATABASE_URL: '', SHOWTIME_DATA_DIR: path.join(require('os').tmpdir(), 'showtime-pause-test') }, stdio: 'ignore' });
  try {
    for (let i = 0; i < 50; i++) { try { if ((await fetch(`${URL}/healthz`)).ok) break; } catch { await sleep(100); } }
    const host = io(URL, { transports: ['websocket'], forceNew: true });
    let hs = null;
    host.on('state', (s) => { hs = s; });
    const created = await new Promise((res) => host.on('connect', () => host.emit('host:create', { mode: 'local', format: 'quick', game: 'pendu' }, res)));
    const p = io(URL, { transports: ['websocket'], forceNew: true });
    let ps = null;
    p.on('state', (s) => { ps = s; });
    await new Promise((res) => p.on('connect', () => p.emit('player:join', { code: created.code, name: 'Lou', avatar: '🦊' }, res)));
    const bot = await startBot(URL, created.code, 0);
    await sleep(300);

    p.emit('player:act', { type: 'pause' });
    await sleep(200);
    assert(!hs.paused, 'pas de pause possible dans le salon d’attente');

    host.emit('host:action', { type: 'start' });
    await sleep(500);
    assert(hs.phase === 'roundIntro' && hs.canPause, `la partie commence (${hs.phase}) et la pause est proposée`);
    const before = hs.remainingMs;
    p.emit('player:act', { type: 'pause' });
    await sleep(300);
    assert(hs.paused && hs.paused.by === 'Lou' && ps.paused, 'un joueur met la partie en pause, tout le monde le voit');
    assert(!hs.remainingMs && !hs.canSkip, 'le minuteur est figé et « Suivant » désactivé');
    host.emit('host:action', { type: 'skip' });
    await sleep(1500);
    assert(hs.phase === 'roundIntro' && hs.paused, 'rien n’avance pendant la pause');
    bot.socket.emit('player:act', { type: 'resume' });
    await sleep(300);
    assert(!hs.paused && hs.canSkip && hs.remainingMs > before - 1500, `reprise au même point (${Math.round(hs.remainingMs / 1000)} s restantes)`);

    host.emit('host:action', { type: 'pause' });
    await sleep(300);
    assert(hs.paused && hs.paused.by === 'L’animateur', 'l’animateur peut aussi mettre en pause');
    await sleep(3500);
    assert(hs.phase === 'final' && !hs.paused, 'sans reprise dans le délai : fin de partie et classement final');
    assert(!hs.canPause, 'plus de pause possible au classement final');

    host.close(); p.close(); bot.socket.close();
  } finally { server.kill(); }
  if (failed) { console.log(`\n${failed} test(s) en échec`); process.exit(1); }
  console.log('\n🎉 Pause : tous les tests sont passés.');
  process.exit(0);
}
main();

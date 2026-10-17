// Test de bout en bout : lance le serveur, crée un salon, fait jouer 4 robots une partie complète
// (écriture secrète → quiz → « Qui a osé dire ça ? » → finale), teste la reconnexion et la sécurité de base.
// Usage : npm test

const { spawn } = require('child_process');
const path = require('path');
const { io } = require('socket.io-client');
const { startBot } = require('./bots');

const PORT = 3999;
const URL = `http://localhost:${PORT}`;
const assert = (cond, msg) => { if (!cond) throw new Error(`ÉCHEC : ${msg}`); console.log(`  ✓ ${msg}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const server = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  try {
    for (let i = 0; i < 50; i++) { try { if ((await fetch(`${URL}/healthz`)).ok) break; } catch { await sleep(100); } }

    const host = io(URL, { transports: ['websocket'], forceNew: true });
    let hs = null;
    const phases = [];
    host.on('state', (s) => { hs = s; if (phases[phases.length - 1] !== s.phase) phases.push(s.phase); });
    const created = await new Promise((r) => host.emit('host:create', { mode: 'local' }, r));
    assert(/^[A-Z]{4}$/.test(created.code), `salon créé (${created.code})`);

    const info = await (await fetch(`${URL}/api/join-info?room=${created.code}`)).json();
    assert(info.svg.startsWith('<svg') && info.url.includes(`/play?room=${created.code}`), 'QR code et lien de jonction générés');

    const bots = [];
    for (let i = 0; i < 4; i++) bots.push(await startBot(URL, created.code, i));
    await sleep(200);
    assert(hs.players.length === 4, '4 joueurs visibles sur l’écran hôte');

    // Sécurité : un joueur ne peut pas piloter le salon, un faux jeton ne permet pas de reprendre une place.
    bots[0].socket.emit('host:action', { type: 'start' });
    await sleep(200);
    assert(hs.phase === 'lobby', 'un joueur ne peut pas lancer la partie à la place de l’hôte');
    const bad = await new Promise((r) => bots[0].socket.emit('player:resume', { code: created.code, playerId: bots[1].id, token: 'faux' }, r));
    assert(bad.error, 'reprise refusée avec un faux jeton');
    const dup = await new Promise((r) => { const s = io(URL, { transports: ['websocket'], forceNew: true }); s.emit('player:join', { code: created.code, name: bots[0].name, avatar: '🤖' }, (res) => { s.close(); r(res); }); });
    assert(dup.error, 'prénom en double refusé');

    host.emit('host:action', { type: 'settings', settings: { ...hs.settings, quizCount: 5 } });
    await sleep(100);
    host.emit('host:action', { type: 'start' });

    // Reconnexion : un joueur perd sa connexion en pleine partie puis revient avec son jeton.
    await sleep(1500);
    const victim = bots[3];
    victim.socket.disconnect();
    await sleep(300);
    assert(hs.players.find((p) => p.id === victim.id).connected === false, 'coupure d’un joueur détectée');
    victim.socket.connect();
    await sleep(500);
    assert(hs.players.find((p) => p.id === victim.id).connected === true && victim.state.me.id === victim.id, 'le joueur reprend sa place après reconnexion');

    // L'hôte accélère le show en appuyant sur « Suivant » dès que possible.
    const t0 = Date.now();
    while (hs.phase !== 'final' && Date.now() - t0 < 120_000) {
      if (hs.canSkip && !['writing', 'quizQuestion', 'whoVote'].includes(hs.phase)) host.emit('host:action', { type: 'skip' });
      await sleep(350);
    }
    assert(hs.phase === 'final', `partie terminée en ${Math.round((Date.now() - t0) / 1000)} s`);
    for (const p of ['writing', 'roundIntro', 'quizQuestion', 'quizReveal', 'leaderboard', 'whoVote', 'whoReveal', 'final']) {
      assert(phases.includes(p), `phase « ${p} » jouée`);
    }
    const total = hs.ranking.reduce((a, r) => a + r.score, 0);
    assert(hs.ranking.length === 4 && total > 0, `classement final : ${hs.ranking.map((r) => `${r.rank}. ${r.name} ${r.score}`).join(' | ')}`);
    assert(bots.every((b) => b.state.phase === 'final' && b.state.me.score === hs.ranking.find((r) => r.id === b.id).score), 'scores identiques sur chaque téléphone et sur l’écran');

    host.emit('host:action', { type: 'restart' });
    await sleep(300);
    assert(hs.phase === 'lobby' && hs.players.every((p) => p.score === 0), '« Rejouer » remet les scores à zéro');

    host.close(); bots.forEach((b) => b.socket.close());
    console.log('\n🎉 Tous les tests sont passés.');
  } finally {
    server.kill();
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });

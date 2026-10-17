// Test de bout en bout : lance le serveur, crée un salon, fait jouer 4 robots un Grand Show complet
// (quiz, Qui a osé dire ça ?, Défi Surprise, Grand Duel) puis chaque partie rapide,
// et vérifie la reconnexion, la sécurité de base et la cohérence des scores.
// Usage : npm test

const { spawn } = require('child_process');
const path = require('path');
const { io } = require('socket.io-client');
const { startBot } = require('./bots');

const PORT = 3999;
const URL = `http://localhost:${PORT}`;
const assert = (cond, msg) => { if (!cond) throw new Error(`ÉCHEC : ${msg}`); console.log(`  ✓ ${msg}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Phases où l'on attend les joueurs : l'hôte n'appuie pas sur « Suivant » pendant celles-ci.
const INPUT = new Set(['writing', 'quizQuestion', 'whoVote', 'defiGet', 'defiAct', 'defiVote', 'duelBet', 'duelQ',
  'bacWrite', 'bacReview', 'undVote', 'penduPlay', 'estAsk', 'ludoPlay', 'rouePlay', 'roueQ', 'vieTurn', 'moisTurn']);

async function main() {
  const server = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], { env: { ...process.env, PORT: String(PORT), SHOWTIME_GAME_CAP_MS: '30000' }, stdio: 'ignore' });
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

    host.emit('host:action', { type: 'settings', settings: { ...hs.settings, length: 'short' } });
    await sleep(100);
    phases.length = 0;
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
    const playUntilFinal = async (label) => {
      const t0 = Date.now();
      while (hs.phase !== 'final' && Date.now() - t0 < 240_000) {
        if (hs.canSkip && !INPUT.has(hs.phase)) host.emit('host:action', { type: 'skip' });
        await sleep(250);
      }
      assert(hs.phase === 'final', `${label} : partie terminée en ${Math.round((Date.now() - t0) / 1000)} s`);
      await sleep(300);
      assert(bots.every((b) => b.state.phase === 'final' && b.state.me.score === hs.ranking.find((r) => r.id === b.id).score), `${label} : scores identiques sur les téléphones et l’écran (${hs.ranking.map((r) => `${r.name} ${r.score}`).join(', ')})`);
      return [...phases];
    };

    const showPhases = await playUntilFinal('Grand Show');
    for (const p of ['writing', 'quizQuestion', 'quizReveal', 'leaderboard', 'whoVote', 'whoReveal', 'defiGet', 'defiAct', 'defiReveal', 'duelBet', 'duelQ', 'duelPoint', 'duelEnd']) {
      assert(showPhases.includes(p), `Grand Show : phase « ${p} » jouée`);
    }

    const QUICK = { petitbac: ['bacWrite', 'bacReview', 'bacReveal'], undercover: ['undClues', 'undVote', 'undReveal', 'undEnd'], pendu: ['penduPlay', 'penduReveal'], estimation: ['estAsk', 'estReveal'],
      ludo: ['ludoPlay', 'ludoEnd'], roue: ['rouePlay', 'roueQ', 'roueA', 'roueEnd'], vie: ['vieTurn', 'vieEvent', 'vieEnd'], mois: ['moisTurn', 'moisEvent', 'moisEnd'] };
    for (const [game, expected] of Object.entries(QUICK)) {
      host.emit('host:action', { type: 'restart' });
      await sleep(200);
      host.emit('host:action', { type: 'settings', settings: { format: 'quick', game, length: 'short' } });
      await sleep(200);
      phases.length = 0;
    host.emit('host:action', { type: 'start' });
      const ph = await playUntilFinal(`Partie rapide ${game}`);
      assert(expected.every((p) => ph.includes(p)), `Partie rapide ${game} : toutes les phases jouées`);
      assert(hs.ranking.some((r) => r.score > 0), `Partie rapide ${game} : des points ont été marqués`);
    }
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

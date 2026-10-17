// Ajoute des joueurs « robots » à un salon, pour tester seul(e) sans 5 téléphones.
// Usage : npm run bots -- ABCD 3            (3 robots dans le salon ABCD, serveur local)
//         npm run bots -- ABCD 3 https://mon-showtime.onrender.com

const { io } = require('socket.io-client');

const NAMES = ['Robotine', 'Bip-Bop', 'R2-Dédé', 'Wall-Ève', 'Terminator', 'Siri-Lanka', 'C3-Pierre', 'Gigabyte'];
const AVATARS = ['🤖', '👽', '🦖', '🐙', '🦄', '🐸', '🐼', '🦊'];
const FUNNY = ['Une licorne en tutu', 'Je dirais rien sans mon avocat', 'Trois baguettes et un rêve', 'Le wifi de ma grand-mère',
  'Danser la macarena en réunion', 'Un hamster nommé Gérard', 'Des chaussettes avec des sandales', 'Bip bip, erreur 404'];
const rnd = (n) => Math.floor(Math.random() * n);

function startBot(url, code, index, { log = () => {} } = {}) {
  return new Promise((resolve, reject) => {
    const socket = io(url, { transports: ['websocket'], forceNew: true });
    const bot = { socket, name: `${NAMES[index % NAMES.length]}${index >= NAMES.length ? index : ''}`, states: [] };
    let lastKey = '';
    socket.on('connect_error', reject);
    socket.on('connect', () => {
      // Après une coupure, on reprend sa place avec son jeton (comme le fait un vrai téléphone).
      if (bot.token) return socket.emit('player:resume', { code, playerId: bot.id, token: bot.token }, () => {});
      socket.emit('player:join', { code, name: bot.name, avatar: AVATARS[index % AVATARS.length] }, (res) => {
        if (res.error) return reject(new Error(`${bot.name}: ${res.error}`));
        bot.id = res.playerId;
        bot.token = res.token;
        log(`🤖 ${bot.name} a rejoint ${code}`);
        resolve(bot);
      });
    });
    socket.on('state', (s) => {
      bot.state = s;
      const key = `${s.phase}:${s.q?.index ?? s.who?.index ?? ''}`;
      if (key === lastKey) return;
      lastKey = key;
      const wait = 500 + rnd(3000);
      if (s.phase === 'writing' && !s.submitted) {
        setTimeout(() => socket.emit('player:write', { answers: [FUNNY[rnd(FUNNY.length)], FUNNY[rnd(FUNNY.length)]] }), wait);
      } else if (s.phase === 'quizQuestion' && s.myAnswer == null) {
        setTimeout(() => socket.emit('player:answer', { choice: rnd(4) }), wait);
      } else if (s.phase === 'whoVote' && !s.isAuthor && !s.myVote && s.candidates.length) {
        setTimeout(() => socket.emit('player:vote', { target: s.candidates[rnd(s.candidates.length)].id }), wait);
      }
    });
  });
}

module.exports = { startBot };

if (require.main === module) {
  const [code, count = '3', url = 'http://localhost:3000'] = process.argv.slice(2);
  if (!code) {
    console.log('Usage : npm run bots -- CODE [nombre] [url]');
    process.exit(1);
  }
  (async () => {
    for (let i = 0; i < Number(count); i++) {
      try { await startBot(url, code.toUpperCase(), i, { log: console.log }); } catch (e) { console.error(e.message); }
    }
    console.log('Les robots jouent. Ctrl+C pour les faire quitter.');
  })();
}

// Ajoute des joueurs « robots » à un salon, pour tester seul(e) sans 5 téléphones.
// Usage : npm run bots -- ABCD 3            (3 robots dans le salon ABCD, serveur local)
//         npm run bots -- ABCD 3 https://mon-showtime.onrender.com

const { io } = require('socket.io-client');

const NAMES = ['Robotine', 'Bip-Bop', 'R2-Dédé', 'Wall-Ève', 'Terminator', 'Siri-Lanka', 'C3-Pierre', 'Gigabyte'];
const AVATARS = ['🤖', '👽', '🦖', '🐙', '🦄', '🐸', '🐼', '🦊'];
const FUNNY = ['Une licorne en tutu', 'Je dirais rien sans mon avocat', 'Trois baguettes et un rêve', 'Le wifi de ma grand-mère',
  'Danser la macarena en réunion', 'Un hamster nommé Gérard', 'Des chaussettes avec des sandales', 'Bip bip, erreur 404'];
const BAC_WORDS = ['ane', 'banane', 'chat', 'dauphin', 'elephant', 'fraise', 'girafe', 'hibou', 'iguane', 'jaguar', 'lama', 'mouton',
  'nantes', 'orange', 'paris', 'renard', 'serpent', 'tigre', 'uruguay', 'vache', 'zebre'];
const rnd = (n) => Math.floor(Math.random() * n);
const pickOne = (arr) => arr[rnd(arr.length)];

function startBot(url, code, index, { log = () => {}, speed = 1 } = {}) {
  return new Promise((resolve, reject) => {
    const socket = io(url, { transports: ['websocket'], forceNew: true });
    const bot = { socket, name: `${NAMES[index % NAMES.length]}${index >= NAMES.length ? index : ''}` };
    const act = (msg) => socket.emit('player:act', msg);
    const later = (fn, base = 500, spread = 2500) => setTimeout(fn, (base + rnd(spread)) * speed);
    let lastKey = '';
    let penduTimer = null;

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
      if (s.phase !== 'penduPlay' && penduTimer) { clearInterval(penduTimer); penduTimer = null; }
      if (s.key === lastKey) return;
      lastKey = s.key;
      switch (s.phase) {
        case 'writing':
          if (!s.submitted) later(() => act({ type: 'write', answers: [pickOne(FUNNY), pickOne(FUNNY)] }));
          break;
        case 'quizQuestion':
          if (s.myAnswer == null) later(() => act({ type: 'answer', choice: rnd(4) }));
          break;
        case 'whoVote':
          if (!s.isAuthor && !s.myVote && s.candidates.length) later(() => act({ type: 'vote', target: pickOne(s.candidates).id }));
          break;
        case 'defiGet':
          if (s.isPerformer) later(() => act({ type: 'ready' }), 300, 500);
          break;
        case 'defiAct':
          if (s.isPerformer) {
            later(() => (s.turn.kind === 'mime'
              ? act({ type: 'found', target: Math.random() < 0.7 && s.others?.length ? pickOne(s.others).id : null })
              : act({ type: 'done' })), 1000, 1500);
          }
          break;
        case 'defiVote':
          if (!s.isPerformer && !s.myStars) later(() => act({ type: 'stars', n: 1 + rnd(5) }));
          break;
        case 'duelBet':
          if (s.role === 'spectator' && !s.myBet) {
            later(() => act({ type: 'bet', target: Math.random() < 0.5 ? s.duel.a.id : s.duel.b.id, stake: pickOne(s.stakes) }));
          }
          break;
        case 'duelQ':
          if (s.role !== 'spectator' && !s.mine) later(() => act({ type: 'answer', choice: rnd(4) }), 400, 2500);
          break;
        case 'bacWrite':
          if (!s.done) {
            const l = s.bac.letter.toLowerCase();
            const answers = s.bac.cats.map(() => (Math.random() < 0.7 ? (BAC_WORDS.find((w) => w[0] === l) || `${l}ouloulou`) : ''));
            later(() => act({ type: 'bacDraft', answers }), 300, 800);
            later(() => act({ type: 'bacSubmit', answers }), 1500, 2500);
          }
          break;
        case 'bacReview':
          if (!s.reviewed) {
            const others = s.entries.filter((e) => !e.mine && e.auto === 'ok');
            if (others.length && Math.random() < 0.5) later(() => act({ type: 'bacReject', id: pickOne(others).id, on: true }), 200, 500);
            later(() => act({ type: 'bacReviewed' }), 1000, 1500);
          }
          break;
        case 'undVote':
          if (s.alive && !s.myVote && s.candidates.length) later(() => act({ type: 'vote', target: pickOne(s.candidates).id }));
          break;
        case 'penduPlay':
          if (!penduTimer) {
            penduTimer = setInterval(() => {
              const st = bot.state;
              if (!st || st.phase !== 'penduPlay') return;
              const free = 'EAISTNRULODCMP'.split('').concat('BFGHJKQVWXYZ'.split('')).filter((x) => !st.pendu.tried.includes(x));
              if (free.length) act({ type: 'letter', l: Math.random() < 0.7 ? free[0] : pickOne(free) });
            }, (2600 + rnd(1500)) * speed);
          }
          break;
        case 'estAsk':
          if (s.mine == null) later(() => act({ type: 'guess', value: String(rnd(3000)) }));
          break;
        // ----- jeux de plateau -----
        case 'ludoPlay':
          if (s.ludo.isTurn && s.ludo.stage === 'roll') later(() => act({ type: 'roll' }), 300, 700);
          if (s.ludo.isTurn && s.ludo.stage === 'choose') later(() => act({ type: 'choose', h: pickOne(s.ludo.options).h }), 300, 700);
          break;
        case 'rouePlay':
          if (s.roue.isTurn && s.stage === 'roll') later(() => act({ type: 'roll' }), 300, 700);
          break;
        case 'roueQ':
          if (s.mine == null) later(() => act({ type: 'answer', choice: rnd(4) }), 400, 1500);
          break;
        case 'vieTurn': case 'moisTurn':
          if (s.track.isTurn && s.stage === 'roll') later(() => act({ type: 'roll' }), 300, 700);
          break;
        case 'vieEvent': case 'moisEvent':
          if (s.track.isTurn && s.choice && !s.chosen) later(() => act({ type: 'decide', yes: Math.random() < 0.5 }), 400, 900);
          break;
        default:
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

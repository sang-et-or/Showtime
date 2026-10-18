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
        case 'cpGuess':
          if (s.mine == null) later(() => act({ type: 'answer', choice: rnd(s.item.a.length) }));
          break;
        case 'cpWish':
          if (!s.mine) later(() => act({ type: 'wish', value: pickOne(['yes', 'maybe', 'no']) }));
          break;
        case 'cpTalk':
          if (s.cp.isMe) later(() => act({ type: Math.random() < 0.8 ? 'done' : 'joker' }), 800, 1200);
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
        // ----- jeux télé -----
        case 'motusPlay':
          if (s.isTurn) {
            const known = s.motus.known;
            later(() => act({ type: 'word', text: known.map((l) => l || pickOne('EAISTNRULO'.split(''))).join('') }), 500, 1500);
          }
          break;
        case 'mpmClue':
          if (s.isGiver) later(() => act({ type: 'clue', text: pickOne(['soleil', 'grand', 'rouge', 'vite', 'animal', 'manger', 'jouer', 'froid', 'joie', 'nuit']) }), 500, 1500);
          break;
        case 'mpmGuess':
          if (!s.isGiver && s.mine == null) later(() => act({ type: 'guess', text: pickOne(['plage', 'pizza', 'robot', 'lune', 'neige', 'lion', 'train', 'clown', 'avion', 'reine']) }), 400, 2000);
          break;
        case 'sdAsk':
          for (let k = 0; k < 4; k++) later(() => act({ type: 'answer', text: pickOne(['vache', 'foot', 'cles', 'telephone', 'guitare', 'dormir', 'voiture', 'noir', 'superman', 'fraise', 'danser', 'serviette', 'pompier', 'italie', 'lire']) }), 600 + k * 1500, 1200);
          break;
        case 'rlTurn':
          if (s.isTurn && s.stage === 'spin') {
            const cons = 'RSTNLCDMPBGFVHQJXZKW'.split('').filter((l) => !s.rl.used.includes(l));
            if (cons.length > 6 && Math.random() < 0.9) later(() => act({ type: 'spin' }), 300, 800);
            else later(() => act({ type: 'solve', text: s.rl.cells.map((c) => c || 'E').join('') }), 300, 800);
          }
          if (s.isTurn && s.stage === 'letter') {
            const cons = 'RSTNLCDMPBGFVHQJXZKW'.split('').filter((l) => !s.rl.used.includes(l));
            if (cons.length) later(() => act({ type: 'letter', l: cons[0] }), 300, 700);
          }
          break;
        case 'ileChallenge':
          if (s.playing && s.stage === 'go') {
            if (s.kind === 'tap') { let n = 0; const iv = setInterval(() => { n += 3 + rnd(4); act({ type: 'taps', n }); }, 450); setTimeout(() => clearInterval(iv), 9500); }
            if (s.kind === 'hold') { later(() => act({ type: 'hold' }), 200, 1500); later(() => act({ type: 'release' }), 5000, 15000); }
            if (s.q && s.myAnswer == null) later(() => act({ type: 'answer', choice: rnd(4) }), 400, 2500);
          }
          break;
        case 'ileVote':
          if (s.voter && !s.voted && s.candidates.length) later(() => act({ type: 'vote', target: pickOne(s.candidates).id }), 500, 2000);
          break;
        case 'tzWrite':
          if (s.inGame && !s.done) later(() => act({ type: 'answer', text: pickOne(['pizza', 'la plage', 'chat', 'rouge', 'le chocolat', 'Titanic', 'voler', 'pompier']) }), 500, 2500);
          break;
        case 'tzJudge':
          s.toJudge.forEach((p) => later(() => act({ type: 'judge', k: p.k, ok: Math.random() < 0.5 }), 300, 1500));
          break;
        case 'brChoose':
          if (s.br.isMe) later(() => act({ type: Math.random() < 0.5 ? 'truth' : 'dare' }), 300, 800);
          break;
        case 'brCard':
          if (!s.result && s.br.isMe) later(() => act({ type: Math.random() < 0.85 ? 'done' : 'joker' }), 600, 1200);
          if (!s.result && !s.br.isMe && s.kind === 'dare' && Math.random() < 0.15) later(() => act({ type: 'veto' }), 200, 400);
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
        // ----- jeux de cartes -----
        case 'batFlip':
          if (s.bat.inGame && s.bat.myCards > 0 && !s.flipped) later(() => act({ type: 'flip' }), 200, 900);
          break;
        case 'bjBet':
          if (s.bj.seated && !s.bet && s.bets.length) later(() => act({ type: 'bet', amount: pickOne(s.bets) }), 300, 900);
          break;
        case 'bjPlay':
          if (s.mine && !s.mine.done) later(() => act({ type: s.mine.value < 16 ? 'hit' : 'stand' }), 300, 900);
          break;
        case 'pkPlay': {
          const t = s.turn;
          if (t && t.isTurn) {
            const r = Math.random();
            const msg = t.canCheck ? (r < 0.75 || !t.presets.length ? { type: 'check' } : { type: 'raise', to: t.presets[0] })
              : r < 0.6 ? { type: 'call' } : r < 0.85 || !t.presets.length ? { type: 'fold' } : { type: 'raise', to: pickOne(t.presets) };
            later(() => act(msg), 200, 700);
          }
          break;
        }
        case 'blBid':
          if (s.myTurn) {
            if (s.bidSuits) later(() => act(Math.random() < 0.5 ? { type: 'take', suit: pickOne(s.bidSuits) } : { type: 'pass' }), 200, 600);
            else later(() => act({ type: Math.random() < 0.35 ? 'take' : 'pass' }), 200, 600);
          }
          break;
        case 'blPlay':
          if (s.myTurn && s.legal.length) later(() => act({ type: 'play', card: pickOne(s.legal) }), 200, 600);
          break;
        case 'prPlay':
          if (s.myTurn) {
            const ORDER = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
            const groups = {};
            s.pr.hand.forEach((c) => { (groups[c.r] = groups[c.r] || []).push(c.id); });
            const pileRank = s.pr.pile ? ORDER.indexOf(s.pr.pile.cards[0].r) : -1;
            const need = s.need || 1;
            const options = Object.entries(groups).filter(([r, ids]) => ids.length >= need && ORDER.indexOf(r) > pileRank)
              .sort((a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]));
            if (options.length && (!s.canPass || Math.random() < 0.8)) later(() => act({ type: 'play', cards: options[0][1].slice(0, need) }), 200, 600);
            else if (s.canPass) later(() => act({ type: 'pass' }), 200, 600);
          }
          break;
        case 'htPlay':
          if (s.myTurn) {
            if (s.playable.length) later(() => act({ type: 'play', card: s.playable[0], suit: pickOne(['S', 'H', 'D', 'C']) }), 200, 600);
            else if (s.canDraw) later(() => act({ type: 'draw' }), 200, 600);
            else if (s.canPass) later(() => act({ type: 'pass' }), 200, 600);
          }
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

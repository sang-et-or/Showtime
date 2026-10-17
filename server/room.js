// Un salon de jeu = une machine à états, entièrement pilotée par le serveur.
// Les clients (écran hôte, téléphones) ne font qu'afficher l'état reçu et envoyer des actions :
// impossible de tricher en modifiant le navigateur, et un joueur qui se reconnecte
// retrouve exactement l'état courant.

const crypto = require('crypto');
const animator = require('./animator');
const { CATEGORIES, QUESTIONS } = require('./content/questions');
const PROMPTS = require('./content/prompts');

const DURATIONS = {
  writing: 120_000,
  roundIntro: 7_000,
  question: 20_000,
  quizReveal: 6_000,
  leaderboard: 7_000,
  whoVote: 25_000,
  whoReveal: 7_000,
  podium: 7_000, // synchronisé avec l'animation du podium sur l'écran hôte
};
const MAX_PLAYERS = 12;
const LEADERBOARD_EVERY = 4; // classement intermédiaire toutes les N questions
const WHO_MAX_ITEMS = 8;
const COLORS = ['#ff3d8b', '#22d3ee', '#facc15', '#a3e635', '#c084fc', '#fb923c', '#f87171', '#34d399', '#60a5fa', '#f472b6', '#fde047', '#2dd4bf'];

const token = () => crypto.randomBytes(16).toString('hex');
const shortId = () => crypto.randomBytes(5).toString('hex');
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

class Room {
  /** @param {string} code @param {(socketId: string, event: string, payload: any) => void} send */
  constructor(code, send) {
    this.code = code;
    this.send = send;
    this.hostToken = token();
    this.hostSocket = null;
    this.players = new Map();
    this.settings = { mode: 'local', quizCount: 8, categories: Object.keys(CATEGORIES), whoSaid: true };
    this.phase = 'lobby';
    this.data = {};
    this.timer = null;
    this.lineTimer = null;
    this.deadline = 0;
    this.timerTotal = 0;
    this.pendingNext = null;
    this.line = { id: 0, text: '' };
    this.snapshot = new Map(); // pid -> { rank, score } au dernier classement affiché
    this.writings = new Map(); // pid -> [réponse1, réponse2]
    this.assign = new Map(); // pid -> [amorce1, amorce2]
    this.createdAt = Date.now(); // servira à la limite de découverte gratuite (≈ 15 min)
    this.lastActivity = Date.now();
    this.say(animator.welcome());
  }

  // ---------- utilitaires ----------
  touch() { this.lastActivity = Date.now(); }

  say(text) { this.line = { id: this.line.id + 1, text }; }

  setTimer(ms, fn) {
    this.clearTimer();
    this.deadline = Date.now() + ms;
    this.timerTotal = ms;
    this.pendingNext = fn;
    this.timer = setTimeout(() => { this.pendingNext = null; this.timer = null; fn(); }, ms);
  }

  clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pendingNext = null;
    this.deadline = 0;
    this.timerTotal = 0;
  }

  /** Passe immédiatement à l'étape suivante (bouton « Suivant » de l'hôte). */
  skip() {
    const fn = this.pendingNext;
    if (!fn) return;
    this.clearTimer();
    fn();
  }

  connectedPlayers() { return [...this.players.values()].filter((p) => p.connected); }

  publicPlayer(p) { return { id: p.id, name: p.name, avatar: p.avatar, color: p.color }; }

  ranking() {
    const order = [...this.players.values()].sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt);
    let rank = 0; let lastScore = null;
    return order.map((p, i) => {
      if (p.score !== lastScore) { rank = i + 1; lastScore = p.score; }
      const prev = this.snapshot.get(p.id);
      return { ...this.publicPlayer(p), score: p.score, rank, prevRank: prev ? prev.rank : i + 1, prevScore: prev ? prev.score : 0 };
    });
  }

  takeSnapshot() {
    this.snapshot = new Map(this.ranking().map((r) => [r.id, { rank: r.rank, score: r.score }]));
  }

  // ---------- joueurs ----------
  addPlayer(name, avatar, socketId) {
    if (this.players.size >= MAX_PLAYERS) return { error: 'Le plateau est complet (12 joueurs max).' };
    const lower = name.toLowerCase();
    if ([...this.players.values()].some((p) => p.name.toLowerCase() === lower)) {
      return { error: 'Ce prénom est déjà pris sur le plateau, ajoute une initiale !' };
    }
    const used = new Set([...this.players.values()].map((p) => p.color));
    const color = COLORS.find((c) => !used.has(c)) || COLORS[this.players.size % COLORS.length];
    const p = {
      id: shortId(), token: token(), name, avatar, color, score: 0, streak: 0,
      socketId, connected: true, joinedAt: Date.now(), disconnectedAt: 0,
    };
    this.players.set(p.id, p);
    if (this.phase === 'writing') this.assignPrompts([p]);
    if (this.phase === 'lobby') this.say(animator.playerJoined(name));
    this.touch();
    this.sync();
    return { player: p };
  }

  resumePlayer(pid, tok, socketId) {
    const p = this.players.get(pid);
    if (!p || p.token !== tok) return null;
    p.socketId = socketId;
    p.connected = true;
    p.disconnectedAt = 0;
    this.touch();
    this.sync();
    return p;
  }

  disconnectSocket(socketId) {
    if (this.hostSocket === socketId) this.hostSocket = null;
    for (const p of this.players.values()) {
      if (p.socketId === socketId) {
        p.connected = false;
        p.disconnectedAt = Date.now();
        this.checkAllDone();
      }
    }
    this.sync();
  }

  kick(pid) {
    const p = this.players.get(pid);
    if (!p) return;
    if (p.connected && p.socketId) this.send(p.socketId, 'kicked', {});
    this.players.delete(pid);
    this.writings.delete(pid);
    this.sync();
  }

  /** Nettoyage périodique : au salon d'attente, on retire les joueurs partis depuis plus d'une minute. */
  tick() {
    if (this.phase !== 'lobby') return;
    let changed = false;
    for (const p of this.players.values()) {
      if (!p.connected && Date.now() - p.disconnectedAt > 60_000) { this.players.delete(p.id); changed = true; }
    }
    if (changed) this.sync();
  }

  // ---------- réglages / démarrage ----------
  updateSettings(s) {
    if (this.phase !== 'lobby' || !s || typeof s !== 'object') return;
    if (s.mode === 'local' || s.mode === 'remote') this.settings.mode = s.mode;
    if ([5, 8, 12].includes(s.quizCount)) this.settings.quizCount = s.quizCount;
    if (Array.isArray(s.categories)) {
      const cats = s.categories.filter((c) => CATEGORIES[c]);
      if (cats.length) this.settings.categories = [...new Set(cats)];
    }
    if (typeof s.whoSaid === 'boolean') this.settings.whoSaid = s.whoSaid;
    this.sync();
  }

  start() {
    if (this.phase !== 'lobby') return;
    if (this.connectedPlayers().length < 1) return;
    for (const p of this.players.values()) { p.score = 0; p.streak = 0; }
    // Classement de départ : ordre d'arrivée (sinon tout le monde serait 1er ex aequo à 0 point).
    this.snapshot = new Map([...this.players.values()].map((p, i) => [p.id, { rank: i + 1, score: 0 }]));
    this.writings = new Map();
    this.buildQuiz();
    this.touch();
    if (this.settings.whoSaid) this.goWriting();
    else this.goRoundIntro('quiz');
  }

  restart() {
    this.clearTimer();
    if (this.lineTimer) clearTimeout(this.lineTimer);
    for (const p of [...this.players.values()]) {
      if (!p.connected) this.players.delete(p.id);
      else { p.score = 0; p.streak = 0; }
    }
    this.phase = 'lobby';
    this.data = {};
    this.say('On remet ça ? Les stars sont prêtes, le public aussi !');
    this.sync();
  }

  /** L'hôte peut abréger la partie et passer directement à la finale. */
  endNow() {
    if (this.phase === 'lobby' || this.phase === 'final') return;
    this.clearTimer();
    this.goFinal();
  }

  // ---------- écriture anonyme (préparation de « Qui a osé dire ça ? ») ----------
  assignPrompts(players) {
    const pool = shuffle(PROMPTS);
    let k = (this.assign.size * 2) % pool.length;
    for (const p of players) {
      this.assign.set(p.id, [pool[k % pool.length], pool[(k + 1) % pool.length]]);
      k += 2;
    }
  }

  goWriting() {
    this.phase = 'writing';
    this.data = {};
    this.assign = new Map();
    this.assignPrompts([...this.players.values()]);
    this.say(animator.writingIntro());
    this.setTimer(DURATIONS.writing, () => this.goRoundIntro('quiz'));
    this.sync();
  }

  submitWriting(pid, answers) {
    if (this.phase !== 'writing' || !this.assign.has(pid) || this.writings.has(pid)) return;
    if (!Array.isArray(answers)) return;
    const clean = answers.slice(0, 2).map((a) => sanitizeText(a, 80));
    this.writings.set(pid, clean);
    this.touch();
    this.checkAllDone();
    this.sync();
  }

  // ---------- intros de manche ----------
  goRoundIntro(round) {
    this.clearTimer();
    if (round === 'whosaid') {
      this.whoItems = this.buildWhoItems();
      if (this.whoItems.length === 0 || this.players.size < 2) {
        this.phase = 'roundIntro';
        this.data = { round, num: 2, title: 'Qui a osé dire ça ?', subtitle: 'Manche annulée, faute de réponses…', icon: '🤫' };
        this.say(animator.whoSaidSkip());
        this.setTimer(5_000, () => this.goFinal());
        this.sync();
        return;
      }
    }
    this.phase = 'roundIntro';
    if (round === 'quiz') {
      this.data = { round, num: 1, title: 'Le Grand Quiz', subtitle: 'Bonne réponse = points. Réponse rapide = encore plus de points !', icon: '🧠' };
      this.say(animator.quizIntro());
      this.setTimer(DURATIONS.roundIntro, () => this.nextQuestion());
    } else {
      this.data = { round, num: 2, title: 'Qui a osé dire ça ?', subtitle: 'Devinez qui a écrit chaque réponse. Bluffez pour ne pas être démasqué !', icon: '🤫' };
      this.whoIndex = -1;
      this.say(animator.whoSaidIntro());
      this.setTimer(DURATIONS.roundIntro + 2_000, () => this.nextWho());
    }
    this.sync();
  }

  // ---------- Grand Quiz ----------
  buildQuiz() {
    const cats = this.settings.categories;
    const pool = shuffle(QUESTIONS.filter((q) => cats.includes(q.cat)));
    // Répartition équilibrée : on pioche à tour de rôle dans chaque catégorie.
    const byCat = new Map(cats.map((c) => [c, pool.filter((q) => q.cat === c)]));
    const picked = [];
    while (picked.length < this.settings.quizCount && [...byCat.values()].some((l) => l.length)) {
      for (const c of shuffle(cats)) {
        const l = byCat.get(c);
        if (l.length && picked.length < this.settings.quizCount) picked.push(l.pop());
      }
    }
    this.quiz = {
      i: -1,
      list: picked.map((q) => {
        const order = shuffle([0, 1, 2, 3]);
        return { cat: q.cat, text: q.q, choices: order.map((k) => q.a[k]), correct: order.indexOf(0) };
      }),
    };
  }

  nextQuestion() {
    this.quiz.i++;
    const { i, list } = this.quiz;
    if (i >= list.length) {
      const after = this.settings.whoSaid ? () => this.goRoundIntro('whosaid') : () => this.goFinal();
      this.goLeaderboard('Fin du Grand Quiz !', after);
      return;
    }
    const q = list[i];
    this.phase = 'quizQuestion';
    this.data = { index: i + 1, total: list.length, ...q, answers: new Map(), startedAt: Date.now() };
    this.say(animator.question(i + 1, list.length, CATEGORIES[q.cat].label));
    this.setTimer(DURATIONS.question, () => this.revealQuestion());
    this.sync();
  }

  answer(pid, choice) {
    if (this.phase !== 'quizQuestion') return;
    if (!this.players.has(pid) || this.data.answers.has(pid)) return;
    if (!Number.isInteger(choice) || choice < 0 || choice > 3) return;
    this.data.answers.set(pid, { choice, ms: Date.now() - this.data.startedAt });
    this.touch();
    this.checkAllDone();
    this.sync();
  }

  revealQuestion() {
    this.clearTimer();
    const d = this.data;
    const results = [];
    for (const p of this.players.values()) {
      const a = d.answers.get(p.id);
      const correct = !!a && a.choice === d.correct;
      let gained = 0;
      if (correct) {
        const speed = Math.min(a.ms, DURATIONS.question) / DURATIONS.question;
        p.streak++;
        gained = Math.round(1000 - 500 * speed) + Math.min(p.streak - 1, 3) * 100;
      } else {
        p.streak = 0;
      }
      p.score += gained;
      results.push({ id: p.id, choice: a ? a.choice : null, ms: a ? a.ms : null, correct, gained, streak: p.streak });
    }
    const winners = results.filter((r) => r.correct).sort((a, b) => a.ms - b.ms);
    if (winners.length === 0) this.say(animator.allWrong());
    else if (winners.length === results.length && results.length > 1) this.say(animator.allRight());
    else this.say(animator.fastest(this.players.get(winners[0].id).name));

    const counts = [0, 0, 0, 0];
    for (const a of d.answers.values()) counts[a.choice]++;
    this.phase = 'quizReveal';
    this.data = { ...d, results, counts };
    const isLast = this.quiz.i + 1 >= this.quiz.list.length;
    const showBoard = !isLast && (this.quiz.i + 1) % LEADERBOARD_EVERY === 0;
    this.setTimer(DURATIONS.quizReveal, () => (showBoard
      ? this.goLeaderboard('Classement provisoire', () => this.nextQuestion())
      : this.nextQuestion()));
    this.sync();
  }

  // ---------- classement ----------
  goLeaderboard(title, after) {
    this.clearTimer();
    this.phase = 'leaderboard';
    const ranking = this.ranking();
    this.data = { title, ranking };
    if (ranking.length > 1) this.say(animator.leaderboard(ranking[0].name, ranking[ranking.length - 1].name));
    else if (ranking.length === 1) this.say(`${ranking[0].name}, seul en scène et déjà en tête !`);
    this.takeSnapshot();
    this.setTimer(DURATIONS.leaderboard, after);
    this.sync();
  }

  // ---------- Qui a osé dire ça ? ----------
  buildWhoItems() {
    const items = [];
    for (const [pid, answers] of this.writings) {
      if (!this.players.has(pid)) continue;
      const prompts = this.assign.get(pid) || [];
      answers.forEach((text, k) => { if (text && prompts[k]) items.push({ prompt: prompts[k], text, authorId: pid }); });
    }
    // Au plus 2 réponses par joueur, puis on évite que le même auteur passe deux fois de suite.
    let list = shuffle(items).slice(0, WHO_MAX_ITEMS);
    for (let tries = 0; tries < 20; tries++) {
      if (list.every((it, k) => k === 0 || it.authorId !== list[k - 1].authorId)) break;
      list = shuffle(list);
    }
    return list;
  }

  nextWho() {
    this.whoIndex++;
    if (this.whoIndex >= this.whoItems.length) {
      this.goLeaderboard('Avant la Grande Finale…', () => this.goFinal());
      return;
    }
    const it = this.whoItems[this.whoIndex];
    this.phase = 'whoVote';
    this.data = { index: this.whoIndex + 1, total: this.whoItems.length, ...it, votes: new Map() };
    this.say(animator.whoSaidItem());
    this.setTimer(DURATIONS.whoVote, () => this.revealWho());
    this.sync();
    if (this.whoVoters().length === 0) this.setTimer(4_000, () => this.revealWho());
  }

  whoVoters() { return this.connectedPlayers().filter((p) => p.id !== this.data.authorId); }

  vote(pid, target) {
    if (this.phase !== 'whoVote') return;
    if (pid === this.data.authorId || !this.players.has(pid) || this.data.votes.has(pid)) return;
    if (target === pid || !this.players.has(target)) return;
    this.data.votes.set(pid, target);
    this.touch();
    this.checkAllDone();
    this.sync();
  }

  revealWho() {
    this.clearTimer();
    const d = this.data;
    const author = this.players.get(d.authorId);
    const results = [];
    let found = 0; let fooled = 0;
    for (const [voter, target] of d.votes) {
      const p = this.players.get(voter);
      if (!p) continue;
      const correct = target === d.authorId;
      const gained = correct ? 500 : 0;
      if (correct) found++; else fooled++;
      p.score += gained;
      results.push({ id: voter, target, correct, gained });
    }
    const authorGain = fooled * 200;
    if (author) author.score += authorGain;
    this.say(animator.whoSaidReveal(author ? author.name : 'un mystère', found, fooled));
    this.phase = 'whoReveal';
    this.data = { ...d, results, authorGain, found, fooled };
    this.setTimer(DURATIONS.whoReveal, () => this.nextWho());
    this.sync();
  }

  // ---------- Grande Finale ----------
  goFinal() {
    this.clearTimer();
    this.phase = 'final';
    const ranking = this.ranking();
    this.data = { ranking };
    this.say(animator.finalIntro());
    if (this.lineTimer) clearTimeout(this.lineTimer);
    if (ranking.length) {
      this.lineTimer = setTimeout(() => {
        if (this.phase !== 'final') return;
        const top = ranking.filter((r) => r.rank === 1).map((r) => r.name);
        this.say(top.length > 1 ? `Égalité parfaite ! ${top.join(' et ')} se partagent la couronne !` : animator.champion(top[0]));
        this.sync();
      }, DURATIONS.podium);
    }
    this.sync();
  }

  // ---------- « tout le monde a répondu ? » ----------
  checkAllDone() {
    const connected = this.connectedPlayers();
    if (this.phase === 'writing') {
      if (connected.length && connected.every((p) => this.writings.has(p.id))) {
        this.setTimer(1_500, () => this.goRoundIntro('quiz'));
      }
    } else if (this.phase === 'quizQuestion') {
      if (connected.length && connected.every((p) => this.data.answers.has(p.id))) this.setTimer(800, () => this.revealQuestion());
    } else if (this.phase === 'whoVote') {
      const voters = this.whoVoters();
      if (voters.length && voters.every((p) => this.data.votes.has(p.id))) this.setTimer(800, () => this.revealWho());
    }
  }

  // ---------- vues envoyées aux clients ----------
  timing() {
    return this.deadline ? { remainingMs: Math.max(0, this.deadline - Date.now()), totalMs: this.timerTotal } : { remainingMs: 0, totalMs: 0 };
  }

  hostView() {
    const d = this.data;
    const base = {
      role: 'host', code: this.code, phase: this.phase, settings: this.settings, line: this.line, ...this.timing(),
      canSkip: !!this.pendingNext,
      players: [...this.players.values()].map((p) => ({ ...this.publicPlayer(p), score: p.score, connected: p.connected })),
      categories: CATEGORIES,
    };
    switch (this.phase) {
      case 'writing':
        return { ...base, done: [...this.writings.keys()] };
      case 'roundIntro':
        return { ...base, round: d };
      case 'quizQuestion':
        return { ...base, q: { index: d.index, total: d.total, cat: d.cat, text: d.text, choices: d.choices }, answered: [...d.answers.keys()] };
      case 'quizReveal':
        return { ...base, q: { index: d.index, total: d.total, cat: d.cat, text: d.text, choices: d.choices }, correct: d.correct, counts: d.counts, results: d.results };
      case 'leaderboard':
        return { ...base, title: d.title, ranking: d.ranking };
      case 'whoVote':
        return { ...base, who: { index: d.index, total: d.total, prompt: d.prompt, text: d.text }, voted: [...d.votes.keys()], voters: this.whoVoters().map((p) => p.id) };
      case 'whoReveal':
        return { ...base, who: { index: d.index, total: d.total, prompt: d.prompt, text: d.text }, authorId: d.authorId, results: d.results, authorGain: d.authorGain, found: d.found, fooled: d.fooled };
      case 'final':
        return { ...base, ranking: d.ranking };
      default:
        return base;
    }
  }

  playerView(p) {
    const d = this.data;
    const rank = this.ranking().find((r) => r.id === p.id);
    const base = {
      role: 'player', code: this.code, phase: this.phase, mode: this.settings.mode, ...this.timing(),
      me: { ...this.publicPlayer(p), score: p.score, rank: rank ? rank.rank : null },
      playerCount: this.players.size,
      line: this.settings.mode === 'remote' ? this.line : null,
    };
    switch (this.phase) {
      case 'lobby':
        return { ...base, players: [...this.players.values()].map((x) => this.publicPlayer(x)) };
      case 'writing':
        return { ...base, prompts: this.assign.get(p.id) || [], submitted: this.writings.has(p.id) };
      case 'roundIntro':
        return { ...base, round: d };
      case 'quizQuestion': {
        const a = d.answers.get(p.id);
        return { ...base, q: { index: d.index, total: d.total, cat: d.cat, text: d.text, choices: d.choices }, myAnswer: a ? a.choice : null };
      }
      case 'quizReveal':
        return { ...base, q: { index: d.index, total: d.total, cat: d.cat, text: d.text, choices: d.choices }, correct: d.correct, myResult: d.results.find((r) => r.id === p.id) || null };
      case 'leaderboard':
        return { ...base, title: d.title, ranking: d.ranking };
      case 'whoVote':
        return {
          ...base, who: { index: d.index, total: d.total, prompt: d.prompt, text: d.text }, isAuthor: d.authorId === p.id,
          candidates: [...this.players.values()].filter((x) => x.id !== p.id).map((x) => this.publicPlayer(x)),
          myVote: d.votes.get(p.id) || null,
        };
      case 'whoReveal': {
        const author = this.players.get(d.authorId);
        return {
          ...base, who: { index: d.index, total: d.total, prompt: d.prompt, text: d.text }, isAuthor: d.authorId === p.id,
          author: author ? this.publicPlayer(author) : null, authorGain: d.authorGain,
          myResult: d.results.find((r) => r.id === p.id) || null,
        };
      }
      case 'final':
        return { ...base, ranking: d.ranking };
      default:
        return base;
    }
  }

  sync() {
    if (this.hostSocket) this.send(this.hostSocket, 'state', this.hostView());
    for (const p of this.players.values()) {
      if (p.connected && p.socketId) this.send(p.socketId, 'state', this.playerView(p));
    }
  }

  destroy() {
    this.clearTimer();
    if (this.lineTimer) clearTimeout(this.lineTimer);
  }
}

/** Nettoie un texte saisi par un joueur : pas de caractères de contrôle, longueur bornée. */
function sanitizeText(value, max) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f​-‏‪-‮]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

module.exports = { Room, sanitizeText, MAX_PLAYERS, DURATIONS };

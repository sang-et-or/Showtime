// Un salon de jeu = une machine à états, entièrement pilotée par le serveur.
// Les clients (écran hôte, téléphones) ne font qu'afficher l'état reçu et envoyer des actions :
// impossible de tricher en modifiant le navigateur, et un joueur qui se reconnecte
// retrouve exactement l'état courant.
//
// Le salon gère ce qui est commun à tous les jeux (joueurs, minuteur, intros de manche,
// classements, podium final). Chaque jeu est un module du dossier `rounds/` qui possède
// ses propres phases : le salon lui transmet les actions des joueurs et lui demande quoi afficher.

const animator = require('./animator');
const { CATEGORIES } = require('./content/questions');
const { ROUNDS, SHOW_ROUNDS, QUICK_GAMES, ownerOf } = require('./rounds');
const { token, shortId } = require('./util');

const MAX_PLAYERS = 12;
const LENGTHS = ['short', 'normal', 'long'];
const DURATIONS = { roundIntro: 7_000, leaderboard: 7_000, podium: 7_000 };
const COLORS = ['#ff3d8b', '#22d3ee', '#facc15', '#a3e635', '#c084fc', '#fb923c', '#f87171', '#34d399', '#60a5fa', '#f472b6', '#fde047', '#2dd4bf'];

class Room {
  /** @param {string} code @param {(socketId: string, event: string, payload: any) => void} send */
  constructor(code, send) {
    this.code = code;
    this.send = send;
    this.hostToken = token();
    this.hostSocket = null;
    this.players = new Map();
    this.settings = {
      mode: 'local', // 'local' (même pièce) | 'remote' (à distance)
      format: 'show', // 'show' (Grand Show) | 'quick' (partie rapide)
      rounds: Object.fromEntries(SHOW_ROUNDS.map((id) => [id, true])),
      game: QUICK_GAMES[0],
      length: 'normal',
      categories: Object.keys(CATEGORIES),
    };
    this.phase = 'lobby';
    this.data = {};
    this.ctx = {}; // mémoire partagée par les modules pendant une partie
    this.program = [];
    this.roundIndex = -1;
    this.manche = 0;
    this.timer = null;
    this.lineTimer = null;
    this.deadline = 0;
    this.timerTotal = 0;
    this.timerVisible = false;
    this.pendingNext = null;
    this.line = { id: 0, text: '' };
    this.snapshot = new Map(); // pid -> { rank, score } au dernier classement affiché
    this.createdAt = Date.now(); // servira à la limite de découverte gratuite (≈ 15 min)
    this.lastActivity = Date.now();
    this.say(animator.welcome());
  }

  // ---------- utilitaires pour les modules ----------
  touch() { this.lastActivity = Date.now(); }

  say(text) { this.line = { id: this.line.id + 1, text }; }

  /** Change de phase (sans envoyer : l'appelant termine par `sync()`). */
  enter(phase, data = {}) {
    this.phase = phase;
    this.data = data;
  }

  /** Programme la suite. `visible` affiche le compte à rebours sur les écrans. */
  setTimer(ms, fn, visible = false) {
    this.clearTimer();
    this.deadline = Date.now() + ms;
    this.timerTotal = ms;
    this.timerVisible = visible;
    this.pendingNext = fn;
    this.timer = setTimeout(() => { this.pendingNext = null; this.timer = null; fn(); }, ms);
  }

  clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pendingNext = null;
    this.deadline = 0;
    this.timerTotal = 0;
    this.timerVisible = false;
  }

  /** Raccourcit le minuteur en cours sans changer ce qui suit (ex. « STOP ! » au Petit Bac). */
  shortenTimer(ms) {
    if (!this.pendingNext || this.deadline - Date.now() <= ms) return;
    this.setTimer(ms, this.pendingNext, this.timerVisible);
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

  pub(pid) { const p = this.players.get(pid); return p ? this.publicPlayer(p) : null; }

  addScore(pid, points) {
    const p = this.players.get(pid);
    if (p) p.score = Math.max(0, p.score + points);
  }

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

  current() { return ownerOf(this.phase); }

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
    if (this.phase === 'lobby') this.say(animator.playerJoined(name));
    const mod = this.current();
    if (mod && mod.onJoin) mod.onJoin(this, p);
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
        this.check();
      }
    }
    this.sync();
  }

  kick(pid) {
    const p = this.players.get(pid);
    if (!p) return;
    if (p.connected && p.socketId) this.send(p.socketId, 'kicked', {});
    this.players.delete(pid);
    this.check();
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

  /** Action d'un joueur : transmise au jeu en cours. */
  act(p, msg) {
    const mod = this.current();
    if (!mod || !mod.act || typeof msg.type !== 'string') return;
    this.touch();
    mod.act(this, p, msg);
  }

  /** Demande au jeu en cours si tout le monde a fini (après une déconnexion par exemple). */
  check() {
    const mod = this.current();
    if (mod && mod.check) mod.check(this);
  }

  // ---------- réglages / démarrage ----------
  updateSettings(s) {
    if (this.phase !== 'lobby' || !s || typeof s !== 'object') return;
    const se = this.settings;
    if (s.mode === 'local' || s.mode === 'remote') se.mode = s.mode;
    if (s.format === 'show' || s.format === 'quick') se.format = s.format;
    if (QUICK_GAMES.includes(s.game)) se.game = s.game;
    if (LENGTHS.includes(s.length)) se.length = s.length;
    if (s.rounds && typeof s.rounds === 'object') {
      const next = { ...se.rounds };
      for (const id of SHOW_ROUNDS) if (typeof s.rounds[id] === 'boolean') next[id] = s.rounds[id];
      if (Object.values(next).some(Boolean)) se.rounds = next;
    }
    if (Array.isArray(s.categories)) {
      const cats = s.categories.filter((c) => CATEGORIES[c]);
      if (cats.length) se.categories = [...new Set(cats)];
    }
    this.sync();
  }

  buildProgram() {
    const se = this.settings;
    if (se.format === 'quick') return [se.game];
    const list = SHOW_ROUNDS.filter((id) => se.rounds[id]);
    // « Qui a osé dire ça ? » a besoin des réponses secrètes écrites avant la partie.
    if (list.includes('whosaid')) list.unshift('writing');
    return list;
  }

  start() {
    if (this.phase !== 'lobby') return;
    if (this.connectedPlayers().length < 1) return;
    for (const p of this.players.values()) { p.score = 0; p.streak = 0; }
    // Classement de départ : ordre d'arrivée (sinon tout le monde serait 1er ex aequo à 0 point).
    this.snapshot = new Map([...this.players.values()].map((p, i) => [p.id, { rank: i + 1, score: 0 }]));
    this.ctx = { usedQuestions: new Set() };
    this.program = this.buildProgram();
    this.roundIndex = -1;
    this.manche = 0;
    this.touch();
    this.nextRound();
  }

  /** Lance le jeu suivant du programme (ou la finale s'il n'y en a plus). */
  nextRound() {
    this.clearTimer();
    this.roundIndex++;
    if (this.roundIndex >= this.program.length) { this.goFinal(); return; }
    const mod = ROUNDS[this.program[this.roundIndex]];
    if (mod.prep) { mod.begin(this); return; }

    this.manche++;
    const quick = this.settings.format === 'quick';
    const base = { id: mod.id, num: this.manche, title: mod.title, icon: mod.icon, quick };
    const why = mod.cannotPlay ? mod.cannotPlay(this) : null;
    this.enter('roundIntro', { ...base, subtitle: why || mod.subtitle, cancelled: !!why });
    if (why) {
      this.manche--;
      this.say(`Oh non… ${why}`);
      this.setTimer(5_000, () => this.nextRound());
    } else {
      this.say(mod.introLine(this));
      this.setTimer(DURATIONS.roundIntro + (mod.introExtraMs || 0), () => mod.begin(this));
    }
    this.sync();
  }

  /** Appelé par un module quand son jeu est terminé. */
  finishRound() {
    this.clearTimer();
    const remaining = this.program.slice(this.roundIndex + 1).some((id) => !ROUNDS[id].prep);
    const mod = ROUNDS[this.program[this.roundIndex]];
    if (mod.prep || !remaining) { this.nextRound(); return; }
    this.goLeaderboard(`Après « ${mod.title} »`, () => this.nextRound());
  }

  restart() {
    this.clearTimer();
    if (this.lineTimer) clearTimeout(this.lineTimer);
    for (const p of [...this.players.values()]) {
      if (!p.connected) this.players.delete(p.id);
      else { p.score = 0; p.streak = 0; }
    }
    this.enter('lobby');
    this.ctx = {};
    this.say('On remet ça ? Choisissez votre programme, les stars sont prêtes !');
    this.sync();
  }

  /** L'hôte peut abréger la partie et passer directement à la finale. */
  endNow() {
    if (this.phase === 'lobby' || this.phase === 'final') return;
    this.clearTimer();
    this.goFinal();
  }

  // ---------- classement ----------
  goLeaderboard(title, after) {
    this.clearTimer();
    const ranking = this.ranking();
    this.enter('leaderboard', { title, ranking });
    if (ranking.length > 1) this.say(animator.leaderboard(ranking[0].name, ranking[ranking.length - 1].name));
    else if (ranking.length === 1) this.say(`${ranking[0].name}, seul en scène et déjà en tête !`);
    this.takeSnapshot();
    this.setTimer(DURATIONS.leaderboard, after);
    this.sync();
  }

  // ---------- Grande Finale ----------
  goFinal() {
    this.clearTimer();
    const ranking = this.ranking();
    this.enter('final', { ranking });
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

  // ---------- vues envoyées aux clients ----------
  timing() {
    if (!this.deadline) return { remainingMs: 0, totalMs: 0, timer: false };
    return { remainingMs: Math.max(0, this.deadline - Date.now()), totalMs: this.timerTotal, timer: this.timerVisible };
  }

  hostView() {
    const d = this.data;
    const base = {
      role: 'host', code: this.code, phase: this.phase, key: this.phase, settings: this.settings, line: this.line, ...this.timing(),
      canSkip: !!this.pendingNext,
      players: [...this.players.values()].map((p) => ({ ...this.publicPlayer(p), score: p.score, connected: p.connected })),
      categories: CATEGORIES,
    };
    switch (this.phase) {
      case 'lobby': return { ...base, catalog: catalog() };
      case 'roundIntro': return { ...base, key: `roundIntro:${this.roundIndex}`, round: d };
      case 'leaderboard': return { ...base, key: `leaderboard:${d.title}`, title: d.title, ranking: d.ranking };
      case 'final': return { ...base, ranking: d.ranking };
      default: {
        const mod = this.current();
        return mod ? { ...base, game: { id: mod.id, title: mod.title, icon: mod.icon }, ...mod.hostView(this) } : base;
      }
    }
  }

  playerView(p) {
    const d = this.data;
    const rank = this.ranking().find((r) => r.id === p.id);
    const base = {
      role: 'player', code: this.code, phase: this.phase, key: this.phase, mode: this.settings.mode, ...this.timing(),
      me: { ...this.publicPlayer(p), score: p.score, rank: rank ? rank.rank : null },
      playerCount: this.players.size,
      line: this.settings.mode === 'remote' ? this.line : null,
    };
    switch (this.phase) {
      case 'lobby': return { ...base, players: [...this.players.values()].map((x) => this.publicPlayer(x)) };
      case 'roundIntro': return { ...base, key: `roundIntro:${this.roundIndex}`, round: d };
      case 'leaderboard': return { ...base, key: `leaderboard:${d.title}`, title: d.title, ranking: d.ranking };
      case 'final': return { ...base, ranking: d.ranking };
      default: {
        const mod = this.current();
        return mod ? { ...base, game: { id: mod.id, title: mod.title, icon: mod.icon }, ...mod.playerView(this, p) } : base;
      }
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

/** Ce que l'écran hôte propose dans le salon : manches du Grand Show et parties rapides. */
function catalog() {
  const info = (id) => {
    const m = ROUNDS[id];
    return { id, title: m.title, icon: m.icon, pitch: m.pitch, min: m.minPlayers || 1 };
  };
  return { show: SHOW_ROUNDS.map(info), quick: QUICK_GAMES.map(info) };
}

module.exports = { Room, MAX_PLAYERS };

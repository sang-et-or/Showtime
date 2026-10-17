// Un salon de jeu = une machine à états, entièrement pilotée par le serveur.
// Les clients (écran hôte, téléphones) ne font qu'afficher l'état reçu et envoyer des actions :
// impossible de tricher en modifiant le navigateur, et un joueur qui se reconnecte
// retrouve exactement l'état courant.
//
// Le salon gère ce qui est commun à tous les jeux (joueurs, minuteur, intros de manche,
// classements, podium final). Chaque jeu est un module du dossier `rounds/` qui possède
// ses propres phases : le salon lui transmet les actions des joueurs et lui demande quoi afficher.

const animator = require('./animator');
const { CATEGORIES, DEFAULT_CATEGORIES, CLUBS } = require('./content/questions');
const { ROUNDS, SHOW_ROUNDS, QUICK_GAMES, BOARD_GAMES, CARD_GAMES, ADULT_GAMES, ownerOf } = require('./rounds');
const { token, shortId } = require('./util');
const { installMemories } = require('./memories');

const crypto = require('crypto');
const MAX_PLAYERS = 12;
const LENGTHS = ['short', 'normal', 'long'];
const DURATIONS = { roundIntro: 7_000, leaderboard: 7_000, podium: 7_000 };
const AUTOSTART_MS = 10_000;
const PAUSE_MAX_MS = Number(process.env.SHOWTIME_PAUSE_MAX_MS) || 50 * 60_000; // au-delà, la partie s'arrête
const ALL_GAMES = [...QUICK_GAMES, ...BOARD_GAMES, ...CARD_GAMES]; // compte à rebours quand tout le monde est prêt
const COLORS = ['#ff3d8b', '#22d3ee', '#facc15', '#a3e635', '#c084fc', '#fb923c', '#f87171', '#34d399', '#60a5fa', '#f472b6', '#fde047', '#2dd4bf'];

class Room {
  /** @param {string} code @param {(socketId: string, event: string, payload: any) => void} send */
  constructor(code, send) {
    this.code = code;
    this.send = send;
    this.hostToken = token();
    this.hostSocket = null;
    this.spectators = new Set(); // téléphones qui affichent l'écran télé
    this.players = new Map();
    this.settings = {
      mode: 'local', // 'local' (même pièce) | 'remote' (à distance)
      format: 'show', // 'show' (Grand Show) | 'quick' (partie rapide)
      rounds: Object.fromEntries(SHOW_ROUNDS.map((id) => [id, true])),
      game: QUICK_GAMES[0],
      length: 'normal',
      categories: [...DEFAULT_CATEGORIES],
      clubs: [], // vide = tous les clubs
      photos: true, // les joueurs peuvent prendre des photos souvenirs
      vote: false, // les joueurs votent pour le jeu (activé d'office à distance)
      coupleLevel: 'douceur', // niveau du jeu de couple « Entre nous »
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
    this.paused = null; // { by, at, until, fn, remaining, total, visible } pendant une pause
    this.pauseTimer = null;
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
    if (this.paused) return;
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

  /** Partie privée (jeu de couple) : rien n'est enregistré, pas de photos. */
  isPrivate() { return this.settings.format === 'quick' && ROUNDS[this.settings.game]?.privateGame === true; }

  gameTitle(id) { const m = ROUNDS[id]; return m && !m.prep ? m.title : null; }

  // ---------- joueurs ----------
  addPlayer(name, avatar, socketId, userId = null) {
    if (this.players.size >= MAX_PLAYERS) return { error: 'Le plateau est complet (12 joueurs max).' };
    const lower = name.toLowerCase();
    if ([...this.players.values()].some((p) => p.name.toLowerCase() === lower)) {
      return { error: 'Ce prénom est déjà pris sur le plateau, ajoute une initiale !' };
    }
    const used = new Set([...this.players.values()].map((p) => p.color));
    const color = COLORS.find((c) => !used.has(c)) || COLORS[this.players.size % COLORS.length];
    const p = {
      id: shortId(), token: token(), name, avatar, color, score: 0, streak: 0,
      socketId, connected: true, joinedAt: Date.now(), disconnectedAt: 0, ready: false, userId,
    };
    this.players.set(p.id, p);
    if (this.phase === 'lobby') this.say(animator.playerJoined(name));
    const mod = this.current();
    if (mod && mod.onJoin) mod.onJoin(this, p);
    this.checkReady(); // un nouvel arrivant pas encore prêt suspend le lancement automatique
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
    this.checkReady();
    this.sync();
    return p;
  }

  /** Un joueur affiche l'écran télé sur son téléphone (mode à distance). */
  addSpectator(socketId, pid, tok) {
    const p = this.players.get(pid);
    if (!p || p.token !== tok) return false;
    this.spectators.add(socketId);
    this.sync();
    return true;
  }

  disconnectSocket(socketId) {
    this.spectators.delete(socketId);
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
    if (msg.type === 'pause') { this.pause(p.name); return; }
    if (msg.type === 'resume') { this.resume(p.name); return; }
    if (this.paused) return; // tout est figé pendant la pause
    if (this.phase === 'lobby') {
      if (msg.type === 'ready') { p.ready = !!msg.on; this.touch(); this.checkReady(); this.sync(); }
      if (msg.type === 'voteGame' && this.settings.vote && (msg.game === 'show' || ALL_GAMES.includes(msg.game))) { p.vote = msg.game; this.touch(); this.sync(); }
      if (msg.type === 'voteThemes' && this.settings.vote && Array.isArray(msg.themes)) {
        p.themeVotes = [...new Set(msg.themes.filter((k) => this.votableThemes().includes(k)))].slice(0, 5);
        this.touch(); this.sync();
      }
      return;
    }
    const mod = this.current();
    if (!mod || !mod.act || typeof msg.type !== 'string') return;
    this.touch();
    mod.act(this, p, msg);
  }

  /** Demande au jeu en cours si tout le monde a fini (après une déconnexion par exemple). */
  check() {
    if (this.phase === 'lobby') { this.checkReady(); return; }
    if (this.paused) return;
    const mod = this.current();
    if (mod && mod.check) mod.check(this);
  }

  // ---------- vote des joueurs pour le jeu ----------
  /** Décompte des votes des joueurs connectés, du plus voté au moins voté. */
  voteTally() {
    const counts = new Map();
    for (const p of this.connectedPlayers()) if (p.vote) counts.set(p.vote, (counts.get(p.vote) || 0) + 1);
    return [...counts.entries()].map(([id, n]) => ({ id, n, title: id === 'show' ? 'Le Grand Show' : ROUNDS[id].title, icon: id === 'show' ? '🎬' : ROUNDS[id].icon }))
      .sort((a, b) => b.n - a.n);
  }

  /** Thèmes de quiz proposables au vote : le thème adulte seulement si l'hôte l'a lui-même autorisé. */
  votableThemes() {
    return Object.keys(CATEGORIES).filter((k) => !CATEGORIES[k].adult || this.settings.categories.includes(k));
  }

  themeTally() {
    const counts = new Map();
    for (const p of this.connectedPlayers()) for (const k of p.themeVotes || []) counts.set(k, (counts.get(k) || 0) + 1);
    return [...counts.entries()].map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n);
  }

  /** Au lancement : le jeu le plus voté l'emporte (tirage au sort en cas d'égalité). */
  applyVote() {
    if (!this.settings.vote) return;
    const tally = this.voteTally();
    if (!tally.length) return;
    const best = tally.filter((t) => t.n === tally[0].n);
    const win = best[crypto.randomInt(best.length)];
    // Thèmes du quiz : les plus demandés par les joueurs (jusqu'à 6).
    const themes = this.themeTally();
    if (themes.length && (win.id === 'quiz' || win.id === 'show')) this.settings.categories = themes.slice(0, 6).map((t) => t.id);
    if (win.id === 'show') this.settings.format = 'show';
    else { this.settings.format = 'quick'; this.settings.game = win.id; }
    this.voteNote = best.length > 1 ? `Égalité dans les votes ! Le tirage au sort désigne… ${win.title} !` : `Les joueurs ont voté : place à ${win.title} !`;
  }

  // ---------- « Je suis prêt » et lancement automatique ----------
  /** Nombre minimum de joueurs pour le programme choisi. */
  neededPlayers() {
    const top = this.settings.vote ? this.voteTally()[0] : null;
    if (top) return top.id === 'show' ? 1 : (ROUNDS[top.id].minPlayers || 1);
    return this.settings.format === 'quick' ? (ROUNDS[this.settings.game].minPlayers || 1) : 1;
  }

  /** Quand tous les joueurs connectés sont prêts : compte à rebours puis lancement automatique. */
  checkReady() {
    if (this.phase !== 'lobby') return;
    const c = this.connectedPlayers();
    const all = c.length > 0 && c.length >= this.neededPlayers() && c.every((p) => p.ready);
    if (all && !this.autoStart) {
      this.autoStart = true;
      this.say(animator.allReady(c.length));
      this.setTimer(AUTOSTART_MS, () => { this.autoStart = false; this.start(); }, true);
    } else if (!all && this.autoStart) {
      this.autoStart = false;
      this.clearTimer();
      const late = c.filter((p) => !p.ready).map((p) => p.name);
      this.say(late.length ? animator.readyWait(late.join(', ')) : 'On attend encore un peu…');
    }
  }

  /** L'hôte relance les retardataires : leur téléphone vibre et sonne. */
  nudge() {
    if (this.phase !== 'lobby') return;
    const late = this.connectedPlayers().filter((p) => !p.ready);
    if (!late.length) return;
    late.forEach((p) => this.send(p.socketId, 'nudge', {}));
    this.say(animator.nudge(late.map((p) => p.name).join(', ')));
    this.sync();
  }

  /** L'hôte arrête le compte à rebours : chacun devra se redéclarer prêt. */
  cancelAutoStart() {
    if (this.phase !== 'lobby' || !this.autoStart) return;
    this.autoStart = false;
    this.clearTimer();
    for (const p of this.players.values()) p.ready = false;
    this.say('Lancement annulé ! Prenez votre temps, et dites-moi quand vous êtes prêts.');
    this.sync();
  }

  // ---------- réglages / démarrage ----------
  updateSettings(s) {
    if (this.phase !== 'lobby' || !s || typeof s !== 'object') return;
    const se = this.settings;
    if ((s.mode === 'local' || s.mode === 'remote') && s.mode !== se.mode) { se.mode = s.mode; se.vote = s.mode === 'remote'; }
    if (s.format === 'show' || s.format === 'quick') se.format = s.format;
    if (QUICK_GAMES.includes(s.game) || BOARD_GAMES.includes(s.game) || CARD_GAMES.includes(s.game) || ADULT_GAMES.includes(s.game)) se.game = s.game;
    if (['douceur', 'complicite', 'audace'].includes(s.coupleLevel)) se.coupleLevel = s.coupleLevel;
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
    if (Array.isArray(s.clubs)) se.clubs = [...new Set(s.clubs.filter((c) => CLUBS[c]))];
    if (typeof s.photos === 'boolean') se.photos = s.photos;
    if (typeof s.vote === 'boolean') se.vote = s.vote;
    this.checkReady();
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
    this.autoStart = false;
    this.applyVote();
    for (const p of this.players.values()) { p.score = 0; p.streak = 0; p.ready = false; p.vote = null; p.themeVotes = []; }
    // Classement de départ : ordre d'arrivée (sinon tout le monde serait 1er ex aequo à 0 point).
    this.snapshot = new Map([...this.players.values()].map((p, i) => [p.id, { rank: i + 1, score: 0 }]));
    this.ctx = { usedQuestions: new Set() };
    this.program = this.buildProgram();
    if (!this.isPrivate()) this.ensureSoiree(); // la soirée entre dans l'historique des joueurs connectés
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
      this.say(this.voteNote ? `${this.voteNote} ${mod.introLine(this)}` : mod.introLine(this));
      this.voteNote = null;
      this.setTimer(DURATIONS.roundIntro + (mod.introExtraMs || 0), () => mod.begin(this));
    }
    this.sync();
  }

  /** Appelé par un module quand son jeu est terminé. */
  finishRound() {
    this.clearTimer();
    const remaining = this.program.slice(this.roundIndex + 1).some((id) => !ROUNDS[id].prep);
    const mod = ROUNDS[this.program[this.roundIndex]];
    this.memorizeGame(mod);
    if (mod.prep || !remaining) { this.nextRound(); return; }
    this.goLeaderboard(`Après « ${mod.title} »`, () => this.nextRound());
  }

  // ---------- pause ----------
  /** Chaque joueur (ou l'hôte) peut mettre la partie en pause ; le minuteur en cours est figé. */
  pause(who) {
    if (this.paused || this.phase === 'lobby' || this.phase === 'final') return;
    const now = Date.now();
    this.paused = {
      by: who, at: now, until: now + PAUSE_MAX_MS,
      fn: this.pendingNext, remaining: this.pendingNext ? Math.max(1_500, this.deadline - now) : 0, total: this.timerTotal, visible: this.timerVisible,
    };
    this.clearTimer();
    this.pauseTimer = setTimeout(() => this.pauseExpired(), PAUSE_MAX_MS);
    this.say(`Pause ! ${who} a demandé une pause. Vous avez ${Math.round(PAUSE_MAX_MS / 60_000)} minutes pour reprendre, sinon la partie s’arrête.`);
    this.touch();
    this.sync();
  }

  /** Reprise : le minuteur repart là où il s'était arrêté. */
  resume(who) {
    const pz = this.paused;
    if (!pz) return;
    this.clearPause();
    if (pz.fn) { this.setTimer(pz.remaining, pz.fn, pz.visible); this.timerTotal = Math.max(pz.total, pz.remaining); }
    this.say(`C’est reparti ! ${who} relance la partie.`);
    this.touch();
    this.sync();
  }

  clearPause() {
    if (this.pauseTimer) clearTimeout(this.pauseTimer);
    this.pauseTimer = null;
    this.paused = null;
  }

  /** Personne n'a repris à temps : fin de partie, direction le podium. */
  pauseExpired() {
    this.clearPause();
    if (this.phase === 'lobby' || this.phase === 'final') return;
    this.goFinal();
    this.say(`La pause a duré plus de ${Math.round(PAUSE_MAX_MS / 60_000)} minutes : fin de la partie ! Voici le classement final.`);
    this.sync();
  }

  pauseInfo() {
    const pz = this.paused;
    return pz ? { by: pz.by, remainingMs: Math.max(0, pz.until - Date.now()), maxMs: PAUSE_MAX_MS } : null;
  }

  restart() {
    this.clearPause();
    this.clearTimer();
    if (this.lineTimer) clearTimeout(this.lineTimer);
    for (const p of [...this.players.values()]) {
      if (!p.connected) this.players.delete(p.id);
      else { p.score = 0; p.streak = 0; p.ready = false; p.vote = null; p.themeVotes = []; }
    }
    this.enter('lobby');
    this.ctx = {};
    this.say('On remet ça ? Choisissez votre programme, les stars sont prêtes !');
    this.sync();
  }

  /** L'hôte peut abréger la partie et passer directement à la finale. */
  endNow() {
    if (this.phase === 'lobby' || this.phase === 'final') return;
    this.clearPause();
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
    this.memorizeFinal(ranking);
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
      canSkip: !!this.pendingNext && !this.paused, paused: this.pauseInfo(), canPause: this.phase !== 'lobby' && this.phase !== 'final',
      players: [...this.players.values()].map((p) => ({ ...this.publicPlayer(p), score: p.score, connected: p.connected })),
      categories: CATEGORIES, clubs: CLUBS,
    };
    switch (this.phase) {
      case 'lobby': return { ...base, catalog: catalog(), ready: [...this.players.values()].filter((p) => p.ready).map((p) => p.id), autoStart: !!this.autoStart, needed: this.neededPlayers(), tally: this.voteTally(), voters: this.connectedPlayers().filter((p) => p.vote).length, themeTally: this.themeTally().slice(0, 6).map((t) => ({ ...t, label: CATEGORIES[t.id].label, icon: CATEGORIES[t.id].icon })) };
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
      photos: this.settings.photos && !this.isPrivate(), account: !!p.userId, private: this.isPrivate(),
      paused: this.pauseInfo(), canPause: this.phase !== 'lobby' && this.phase !== 'final',
    };
    switch (this.phase) {
      case 'lobby': {
        const c = this.connectedPlayers();
        const readyCount = c.filter((x) => x.ready).length;
        return {
          ...base, players: [...this.players.values()].map((x) => ({ ...this.publicPlayer(x), ready: x.ready })),
          ready: p.ready, readyCount, total: c.length, othersWaiting: readyCount > 0 && !p.ready, autoStart: !!this.autoStart,
          vote: this.settings.vote ? {
            mine: p.vote || null, tally: this.voteTally(), options: voteOptions(), online: c.length,
            myThemes: p.themeVotes || [], themeTally: this.themeTally(),
            themes: this.votableThemes().map((k) => ({ id: k, label: CATEGORIES[k].label, icon: CATEGORIES[k].icon, group: CATEGORIES[k].group })),
          } : null,
        };
      }
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
    // l'écran télé est envoyé à l'hôte… et aux joueurs à distance qui l'affichent sur leur téléphone
    if (this.hostSocket || this.spectators.size) {
      const view = this.hostView();
      if (this.hostSocket) this.send(this.hostSocket, 'state', view);
      for (const sid of this.spectators) this.send(sid, 'state', { ...view, spectator: true });
    }
    for (const p of this.players.values()) {
      if (p.connected && p.socketId) this.send(p.socketId, 'state', this.playerView(p));
    }
  }

  destroy() {
    this.clearPause();
    this.clearTimer();
    if (this.lineTimer) clearTimeout(this.lineTimer);
  }
}

/** Jeux proposés au vote des joueurs. */
function voteOptions() {
  const info = (id) => ({ id, title: ROUNDS[id].title, icon: ROUNDS[id].icon, min: ROUNDS[id].minPlayers || 1 });
  return [{ id: 'show', title: 'Le Grand Show', icon: '🎬', min: 1 }, ...QUICK_GAMES.map(info), ...BOARD_GAMES.map(info), ...CARD_GAMES.map(info)];
}

/** Ce que l'écran hôte propose dans le salon : manches du Grand Show et parties rapides. */
function catalog() {
  const info = (id) => {
    const m = ROUNDS[id];
    return { id, title: m.title, icon: m.icon, pitch: m.pitch, rules: m.rules || m.subtitle, players: m.players || '', duration: m.duration || '', min: m.minPlayers || 1 };
  };
  return { show: SHOW_ROUNDS.map(info), quick: QUICK_GAMES.map(info), board: BOARD_GAMES.map(info), cards: CARD_GAMES.map(info), adult: ADULT_GAMES.map(info), coupleLevels: ROUNDS.couple.LEVELS, themes: CATEGORIES, clubs: CLUBS };
}

installMemories(Room);

module.exports = { Room, MAX_PLAYERS, catalog };

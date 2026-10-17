// Mémoire des soirées : enregistre chaque partie jouée, les classements, et fabrique automatiquement
// des « cartes souvenirs » (podium, bluff de la soirée, plus gros pot…). Les joueurs connectés à un compte
// retrouvent tout dans leur historique, avec les photos prises pendant la soirée.
// Tout est fait en arrière-plan : si la base de données est lente ou absente, le jeu continue normalement.
const crypto = require('crypto');
const store = require('./store');

const PHOTO_COOLDOWN_MS = 10_000;
const bg = (promise) => Promise.resolve(promise).catch((e) => console.error('[mémoire]', e.message));

const methods = {
  /** Crée la soirée en base au premier besoin (lancement d'une partie ou première photo). */
  ensureSoiree() {
    if (this.soireePromise) return this.soireePromise;
    const id = crypto.randomUUID();
    this.soireeSummary = { games: [] };
    this.soireePromise = store.createSoiree({ id, code: this.code, startedAt: new Date() }).then(() => { this.soireeId = id; return id; });
    this.soireePromise.catch((e) => { console.error('[mémoire]', e.message); this.soireePromise = null; });
    return this.soireePromise;
  },

  /** Enregistre les joueurs et leurs scores (avec leur compte s'ils sont connectés). */
  saveParticipants(ranking) {
    if (!this.soireePromise || this.isPrivate()) return;
    const ranks = new Map((ranking || this.ranking()).map((r) => [r.id, r.rank]));
    bg(this.soireePromise.then((sid) => Promise.all([...this.players.values()].map((p) => store.upsertParticipant(sid, {
      pkey: p.id, userId: p.userId || null, name: p.name, avatar: p.avatar, score: p.score, rank: ranks.get(p.id) ?? null,
    })))));
  },

  /** Un moment marquant pendant un jeu : on garde le meilleur de chaque type, enregistré à la fin du jeu. */
  highlight(kind, score, card) {
    if (!this.highlights) this.highlights = {};
    const cur = this.highlights[kind];
    if (cur && cur.score >= score) return;
    this.highlights[kind] = { score, ...card, players: (card.players || []).map((id) => this.pub(id)).filter(Boolean) };
  },

  /** Fin d'un jeu : résumé de la partie, classement et souvenirs. */
  memorizeGame(mod) {
    if (!mod || mod.prep || mod.privateGame) { this.highlights = {}; return; }
    const ranking = this.ranking();
    const hl = this.highlights || {};
    this.highlights = {};
    bg(this.ensureSoiree().then(async (sid) => {
      this.soireeSummary.games.push({ id: mod.id, title: mod.title, icon: mod.icon, at: new Date().toISOString(), top: ranking.slice(0, 3).map((r) => ({ name: r.name, avatar: r.avatar, score: r.score })) });
      await store.updateSoiree(sid, { summary: this.soireeSummary });
      for (const [kind, h] of Object.entries(hl)) {
        await store.addSouvenir({ id: crypto.randomUUID(), soireeId: sid, kind, title: h.title, body: h.body || '', payload: { emoji: h.emoji || '✨', game: mod.title, players: h.players } });
      }
    }));
  },

  /** Podium final : une carte souvenir et le classement définitif. */
  memorizeFinal(ranking) {
    if (!ranking.length || this.isPrivate()) return;
    const top = ranking.slice(0, 3).map((r) => ({ name: r.name, avatar: r.avatar, color: r.color, score: r.score, rank: r.rank }));
    const games = (this.program || []).map((id) => this.gameTitle(id)).filter(Boolean);
    bg(this.ensureSoiree().then(async (sid) => {
      this.soireeSummary.final = { top, games, at: new Date().toISOString() };
      await store.updateSoiree(sid, { summary: this.soireeSummary, endedAt: new Date() });
      await store.addSouvenir({ id: crypto.randomUUID(), soireeId: sid, kind: 'podium', title: `Le podium : ${games.join(', ') || 'SHOWTIME'}`, body: `${top[0].name} remporte la soirée avec ${top[0].score.toLocaleString('fr-FR')} points !`, payload: { emoji: '🏆', top } });
    }));
    this.saveParticipants(ranking);
  },

  /** Rattacher un joueur à un compte (connexion après coup). */
  linkPlayerToUser(pid, token, userId) {
    const p = this.players.get(pid);
    if (!p || p.token !== token) return false;
    p.userId = userId;
    if (this.soireePromise) {
      this.saveParticipants();
      bg(this.soireePromise.then((sid) => store.linkPhotosOf(sid, pid, userId)));
    }
    this.sync();
    return true;
  },

  canUploadPhoto(pid) {
    if (!this.photoTimes) this.photoTimes = new Map();
    const last = this.photoTimes.get(pid) || 0;
    if (Date.now() - last < PHOTO_COOLDOWN_MS) return false;
    this.photoTimes.set(pid, Date.now());
    return true;
  },

  /** Nouvelle photo : la télé l'affiche quelques secondes, et elle rejoint les souvenirs de la soirée. */
  onPhoto(id, player) {
    this.photoCount = (this.photoCount || 0) + 1;
    this.saveParticipants();
    const msg = { id, by: this.publicPlayer(player) };
    if (this.hostSocket) this.send(this.hostSocket, 'photo', msg);
    for (const sid of this.spectators) this.send(sid, 'photo', msg);
    this.say(`📸 Clic-clac ! ${player.name} immortalise le moment !`);
    this.sync();
  },
};

function installMemories(Room) {
  Object.assign(Room.prototype, methods);
}

module.exports = { installMemories };

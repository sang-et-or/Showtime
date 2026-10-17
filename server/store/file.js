// Stockage local (fichiers), utilisé quand DATABASE_URL n'est pas défini : pratique pour tester chez soi.
// Les données vont dans le dossier data/ (ignoré par Git). Même interface que le stockage PostgreSQL.
const fs = require('fs');
const path = require('path');

function createFileStore(dir) {
  const file = path.join(dir, 'db.json');
  const photoDir = path.join(dir, 'photos');
  let db = { users: [], sessions: [], soirees: [], participants: [], souvenirs: [], photos: [] };
  let timer = null;
  const save = () => { clearTimeout(timer); timer = setTimeout(() => fs.writeFileSync(file, JSON.stringify(db)), 300); };
  const now = () => new Date().toISOString();
  const copy = (x) => (x ? JSON.parse(JSON.stringify(x)) : null);

  return {
    kind: 'fichiers locaux',
    async init() {
      fs.mkdirSync(photoDir, { recursive: true });
      if (fs.existsSync(file)) db = { ...db, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
    },

    async createUser(u) {
      if (db.users.some((x) => x.email === u.email)) throw new Error('EXISTS');
      const user = { ...u, createdAt: now() };
      db.users.push(user); save();
      return copy(user);
    },
    userByEmail: async (email) => copy(db.users.find((u) => u.email === email)),
    userById: async (id) => copy(db.users.find((u) => u.id === id)),
    async updateUser(id, { name, avatar }) {
      const u = db.users.find((x) => x.id === id);
      if (u) { u.name = name; u.avatar = avatar; save(); }
      return copy(u);
    },
    async deleteUser(id) {
      db.photos.filter((p) => p.uploaderUserId === id).forEach((p) => fs.rmSync(path.join(photoDir, `${p.id}.jpg`), { force: true }));
      db.photos = db.photos.filter((p) => p.uploaderUserId !== id);
      db.users = db.users.filter((u) => u.id !== id);
      db.sessions = db.sessions.filter((s) => s.userId !== id);
      db.participants.forEach((p) => { if (p.userId === id) p.userId = null; });
      save();
    },
    async createSession(tokenHash, userId, expiresAt) { db.sessions.push({ tokenHash, userId, expiresAt: expiresAt.toISOString() }); save(); },
    async sessionUser(tokenHash) {
      const s = db.sessions.find((x) => x.tokenHash === tokenHash && new Date(x.expiresAt) > new Date());
      return s ? copy(db.users.find((u) => u.id === s.userId)) : null;
    },
    async deleteSession(tokenHash) { db.sessions = db.sessions.filter((s) => s.tokenHash !== tokenHash); save(); },

    async createSoiree({ id, code, startedAt }) { db.soirees.push({ id, code, startedAt: startedAt.toISOString(), endedAt: null, summary: {} }); save(); },
    async updateSoiree(id, { summary, endedAt }) {
      const s = db.soirees.find((x) => x.id === id);
      if (s) { s.summary = summary; if (endedAt) s.endedAt = endedAt.toISOString(); save(); }
    },
    async upsertParticipant(soireeId, p) {
      const row = db.participants.find((x) => x.soireeId === soireeId && x.pkey === p.pkey);
      if (row) Object.assign(row, { userId: p.userId || row.userId, name: p.name, avatar: p.avatar, score: p.score || 0, rank: p.rank ?? null });
      else db.participants.push({ soireeId, pkey: p.pkey, userId: p.userId || null, name: p.name, avatar: p.avatar, score: p.score || 0, rank: p.rank ?? null });
      save();
    },
    async addSouvenir(s) { db.souvenirs.push({ ...s, createdAt: now() }); save(); },
    isParticipant: async (soireeId, userId) => db.participants.some((p) => p.soireeId === soireeId && p.userId === userId),
    async soireesOfUser(userId) {
      return db.participants.filter((p) => p.userId === userId).map((p) => {
        const s = db.soirees.find((x) => x.id === p.soireeId);
        if (!s) return null;
        return {
          ...copy(s), score: p.score, rank: p.rank,
          players: db.participants.filter((x) => x.soireeId === s.id).length,
          photos: db.photos.filter((x) => x.soireeId === s.id).length,
          souvenirs: db.souvenirs.filter((x) => x.soireeId === s.id).length,
        };
      }).filter(Boolean).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    },
    async soireeDetail(id) {
      const s = db.soirees.find((x) => x.id === id);
      if (!s) return null;
      return {
        ...copy(s),
        participants: copy(db.participants.filter((p) => p.soireeId === id)).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99) || b.score - a.score),
        souvenirs: copy(db.souvenirs.filter((x) => x.soireeId === id)),
        photos: db.photos.filter((x) => x.soireeId === id).map(({ id: pid, uploaderUserId, uploaderName, createdAt }) => ({ id: pid, uploaderUserId, uploaderName, createdAt })),
      };
    },

    async addPhoto(ph) {
      fs.writeFileSync(path.join(photoDir, `${ph.id}.jpg`), ph.data);
      const { data, ...meta } = ph;
      db.photos.push({ ...meta, createdAt: now() }); save();
    },
    async getPhoto(id) {
      const meta = db.photos.find((p) => p.id === id);
      if (!meta) return null;
      const f = path.join(photoDir, `${id}.jpg`);
      return fs.existsSync(f) ? { ...copy(meta), data: fs.readFileSync(f) } : null;
    },
    async deletePhoto(id) {
      fs.rmSync(path.join(photoDir, `${id}.jpg`), { force: true });
      db.photos = db.photos.filter((p) => p.id !== id);
      db.souvenirs = db.souvenirs.filter((s) => s.photoId !== id);
      save();
    },
    /** Toutes les photos et captures des soirées auxquelles l'utilisateur a participé (les plus récentes d'abord). */
    async photosOfUser(userId) {
      const mine = new Set(db.participants.filter((p) => p.userId === userId).map((p) => p.soireeId));
      return db.photos.filter((p) => mine.has(p.soireeId)).map((p) => {
        const s = db.soirees.find((x) => x.id === p.soireeId) || {};
        return { id: p.id, soireeId: p.soireeId, code: s.code, startedAt: s.startedAt, uploaderUserId: p.uploaderUserId, uploaderName: p.uploaderName, createdAt: p.createdAt };
      }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 500);
    },
    async linkPhotosOf(soireeId, pkey, userId) {
      db.photos.forEach((p) => { if (p.soireeId === soireeId && p.uploaderPkey === pkey && !p.uploaderUserId) p.uploaderUserId = userId; });
      save();
    },
  };
}

module.exports = { createFileStore };

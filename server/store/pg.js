// Stockage PostgreSQL (Neon en production). Variable d'environnement : DATABASE_URL.
// Les tables sont créées automatiquement au démarrage si elles n'existent pas.
const { Pool } = require('pg');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, avatar TEXT NOT NULL,
  pass_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS soirees (
  id UUID PRIMARY KEY, code TEXT NOT NULL, started_at TIMESTAMPTZ NOT NULL, ended_at TIMESTAMPTZ, summary JSONB NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS participants (
  soiree_id UUID NOT NULL REFERENCES soirees(id) ON DELETE CASCADE, pkey TEXT NOT NULL, user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL, avatar TEXT NOT NULL, score INT NOT NULL DEFAULT 0, rank INT, PRIMARY KEY (soiree_id, pkey)
);
CREATE INDEX IF NOT EXISTS participants_user ON participants(user_id);
CREATE TABLE IF NOT EXISTS photos (
  id UUID PRIMARY KEY, soiree_id UUID NOT NULL REFERENCES soirees(id) ON DELETE CASCADE, uploader_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  uploader_pkey TEXT, uploader_name TEXT NOT NULL, mime TEXT NOT NULL, data BYTEA NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS photos_soiree ON photos(soiree_id);
CREATE TABLE IF NOT EXISTS souvenirs (
  id UUID PRIMARY KEY, soiree_id UUID NOT NULL REFERENCES soirees(id) ON DELETE CASCADE, kind TEXT NOT NULL, title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '', payload JSONB NOT NULL DEFAULT '{}', photo_id UUID REFERENCES photos(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS souvenirs_soiree ON souvenirs(soiree_id);
`;

function createPgStore(url, PoolClass = Pool) {
  const pool = new PoolClass({ connectionString: url, max: 5, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } });
  const one = async (sql, args) => (await pool.query(sql, args)).rows[0] || null;
  const all = async (sql, args) => (await pool.query(sql, args)).rows;
  const user = (r) => (r ? { id: r.id, email: r.email, name: r.name, avatar: r.avatar, passHash: r.pass_hash, createdAt: r.created_at } : null);

  return {
    kind: 'PostgreSQL',
    async init() { await pool.query(SCHEMA); },

    // ----- comptes -----
    async createUser({ id, email, name, avatar, passHash }) {
      try { return user(await one('INSERT INTO users (id, email, name, avatar, pass_hash) VALUES ($1,$2,$3,$4,$5) RETURNING *', [id, email, name, avatar, passHash])); } catch (e) {
        if (e.code === '23505') throw new Error('EXISTS');
        throw e;
      }
    },
    userByEmail: async (email) => user(await one('SELECT * FROM users WHERE email = $1', [email])),
    userById: async (id) => user(await one('SELECT * FROM users WHERE id = $1', [id])),
    updateUser: async (id, { name, avatar }) => user(await one('UPDATE users SET name = $2, avatar = $3 WHERE id = $1 RETURNING *', [id, name, avatar])),
    async deleteUser(id) {
      await pool.query('DELETE FROM photos WHERE uploader_user_id = $1', [id]);
      await pool.query('DELETE FROM users WHERE id = $1', [id]);
    },
    createSession: (tokenHash, userId, expiresAt) => pool.query('INSERT INTO sessions VALUES ($1,$2,$3)', [tokenHash, userId, expiresAt]),
    sessionUser: async (tokenHash) => user(await one('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now()', [tokenHash])),
    deleteSession: (tokenHash) => pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]),

    // ----- soirées -----
    createSoiree: ({ id, code, startedAt }) => pool.query('INSERT INTO soirees (id, code, started_at) VALUES ($1,$2,$3)', [id, code, startedAt]),
    updateSoiree: (id, { summary, endedAt }) => pool.query('UPDATE soirees SET summary = $2, ended_at = COALESCE($3, ended_at) WHERE id = $1', [id, summary, endedAt || null]),
    upsertParticipant: (soireeId, p) => pool.query(
      `INSERT INTO participants (soiree_id, pkey, user_id, name, avatar, score, rank) VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (soiree_id, pkey) DO UPDATE SET user_id = COALESCE(EXCLUDED.user_id, participants.user_id), name = EXCLUDED.name, avatar = EXCLUDED.avatar, score = EXCLUDED.score, rank = EXCLUDED.rank`,
      [soireeId, p.pkey, p.userId || null, p.name, p.avatar, p.score || 0, p.rank ?? null],
    ),
    addSouvenir: (s) => pool.query('INSERT INTO souvenirs (id, soiree_id, kind, title, body, payload, photo_id) VALUES ($1,$2,$3,$4,$5,$6,$7)', [s.id, s.soireeId, s.kind, s.title, s.body || '', s.payload || {}, s.photoId || null]),
    isParticipant: async (soireeId, userId) => !!(await one('SELECT 1 AS ok FROM participants WHERE soiree_id = $1 AND user_id = $2', [soireeId, userId])),
    soireesOfUser: (userId) => all(
      `SELECT s.id, s.code, s.started_at AS "startedAt", s.ended_at AS "endedAt", s.summary, p.score, p.rank,
        COALESCE(pc.n, 0) AS players, COALESCE(fc.n, 0) AS photos, COALESCE(vc.n, 0) AS souvenirs
       FROM participants p JOIN soirees s ON s.id = p.soiree_id
       LEFT JOIN (SELECT soiree_id, count(*)::int AS n FROM participants GROUP BY soiree_id) pc ON pc.soiree_id = s.id
       LEFT JOIN (SELECT soiree_id, count(*)::int AS n FROM photos GROUP BY soiree_id) fc ON fc.soiree_id = s.id
       LEFT JOIN (SELECT soiree_id, count(*)::int AS n FROM souvenirs GROUP BY soiree_id) vc ON vc.soiree_id = s.id
       WHERE p.user_id = $1 ORDER BY s.started_at DESC LIMIT 100`, [userId]),
    async soireeDetail(id) {
      const soiree = await one('SELECT id, code, started_at AS "startedAt", ended_at AS "endedAt", summary FROM soirees WHERE id = $1', [id]);
      if (!soiree) return null;
      soiree.participants = await all('SELECT pkey, user_id AS "userId", name, avatar, score, rank FROM participants WHERE soiree_id = $1 ORDER BY rank NULLS LAST, score DESC', [id]);
      soiree.souvenirs = await all('SELECT id, kind, title, body, payload, photo_id AS "photoId", created_at AS "createdAt" FROM souvenirs WHERE soiree_id = $1 ORDER BY created_at', [id]);
      soiree.photos = await all('SELECT id, uploader_user_id AS "uploaderUserId", uploader_name AS "uploaderName", created_at AS "createdAt" FROM photos WHERE soiree_id = $1 ORDER BY created_at', [id]);
      return soiree;
    },

    // ----- photos -----
    addPhoto: (ph) => pool.query('INSERT INTO photos (id, soiree_id, uploader_user_id, uploader_pkey, uploader_name, mime, data) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [ph.id, ph.soireeId, ph.uploaderUserId || null, ph.uploaderPkey || null, ph.uploaderName, ph.mime, ph.data]),
    getPhoto: async (id) => {
      const r = await one('SELECT id, soiree_id AS "soireeId", uploader_user_id AS "uploaderUserId", uploader_pkey AS "uploaderPkey", mime, data FROM photos WHERE id = $1', [id]);
      return r;
    },
    deletePhoto: (id) => pool.query('DELETE FROM photos WHERE id = $1', [id]),
    /** Toutes les photos et captures des soirées auxquelles l'utilisateur a participé (les plus récentes d'abord). */
    photosOfUser: (userId) => all(
      `SELECT f.id, f.soiree_id AS "soireeId", s.code, s.started_at AS "startedAt", f.uploader_user_id AS "uploaderUserId", f.uploader_name AS "uploaderName", f.created_at AS "createdAt"
       FROM photos f JOIN soirees s ON s.id = f.soiree_id
       WHERE f.soiree_id IN (SELECT soiree_id FROM participants WHERE user_id = $1) ORDER BY f.created_at DESC LIMIT 500`, [userId]),
    linkPhotosOf: (soireeId, pkey, userId) => pool.query('UPDATE photos SET uploader_user_id = $3 WHERE soiree_id = $1 AND uploader_pkey = $2 AND uploader_user_id IS NULL', [soireeId, pkey, userId]),
  };
}

module.exports = { createPgStore };

// Choix du stockage : PostgreSQL (Neon) si DATABASE_URL est défini, sinon fichiers locaux dans data/.
const path = require('path');
const { createPgStore } = require('./pg');
const { createFileStore } = require('./file');

const store = process.env.DATABASE_URL
  ? createPgStore(process.env.DATABASE_URL)
  : createFileStore(process.env.SHOWTIME_DATA_DIR || path.join(__dirname, '..', '..', 'data'));

module.exports = store;

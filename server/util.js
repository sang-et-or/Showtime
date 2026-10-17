// Petits outils partagés par le serveur et les modules de jeu.
const crypto = require('crypto');

const token = () => crypto.randomBytes(16).toString('hex');
const shortId = () => crypto.randomBytes(5).toString('hex');
const pick = (arr) => arr[crypto.randomInt(arr.length)];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Nettoie un texte saisi par un joueur : pas de caractères de contrôle, longueur bornée. */
function sanitizeText(value, max) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f​-‏‪-‮]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Forme « comparable » d'un mot : majuscules, sans accents ni ponctuation. Ex. « Éléphant ! » → « ELEPHANT ». */
function norm(value) {
  return String(value ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/Œ/g, 'OE').replace(/Æ/g, 'AE')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

module.exports = { token, shortId, pick, shuffle, sanitizeText, norm };

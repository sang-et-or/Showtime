// Vérifie la banque de questions : thèmes et clubs connus, 4 réponses distinctes, pas de doublon.
const { QUESTIONS, CATEGORIES } = require('../server/content/questions');
const { CLUBS } = require('../server/content/quiz-clubs');
const norm = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
let errs = 0; const seen = new Map(); const count = {};
for (const q of QUESTIONS) {
  if (!CATEGORIES[q.cat]) { console.log('thème inconnu', q.cat, q.q); errs++; }
  if (q.cat === 'clubs' && !CLUBS[q.club]) { console.log('club inconnu', q.club); errs++; }
  if (!Array.isArray(q.a) || q.a.length !== 4 || new Set(q.a.map(norm)).size !== 4) { console.log('réponses invalides :', q.q, q.a); errs++; }
  const k = norm(q.q);
  if (seen.has(k)) { console.log('doublon :', q.q); errs++; }
  seen.set(k, q);
  count[q.cat] = (count[q.cat] || 0) + 1;
}
console.log(Object.entries(count).map(([k, v]) => `${k}:${v}`).join('  '));
const per = {}; QUESTIONS.filter((q) => q.cat === 'clubs').forEach((q) => { per[q.club] = (per[q.club] || 0) + 1; });
console.log('clubs →', Object.entries(per).map(([k, v]) => `${k}:${v}`).join(' '));
console.log(QUESTIONS.length, 'questions,', errs ? `${errs} problème(s)` : 'aucun problème');
process.exit(errs ? 1 : 0);

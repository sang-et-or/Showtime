// Jeu de parcours « Fin de Mois » (inspiré des jeux de « calendrier et budget »,
// avec notre propre calendrier, nos événements et nos règles).
// On avance jour après jour dans le mois : factures, courrier, bonnes affaires, loto, amendes…
// Le jour de paie, on touche son salaire et on revend ses bonnes affaires. Argent fictif uniquement.
const animator = require('../animator');
const { createTrackGame } = require('./trackgame');
const { pick } = require('../util');

const LAST = 31;
const SALARY = 2_000;
const MONTHS = { short: 1, normal: 2, long: 3 };
const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const PLAN = {
  1: ['courrier'], 2: ['facture', 'Électricité', 150], 3: ['affaire'], 4: ['cadeau', 'Remboursement mutuelle', 200], 5: ['facture', 'Loyer', 800], 6: ['loto'], 7: ['dimanche'],
  8: ['courrier'], 9: ['amende', 'Stationnement gênant', 200], 10: ['affaire'], 11: ['facture', 'Forfait téléphone', 80], 12: ['cadeau', 'Prime surprise', 300], 13: ['loto'], 14: ['dimanche'],
  15: ['jackpot'], 16: ['facture', 'Courses de la semaine', 250], 17: ['affaire'], 18: ['courrier'], 19: ['amende', 'Oubli de ticket de bus', 150], 20: ['loto'], 21: ['dimanche'],
  22: ['cadeau', 'Vente sur internet', 150], 23: ['facture', 'Box internet', 50], 24: ['affaire'], 25: ['courrier'], 26: ['facture', 'Assurance', 120], 27: ['loto'], 28: ['dimanche'],
  29: ['amende', 'Excès de vitesse', 300], 30: ['cadeau', 'Anniversaire', 250], 31: ['paie'],
};
const ICONS = { debut: '🗓️', courrier: '✉️', facture: '🧾', affaire: '🛍️', cadeau: '🎁', loto: '🎲', dimanche: '☀️', amende: '🚨', jackpot: '💰', paie: '💶' };

const COURRIER = [
  { icon: '✉️', title: 'Remboursement d’impôts', text: 'Une bonne nouvelle dans la boîte aux lettres !', delta: 180 },
  { icon: '🐾', title: 'Facture du vétérinaire', text: 'Le chat a encore avalé un élastique.', delta: -220 },
  { icon: '💌', title: 'Lettre d’amour', text: 'Rien à payer, juste du bonheur.', delta: 0 },
  { icon: '📸', title: 'Concours photo', text: 'Ta photo de coucher de soleil gagne le 1er prix !', delta: 150 },
  { icon: '🧺', title: 'Lave-linge en panne', text: 'Il fait un bruit d’avion depuis mardi.', delta: -300 },
  { icon: '🎟️', title: 'Places de concert', text: 'Tu revends tes places en double.', delta: 120 },
  { icon: '🦷', title: 'Dentiste', text: 'Une petite carie… et une grosse facture.', delta: -160 },
];
const DEALS = [
  { name: 'un vélo d’occasion', price: 300 }, { name: 'une console rétro', price: 250 }, { name: 'un canapé vintage', price: 400 },
  { name: 'une guitare électrique', price: 350 }, { name: 'un lot de bandes dessinées', price: 150 }, { name: 'une machine à café', price: 200 },
];

const eur = (n) => `${n.toLocaleString('fr-FR')} €`;

function buildBoard() {
  return Array.from({ length: LAST + 1 }, (_, i) => {
    if (i === 0) return { type: 'debut', icon: ICONS.debut, label: 'Début' };
    const [type, label, amount] = PLAN[i];
    return { type, icon: ICONS[type], label: label || { courrier: 'Courrier', affaire: 'Affaire', loto: 'Loto', dimanche: 'Repos', jackpot: 'Cagnotte', paie: 'Paie' }[type], amount, day: i, wd: DAYS[(i - 1) % 7] };
  });
}

module.exports = createTrackGame({
  id: 'mois',
  title: 'Fin de Mois',
  icon: '📅',
  subtitle: 'Factures, courrier, bonnes affaires et loto : bouclez le mois avec le plus d’argent !',
  pitch: 'Un mois de budget plein d’imprévus. Argent fictif uniquement !',
  rules: 'Lancez le dé et avancez dans le calendrier. Payez les factures, saisissez les bonnes affaires (revendues le jour de paie), tentez le loto… Le jour de paie, on s’arrête toujours !',
  players: '2 à 8 joueurs',
  duration: '10 à 15 min',
  minPlayers: 1,
  sides: 6,
  currency: '€',
  cols: 7,
  introLine: () => animator.moisIntro(),
  turnLine: (name) => pick([`${name}, lance le dé !`, `À toi, ${name} ! Quelle surprise dans ta boîte aux lettres ?`]),
  endLine: (name) => `Les comptes sont faits ! ${name} termine avec le plus beau budget !`,
  buildBoard,
  initSeat: (room) => ({ money: 3_000, month: 1, months: MONTHS[room.settings.length], items: [] }),
  init: (room, g) => { g.pot = 0; g.loto = 0; },
  header: (g) => `🚨 Cagnotte des amendes : ${eur(g.pot)} · 🎲 Loto : ${eur(g.loto)}`,
  maxPos: () => LAST,

  resolve(room, seat, sq, api) {
    const g = api.game();
    switch (sq.type) {
      case 'facture':
        seat.money -= sq.amount;
        return { icon: '🧾', title: sq.label, text: 'Une facture de plus sur la pile.', delta: -sq.amount };
      case 'cadeau':
        seat.money += sq.amount;
        return { icon: '🎁', title: sq.label, text: 'Une rentrée d’argent inattendue !', delta: sq.amount };
      case 'courrier': {
        const c = pick(COURRIER);
        seat.money += c.delta;
        return { ...c, tone: c.delta === 0 ? 'good' : undefined };
      }
      case 'amende':
        seat.money -= sq.amount; g.pot += sq.amount;
        return { icon: '🚨', title: `Amende : ${sq.label}`, text: 'L’argent part dans la cagnotte du jour 15…', delta: -sq.amount };
      case 'jackpot': {
        const won = g.pot; g.pot = 0; seat.money += won;
        return won ? { icon: '💰', title: 'La cagnotte !', text: 'Tu remportes toutes les amendes payées par les autres !', delta: won }
          : { icon: '💰', title: 'Cagnotte vide…', text: 'Personne n’a encore payé d’amende. Dommage !', tone: 'neutral' };
      }
      case 'loto': {
        const seats = api.seats();
        seats.forEach((s) => { s.money -= 50; });
        g.loto += 50 * seats.length;
        const r = api.roll(6);
        if (r === 6) {
          const won = g.loto; g.loto = 0; seat.money += won;
          return { icon: '🎲', title: 'Loto : 6 !', text: `Tout le monde a misé 50 € et tu ramasses tout !`, delta: won };
        }
        return { icon: '🎲', title: `Loto : ${r}…`, text: 'Chacun a misé 50 €. Il fallait un 6 : la cagnotte grossit !', delta: -50 };
      }
      case 'affaire': {
        const deal = pick(DEALS);
        const resale = Math.round(deal.price * 1.8 / 10) * 10;
        return {
          icon: '🛍️', title: 'Bonne affaire !', text: `Acheter ${deal.name} pour ${eur(deal.price)} ? Tu le revendras ${eur(resale)} le jour de paie.`,
          choice: {
            yes: `🛍️ Acheter (${eur(deal.price)})`, no: '🙅 Non merci',
            onChoose: (yes) => {
              if (!yes) return { icon: '🙅', title: 'Raisonnable', text: 'Tu gardes ton argent.', tone: 'neutral' };
              seat.money -= deal.price; seat.items.push(resale);
              return { icon: '🛍️', title: 'Acheté !', text: `Revente prévue : ${eur(resale)}.`, delta: -deal.price };
            },
          },
        };
      }
      case 'paie': {
        const sold = seat.items.reduce((a, b) => a + b, 0);
        seat.items = [];
        seat.money += SALARY + sold;
        const fin = seat.month >= seat.months;
        if (fin) seat.done = true; else { seat.month++; seat.pos = 0; }
        return { icon: '💶', title: `Jour de paie !`, text: `Salaire ${eur(SALARY)}${sold ? ` + reventes ${eur(sold)}` : ''}. ${fin ? 'Tu as bouclé ton dernier mois !' : `En route pour le mois ${seat.month} !`}`, delta: SALARY + sold };
      }
      default:
        return { icon: '☀️', title: 'Dimanche', text: 'Brunch en famille et sieste. Rien à payer !', tone: 'good' };
    }
  },

  finalTotal: (seat) => seat.money + seat.items.reduce((a, b) => a + b, 0),
  points: (total) => Math.max(0, Math.round(total / 2)),
  summary: (seat) => [`Mois ${Math.min(seat.month, seat.months)}/${seat.months}`, seat.items.length ? `🛍️×${seat.items.length}` : '', seat.done ? '✅' : ''].filter(Boolean).join(' '),
});

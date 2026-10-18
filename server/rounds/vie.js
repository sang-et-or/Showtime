// Jeu de parcours « Le Chemin de la Vie » (inspiré des jeux de « parcours de vie »,
// avec notre propre plateau, nos événements et nos règles).
// On fait tourner la roue (1 à 10), on traverse la vie : études, paies, bébés, maison,
// coups de chance et coups durs… La plus grosse fortune à la retraite gagne.
const animator = require('../animator');
const { createTrackGame } = require('./trackgame');
const { pick } = require('../util');

const LAST = 40;
const RETIRE_BONUS = [10_000, 6_000, 3_000, 1_000];

const EVENTS = [
  { icon: '🎤', title: 'Star du karaoké', text: 'Tu gagnes le concours de karaoké du quartier !', delta: 2_000 },
  { icon: '💌', title: 'Tante d’Amérique', text: 'Ta tante d’Amérique t’envoie un chèque.', delta: 5_000 },
  { icon: '📈', title: 'Promotion !', text: 'Ton patron reconnaît enfin ton génie.', delta: 3_000 },
  { icon: '💿', title: 'Vide-grenier', text: 'Tu vends tes vieux vinyles à prix d’or.', delta: 1_500 },
  { icon: '🗝️', title: 'Trésor au grenier', text: 'Un vieux coffre plein de pièces anciennes !', delta: 4_000 },
  { icon: '🐶', title: 'Chien héros', text: 'Ton chien retrouve le portefeuille du maire. Récompense !', delta: 2_500 },
  { icon: '🚗', title: 'Panne de voiture', text: 'Le garagiste a un grand sourire. Toi, moins.', delta: -2_500 },
  { icon: '🐱', title: 'Le chat a mangé la facture', text: 'Pénalité de retard. Le chat ne regrette rien.', delta: -1_000 },
  { icon: '🏝️', title: 'Vacances de rêve', text: 'Une semaine aux Seychelles. Inoubliable… et pas donné.', delta: -4_000 },
  { icon: '📱', title: 'Téléphone en miettes', text: 'Il a glissé. Directement dans la piscine.', delta: -800 },
  { icon: '🍽️', title: 'C’est ma tournée !', text: 'Tu invites toute la table au restaurant.', delta: -1_500 },
  { icon: '🚓', title: 'Flashé !', text: 'Excès de vitesse… pour arriver à l’heure au travail.', delta: -1_200 },
  { icon: '🔨', title: 'Travaux', text: 'Rénovation de la cuisine. Le carrelage était « en promo ».', delta: -3_000 },
  { icon: '🎰', title: 'Pièce porte-bonheur', text: 'Tu trouves 20 € par terre… puis un billet gagnant !', delta: 1_000 },
];

function buildBoard() {
  const special = { 3: 'bebe', 9: 'mariage', 12: 'maison', 15: 'loto', 17: 'bebe', 21: 'investir', 24: 'taxe', 27: 'voiture', 30: 'loto', 33: 'bebe', 37: 'taxe' };
  const ICONS = { depart: ['🚩', 'Départ'], paie: ['💰', 'Paie'], event: ['❓', 'Surprise'], bebe: ['👶', 'Bébé'], mariage: ['💍', 'Mariage'], maison: ['🏠', 'Maison'],
    loto: ['🎰', 'Loto'], investir: ['📊', 'Investir'], taxe: ['🧾', 'Impôts'], voiture: ['🏎️', 'Voiture'], retraite: ['🏖️', 'Retraite'] };
  return Array.from({ length: LAST + 1 }, (_, i) => {
    const type = i === 0 ? 'depart' : i === LAST ? 'retraite' : special[i] || (i % 5 === 0 ? 'paie' : 'event');
    return { type, icon: ICONS[type][0], label: ICONS[type][1] };
  });
}

module.exports = createTrackGame({
  id: 'vie',
  title: 'Le Chemin de la Vie',
  icon: '🛤️',
  subtitle: 'Études, paies, bébés, maison… Arrivez à la retraite avec la plus belle fortune !',
  pitch: 'Un parcours de vie plein de rebondissements. Fortune virtuelle uniquement !',
  rules: 'Faites tourner la roue (1 à 10) et avancez. Paies, surprises, bébés, maison, placements… Faites les bons choix ! À la retraite, on compte la fortune (argent fictif).',
  players: '2 à 8 joueurs',
  duration: '10 à 15 min',
  minPlayers: 1,
  sides: 10,
  currency: '🪙',
  cols: 9,
  moveMs: (steps) => 1_700 + steps * 330 + 900, // roue qui tourne, puis le pion avance case par case
  introLine: () => animator.vieIntro(),
  turnLine: (name) => pick([`${name}, fais tourner la roue de la vie !`, `À toi, ${name} ! Que te réserve le destin ?`]),
  endLine: (name) => `Toute la troupe est à la retraite ! La plus belle fortune revient à ${name} !`,
  buildBoard,
  initSeat: () => ({ money: 10_000, salary: 2_500, kids: 0, house: 0, car: false, career: '', retireBonus: 0 }),
  init: (room, g) => { g.retired = 0; },
  maxPos: () => LAST,

  firstTurn(room, seat) {
    return {
      icon: '🎓', title: 'Le grand choix', text: 'Études (6 000 de frais, mais un meilleur salaire ensuite) ou travailler tout de suite ?',
      choice: {
        yes: '🎓 Faire des études', no: '💼 Travailler tout de suite',
        onChoose: (yes) => {
          if (yes) { seat.money -= 6_000; seat.salary = 4_500; seat.career = '🎓'; return { icon: '🎓', title: 'Diplômé·e !', text: 'Salaire : 4 500 à chaque paie.', delta: -6_000 }; }
          seat.salary = 2_500; seat.career = '💼';
          return { icon: '💼', title: 'Au boulot !', text: 'Salaire : 2 500 à chaque paie.', tone: 'neutral' };
        },
      },
    };
  },

  onPass(room, seat, from, to, api) {
    const out = [];
    for (let i = from + 1; i < to; i++) {
      if (api.game().board[i].type === 'paie') { seat.money += seat.salary; out.push(`💰 Paie au passage : +${seat.salary.toLocaleString('fr-FR')}`); }
    }
    return out;
  },

  resolve(room, seat, square, api) {
    const others = api.seats().filter((s) => s !== seat);
    switch (square.type) {
      case 'paie':
        seat.money += seat.salary;
        return { icon: '💰', title: 'Jour de paie !', text: 'Le salaire tombe. Ça fait du bien.', delta: seat.salary };
      case 'bebe':
        seat.kids++; seat.money -= 2_000;
        return { icon: '👶', title: 'Un bébé arrive !', text: 'Couches et biberons : 2 000. Mais chaque enfant rapportera 5 000 à la retraite !', delta: -2_000 };
      case 'mariage': {
        const gift = 1_000 * others.length;
        others.forEach((o) => { o.money -= 1_000; });
        seat.money += gift;
        return { icon: '💍', title: 'Mariage !', text: `Chaque invité offre 1 000 en cadeau. Vive les mariés !`, delta: gift };
      }
      case 'maison':
        if (seat.house) { seat.house += 5_000; return { icon: '🏠', title: 'Ta maison prend de la valeur', text: '+5 000 de valeur à la retraite.', tone: 'good' }; }
        return {
          icon: '🏠', title: 'La maison de tes rêves', text: 'Acheter une maison pour 20 000 ? Elle en vaudra 40 000 à la retraite.',
          choice: {
            yes: '🏠 Acheter', no: '🙅 Rester locataire',
            onChoose: (yes) => {
              if (!yes) return { icon: '🏢', title: 'Locataire heureux', text: 'Pas de crédit, pas de soucis.', tone: 'neutral' };
              seat.money -= 20_000; seat.house = 40_000;
              return { icon: '🔑', title: 'Propriétaire !', text: 'Elle vaudra 40 000 à la retraite.', delta: -20_000 };
            },
          },
        };
      case 'investir':
        return {
          icon: '📊', title: 'La start-up du cousin', text: 'Investir 10 000 dans l’appli révolutionnaire de ton cousin ? Une chance sur deux de tout gagner… ou tout perdre.',
          choice: {
            yes: '🚀 J’investis', no: '🙅 Trop risqué',
            onChoose: (yes) => {
              if (!yes) return { icon: '😌', title: 'Prudence', text: 'Tu gardes tes économies.', tone: 'neutral' };
              seat.money -= 10_000;
              if (api.roll(2) === 1) { seat.money += 25_000; return { icon: '🚀', title: 'Jackpot !', text: 'L’appli cartonne : tu récupères 25 000 !', delta: 15_000 }; }
              return { icon: '💥', title: 'Faillite…', text: 'L’appli pour parler aux plantes n’a pas trouvé son public.', delta: -10_000 };
            },
          },
        };
      case 'voiture':
        return {
          icon: '🏎️', title: 'Voiture de sport', text: 'S’offrir une voiture de sport à 15 000 ? Le prestige te fait augmenter : +1 000 à chaque paie.',
          choice: {
            yes: '🏎️ Vroum !', no: '🚲 Le vélo, c’est bien',
            onChoose: (yes) => {
              if (!yes) return { icon: '🚲', title: 'Écolo !', text: 'Tes mollets te remercient.', tone: 'neutral' };
              seat.money -= 15_000; seat.salary += 1_000; seat.car = true;
              return { icon: '🏎️', title: 'Classe !', text: `Nouveau salaire : ${seat.salary.toLocaleString('fr-FR')}.`, delta: -15_000 };
            },
          },
        };
      case 'loto': {
        const r = api.roll(10);
        if (r >= 8) { seat.money += 15_000; return { icon: '🎰', title: `Loto : ${r} !`, text: '8, 9 ou 10 : tu gagnes le gros lot !', delta: 15_000 }; }
        return { icon: '🎰', title: `Loto : ${r}…`, text: 'Il fallait 8, 9 ou 10. Ce sera pour la prochaine fois !', tone: 'neutral' };
      }
      case 'taxe': {
        const tax = Math.max(0, Math.round(seat.money * 0.1 / 100) * 100);
        seat.money -= tax;
        return { icon: '🧾', title: 'Les impôts', text: 'Tu paies 10 % de ta fortune. Ça pique.', delta: -tax };
      }
      case 'retraite': {
        const g = api.game();
        seat.done = true;
        seat.retireBonus = RETIRE_BONUS[g.retired] || 0;
        g.retired++;
        return { icon: '🏖️', title: 'La retraite !', text: `Arrivée n°${g.retired}. Bonus : ${seat.retireBonus.toLocaleString('fr-FR')}. Place aux chaises longues !`, delta: seat.retireBonus };
      }
      default: {
        const ev = pick(EVENTS);
        seat.money += ev.delta;
        return { ...ev };
      }
    }
  },

  finalTotal: (seat) => seat.money + seat.house + seat.kids * 5_000 + seat.retireBonus,
  points: (total) => Math.max(0, Math.round(total / 10)),
  summary: (seat) => [seat.career, seat.kids ? `👶×${seat.kids}` : '', seat.house ? '🏠' : '', seat.car ? '🏎️' : '', seat.done ? '🏖️' : ''].filter(Boolean).join(' '),
});

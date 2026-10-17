// @ts-check
// Roadmap shown in Profile: ideas the user set aside or asked for, not built yet. Update it
// when one is done (remove it, note it in docs/SPEC.md) or a new one comes up.

/**
 * @typedef {'idea' | 'next' | 'waiting'} RoadmapStatus
 * @typedef {{ title: string, text: string, status: RoadmapStatus }} RoadmapItem
 */

/** Labels of the statuses, in the order the groups are shown. */
export const ROADMAP_STATUS = /** @type {const} */ ([
  ['next', 'Prossimi passi'],
  ['idea', 'Idee da valutare'],
  ['waiting', 'In attesa di altri'],
]);

/** @type {RoadmapItem[]} */
export const ROADMAP = [
  {
    title: 'Pokédex delle carte',
    text: 'Un elenco di tutti i Pokémon, ognuno con la sua icona: lo tocchi ed entri nelle sue carte, quelle che hai e quelle che ti mancano, come la raccolta per illustratore.',
    status: 'next',
  },
  {
    title: 'Edizione completa con un tocco',
    text: 'Se hai un’edizione intera, aggiungere tutte le sue carte in una volta dalla pagina dell’edizione, senza scansionarle una per una (con la lingua e “Annulla”).',
    status: 'next',
  },
  {
    title: 'Condividi la tua lista di carte',
    text: 'Mandare a un amico la collezione, i doppioni o i desideri con un link o un file, per organizzare gli scambi.',
    status: 'next',
  },
  {
    title: 'Carte giapponesi',
    text: 'Catalogo, ricerca, scansione e prezzi delle carte giapponesi: TCGdex le ha complete, con immagini e prezzi Cardmarket. Sono un catalogo a parte, con edizioni e numeri propri.',
    status: 'idea',
  },
  {
    title: 'Carte coreane e cinesi tradizionali',
    text: 'Come per le giapponesi, con le edizioni che TCGdex ha in queste lingue.',
    status: 'idea',
  },
  {
    title: 'Holo o reverse dalla foto',
    text: 'Riconoscere la finitura con due scatti, a torcia spenta e accesa, invece di sceglierla a mano.',
    status: 'idea',
  },
  {
    title: 'Timbro Play! più affidabile',
    text: 'Provare il riconoscimento del timbro su più carte vere, con e senza timbro, per avere un margine più sicuro.',
    status: 'idea',
  },
  {
    title: 'Carte cinesi semplificate',
    text: 'TCGdex elenca le edizioni cinesi ma senza le carte: si potranno catalogare quando le aggiungerà.',
    status: 'waiting',
  },
  {
    title: 'Immagini delle edizioni che mancano',
    text: 'McDonald’s 2014, 2015, 2017, 2018, 2023 e 2024 e i kit allenatore DP, HS, BW, XY e SM non hanno immagini in nessuna delle fonti usate (TCGdex, Limitless, pokemontcg.io).',
    status: 'waiting',
  },
];

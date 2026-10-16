// @ts-check
// Pokémon types of the card game: icon (public/types/, from Bulbapedia, user's choice) from the
// type name TCGdex gives in the card language, and the order the game lists them in.

/** Type names in every TCGdex language → icon file. */
const NAMES = /** @type {Record<string, string>} */ ({
  grass: 'grass', erba: 'grass', plante: 'grass', pflanze: 'grass', planta: 'grass',
  fire: 'fire', fuoco: 'fire', feu: 'fire', feuer: 'fire', fuego: 'fire', fogo: 'fire',
  water: 'water', acqua: 'water', eau: 'water', wasser: 'water', agua: 'water',
  lightning: 'lightning', lampo: 'lightning', electrique: 'lightning', elektro: 'lightning', rayo: 'lightning', eletrico: 'lightning',
  psychic: 'psychic', psico: 'psychic', psy: 'psychic', psycho: 'psychic', psiquico: 'psychic',
  fighting: 'fighting', lotta: 'fighting', combat: 'fighting', kampf: 'fighting', lucha: 'fighting', lutador: 'fighting',
  darkness: 'darkness', oscurita: 'darkness', obscurite: 'darkness', unlicht: 'darkness', oscura: 'darkness', sombrio: 'darkness',
  metal: 'metal', metallo: 'metal', metall: 'metal', metalica: 'metal',
  fairy: 'fairy', folletto: 'fairy', fee: 'fairy', hada: 'fairy', fada: 'fairy',
  dragon: 'dragon', drago: 'dragon', drache: 'dragon', dragao: 'dragon',
  colorless: 'colorless', incolore: 'colorless', farblos: 'colorless', incolora: 'colorless', incolor: 'colorless',
});

/** The order of the game (and of the energy symbols). */
const ORDER = ['grass', 'fire', 'water', 'lightning', 'psychic', 'fighting', 'darkness', 'metal', 'fairy', 'dragon', 'colorless'];

/** @param {string} name */
const key = (name) =>
  name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/**
 * Icon file name of a type ("grass"), or null for an unknown name.
 * @param {string | null | undefined} name TCGdex type, any language ("Erba", "Psychic")
 */
export const typeIcon = (name) => (name ? (NAMES[key(name)] ?? null) : null);

/**
 * Type names sorted as in the game (Grass, Fire, Water…); unknown names last.
 * @param {string[]} names
 */
export function sortTypes(names) {
  const rank = (/** @type {string} */ n) => {
    const i = ORDER.indexOf(typeIcon(n) ?? '');
    return i < 0 ? ORDER.length : i;
  };
  return [...names].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

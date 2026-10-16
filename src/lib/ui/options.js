// @ts-check
// Option lists for Picker: card languages with their flag, Pokémon types with their energy icon,
// rarities with their symbol.
import { LANG_LABELS } from '../domain/cards.js';
import { sortTypes, typeIcon } from '../domain/types.js';
import { isPocketRarity, rarityIcon } from '../domain/rarity.js';

/**
 * @typedef {{ value: string, label: string, sub?: string, icon?: string | null, tile?: boolean, flag?: string }} Option
 * icon: image URL; tile: draw it on a light tile (black symbols, like rarities); flag: card language.
 */

const base = import.meta.env.BASE_URL;

/** @returns {Option[]} */
export const langOptions = () => Object.entries(LANG_LABELS).map(([value, label]) => ({ value, label, flag: value }));

/** @param {string[]} types TCGdex names in the card language @returns {Option[]} */
export const typeOptions = (types) =>
  sortTypes(types).map((t) => ({ value: t, label: t, icon: typeIcon(t) ? `${base}types/${typeIcon(t)}.png` : null }));

/** @param {string[]} rarities TCGdex names in the card language @returns {Option[]} */
export const rarityOptions = (rarities) =>
  rarities.filter((r) => !isPocketRarity(r)).map((r) => ({ value: r, label: r, icon: rarityIcon(r) ? `${base}rarities/${rarityIcon(r)}.png` : null, tile: true }));

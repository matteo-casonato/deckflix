// @ts-check
// Kind of card for the search filter: Pokémon, Trainer (and Item, Supporter, Stadium, Tool),
// Energy (basic, special). TCGdex filters them by field (category, trainerType, energyType)
// with the value in the card language, so each kind lists its name in every language
// (checked on /{lang}/categories, /trainer-types, /energy-types, 16/10/2026).

/**
 * @typedef {'category' | 'trainerType' | 'energyType'} KindField
 * @typedef {{ key: string, label: string, parent?: string, field: KindField, values: Record<string, string> }} Kind
 */

/** @type {Kind[]} */
export const KINDS = [
  { key: 'pokemon', label: 'Pokémon', field: 'category', values: { en: 'Pokemon', it: 'Pokémon', fr: 'Pokémon', de: 'Pokémon', es: 'Pokémon', pt: 'Pokémon' } },
  { key: 'trainer', label: 'Allenatore', field: 'category', values: { en: 'Trainer', it: 'Allenatore', fr: 'Dresseur', de: 'Trainer', es: 'Entrenador', pt: 'Treinador' } },
  { key: 'item', label: 'Strumento', parent: 'Allenatore', field: 'trainerType', values: { en: 'Item', it: 'Strumento', fr: 'Objet', de: 'Itemkarte', es: 'Objeto', pt: 'Item' } },
  { key: 'supporter', label: 'Aiuto', parent: 'Allenatore', field: 'trainerType', values: { en: 'Supporter', it: 'Aiuto', fr: 'Supporter', de: 'Unterstützerkarte', es: 'Partidario', pt: 'Apoiador' } },
  { key: 'stadium', label: 'Stadio', parent: 'Allenatore', field: 'trainerType', values: { en: 'Stadium', it: 'Stadio', fr: 'Stade', de: 'Stadionkarte', es: 'Estadio', pt: 'Estádio' } },
  { key: 'tool', label: 'Oggetto Pokémon', parent: 'Allenatore', field: 'trainerType', values: { en: 'Tool', it: 'Oggetto', fr: 'Outil', de: 'Pokémon-Ausrüstung', es: 'Herramienta', pt: 'Ferramenta' } },
  { key: 'energy', label: 'Energia', field: 'category', values: { en: 'Energy', it: 'Energia', fr: 'Énergie', de: 'Energie', es: 'Energía', pt: 'Energia' } },
  { key: 'basic-energy', label: 'Energia base', parent: 'Energia', field: 'energyType', values: { en: 'Normal', it: 'Base', fr: 'De base', de: 'Basis', es: 'Básico', pt: 'Normal' } },
  { key: 'special-energy', label: 'Energia speciale', parent: 'Energia', field: 'energyType', values: { en: 'Special', it: 'Speciale', fr: 'Spécial', de: 'Spezial', es: 'Especial', pt: 'Especial' } },
];

/** @param {string | null | undefined} key */
export const kindOf = (key) => KINDS.find((k) => k.key === key) ?? null;

/**
 * TCGdex filter of a kind in a language: [field, value], or null.
 * @param {string | null | undefined} key
 * @param {string} lang
 * @returns {[KindField, string] | null}
 */
export function kindFilter(key, lang) {
  const k = kindOf(key);
  if (!k) return null;
  return [k.field, k.values[lang] ?? k.values.en];
}

/**
 * Whether a full TCGdex card (any language) is of that kind; true without a kind.
 * @param {any} card
 * @param {string | null | undefined} key
 */
export function isKind(card, key) {
  const k = kindOf(key);
  if (!k) return true;
  const v = card?.[k.field];
  return typeof v === 'string' && Object.values(k.values).includes(v);
}

// @ts-check
// Rarity symbol of a card (the icons in public/rarities/: Scarlet & Violet ones from
// pokesymbols.com, older ones from Bulbapedia, user's choice) from TCGdex's rarity name, which
// comes translated in the card's language. Pocket rarities have none (those cards aren't searched).

/** Pocket rarities (diamonds, stars, crowns, shiny): those cards are not in the app's search. */
const POCKET = /diamant|diamond|\betoiles?\b|\bstars?\b|\bestrellas?\b|\b(un|deux) chromatiques?\b|one shiny|two shiny|couronne|crown|corona/;

/** Rules in order: the more specific names first (Mega Hyper before Hyper, Uncommon before Common). */
const RULES = /** @type {[RegExp, string][]} */ ([
  [POCKET, ''],
  [/promo/, 'promo'],
  [/nessuna|none|sans rarete|keine|ninguno|policrome/, ''],
  [/mega (hyper|iper|hiper)/, 'mega-hyper-rare'],
  [/mega attack/, 'mega-attack-rare'],
  [/black white|bianco e nero|noir blanc|schwarz|blanca y negra|preto e branco/, 'black-white-rare'],
  [/(special|speciale|besondere|especial).*(illustr|ilustr)|(illustr|ilustr).*(special|speciale|especial)/, 'special-illustration-rare'],
  [/illustr|ilustr/, 'illustration-rare'],
  [/ace spec|asso tattico|ass-klasse|as tactico|high-tech/, 'ace-spec-rare'],
  [/(shiny|cromatica|chromatique|schillernd|variocolor|brilhante).*ultra|ultra.*(shiny|cromatica|chromatique|schillernd|variocolor|brilhante)/, 'shiny-ultra-rare'],
  [/shiny|lucente/, 'shiny-rare'],
  [/hyper|iper|hiper/, 'hyper-rare'],
  [/double|doppia|doppel|doble|dupla/, 'double-rare'],
  [/ultra/, 'ultra-rare'],
  // Older rarities, symbols from Bulbapedia.
  [/lv\.x/, 'rare-holo-lvx'],
  [/legend/, 'legend'],
  [/prime|primus/, 'prime'],
  [/vmax/, 'holo-rare-vmax'],
  [/vstar/, 'holo-rare-vstar'],
  [/radiant|radieux|strahlend|radiante/, 'radiant-rare'],
  [/amazing|magnifique|atemberaubend|increible|incrive/, 'amazing-rare'],
  [/futuristic/, 'futuristic-rare'],
  [/rgb/, 'rgb-rare'],
  [/classic|classique|clasica|classica/, 'classic-collection'],
  // Secret rares carry the plain rare star on the card.
  [/secret|segreto|versteckt|secreta/, 'rare'],
  [/full art|arte completa|vollkunst|pikachu/, ''],
  [/uncommon|non comune|peu commune|ungewohnlich|incomum/, 'uncommon'],
  [/common|comune|commune|haufig|comun|comum/, 'common'],
  [/holo|olograf/, 'rare-holo'],
  [/rare|rara|raro|selten/, 'rare'],
]);

/** @param {string} rarity */
const norm = (rarity) =>
  rarity
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/** Whether a rarity belongs to TCG Pocket (left out of the rarity filter). @param {string} rarity */
export const isPocketRarity = (rarity) => POCKET.test(norm(rarity));

/**
 * File name of the rarity icon ("double-rare"), or null when the rarity has none.
 * @param {string | null | undefined} rarity TCGdex rarity, any language
 */
export function rarityIcon(rarity) {
  if (!rarity) return null;
  const r = rarity
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  for (const [re, icon] of RULES) if (re.test(r)) return icon || null;
  return null;
}

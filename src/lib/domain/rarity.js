// @ts-check
// Rarity symbol of a card (the icons in public/rarities/, from pokesymbols.com, user's choice)
// from TCGdex's rarity name, which comes translated in the card's language. Only the symbols
// printed on cards from Scarlet & Violet on have an icon; older or Pocket rarities show text.

/** Rules in order: the more specific names first (Mega Hyper before Hyper, Uncommon before Common). */
const RULES = /** @type {[RegExp, string][]} */ ([
  // Pocket (diamonds, stars, crowns, shiny) and older special rarities: no icon.
  [/diamant|diamond|\betoiles?\b|\bstars?\b|\bestrellas?\b|\b(un|deux) chromatiques?\b|one shiny|two shiny|couronne|crown|corona|promo|nessuna|none|sans rarete|keine|ninguno/, ''],
  [/mega (hyper|iper|hiper)/, 'mega-hyper-rare'],
  [/mega attack/, 'mega-attack-rare'],
  [/black white|bianco e nero|noir blanc|schwarz|blanca y negra|preto e branco/, 'black-white-rare'],
  [/(special|speciale|speciale|besondere|especial).*(illustr|ilustr)|(illustr|ilustr).*(special|speciale|especial)/, 'special-illustration-rare'],
  [/illustr|ilustr/, 'illustration-rare'],
  [/ace spec|asso tattico|ass-klasse|as tactico|high-tech/, 'ace-spec-rare'],
  [/(shiny|cromatica|chromatique|schillernd|variocolor|brilhante).*ultra|ultra.*(shiny|cromatica|chromatique|schillernd|variocolor|brilhante)/, 'shiny-ultra-rare'],
  [/shiny|lucente/, 'shiny-rare'],
  [/hyper|iper|hiper/, 'hyper-rare'],
  [/double|doppia|doppel|doble|dupla/, 'double-rare'],
  [/ultra/, 'ultra-rare'],
  // Before "rare": special old rarities keep their name only.
  [/secret|segreto|versteckt|secreta|amazing|magnifique|atemberaubend|increible|incrive|radiant|radieux|strahlend|radiante|legend|prime|primus|lv\.x|classic|full art|arte completa|vollkunst|pikachu|rgb|futuristic/, ''],
  [/uncommon|non comune|peu commune|ungewohnlich|incomum/, 'uncommon'],
  [/common|comune|commune|haufig|comun|comum/, 'common'],
  [/rare|rara|raro|selten|holo/, 'rare'],
]);

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

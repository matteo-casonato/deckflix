// @ts-check
// Deck lists in the text format of Pokémon TCG Live and tournament sites (SPEC § 4.2 bis):
//
//   Pokémon: 16
//   3 Miraidon ex SVI 81
//   Trainer: 34
//   4 Professor's Research SVI 189
//   Energy: 10
//   10 Basic {L} Energy SVE 4
//
// Each line: quantity, English name, set code (TCGdex `abbreviation.official`), number.

/** @typedef {'Pokémon' | 'Trainer' | 'Energy'} Section */
/** @typedef {{ qty: number, name: string, code: string, number: string, section: Section | null, raw: string, line: number }} ListLine */
/** @typedef {{ raw: string, line: number, reason: string }} ListError */

export const SECTIONS = /** @type {const} */ (['Pokémon', 'Trainer', 'Energy']);

/** @param {string} label */
function sectionOf(label) {
  const l = label.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (l.startsWith('pokemon')) return 'Pokémon';
  if (l.startsWith('trainer') || l.startsWith('allenator')) return 'Trainer';
  if (l.startsWith('energy') || l.startsWith('energi')) return 'Energy';
  return null;
}

/**
 * Reads a pasted list. Unrecognised lines are returned, never silently dropped.
 * @param {string} text
 * @returns {{ lines: ListLine[], errors: ListError[] }}
 */
export function parseDecklist(text) {
  /** @type {ListLine[]} */
  const lines = [];
  /** @type {ListError[]} */
  const errors = [];
  /** @type {Section | null} */
  let section = null;
  text.split(/\r?\n/).forEach((rawLine, i) => {
    const raw = rawLine.trim().replace(/^[*•-]\s*/, '');
    if (!raw) return;
    const header = raw.match(/^([A-Za-zÀ-ÿ' ]+?)\s*(?:\(\d+\)|:\s*\d*)$/);
    if (header) {
      const s = sectionOf(header[1]);
      if (s) section = s;
      // "Total Cards: 60" and other headers are ignored.
      return;
    }
    const m = raw.match(/^(\d{1,2})x?\s+(.+?)\s+([A-Z][A-Z0-9]{1,4}(?:-[A-Z0-9]{1,4})?)\s+([A-Za-z]{0,4}\d{1,4}[a-z]?)$/);
    if (!m) {
      errors.push({ raw: rawLine.trim(), line: i + 1, reason: 'Formato non riconosciuto: serve quantità, nome, sigla e numero' });
      return;
    }
    lines.push({ qty: Number(m[1]), name: m[2], code: m[3], number: m[4], section, raw: rawLine.trim(), line: i + 1 });
  });
  return { lines, errors };
}

/**
 * Writes a list in the same format. Sections in the standard order, with their totals.
 * @param {{ qty: number, name: string, code: string, number: string, section: Section }[]} cards
 */
export function serializeDecklist(cards) {
  const out = [];
  for (const section of SECTIONS) {
    const group = cards.filter((c) => c.section === section);
    if (!group.length) continue;
    out.push(`${section}: ${group.reduce((s, c) => s + c.qty, 0)}`);
    for (const c of group) out.push(`${c.qty} ${c.name} ${c.code} ${c.number}`);
    out.push('');
  }
  return out.join('\n').trim() + '\n';
}

/**
 * Number as written in lists: "081" → "81", "TG05" stays "TG05".
 * @param {string} localId
 */
export function listNumber(localId) {
  return /^\d+$/.test(localId) ? String(Number(localId)) : localId;
}

/** Energy type letters used by Pokémon TCG Live for basic Energy ("Basic {L} Energy"). */
const ENERGY_SYMBOL = /** @type {Record<string, string>} */ ({
  Grass: 'G',
  Fire: 'R',
  Water: 'W',
  Lightning: 'L',
  Psychic: 'P',
  Fighting: 'F',
  Darkness: 'D',
  Metal: 'M',
  Fairy: 'Y',
});

/**
 * Name as written in Pokémon TCG Live lists: basic Energy become "Basic {L} Energy".
 * @param {string} name English TCGdex name
 * @param {Section} section
 */
export function listName(name, section) {
  const m = section === 'Energy' ? name.match(/^(?:Basic )?(\w+) Energy$/) : null;
  return m && ENERGY_SYMBOL[m[1]] ? `Basic {${ENERGY_SYMBOL[m[1]]}} Energy` : name;
}

/**
 * Name suggested for an imported deck: its main rule-box Pokémon (ex, V, VSTAR, VMAX, GX),
 * most copies first, as tournament sites name archetypes ("Dragapult ex"). Lists copied from
 * Limitless carry only the cards, not the deck name.
 * @param {ListLine[]} lines
 */
export function suggestDeckName(lines) {
  const pokemon = lines.filter((l) => l.section === 'Pokémon' || l.section === null);
  const rule = pokemon.filter((l) => /\b(ex|EX|V|VSTAR|VMAX|GX)$/.test(l.name));
  const pick = [...(rule.length ? rule : pokemon)].sort((a, b) => b.qty - a.qty || a.line - b.line)[0];
  return pick?.name ?? '';
}

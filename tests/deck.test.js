import { describe, expect, it } from 'vitest';
import { listName, listNumber, parseDecklist, serializeDecklist } from '../src/lib/domain/decklist.js';
import { deckSummary, entryState, sameCard, sectionOfCard } from '../src/lib/domain/deck.js';

const LIST = `Pokémon: 16
3 Miraidon ex SVI 81
2 Raikou V BRS 48

Trainer: 34
4 Professor's Research SVI 189
4 Nest Ball SVI 181

Energy: 10
10 Basic {L} Energy SVE 4

Total Cards: 60`;

describe('parseDecklist', () => {
  it('reads sections and lines from a tournament list', () => {
    const { lines, errors } = parseDecklist(LIST);
    expect(errors).toEqual([]);
    expect(lines.map((l) => [l.qty, l.name, l.code, l.number, l.section])).toEqual([
      [3, 'Miraidon ex', 'SVI', '81', 'Pokémon'],
      [2, 'Raikou V', 'BRS', '48', 'Pokémon'],
      [4, "Professor's Research", 'SVI', '189', 'Trainer'],
      [4, 'Nest Ball', 'SVI', '181', 'Trainer'],
      [10, 'Basic {L} Energy', 'SVE', '4', 'Energy'],
    ]);
  });

  it('accepts PTCGL variants: bullets, x after the quantity, Italian headers, promo codes', () => {
    const { lines, errors } = parseDecklist('Allenatori (2)\n* 2x Iono PAL 185\n1 Pikachu PR-SV 27\n1 Gardevoir ex SVI TG05');
    expect(errors).toEqual([]);
    expect(lines.map((l) => `${l.qty}|${l.name}|${l.code}|${l.number}|${l.section}`)).toEqual([
      '2|Iono|PAL|185|Trainer',
      '1|Pikachu|PR-SV|27|Trainer',
      '1|Gardevoir ex|SVI|TG05|Trainer',
    ]);
  });

  it('never drops unrecognised lines silently', () => {
    const { lines, errors } = parseDecklist('3 Miraidon ex SVI 81\nquattro carte a caso\nMiraidon ex');
    expect(lines).toHaveLength(1);
    expect(errors.map((e) => [e.line, e.raw])).toEqual([
      [2, 'quattro carte a caso'],
      [3, 'Miraidon ex'],
    ]);
  });
});

describe('serializeDecklist', () => {
  it('writes sections with totals and round-trips', () => {
    const { lines } = parseDecklist(LIST);
    const text = serializeDecklist(/** @type {any} */ (lines));
    expect(text.startsWith('Pokémon: 5\n3 Miraidon ex SVI 81\n')).toBe(true);
    const again = parseDecklist(text).lines.map(({ qty, name, code, number, section }) => ({ qty, name, code, number, section }));
    expect(again).toEqual(lines.map(({ qty, name, code, number, section }) => ({ qty, name, code, number, section })));
    expect(serializeDecklist(/** @type {any} */ (parseDecklist(text).lines))).toBe(text);
  });

  it('writes basic Energy like Pokémon TCG Live', () => {
    expect(listName('Lightning Energy', 'Energy')).toBe('Basic {L} Energy');
    expect(listName('Darkness Energy', 'Energy')).toBe('Basic {D} Energy');
    expect(listName('Jet Energy', 'Energy')).toBe('Jet Energy');
    expect(listName('Lightning Energy', 'Trainer')).toBe('Lightning Energy');
  });

  it('formats numbers like the lists', () => {
    expect(listNumber('081')).toBe('81');
    expect(listNumber('TG05')).toBe('TG05');
  });
});

describe('sameCard', () => {
  const raikou = { name: 'Raikou V', category: 'Pokemon', attacks: [{ name: 'Lightning Rondo', damage: '20+' }], abilities: [{ name: 'Fleet-Footed' }] };
  it('matches Pokémon with the same attacks and abilities', () => {
    expect(sameCard(raikou, { ...raikou, image: 'full-art' })).toBe(true);
    expect(sameCard(raikou, { ...raikou, attacks: [{ name: 'Other', damage: '20' }] })).toBe(false);
  });
  it('matches Trainer and Energy cards by name', () => {
    expect(sameCard({ name: 'Nest Ball', category: 'Trainer', effect: 'a' }, { name: 'Nest Ball', category: 'Trainer', effect: 'b' })).toBe(true);
    expect(sameCard({ name: 'Nest Ball', category: 'Trainer' }, { name: 'Ultra Ball', category: 'Trainer' })).toBe(false);
  });
});

describe('entryState', () => {
  it('owned, other version, missing', () => {
    expect(entryState(3, 3, 0)).toEqual({ state: 'owned', have: 3, missing: 0 });
    expect(entryState(3, 1, 2)).toEqual({ state: 'other', have: 3, missing: 0 });
    expect(entryState(3, 1, 0)).toEqual({ state: 'missing', have: 1, missing: 2 });
  });
});

describe('deckSummary and sectionOfCard', () => {
  it('sums sections, missing cards and costs', () => {
    const s = deckSummary([
      { qty: 3, section: 'Pokémon', state: 'owned', missing: 0, price: 2 },
      { qty: 2, section: 'Pokémon', state: 'other', missing: 0, price: 1 },
      { qty: 4, section: 'Trainer', state: 'missing', missing: 4, price: 0.5 },
      { qty: 10, section: 'Energy', state: 'owned', missing: 0, price: null },
    ]);
    expect(s).toMatchObject({ total: 19, pokemon: 5, trainer: 4, energy: 10, missing: 4, owned: 15, otherVersion: 2, missingCost: 2, value: 10, percent: 79, complete: false });
  });
  it('maps TCGdex categories', () => {
    expect(sectionOfCard({ category: 'Trainer' })).toBe('Trainer');
    expect(sectionOfCard({ category: 'Energy' })).toBe('Energy');
    expect(sectionOfCard({ category: 'Allenatore' })).toBe('Trainer');
    expect(sectionOfCard({ category: 'Pokemon' })).toBe('Pokémon');
  });
});

import { describe, expect, it } from 'vitest';
import { listName, listNumber, parseDecklist, serializeDecklist, suggestDeckName } from '../src/lib/domain/decklist.js';
import { deckBreakdown, deckSummary, printedCode, tournamentSheet, entryState, openingHand, sameCard, sectionOfCard } from '../src/lib/domain/deck.js';

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

describe('suggestDeckName', () => {
  it('names the deck after its main rule-box Pokémon', () => {
    const { lines } = parseDecklist('Pokémon: 19\n4 Dreepy TWM 128\n3 Dragapult ex TWM 130\n1 Meowth ex POR 62\n\nTrainer: 1\n4 Ultra Ball MEG 131');
    expect(suggestDeckName(lines)).toBe('Dragapult ex');
  });
  it('falls back to the most played Pokémon, or nothing', () => {
    expect(suggestDeckName(parseDecklist('Pokémon: 6\n2 Pikachu SVI 1\n4 Raichu SVI 2').lines)).toBe('Raichu');
    expect(suggestDeckName([])).toBe('');
  });
});

// The Dragapult ex list from Limitless (my.limitlesstcg.com builder shows these numbers).
const P = (cardId, qty, stage) => ({ cardId, qty, section: 'Pokémon', card: { name: cardId, stage } });
const T = (cardId, qty, trainerType) => ({ cardId, qty, section: 'Trainer', card: { trainerType } });
const DRAGAPULT = [
  P('Dreepy', 4, 'Basic'), P('Drakloak', 4, 'Stage1'), P('Dragapult ex', 3, 'Stage2'), P('Munkidori', 2, 'Basic'),
  P('Budew', 2, 'Basic'), P('Dunsparce', 1, 'Basic'), P('Dudunsparce', 1, 'Stage1'), P('Meowth ex', 1, 'Basic'), P('Fezandipiti ex', 1, 'Basic'),
  T('sup', 11, 'Supporter'), T('item', 19, 'Item'), T('stadium', 2, 'Stadium'),
  { cardId: 'e', qty: 9, section: 'Energy', card: { energyType: 'Normal' } },
];

describe('deckBreakdown', () => {
  it('counts Basic/other Pokémon, trainer kinds and energy kinds', () => {
    expect(deckBreakdown(DRAGAPULT)).toEqual({
      pokemon: { basic: 11, other: 8, total: 19 },
      trainer: { item: 19, supporter: 11, stadium: 2, tool: 0, total: 32 },
      energy: { basic: 9, special: 0, total: 9 },
    });
  });
});

describe('openingHand', () => {
  it('matches the Limitless builder odds', () => {
    const h = openingHand(DRAGAPULT);
    const pct = (x) => Math.round(x * 10000) / 100;
    expect([pct(h.mulligan), pct(h.exactlyOne), pct(h.twoOrMore)]).toEqual([22.24, 51.22, 48.78]);
    expect(h.starters.slice(0, 2).map((s) => [s.name, pct(s.possible), pct(s.forced)])).toEqual([
      ['Dreepy', 51.38, 22.72],
      ['Munkidori', 28.48, 9.95],
    ]);
  });
  it('needs at least a hand of cards', () => {
    expect(openingHand([P('a', 3, 'Basic')])).toBe(null);
  });
});

describe('printedCode', () => {
  it('writes set code, padded number over the set size and regulation mark', () => {
    const set = { abbreviation: { official: 'BRS' }, cardCount: { official: 172 } };
    expect(printedCode({ localId: '048', regulationMark: 'F', set: {} }, set)).toBe('BRS 048/172 F');
    expect(printedCode({ localId: 'TG05', set: {} }, set)).toBe('BRS TG05');
    expect(printedCode({ localId: '16', set: { cardCount: { official: 107 } } })).toBe('16/107');
  });
});

describe('tournamentSheet', () => {
  it('lists Pokémon per print and merges Trainers and Energy by name', () => {
    const sets = new Map([['sv06', { abbreviation: { official: 'TWM' } }]]);
    const rows = [
      { cardId: 'sv06-128', qty: 4, section: 'Pokémon', card: { name: 'Dreepy', localId: '128', regulationMark: 'H', set: { id: 'sv06' } } },
      { cardId: 'me01-131', qty: 2, section: 'Trainer', card: { name: 'Ultra Ball', set: { id: 'me01' } } },
      { cardId: 'sv01-196', qty: 1, section: 'Trainer', card: { name: 'Ultra Ball', set: { id: 'sv01' } } },
      { cardId: 'mee-010', qty: 3, section: 'Energy', card: { name: 'Basic Fire Energy', set: { id: 'mee' } } },
    ];
    expect(tournamentSheet(rows, sets)).toEqual({
      pokemon: [{ qty: 4, name: 'Dreepy', set: 'TWM', number: '128', reg: 'H' }],
      trainer: [{ qty: 3, name: 'Ultra Ball' }],
      energy: [{ qty: 3, name: 'Basic Fire Energy' }],
      totals: { pokemon: 4, trainer: 3, energy: 3, all: 10 },
    });
  });
});

import { describe, expect, it } from 'vitest';
import { guessVariant, listVariants, variantPrice } from '../lab/scan/variants.js';

// Trimmed from the real TCGdex response for /it/cards/sv10-049 (Gyarados di Misty).
const gyarados = {
  variants: { normal: true, reverse: true, holo: true },
  variants_detailed: [
    { type: 'Reverse', pricing: { cardmarket: { trend: 0.12, 'trend-holo': 0.33 } } },
    { type: 'Olografica', pricing: { cardmarket: { trend: 0.12, 'trend-holo': 0.33 } } },
    { type: 'Olografica', stamp: ['Logo set'], pricing: { cardmarket: { trend: 24.01, 'trend-holo': 0 } } },
    { type: 'Normale', pricing: { cardmarket: { trend: 7.22, 'trend-holo': 0 } } },
    { type: 'Olografica', stamp: ['Logo set', 'Staff'], pricing: { cardmarket: { trend: 22.65, 'trend-holo': 0 } } },
  ],
};

describe('listVariants', () => {
  it('builds stable keys and Italian labels from variants_detailed', () => {
    const v = listVariants(gyarados);
    expect(v.map((o) => o.key)).toEqual([
      'reverse',
      'holo',
      'holo+stamp-logo-set',
      'normal',
      'holo+stamp-logo-set+stamp-staff',
    ]);
    expect(v[4].label).toBe('Olografica · timbro Logo set · timbro Staff');
  });

  it('uses English stamp keys and foils too', () => {
    const v = listVariants({
      variants_detailed: [
        { type: 'Olografica', stamp: ['30th-anniversary'] },
        { type: 'Reverse', foil: 'Cosmo' },
        { type: 'Normale', stamp: ['player-rewards-program'] },
      ],
    });
    expect(v.map((o) => o.label)).toEqual([
      'Olografica · timbro 30° anniversario',
      'Reverse · foil Cosmo',
      'Normale · timbro Play! Pokémon',
    ]);
  });

  it('falls back to the boolean variants', () => {
    expect(listVariants({ variants: { normal: true, reverse: true } }).map((o) => o.key)).toEqual(['normal', 'reverse']);
    expect(listVariants({})).toEqual([]);
  });
});

describe('variantPrice', () => {
  it('uses -holo fields for foils sharing the base product', () => {
    expect(variantPrice(gyarados.variants_detailed[0])).toBe(0.33);
  });

  it('uses trend for prints with their own product', () => {
    expect(variantPrice(gyarados.variants_detailed[2])).toBe(24.01);
    expect(variantPrice(gyarados.variants_detailed[3])).toBe(7.22);
  });

  it('returns null without prices', () => {
    expect(variantPrice({ type: 'Normale' })).toBeNull();
  });
});

describe('guessVariant', () => {
  const options = listVariants(gyarados);

  it('picks the stamp whose word is printed on the card', () => {
    expect(guessVariant(options, 'Gyarados di Misty STAFF 049/182')).toBe('holo+stamp-logo-set+stamp-staff');
  });

  it('defaults to the normal print', () => {
    expect(guessVariant(options, 'Gyarados di Misty')).toBe('normal');
  });

  it('auto-selects a single variant', () => {
    expect(guessVariant(listVariants({ variants_detailed: [{ type: 'Olografica', stamp: ['30th-anniversary'] }] }), '')).toBe(
      'holo+stamp-30th-anniversary',
    );
  });
});

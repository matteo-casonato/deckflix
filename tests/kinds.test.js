import { describe, expect, it } from 'vitest';
import { isKind, kindFilter } from '../src/lib/domain/kinds.js';

describe('card kinds', () => {
  it('builds the TCGdex filter in the card language', () => {
    expect(kindFilter('item', 'it')).toEqual(['trainerType', 'Strumento']);
    expect(kindFilter('tool', 'it')).toEqual(['trainerType', 'Oggetto']);
    expect(kindFilter('supporter', 'de')).toEqual(['trainerType', 'Unterstützerkarte']);
    expect(kindFilter('basic-energy', 'fr')).toEqual(['energyType', 'De base']);
    expect(kindFilter('trainer', 'pt')).toEqual(['category', 'Treinador']);
    expect(kindFilter('', 'it')).toBe(null);
  });
  it('recognises a card of any language', () => {
    const ultraBall = { category: 'Allenatore', trainerType: 'Strumento' };
    expect(isKind(ultraBall, 'trainer')).toBe(true);
    expect(isKind(ultraBall, 'item')).toBe(true);
    expect(isKind(ultraBall, 'supporter')).toBe(false);
    expect(isKind({ category: 'Energy', energyType: 'Special' }, 'special-energy')).toBe(true);
    expect(isKind({ category: 'Pokémon' }, 'pokemon')).toBe(true);
    expect(isKind({ category: 'Pokémon' }, '')).toBe(true);
  });
});

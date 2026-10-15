import { describe, expect, it } from 'vitest';
import { normalizeNumber, parseSearchQuery, withSets } from '../src/lib/domain/searchQuery.js';

describe('parseSearchQuery', () => {
  it('reads number and set size', () => {
    expect(parseSearchQuery('Charizard 11/78')).toEqual({ name: 'Charizard', number: '11', total: 78, codes: [] });
    expect(parseSearchQuery('Raikou V GG41 / GG70')).toMatchObject({ name: 'Raikou V', number: 'GG41', total: null });
    expect(parseSearchQuery('pikachu #025')).toMatchObject({ name: 'pikachu', number: '025', total: null });
  });
  it('keeps possible set codes both as codes and in the name', () => {
    expect(parseSearchQuery('Charizard svi')).toEqual({ name: 'Charizard svi', number: null, total: null, codes: ['svi'] });
    expect(parseSearchQuery('sv03.5 25')).toEqual({ name: 'sv03.5', number: '25', total: null, codes: ['sv03.5'] });
    expect(parseSearchQuery('Mew ex').codes).toEqual(['Mew']);
  });
});

describe('withSets', () => {
  it('drops the matched code from the name when something else narrows the search', () => {
    expect(withSets(parseSearchQuery('Charizard svi'), ['svi'])).toEqual({ name: 'Charizard', useSets: true, number: null });
    expect(withSets(parseSearchQuery('svi 25'), ['svi'])).toEqual({ name: '', useSets: true, number: '25' });
  });
  it('turns an alphanumeric word that is not a set into the card number', () => {
    expect(withSets(parseSearchQuery('Raikou V GG41'), [])).toEqual({ name: 'Raikou V', useSets: false, number: 'GG41' });
  });
  it('keeps a lone word as a name', () => {
    expect(withSets(parseSearchQuery('mew'), ['mew'])).toEqual({ name: 'mew', useSets: false, number: null });
    expect(withSets(parseSearchQuery('mew ex'), ['mew'])).toEqual({ name: 'mew ex', useSets: false, number: null });
    expect(withSets(parseSearchQuery('Charizard'), [])).toEqual({ name: 'Charizard', useSets: false, number: null });
  });
});

describe('normalizeNumber', () => {
  it('ignores leading zeros and case', () => {
    expect(normalizeNumber('011')).toBe('11');
    expect(normalizeNumber('tg05')).toBe('TG5');
    expect(normalizeNumber('GG41')).toBe('GG41');
  });
});

import { describe, expect, it } from 'vitest';
import { addCopies, collectionKey } from '../src/lib/domain/collection.js';

const card = { cardId: 'sv03.5-025', setId: 'sv03.5', lang: 'it', variant: 'normal' };

describe('collectionKey', () => {
  it('separates languages and variants', () => {
    expect(collectionKey('sv03.5-025', 'it', 'normal')).toBe('sv03.5-025|it|normal');
    expect(collectionKey('sv03.5-025', 'it', 'reverse')).not.toBe(collectionKey('sv03.5-025', 'en', 'reverse'));
    // Near Mint keeps the original key; other conditions get their own group.
    expect(collectionKey('sv03.5-025', 'it', 'normal', 'NM')).toBe('sv03.5-025|it|normal');
    expect(collectionKey('sv03.5-025', 'it', 'normal', 'LP')).toBe('sv03.5-025|it|normal|LP');
  });
});

describe('addCopies', () => {
  it('creates an entry, then increments it keeping addedAt', () => {
    const first = addCopies(undefined, card, 1, 100);
    expect(first).toMatchObject({ key: 'sv03.5-025|it|normal', qty: 1, addedAt: 100, updatedAt: 100 });
    const second = addCopies(first ?? undefined, card, 1, 200);
    expect(second).toMatchObject({ qty: 2, addedAt: 100, updatedAt: 200 });
  });

  it('returns null when the quantity reaches zero', () => {
    const one = addCopies(undefined, card, 1, 100);
    expect(addCopies(one ?? undefined, card, -1, 200)).toBeNull();
    expect(addCopies(undefined, card, -3, 200)).toBeNull();
  });
});

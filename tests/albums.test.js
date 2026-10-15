import { describe, expect, it } from 'vitest';
import { albumCover, autoAlbum, isFullArt, ownedTiles } from '../src/lib/domain/albums.js';

const card = (id, o = {}) => [id, { id, name: id, rarity: 'Comune', pricing: { cardmarket: { trend: 1, 'trend-holo': 2, avg7: 1, avg30: 1, ...o.cm } }, ...o }];
const cards = new Map([
  card('a', { name: 'Pikachu', dexId: [25], illustrator: 'Kimura' }),
  card('b', { name: 'Pikachu ex', dexId: [25], rarity: 'Rara illustrazione speciale', illustrator: 'Kimura', cm: { trend: 50, avg7: 60, avg30: 40 } }),
  card('c', { name: 'Mewtwo', dexId: [150], illustrator: 'Arita', cm: { trend: 5, 'trend-holo': 5 } }),
  card('d', { name: 'Ball', category: 'Allenatore', cm: { trend: 0, 'trend-holo': 0 } }),
]);
const e = (cardId, qty, variant = 'normal') => ({ key: `${cardId}|it|${variant}`, cardId, setId: 's', lang: 'it', variant, qty, addedAt: 0, updatedAt: 0 });
const tiles = ownedTiles([e('a', 2), e('a', 1, 'reverse'), e('b', 1), e('c', 1, 'holo'), e('d', 4)], cards);
const ids = (groups) => groups.map((g) => [g.title, g.tiles.map((t) => t.cardId)]);

describe('ownedTiles', () => {
  it('merges copies of a card, keeping the highest unit price and the total value', () => {
    expect(tiles.find((t) => t.cardId === 'a')).toEqual({ cardId: 'a', qty: 3, unit: 2, value: 4, variants: ['normal', 'reverse'] });
  });
});

describe('autoAlbum', () => {
  it('ranks by price, skipping unpriced cards', () => {
    expect(ids(autoAlbum('top10', tiles, cards))).toEqual([['', ['b', 'c', 'a']]]);
  });
  it('filters rising, full art, duplicates and holo/reverse', () => {
    expect(ids(autoAlbum('rising', tiles, cards))).toEqual([['', ['b']]]);
    expect(ids(autoAlbum('fullart', tiles, cards))).toEqual([['', ['b']]]);
    expect(ids(autoAlbum('duplicates', tiles, cards))).toEqual([['', ['d', 'a']]]);
    expect(ids(autoAlbum('holo', tiles, cards))).toEqual([['', ['c', 'a']]]);
  });
  it('groups by Pokémon (shortest name as title) and by illustrator, only groups of two or more', () => {
    expect(ids(autoAlbum('pokemon', tiles, cards))).toEqual([['Pikachu', ['b', 'a']]]);
    expect(ids(autoAlbum('artist', tiles, cards))).toEqual([['Kimura', ['b', 'a']]]);
  });
  it('is empty for an empty collection or an unknown id', () => {
    expect(autoAlbum('top10', [], cards)).toEqual([]);
    expect(autoAlbum('nope', tiles, cards)).toEqual([]);
  });
});

describe('isFullArt and albumCover', () => {
  it('recognises full-art rarities in Italian and English', () => {
    expect(isFullArt({ rarity: 'Special illustration rare' })).toBe(true);
    expect(isFullArt({ rarity: 'Comune' })).toBe(false);
  });
  it('uses the most valuable card, even one not owned', () => {
    const album = { id: 'x', name: 'X', cards: [{ cardId: 'a', addedAt: 1 }, { cardId: 'c', addedAt: 2 }, { cardId: 'zz', addedAt: 3 }], createdAt: 0, updatedAt: 0 };
    expect(albumCover(album, cards)).toBe('c');
    expect(albumCover({ ...album, cards: [] }, cards)).toBe(null);
  });
});

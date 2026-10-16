import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  cardByNumber,
  cardmarketUrl,
  copyPrice,
  parseQuickNumber,
  priceTrend,
  pricesDate,
  setIdOf,
  setProgress,
} from '../src/lib/domain/cards.js';

const fixture = (path) => JSON.parse(readFileSync(new URL(`./fixtures/tcgdex/${path}.json`, import.meta.url), 'utf8'));

describe('setIdOf', () => {
  it('drops the number after the last dash', () => {
    expect(setIdOf('sv03.5-025')).toBe('sv03.5');
    expect(setIdOf('30th-c-001')).toBe('30th-c');
    expect(setIdOf('swsh12.5-GG01')).toBe('swsh12.5');
  });
});

describe('parseQuickNumber', () => {
  it('accepts 25, 025 and 25/165 as the same card', () => {
    expect(parseQuickNumber('25')).toEqual({ number: '25', total: null });
    expect(parseQuickNumber('025')).toEqual({ number: '025', total: null });
    expect(parseQuickNumber('tg25/tg30')).toEqual({ number: 'TG25', total: null });
    expect(parseQuickNumber('swsh302')).toEqual({ number: 'SWSH302', total: null });
    expect(parseQuickNumber(' 25 / 165 ')).toEqual({ number: '25', total: 165 });
  });

  it('rejects anything else', () => {
    expect(parseQuickNumber('')).toBeNull();
    expect(parseQuickNumber('0')).toBeNull();
    expect(parseQuickNumber('abc')).toBeNull();
  });
});

describe('cardByNumber', () => {
  const set = fixture('it/sets/sv03.5');
  it('finds the card in a real set by number', () => {
    expect(cardByNumber(set.cards, 25)?.name).toBe('Pikachu');
    expect(cardByNumber(set.cards, '025')?.name).toBe('Pikachu');
    expect(cardByNumber([{ localId: 'TG05', name: 'Gardevoir' }], 'tg5')?.name).toBe('Gardevoir');
    expect(cardByNumber(set.cards, 999)).toBeNull();
  });
});

describe('setProgress', () => {
  it('counts owned, missing, duplicates; secret rares do not count towards 100%', () => {
    const entries = [
      { cardId: 'sv03.5-025', qty: 2 },
      { cardId: 'sv03.5-025', qty: 1 },
      { cardId: 'sv03.5-001', qty: 1 },
      { cardId: 'sv03.5-199', qty: 1 },
    ];
    expect(setProgress({ official: 165 }, entries)).toEqual({
      owned: 2,
      distinct: 3,
      total: 165,
      missing: 163,
      duplicates: 2,
      copies: 5,
      percent: 1,
    });
  });
});

describe('copyPrice', () => {
  const pikachu = fixture('it/cards/sv03.5-025');
  const gyarados = fixture('it/cards/sv10-049');

  it('uses the price of the print from variants_detailed', () => {
    expect(copyPrice(pikachu, 'normal')).toBe(pikachu.pricing.cardmarket.trend);
    expect(copyPrice(gyarados, 'holo+stamp-logo-set')).toBeGreaterThan(copyPrice(gyarados, 'holo'));
  });

  it('falls back to the card pricing and handles missing prices', () => {
    const plain = { pricing: { cardmarket: { trend: 2, 'trend-holo': 5 } } };
    expect(copyPrice(plain, 'normal')).toBe(2);
    expect(copyPrice(plain, 'reverse')).toBe(5);
    expect(copyPrice({}, 'normal')).toBeNull();
    expect(copyPrice(null, 'normal')).toBeNull();
  });
});

describe('priceTrend', () => {
  it('compares the 7 and 30 day averages', () => {
    expect(priceTrend({ pricing: { cardmarket: { avg7: 12, avg30: 10 } } })).toBe('up');
    expect(priceTrend({ pricing: { cardmarket: { avg7: 8, avg30: 10 } } })).toBe('down');
    expect(priceTrend({ pricing: { cardmarket: { avg7: 10, avg30: 10 } } })).toBe('flat');
    expect(priceTrend({})).toBeNull();
  });
});

describe('pricesDate', () => {
  const now = new Date('2026-10-15T12:00:00').getTime();
  it('labels the day and flags old prices', () => {
    expect(pricesDate('2026-10-15T08:00:00', now)).toEqual({ label: 'Prezzi di oggi', old: false });
    expect(pricesDate('2026-10-14T08:00:00', now)).toEqual({ label: 'Prezzi di ieri', old: false });
    expect(pricesDate('2026-10-10T08:00:00', now)).toEqual({ label: 'Prezzi del 10/10', old: true });
    expect(pricesDate(undefined, now)).toBeNull();
  });
});

describe('cardmarketUrl', () => {
  it('searches by name with the language filter', () => {
    expect(cardmarketUrl('Pikachu ex', 'it')).toBe(
      'https://www.cardmarket.com/it/Pokemon/Products/Search?searchString=Pikachu+ex&language=5',
    );
  });
  it('opens the product page when TCGdex has its id, preferring the print of the copy', () => {
    const card = { name: 'Pikachu', pricing: { cardmarket: { idProduct: 733620 } } };
    expect(cardmarketUrl(card, 'it')).toBe('https://www.cardmarket.com/it/Pokemon/Products?idProduct=733620&language=5');
    expect(cardmarketUrl(card, 'en', 748474)).toBe('https://www.cardmarket.com/it/Pokemon/Products?idProduct=748474&language=1');
    expect(cardmarketUrl({ name: 'Old card' }, 'it')).toContain('/Search?searchString=Old+card');
  });
});

describe('euro and variantBadge', async () => {
  const { euro, variantBadge } = await import('../src/lib/domain/cards.js');
  it('formats like the mockups', () => {
    expect(euro(168.4)).toBe('€ 168,40');
    expect(euro(1234.5)).toBe('€ 1234,50');
    expect(euro(12345.5)).toBe('€ 12.345,50');
    expect(euro(null)).toBe('—');
  });
  it('labels variants in grids', () => {
    expect(variantBadge('normal')).toBeNull();
    expect(variantBadge('reverse')).toBe('Rev');
    expect(variantBadge('holo+foil-cosmos')).toBe('Holo');
    expect(variantBadge('normal+stamp-player-rewards-program')).toBe('Timbro');
  });
});

describe('guessImage', async () => {
  const { guessImage, imageAt } = await import('../src/lib/domain/cards.js');
  it('builds the asset path, gallery cards in the folder of their main set', () => {
    expect(guessImage('swsh12tg-TG20', 'TG20')).toBe('https://assets.tcgdex.net/en/swsh/swsh12/TG20');
    expect(guessImage('mep-028', '028')).toBe('https://assets.tcgdex.net/en/me/mep/028');
    expect(guessImage('swsh4.5sv-SV107', 'SV107')).toBe('https://assets.tcgdex.net/en/swsh/swsh4.5/SV107');
    // Classic Collection of the 30th: TCGdex has no images, Limitless does.
    const cc = guessImage('30th-c-001', '001');
    expect(cc).toBe('https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/30C/30C_CC1_R_EN');
    expect(imageAt(cc)).toBe(`${cc}_SM.png`);
    expect(imageAt(cc, 'high')).toBe(`${cc}_LG.png`);
    expect(imageAt('https://assets.tcgdex.net/en/sv/sv03/1')).toBe('https://assets.tcgdex.net/en/sv/sv03/1/low.webp');
    expect(guessImage('sm7.5-3', '3')).toBe('https://assets.tcgdex.net/en/sm/sm75/3');
    expect(guessImage('sv03.5-025', '025', 'it')).toBe('https://assets.tcgdex.net/it/sv/sv03.5/025');
    expect(guessImage('cel25-11', '11')).toBe('https://assets.tcgdex.net/en/swsh/cel25/11');
    expect(guessImage('sm7.5-3', '3')).toBe('https://assets.tcgdex.net/en/sm/sm75/3');
    expect(guessImage('swsh4.5-SV001', 'SV001')).toBe('https://assets.tcgdex.net/en/swsh/swsh4.5/SV001');
    expect(guessImage('A1-001', '001')).toBe(null);
  });
});

describe('cheapestPrice', async () => {
  const { cheapestPrice } = await import('../src/lib/domain/cards.js');
  it('takes the cheapest priced print', () => {
    const card = { variants_detailed: [{ type: 'Normale', pricing: { cardmarket: { trend: 7.2 } } }, { type: 'Olografica', pricing: { cardmarket: { trend: 0.3, 'trend-holo': 0.33 } } }] };
    expect(cheapestPrice(card)).toBe(0.33);
    expect(cheapestPrice({})).toBe(null);
    expect(cheapestPrice(null)).toBe(null);
  });
});

describe('standardPrint and printBadge', async () => {
  const { printBadge, standardPrint } = await import('../src/lib/domain/cards.js');
  const holoOnly = { variants_detailed: [{ type: 'Olografica', pricing: {} }] };
  const common = { variants_detailed: [{ type: 'Normale' }, { type: 'Reverse' }, { type: 'Normale', stamp: ['pokemon-together'] }] };
  it('treats the only holo print of rares as the card itself', () => {
    expect(standardPrint(holoOnly)).toBe('holo');
    expect(printBadge(holoOnly, 'holo')).toBe(null);
  });
  it('tags reverse and stamped copies of commons, not the normal print', () => {
    expect(standardPrint(common)).toBe('normal');
    expect(printBadge(common, 'normal')).toBe(null);
    expect(printBadge(common, 'reverse')).toBe('Rev');
    expect(printBadge(common, 'normal+stamp-pokemon-together')).toBe('Timbro');
  });
  it('without card data only shows unambiguous tags', () => {
    expect(printBadge(null, 'holo')).toBe(null);
    expect(printBadge(null, 'reverse')).toBe('Rev');
  });
});

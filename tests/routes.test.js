import { describe, expect, it } from 'vitest';
import { hrefFor, matchRoute } from '../src/lib/domain/routes.js';

describe('matchRoute', () => {
  it('treats an empty hash as home', () => {
    expect(matchRoute('')).toEqual({ name: 'home', params: {} });
    expect(matchRoute('#/')).toEqual({ name: 'home', params: {} });
  });

  it('matches static routes', () => {
    expect(matchRoute('#/collection').name).toBe('collection');
    expect(matchRoute('#/deck').name).toBe('deck');
  });

  it('extracts and decodes params', () => {
    expect(matchRoute('#/card/it/sv03.5-025')).toEqual({ name: 'card', params: { lang: 'it', id: 'sv03.5-025' } });
    expect(matchRoute('#/set/sv03.5')).toEqual({ name: 'set', params: { id: 'sv03.5' } });
  });

  it('ignores the query string', () => {
    expect(matchRoute('#/collection?tab=wishlist').name).toBe('collection');
  });

  it('returns notFound for unknown paths', () => {
    expect(matchRoute('#/nope').name).toBe('notFound');
    expect(matchRoute('#/card/it').name).toBe('notFound');
  });
});

describe('hrefFor', () => {
  it('builds hashes with encoded params', () => {
    expect(hrefFor('card', { lang: 'it', id: 'sv03.5-025' })).toBe('#/card/it/sv03.5-025');
    expect(hrefFor('home')).toBe('#/home');
  });

  it('round-trips through matchRoute', () => {
    const route = { name: 'card', params: { lang: 'en', id: 'cel25c-2_A' } };
    expect(matchRoute(hrefFor(route.name, route.params))).toEqual(route);
  });
});

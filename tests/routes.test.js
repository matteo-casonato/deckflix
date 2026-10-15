import { describe, expect, it } from 'vitest';
import { hrefFor, matchRoute } from '../src/lib/domain/routes.js';

describe('matchRoute', () => {
  it('treats an empty hash as home', () => {
    expect(matchRoute('')).toEqual({ name: 'home', params: {}, query: {} });
    expect(matchRoute('#/')).toEqual({ name: 'home', params: {}, query: {} });
  });

  it('matches static routes', () => {
    expect(matchRoute('#/collection').name).toBe('collection');
    expect(matchRoute('#/deck').name).toBe('deck');
  });

  it('extracts and decodes params', () => {
    expect(matchRoute('#/card/it/sv03.5-025')).toMatchObject({ name: 'card', params: { lang: 'it', id: 'sv03.5-025' } });
    expect(matchRoute('#/set/sv03.5')).toMatchObject({ name: 'set', params: { id: 'sv03.5' } });
  });

  it('parses the query string', () => {
    expect(matchRoute('#/collection?tab=wishlist')).toMatchObject({ name: 'collection', query: { tab: 'wishlist' } });
    expect(matchRoute('#/search?q=char%20ex&mine=1').query).toEqual({ q: 'char ex', mine: '1' });
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

  it('round-trips through matchRoute, with a query', () => {
    const route = { name: 'card', params: { lang: 'en', id: 'cel25c-2_A' }, query: {} };
    expect(matchRoute(hrefFor(route.name, route.params))).toEqual(route);
    expect(hrefFor('search', {}, { q: 'pika', mine: '' })).toBe('#/search?q=pika');
    expect(matchRoute(hrefFor('quick', {}, { set: 'sv03.5' }))).toMatchObject({ name: 'quick', query: { set: 'sv03.5' } });
  });
});

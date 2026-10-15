import { describe, expect, it } from 'vitest';
import { CARD_TTL, DAY, cacheDecision, freshnessLabel } from '../src/lib/domain/cache.js';

const now = new Date('2026-10-15T10:00:00').getTime();

describe('cacheDecision', () => {
  it('uses a fresh copy without the network', () => {
    expect(cacheDecision({ fetchedAt: now - 1000 }, { now, ttl: CARD_TTL, online: true })).toBe('cache');
    expect(cacheDecision({ fetchedAt: now - 1000 }, { now, ttl: CARD_TTL, online: false })).toBe('cache');
  });

  it('refreshes a stale copy when online', () => {
    expect(cacheDecision({ fetchedAt: now - 2 * DAY }, { now, ttl: CARD_TTL, online: true })).toBe('network');
  });

  it('serves a stale copy when offline', () => {
    expect(cacheDecision({ fetchedAt: now - 2 * DAY }, { now, ttl: CARD_TTL, online: false })).toBe('stale');
  });

  it('goes to the network without a copy, or fails offline', () => {
    expect(cacheDecision(undefined, { now, ttl: CARD_TTL, online: true })).toBe('network');
    expect(cacheDecision(null, { now, ttl: CARD_TTL, online: false })).toBe('fail');
  });
});

describe('freshnessLabel', () => {
  it('says today, yesterday or the date', () => {
    expect(freshnessLabel(now - 60_000, now)).toBe('oggi');
    expect(freshnessLabel(now - DAY, now)).toBe('ieri');
    expect(freshnessLabel(new Date('2026-10-12T09:00:00').getTime(), now)).toBe('il 12/10');
    expect(freshnessLabel(new Date('2026-10-11T09:00:00').getTime(), now)).toBe("l'11/10");
    expect(freshnessLabel(new Date('2026-10-08T09:00:00').getTime(), now)).toBe("l'08/10");
  });
});

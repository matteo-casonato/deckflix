import { describe, expect, it } from 'vitest';
import { isUncertain } from '../src/lib/scan/matcher.js';

const c = (o) => ({ id: 'x', localId: '1', name: 'X', setId: 's', setName: 'S', setCode: null, official: 1, releaseDate: '', lang: 'it', nameScore: 0, codeMatch: false, ...o });

describe('isUncertain', () => {
  it('trusts a set code match or a clear name match', () => {
    expect(isUncertain([c({ codeMatch: true, nameScore: 0.2 })])).toBe(false);
    expect(isUncertain([c({ nameScore: 0.95 }), c({ nameScore: 0.3 })])).toBe(false);
  });

  it('ignores classic-collection reprints when looking for ties', () => {
    expect(isUncertain([c({ nameScore: 1 }), c({ nameScore: 1, reprint: true })])).toBe(false);
  });

  it('flags no candidates, weak names and ties', () => {
    expect(isUncertain([])).toBe(true);
    expect(isUncertain([c({ nameScore: 0.4 })])).toBe(true);
    expect(isUncertain([c({ nameScore: 0.8 }), c({ nameScore: 0.75 })])).toBe(true);
  });
});

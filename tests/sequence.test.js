import { describe, expect, it } from 'vitest';
import { neighbours } from '../src/lib/domain/sequence.js';

describe('neighbours', () => {
  const ids = ['a-1', 'a-2', 'a-3'];
  it('gives previous, next and position', () => {
    expect(neighbours(ids, 'a-2')).toEqual({ prev: 'a-1', next: 'a-3', index: 2, total: 3 });
  });
  it('has no previous on the first card and no next on the last', () => {
    expect(neighbours(ids, 'a-1')).toMatchObject({ prev: null, next: 'a-2' });
    expect(neighbours(ids, 'a-3')).toMatchObject({ prev: 'a-2', next: null });
  });
  it('is null outside the list or for a single card', () => {
    expect(neighbours(ids, 'b-1')).toBeNull();
    expect(neighbours(['a-1'], 'a-1')).toBeNull();
  });
});

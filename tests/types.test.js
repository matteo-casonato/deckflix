import { describe, expect, it } from 'vitest';
import { sortTypes, typeIcon } from '../src/lib/domain/types.js';

describe('typeIcon', () => {
  it('reads the type in every card language', () => {
    expect(typeIcon('Erba')).toBe('grass');
    expect(typeIcon('Oscurità')).toBe('darkness');
    expect(typeIcon('Électrique')).toBe('lightning');
    expect(typeIcon('Psíquico')).toBe('psychic');
    expect(typeIcon('Metálica')).toBe('metal');
    expect(typeIcon('Farblos')).toBe('colorless');
    expect(typeIcon('Fée')).toBe('fairy');
    expect(typeIcon('Dragão')).toBe('dragon');
    expect(typeIcon('Boh')).toBe(null);
  });
  it('sorts the types as the game does', () => {
    expect(sortTypes(['Acqua', 'Drago', 'Erba', 'Folletto', 'Fuoco', 'Incolore', 'Lampo', 'Lotta', 'Metallo', 'Oscurità', 'Psico'])).toEqual([
      'Erba', 'Fuoco', 'Acqua', 'Lampo', 'Psico', 'Lotta', 'Oscurità', 'Metallo', 'Folletto', 'Drago', 'Incolore',
    ]);
  });
});

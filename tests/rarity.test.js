import { describe, expect, it } from 'vitest';
import { rarityIcon } from '../src/lib/domain/rarity.js';
import { SET_SYMBOLS, setSymbolUrl } from '../src/lib/domain/setSymbols.js';

describe('rarityIcon', () => {
  it('reads the rarity in every card language', () => {
    expect(rarityIcon('Rara doppia')).toBe('double-rare');
    expect(rarityIcon('Double rare')).toBe('double-rare');
    expect(rarityIcon('Rara illustrazione speciale')).toBe('special-illustration-rare');
    expect(rarityIcon('Selten, besondere Illustration')).toBe('special-illustration-rare');
    expect(rarityIcon('Rara illustrazione')).toBe('illustration-rare');
    expect(rarityIcon('rara ASSO TATTICO')).toBe('ace-spec-rare');
    expect(rarityIcon('ultrarara cromatica')).toBe('shiny-ultra-rare');
    expect(rarityIcon('Chromatique ultra rare')).toBe('shiny-ultra-rare');
    expect(rarityIcon('Rara Lucente')).toBe('shiny-rare');
    expect(rarityIcon('Mega Iper Raro')).toBe('mega-hyper-rare');
    expect(rarityIcon('Rara iper')).toBe('hyper-rare');
    expect(rarityIcon('Schwarz-Weiß Selten')).toBe('black-white-rare');
    expect(rarityIcon('Ultrarara')).toBe('ultra-rare');
  });
  it('tells Uncommon from Common and keeps holo rares as Rare', () => {
    expect(rarityIcon('Non comune')).toBe('uncommon');
    expect(rarityIcon('Peu Commune')).toBe('uncommon');
    expect(rarityIcon('Comune')).toBe('common');
    expect(rarityIcon('Häufig')).toBe('common');
    expect(rarityIcon('Olografica Rara VSTAR')).toBe('rare');
    expect(rarityIcon('Rara')).toBe('rare');
  });
  it('has no icon for Pocket and old special rarities', () => {
    expect(rarityIcon('Une Étoile')).toBe(null);
    expect(rarityIcon('Two Diamond')).toBe(null);
    expect(rarityIcon('Un Chromatique')).toBe(null);
    expect(rarityIcon('Segreto rara')).toBe(null);
    expect(rarityIcon('Rare Holo LV.X')).toBe(null);
    expect(rarityIcon('Nessuna')).toBe(null);
    expect(rarityIcon(undefined)).toBe(null);
  });
});

describe('setSymbolUrl', () => {
  it('links the pokesymbols symbol of a TCGdex set', () => {
    expect(SET_SYMBOLS.sv03).toBe('obsidian-flames');
    expect(setSymbolUrl('sv03.5')).toBe('https://pokesymbols.com/images/tcg/sets/symbols/151.png');
    expect(setSymbolUrl('A1')).toBe(null);
  });
});

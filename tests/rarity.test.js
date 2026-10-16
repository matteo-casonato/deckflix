import { describe, expect, it } from 'vitest';
import { rarityIcon } from '../src/lib/domain/rarity.js';
import { SET_SYMBOLS, setLogoUrl, setSymbolUrl } from '../src/lib/domain/setSymbols.js';
import { prereleaseSet } from '../src/lib/domain/upcomingSets.js';

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
    expect(setLogoUrl('sv03')).toBe('https://pokesymbols.com/images/tcg/sets/logos/obsidian-flames.png');
    expect(setLogoUrl('sv03', 'https://assets.tcgdex.net/it/sv/sv03/logo')).toBe('https://assets.tcgdex.net/it/sv/sv03/logo.png');
    expect(setLogoUrl('svp')).toBe(null);
  });
});

describe('prereleaseSet', () => {
  const sets = [
    { en: 'Delta Reign', it: 'Dominio Delta', release: '2026-11-06', logo: 'dr.png' },
    { en: 'Next Set', it: 'Set Successivo', release: '2027-01-29', logo: 'ns.png' },
  ];
  it('finds the set named in the title, in English or Italian', () => {
    expect(prereleaseSet('pre-release Delta Reign Sora', '2026-10-24T16:00', sets)?.en).toBe('Delta Reign');
    expect(prereleaseSet('Prerelease DOMINIO DELTA - Ludi&Co', '2026-10-25T10:00', sets)?.en).toBe('Delta Reign');
    expect(prereleaseSet('Pre-release Set Successivo', '2027-01-10T10:00', sets)?.en).toBe('Next Set');
  });
  it('else picks the set coming out in the next three weeks', () => {
    expect(prereleaseSet('Torneo Win a PRERELEASE', '2026-10-19T20:00', sets)?.en).toBe('Delta Reign');
    expect(prereleaseSet('Prerelease', '2026-12-01T10:00', sets)).toBe(null);
  });
});

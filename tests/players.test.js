import { describe, expect, it } from 'vitest';
import { ageDivision, playerQrText, seasonYear, validPlayerId } from '../src/lib/domain/players.js';
import { qrMatrix } from '../src/lib/domain/qr.js';

const alessio = { id: 'x', name: 'Alessio Casonato', playerId: '4359311', birthYear: 2015 };

describe('playerQrText', () => {
  it('reproduces the official check-in code (decoded from the Pokémon app)', () => {
    expect(playerQrText(alessio, new Date(2026, 9, 15, 18, 19).getTime())).toBe(
      'eyJwaSI6IjQzNTkzMTEiLCJmbiI6IkFsZXNzaW8iLCJsaSI6IkMiLCJieSI6IjIwMTUiLCJlIjoiMjAyNi0xMC0yNSJ9',
    );
  });
  it('keeps middle names in the first name and encodes accents as UTF-8', () => {
    const text = playerQrText({ ...alessio, name: 'Maria Chiara Bianchi' }, new Date(2026, 0, 1).getTime());
    const json = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(text), (c) => c.charCodeAt(0))));
    expect(json).toEqual({ pi: '4359311', fn: 'Maria Chiara', li: 'B', by: '2015', e: '2026-01-11' });
  });
});

describe('ageDivision', () => {
  it('follows the season (2026 season: Junior 2014+, Senior 2010–2013, Master ≤ 2009)', () => {
    const march2026 = new Date(2026, 2, 1).getTime();
    expect(seasonYear(march2026)).toBe(2026);
    expect([2014, 2013, 2010, 2009].map((y) => ageDivision(y, march2026))).toEqual(['Junior', 'Senior', 'Senior', 'Master']);
  });
  it('moves to the next season in July', () => {
    const oct2026 = new Date(2026, 9, 15).getTime();
    expect(seasonYear(oct2026)).toBe(2027);
    expect([2015, 2014, 2010].map((y) => ageDivision(y, oct2026))).toEqual(['Junior', 'Senior', 'Master']);
    expect(ageDivision(NaN, oct2026)).toBe(null);
  });
});

describe('validPlayerId and qrMatrix', () => {
  it('accepts numeric IDs only', () => {
    expect(validPlayerId('4359311')).toBe(true);
    expect(validPlayerId('43a')).toBe(false);
  });
  it('builds a square matrix of the right version', () => {
    const m = qrMatrix(playerQrText(alessio, Date.UTC(2026, 9, 15)));
    expect(m.length).toBe(41); // version 6
    expect(m.every((row) => row.length === 41)).toBe(true);
    // Finder pattern corners are dark.
    expect([m[0][0], m[0][40], m[40][0]]).toEqual([true, true, true]);
  });
});

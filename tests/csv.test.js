import { describe, expect, it } from 'vitest';
import { csvCell, csvFileName, toCsv } from '../src/lib/domain/csv.js';

const row = { name: 'Pikachu', set: '151', number: '025/165', lang: 'it', variant: 'Reverse', qty: 2, price: 1.2 };

describe('csvCell', () => {
  it('uses the decimal comma and quotes separators, quotes and line breaks', () => {
    expect(csvCell(1.5)).toBe('1,5');
    expect(csvCell(null)).toBe('');
    expect(csvCell('Pokémon')).toBe('Pokémon');
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('Il "grande"')).toBe('"Il ""grande"""');
    expect(csvCell('x\ny')).toBe('"x\ny"');
  });
});

describe('toCsv', () => {
  it('writes a BOM, the selected columns in fixed order and CRLF lines', () => {
    const csv = toCsv([row, { ...row, name: 'Ninetales; d\'Alola', price: null }], ['qty', 'name', 'price']);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.slice(1).split('\r\n')).toEqual(['nome;quantita;prezzo', 'Pikachu;2;1,2', '"Ninetales; d\'Alola";2;', '']);
  });

  it('rounds prices to cents and can skip the BOM for the preview', () => {
    expect(toCsv([{ ...row, price: 4.199999 }], ['price'], { bom: false })).toBe('prezzo\r\n4,2\r\n');
  });
});

describe('csvFileName', () => {
  it('slugs the label without accents', () => {
    expect(csvFileName('Lista desideri', '2026-10-15')).toBe('deckflix-lista-desideri-2026-10-15.csv');
    expect(csvFileName('Deck: Elettrico è veloce!', '2026-10-15')).toBe('deckflix-deck-elettrico-e-veloce-2026-10-15.csv');
  });
});

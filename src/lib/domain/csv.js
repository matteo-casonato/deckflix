// @ts-check
// CSV export (SPEC § 7): semicolon separator, decimal comma, CRLF and a UTF-8 BOM, so the
// file opens with the right columns and accents in Excel and Google Sheets set to Italian.

/**
 * @typedef {{ name: string, set: string, number: string, lang: string, variant: string, condition: string, qty: number, price: number | null }} CsvRow
 * @typedef {keyof CsvRow} CsvColumn
 */

/** Selectable columns, in file order: [key, header, label in the UI]. */
export const CSV_COLUMNS = /** @type {const} */ ([
  ['name', 'nome', 'Nome'],
  ['set', 'edizione', 'Edizione'],
  ['number', 'numero', 'Numero'],
  ['lang', 'lingua', 'Lingua'],
  ['variant', 'variante', 'Variante'],
  ['condition', 'condizione', 'Condizione'],
  ['qty', 'quantita', 'Quantità'],
  ['price', 'prezzo_trend', 'Prezzo trend'],
]);

export const SEPARATOR = ';';
const BOM = '﻿';

/** Quotes a cell when it contains the separator, quotes or line breaks. */
/** @param {unknown} value */
export function csvCell(value) {
  if (value == null) return '';
  const s = typeof value === 'number' ? String(value).replace('.', ',') : String(value);
  return /[";\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

/**
 * @param {CsvRow[]} rows
 * @param {CsvColumn[]} columns selected keys (file order follows CSV_COLUMNS)
 * @param {{ bom?: boolean }} [o] bom: false for the on-screen preview
 */
export function toCsv(rows, columns, { bom = true } = {}) {
  const cols = CSV_COLUMNS.filter(([k]) => columns.includes(k));
  const lines = [cols.map(([, header]) => header).join(SEPARATOR)];
  for (const r of rows) {
    lines.push(cols.map(([k]) => csvCell(k === 'price' && r.price != null ? Math.round(r.price * 100) / 100 : r[k])).join(SEPARATOR));
  }
  return (bom ? BOM : '') + lines.join('\r\n') + '\r\n';
}

/** "deckflix-collezione-2026-10-15.csv" (no characters that file systems reject). */
/** @param {string} label @param {string} day */
export function csvFileName(label, day) {
  const slug = label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `deckflix-${slug || 'export'}-${day}.csv`;
}
